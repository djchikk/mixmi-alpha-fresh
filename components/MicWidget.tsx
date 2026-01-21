"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Square, Download, X, Loader2, Play, Pause, Save, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMixer } from '@/contexts/MixerContext';

/**
 * MicWidget - Microphone Recording Widget
 *
 * Phase 1: Basic recording synced to mixer loop cycles
 * - Records vocals/audio from user's microphone
 * - Syncs recording start/stop to loop cycle boundaries
 * - Supports 1, 2, 4, 8 cycle counts
 * - Provides local download of recorded audio
 *
 * Phase 2: Draft content system
 * - Save recordings as drafts to Supabase
 * - Multi-take auto-bundling into draft loop packs
 * - Draft tracks appear in crate with dashed borders
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
  // Auth & Mixer Context
  const { walletAddress, suiAddress, isAuthenticated } = useAuth();
  const { addTrackToCollection } = useMixer();

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

  // Draft saving state
  const [isSaving, setIsSaving] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  const [currentPackId, setCurrentPackId] = useState<string | null>(null); // For multi-take bundling
  const [takeCount, setTakeCount] = useState(0); // Track how many takes in current session

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

  // Get effective wallet address (SUI for zkLogin, STX for wallet auth)
  const effectiveWallet = suiAddress || walletAddress;

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
    setSavedDraftId(null);
  };

  // Save recording as draft to Supabase
  const saveDraft = async () => {
    if (!recordedBlob || !effectiveWallet) {
      setError('No recording or not signed in');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Get BPM from mixer
      const bpm = typeof window !== 'undefined' && (window as any).getMixerBPM
        ? (window as any).getMixerBPM()
        : 120;

      // Prepare form data
      const formData = new FormData();
      formData.append('file', recordedBlob, `mic-recording-${Date.now()}.webm`);
      formData.append('walletAddress', effectiveWallet);
      formData.append('title', `Mic Recording ${takeCount + 1}`);
      formData.append('cycleCount', cycleCount.toString());
      formData.append('bpm', bpm.toString());

      // If we have a pack ID (from previous takes), include it for bundling
      if (currentPackId) {
        formData.append('packId', currentPackId);
      }

      console.log('🎤 Saving draft...', { bpm, cycleCount, hasPackId: !!currentPackId });

      const response = await fetch('/api/drafts/save', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save draft');
      }

      const result = await response.json();
      console.log('🎤 Draft saved:', result);

      // Store the pack ID for future multi-take bundling
      if (result.packId && !currentPackId) {
        setCurrentPackId(result.packId);
        console.log('🎤 Pack ID set for multi-take bundling:', result.packId);
      }

      // Increment take count
      setTakeCount(prev => prev + 1);

      // Store the saved draft ID
      setSavedDraftId(result.track.id);

      // Add to crate - convert API response to IPTrack format
      if (result.track) {
        const draftTrack = {
          id: result.track.id,
          title: result.track.title,
          artist: result.track.artist,
          content_type: result.track.content_type || 'loop',
          bpm: result.track.bpm,
          audio_url: result.track.audioUrl,
          is_draft: true,
          primary_uploader_wallet: result.track.primary_uploader_wallet,
          pack_id: result.track.pack_id,
          pack_position: result.track.pack_position,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sample_type: 'vocals',
          tags: [],
          composition_split_1_wallet: effectiveWallet,
          composition_split_1_percentage: 100,
          production_split_1_wallet: effectiveWallet,
          production_split_1_percentage: 100,
        };
        addTrackToCollection(draftTrack as any);
        console.log('🎤 Draft added to crate');
      }

    } catch (err: any) {
      console.error('🎤 Failed to save draft:', err);
      setError(err.message || 'Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  // Start a new pack (reset pack tracking for fresh session)
  const startNewPack = () => {
    setCurrentPackId(null);
    setTakeCount(0);
    resetRecording();
    console.log('🎤 Started new recording session (pack reset)');
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
            {/* Show take count when in multi-take session */}
            {takeCount > 0 && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                style={{
                  backgroundColor: 'rgba(160, 132, 249, 0.3)',
                  color: '#A084F9',
                  border: '1px dashed #A084F9'
                }}
              >
                Take {takeCount + 1}
              </span>
            )}
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
            <div className="flex flex-col gap-2 pt-2 border-t border-gray-800">
              {/* Preview button row */}
              <div className="flex justify-center gap-2">
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
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-white transition-all"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </button>
              </div>

              {/* Save Draft button - only for authenticated users */}
              {isAuthenticated && effectiveWallet && !savedDraftId && (
                <button
                  onClick={saveDraft}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: isSaving ? '#4B5563' : '#A084F9',
                    color: 'white',
                    border: '2px dashed rgba(255,255,255,0.3)'
                  }}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3 h-3" />
                      <span>Save as Draft{takeCount > 0 ? ` (Take ${takeCount + 1})` : ''}</span>
                    </>
                  )}
                </button>
              )}

              {/* Saved confirmation */}
              {savedDraftId && (
                <div className="text-center">
                  <div className="text-xs text-green-400 mb-2">
                    ✓ Draft saved{currentPackId ? ` (Take ${takeCount})` : ''}
                  </div>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={resetRecording}
                      className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-[#A084F9] hover:bg-[#A084F9]/80 text-white transition-all"
                    >
                      <Mic className="w-3 h-3" />
                      <span>Record Another Take</span>
                    </button>
                    {takeCount > 1 && (
                      <button
                        onClick={startNewPack}
                        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-white transition-all"
                      >
                        <span>New Session</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Not signed in message */}
              {!isAuthenticated && (
                <div className="text-xs text-gray-500 text-center">
                  Sign in to save drafts
                </div>
              )}
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
