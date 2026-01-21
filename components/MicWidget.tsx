"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Square, Download, X, Loader2, Play, Pause } from 'lucide-react';

/**
 * MicWidget - Microphone Recording Widget
 *
 * Phase 1: Basic recording synced to mixer loop cycles
 * - Records vocals/audio from user's microphone
 * - Syncs recording start/stop to loop cycle boundaries
 * - Supports 1, 2, 4, 8 cycle counts
 * - Provides local download of recorded audio
 *
 * Future phases:
 * - Draft content system integration
 * - Multi-take loop pack creation
 * - Dashboard integration
 */

interface MicWidgetProps {
  className?: string;
}

// Recording state machine
type RecordingState =
  | 'idle'           // Not recording, ready
  | 'armed'          // Waiting for next loop restart to begin
  | 'recording'      // Actively recording
  | 'processing'     // Processing recorded audio
  | 'complete';      // Recording complete, ready for download

export default function MicWidget({ className = '' }: MicWidgetProps) {
  // UI State
  const [isExpanded, setIsExpanded] = useState(false);
  const [cycleCount, setCycleCount] = useState(1); // 1, 2, 4, or 8 cycles

  // Recording State
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [currentCycle, setCurrentCycle] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Audio refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Timing refs for sync
  const cyclesRecordedRef = useRef(0);
  const targetCyclesRef = useRef(1);
  const isRecordingRef = useRef(false);
  const recordingStateRef = useRef<RecordingState>('idle'); // Ref to track state for callback

  // Audio preview ref
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Register global toggle function for Crate icon
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).toggleMicWidget = () => {
        setIsExpanded(prev => !prev);
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).toggleMicWidget;
      }
    };
  }, []);

  // Keep recordingStateRef in sync with state (for callback access)
  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  // Register global callback for loop restart sync
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Register callback that mixer can call on loop restart
      // Uses ref to always have current state without re-registering
      (window as any).onMixerLoopRestart = (deckId: 'A' | 'B') => {
        const currentState = recordingStateRef.current;
        console.log(`🎤 MicWidget: Loop restart on Deck ${deckId}, state: ${currentState}`);

        if (currentState === 'armed') {
          console.log('🎤 MicWidget: Starting recording from armed state');
          startActualRecording();
        } else if (currentState === 'recording' && isRecordingRef.current) {
          cyclesRecordedRef.current += 1;
          setCurrentCycle(cyclesRecordedRef.current);
          console.log(`🎤 MicWidget: Cycle ${cyclesRecordedRef.current}/${targetCyclesRef.current} completed`);

          if (cyclesRecordedRef.current >= targetCyclesRef.current) {
            console.log('🎤 MicWidget: Target cycles reached - Stopping recording');
            stopRecording();
          }
        }
      };

      console.log('🎤 MicWidget: Registered loop restart callback');
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).onMixerLoopRestart;
      }
    };
  }, []);

  // Cleanup recorded URL when component unmounts
  useEffect(() => {
    return () => {
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [recordedUrl]);

  // Request microphone access
  const requestMicAccess = async (): Promise<MediaStream | null> => {
    try {
      setError(null);
      console.log('🎤 MicWidget: Requesting mic access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      setHasMicPermission(true);
      streamRef.current = stream;
      console.log('🎤 MicWidget: Mic access granted');
      return stream;
    } catch (err: any) {
      console.error('🎤 MicWidget: Mic access denied:', err);
      setHasMicPermission(false);
      if (err.name === 'NotAllowedError') {
        setError('Mic access denied. Click the lock icon in your address bar → Site settings → Microphone → Allow');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError('Could not access microphone. Please check your browser settings.');
      }
      return null;
    }
  };

  // Arm the recording (wait for next loop restart)
  const armRecording = async () => {
    setError(null);

    // Clear any previous recording
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setRecordedBlob(null);

    // Get mic access if we don't have it - this will trigger the browser permission prompt
    if (!streamRef.current) {
      const stream = await requestMicAccess();
      if (!stream) return; // Permission denied or error
    }

    // Check if mixer is playing (via global function)
    if (typeof window !== 'undefined' && (window as any).isMixerPlaying) {
      const isPlaying = (window as any).isMixerPlaying();
      if (!isPlaying) {
        setError('Start the mixer first, then arm recording');
        return;
      }
    } else {
      // If we can't check, warn but allow
      console.log('🎤 MicWidget: Cannot check mixer state, proceeding anyway');
    }

    // Set up recording state
    targetCyclesRef.current = cycleCount;
    cyclesRecordedRef.current = 0;
    setCurrentCycle(0);

    // Transition to armed state
    setRecordingState('armed');
    console.log(`🎤 MicWidget: Armed for ${cycleCount} cycle(s) - Waiting for loop restart`);
  };

  // Actually start recording (called on loop restart)
  const startActualRecording = () => {
    if (!streamRef.current) {
      console.error('🎤 MicWidget: No stream available');
      setRecordingState('idle');
      return;
    }

    try {
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('🎤 MicWidget: MediaRecorder stopped, processing...');
        setRecordingState('processing');

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);

        setRecordedBlob(blob);
        setRecordedUrl(url);
        setRecordingState('complete');
        isRecordingRef.current = false;

        console.log(`🎤 MicWidget: Recording complete - ${(blob.size / 1024).toFixed(1)}KB`);
      };

      mediaRecorder.onerror = (event) => {
        console.error('🎤 MicWidget: MediaRecorder error:', event);
        setError('Recording failed. Please try again.');
        setRecordingState('idle');
        isRecordingRef.current = false;
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms

      isRecordingRef.current = true;
      setRecordingState('recording');
      setCurrentCycle(0);

      console.log('🎤 MicWidget: Recording started');
    } catch (err) {
      console.error('🎤 MicWidget: Failed to start recording:', err);
      setError('Failed to start recording. Please try again.');
      setRecordingState('idle');
    }
  };

  // Stop recording manually or when cycles complete
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    isRecordingRef.current = false;
  };

  // Cancel recording/armed state
  const cancelRecording = () => {
    if (recordingState === 'recording') {
      stopRecording();
    }
    setRecordingState('idle');
    setCurrentCycle(0);
    cyclesRecordedRef.current = 0;

    // Keep the stream alive for future recordings
    console.log('🎤 MicWidget: Recording cancelled');
  };

  // Download the recorded audio
  const downloadRecording = () => {
    if (!recordedBlob || !recordedUrl) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `mic-recording-${cycleCount}x-${timestamp}.webm`;

    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    console.log(`🎤 MicWidget: Downloaded ${filename}`);
  };

  // Preview playback
  const togglePreview = () => {
    if (!recordedUrl) return;

    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio(recordedUrl);
      previewAudioRef.current.onended = () => setIsPreviewPlaying(false);
    }

    if (isPreviewPlaying) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      setIsPreviewPlaying(false);
    } else {
      previewAudioRef.current.play();
      setIsPreviewPlaying(true);
    }
  };

  // Reset to record again
  const resetRecording = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingState('idle');
    setCurrentCycle(0);
    setIsPreviewPlaying(false);
    setError(null);
  };

  // Get status text for current state
  const getStatusText = () => {
    switch (recordingState) {
      case 'idle':
        return 'Select cycles and click Arm';
      case 'armed':
        return 'Waiting for loop...';
      case 'recording':
        return `Recording ${currentCycle}/${cycleCount}`;
      case 'processing':
        return 'Processing...';
      case 'complete':
        return 'Recording ready!';
      default:
        return '';
    }
  };

  // Don't render anything if not expanded
  if (!isExpanded) return null;

  return (
    <>
      {/* Mic Widget Panel - positioned above the crate on the right side */}
      <div
        className={`fixed bottom-[90px] right-5 z-[1001] ${className}`}
      >
        <div className="mic-widget-container">
          {/* Close Button */}
          <button
            onClick={() => setIsExpanded(false)}
            className="absolute top-2 right-2 p-1 hover:bg-gray-800 rounded transition-colors z-10"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <Mic className={`w-4 h-4 ${recordingState === 'recording' ? 'text-red-500' : 'text-[#81E4F2]'}`} />
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Mic Record
            </span>
          </div>

          {/* Status Display */}
          <div className="text-sm text-center mb-3">
            {recordingState === 'processing' ? (
              <div className="flex items-center justify-center gap-2 text-[#81E4F2]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{getStatusText()}</span>
              </div>
            ) : recordingState === 'recording' ? (
              <div className="flex items-center justify-center gap-2 text-red-400">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>{getStatusText()}</span>
              </div>
            ) : recordingState === 'armed' ? (
              <div className="flex items-center justify-center gap-2 text-[#81E4F2]">
                <div className="w-2 h-2 rounded-full bg-[#81E4F2] animate-pulse" />
                <span>{getStatusText()}</span>
              </div>
            ) : (
              <span className={recordingState === 'complete' ? 'text-green-400' : 'text-gray-400'}>
                {getStatusText()}
              </span>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="text-xs text-red-400 text-center mb-3 px-2 leading-tight">
              {error}
            </div>
          )}

          {/* Cycle Count Selector - only show when idle or complete */}
          {(recordingState === 'idle' || recordingState === 'complete') && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-xs text-gray-400">Cycles:</span>
              <div className="flex gap-1">
                {[1, 2, 4, 8].map((count) => (
                  <button
                    key={count}
                    onClick={() => setCycleCount(count)}
                    className={`w-7 h-6 text-xs font-bold rounded transition-all ${
                      cycleCount === count
                        ? 'bg-[#81E4F2] text-slate-900'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main Action Buttons */}
          <div className="flex justify-center gap-2 mb-2">
            {recordingState === 'idle' && (
              <button
                onClick={armRecording}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-[#81E4F2] hover:bg-[#81E4F2]/80 text-slate-900"
              >
                <Mic className="w-4 h-4" />
                <span>Arm</span>
              </button>
            )}

            {(recordingState === 'armed' || recordingState === 'recording') && (
              <button
                onClick={cancelRecording}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-red-500 hover:bg-red-600 text-white"
              >
                <Square className="w-4 h-4" fill="currentColor" />
                <span>Stop</span>
              </button>
            )}

            {recordingState === 'complete' && (
              <button
                onClick={resetRecording}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-slate-700 hover:bg-slate-600 text-white"
              >
                <Mic className="w-4 h-4" />
                <span>New</span>
              </button>
            )}
          </div>

          {/* Preview & Download - only show when complete */}
          {recordingState === 'complete' && recordedUrl && (
            <div className="flex justify-center gap-2 pt-2 border-t border-gray-800">
              <button
                onClick={togglePreview}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-white transition-all"
              >
                {isPreviewPlaying ? (
                  <>
                    <Pause className="w-3 h-3" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    <span>Preview</span>
                  </>
                )}
              </button>
              <button
                onClick={downloadRecording}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-green-600 hover:bg-green-500 text-white transition-all"
              >
                <Download className="w-3 h-3" />
                <span>Save</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Styles */}
      <style jsx>{`
        .mic-widget-container {
          position: relative;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(8px);
          border-radius: 0.75rem;
          width: 200px;
          padding: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(129, 228, 242, 0.3);
        }
      `}</style>
    </>
  );
}
