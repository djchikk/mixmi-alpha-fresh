/**
 * RecordingProcessor - AudioWorklet for sample-accurate mic recording
 *
 * This runs on the audio thread, giving us exact sample positions
 * correlated with AudioContext.currentTime - no MediaRecorder latency!
 */

class RecordingProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.isRecording = false;
    this.recordedChunks = [];
    this.startFrame = null;
    this.targetSamples = null; // Exact number of samples to record
    this.samplesRecorded = 0;

    this.port.onmessage = (event) => {
      const { command, targetSamples, startAtFrame } = event.data;

      if (command === 'start') {
        this.isRecording = true;
        this.recordedChunks = [];
        this.startFrame = currentFrame;
        this.targetSamples = targetSamples || null;
        this.samplesRecorded = 0;

        this.port.postMessage({
          type: 'started',
          frame: currentFrame,
          time: currentTime,
          sampleRate: sampleRate
        });

        console.log(`[AudioWorklet] Recording started at frame ${currentFrame}, time ${currentTime.toFixed(4)}s`);

      } else if (command === 'stop') {
        this.finishRecording('manual');

      } else if (command === 'getStatus') {
        this.port.postMessage({
          type: 'status',
          isRecording: this.isRecording,
          samplesRecorded: this.samplesRecorded,
          targetSamples: this.targetSamples
        });
      }
    };
  }

  finishRecording(reason) {
    if (!this.isRecording) return;

    this.isRecording = false;

    // Concatenate all chunks into single array
    const totalSamples = this.recordedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of this.recordedChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    console.log(`[AudioWorklet] Recording stopped (${reason}): ${totalSamples} samples captured`);

    this.port.postMessage({
      type: 'stopped',
      reason: reason,
      samples: combined,
      totalSamples: totalSamples,
      startFrame: this.startFrame,
      endFrame: currentFrame,
      sampleRate: sampleRate,
      durationSeconds: totalSamples / sampleRate
    });

    // Clear for next recording
    this.recordedChunks = [];
    this.startFrame = null;
    this.samplesRecorded = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    if (this.isRecording && input && input.length > 0 && input[0]) {
      const channelData = input[0]; // Mono - just first channel

      // Check if we need to stop at target
      if (this.targetSamples !== null) {
        const remaining = this.targetSamples - this.samplesRecorded;

        if (remaining <= 0) {
          // We've hit our target
          this.finishRecording('targetReached');
          return true;
        }

        if (remaining < channelData.length) {
          // Only capture what we need
          const partial = new Float32Array(remaining);
          partial.set(channelData.subarray(0, remaining));
          this.recordedChunks.push(partial);
          this.samplesRecorded += remaining;
          this.finishRecording('targetReached');
          return true;
        }
      }

      // Store this chunk (make a copy since the buffer is reused)
      const chunk = new Float32Array(channelData.length);
      chunk.set(channelData);
      this.recordedChunks.push(chunk);
      this.samplesRecorded += channelData.length;
    }

    return true; // Keep processor alive
  }
}

registerProcessor('recording-processor', RecordingProcessor);
