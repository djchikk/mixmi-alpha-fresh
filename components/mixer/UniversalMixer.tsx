"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDrop } from 'react-dnd';
import { Track } from '../types';
import { useMixerAudio } from '@/hooks/useMixerAudio';
import { applyCrossfader, SimpleLoopSync } from '@/lib/mixerAudio';
import SimplifiedDeckCompact from './compact/SimplifiedDeckCompact';
import WaveformDisplayCompact from './compact/WaveformDisplayCompact';
import CrossfaderControlCompact from './compact/CrossfaderControlCompact';
import MasterTransportControlsCompact from './compact/MasterTransportControlsCompact';
import LoopControlsCompact from './compact/LoopControlsCompact';
import SectionNavigator from './compact/SectionNavigator';
import VerticalVolumeSlider from './compact/VerticalVolumeSlider';
import DeckFXPanel from './compact/DeckFXPanel';
import { Music, Radio, ChevronDown, Volume2, VolumeX, Video, X } from 'lucide-react';
import { useMixer } from '@/contexts/MixerContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { IPTrack } from '@/types';
import { determineMasterBPM } from './utils/mixerBPMCalculator';
import { useMixerPackHandler } from './hooks/useMixerPackHandler';
import { useMixerRecording } from '@/hooks/useMixerRecording';
import RemixCompletionModal from './recording/RemixCompletionModal';

interface UniversalMixerProps {
  className?: string;
  // Optional video getters for video recording
  getVideoCanvas?: () => HTMLCanvasElement | null;
  getVideoElements?: () => { videoA: HTMLVideoElement | null; videoB: HTMLVideoElement | null };
}

// Simplified mixer state - just the essentials
interface UniversalMixerState {
  deckA: {
    track: Track | null;
    playing: boolean;
    audioState?: any;
    audioControls?: any;
    loading?: boolean;
    loopEnabled: boolean;
    loopLength: number;
    loopPosition: number;
    volume: number; // 0-100
    contentType?: string; // 'loop', 'song', 'radio_station', etc.
    fxPanelOpen: boolean; // FX panel visibility
    hiCutEnabled: boolean; // Hi Cut filter state
    loCutEnabled: boolean; // Lo Cut filter state
    pitchCents: number; // Pitch shift in cents (±1200)
    isPitchProcessing: boolean; // Pitch processing indicator
    videoMuted: boolean; // Video audio mute state
  };
  deckB: {
    track: Track | null;
    playing: boolean;
    audioState?: any;
    audioControls?: any;
    loading?: boolean;
    loopEnabled: boolean;
    loopLength: number;
    loopPosition: number;
    volume: number; // 0-100
    contentType?: string; // 'loop', 'song', 'radio_station', etc.
    fxPanelOpen: boolean; // FX panel visibility
    hiCutEnabled: boolean; // Hi Cut filter state
    loCutEnabled: boolean; // Lo Cut filter state
    pitchCents: number; // Pitch shift in cents (±1200)
    isPitchProcessing: boolean; // Pitch processing indicator
    videoMuted: boolean; // Video audio mute state
  };
  masterBPM: number;
  crossfaderPosition: number;
  syncActive: boolean;
  masterDeckId: 'A' | 'B'; // 🎯 NEW: Which deck is master for sync
  // 🎬 Video tracks - independent from audio decks
  videoATrack: Track | null;
  videoBTrack: Track | null;
  videoAVolume: number; // 0-100 (0 = muted)
  videoBVolume: number; // 0-100 (0 = muted)
}

// Video Thumbnail component with drop zone support
interface VideoThumbnailProps {
  track: Track | null;
  slot: 'A' | 'B';
  onDrop: (track: Track) => void;
  onClear: () => void;
  position: 'left' | 'right';
  onDragOver?: (isOver: boolean) => void;
}

function VideoThumbnail({ track, slot, onDrop, onClear, position, onDragOver }: VideoThumbnailProps) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ['CRATE_TRACK', 'COLLECTION_TRACK', 'TRACK_CARD', 'GLOBE_CARD'],
    drop: (item: { track: any }) => {
      if (item.track?.content_type === 'video_clip') {
        onDrop(item.track);
      }
    },
    canDrop: (item: { track: any }) => {
      return item.track?.content_type === 'video_clip';
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [onDrop]);

  const isDropTarget = isOver && canDrop;
  const isVideoDragging = canDrop; // Video is being dragged somewhere

  // Notify parent when video is being dragged (for container feedback)
  React.useEffect(() => {
    onDragOver?.(isVideoDragging);
  }, [isVideoDragging, onDragOver]);
  const positionClass = position === 'left' ? 'left-[14px]' : 'right-[14px]';

  return (
    <div
      className={`absolute ${positionClass} top-0 z-50 group/video p-3 -m-3`}
      ref={drop}
    >
      <div
        className={`w-[44px] h-[44px] rounded-lg border-2 overflow-hidden transition-all duration-200 relative ${
          isDropTarget
            ? 'border-[#5BB5F9] shadow-lg shadow-[#5BB5F9]/50 scale-110 bg-[#5BB5F9]/20'
            : isVideoDragging && !track
              ? 'border-[#5BB5F9] border-solid scale-105 shadow-md shadow-[#5BB5F9]/30'
              : track
                ? 'border-[#5BB5F9] shadow-md shadow-[#5BB5F9]/30'
                : 'border-dashed video-empty-pulse'
        } bg-slate-800/80`}
        title={track ? `Video ${slot} - Playing in Video Widget` : `Drop video here for Video ${slot}`}
      >
        {track ? (
          <div className="relative w-full h-full">
            <img
              src={(track as any)?.thumb_64_url || track?.cover_image_url || (track as any)?.imageUrl}
              alt={`Video ${slot}`}
              className="w-full h-full object-cover"
            />
            {/* Dark overlay on hover */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/video:opacity-100 transition-opacity pointer-events-none" />
            {/* Dismiss button - centered, appears on hover */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClear();
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20px] h-[20px] bg-black/80 rounded-full flex items-center justify-center opacity-0 group-hover/video:opacity-100 transition-all hover:bg-red-600 hover:scale-110 cursor-pointer"
              title={`Clear Video ${slot}`}
            >
              <X size={10} strokeWidth={3} className="text-white" />
            </button>
          </div>
        ) : (
          <div className={`w-full h-full flex flex-col items-center justify-center transition-all ${
            isDropTarget
              ? 'text-[#5BB5F9] scale-110'
              : isVideoDragging
                ? 'text-[#5BB5F9]/80'
                : 'video-empty-content'
          }`}>
            <Video size={isDropTarget ? 20 : isVideoDragging ? 18 : 16} strokeWidth={1.5} />
            <span className={`mt-0.5 uppercase tracking-wide ${
              isDropTarget ? 'text-[8px] font-bold' : isVideoDragging ? 'text-[7px] font-semibold' : 'text-[6px]'
            }`}>
              {isDropTarget ? 'Drop!' : 'Video'}
            </span>
          </div>
        )}

        {/* Glow overlay when dragging video over */}
        {isDropTarget && !track && (
          <div className="absolute inset-0 rounded-lg bg-[#5BB5F9]/20 animate-pulse pointer-events-none" />
        )}
      </div>
    </div>
  );
}

export default function UniversalMixer({ className = "", getVideoCanvas, getVideoElements }: UniversalMixerProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [syncWarningVisible, setSyncWarningVisible] = useState(false);
  const [isDeckDragOver, setIsDeckDragOver] = useState(false); // Track when dragging over either deck
  const [isVideoDragOver, setIsVideoDragOver] = useState(false); // Track when dragging video content

  // Initialize mixer state with volume controls
  const [mixerState, setMixerState] = useState<UniversalMixerState>({
    deckA: {
      track: null,
      playing: false,
      loopEnabled: true,
      loopLength: 8,
      loopPosition: 0,
      volume: 80, // Default 80%
      fxPanelOpen: false,
      hiCutEnabled: false,
      loCutEnabled: false,
      pitchCents: 0,
      isPitchProcessing: false,
      videoMuted: false // Default unmuted - video audio plays through deck
    },
    deckB: {
      track: null,
      playing: false,
      loopEnabled: true,
      loopLength: 8,
      loopPosition: 0,
      volume: 80, // Default 80%
      fxPanelOpen: false,
      hiCutEnabled: false,
      loCutEnabled: false,
      pitchCents: 0,
      isPitchProcessing: false,
      videoMuted: false // Default unmuted - video audio plays through deck
    },
    masterBPM: 120,
    crossfaderPosition: 50,
    syncActive: false,
    masterDeckId: 'A', // Default to Deck A as master
    // 🎬 Video tracks - independent from audio decks
    videoATrack: null,
    videoBTrack: null,
    videoAVolume: 100, // Full volume by default
    videoBVolume: 100  // Full volume by default
  });

  // Sync engine reference
  const syncEngineRef = React.useRef<SimpleLoopSync | null>(null);

  // Track if user manually disabled sync (to prevent auto-sync from re-enabling)
  const userDisabledSyncRef = React.useRef<boolean>(false);

  // 🔴 SYNC RESET: Ref-based function to reset sync before recording (avoids useCallback dependency issues)
  const resetSyncForRecordingRef = React.useRef<() => void>(() => {});

  // Audio recording buffers for GRAB feature
  const deckARecorderRef = React.useRef<MediaRecorder | null>(null);
  const deckBRecorderRef = React.useRef<MediaRecorder | null>(null);
  const deckAChunksRef = React.useRef<Blob[]>([]);
  const deckBChunksRef = React.useRef<Blob[]>([]);
  const deckAMimeTypeRef = React.useRef<string>('');
  const deckBMimeTypeRef = React.useRef<string>('');
  const deckARecordingStartTimeRef = React.useRef<number>(0);
  const deckBRecordingStartTimeRef = React.useRef<number>(0);
  const deckARestartTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const deckBRestartTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const deckADestinationRef = React.useRef<MediaStreamAudioDestinationNode | null>(null);
  const deckBDestinationRef = React.useRef<MediaStreamAudioDestinationNode | null>(null);

  // Track grabbing state for button feedback
  const [isGrabbingDeckA, setIsGrabbingDeckA] = React.useState(false);
  const [isGrabbingDeckB, setIsGrabbingDeckB] = React.useState(false);

  // Track radio play time to know when GRAB is ready (need 10+ seconds)
  const deckARadioStartTimeRef = React.useRef<number | null>(null);
  const deckBRadioStartTimeRef = React.useRef<number | null>(null);
  const [deckARadioPlayTime, setDeckARadioPlayTime] = React.useState(0);
  const [deckBRadioPlayTime, setDeckBRadioPlayTime] = React.useState(0);

  // Track if user just grabbed (to show feedback)
  const [deckAJustGrabbed, setDeckAJustGrabbed] = React.useState(false);
  const [deckBJustGrabbed, setDeckBJustGrabbed] = React.useState(false);

  // Use the mixer audio hook
  const {
    audioInitialized,
    crossfaderGainRef,
    initializeAudio,
    cleanupDeckAudio,
    loadAudioForDeck
  } = useMixerAudio();

  // Use mixer context for crate (collection) management and pending track loads
  const { addTrackToCollection, pendingTrackLoads, consumePendingLoads, loadedTracks } = useMixer();

  // Use toast for notifications
  const { showToast } = useToast();

  // Use pack handler for unpacking loop packs, EPs, and station packs
  const { handlePackDrop: handlePackDropFromHook } = useMixerPackHandler();

  // Count active tracks for recording cost calculation (audio + video)
  const activeTrackCount =
    (mixerState.deckA.track ? 1 : 0) +
    (mixerState.deckB.track ? 1 : 0) +
    (mixerState.videoATrack ? 1 : 0) +
    (mixerState.videoBTrack ? 1 : 0);

  // Use recording hook for capturing mixer output
  const {
    recordingState,
    recordingData,
    trimState,
    costInfo,
    isRecording: isMixerRecording,
    isArmed: isMixerArmed,
    isRehearsal: isMixerRehearsal,
    isPreCountdown: isMixerPreCountdown,
    countInBeat,
    error: recordingError,
    startPreCountdown,
    armRecording,
    startRecording: startMixerRecording,
    stopRecording: stopMixerRecording,
    onMixerCycleComplete, // Deprecated but kept for interface compatibility
    setTrimStart,
    setTrimEnd,
    nudgeTrim,
    resetRecording,
    getAudioForTrim,
    getVideoForTrim,
    hasVideo,
  } = useMixerRecording({
    trackCount: activeTrackCount,
    getVideoCanvas,
    getVideoElements,
  });

  // State for showing the recording widget modal
  const [showRecordingWidget, setShowRecordingWidget] = useState(false);

  // 🔴 RECORDING: Now uses loop restart callback (window.onMixerRecordingLoopRestart)
  // The rehearsal cycle approach:
  // 1. Press Record → armed state, playback starts
  // 2. Wait for loop restart (bar 1) → rehearsal state (sync stabilization)
  // 3. Wait for next loop restart → count-in starts
  // 4. After count-in → recording starts precisely on bar 1

  // 🎯 Determine which deck should be master for sync
  // Simply returns the user's choice (stored in state)
  const determineMasterDeck = (): 'A' | 'B' => {
    return mixerState.masterDeckId;
  };

  // Initialize audio on mount
  useEffect(() => {
    if (!audioInitialized) {
      initializeAudio();
    }
  }, []); // Empty dependency array - only run once on mount

  // Comprehensive cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      console.log('🧹 UniversalMixer: Cleaning up on unmount');

      // Clean up audio elements
      if (mixerState.deckA.audioState?.audio) {
        const audio = mixerState.deckA.audioState.audio;
        audio.pause();
        audio.src = '';
        audio.load();
      }
      if (mixerState.deckB.audioState?.audio) {
        const audio = mixerState.deckB.audioState.audio;
        audio.pause();
        audio.src = '';
        audio.load();
      }

      // Clean up deck audio connections
      cleanupDeckAudio('A');
      cleanupDeckAudio('B');

      // Clear restart timers
      if (deckARestartTimerRef.current) {
        clearTimeout(deckARestartTimerRef.current);
        deckARestartTimerRef.current = null;
      }
      if (deckBRestartTimerRef.current) {
        clearTimeout(deckBRestartTimerRef.current);
        deckBRestartTimerRef.current = null;
      }

      // Stop and cleanup MediaRecorders
      if (deckARecorderRef.current && deckARecorderRef.current.state !== 'inactive') {
        deckARecorderRef.current.stop();
        deckARecorderRef.current = null;
      }
      if (deckBRecorderRef.current && deckBRecorderRef.current.state !== 'inactive') {
        deckBRecorderRef.current.stop();
        deckBRecorderRef.current = null;
      }

      // Cleanup MediaStreamAudioDestinationNodes
      if (deckADestinationRef.current) {
        deckADestinationRef.current = null;
      }
      if (deckBDestinationRef.current) {
        deckBDestinationRef.current = null;
      }

      // Clear recording buffers
      deckAChunksRef.current = [];
      deckBChunksRef.current = [];

      // Stop sync engine
      if (syncEngineRef.current) {
        syncEngineRef.current.stop();
        syncEngineRef.current = null;
      }

      console.log('✅ UniversalMixer: Cleanup complete');
    };
  }, []); // Run only on unmount


  // 🎤 Expose mixer playing state for MicWidget sync
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).isMixerPlaying = () => {
        return mixerState.deckA.playing || mixerState.deckB.playing;
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).isMixerPlaying;
      }
    };
  }, [mixerState.deckA.playing, mixerState.deckB.playing]);

  // 🔴 SYNC RESET: Update the ref-based sync reset function whenever state changes
  // This allows handleRecordToggle to reset sync without being in its dependency array
  useEffect(() => {
    resetSyncForRecordingRef.current = () => {
      // Only reset if sync is active and both decks are loaded
      if (!mixerState.syncActive || !mixerState.deckA.track || !mixerState.deckB.track ||
          !mixerState.deckA.audioState || !mixerState.deckB.audioState) {
        console.log('🔴 Sync reset skipped - conditions not met');
        return;
      }

      console.log('🔴 Resetting sync engine before recording...');

      // Stop old sync engine
      if (syncEngineRef.current) {
        syncEngineRef.current.stop();
        syncEngineRef.current = null;
      }

      // Reset both decks to original BPM
      if (mixerState.deckA.audioControls) {
        const originalBPM = mixerState.deckA.track.bpm || 120;
        mixerState.deckA.audioControls.setBPM(originalBPM);
      }
      if (mixerState.deckB.audioControls) {
        const originalBPM = mixerState.deckB.track.bpm || 120;
        mixerState.deckB.audioControls.setBPM(originalBPM);
      }

      // Recreate sync engine with same master
      const audioContext = mixerState.deckA.audioState.audioContext;
      const masterDeck = mixerState.masterDeckId || 'A';

      syncEngineRef.current = new SimpleLoopSync(
        audioContext,
        { ...mixerState.deckA.audioState, audioControls: mixerState.deckA.audioControls, track: mixerState.deckA.track },
        { ...mixerState.deckB.audioState, audioControls: mixerState.deckB.audioControls, track: mixerState.deckB.track },
        masterDeck
      );

      syncEngineRef.current.enableSync();
      console.log('🔴 Sync engine reset complete');
    };
  }, [mixerState]);

  // 🎤 Expose mixer BPM for MicWidget draft saving
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).getMixerBPM = () => {
        // Priority: playing deck's BPM, then master BPM, then default 120
        if (mixerState.deckA.playing && mixerState.deckA.track?.bpm) {
          return mixerState.deckA.track.bpm;
        }
        if (mixerState.deckB.playing && mixerState.deckB.track?.bpm) {
          return mixerState.deckB.track.bpm;
        }
        return mixerState.masterBPM || 120;
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).getMixerBPM;
      }
    };
  }, [mixerState.deckA.playing, mixerState.deckA.track?.bpm, mixerState.deckB.playing, mixerState.deckB.track?.bpm, mixerState.masterBPM]);

  // Update volume when state changes
  useEffect(() => {
    if (mixerState.deckA.audioState?.audio) {
      mixerState.deckA.audioState.audio.volume = mixerState.deckA.volume / 100;
    }
  }, [mixerState.deckA.volume]);

  useEffect(() => {
    if (mixerState.deckB.audioState?.audio) {
      mixerState.deckB.audioState.audio.volume = mixerState.deckB.volume / 100;
    }
  }, [mixerState.deckB.volume]);

  // Update audio volume when videoMuted state changes (from Video Widget mute buttons)
  useEffect(() => {
    if (mixerState.deckA.audioState?.audio && mixerState.deckA.contentType === 'video_clip') {
      mixerState.deckA.audioState.audio.volume = mixerState.deckA.videoMuted ? 0 : (mixerState.deckA.volume / 100);
    }
  }, [mixerState.deckA.videoMuted, mixerState.deckA.volume, mixerState.deckA.audioState?.audio, mixerState.deckA.contentType]);

  useEffect(() => {
    if (mixerState.deckB.audioState?.audio && mixerState.deckB.contentType === 'video_clip') {
      mixerState.deckB.audioState.audio.volume = mixerState.deckB.videoMuted ? 0 : (mixerState.deckB.volume / 100);
    }
  }, [mixerState.deckB.videoMuted, mixerState.deckB.volume, mixerState.deckB.audioState?.audio, mixerState.deckB.contentType]);

  // Update current time for waveforms
  useEffect(() => {
    const updateCurrentTime = () => {
      setMixerState(prevState => {
        const newState = { ...prevState };

        // Update Deck A current time if playing
        if (newState.deckA.playing && newState.deckA.audioState?.audio) {
          newState.deckA.audioState.currentTime = newState.deckA.audioState.audio.currentTime;
        }

        // Update Deck B current time if playing
        if (newState.deckB.playing && newState.deckB.audioState?.audio) {
          newState.deckB.audioState.currentTime = newState.deckB.audioState.audio.currentTime;
        }

        return newState;
      });
    };

    const interval = setInterval(updateCurrentTime, 100);
    return () => clearInterval(interval);
  }, [mixerState.deckA.playing, mixerState.deckB.playing]);

  // Auto-dismiss sync warning after 3 seconds
  useEffect(() => {
    if (syncWarningVisible) {
      const timer = setTimeout(() => {
        setSyncWarningVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [syncWarningVisible]);

  // Track radio play time for GRAB button readiness
  useEffect(() => {
    const updateRadioPlayTime = () => {
      const now = Date.now();

      // Update Deck A radio play time
      if (mixerState.deckA.contentType === 'radio_station' && mixerState.deckA.playing) {
        if (deckARadioStartTimeRef.current === null) {
          deckARadioStartTimeRef.current = now;
        }
        const elapsed = (now - deckARadioStartTimeRef.current) / 1000; // seconds
        setDeckARadioPlayTime(elapsed);
      } else {
        deckARadioStartTimeRef.current = null;
        setDeckARadioPlayTime(0);
      }

      // Update Deck B radio play time
      if (mixerState.deckB.contentType === 'radio_station' && mixerState.deckB.playing) {
        if (deckBRadioStartTimeRef.current === null) {
          deckBRadioStartTimeRef.current = now;
        }
        const elapsed = (now - deckBRadioStartTimeRef.current) / 1000; // seconds
        setDeckBRadioPlayTime(elapsed);
      } else {
        deckBRadioStartTimeRef.current = null;
        setDeckBRadioPlayTime(0);
      }
    };

    const interval = setInterval(updateRadioPlayTime, 100);
    return () => clearInterval(interval);
  }, [mixerState.deckA.contentType, mixerState.deckA.playing, mixerState.deckB.contentType, mixerState.deckB.playing]);

  // 🎯 NEW: Watch for content type changes and recreate sync with correct master
  useEffect(() => {
    // Only act if sync is active and both decks have audio
    if (!mixerState.syncActive || !mixerState.deckA.audioState || !mixerState.deckB.audioState) {
      return;
    }

    // Determine who should be master based on user's choice
    const shouldBeMaster = determineMasterDeck();

    // If we already have a sync engine, check if master is correct
    if (syncEngineRef.current) {
      // We need to check if the sync engine's current master matches
      // Since we can't directly check, we'll recreate on any content type change
      // This is safe because content changes are relatively rare

      console.log(`🔄 Content changed while synced, recreating sync with Deck ${shouldBeMaster} as master`);

      // Stop and destroy old sync instance
      syncEngineRef.current.stop();
      syncEngineRef.current = null;

      // Create new sync instance with correct master
      const audioContext = mixerState.deckA.audioState.audioContext;
      syncEngineRef.current = new SimpleLoopSync(
        audioContext,
        { ...mixerState.deckA.audioState, audioControls: mixerState.deckA.audioControls, track: mixerState.deckA.track },
        { ...mixerState.deckB.audioState, audioControls: mixerState.deckB.audioControls, track: mixerState.deckB.track },
        shouldBeMaster
      );

      // Re-enable sync
      syncEngineRef.current.enableSync();
      console.log(`✅ Sync recreated with Deck ${shouldBeMaster} as master`);
    }
  }, [
    mixerState.deckA.contentType,
    mixerState.deckB.contentType,
    mixerState.syncActive
  ]);

  // 🎯 AUTO-SYNC: Automatically enable sync when both decks are loaded (not waiting for play)
  // But respect user's choice if they manually disabled sync
  useEffect(() => {
    const bothDecksLoaded = mixerState.deckA.track && mixerState.deckB.track;
    const bothDecksHaveAudio = mixerState.deckA.audioState && mixerState.deckB.audioState;
    const syncNotActive = !mixerState.syncActive;
    const neitherDeckIsRadio = mixerState.deckA.contentType !== 'radio_station' && mixerState.deckB.contentType !== 'radio_station';
    const userHasNotDisabledSync = !userDisabledSyncRef.current;

    // Enable sync as soon as both decks are loaded (before play)
    // This ensures they're already in sync when user hits play
    // BUT: Only if user hasn't manually disabled sync
    if (bothDecksLoaded && bothDecksHaveAudio && syncNotActive && neitherDeckIsRadio && userHasNotDisabledSync) {
      console.log('🎛️ AUTO-SYNC: Both decks loaded with audio, enabling sync before playback...');

      const audioA = mixerState.deckA.audioState?.audio;
      const audioB = mixerState.deckB.audioState?.audio;
      const audioContext = mixerState.deckA.audioState.audioContext;
      const masterDeckId = determineMasterDeck();

      // 🎯 FIX: Wait for both audio elements to be ready before syncing
      // readyState >= 2 means HAVE_CURRENT_DATA (enough data to play current frame)
      const waitForAudioReady = () => {
        return new Promise<void>((resolve) => {
          const checkReady = () => {
            const aReady = audioA && audioA.readyState >= 2;
            const bReady = audioB && audioB.readyState >= 2;
            console.log(`🎛️ AUTO-SYNC: Audio ready check - A: ${audioA?.readyState}, B: ${audioB?.readyState}`);
            if (aReady && bReady) {
              resolve();
            } else {
              // Check again in 50ms
              setTimeout(checkReady, 50);
            }
          };
          checkReady();
        });
      };

      let cancelled = false;

      const enableSync = async () => {
        // Wait for audio to be ready (with 2 second timeout)
        const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 2000));
        await Promise.race([waitForAudioReady(), timeoutPromise]);

        if (cancelled) return;

        console.log(`🎛️ AUTO-SYNC: Creating sync with Deck ${masterDeckId} as master`);

        // Reset both audio elements to position 0 before enabling sync
        if (audioA) audioA.currentTime = 0;
        if (audioB) audioB.currentTime = 0;

        // Small delay to let audio elements settle at position 0
        await new Promise(resolve => setTimeout(resolve, 100));

        if (cancelled) return;

        syncEngineRef.current = new SimpleLoopSync(
          audioContext,
          { ...mixerState.deckA.audioState, audioControls: mixerState.deckA.audioControls, track: mixerState.deckA.track },
          { ...mixerState.deckB.audioState, audioControls: mixerState.deckB.audioControls, track: mixerState.deckB.track },
          masterDeckId
        );

        syncEngineRef.current.enableSync().then(() => {
          console.log('✅ AUTO-SYNC: Sync enabled successfully - decks ready to play in sync');
        });

        setMixerState(prev => ({ ...prev, syncActive: true }));
      };

      enableSync();

      return () => { cancelled = true; };
    }
  }, [
    mixerState.deckA.track,
    mixerState.deckB.track,
    mixerState.deckA.audioState,
    mixerState.deckB.audioState,
    mixerState.deckA.contentType,
    mixerState.deckB.contentType,
    mixerState.syncActive,
    determineMasterDeck
  ]);

  // Volume change handlers
  const handleDeckAVolumeChange = (volume: number) => {
    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, volume }
    }));
  };

  const handleDeckBVolumeChange = (volume: number) => {
    setMixerState(prev => ({
      ...prev,
      deckB: { ...prev.deckB, volume }
    }));
  };

  // FX Panel handlers
  const handleDeckAFXToggle = () => {
    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, fxPanelOpen: !prev.deckA.fxPanelOpen }
    }));
  };

  const handleDeckBFXToggle = () => {
    setMixerState(prev => ({
      ...prev,
      deckB: { ...prev.deckB, fxPanelOpen: !prev.deckB.fxPanelOpen }
    }));
  };

  // Hi/Lo Cut filter handlers
  const handleDeckAHiCutToggle = () => {
    const newState = !mixerState.deckA.hiCutEnabled;
    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, hiCutEnabled: newState }
    }));
    // Apply to audio engine
    if (mixerState.deckA.audioControls?.setHiCut) {
      mixerState.deckA.audioControls.setHiCut(newState);
    }
  };

  const handleDeckALoCutToggle = () => {
    const newState = !mixerState.deckA.loCutEnabled;
    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, loCutEnabled: newState }
    }));
    // Apply to audio engine
    if (mixerState.deckA.audioControls?.setLoCut) {
      mixerState.deckA.audioControls.setLoCut(newState);
    }
  };

  const handleDeckBHiCutToggle = () => {
    const newState = !mixerState.deckB.hiCutEnabled;
    setMixerState(prev => ({
      ...prev,
      deckB: { ...prev.deckB, hiCutEnabled: newState }
    }));
    // Apply to audio engine
    if (mixerState.deckB.audioControls?.setHiCut) {
      mixerState.deckB.audioControls.setHiCut(newState);
    }
  };

  const handleDeckBLoCutToggle = () => {
    const newState = !mixerState.deckB.loCutEnabled;
    setMixerState(prev => ({
      ...prev,
      deckB: { ...prev.deckB, loCutEnabled: newState }
    }));
    // Apply to audio engine
    if (mixerState.deckB.audioControls?.setLoCut) {
      mixerState.deckB.audioControls.setLoCut(newState);
    }
  };

  // Pitch change handlers
  const handleDeckAPitchChange = (cents: number) => {
    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, pitchCents: cents }
    }));
  };

  const handleDeckBPitchChange = (cents: number) => {
    setMixerState(prev => ({
      ...prev,
      deckB: { ...prev.deckB, pitchCents: cents }
    }));
  };

  // Pitch apply handlers (will pre-process audio with rubberband)
  const handleDeckAApplyPitch = async () => {
    console.log(`🎵 Apply pitch shift for Deck A: ${mixerState.deckA.pitchCents} cents`);
    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, isPitchProcessing: true }
    }));

    // Apply pitch shift using rubberband-web
    try {
      await mixerState.deckA.audioControls?.applyPitchShift(mixerState.deckA.pitchCents);
      console.log('✅ Pitch shift applied successfully');
    } catch (error) {
      console.error('🚨 Pitch shift failed:', error);
      setMixerState(prev => ({
        ...prev,
        deckA: { ...prev.deckA, isPitchProcessing: false }
      }));
      return;
    }

    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, isPitchProcessing: false, pitchCents: 0 }
    }));

    showToast('Pitch processing not yet implemented', 'info');
  };

  const handleDeckBApplyPitch = async () => {
    console.log(`🎵 Apply pitch shift for Deck B: ${mixerState.deckB.pitchCents} cents`);
    setMixerState(prev => ({
      ...prev,
      deckB: { ...prev.deckB, isPitchProcessing: true }
    }));

    // Apply pitch shift using rubberband-web
    try {
      await mixerState.deckB.audioControls?.applyPitchShift(mixerState.deckB.pitchCents);
      console.log('✅ Pitch shift applied successfully');
    } catch (error) {
      console.error('🚨 Pitch shift failed:', error);
      setMixerState(prev => ({
        ...prev,
        deckB: { ...prev.deckB, isPitchProcessing: false }
      }));
      return;
    }

    setMixerState(prev => ({
      ...prev,
      deckB: { ...prev.deckB, isPitchProcessing: false, pitchCents: 0 }
    }));

    showToast('Pitch processing not yet implemented', 'info');
  };

  // Clear Deck A
  const clearDeckA = () => {
    console.log('🗑️ Clearing Deck A');

    // Properly cleanup audio to prevent memory leaks
    if (mixerState.deckA.audioState?.audio) {
      const audio = mixerState.deckA.audioState.audio;
      audio.pause();
      audio.currentTime = 0;
      audio.src = ''; // Release audio source
      audio.load(); // Force browser to release resources
    }

    // Clear restart timer if running
    if (deckARestartTimerRef.current) {
      clearTimeout(deckARestartTimerRef.current);
      deckARestartTimerRef.current = null;
    }

    // Clean up deck audio connections
    cleanupDeckAudio('A');

    setMixerState(prev => ({
      ...prev,
      deckA: {
        ...prev.deckA,
        track: null,
        playing: false,
        loading: false,
        audioState: undefined,
        audioControls: undefined
      }
    }));
  };

  // Clear Deck B
  const clearDeckB = () => {
    console.log('🗑️ Clearing Deck B');

    // Properly cleanup audio to prevent memory leaks
    if (mixerState.deckB.audioState?.audio) {
      const audio = mixerState.deckB.audioState.audio;
      audio.pause();
      audio.currentTime = 0;
      audio.src = ''; // Release audio source
      audio.load(); // Force browser to release resources
    }

    // Clear restart timer if running
    if (deckBRestartTimerRef.current) {
      clearTimeout(deckBRestartTimerRef.current);
      deckBRestartTimerRef.current = null;
    }

    // Clean up deck audio connections
    cleanupDeckAudio('B');

    setMixerState(prev => ({
      ...prev,
      deckB: {
        ...prev.deckB,
        track: null,
        playing: false,
        loading: false,
        audioState: undefined,
        audioControls: undefined
      }
    }));
  };

  // Load track to Deck A
  const loadTrackToDeckA = async (track: Track) => {
    console.log('🎵 UniversalMixer: Loading track to Deck A:', track);
    console.log('🔍 [DEBUG] Deck A track allow_downloads:', (track as any).allow_downloads, 'download_price_stx:', (track as any).download_price_stx);

    // Check if track is protected from remixing (sacred/devotional content)
    if ((track as any).remix_protected) {
      console.log('🔒 Track is protected from remixing, redirecting to playlist:', track.title);
      // Redirect to playlist instead of blocking
      if ((window as any).addTrackToPlaylist) {
        (window as any).addTrackToPlaylist(track);
        showToast('This track is protected from remixing - added to your playlist for listening', 'info');
      } else {
        showToast('This track is protected from remixing by the creator', 'info');
      }
      return;
    }

    // Detect content type
    const contentType = (track as any).content_type || 'loop';

    // 🎬 VIDEO ROUTING: Videos go to Video Widget, not deck
    if (contentType === 'video_clip') {
      console.log('🎬 Video clip detected - routing to Video Widget (Deck A slot)');
      setMixerState(prev => ({
        ...prev,
        videoATrack: track,
        videoAVolume: 100 // Full volume by default
      }));
      showToast('Video loaded to Video A', 'success', 2000);
      return; // Don't load to deck - videos are handled by Video Widget
    }

    if (mixerState.deckA.loading) {
      console.log('⚠️ Deck A already loading, skipping');
      return;
    }

    // Reset "just grabbed" state when loading new content
    setDeckAJustGrabbed(false);

    const isRadio = contentType === 'radio_station';

    console.log(`🎵 Content type: ${contentType}, isRadio: ${isRadio}`);

    // For radio stations, use stream_url; for others, use audioUrl
    let audioUrl;
    if (isRadio) {
      const rawStreamUrl = (track as any).stream_url || track.audioUrl || (track as any).audio_url;
      // Proxy radio streams through our API to avoid CORS issues
      audioUrl = `/api/radio-proxy?url=${encodeURIComponent(rawStreamUrl)}`;
      console.log('📻 Radio station detected, using proxied URL:', audioUrl);
      console.log('📻 Original stream URL:', rawStreamUrl);
    } else {
      audioUrl = track.audioUrl || (track as any).audio_url;
    }

    if (!audioUrl) {
      console.error(`❌ Track missing ${isRadio ? 'stream_url' : 'audioUrl'}:`, track);
      return;
    }

    track = { ...track, audioUrl };

    const syncWasActive = mixerState.syncActive;

    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, loading: true, playing: false },
      syncActive: false
    }));

    try {
      if (!audioInitialized) {
        await initializeAudio();
      }

      await cleanupDeckAudio(mixerState.deckA.audioControls, 'Deck A');

      // Clean up old recorder if replacing a radio station
      if (deckARecorderRef.current) {
        console.log('🧹 Cleaning up old Deck A recorder');
        try {
          if (deckARecorderRef.current.state === 'recording') {
            deckARecorderRef.current.stop();
          }
          deckARecorderRef.current = null;
        } catch (e) {
          console.warn('⚠️ Error stopping old recorder:', e);
        }
      }
      // Clear old chunks
      deckAChunksRef.current = [];
      deckAMimeTypeRef.current = '';
      // Clear restart timer
      if (deckARestartTimerRef.current) {
        clearTimeout(deckARestartTimerRef.current);
        deckARestartTimerRef.current = null;
      }
      // Disconnect old destination
      if (deckADestinationRef.current) {
        deckADestinationRef.current = null;
      }
      // Reset play time tracking
      deckARadioStartTimeRef.current = null;
      setDeckARadioPlayTime(0);

      if (syncWasActive && syncEngineRef.current) {
        syncEngineRef.current.disableSync();
        syncEngineRef.current = null;

        if (mixerState.deckB.audioState?.audio && mixerState.deckB.audioControls) {
          mixerState.deckB.audioState.audio.playbackRate = 1.0;
          mixerState.deckB.audioControls.setLoopPosition(0);
        }
      }

      const audioResult = await loadAudioForDeck(track, 'Deck A', contentType);

      if (audioResult) {
        const { audioState, audioControls, trackBPM } = audioResult;

        // Set initial volume
        if (audioState.audio) {
          audioState.audio.volume = mixerState.deckA.volume / 100;
        }

        const isGrabbedRadio = contentType === 'grabbed_radio';

        // For radio stations, disable looping; for loops/songs, apply loop settings
        if (audioControls) {
          if (isRadio) {
            audioControls.setLoopEnabled(false);
            console.log('📻 Radio station: looping disabled');
          } else {
            audioControls.setLoopEnabled(true);
            audioControls.setLoopLength(8); // Reset to default 8 bars for new content
            audioControls.setLoopPosition(0);
          }
        }

        // For grabbed radio, force playbackRate to 1.0 (no time-stretching)
        if (isGrabbedRadio && audioState.audio) {
          audioState.audio.playbackRate = 1.0;
          console.log('📻 Grabbed radio: playbackRate locked to 1.0 (no time-stretching)');
        }

        // Update state with new track
        setMixerState(prev => {
          const newDeckAState = {
            ...prev.deckA,
            track,
            playing: false,
            audioState,
            audioControls,
            loading: false,
            loopPosition: 0,
            loopLength: 8, // Reset loop length for new content (must match audioControls call above)
            contentType,
            loopEnabled: isRadio ? false : true  // Enable looping for non-radio content
          };

          // Determine master BPM based on both decks
          const newMasterBPM = determineMasterBPM(newDeckAState, prev.deckB, prev.masterDeckId);

          // 🎯 AUTO-SYNC: Determine master with audio priority
          // Priority: Audio (loop/song) > Video. If both are same type, first loaded = master
          let newMasterDeckId = prev.masterDeckId;
          if (!prev.deckB.track) {
            // Deck B is empty, make Deck A the master
            newMasterDeckId = 'A';
          } else {
            // Both decks have tracks - prioritize audio content
            const deckAIsAudio = contentType === 'loop' || contentType === 'full_song' || contentType === 'loop_pack' || contentType === 'ep';
            const deckBIsAudio = prev.deckB.contentType === 'loop' || prev.deckB.contentType === 'full_song' || prev.deckB.contentType === 'loop_pack' || prev.deckB.contentType === 'ep';

            if (deckAIsAudio && !deckBIsAudio) {
              // Deck A has audio, Deck B has video - make A master
              newMasterDeckId = 'A';
              console.log('🎵 Audio priority: Setting Deck A as sync master (audio over video)');
            } else if (!deckAIsAudio && deckBIsAudio) {
              // Deck A has video, Deck B has audio - make B master
              newMasterDeckId = 'B';
              console.log('🎵 Audio priority: Keeping Deck B as sync master (audio over video)');
            }
            // If both are same type (both audio or both video), keep existing master
          }

          return {
            ...prev,
            masterBPM: newMasterBPM,
            masterDeckId: newMasterDeckId,
            deckA: newDeckAState
          };
        });
      }
    } catch (error) {
      console.error('❌ Failed to load Deck A:', error);
      setMixerState(prev => ({
        ...prev,
        deckA: { ...prev.deckA, loading: false }
      }));
    }
  };

  // Load track to Deck B
  const loadTrackToDeckB = async (track: Track) => {
    console.log('🎵 UniversalMixer: Loading track to Deck B:', track);

    // Check if track is protected from remixing (sacred/devotional content)
    if ((track as any).remix_protected) {
      console.log('🔒 Track is protected from remixing, redirecting to playlist:', track.title);
      // Redirect to playlist instead of blocking
      if ((window as any).addTrackToPlaylist) {
        (window as any).addTrackToPlaylist(track);
        showToast('This track is protected from remixing - added to your playlist for listening', 'info');
      } else {
        showToast('This track is protected from remixing by the creator', 'info');
      }
      return;
    }

    // Detect content type
    const contentType = (track as any).content_type || 'loop';

    // 🎬 VIDEO ROUTING: Videos go to Video Widget, not deck
    if (contentType === 'video_clip') {
      console.log('🎬 Video clip detected - routing to Video Widget (Deck B slot)');
      setMixerState(prev => ({
        ...prev,
        videoBTrack: track,
        videoBVolume: 100 // Full volume by default
      }));
      showToast('Video loaded to Video B', 'success', 2000);
      return; // Don't load to deck - videos are handled by Video Widget
    }

    if (mixerState.deckB.loading) {
      console.log('⚠️ Deck B already loading, skipping');
      return;
    }

    // Reset "just grabbed" state when loading new content
    setDeckBJustGrabbed(false);

    const isRadio = contentType === 'radio_station';

    console.log(`🎵 Content type: ${contentType}, isRadio: ${isRadio}`);

    // For radio stations, use stream_url; for others, use audioUrl
    let audioUrl;
    if (isRadio) {
      const rawStreamUrl = (track as any).stream_url || track.audioUrl || (track as any).audio_url;
      // Proxy radio streams through our API to avoid CORS issues
      audioUrl = `/api/radio-proxy?url=${encodeURIComponent(rawStreamUrl)}`;
      console.log('📻 Radio station detected, using proxied URL:', audioUrl);
      console.log('📻 Original stream URL:', rawStreamUrl);
    } else {
      audioUrl = track.audioUrl || (track as any).audio_url;
    }

    if (!audioUrl) {
      console.error(`❌ Track missing ${isRadio ? 'stream_url' : 'audioUrl'}:`, track);
      return;
    }

    track = { ...track, audioUrl };

    const syncWasActive = mixerState.syncActive;

    setMixerState(prev => ({
      ...prev,
      deckB: { ...prev.deckB, loading: true, playing: false },
      syncActive: false
    }));

    try {
      if (!audioInitialized) {
        await initializeAudio();
      }

      await cleanupDeckAudio(mixerState.deckB.audioControls, 'Deck B');

      // Clean up old recorder if replacing a radio station
      if (deckBRecorderRef.current) {
        console.log('🧹 Cleaning up old Deck B recorder');
        try {
          if (deckBRecorderRef.current.state === 'recording') {
            deckBRecorderRef.current.stop();
          }
          deckBRecorderRef.current = null;
        } catch (e) {
          console.warn('⚠️ Error stopping old recorder:', e);
        }
      }
      // Clear old chunks
      deckBChunksRef.current = [];
      deckBMimeTypeRef.current = '';
      // Clear restart timer
      if (deckBRestartTimerRef.current) {
        clearTimeout(deckBRestartTimerRef.current);
        deckBRestartTimerRef.current = null;
      }
      // Disconnect old destination
      if (deckBDestinationRef.current) {
        deckBDestinationRef.current = null;
      }
      // Reset play time tracking
      deckBRadioStartTimeRef.current = null;
      setDeckBRadioPlayTime(0);

      if (syncWasActive && syncEngineRef.current) {
        syncEngineRef.current.disableSync();
        syncEngineRef.current = null;

        if (mixerState.deckA.audioState?.audio && mixerState.deckA.audioControls) {
          mixerState.deckA.audioState.audio.playbackRate = 1.0;
          mixerState.deckA.audioControls.setLoopPosition(0);
        }
      }

      const audioResult = await loadAudioForDeck(track, 'Deck B', contentType);

      if (audioResult) {
        const { audioState, audioControls } = audioResult;

        // Set initial volume
        if (audioState.audio) {
          audioState.audio.volume = mixerState.deckB.volume / 100;
        }

        const isGrabbedRadio = contentType === 'grabbed_radio';

        // For radio stations, disable looping; for loops/songs, apply loop settings
        if (audioControls) {
          if (isRadio) {
            audioControls.setLoopEnabled(false);
            console.log('📻 Radio station: looping disabled');
          } else {
            audioControls.setLoopEnabled(true);
            audioControls.setLoopLength(8); // Reset to default 8 bars for new content
            audioControls.setLoopPosition(0);
          }
        }

        // For grabbed radio, force playbackRate to 1.0 (no time-stretching)
        if (isGrabbedRadio && audioState.audio) {
          audioState.audio.playbackRate = 1.0;
          console.log('📻 Grabbed radio: playbackRate locked to 1.0 (no time-stretching)');
        }

        // Update state with new track
        setMixerState(prev => {
          const newDeckBState = {
            ...prev.deckB,
            track,
            playing: false,
            audioState,
            audioControls,
            loading: false,
            loopPosition: 0,
            loopLength: 8, // Reset to default 8 bars for new content
            contentType,
            loopEnabled: isRadio ? false : true  // Enable looping for non-radio content
          };

          // Determine master BPM based on both decks
          const newMasterBPM = determineMasterBPM(prev.deckA, newDeckBState, prev.masterDeckId);

          // 🎯 AUTO-SYNC: Determine master with audio priority
          // Priority: Audio (loop/song) > Video. If both are same type, first loaded = master
          let newMasterDeckId = prev.masterDeckId;
          if (!prev.deckA.track) {
            // Deck A is empty, make Deck B the master
            newMasterDeckId = 'B';
          } else {
            // Both decks have tracks - prioritize audio content
            const deckAIsAudio = prev.deckA.contentType === 'loop' || prev.deckA.contentType === 'full_song' || prev.deckA.contentType === 'loop_pack' || prev.deckA.contentType === 'ep';
            const deckBIsAudio = contentType === 'loop' || contentType === 'full_song' || contentType === 'loop_pack' || contentType === 'ep';

            if (deckBIsAudio && !deckAIsAudio) {
              // Deck B has audio, Deck A has video - make B master
              newMasterDeckId = 'B';
              console.log('🎵 Audio priority: Setting Deck B as sync master (audio over video)');
            } else if (!deckBIsAudio && deckAIsAudio) {
              // Deck B has video, Deck A has audio - make A master
              newMasterDeckId = 'A';
              console.log('🎵 Audio priority: Keeping Deck A as sync master (audio over video)');
            }
            // If both are same type (both audio or both video), keep existing master
          }

          return {
            ...prev,
            masterBPM: newMasterBPM,
            masterDeckId: newMasterDeckId,
            deckB: newDeckBState
          };
        });
      }
    } catch (error) {
      console.error('❌ Failed to load Deck B:', error);
      setMixerState(prev => ({
        ...prev,
        deckB: { ...prev.deckB, loading: false }
      }));
    }
  };

  // Handle pack drop - add pack to crate and auto-expand, load first item to deck
  // Wrapper for pack drop handler that provides load functions
  const handlePackDrop = async (packTrack: any, deck: 'A' | 'B') => {
    await handlePackDropFromHook(packTrack, deck, loadTrackToDeckA, loadTrackToDeckB);
  };

  // Process pending track loads from MixerContext (used by demo button and external load requests)
  useEffect(() => {
    if (pendingTrackLoads.length > 0) {
      const loads = consumePendingLoads();
      console.log('🎯 UniversalMixer: Processing pending track loads:', loads.length);

      loads.forEach(async (load) => {
        if (load.deck === 'A') {
          await loadTrackToDeckA(load.track);
        } else {
          await loadTrackToDeckB(load.track);
        }
      });
    }
  }, [pendingTrackLoads, consumePendingLoads]);

  // Play/pause handlers
  const handleDeckAPlayPause = useCallback(async () => {
    const { audioControls, playing } = mixerState.deckA;

    if (!audioControls) return;

    try {
      if (playing) {
        audioControls.pause();
        setMixerState(prev => ({
          ...prev,
          deckA: { ...prev.deckA, playing: false }
        }));
      } else {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('audioSourcePlaying', { detail: { source: 'mixer' } }));
        }
        await audioControls.play();
        setMixerState(prev => ({
          ...prev,
          deckA: { ...prev.deckA, playing: true }
        }));
      }
    } catch (error) {
      console.error('Failed to control Deck A:', error);
    }
  }, [mixerState.deckA]);

  const handleDeckBPlayPause = useCallback(async () => {
    const { audioControls, playing } = mixerState.deckB;

    if (!audioControls) return;

    try {
      if (playing) {
        audioControls.pause();
        setMixerState(prev => ({
          ...prev,
          deckB: { ...prev.deckB, playing: false }
        }));
      } else {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('audioSourcePlaying', { detail: { source: 'mixer' } }));
        }
        await audioControls.play();
        setMixerState(prev => ({
          ...prev,
          deckB: { ...prev.deckB, playing: true }
        }));
      }
    } catch (error) {
      console.error('Failed to control Deck B:', error);
    }
  }, [mixerState.deckB]);

  // Master transport handlers
  const handleMasterPlay = () => {
    console.log('Master play triggered');
  };

  const handleMasterPlayAfterCountIn = useCallback(async () => {
    const deckACanPlay = mixerState.deckA.audioControls && mixerState.deckA.track;
    const deckBCanPlay = mixerState.deckB.audioControls && mixerState.deckB.track;

    if (deckACanPlay && !mixerState.deckA.playing) {
      await handleDeckAPlayPause();
    }

    if (deckBCanPlay && !mixerState.deckB.playing) {
      await handleDeckBPlayPause();
    }
  }, [mixerState, handleDeckAPlayPause, handleDeckBPlayPause]);

  const handleMasterStop = useCallback(() => {
    if (mixerState.deckA.playing && mixerState.deckA.audioControls) {
      mixerState.deckA.audioControls.pause();
    }

    if (mixerState.deckB.playing && mixerState.deckB.audioControls) {
      mixerState.deckB.audioControls.pause();
    }

    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, playing: false },
      deckB: { ...prev.deckB, playing: false }
    }));
  }, [mixerState]);

  const handleMasterSyncReset = () => {
    if (mixerState.deckA.audioControls) {
      mixerState.deckA.audioControls.stop();
    }
    if (mixerState.deckB.audioControls) {
      mixerState.deckB.audioControls.stop();
    }

    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, playing: false },
      deckB: { ...prev.deckB, playing: false }
    }));
  };

  // 🔴 RECORDING: Toggle recording on/off
  const handleRecordToggle = useCallback(async () => {
    if (isMixerRecording || isMixerArmed || isMixerRehearsal || isMixerPreCountdown || recordingState === 'countingIn') {
      // Stop recording (or cancel armed/rehearsal/pre-countdown state)
      // IMPORTANT: Capture state BEFORE calling stopMixerRecording to avoid stale closure issue
      const wasActuallyRecording = recordingState === 'recording';
      console.log('⏹️ Stopping recording...', { wasActuallyRecording, recordingState });
      await stopMixerRecording();

      // Stop the mixer playback
      handleMasterStop();

      // Show widget if we actually recorded something
      if (wasActuallyRecording) {
        // Show the recording widget modal
        setShowRecordingWidget(true);
      }
    } else {
      // Start pre-countdown (4-3-2-1), then arm and start playback
      if (!mixerState.deckA.track && !mixerState.deckB.track) {
        showToast('Load at least one track to record', 'info');
        return;
      }
      // 🔴 SYNC FIX: Reset sync engine before recording (uses ref to avoid dependency issues)
      resetSyncForRecordingRef.current();

      // Use master BPM
      const bpm = mixerState.masterBPM || 120;
      console.log(`🔴 Starting pre-countdown at ${bpm} BPM...`);

      // Start the 4-3-2-1 countdown, then arm and start playback
      startPreCountdown(bpm, () => {
        console.log(`🔴 Pre-countdown complete! Arming at ${bpm} BPM...`);
        armRecording(bpm);

        // Auto-start playback after arming
        console.log('🔴 Auto-starting playback for recording...');
        handleMasterPlayAfterCountIn();
      });
    }
  }, [isMixerRecording, isMixerArmed, isMixerRehearsal, isMixerPreCountdown, recordingState, stopMixerRecording, startPreCountdown, armRecording, handleMasterStop, handleMasterPlayAfterCountIn, mixerState.deckA.track, mixerState.deckB.track, mixerState.masterBPM, showToast]);

  // 🔴 RECORDING: Handle confirm and payment
  const handleRecordingConfirm = useCallback(async () => {
    if (!recordingData || !costInfo) return;

    try {
      // Get the trimmed audio
      const audioBlob = await getAudioForTrim();
      if (!audioBlob) {
        throw new Error('Failed to create trimmed audio');
      }

      // TODO: Call payment API to process payment and save draft
      // For now, just show success message
      showToast(`Recording saved! Cost: $${costInfo.totalCost.toFixed(2)} USDC`, 'success');

      // Close the widget and reset
      setShowRecordingWidget(false);
      resetRecording();
    } catch (error) {
      console.error('Failed to confirm recording:', error);
      showToast('Failed to save recording', 'error');
    }
  }, [recordingData, costInfo, getAudioForTrim, showToast, resetRecording]);

  // 🔴 RECORDING: Handle close/cancel
  const handleRecordingClose = useCallback(() => {
    setShowRecordingWidget(false);
    resetRecording();
  }, [resetRecording]);

  // 🎯 NEW: Master sync toggle (enable/disable from master transport)
  const handleSyncToggle = useCallback(async () => {
    console.log(`🎛️ SYNC TOGGLE clicked. Current state: ${mixerState.syncActive ? 'ON' : 'OFF'}`);

    if (!mixerState.syncActive) {
      // Enable sync with current masterDeckId (defaults to 'A')
      if (!mixerState.deckA.audioState || !mixerState.deckB.audioState) {
        console.warn('Both decks must have audio loaded to sync');
        return;
      }

      const masterDeck = mixerState.masterDeckId || 'A';
      console.log(`🎛️ Enabling sync with Deck ${masterDeck} as master`);
      const audioContext = mixerState.deckA.audioState.audioContext;

      syncEngineRef.current = new SimpleLoopSync(
        audioContext,
        { ...mixerState.deckA.audioState, audioControls: mixerState.deckA.audioControls, track: mixerState.deckA.track },
        { ...mixerState.deckB.audioState, audioControls: mixerState.deckB.audioControls, track: mixerState.deckB.track },
        masterDeck
      );

      await syncEngineRef.current.enableSync();
      setMixerState(prev => ({ ...prev, syncActive: true, masterDeckId: masterDeck }));

      // Clear the user-disabled flag since they manually enabled it
      userDisabledSyncRef.current = false;
      console.log('✅ Sync enabled (user manually enabled)');
    } else {
      // Disable sync
      console.log('🎛️ Disabling sync...');

      if (syncEngineRef.current) {
        console.log('🎛️ Calling disableSync() on sync engine');
        syncEngineRef.current.disableSync();
        syncEngineRef.current = null;
      }

      // Mark that user manually disabled sync (prevent auto-sync from re-enabling)
      userDisabledSyncRef.current = true;

      console.log('🎛️ Setting syncActive to false');
      setMixerState(prev => {
        console.log('🎛️ State update: syncActive was', prev.syncActive);
        return { ...prev, syncActive: false };
      });
      console.log('✅ Sync disabled (user manually disabled - will not auto-enable until content changes)');
    }
  }, [mixerState]);

  // 🎯 NEW: Per-deck master selector (only switches master when sync is active)
  const handleDeckSync = useCallback(async (deckId: 'A' | 'B') => {
    // Only allow switching master if sync is already active
    if (!mixerState.syncActive) {
      console.log('⚠️ Sync is not active. Use master SYNC button to enable.');
      return;
    }

    // If clicking the current master, do nothing (can't disable from here)
    if (mixerState.masterDeckId === deckId) {
      console.log(`🎛️ Deck ${deckId} is already master`);
      return;
    }

    // Switch master
    console.log(`🎛️ Switching master from Deck ${mixerState.masterDeckId} to Deck ${deckId}`);

    // Stop playback first
    if (mixerState.deckA.playing || mixerState.deckB.playing) {
      console.warn('⚠️ Stop playback before switching master');
      setSyncWarningVisible(true);
      return;
    }

    // Stop old sync
    if (syncEngineRef.current) {
      syncEngineRef.current.stop();
      syncEngineRef.current = null;
    }

    // Reset both decks to original BPM
    if (mixerState.deckA.track && mixerState.deckA.audioControls) {
      const originalBPM = mixerState.deckA.track.bpm || 120;
      mixerState.deckA.audioControls.setBPM(originalBPM);
    }
    if (mixerState.deckB.track && mixerState.deckB.audioControls) {
      const originalBPM = mixerState.deckB.track.bpm || 120;
      mixerState.deckB.audioControls.setBPM(originalBPM);
    }

    // Capture audio state for new sync
    const deckAState = mixerState.deckA.audioState;
    const deckBState = mixerState.deckB.audioState;
    const deckAControls = mixerState.deckA.audioControls;
    const deckBControls = mixerState.deckB.audioControls;
    const deckATrack = mixerState.deckA.track;
    const deckBTrack = mixerState.deckB.track;

    // Update state immediately
    setMixerState(prev => {
      const newState = { ...prev, masterDeckId: deckId };
      newState.masterBPM = determineMasterBPM(prev.deckA, prev.deckB, deckId);
      return newState;
    });

    // Wait for smooth transition (850ms)
    setTimeout(() => {
      if (!deckAState || !deckBState) {
        console.warn('⚠️ Audio state missing, cannot recreate sync');
        return;
      }

      const audioContext = deckAState.audioContext;
      syncEngineRef.current = new SimpleLoopSync(
        audioContext,
        { ...deckAState, audioControls: deckAControls, track: deckATrack },
        { ...deckBState, audioControls: deckBControls, track: deckBTrack },
        deckId
      );

      syncEngineRef.current.enableSync();
      console.log(`✅ Sync recreated with Deck ${deckId} as master`);
    }, 850);
  }, [mixerState]);

  // Crossfader handler
  const handleCrossfaderChange = useCallback((position: number) => {
    const { deckA, deckB } = crossfaderGainRef.current;
    if (deckA && deckB) {
      const normalizedPosition = position / 100;
      applyCrossfader(deckA, deckB, normalizedPosition);
    }

    setMixerState(prev => ({ ...prev, crossfaderPosition: position }));
  }, []);

  // Loop control handlers
  const handleLoopToggle = (deck: 'A' | 'B') => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';
    const newLoopEnabled = !mixerState[deckKey].loopEnabled;

    setMixerState(prev => ({
      ...prev,
      [deckKey]: {
        ...prev[deckKey],
        loopEnabled: newLoopEnabled
      }
    }));

    const audioControls = mixerState[deckKey].audioControls;
    if (audioControls && audioControls.setLoopEnabled) {
      audioControls.setLoopEnabled(newLoopEnabled);
    }
  };

  const handleLoopLengthChange = (deck: 'A' | 'B', length: number) => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';

    const audioControls = mixerState[deckKey].audioControls;
    if (audioControls && audioControls.setLoopLength) {
      audioControls.setLoopLength(length);
    }

    setMixerState(prev => ({
      ...prev,
      [deckKey]: {
        ...prev[deckKey],
        loopLength: length
      }
    }));
  };

  const handleLoopPositionChange = (deck: 'A' | 'B', position: number) => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';

    setMixerState(prev => ({
      ...prev,
      [deckKey]: {
        ...prev[deckKey],
        loopPosition: position
      }
    }));

    const audioControls = mixerState[deckKey].audioControls;
    if (audioControls && audioControls.setLoopPosition) {
      audioControls.setLoopPosition(position);
    }
  };

  // Start recording radio stream (for GRAB feature)
  const startRecording = (deck: 'A' | 'B') => {
    const deckState = deck === 'A' ? mixerState.deckA : mixerState.deckB;

    if (!deckState.audioState?.gainNode || deckState.contentType !== 'radio_station') {
      return;
    }

    try {
      // Clear any existing restart timer
      const restartTimerRef = deck === 'A' ? deckARestartTimerRef : deckBRestartTimerRef;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }

      // Tap into existing audio graph - connect from gain node to MediaStreamDestination
      const audioContext = deckState.audioState.audioContext;

      // Reuse existing destination if available, otherwise create new one
      let dest = deck === 'A' ? deckADestinationRef.current : deckBDestinationRef.current;
      if (!dest) {
        dest = audioContext.createMediaStreamDestination();
        // Store destination reference for cleanup
        if (deck === 'A') {
          deckADestinationRef.current = dest;
        } else {
          deckBDestinationRef.current = dest;
        }
        // Connect the existing gain node to our destination (audio is already flowing through gainNode)
        deckState.audioState.gainNode.connect(dest);
      }

      // Try to find a supported MIME type for better compatibility
      let mimeType = '';
      const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ];

      for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      const recorder = mimeType
        ? new MediaRecorder(dest.stream, { mimeType })
        : new MediaRecorder(dest.stream);

      // Store the MIME type and recorder reference
      if (deck === 'A') {
        deckAMimeTypeRef.current = recorder.mimeType;
        deckARecorderRef.current = recorder;
        deckAChunksRef.current = []; // Clear previous chunks
        deckARecordingStartTimeRef.current = Date.now();
      } else {
        deckBMimeTypeRef.current = recorder.mimeType;
        deckBRecorderRef.current = recorder;
        deckBChunksRef.current = []; // Clear previous chunks
        deckBRecordingStartTimeRef.current = Date.now();
      }

      const chunks = deck === 'A' ? deckAChunksRef : deckBChunksRef;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.current.push(e.data);
          // Log first chunk to verify recording
          if (chunks.current.length === 1) {
            console.log(`🎙️ First chunk recorded for Deck ${deck}: ${e.data.size} bytes`);
          }
        }
      };

      // CRITICAL FIX: Record continuously without timeslice
      // This ensures we get a complete WebM file with proper initialization segment
      recorder.start();

      console.log(`🎙️ Started recording Deck ${deck} for GRAB feature`);

      // 🔄 ROLLING BUFFER: Restart recording every 20 seconds to keep buffer fresh
      // This prevents accumulating old silence and keeps grabbed audio recent
      const BUFFER_DURATION = 20000; // 20 seconds - enough for 8 bars at any reasonable BPM
      restartTimerRef.current = setTimeout(() => {
        console.log(`🔄 Rolling buffer: Restarting Deck ${deck} recording after 20s`);
        // Stop current recorder
        if (recorder.state === 'recording') {
          recorder.stop();
        }
        // Start a fresh recording session (will have new initialization segment)
        setTimeout(() => startRecording(deck), 100);
      }, BUFFER_DURATION);

    } catch (error) {
      console.error(`❌ Failed to start recording ${deck}:`, error);
    }
  };

  // Handle PLAY button click for radio (starts playback)
  const handleRadioPlay = async (deck: 'A' | 'B') => {
    console.log(`▶️ Starting radio playback for Deck ${deck}`);

    // Start playback
    if (deck === 'A') {
      handleDeckAPlayPause();
    } else {
      handleDeckBPlayPause();
    }
  };

  // GRAB the last ~8 bars from radio stream
  const handleGrab = async (deck: 'A' | 'B') => {
    console.log(`🎯 GRAB triggered for Deck ${deck}!`);

    // Set grabbing state for visual feedback
    if (deck === 'A') {
      setIsGrabbingDeckA(true);
    } else {
      setIsGrabbingDeckB(true);
    }

    try {
      const recorder = deck === 'A' ? deckARecorderRef.current : deckBRecorderRef.current;
      const chunks = deck === 'A' ? deckAChunksRef.current : deckBChunksRef.current;

      if (!recorder || recorder.state === 'inactive') {
        console.log('⚠️ No active recording, start recording first');
        return;
      }

      // Stop current recording and wait for it to finalize
      console.log(`🎙️ Stopping recorder for Deck ${deck}...`);

      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => {
          console.log(`🎙️ Recorder stopped for Deck ${deck}`);
          resolve();
        }, { once: true });

        recorder.stop();
      });

      // Give it a moment to flush final chunks
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log(`📦 Have ${chunks.length} chunks to merge (total recording)`);

      if (chunks.length === 0) {
        console.log('⚠️ No audio chunks recorded');
        // Restart recording for next grab
        startRecording(deck);
        return;
      }

    // Create blob from ALL recorded chunks
    // The first chunk contains the initialization segment needed to decode the rest
    const mimeType = deck === 'A' ? deckAMimeTypeRef.current : deckBMimeTypeRef.current;
    const audioBlob = new Blob(chunks, { type: mimeType });
    console.log(`📦 Created audio blob: ${audioBlob.size} bytes, ${chunks.length} chunks`);
    console.log(`📦 Blob type: ${audioBlob.type} (from recorder: ${mimeType})`);

    // Convert blob to URL
    const audioUrl = URL.createObjectURL(audioBlob);
    console.log(`📦 Blob URL created: ${audioUrl}`);

    // Disconnect the recording tap to avoid feedback
    const deckState = deck === 'A' ? mixerState.deckA : mixerState.deckB;
    const destination = deck === 'A' ? deckADestinationRef.current : deckBDestinationRef.current;
    if (deckState.audioState?.gainNode && destination) {
      try {
        deckState.audioState.gainNode.disconnect(destination);
      } catch (e) {
        // Already disconnected, ignore
      }
    }

    // Determine BPM for grabbed audio based on other deck
    const otherDeck = deck === 'A' ? mixerState.deckB : mixerState.deckA;
    const grabbedBPM = otherDeck.track?.bpm || 120;

    // Get original track to preserve stream_url
    const originalTrack = mixerState[deck === 'A' ? 'deckA' : 'deckB'].track;

    // Create a pseudo-track for the grabbed audio
    const grabbedTrack: Track = {
      id: `grabbed-${Date.now()}`,
      title: `Grabbed from Radio (${deck})`,
      artist: originalTrack?.artist || 'Unknown',
      imageUrl: originalTrack?.imageUrl || '',
      audioUrl: audioUrl,
      bpm: grabbedBPM,
      content_type: 'grabbed_radio', // Mark as grabbed radio, not regular loop
      price_stx: 0,
      primary_uploader_wallet: '',
      // Preserve the original stream_url for re-grabbing
      ...(originalTrack && { stream_url: (originalTrack as any).stream_url })
    } as any;

    console.log(`🎵 Grabbed audio will use BPM: ${grabbedBPM}`);

    console.log(`🎵 Loading grabbed audio into Deck ${deck}...`);

    // Reload the deck with the grabbed audio as a loop
    if (deck === 'A') {
      await loadTrackToDeckA(grabbedTrack);
      // Auto-play the grabbed loop after a short delay
      setTimeout(() => {
        if (mixerState.deckA.audioControls && !mixerState.deckA.playing) {
          handleDeckAPlayPause();
        }
      }, 500);
    } else {
      await loadTrackToDeckB(grabbedTrack);
      // Auto-play the grabbed loop after a short delay
      setTimeout(() => {
        if (mixerState.deckB.audioControls && !mixerState.deckB.playing) {
          handleDeckBPlayPause();
        }
      }, 500);
    }

      console.log(`✅ GRAB complete! Deck ${deck} now playing grabbed radio loop!`);

      // Set "just grabbed" state for user feedback (stays until new content is loaded)
      if (deck === 'A') {
        setDeckAJustGrabbed(true);
      } else {
        setDeckBJustGrabbed(true);
      }
    } catch (error) {
      console.error(`❌ GRAB failed for Deck ${deck}:`, error);
    } finally {
      // ALWAYS clear grabbing state, even if there was an error
      if (deck === 'A') {
        setIsGrabbingDeckA(false);
      } else {
        setIsGrabbingDeckB(false);
      }
    }
  };

  // Start recording when radio loads
  useEffect(() => {
    if (mixerState.deckA.contentType === 'radio_station' && mixerState.deckA.audioState?.audio && !deckARecorderRef.current) {
      startRecording('A');
    }
  }, [mixerState.deckA.contentType, mixerState.deckA.audioState]);

  useEffect(() => {
    if (mixerState.deckB.contentType === 'radio_station' && mixerState.deckB.audioState?.audio && !deckBRecorderRef.current) {
      startRecording('B');
    }
  }, [mixerState.deckB.contentType, mixerState.deckB.audioState]);

  // 🎯 NEW: Set up synchronized loop restart for grabbed radio
  useEffect(() => {
    const deckAState = mixerState.deckA;
    const deckBState = mixerState.deckB;

    // Clear any existing callbacks first
    if (deckAState.audioState?.preciseLooper) {
      deckAState.audioState.preciseLooper.setLoopRestartCallback(undefined);
    }
    if (deckBState.audioState?.preciseLooper) {
      deckBState.audioState.preciseLooper.setLoopRestartCallback(undefined);
    }

    // If Deck A has a looping track and Deck B has grabbed radio, sync them
    if (deckAState.audioState?.preciseLooper &&
        deckAState.contentType !== 'radio_station' &&
        deckBState.contentType === 'grabbed_radio' &&
        deckBState.audioState?.audio) {

      const deckBElement = deckBState.audioState.audio;
      console.log('🎯 Setting up Deck A → Deck B synchronized loop restart (grabbed radio)');

      deckAState.audioState.preciseLooper.setLoopRestartCallback(() => {
        if (deckBElement && !deckBElement.paused) {
          deckBElement.currentTime = 0;
          console.log('🎯 Deck B grabbed radio restarted in sync with Deck A loop');
        }
      });
    }

    // If Deck B has a looping track and Deck A has grabbed radio, sync them
    if (deckBState.audioState?.preciseLooper &&
        deckBState.contentType !== 'radio_station' &&
        deckAState.contentType === 'grabbed_radio' &&
        deckAState.audioState?.audio) {

      const deckAElement = deckAState.audioState.audio;
      console.log('🎯 Setting up Deck B → Deck A synchronized loop restart (grabbed radio)');

      deckBState.audioState.preciseLooper.setLoopRestartCallback(() => {
        if (deckAElement && !deckAElement.paused) {
          deckAElement.currentTime = 0;
          console.log('🎯 Deck A grabbed radio restarted in sync with Deck B loop');
        }
      });
    }
  }, [
    mixerState.deckA.audioState,
    mixerState.deckA.contentType,
    mixerState.deckB.audioState,
    mixerState.deckB.contentType
  ]);

  // Expose loadMixerTracks and clearMixerDecks methods
  useEffect(() => {
    (window as any).loadMixerTracks = async (trackA: any, trackB: any) => {
      console.log('🎛️ UniversalMixer: Loading tracks from FILL:', trackA.title, '&', trackB.title);

      const normalizeTrack = (track: any): Track => ({
        id: track.id,
        title: track.title,
        artist: track.artist || track.artist_name || 'Unknown Artist',
        imageUrl: track.imageUrl || track.cover_image_url || '',
        audioUrl: track.audioUrl || track.audio_url,
        bpm: track.bpm,
        content_type: track.content_type,
        price_stx: track.price_stx,
        primary_uploader_wallet: track.primary_uploader_wallet
      });

      if (trackA) {
        await loadTrackToDeckA(normalizeTrack(trackA));
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      if (trackB) {
        await loadTrackToDeckB(normalizeTrack(trackB));
      }
    };

    (window as any).clearMixerDecks = () => {
      console.log('🗑️ UniversalMixer: Clearing both decks');
      clearDeckA();
      clearDeckB();
    };

    return () => {
      delete (window as any).loadMixerTracks;
      delete (window as any).clearMixerDecks;
    };
  }, []);

  // Expose mixer state for VideoDisplayArea
  useEffect(() => {
    (window as any).mixerState = {
      // Audio deck state (for breadcrumb thumbnails in mixer)
      deckATrack: mixerState.deckA.track,
      deckBTrack: mixerState.deckB.track,
      deckAPlaying: mixerState.deckA.playing,
      deckBPlaying: mixerState.deckB.playing,
      crossfaderPosition: mixerState.crossfaderPosition,
      // Audio analyzer nodes for WebGL audio reactive effects
      deckAAnalyzer: mixerState.deckA.audioState?.analyzerNode || null,
      deckBAnalyzer: mixerState.deckB.audioState?.analyzerNode || null,
      // Clear deck functions
      clearDeckA,
      clearDeckB,

      // 🎬 VIDEO TRACK STATE - Independent from audio decks
      videoATrack: mixerState.videoATrack,
      videoBTrack: mixerState.videoBTrack,
      // Video volume state (0-100, where 0 = muted)
      videoAVolume: mixerState.videoAVolume,
      videoBVolume: mixerState.videoBVolume,
      // Computed muted states for compatibility
      videoAMuted: mixerState.videoAVolume === 0,
      videoBMuted: mixerState.videoBVolume === 0,
      // Volume setters
      setVideoAVolume: (volume: number) => {
        setMixerState(prev => ({
          ...prev,
          videoAVolume: Math.max(0, Math.min(100, volume))
        }));
      },
      setVideoBVolume: (volume: number) => {
        setMixerState(prev => ({
          ...prev,
          videoBVolume: Math.max(0, Math.min(100, volume))
        }));
      },
      // Mute toggles (toggle between 0 and 100)
      toggleVideoAMute: () => {
        setMixerState(prev => ({
          ...prev,
          videoAVolume: prev.videoAVolume === 0 ? 100 : 0
        }));
      },
      toggleVideoBMute: () => {
        setMixerState(prev => ({
          ...prev,
          videoBVolume: prev.videoBVolume === 0 ? 100 : 0
        }));
      },
      // Clear video functions
      clearVideoA: () => {
        setMixerState(prev => ({
          ...prev,
          videoATrack: null,
          videoAVolume: 100
        }));
      },
      clearVideoB: () => {
        setMixerState(prev => ({
          ...prev,
          videoBTrack: null,
          videoBVolume: 100
        }));
      },

      // Legacy aliases for backwards compatibility
      deckAMuted: mixerState.videoAVolume === 0,
      deckBMuted: mixerState.videoBVolume === 0,
      deckAVolume: mixerState.videoAVolume,
      deckBVolume: mixerState.videoBVolume,
      setDeckAVolume: (volume: number) => {
        setMixerState(prev => ({
          ...prev,
          videoAVolume: Math.max(0, Math.min(100, volume))
        }));
      },
      setDeckBVolume: (volume: number) => {
        setMixerState(prev => ({
          ...prev,
          videoBVolume: Math.max(0, Math.min(100, volume))
        }));
      },
    };

    return () => {
      delete (window as any).mixerState;
    };
  }, [
    mixerState.deckA.track,
    mixerState.deckB.track,
    mixerState.deckA.playing,
    mixerState.deckB.playing,
    mixerState.crossfaderPosition,
    mixerState.deckA.audioState?.analyzerNode,
    mixerState.deckB.audioState?.analyzerNode,
    // Video track state
    mixerState.videoATrack,
    mixerState.videoBTrack,
    mixerState.videoAVolume,
    mixerState.videoBVolume,
  ]);

  // Check if any deck has radio content - radio can't sync
  const hasRadio =
    mixerState.deckA.contentType === 'radio_station' ||
    mixerState.deckA.contentType === 'grabbed_radio' ||
    mixerState.deckB.contentType === 'radio_station' ||
    mixerState.deckB.contentType === 'grabbed_radio';

  // Check if both decks have video clips - videos of different lengths can't sync
  const bothVideos =
    mixerState.deckA.contentType === 'video_clip' &&
    mixerState.deckB.contentType === 'video_clip';

  return (
    <div
      className={`universal-mixer bg-slate-900/30 backdrop-blur-sm rounded-xl shadow-2xl border overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: isCollapsed ? '0.5rem 1rem' : '1.5rem',
        transition: 'padding 0.3s, filter 0.15s, border-color 0.15s',
        filter: (isDeckDragOver || isVideoDragOver) ? 'brightness(1.15)' : 'brightness(1)',
        borderColor: isVideoDragOver
          ? 'rgba(91, 181, 249, 0.4)' // Video color #5BB5F9
          : isDeckDragOver
            ? 'rgba(129, 228, 242, 0.4)' // Cyan for audio
            : 'rgba(51, 65, 85, 0.5)'
      }}
    >
      {/* Collapse/Expand Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute ${isCollapsed ? 'top-1' : 'top-2'} right-2 p-1 rounded hover:bg-white/10 transition-all duration-200 z-10`}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`transform transition-transform ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}
        >
          <path
            d="M7 14L12 9L17 14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/70"
          />
        </svg>
      </button>

      {/* Collapsed State */}
      {isCollapsed ? (
        <div className="flex items-center justify-center gap-4 py-1 pr-8">
          <Music className="w-4 h-4 text-gray-400" />
          {mixerState.deckA.playing || mixerState.deckB.playing ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className={`w-1 h-3 rounded-full ${mixerState.deckA.playing ? 'bg-cyan-400' : 'bg-gray-600'}`} />
                <div className={`w-1 h-3 rounded-full ${mixerState.deckB.playing ? 'bg-blue-400' : 'bg-gray-600'}`} />
              </div>
              <span className="text-xs text-gray-400">
                {mixerState.masterBPM} BPM
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">Universal Mixer</span>
          )}
        </div>
      ) : (
        <>
          {/* Unified Mixer Container */}
          <div className="flex justify-center">
            <div className="w-[600px] relative">

          {/* Video A Thumbnail - Top Left, aligned with Deck A */}
          <VideoThumbnail
            track={mixerState.videoATrack}
            slot="A"
            position="left"
            onDrop={(track) => {
              setMixerState(prev => ({ ...prev, videoATrack: track, videoAVolume: 100 }));
              showToast('Video loaded to Video A', 'success', 2000);
            }}
            onClear={() => {
              setMixerState(prev => ({ ...prev, videoATrack: null, videoAVolume: 100 }));
              showToast('Video A cleared', 'info', 1500);
            }}
            onDragOver={setIsVideoDragOver}
          />

          {/* Video B Thumbnail - Top Right, aligned with Deck B */}
          <VideoThumbnail
            track={mixerState.videoBTrack}
            slot="B"
            position="right"
            onDrop={(track) => {
              setMixerState(prev => ({ ...prev, videoBTrack: track, videoBVolume: 100 }));
              showToast('Video loaded to Video B', 'success', 2000);
            }}
            onClear={() => {
              setMixerState(prev => ({ ...prev, videoBTrack: null, videoBVolume: 100 }));
              showToast('Video B cleared', 'info', 1500);
            }}
            onDragOver={setIsVideoDragOver}
          />

          {/* Transport and Loop Controls Row - z-10 to stay above deck drop zones */}
          <div className="flex justify-center items-center gap-2 mb-5 relative z-10">
            {/* Deck A Loop Controls - compact, close to SYNC */}
            <div className="flex justify-end">
              {mixerState.deckA.contentType !== 'radio_station' && (
                <LoopControlsCompact
                  loopLength={mixerState.deckA.loopLength}
                  loopEnabled={mixerState.deckA.loopEnabled}
                  onLoopChange={(length) => handleLoopLengthChange('A', length)}
                  onLoopToggle={() => handleLoopToggle('A')}
                  color="cyan"
                  disabled={!mixerState.deckA.track}
                />
              )}
            </div>

            {/* Deck A Sync Button */}
            <button
              onClick={() => handleDeckSync('A')}
              disabled={!mixerState.syncActive || hasRadio || bothVideos}
              className={`px-1.5 py-0.5 rounded text-[7px] font-bold transition-all uppercase tracking-wider ${
                hasRadio || bothVideos || !mixerState.syncActive
                  ? 'border text-slate-600 border-slate-700 bg-slate-800/20 opacity-40 cursor-not-allowed'
                  : mixerState.masterDeckId === 'A'
                  ? 'border border-[#FBBF24] bg-[#FBBF24]/20 text-[#FBBF24] cursor-pointer'
                  : 'border text-slate-400 border-slate-600 bg-slate-800/40 hover:border-slate-500 hover:text-slate-300 cursor-pointer'
              }`}
              title={
                hasRadio
                  ? 'Radio stations cannot sync'
                  : bothVideos
                  ? 'Videos of different lengths cannot sync'
                  : !mixerState.syncActive
                  ? 'Enable sync from master control first'
                  : mixerState.masterDeckId === 'A'
                  ? 'Deck A is master (controls tempo)'
                  : 'Switch to Deck A as master'
              }
            >
              {mixerState.syncActive && mixerState.masterDeckId === 'A' ? 'MSTR' : 'SYNC'}
            </button>

            <div className="flex flex-col items-center gap-1 relative">
              <MasterTransportControlsCompact
                variant="simplified"
                masterBPM={mixerState.masterBPM}
                deckALoaded={!!mixerState.deckA.track}
                deckBLoaded={!!mixerState.deckB.track}
                deckAPlaying={mixerState.deckA.playing}
                deckBPlaying={mixerState.deckB.playing}
                deckABPM={mixerState.deckA.track?.bpm || mixerState.masterBPM}
                recordingRemix={isMixerRecording}
                recordingArmed={isMixerArmed}
                recordingRehearsal={isMixerRehearsal}
                recordingPreCountdown={isMixerPreCountdown}
                recordingCountIn={isMixerPreCountdown ? countInBeat : (recordingState === 'countingIn' ? countInBeat : 0)}
                syncActive={mixerState.syncActive && !hasRadio && !bothVideos}
                highlightPlayButton={deckAJustGrabbed || deckBJustGrabbed}
                hasRadio={hasRadio}
                bothVideos={bothVideos}
                onMasterPlay={handleMasterPlay}
                onMasterPlayAfterCountIn={handleMasterPlayAfterCountIn}
                onMasterStop={handleMasterStop}
                onRecordToggle={handleRecordToggle}
                onMasterSyncReset={handleMasterSyncReset}
                onSyncToggle={handleSyncToggle}
              />

              {/* Sync Warning Tooltip */}
              {syncWarningVisible && (
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 z-50 whitespace-nowrap">
                  <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-slate-900 px-3 py-1.5 rounded-md text-[10px] font-bold shadow-lg border border-orange-400 animate-pulse">
                    ⚠️ Stop playback before changing sync
                  </div>
                </div>
              )}
            </div>

            {/* Deck B Sync Button */}
            <button
              onClick={() => handleDeckSync('B')}
              disabled={!mixerState.syncActive || hasRadio || bothVideos}
              className={`px-1.5 py-0.5 rounded text-[7px] font-bold transition-all uppercase tracking-wider ${
                hasRadio || bothVideos || !mixerState.syncActive
                  ? 'border text-slate-600 border-slate-700 bg-slate-800/20 opacity-40 cursor-not-allowed'
                  : mixerState.masterDeckId === 'B'
                  ? 'border border-[#FBBF24] bg-[#FBBF24]/20 text-[#FBBF24] cursor-pointer'
                  : 'border text-slate-400 border-slate-600 bg-slate-800/40 hover:border-slate-500 hover:text-slate-300 cursor-pointer'
              }`}
              title={
                hasRadio
                  ? 'Radio stations cannot sync'
                  : bothVideos
                  ? 'Videos of different lengths cannot sync'
                  : !mixerState.syncActive
                  ? 'Enable sync from master control first'
                  : mixerState.masterDeckId === 'B'
                  ? 'Deck B is master (controls tempo)'
                  : 'Switch to Deck B as master'
              }
            >
              {mixerState.syncActive && mixerState.masterDeckId === 'B' ? 'MSTR' : 'SYNC'}
            </button>

            {/* Deck B Loop Controls - compact, close to SYNC */}
            <div className="flex justify-start">
              {mixerState.deckB.contentType !== 'radio_station' && (
                <LoopControlsCompact
                  loopLength={mixerState.deckB.loopLength}
                  loopEnabled={mixerState.deckB.loopEnabled}
                  onLoopChange={(length) => handleLoopLengthChange('B', length)}
                  onLoopToggle={() => handleLoopToggle('B')}
                  color="cyan"
                  disabled={!mixerState.deckB.track}
                  reverse={true}
                />
              )}
            </div>

            {/* Deck B Video Breadcrumb - shows when video is in Video Widget */}
            <div className="w-[24px] flex justify-center">
              {mixerState.deckB.track?.content_type === 'video_clip' && (
                <div
                  className="w-[20px] h-[20px] rounded border-2 border-[#38BDF8]/60 overflow-hidden bg-slate-800 shadow-sm shadow-[#38BDF8]/20"
                  title="Video B in Video Mixer"
                >
                  {(mixerState.deckB.track?.cover_image_url || (mixerState.deckB.track as any)?.thumb_64_url || (mixerState.deckB.track as any)?.thumb_160_url || (mixerState.deckB.track as any)?.imageUrl) ? (
                    <img
                      src={mixerState.deckB.track.cover_image_url || (mixerState.deckB.track as any)?.thumb_64_url || (mixerState.deckB.track as any)?.thumb_160_url || (mixerState.deckB.track as any)?.imageUrl}
                      alt="Video B"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[8px] text-[#38BDF8]">▶</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Decks, Waveforms, and Crossfader Section */}
          <div className="h-[100px] relative">
            <div>
              {/* Deck A Volume Slider (Left Side) - COMMENTED OUT: Crossfader handles volume balance */}
              {/* <div className="absolute left-0 bottom-[46px]">
                <VerticalVolumeSlider
                  volume={mixerState.deckA.volume}
                  onVolumeChange={handleDeckAVolumeChange}
                  deck="A"
                />
              </div> */}

              {/* Deck A Filter Controls - MOVED TO FX PANEL HEADER */}
              {/* <div className="absolute left-0 bottom-0 flex flex-row gap-1.5">
                {mixerState.deckA.track && (
                  <>
                    <button
                      onClick={handleDeckALoCutToggle}
                      className={`px-2 h-5 rounded text-[8px] font-bold uppercase transition-all border-2 ${
                        mixerState.deckA.loCutEnabled
                          ? 'bg-slate-900 border-purple-500 text-purple-300 shadow-lg shadow-purple-500/50'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-purple-400'
                      }`}
                      title="Low Cut Filter (removes bass)"
                    >
                      LO CUT
                    </button>
                    <button
                      onClick={handleDeckAHiCutToggle}
                      className={`px-2 h-5 rounded text-[8px] font-bold uppercase transition-all border-2 ${
                        mixerState.deckA.hiCutEnabled
                          ? 'bg-slate-900 border-orange-500 text-orange-300 shadow-lg shadow-orange-500/50'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-orange-400'
                      }`}
                      title="High Cut Filter (removes highs)"
                    >
                      HI CUT
                    </button>
                  </>
                )}
              </div> */}

              {/* Deck A */}
              <div className="absolute left-[20px] bottom-[42px]">
                <SimplifiedDeckCompact
                  currentTrack={mixerState.deckA.track}
                  isPlaying={mixerState.deckA.playing}
                  isLoading={mixerState.deckA.loading}
                  onTrackDrop={loadTrackToDeckA}
                  onPackDrop={(pack) => handlePackDrop(pack, 'A')}
                  onTrackClear={clearDeckA}
                  onDragOver={setIsDeckDragOver}
                  deck="A"
                  contentType={mixerState.deckA.contentType}
                />
              </div>

              {/* Deck A FX Button - Centered between crossfader and deck image */}
              <div className="absolute left-1/2 -translate-x-[179px] bottom-0">
                {mixerState.deckA.track && (
                  <button
                    onClick={handleDeckAFXToggle}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-all border-2 border-[#81E4F2]/60 text-[#81E4F2] bg-transparent hover:bg-[#81E4F2]/15 hover:border-[#81E4F2]"
                    title="Instant FX"
                  >
                    {mixerState.deckA.fxPanelOpen ? (
                      <ChevronDown size={16} strokeWidth={3} />
                    ) : (
                      <span className="text-[9px] font-extrabold">FX</span>
                    )}
                  </button>
                )}
              </div>

              {/* Deck A Section Navigator (Below Deck Image, left-aligned) */}
              <div className="absolute left-[20px] bottom-[12px]">
                {mixerState.deckA.contentType === 'full_song' && (() => {
                  // Calculate total sections from track duration and BPM
                  const bpm = mixerState.deckA.track?.bpm || 120;
                  const duration = mixerState.deckA.audioState?.duration || 0;
                  const secondsPerBeat = 60 / bpm;
                  const secondsPer8Bars = secondsPerBeat * 32; // 8 bars = 32 beats
                  const totalSections = Math.ceil(duration / secondsPer8Bars);

                  return (
                    <SectionNavigator
                      currentSection={mixerState.deckA.loopPosition}
                      totalSections={totalSections}
                      onSectionChange={(position) => handleLoopPositionChange('A', position)}
                      deck="A"
                      loopEnabled={mixerState.deckA.loopEnabled}
                      onLoopToggle={() => handleLoopToggle('A')}
                    />
                  );
                })()}
              </div>

              {/* Deck A Radio Play Button (Below Deck Image, left-aligned) */}
              {(mixerState.deckA.contentType === 'radio_station' || mixerState.deckA.contentType === 'grabbed_radio') && (
                <div className="absolute left-[20px] bottom-[12px] w-[72px] h-[20px]">
                  <button
                    onClick={() => {
                      // Don't allow interaction with grabbed_radio
                      if (mixerState.deckA.contentType === 'grabbed_radio') return;

                      if (!mixerState.deckA.playing || deckARadioPlayTime < 10) {
                        handleRadioPlay('A');
                      } else if (deckARadioPlayTime >= 10) {
                        handleGrab('A');
                      }
                    }}
                    disabled={isGrabbingDeckA || mixerState.deckA.contentType === 'grabbed_radio'}
                    className={`w-full h-full flex items-center justify-center gap-1 px-2 rounded border transition-all ${
                      mixerState.deckA.contentType === 'grabbed_radio'
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : isGrabbingDeckA
                        ? 'bg-slate-800 text-red-400 animate-pulse'
                        : deckARadioPlayTime >= 10
                        ? 'bg-slate-800 animate-pulse'
                        : mixerState.deckA.playing
                        ? 'bg-slate-800 text-slate-400 animate-pulse'
                        : 'bg-slate-800 text-slate-300 hover:text-[#81E4F2] animate-pulse'
                    }`}
                    style={{
                      borderColor: mixerState.deckA.contentType === 'grabbed_radio' ? '#475569' : isGrabbingDeckA ? '#ef4444' : deckARadioPlayTime >= 10 ? '#FFC044' : mixerState.deckA.playing ? '#94a3b8' : '#81E4F240',
                      color: deckARadioPlayTime >= 10 && mixerState.deckA.contentType !== 'grabbed_radio' ? '#FFC044' : undefined
                    }}
                    title={
                      mixerState.deckA.contentType === 'grabbed_radio'
                        ? 'Grabbed audio ready! Load new station to grab again'
                        : isGrabbingDeckA
                        ? 'Grabbing audio...'
                        : deckARadioPlayTime >= 10
                        ? 'Grab audio from radio'
                        : mixerState.deckA.playing
                        ? 'Buffering audio...'
                        : 'Start radio playback'
                    }
                  >
                    {!mixerState.deckA.playing && <Radio size={10} />}
                    <span className="text-[9px] font-bold">
                      {mixerState.deckA.contentType === 'grabbed_radio' ? 'DONE' : isGrabbingDeckA ? 'BUFFER' : deckARadioPlayTime >= 10 ? 'GRAB' : mixerState.deckA.playing ? 'buffering...' : 'PLAY'}
                    </span>
                  </button>
                </div>
              )}

              {/* Deck A FX Panel - Positioned as left sidebar overlay */}
              {mixerState.deckA.track && mixerState.deckA.fxPanelOpen && (
                <div className="absolute left-0 top-[calc(50%-32px)] -translate-y-1/2 w-[160px] z-50">
                  <DeckFXPanel
                    deck="A"
                    isOpen={mixerState.deckA.fxPanelOpen}
                    onClose={() => setMixerState(prev => ({ ...prev, deckA: { ...prev.deckA, fxPanelOpen: false } }))}
                    hiCutEnabled={mixerState.deckA.hiCutEnabled}
                    loCutEnabled={mixerState.deckA.loCutEnabled}
                    onHiCutToggle={handleDeckAHiCutToggle}
                    onLoCutToggle={handleDeckALoCutToggle}
                    onTriggerFX={(fxType) => {
                      console.log(`🎛️ Deck A: ${fxType} triggered`);
                      const controls = mixerState.deckA.audioControls;
                      if (!controls) return () => {};

                      switch (fxType) {
                        case 'echoOut':
                          return controls.triggerEchoOut();
                        case 'filterSweep':
                          return controls.triggerFilterSweep();
                        case 'reverb':
                          return controls.triggerReverb();
                        case 'gate':
                          return controls.triggerGate(mixerState.masterBPM || 120);
                        default:
                          return () => {};
                      }
                    }}
                    className="h-full"
                  />
                </div>
              )}

              {/* Waveforms */}
              <div className="absolute left-[96px] bottom-[48px]" style={{ width: '408px' }}>
                <div>
                  <div className="mb-1">
                    <WaveformDisplayCompact
                      audioBuffer={mixerState.deckA.audioState?.audioBuffer}
                      currentTime={mixerState.deckA.audioState?.currentTime || 0}
                      isPlaying={mixerState.deckA.playing}
                      trackBPM={mixerState.deckA.track?.bpm || mixerState.masterBPM}
                      loopEnabled={mixerState.deckA.loopEnabled}
                      loopLength={mixerState.deckA.loopLength}
                      loopPosition={mixerState.deckA.loopPosition}
                      onLoopPositionChange={(position) => handleLoopPositionChange('A', position)}
                      contentType={mixerState.deckA.contentType}
                      width={408}
                      height={28}
                      waveformColor="#FF6B6B"
                      className="border border-emerald-500/30"
                    />
                  </div>

                  <WaveformDisplayCompact
                    audioBuffer={mixerState.deckB.audioState?.audioBuffer}
                    currentTime={mixerState.deckB.audioState?.currentTime || 0}
                    isPlaying={mixerState.deckB.playing}
                    trackBPM={mixerState.deckB.track?.bpm || mixerState.masterBPM}
                    loopEnabled={mixerState.deckB.loopEnabled}
                    loopLength={mixerState.deckB.loopLength}
                    loopPosition={mixerState.deckB.loopPosition}
                    onLoopPositionChange={(position) => handleLoopPositionChange('B', position)}
                    contentType={mixerState.deckB.contentType}
                    width={408}
                    height={28}
                    waveformColor="#FF6B6B"
                    className="border border-blue-500/30"
                  />
                </div>
              </div>

              {/* Deck B */}
              <div className="absolute right-[20px] bottom-[42px]">
                <SimplifiedDeckCompact
                  currentTrack={mixerState.deckB.track}
                  isPlaying={mixerState.deckB.playing}
                  isLoading={mixerState.deckB.loading}
                  onTrackDrop={loadTrackToDeckB}
                  onPackDrop={(pack) => handlePackDrop(pack, 'B')}
                  onTrackClear={clearDeckB}
                  onDragOver={setIsDeckDragOver}
                  deck="B"
                  contentType={mixerState.deckB.contentType}
                />
              </div>

              {/* Deck B Section Navigator (Below Deck Image, right-aligned) */}
              <div className="absolute right-[20px] bottom-[12px]">
                {mixerState.deckB.contentType === 'full_song' && (() => {
                  // Calculate total sections from track duration and BPM
                  const bpm = mixerState.deckB.track?.bpm || 120;
                  const duration = mixerState.deckB.audioState?.duration || 0;
                  const secondsPerBeat = 60 / bpm;
                  const secondsPer8Bars = secondsPerBeat * 32; // 8 bars = 32 beats
                  const totalSections = Math.ceil(duration / secondsPer8Bars);

                  return (
                    <SectionNavigator
                      currentSection={mixerState.deckB.loopPosition}
                      totalSections={totalSections}
                      onSectionChange={(position) => handleLoopPositionChange('B', position)}
                      deck="B"
                      loopEnabled={mixerState.deckB.loopEnabled}
                      onLoopToggle={() => handleLoopToggle('B')}
                    />
                  );
                })()}
              </div>

              {/* Deck B Radio Play Button (Below Deck Image, right-aligned) */}
              {(mixerState.deckB.contentType === 'radio_station' || mixerState.deckB.contentType === 'grabbed_radio') && (
                <div className="absolute right-[20px] bottom-[12px] w-[72px] h-[20px]">
                  <button
                    onClick={() => {
                      // Don't allow interaction with grabbed_radio
                      if (mixerState.deckB.contentType === 'grabbed_radio') return;

                      if (!mixerState.deckB.playing || deckBRadioPlayTime < 10) {
                        handleRadioPlay('B');
                      } else if (deckBRadioPlayTime >= 10) {
                        handleGrab('B');
                      }
                    }}
                    disabled={isGrabbingDeckB || mixerState.deckB.contentType === 'grabbed_radio'}
                    className={`w-full h-full flex items-center justify-center gap-1 px-2 rounded border transition-all ${
                      mixerState.deckB.contentType === 'grabbed_radio'
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : isGrabbingDeckB
                        ? 'bg-slate-800 text-red-400 animate-pulse'
                        : deckBRadioPlayTime >= 10
                        ? 'bg-slate-800 animate-pulse'
                        : mixerState.deckB.playing
                        ? 'bg-slate-800 text-slate-400 animate-pulse'
                        : 'bg-slate-800 text-slate-300 hover:text-[#81E4F2] animate-pulse'
                    }`}
                    style={{
                      borderColor: mixerState.deckB.contentType === 'grabbed_radio' ? '#475569' : isGrabbingDeckB ? '#ef4444' : deckBRadioPlayTime >= 10 ? '#FFC044' : mixerState.deckB.playing ? '#94a3b8' : '#81E4F240',
                      color: deckBRadioPlayTime >= 10 && mixerState.deckB.contentType !== 'grabbed_radio' ? '#FFC044' : undefined
                    }}
                    title={
                      mixerState.deckB.contentType === 'grabbed_radio'
                        ? 'Grabbed audio ready! Load new station to grab again'
                        : isGrabbingDeckB
                        ? 'Grabbing audio...'
                        : deckBRadioPlayTime >= 10
                        ? 'Grab audio from radio'
                        : mixerState.deckB.playing
                        ? 'Buffering audio...'
                        : 'Start radio playback'
                    }
                  >
                    {!mixerState.deckB.playing && <Radio size={10} />}
                    <span className="text-[9px] font-bold">
                      {mixerState.deckB.contentType === 'grabbed_radio' ? 'DONE' : isGrabbingDeckB ? 'BUFFER' : deckBRadioPlayTime >= 10 ? 'GRAB' : mixerState.deckB.playing ? 'buffering...' : 'PLAY'}
                    </span>
                  </button>
                </div>
              )}

              {/* Deck B FX Panel - Positioned as right sidebar overlay */}
              {mixerState.deckB.track && mixerState.deckB.fxPanelOpen && (
                <div className="absolute right-0 top-[calc(50%-32px)] -translate-y-1/2 w-[160px] z-50">
                  <DeckFXPanel
                    deck="B"
                    isOpen={mixerState.deckB.fxPanelOpen}
                    onClose={() => setMixerState(prev => ({ ...prev, deckB: { ...prev.deckB, fxPanelOpen: false } }))}
                    hiCutEnabled={mixerState.deckB.hiCutEnabled}
                    loCutEnabled={mixerState.deckB.loCutEnabled}
                    onHiCutToggle={handleDeckBHiCutToggle}
                    onLoCutToggle={handleDeckBLoCutToggle}
                    onTriggerFX={(fxType) => {
                      console.log(`🎛️ Deck B: ${fxType} triggered`);
                      const controls = mixerState.deckB.audioControls;
                      if (!controls) return () => {};

                      switch (fxType) {
                        case 'echoOut':
                          return controls.triggerEchoOut();
                        case 'filterSweep':
                          return controls.triggerFilterSweep();
                        case 'reverb':
                          return controls.triggerReverb();
                        case 'gate':
                          return controls.triggerGate(mixerState.masterBPM || 120);
                        default:
                          return () => {};
                      }
                    }}
                    className="h-full"
                  />
                </div>
              )}

              {/* Deck B Volume Slider (Right Side) - COMMENTED OUT: Crossfader handles volume balance */}
              {/* <div className="absolute right-0 bottom-[46px]">
                <VerticalVolumeSlider
                  volume={mixerState.deckB.volume}
                  onVolumeChange={handleDeckBVolumeChange}
                  deck="B"
                />
              </div> */}

              {/* Deck B Filter Controls - MOVED TO FX PANEL HEADER */}
              {/* <div className="absolute right-0 bottom-0 flex flex-row gap-1.5">
                {mixerState.deckB.track && (
                  <>
                    <button
                      onClick={handleDeckBLoCutToggle}
                      className={`px-2 h-5 rounded text-[8px] font-bold uppercase transition-all border-2 ${
                        mixerState.deckB.loCutEnabled
                          ? 'bg-slate-900 border-purple-500 text-purple-300 shadow-lg shadow-purple-500/50'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-purple-400'
                      }`}
                      title="Low Cut Filter (removes bass)"
                    >
                      LO CUT
                    </button>
                    <button
                      onClick={handleDeckBHiCutToggle}
                      className={`px-2 h-5 rounded text-[8px] font-bold uppercase transition-all border-2 ${
                        mixerState.deckB.hiCutEnabled
                          ? 'bg-slate-900 border-orange-500 text-orange-300 shadow-lg shadow-orange-500/50'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-orange-400'
                      }`}
                      title="High Cut Filter (removes highs)"
                    >
                      HI CUT
                    </button>
                  </>
                )}
              </div> */}

              {/* Deck B FX Button - Centered between crossfader and deck image */}
              <div className="absolute left-1/2 translate-x-[151px] bottom-0">
                {mixerState.deckB.track && (
                  <button
                    onClick={handleDeckBFXToggle}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-all border-2 border-[#81E4F2]/60 text-[#81E4F2] bg-transparent hover:bg-[#81E4F2]/15 hover:border-[#81E4F2]"
                    title="Instant FX"
                  >
                    {mixerState.deckB.fxPanelOpen ? (
                      <ChevronDown size={16} strokeWidth={3} />
                    ) : (
                      <span className="text-[9px] font-extrabold">FX</span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Crossfader */}
            <div className="absolute left-1/2 transform -translate-x-1/2 bottom-0">
              <div className="w-[200px]">
                <CrossfaderControlCompact
                  position={mixerState.crossfaderPosition}
                  onPositionChange={handleCrossfaderChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Remix Completion Modal (multi-step flow) */}
      {showRecordingWidget && recordingData && costInfo && (
        <RemixCompletionModal
          isOpen={showRecordingWidget}
          recordingData={recordingData}
          trimState={trimState}
          costInfo={costInfo}
          loadedTracks={[
            mixerState.deckA.track,
            mixerState.deckB.track,
            mixerState.videoATrack,
            mixerState.videoBTrack
          ].filter((t): t is IPTrack => t !== null && !!t.id) as IPTrack[]}
          onClose={handleRecordingClose}
          onTrimStartChange={setTrimStart}
          onTrimEndChange={setTrimEnd}
          onNudge={nudgeTrim}
          getAudioForTrim={getAudioForTrim}
          getVideoForTrim={getVideoForTrim}
          hasVideo={hasVideo}
        />
      )}
    </div>
  );
}
