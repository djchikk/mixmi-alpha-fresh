import { AudioState } from '@/components/mixer/types';

interface RecordingOptions {
  bars: number;
  bpm: number;
  audioContext: AudioContext;
  sourceNode: AudioNode; // This will be the master gain node
}

interface RecordingResult {
  blob: Blob;
  url: string;
  duration: number;
  bars: number;
}

export class MixerRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingStartTime: number = 0;
  private isRecording: boolean = false;
  private recordingPromise: Promise<RecordingResult> | null = null;

  async startRecording(options: RecordingOptions): Promise<RecordingResult> {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    const { bars, bpm, audioContext, sourceNode } = options;
    
    // Calculate recording duration
    const beatsPerBar = 4; // Assuming 4/4 time
    const totalBeats = bars * beatsPerBar;
    const beatsPerSecond = bpm / 60;
    const recordingDuration = totalBeats / beatsPerSecond;
    
    console.log(`🎤 Starting ${bars}-bar recording at ${bpm} BPM (${recordingDuration.toFixed(1)}s)`);

    try {
      // Create destination for recording
      const destination = audioContext.createMediaStreamDestination();
      
      // Connect the source (master gain) to the destination
      sourceNode.connect(destination);
      
      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });
      
      this.recordedChunks = [];
      
      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      // Create promise that resolves when recording is complete
      this.recordingPromise = new Promise((resolve, reject) => {
        if (!this.mediaRecorder) {
          reject(new Error('MediaRecorder not initialized'));
          return;
        }

        this.mediaRecorder.onstop = () => {
          try {
            // Create blob from recorded chunks
            const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            
            const actualDuration = (Date.now() - this.recordingStartTime) / 1000;
            
            console.log(`✅ Recording complete: ${actualDuration.toFixed(1)}s`);
            
            // Disconnect the recording connection
            sourceNode.disconnect(destination);
            
            resolve({
              blob,
              url,
              duration: actualDuration,
              bars
            });
          } catch (error) {
            reject(error);
          } finally {
            this.isRecording = false;
            this.mediaRecorder = null;
          }
        };

        this.mediaRecorder.onerror = (event: any) => {
          console.error('🚨 Recording error:', event.error);
          reject(event.error);
          this.isRecording = false;
          this.mediaRecorder = null;
        };
      });

      // Start recording
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this.mediaRecorder.start(100); // Capture data every 100ms
      
      // Auto-stop after the calculated duration
      setTimeout(() => {
        this.stopRecording(false); // Don't capture extra bar for auto-stop
      }, recordingDuration * 1000);

      return this.recordingPromise;
      
    } catch (error) {
      console.error('🚨 Failed to start recording:', error);
      this.isRecording = false;
      this.mediaRecorder = null;
      throw error;
    }
  }

  stopRecording(captureExtraBars: boolean = true, bpm: number = 120): void {
    if (!this.isRecording || !this.mediaRecorder) {
      console.warn('⚠️ No recording to stop');
      return;
    }

    if (captureExtraBars) {
      // Calculate 2 bars duration to capture effects tail
      const beatsPerBar = 4;
      const beatsPerSecond = bpm / 60;
      const extraBars = 2; // Capture 2 bars of effects tail
      const extraDuration = (extraBars * beatsPerBar) / beatsPerSecond;
      const delayMs = extraDuration * 1000;
      
      console.log(`⏹️ Stopping recording in ${extraDuration.toFixed(1)}s to capture ${extraBars} bars of effects tail...`);
      
      // Delay the actual stop to capture 2 extra bars
      setTimeout(() => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
        }
      }, delayMs);
    } else {
      console.log('⏹️ Stopping recording...');
      this.mediaRecorder.stop();
    }
  }

  cancelRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) {
      return;
    }

    console.log('❌ Cancelling recording...');
    this.mediaRecorder.stop();
    this.recordedChunks = [];
    this.isRecording = false;
    this.mediaRecorder = null;
    this.recordingPromise = null;
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }
}

// Singleton instance
export const mixerRecorder = new MixerRecorder();