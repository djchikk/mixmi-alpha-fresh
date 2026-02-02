/**
 * useMixerRecording - Recording state management for Universal Mixer
 *
 * Captures crossfaded audio output using MediaStreamAudioDestinationNode,
 * provides waveform data, and manages recording state.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { getMasterGain, getAudioContext } from '@/lib/mixerAudio';
import {
  calculateRecordingCost,
  calculatePaymentSplit,
  calculateBlockCount,
  secondsToBars,
  barsToSeconds,
  getBarDuration,
  getBlockDuration,
} from '@/lib/recording/paymentCalculation';

export type RecordingState = 'idle' | 'armed' | 'countingIn' | 'recording' | 'stopped';

export interface RecordingData {
  blob: Blob;
  audioBuffer: AudioBuffer;
  durationSeconds: number;
  durationBars: number;
  waveformData: Float32Array;
  bpm: number;
}

export interface TrimState {
  startBars: number;
  endBars: number;
  totalBars: number;
}

export interface RecordingCostInfo {
  bars: number;
  blocks: number;
  trackCount: number;
  totalCost: number;
  platformCut: number;
  creatorsCut: number;
  remixerStake: number;
}

interface UseMixerRecordingReturn {
  // State
  recordingState: RecordingState;
  recordingData: RecordingData | null;
  trimState: TrimState;
  costInfo: RecordingCostInfo | null;
  isRecording: boolean;
  isArmed: boolean;
  countInBeat: number; // 0 = not counting, 1-4 = count-in beat
  error: string | null;

  // Actions
  armRecording: (bpm: number) => void; // New: arms recording and returns
  startRecording: (bpm: number) => void; // Actually starts recording
  stopRecording: () => Promise<void>;
  onMixerCycleComplete: () => void; // Called by mixer when one full cycle completes
  setTrimStart: (bars: number) => void;
  setTrimEnd: (bars: number) => void;
  nudgeTrim: (point: 'start' | 'end', direction: 'left' | 'right', resolution: number) => void;
  resetRecording: () => void;
  getAudioForTrim: () => Promise<Blob | null>;
}

export function useMixerRecording(trackCount: number = 2): UseMixerRecordingReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingData, setRecordingData] = useState<RecordingData | null>(null);
  const [trimState, setTrimState] = useState<TrimState>({
    startBars: 0,
    endBars: 8,
    totalBars: 8,
  });
  const [error, setError] = useState<string | null>(null);
  const [countInBeat, setCountInBeat] = useState<number>(0);

  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingBpmRef = useRef<number>(120);
  const recordingStartTimeRef = useRef<number>(0);
  const countInTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate cost info whenever trim changes
  const costInfo: RecordingCostInfo | null = recordingData
    ? (() => {
        const bars = trimState.endBars - trimState.startBars;
        const blocks = calculateBlockCount(bars);
        const totalCost = calculateRecordingCost(bars, trackCount);
        const split = calculatePaymentSplit(totalCost);

        return {
          bars,
          blocks,
          trackCount,
          totalCost,
          platformCut: split.platform,
          creatorsCut: split.creators,
          remixerStake: split.remixerStake,
        };
      })()
    : null;

  /**
   * Arm recording - puts recording in armed state waiting for mixer cycle
   * The mixer should auto-start playback when armed
   */
  const armRecording = useCallback((bpm: number) => {
    setError(null);
    recordingBpmRef.current = bpm;
    setRecordingState('armed');
    console.log(`🔴 Recording ARMED at ${bpm} BPM - waiting for mixer to complete one cycle`);
  }, []);

  /**
   * Called by mixer when one full loop cycle completes
   * Triggers count-in and then actual recording
   */
  const onMixerCycleComplete = useCallback(() => {
    if (recordingState !== 'armed') return;

    console.log('🔴 Mixer cycle complete - starting count-in');
    setRecordingState('countingIn');

    const bpm = recordingBpmRef.current;
    const beatInterval = (60 / bpm) * 1000; // ms per beat

    // Count-in: 4 beats
    setCountInBeat(1);

    const runCountIn = (beat: number) => {
      if (beat < 4) {
        countInTimeoutRef.current = setTimeout(() => {
          setCountInBeat(beat + 1);
          runCountIn(beat + 1);
        }, beatInterval);
      } else {
        // Count-in complete, start actual recording after final beat
        countInTimeoutRef.current = setTimeout(() => {
          setCountInBeat(0);
          // Now actually start recording
          startActualRecording(bpm);
        }, beatInterval);
      }
    };

    runCountIn(1);
  }, [recordingState]);

  /**
   * Internal: Actually start the MediaRecorder
   */
  const startActualRecording = useCallback((bpm: number) => {
    setError(null);

    try {
      const audioContext = getAudioContext();
      const masterGain = getMasterGain();

      if (!audioContext || !masterGain) {
        throw new Error('Audio context not initialized');
      }

      // Resume audio context if suspended
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      // Create a MediaStreamDestination node to capture audio
      const streamDestination = audioContext.createMediaStreamDestination();
      streamDestinationRef.current = streamDestination;

      // Connect master gain to our stream destination (in addition to speakers)
      masterGain.connect(streamDestination);

      // Determine best supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(streamDestination.stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('🚨 MediaRecorder error:', event);
        setError('Recording failed');
        setRecordingState('idle');
      };

      mediaRecorderRef.current = mediaRecorder;
      recordingBpmRef.current = bpm;
      recordingStartTimeRef.current = Date.now();

      // Start recording with 100ms timeslice for smoother data collection
      mediaRecorder.start(100);

      setRecordingState('recording');
      console.log(`🔴 Recording started at ${bpm} BPM`);
    } catch (err) {
      console.error('🚨 Failed to start recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }, []);

  /**
   * Start recording directly (bypasses arm flow - for backwards compatibility)
   */
  const startRecording = useCallback((bpm: number) => {
    startActualRecording(bpm);
  }, [startActualRecording]);

  /**
   * Stop recording and process the captured audio
   */
  const stopRecording = useCallback(async () => {
    // Clear any count-in in progress
    if (countInTimeoutRef.current) {
      clearTimeout(countInTimeoutRef.current);
      countInTimeoutRef.current = null;
    }
    setCountInBeat(0);

    // If we were just armed or counting in, just reset
    if (recordingState === 'armed' || recordingState === 'countingIn') {
      console.log('⏹️ Recording cancelled (was armed/counting in)');
      setRecordingState('idle');
      return;
    }

    const mediaRecorder = mediaRecorderRef.current;
    const streamDestination = streamDestinationRef.current;
    const masterGain = getMasterGain();

    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      console.warn('⚠️ No active recording to stop');
      setRecordingState('idle');
      return;
    }

    return new Promise<void>((resolve) => {
      mediaRecorder.onstop = async () => {
        try {
          // Disconnect stream destination from master gain
          if (masterGain && streamDestination) {
            try {
              masterGain.disconnect(streamDestination);
            } catch (e) {
              // May already be disconnected
            }
          }

          // Combine chunks into a blob
          const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
          const recordingDuration = (Date.now() - recordingStartTimeRef.current) / 1000;

          console.log(`⏹️ Recording stopped: ${recordingDuration.toFixed(2)}s, ${blob.size} bytes`);

          // Decode audio for waveform and analysis
          const audioContext = getAudioContext();
          if (!audioContext) {
            throw new Error('Audio context not available');
          }

          const arrayBuffer = await blob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Calculate bars from duration
          const bpm = recordingBpmRef.current;
          const durationBars = secondsToBars(audioBuffer.duration, bpm);

          // Generate waveform data (downsampled for visualization)
          const waveformData = generateWaveformData(audioBuffer, 800); // 800 points

          // Set initial trim to full recording, snapped to 8-bar boundaries
          const totalBars = Math.floor(durationBars / 8) * 8;
          const endBars = Math.max(8, totalBars);

          setRecordingData({
            blob,
            audioBuffer,
            durationSeconds: audioBuffer.duration,
            durationBars,
            waveformData,
            bpm,
          });

          setTrimState({
            startBars: 0,
            endBars,
            totalBars: durationBars,
          });

          setRecordingState('stopped');
          console.log(`✅ Recording processed: ${durationBars.toFixed(1)} bars at ${bpm} BPM`);

          resolve();
        } catch (err) {
          console.error('🚨 Error processing recording:', err);
          setError(err instanceof Error ? err.message : 'Failed to process recording');
          setRecordingState('idle');
          resolve();
        }
      };

      mediaRecorder.stop();
    });
  }, []);

  /**
   * Set trim start point (in bars)
   */
  const setTrimStart = useCallback((bars: number) => {
    setTrimState((prev) => ({
      ...prev,
      startBars: Math.max(0, Math.min(bars, prev.endBars - 8)), // At least 8 bars
    }));
  }, []);

  /**
   * Set trim end point (in bars)
   */
  const setTrimEnd = useCallback((bars: number) => {
    setTrimState((prev) => ({
      ...prev,
      endBars: Math.min(prev.totalBars, Math.max(bars, prev.startBars + 8)), // At least 8 bars
    }));
  }, []);

  /**
   * Nudge trim point by resolution (1 bar, 1 beat, 1/16)
   */
  const nudgeTrim = useCallback(
    (point: 'start' | 'end', direction: 'left' | 'right', resolution: number) => {
      const delta = direction === 'left' ? -resolution : resolution;

      setTrimState((prev) => {
        if (point === 'start') {
          const newStart = Math.max(0, Math.min(prev.startBars + delta, prev.endBars - 8));
          return { ...prev, startBars: newStart };
        } else {
          const newEnd = Math.min(prev.totalBars, Math.max(prev.endBars + delta, prev.startBars + 8));
          return { ...prev, endBars: newEnd };
        }
      });
    },
    []
  );

  /**
   * Reset recording state
   */
  const resetRecording = useCallback(() => {
    // Clear any count-in in progress
    if (countInTimeoutRef.current) {
      clearTimeout(countInTimeoutRef.current);
      countInTimeoutRef.current = null;
    }
    setCountInBeat(0);

    // Stop any active recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Cleanup stream destination
    if (streamDestinationRef.current) {
      const masterGain = getMasterGain();
      if (masterGain) {
        try {
          masterGain.disconnect(streamDestinationRef.current);
        } catch (e) {
          // May already be disconnected
        }
      }
      streamDestinationRef.current = null;
    }

    mediaRecorderRef.current = null;
    chunksRef.current = [];

    setRecordingState('idle');
    setRecordingData(null);
    setTrimState({ startBars: 0, endBars: 8, totalBars: 8 });
    setError(null);
  }, []);

  /**
   * Get trimmed audio as a blob
   */
  const getAudioForTrim = useCallback(async (): Promise<Blob | null> => {
    if (!recordingData) return null;

    const { audioBuffer, bpm } = recordingData;
    const startSeconds = barsToSeconds(trimState.startBars, bpm);
    const endSeconds = barsToSeconds(trimState.endBars, bpm);
    const trimDuration = endSeconds - startSeconds;

    // Create a new buffer with just the trimmed portion
    const audioContext = getAudioContext();
    if (!audioContext) return null;

    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(startSeconds * sampleRate);
    const endSample = Math.floor(endSeconds * sampleRate);
    const trimmedLength = endSample - startSample;

    const trimmedBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      trimmedLength,
      sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const sourceData = audioBuffer.getChannelData(channel);
      const destData = trimmedBuffer.getChannelData(channel);
      for (let i = 0; i < trimmedLength; i++) {
        destData[i] = sourceData[startSample + i];
      }
    }

    // Convert to WAV
    const wavBlob = await audioBufferToWav(trimmedBuffer);
    return wavBlob;
  }, [recordingData, trimState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countInTimeoutRef.current) {
        clearTimeout(countInTimeoutRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamDestinationRef.current) {
        const masterGain = getMasterGain();
        if (masterGain) {
          try {
            masterGain.disconnect(streamDestinationRef.current);
          } catch (e) {
            // Ignore
          }
        }
      }
    };
  }, []);

  return {
    recordingState,
    recordingData,
    trimState,
    costInfo,
    isRecording: recordingState === 'recording',
    isArmed: recordingState === 'armed',
    countInBeat,
    error,
    armRecording,
    startRecording,
    stopRecording,
    onMixerCycleComplete,
    setTrimStart,
    setTrimEnd,
    nudgeTrim,
    resetRecording,
    getAudioForTrim,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate downsampled waveform data for visualization
 */
function generateWaveformData(audioBuffer: AudioBuffer, targetPoints: number): Float32Array {
  const channelData = audioBuffer.getChannelData(0);
  const samplesPerPoint = Math.floor(channelData.length / targetPoints);
  const waveform = new Float32Array(targetPoints);

  for (let i = 0; i < targetPoints; i++) {
    const start = i * samplesPerPoint;
    const end = Math.min(start + samplesPerPoint, channelData.length);

    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }

    waveform[i] = max;
  }

  return waveform;
}

/**
 * Convert AudioBuffer to WAV blob
 */
async function audioBufferToWav(audioBuffer: AudioBuffer): Promise<Blob> {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length * numberOfChannels * 2; // 16-bit samples
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);

  // Write WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');

  // FMT sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);

  // Data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, length, true);

  // Write interleaved audio data
  let pos = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = audioBuffer.getChannelData(channel)[i];
      const int16 = Math.max(-1, Math.min(1, sample)) * 0x7fff;
      view.setInt16(pos, int16, true);
      pos += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
