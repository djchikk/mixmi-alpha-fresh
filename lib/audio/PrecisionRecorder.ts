/**
 * PrecisionRecorder - Sample-accurate mic recording using AudioWorklet
 *
 * This replaces MediaRecorder for musical applications where timing precision matters.
 * The AudioWorklet runs on the audio thread, giving us exact sample positions
 * correlated with AudioContext.currentTime.
 */

export interface RecordingResult {
  audioBuffer: AudioBuffer;
  wavBlob: Blob;
  durationSeconds: number;
  sampleRate: number;
  actualSamples: number;
  expectedSamples: number;
}

export interface RecordingConfig {
  bpm: number;
  bars: number;
  cycles: number;
}

type RecordingState = 'idle' | 'initializing' | 'ready' | 'armed' | 'recording' | 'processing';

export class PrecisionRecorder {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;

  private state: RecordingState = 'idle';
  private recordingPromise: {
    resolve: (result: RecordingResult) => void;
    reject: (error: Error) => void;
  } | null = null;

  private config: RecordingConfig | null = null;
  private expectedSamples: number = 0;

  // Callbacks
  public onStateChange?: (state: RecordingState) => void;
  public onError?: (error: Error) => void;

  /**
   * Initialize the recorder - must be called before recording
   * Should be called after user gesture (click) due to AudioContext restrictions
   */
  async initialize(): Promise<void> {
    if (this.state !== 'idle') {
      console.log('🎤 PrecisionRecorder: Already initialized');
      return;
    }

    this.setState('initializing');

    try {
      // Create or resume AudioContext
      this.audioContext = new AudioContext();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      console.log(`🎤 PrecisionRecorder: AudioContext created, sampleRate=${this.audioContext.sampleRate}`);

      // Load the AudioWorklet module
      await this.audioContext.audioWorklet.addModule('/audio-worklets/recording-processor.js');
      console.log('🎤 PrecisionRecorder: AudioWorklet module loaded');

      // Get mic stream with settings optimized for music
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,  // Don't process the audio
          noiseSuppression: false,  // Keep natural sound
          autoGainControl: false,   // Don't adjust levels
        }
      });
      console.log('🎤 PrecisionRecorder: Mic stream acquired');

      // Create mic source and worklet node
      this.micSource = this.audioContext.createMediaStreamSource(this.micStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'recording-processor');

      // Connect mic -> worklet (not to destination - we don't want to hear ourselves)
      this.micSource.connect(this.workletNode);

      // Handle messages from worklet
      this.workletNode.port.onmessage = this.handleWorkletMessage.bind(this);

      this.setState('ready');
      console.log('🎤 PrecisionRecorder: Ready for recording');

    } catch (error) {
      console.error('🎤 PrecisionRecorder: Initialization failed:', error);
      this.setState('idle');
      throw error;
    }
  }

  /**
   * Check if mic stream is still valid
   */
  isStreamValid(): boolean {
    if (!this.micStream) return false;
    const tracks = this.micStream.getAudioTracks();
    return tracks.length > 0 && tracks.every(track => track.readyState === 'live');
  }

  /**
   * Re-initialize if stream became invalid
   */
  async ensureReady(): Promise<void> {
    if (this.state === 'idle') {
      await this.initialize();
    } else if (!this.isStreamValid()) {
      console.log('🎤 PrecisionRecorder: Stream invalid, reinitializing...');
      await this.cleanup();
      await this.initialize();
    }
  }

  /**
   * Start recording for a specific duration based on BPM and cycle count
   */
  async startRecording(config: RecordingConfig): Promise<RecordingResult> {
    await this.ensureReady();

    if (this.state !== 'ready') {
      throw new Error(`Cannot start recording in state: ${this.state}`);
    }

    this.config = config;

    // Calculate exact sample count for the loop duration
    // 1 cycle = 8 bars = 32 beats
    const beatsPerCycle = 32;
    const secondsPerBeat = 60 / config.bpm;
    const durationSeconds = config.cycles * beatsPerCycle * secondsPerBeat;
    this.expectedSamples = Math.round(durationSeconds * this.audioContext!.sampleRate);

    console.log(`🎤 PrecisionRecorder: Starting recording`);
    console.log(`🎤   BPM: ${config.bpm}, Cycles: ${config.cycles}`);
    console.log(`🎤   Expected duration: ${durationSeconds.toFixed(4)}s`);
    console.log(`🎤   Expected samples: ${this.expectedSamples}`);

    return new Promise((resolve, reject) => {
      this.recordingPromise = { resolve, reject };
      this.setState('recording');

      // Tell worklet to start recording with target sample count
      this.workletNode!.port.postMessage({
        command: 'start',
        targetSamples: this.expectedSamples
      });
    });
  }

  /**
   * Manually stop recording (if not using auto-stop via targetSamples)
   */
  stopRecording(): void {
    if (this.state !== 'recording') {
      console.warn('🎤 PrecisionRecorder: Not recording, ignoring stop');
      return;
    }

    this.workletNode?.port.postMessage({ command: 'stop' });
  }

  /**
   * Handle messages from the AudioWorklet
   */
  private handleWorkletMessage(event: MessageEvent): void {
    const { type, ...data } = event.data;

    if (type === 'started') {
      console.log(`🎤 PrecisionRecorder: Worklet started at frame ${data.frame}, time ${data.time.toFixed(4)}s`);

    } else if (type === 'stopped') {
      console.log(`🎤 PrecisionRecorder: Worklet stopped (${data.reason})`);
      console.log(`🎤   Captured: ${data.totalSamples} samples (${data.durationSeconds.toFixed(4)}s)`);
      console.log(`🎤   Expected: ${this.expectedSamples} samples`);

      this.setState('processing');
      this.processRecording(data.samples, data.sampleRate);

    } else if (type === 'status') {
      console.log('🎤 PrecisionRecorder: Status:', data);
    }
  }

  /**
   * Process the raw samples into final AudioBuffer and WAV
   */
  private async processRecording(samples: Float32Array, sampleRate: number): Promise<void> {
    try {
      console.log(`🎤 PrecisionRecorder: Processing ${samples.length} samples...`);

      // Create AudioBuffer with EXACT expected duration
      const audioBuffer = this.createExactDurationBuffer(samples, sampleRate);

      console.log(`🎤 PrecisionRecorder: Created buffer with ${audioBuffer.length} samples`);

      // Convert to WAV
      const wavBlob = this.audioBufferToWav(audioBuffer);
      console.log(`🎤 PrecisionRecorder: WAV blob created, ${(wavBlob.size / 1024).toFixed(1)}KB`);

      const result: RecordingResult = {
        audioBuffer,
        wavBlob,
        durationSeconds: audioBuffer.length / audioBuffer.sampleRate,
        sampleRate: audioBuffer.sampleRate,
        actualSamples: samples.length,
        expectedSamples: this.expectedSamples
      };

      this.setState('ready');

      if (this.recordingPromise) {
        this.recordingPromise.resolve(result);
        this.recordingPromise = null;
      }

    } catch (error) {
      console.error('🎤 PrecisionRecorder: Processing failed:', error);
      this.setState('ready');

      if (this.recordingPromise) {
        this.recordingPromise.reject(error as Error);
        this.recordingPromise = null;
      }
    }
  }

  /**
   * Create an AudioBuffer with exact expected duration
   * Pads with silence or trims as needed
   */
  private createExactDurationBuffer(samples: Float32Array, sampleRate: number): AudioBuffer {
    const buffer = this.audioContext!.createBuffer(1, this.expectedSamples, sampleRate);
    const channelData = buffer.getChannelData(0);

    if (samples.length >= this.expectedSamples) {
      // Recording is long enough - use exact amount
      channelData.set(samples.subarray(0, this.expectedSamples));
      console.log(`🎤 PrecisionRecorder: Trimmed ${samples.length - this.expectedSamples} excess samples`);
    } else {
      // Recording is short - copy what we have, rest is silence (zeros)
      channelData.set(samples);
      const paddingSamples = this.expectedSamples - samples.length;
      const paddingMs = (paddingSamples / sampleRate) * 1000;
      console.log(`🎤 PrecisionRecorder: Padded ${paddingSamples} samples (${paddingMs.toFixed(1)}ms) of silence`);
    }

    return buffer;
  }

  /**
   * Convert AudioBuffer to WAV Blob
   */
  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    // Write samples
    const channelData = buffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Get current state
   */
  getState(): RecordingState {
    return this.state;
  }

  /**
   * Set state and notify
   */
  private setState(state: RecordingState): void {
    this.state = state;
    this.onStateChange?.(state);
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    console.log('🎤 PrecisionRecorder: Cleaning up...');

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.setState('idle');
  }
}

// Singleton instance for easy access
let recorderInstance: PrecisionRecorder | null = null;

export function getPrecisionRecorder(): PrecisionRecorder {
  if (!recorderInstance) {
    recorderInstance = new PrecisionRecorder();
  }
  return recorderInstance;
}
