"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Square, Download, X, Loader2, Play, Pause, Save, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMixer } from '@/contexts/MixerContext';
import { PrecisionRecorder, RecordingResult } from '@/lib/audio/PrecisionRecorder';

/**
 * MicWidget - Microphone Recording Widget
 *
 * Uses AudioWorklet-based PrecisionRecorder for sample-accurate recording
 * that syncs properly with mixer loops.
 *
 * Features:
 * - Sample-accurate recording via AudioWorklet (no MediaRecorder latency)
 * - Syncs recording start to loop cycle boundaries
 * - Records exactly 8 bars (1 cycle) per take
 * - Exact loop duration for perfect sync
 * - Save recordings as drafts to Supabase
 * - Multi-take bundling: record multiple takes to build a loop pack (max 5)
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
  const { walletAddress, suiAddress, isAuthenticated, activePersona } = useAuth();
  const { addTrackToCollection } = useMixer();

  // UI State
  const [isExpanded, setIsExpanded] = useState(false);
  const cycleCount = 1; // Fixed: 1 cycle = 8 bars per loop (loop pack constraint)

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

  // Precision Recorder instance
  const recorderRef = useRef<PrecisionRecorder | null>(null);

  // Timing refs for sync
  const targetCyclesRef = useRef(1);
  const recordingStateRef = useRef<RecordingState>('idle'); // Ref to track state for callback
  const currentBpmRef = useRef(120); // Store BPM when armed

  // Audio preview ref
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Get effective wallet address - prefer persona's wallet for proper attribution
  const effectiveWallet = activePersona?.wallet_address || activePersona?.sui_address || suiAddress || walletAddress;

  // Initialize recorder on mount
  useEffect(() => {
    recorderRef.current = new PrecisionRecorder();
    recorderRef.current.onStateChange = (state) => {
      console.log(`🎤 PrecisionRecorder state: ${state}`);
    };
    recorderRef.current.onError = (error) => {
      console.error('🎤 PrecisionRecorder error:', error);
      setError(error.message);
    };

    return () => {
      recorderRef.current?.cleanup();
    };
  }, []);

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
      (window as any).onMixerLoopRestart = (deckId: 'A' | 'B') => {
        const currentState = recordingStateRef.current;
        console.log(`🎤 MicWidget: Loop restart on Deck ${deckId}, state: ${currentState}`);

        if (currentState === 'armed') {
          console.log('🎤 MicWidget: Starting recording from armed state');
          startActualRecording();
        }
        // Note: With PrecisionRecorder, we don't track cycles manually
        // The recorder stops automatically when it reaches targetSamples
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
    };
  }, [recordedUrl]);

  // Arm the recording (wait for next loop restart)
  const armRecording = async () => {
    setError(null);

    // Clear any previous recording
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setRecordedBlob(null);

    // Initialize recorder if needed
    try {
      await recorderRef.current?.ensureReady();
      setHasMicPermission(true);
    } catch (err: any) {
      console.error('🎤 MicWidget: Failed to initialize recorder:', err);
      setHasMicPermission(false);
      if (err.name === 'NotAllowedError') {
        setError('Mic access denied. Click the lock icon in your address bar → Site settings → Microphone → Allow');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError('Could not access microphone. Please check your browser settings.');
      }
      return;
    }

    // Check if mixer is playing (via global function)
    if (typeof window !== 'undefined' && (window as any).isMixerPlaying) {
      const isPlaying = (window as any).isMixerPlaying();
      if (!isPlaying) {
        setError('Start the mixer first, then arm recording');
        return;
      }
    }

    // Get and store BPM now (while mixer is playing)
    const bpm = typeof window !== 'undefined' && (window as any).getMixerBPM
      ? (window as any).getMixerBPM()
      : 120;
    currentBpmRef.current = bpm;

    // Set up recording state
    targetCyclesRef.current = cycleCount;
    setCurrentCycle(0);

    // Transition to armed state
    setRecordingState('armed');
    console.log(`🎤 MicWidget: Armed for ${cycleCount} cycle(s) at ${bpm} BPM - Waiting for loop restart`);
  };

  // Actually start recording (called on loop restart)
  const startActualRecording = async () => {
    if (!recorderRef.current) {
      console.error('🎤 MicWidget: No recorder available');
      setRecordingState('idle');
      return;
    }

    try {
      setRecordingState('recording');
      setCurrentCycle(0);

      const bpm = currentBpmRef.current;
      const cycles = targetCyclesRef.current;

      console.log(`🎤 MicWidget: Starting precision recording - BPM: ${bpm}, Cycles: ${cycles}`);

      // Start recording - it will automatically stop at exact duration
      const result = await recorderRef.current.startRecording({
        bpm,
        bars: 8, // 8 bars per cycle
        cycles
      });

      // Recording complete
      console.log(`🎤 MicWidget: Recording complete!`);
      console.log(`🎤   Expected: ${result.expectedSamples} samples`);
      console.log(`🎤   Actual: ${result.actualSamples} samples`);
      console.log(`🎤   Duration: ${result.durationSeconds.toFixed(4)}s`);

      // Create URL for preview
      const url = URL.createObjectURL(result.wavBlob);
      setRecordedBlob(result.wavBlob);
      setRecordedUrl(url);
      setRecordingState('complete');

    } catch (err: any) {
      console.error('🎤 MicWidget: Recording failed:', err);
      setError(err.message || 'Recording failed');
      setRecordingState('idle');
    }
  };

  // Cancel recording/armed state
  const cancelRecording = () => {
    if (recordingState === 'recording') {
      recorderRef.current?.stopRecording();
    }
    setRecordingState('idle');
    setCurrentCycle(0);
    console.log('🎤 MicWidget: Recording cancelled');
  };

  // Download the recorded audio
  const downloadRecording = () => {
    if (!recordedBlob || !recordedUrl) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `mic-recording-${cycleCount}x-${timestamp}.wav`;

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

    // If this recording wasn't saved, reset the pack tracking too
    if (!savedDraftId) {
      setCurrentPackId(null);
      setTakeCount(0);
      console.log('🎤 Recording discarded - pack tracking reset');
    }
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
      const bpm = currentBpmRef.current;

      // Get username from active persona
      const username = activePersona?.username || activePersona?.display_name || null;

      // Prepare form data
      const formData = new FormData();
      formData.append('file', recordedBlob, `mic-recording-${Date.now()}.wav`);
      formData.append('walletAddress', effectiveWallet);
      formData.append('title', `Mic Recording ${takeCount + 1}`);
      formData.append('cycleCount', cycleCount.toString());
      formData.append('bpm', bpm.toString());

      // Include username for proper attribution
      if (username) {
        formData.append('username', username);
      }

      // If we have a pack ID (from previous takes), include it for bundling
      if (currentPackId) {
        formData.append('packId', currentPackId);
      }

      console.log('🎤 Saving draft...', { bpm, cycleCount, username, hasPackId: !!currentPackId });

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
        return 'Click Arm to start';
      case 'armed':
        return 'Waiting for loop...';
      case 'recording':
        return 'Recording 8 bars...';
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

          {/* Loop info - always 8 bars */}
          {(recordingState === 'idle' || recordingState === 'complete') && (
            <div className="flex items-center justify-center gap-1 mb-3">
              <span className="text-xs text-gray-400">Recording:</span>
              <span className="text-xs font-bold text-[#A084F9]">8 bars</span>
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
