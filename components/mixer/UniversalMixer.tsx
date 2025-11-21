"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { Music, Radio } from 'lucide-react';
import { useMixer } from '@/contexts/MixerContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { IPTrack } from '@/types';
import { determineMasterBPM } from './utils/mixerBPMCalculator';
import { useMixerPackHandler } from './hooks/useMixerPackHandler';

interface UniversalMixerProps {
  className?: string;
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
  };
  masterBPM: number;
  crossfaderPosition: number;
  syncActive: boolean;
  masterDeckId: 'A' | 'B'; // 🎯 NEW: Which deck is master for sync
}

export default function UniversalMixer({ className = "" }: UniversalMixerProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [syncWarningVisible, setSyncWarningVisible] = useState(false);

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
      isPitchProcessing: false
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
      isPitchProcessing: false
    },
    masterBPM: 120,
    crossfaderPosition: 50,
    syncActive: false,
    masterDeckId: 'A' // Default to Deck A as master
  });

  // Sync engine reference
  const syncEngineRef = React.useRef<SimpleLoopSync | null>(null);

  // Track if user manually disabled sync (to prevent auto-sync from re-enabling)
  const userDisabledSyncRef = React.useRef<boolean>(false);

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

  // Use mixer context for crate (collection) management
  const { addTrackToCollection } = useMixer();

  // Use toast for notifications
  const { showToast } = useToast();

  // Use pack handler for unpacking loop packs, EPs, and station packs
  const { handlePackDrop: handlePackDropFromHook } = useMixerPackHandler();

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

      const audioContext = mixerState.deckA.audioState.audioContext;
      const masterDeckId = determineMasterDeck();

      console.log(`🎛️ AUTO-SYNC: Creating sync with Deck ${masterDeckId} as master`);

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

    if (mixerState.deckA.loading) {
      console.log('⚠️ Deck A already loading, skipping');
      return;
    }

    // Reset "just grabbed" state when loading new content
    setDeckAJustGrabbed(false);

    // Detect content type
    const contentType = (track as any).content_type || 'loop';
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

          // 🎯 AUTO-SYNC: If Deck B is empty, make Deck A the master (first loaded = master)
          const newMasterDeckId = !prev.deckB.track ? 'A' : prev.masterDeckId;

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

    if (mixerState.deckB.loading) {
      console.log('⚠️ Deck B already loading, skipping');
      return;
    }

    // Reset "just grabbed" state when loading new content
    setDeckBJustGrabbed(false);

    // Detect content type
    const contentType = (track as any).content_type || 'loop';
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

          // 🎯 AUTO-SYNC: If Deck A is empty, make Deck B the master (first loaded = master)
          const newMasterDeckId = !prev.deckA.track ? 'B' : prev.masterDeckId;

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
      deckATrack: mixerState.deckA.track,
      deckBTrack: mixerState.deckB.track,
      deckAPlaying: mixerState.deckA.playing,
      deckBPlaying: mixerState.deckB.playing,
      crossfaderPosition: mixerState.crossfaderPosition
    };

    return () => {
      delete (window as any).mixerState;
    };
  }, [
    mixerState.deckA.track,
    mixerState.deckB.track,
    mixerState.deckA.playing,
    mixerState.deckB.playing,
    mixerState.crossfaderPosition
  ]);

  // Check if any deck has radio content - radio can't sync
  const hasRadio =
    mixerState.deckA.contentType === 'radio_station' ||
    mixerState.deckA.contentType === 'grabbed_radio' ||
    mixerState.deckB.contentType === 'radio_station' ||
    mixerState.deckB.contentType === 'grabbed_radio';

  return (
    <div
      className={`universal-mixer bg-slate-900/30 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: isCollapsed ? '0.5rem 1rem' : '1.5rem',
        transition: 'padding 0.3s'
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

          {/* Instructions */}
          {isHovered && (
            <div className="text-center mb-3 text-white/60">
              <p className="text-xs">Drag content to Decks to mix</p>
            </div>
          )}

          {/* Transport and Loop Controls Row */}
          <div className="flex justify-center items-center gap-3 mb-5">
            {/* Deck A Controls - Fixed width container to prevent shifting */}
            <div className="w-[100px] flex justify-center mr-2">
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
              disabled={!mixerState.syncActive || hasRadio}
              className={`px-1.5 py-0.5 rounded text-[7px] font-bold transition-all uppercase tracking-wider border ${
                hasRadio || !mixerState.syncActive
                  ? 'text-slate-600 border-slate-700 bg-slate-800/20 opacity-40 cursor-not-allowed'
                  : mixerState.masterDeckId === 'A'
                  ? 'text-[#81E4F2] border-amber-500/50 bg-amber-500/10 hover:border-amber-500/70 cursor-pointer'
                  : 'text-slate-400 border-slate-600 bg-slate-800/40 hover:border-slate-500 hover:text-slate-300 cursor-pointer'
              }`}
              title={
                hasRadio
                  ? 'Radio stations cannot sync'
                  : !mixerState.syncActive
                  ? 'Enable sync from master control first'
                  : mixerState.masterDeckId === 'A'
                  ? 'Deck A is master'
                  : 'Switch to Deck A as master'
              }
            >
              SYNC
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
                recordingRemix={false}
                syncActive={mixerState.syncActive && !hasRadio}
                highlightPlayButton={deckAJustGrabbed || deckBJustGrabbed}
                hasRadio={hasRadio}
                onMasterPlay={handleMasterPlay}
                onMasterPlayAfterCountIn={handleMasterPlayAfterCountIn}
                onMasterStop={handleMasterStop}
                onRecordToggle={() => {}}
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
              disabled={!mixerState.syncActive || hasRadio}
              className={`px-1.5 py-0.5 rounded text-[7px] font-bold transition-all uppercase tracking-wider border ${
                hasRadio || !mixerState.syncActive
                  ? 'text-slate-600 border-slate-700 bg-slate-800/20 opacity-40 cursor-not-allowed'
                  : mixerState.masterDeckId === 'B'
                  ? 'text-[#81E4F2] border-amber-500/50 bg-amber-500/10 hover:border-amber-500/70 cursor-pointer'
                  : 'text-slate-400 border-slate-600 bg-slate-800/40 hover:border-slate-500 hover:text-slate-300 cursor-pointer'
              }`}
              title={
                hasRadio
                  ? 'Radio stations cannot sync'
                  : !mixerState.syncActive
                  ? 'Enable sync from master control first'
                  : mixerState.masterDeckId === 'B'
                  ? 'Deck B is master'
                  : 'Switch to Deck B as master'
              }
            >
              SYNC
            </button>

            {/* Deck B Controls - Fixed width container to prevent shifting */}
            <div className="w-[100px] flex justify-center ml-2">
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

              {/* Deck A FX Button - Centered between crossfader and deck image */}
              <div className="absolute left-1/2 -translate-x-[179px] bottom-0">
                {mixerState.deckA.track && (
                  <button
                    onClick={handleDeckAFXToggle}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all border-2 ${
                      mixerState.deckA.fxPanelOpen
                        ? 'bg-[#81E4F2] border-[#81E4F2] text-slate-900'
                        : 'bg-slate-900 border-blue-500 text-blue-400 hover:bg-blue-500/10'
                    }`}
                    title="Instant FX"
                  >
                    <span className="text-[9px] font-bold">FX</span>
                  </button>
                )}
              </div>

              {/* Deck A */}
              <div className="absolute left-[20px] bottom-[42px]">
                <SimplifiedDeckCompact
                  currentTrack={mixerState.deckA.track}
                  isPlaying={mixerState.deckA.playing}
                  isLoading={mixerState.deckA.loading}
                  onTrackDrop={loadTrackToDeckA}
                  onPackDrop={(pack) => handlePackDrop(pack, 'A')}
                  onTrackClear={clearDeckA}
                  deck="A"
                  contentType={mixerState.deckA.contentType}
                />
              </div>

              {/* Deck A Section Navigator (Below Deck Image, left-aligned) */}
              <div className="absolute left-[20px] bottom-[18px]">
                {mixerState.deckA.contentType === 'full_song' && mixerState.deckA.loopEnabled && (() => {
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
                    />
                  );
                })()}
              </div>

              {/* Deck A Radio Play Button (Below Deck Image, left-aligned) */}
              {(mixerState.deckA.contentType === 'radio_station' || mixerState.deckA.contentType === 'grabbed_radio') && (
                <div className="absolute left-[20px] bottom-[12px] w-[72px]">
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
                    className={`w-full flex items-center justify-center gap-1 px-2 py-0.5 rounded border transition-all ${
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
                      borderColor: mixerState.deckA.contentType === 'grabbed_radio' ? '#475569' : isGrabbingDeckA ? '#ef4444' : deckARadioPlayTime >= 10 ? '#FB923C' : mixerState.deckA.playing ? '#94a3b8' : '#81E4F240',
                      color: deckARadioPlayTime >= 10 && mixerState.deckA.contentType !== 'grabbed_radio' ? '#FB923C' : undefined
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
                    <span className={mixerState.deckA.playing && !isGrabbingDeckA && deckARadioPlayTime < 10 ? "text-[9px]" : "text-[9px] font-bold"}>
                      {mixerState.deckA.contentType === 'grabbed_radio' ? 'DONE' : isGrabbingDeckA ? 'BUFFER' : deckARadioPlayTime >= 10 ? 'GRAB' : mixerState.deckA.playing ? 'buffering...' : 'PLAY'}
                    </span>
                  </button>
                </div>
              )}

              {/* Deck A FX Panel - Positioned as left sidebar overlay */}
              {mixerState.deckA.track && mixerState.deckA.fxPanelOpen && (
                <div className="absolute left-0 bottom-0 w-[160px] h-[180px] z-50">
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
                        case 'brake':
                          return controls.triggerBrake();
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
                  deck="B"
                  contentType={mixerState.deckB.contentType}
                />
              </div>

              {/* Deck B Section Navigator (Below Deck Image, right-aligned) */}
              <div className="absolute right-[20px] bottom-[18px]">
                {mixerState.deckB.contentType === 'full_song' && mixerState.deckB.loopEnabled && (() => {
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
                    />
                  );
                })()}
              </div>

              {/* Deck B Radio Play Button (Below Deck Image, right-aligned) */}
              {(mixerState.deckB.contentType === 'radio_station' || mixerState.deckB.contentType === 'grabbed_radio') && (
                <div className="absolute right-[20px] bottom-[12px] w-[72px]">
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
                    className={`w-full flex items-center justify-center gap-1 px-2 py-0.5 rounded border transition-all ${
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
                      borderColor: mixerState.deckB.contentType === 'grabbed_radio' ? '#475569' : isGrabbingDeckB ? '#ef4444' : deckBRadioPlayTime >= 10 ? '#FB923C' : mixerState.deckB.playing ? '#94a3b8' : '#81E4F240',
                      color: deckBRadioPlayTime >= 10 && mixerState.deckB.contentType !== 'grabbed_radio' ? '#FB923C' : undefined
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
                    <span className={mixerState.deckB.playing && !isGrabbingDeckB && deckBRadioPlayTime < 10 ? "text-[9px]" : "text-[9px] font-bold"}>
                      {mixerState.deckB.contentType === 'grabbed_radio' ? 'DONE' : isGrabbingDeckB ? 'BUFFER' : deckBRadioPlayTime >= 10 ? 'GRAB' : mixerState.deckB.playing ? 'buffering...' : 'PLAY'}
                    </span>
                  </button>
                </div>
              )}

              {/* Deck B FX Panel - Positioned as right sidebar overlay */}
              {mixerState.deckB.track && mixerState.deckB.fxPanelOpen && (
                <div className="absolute right-0 bottom-0 w-[160px] h-[180px] z-50">
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
                        case 'brake':
                          return controls.triggerBrake();
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
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all border-2 ${
                      mixerState.deckB.fxPanelOpen
                        ? 'bg-[#81E4F2] border-[#81E4F2] text-slate-900'
                        : 'bg-slate-900 border-blue-500 text-blue-400 hover:bg-blue-500/10'
                    }`}
                    title="Instant FX"
                  >
                    <span className="text-[9px] font-bold">FX</span>
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
    </div>
  );
}
