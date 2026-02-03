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

// Recording states:
// idle - Not recording, ready to start
// preCountdown - 4-3-2-1 countdown BEFORE arming (user prep time)
// armed - Waiting for first loop restart to begin rehearsal
// rehearsal - First cycle playing (sync stabilization), waiting for next loop restart
// countingIn - 4-beat count-in before recording (deprecated, not used)
// recording - Actively capturing audio
// stopped - Recording complete, ready for trim/save
export type RecordingState = 'idle' | 'preCountdown' | 'armed' | 'rehearsal' | 'countingIn' | 'recording' | 'stopped';

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
  isRehearsal: boolean;
  isPreCountdown: boolean; // true during 4-3-2-1 countdown before arming
  countInBeat: number; // 0 = not counting, 1-4 = count-in/pre-countdown beat
  error: string | null;

  // Actions
  startPreCountdown: (bpm: number, onCountdownComplete: () => void) => void; // Start 4-3-2-1 countdown
  armRecording: (bpm: number) => void; // Arms recording, waits for loop restart
  startRecording: (bpm: number) => void; // Actually starts recording (direct, bypasses arm flow)
  stopRecording: () => Promise<void>;
  onMixerCycleComplete: () => void; // DEPRECATED: Now using window.onMixerLoopRestart internally
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
  const preCountdownCallbackRef = useRef<(() => void) | null>(null);

  // Ref to track state for callback access (callbacks capture stale state)
  const recordingStateRef = useRef<RecordingState>('idle');

  // Helper to update both state and ref synchronously (prevents race conditions)
  const setRecordingStateSync = useCallback((newState: RecordingState) => {
    console.log(`🔴 Recording state: ${recordingStateRef.current} → ${newState}`);
    recordingStateRef.current = newState; // Update ref FIRST (synchronous)
    setRecordingState(newState); // Then queue state update
  }, []);

  /**
   * Start a 4-3-2-1 pre-countdown before arming
   * This gives users time to prepare before recording starts
   */
  const startPreCountdown = useCallback((bpm: number, onCountdownComplete: () => void) => {
    setError(null);
    recordingBpmRef.current = bpm;
    preCountdownCallbackRef.current = onCountdownComplete;

    setRecordingStateSync('preCountdown');

    const beatInterval = (60 / bpm) * 1000; // ms per beat
    console.log(`🔴 Pre-countdown starting at ${bpm} BPM (${beatInterval}ms per beat)`);

    // Start at 4, count down to 1
    setCountInBeat(4);

    const runCountdown = (beat: number) => {
      if (beat > 1) {
        countInTimeoutRef.current = setTimeout(() => {
          setCountInBeat(beat - 1);
          runCountdown(beat - 1);
        }, beatInterval);
      } else {
        // Countdown complete (just showed "1"), now trigger callback after final beat
        countInTimeoutRef.current = setTimeout(() => {
          setCountInBeat(0);
          console.log('🔴 Pre-countdown complete!');
          // Call the callback (which should arm and start playback)
          if (preCountdownCallbackRef.current) {
            preCountdownCallbackRef.current();
          }
        }, beatInterval);
      }
    };

    runCountdown(4);
  }, [setRecordingStateSync]);

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
   * Internal: Actually start the MediaRecorder
   * IMPORTANT: This must be defined BEFORE any functions or effects that use it!
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
        setRecordingStateSync('idle');
      };

      mediaRecorderRef.current = mediaRecorder;
      recordingBpmRef.current = bpm;
      recordingStartTimeRef.current = Date.now();

      // Start recording with 100ms timeslice for smoother data collection
      mediaRecorder.start(100);

      setRecordingStateSync('recording');
      console.log(`🔴 Recording started at ${bpm} BPM`);
    } catch (err) {
      console.error('🚨 Failed to start recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }, [setRecordingStateSync]);

  /**
   * Arm recording - puts recording in armed state waiting for loop restart
   * The mixer should auto-start playback when armed
   */
  const armRecording = useCallback((bpm: number) => {
    setError(null);
    recordingBpmRef.current = bpm;
    setRecordingStateSync('armed');
    console.log(`🔴 Recording ARMED at ${bpm} BPM - waiting for loop restart (bar 1)`);
  }, [setRecordingStateSync]);

  /**
   * Start count-in sequence (called internally when rehearsal cycle completes)
   * NOTE: Currently not used - recording starts immediately at bar 1 after rehearsal
   */
  const startCountIn = useCallback(() => {
    console.log('🔴 Starting count-in');
    setRecordingStateSync('countingIn');

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
  }, [startActualRecording, setRecordingStateSync]);

  /**
   * Listen for loop restart events from PreciseLooper
   * This is the core of the rehearsal cycle approach:
   * armed → (loop restart) → rehearsal → (loop restart) → recording
   *
   * NOTE: No count-in! Recording starts immediately at bar 1 after rehearsal.
   * Count-in would delay recording to bar 2.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleLoopRestart = (deckId: 'A' | 'B') => {
      const currentState = recordingStateRef.current;
      console.log(`🔴 Loop restart on Deck ${deckId}, recording state: ${currentState}`);

      if (currentState === 'armed') {
        // First loop restart while armed → enter rehearsal (sync stabilization cycle)
        console.log('🔴 Entering rehearsal cycle (sync stabilization)');
        setRecordingStateSync('rehearsal');
      } else if (currentState === 'rehearsal') {
        // Second loop restart (after rehearsal) → start recording immediately at bar 1!
        // No count-in - that would delay recording to bar 2
        console.log('🔴 Rehearsal complete - starting recording at bar 1!');
        const bpm = recordingBpmRef.current;
        startActualRecording(bpm);
      }
    };

    // Register the callback
    (window as any).onMixerRecordingLoopRestart = handleLoopRestart;
    console.log('🔴 Registered loop restart listener for recording');

    return () => {
      // Cleanup
      delete (window as any).onMixerRecordingLoopRestart;
      console.log('🔴 Unregistered loop restart listener for recording');
    };
  }, [startActualRecording, setRecordingStateSync]);

  /**
   * DEPRECATED: Called by mixer when one full loop cycle completes
   * Now using window.onMixerRecordingLoopRestart internally
   */
  const onMixerCycleComplete = useCallback(() => {
    console.warn('🔴 onMixerCycleComplete is deprecated - using loop restart listener instead');
    // No-op - kept for backwards compatibility
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

    // If we were in pre-countdown, armed, rehearsing, or counting in, just reset
    if (recordingState === 'preCountdown' || recordingState === 'armed' || recordingState === 'rehearsal' || recordingState === 'countingIn') {
      console.log(`⏹️ Recording cancelled (was ${recordingState})`);
      preCountdownCallbackRef.current = null; // Clear callback
      setRecordingStateSync('idle');
      return;
    }

    const mediaRecorder = mediaRecorderRef.current;
    const streamDestination = streamDestinationRef.current;
    const masterGain = getMasterGain();

    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      console.warn('⚠️ No active recording to stop');
      setRecordingStateSync('idle');
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

          console.log(`⏹️ Recording stopped: ${recordingDuration.toFixed(2)}s, ${blob.size} bytes, type: ${mediaRecorder.mimeType}`);

          // Decode audio for waveform and analysis
          // IMPORTANT: Use a fresh AudioContext at browser's default sample rate (usually 48000Hz)
          // MediaRecorder captures at the browser's default rate, NOT the mixer's rate (44100Hz)
          // Using the mixer's context would cause sample rate mismatch and 2x duration!
          const decodeContext = new AudioContext(); // Browser default, typically 48000Hz
          console.log(`🎵 Created decode AudioContext at ${decodeContext.sampleRate}Hz (browser default)`);

          const arrayBuffer = await blob.arrayBuffer();
          const audioBuffer = await decodeContext.decodeAudioData(arrayBuffer);

          // Close the temporary decode context - we don't need it after decoding
          decodeContext.close();

          console.log(`🎵 Decoded audio: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels} channels`);

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

          setRecordingStateSync('stopped');
          console.log(`✅ Recording processed: ${durationBars.toFixed(1)} bars at ${bpm} BPM`);

          resolve();
        } catch (err) {
          console.error('🚨 Error processing recording:', err);
          setError(err instanceof Error ? err.message : 'Failed to process recording');
          setRecordingStateSync('idle');
          resolve();
        }
      };

      mediaRecorder.stop();
    });
  }, [setRecordingStateSync]);

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

    setRecordingStateSync('idle');
    setRecordingData(null);
    setTrimState({ startBars: 0, endBars: 8, totalBars: 8 });
    setError(null);
  }, [setRecordingStateSync]);

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
    isRehearsal: recordingState === 'rehearsal',
    isPreCountdown: recordingState === 'preCountdown',
    countInBeat,
    error,
    startPreCountdown,
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
