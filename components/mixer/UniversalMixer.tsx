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
import { Music } from 'lucide-react';

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
  };
  masterBPM: number;
  crossfaderPosition: number;
  syncActive: boolean;
}

export default function UniversalMixer({ className = "" }: UniversalMixerProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showLaunchGlow, setShowLaunchGlow] = useState(false);
  const [hasBeenMountedBefore, setHasBeenMountedBefore] = useState(false);

  // Initialize mixer state with volume controls
  const [mixerState, setMixerState] = useState<UniversalMixerState>({
    deckA: {
      track: null,
      playing: false,
      loopEnabled: true,
      loopLength: 8,
      loopPosition: 0,
      volume: 80 // Default 80%
    },
    deckB: {
      track: null,
      playing: false,
      loopEnabled: true,
      loopLength: 8,
      loopPosition: 0,
      volume: 80 // Default 80%
    },
    masterBPM: 120,
    crossfaderPosition: 50,
    syncActive: false
  });

  // Sync engine reference
  const syncEngineRef = React.useRef<SimpleLoopSync | null>(null);

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

  // Initialize audio on mount
  useEffect(() => {
    if (!audioInitialized) {
      initializeAudio();
    }
  }, []); // Empty dependency array - only run once on mount

  // Track if mixer has been mounted before (for launch glow)
  useEffect(() => {
    // Check if we've been mounted before
    const wasMountedBefore = localStorage.getItem('mixer-has-been-mounted');

    if (wasMountedBefore === 'true') {
      // This is a re-open, show the glow
      setShowLaunchGlow(true);
      const timer = setTimeout(() => {
        setShowLaunchGlow(false);
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      // First time mounting, mark it
      localStorage.setItem('mixer-has-been-mounted', 'true');
      setHasBeenMountedBefore(true);
    }
  }, []);

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

  // Determine master BPM based on content-type hierarchy
  // Priority: Loop > Song > Radio/Grabbed Radio
  const determineMasterBPM = (deckA: typeof mixerState.deckA, deckB: typeof mixerState.deckB): number => {
    const getPriority = (contentType?: string): number => {
      if (contentType === 'loop') return 3;
      if (contentType === 'full_song') return 2;
      if (contentType === 'radio_station' || contentType === 'grabbed_radio') return 1;
      return 0;
    };

    const priorityA = getPriority(deckA.contentType);
    const priorityB = getPriority(deckB.contentType);

    // Higher priority deck sets BPM
    if (priorityA > priorityB && deckA.track?.bpm) {
      console.log(`🎵 Master BPM: ${deckA.track.bpm} from Deck A (${deckA.contentType})`);
      return deckA.track.bpm;
    } else if (priorityB > priorityA && deckB.track?.bpm) {
      console.log(`🎵 Master BPM: ${deckB.track.bpm} from Deck B (${deckB.contentType})`);
      return deckB.track.bpm;
    } else if (priorityA === priorityB && deckA.track?.bpm) {
      // Same priority, use Deck A
      console.log(`🎵 Master BPM: ${deckA.track.bpm} from Deck A (same priority)`);
      return deckA.track.bpm;
    }

    // Default to 120 BPM
    console.log(`🎵 Master BPM: 120 (default)`);
    return 120;
  };

  // Clear Deck A
  const clearDeckA = () => {
    console.log('🗑️ Clearing Deck A');

    // Stop audio if playing
    if (mixerState.deckA.audioState?.audio) {
      mixerState.deckA.audioState.audio.pause();
      mixerState.deckA.audioState.audio.currentTime = 0;
    }

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

    // Stop audio if playing
    if (mixerState.deckB.audioState?.audio) {
      mixerState.deckB.audioState.audio.pause();
      mixerState.deckB.audioState.audio.currentTime = 0;
    }

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
            audioControls.setLoopLength(mixerState.deckA.loopLength);
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
            contentType,
            loopEnabled: isRadio ? false : true  // Enable looping for non-radio content
          };

          // Determine master BPM based on both decks
          const newMasterBPM = determineMasterBPM(newDeckAState, prev.deckB);

          return {
            ...prev,
            masterBPM: newMasterBPM,
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
            audioControls.setLoopLength(mixerState.deckB.loopLength);
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
            contentType,
            loopEnabled: isRadio ? false : true  // Enable looping for non-radio content
          };

          // Determine master BPM based on both decks
          const newMasterBPM = determineMasterBPM(prev.deckA, newDeckBState);

          return {
            ...prev,
            masterBPM: newMasterBPM,
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

  // Sync toggle
  const handleSync = useCallback(async () => {
    const newSyncState = !mixerState.syncActive;

    if (newSyncState && mixerState.deckA.audioState && mixerState.deckB.audioState) {
      const audioContext = mixerState.deckA.audioState.audioContext;

      syncEngineRef.current = new SimpleLoopSync(
        audioContext,
        { ...mixerState.deckA.audioState, audioControls: mixerState.deckA.audioControls, track: mixerState.deckA.track },
        { ...mixerState.deckB.audioState, audioControls: mixerState.deckB.audioControls, track: mixerState.deckB.track }
      );

      await syncEngineRef.current.enableSync();
    } else if (!newSyncState && syncEngineRef.current) {
      syncEngineRef.current.disableSync();
      syncEngineRef.current = null;
    }

    setMixerState(prev => ({ ...prev, syncActive: newSyncState }));
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

    setMixerState(prev => ({
      ...prev,
      [deckKey]: {
        ...prev[deckKey],
        loopLength: length
      }
    }));

    const audioControls = mixerState[deckKey].audioControls;
    if (audioControls && audioControls.setLoopLength) {
      audioControls.setLoopLength(length);
    }
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
  const handleRadioPlay = (deck: 'A' | 'B') => {
    console.log(`▶️ Starting radio playback for Deck ${deck}`);
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

    // Create a pseudo-track for the grabbed audio
    const grabbedTrack: Track = {
      id: `grabbed-${Date.now()}`,
      title: `Grabbed from Radio (${deck})`,
      artist: mixerState[deck === 'A' ? 'deckA' : 'deckB'].track?.artist || 'Unknown',
      imageUrl: mixerState[deck === 'A' ? 'deckA' : 'deckB'].track?.imageUrl || '',
      audioUrl: audioUrl,
      bpm: grabbedBPM,
      content_type: 'grabbed_radio', // Mark as grabbed radio, not regular loop
      price_stx: 0,
      primary_uploader_wallet: ''
    };

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

      // Set "just grabbed" state for user feedback
      if (deck === 'A') {
        setDeckAJustGrabbed(true);
        // Clear "just grabbed" state after 3 seconds
        setTimeout(() => setDeckAJustGrabbed(false), 3000);
      } else {
        setDeckBJustGrabbed(true);
        // Clear "just grabbed" state after 3 seconds
        setTimeout(() => setDeckBJustGrabbed(false), 3000);
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

  return (
    <div
      className={`universal-mixer bg-slate-900/30 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: isCollapsed ? '0.5rem 1rem' : '1.5rem',
        boxShadow: showLaunchGlow ? '0 0 20px 4px rgba(236, 132, 243, 0.6)' : undefined,
        transition: 'box-shadow 1s ease-out, padding 0.3s'
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
          {(isHovered || showLaunchGlow) && (
            <div
              className={`text-center mb-3 transition-colors duration-1000 ${
                showLaunchGlow ? 'text-white/90' : 'text-white/60'
              }`}
            >
              <p className="text-xs">Drag content to Decks to mix</p>
            </div>
          )}

          {/* Transport and Loop Controls Row */}
          <div className="flex justify-center items-center gap-16 mb-5">
            <LoopControlsCompact
              loopLength={mixerState.deckA.loopLength}
              loopEnabled={mixerState.deckA.loopEnabled}
              onLoopChange={(length) => handleLoopLengthChange('A', length)}
              onLoopToggle={() => handleLoopToggle('A')}
              color="cyan"
              disabled={!mixerState.deckA.track || mixerState.deckA.contentType === 'radio_station'}
            />

            <MasterTransportControlsCompact
              variant="simplified"
              masterBPM={mixerState.masterBPM}
              deckALoaded={!!mixerState.deckA.track}
              deckBLoaded={!!mixerState.deckB.track}
              deckAPlaying={mixerState.deckA.playing}
              deckBPlaying={mixerState.deckB.playing}
              deckABPM={mixerState.deckA.track?.bpm || mixerState.masterBPM}
              syncActive={mixerState.syncActive}
              recordingRemix={false}
              highlightPlayButton={deckAJustGrabbed || deckBJustGrabbed}
              onMasterPlay={handleMasterPlay}
              onMasterPlayAfterCountIn={handleMasterPlayAfterCountIn}
              onMasterStop={handleMasterStop}
              onRecordToggle={() => {}}
              onSyncToggle={handleSync}
              onMasterSyncReset={handleMasterSyncReset}
            />

            <LoopControlsCompact
              loopLength={mixerState.deckB.loopLength}
              loopEnabled={mixerState.deckB.loopEnabled}
              onLoopChange={(length) => handleLoopLengthChange('B', length)}
              onLoopToggle={() => handleLoopToggle('B')}
              color="cyan"
              disabled={!mixerState.deckB.track || mixerState.deckB.contentType === 'radio_station'}
            />
          </div>

          {/* Decks, Waveforms, and Crossfader Section */}
          <div className="h-[100px] relative">
            <div>
              {/* Deck A */}
              <div className="absolute left-0 bottom-[42px]">
                <SimplifiedDeckCompact
                  currentTrack={mixerState.deckA.track}
                  isPlaying={mixerState.deckA.playing}
                  isLoading={mixerState.deckA.loading}
                  onTrackDrop={loadTrackToDeckA}
                  onTrackClear={clearDeckA}
                  deck="A"
                  contentType={mixerState.deckA.contentType}
                />
                {/* Radio control button - PLAY (green) → GRAB (orange) → Done (cyan) */}
                {(mixerState.deckA.contentType === 'radio_station' || deckAJustGrabbed) && (
                  <button
                    onClick={() => {
                      if (!mixerState.deckA.playing || deckARadioPlayTime < 10) {
                        handleRadioPlay('A');
                      } else if (deckARadioPlayTime >= 10 && !deckAJustGrabbed) {
                        handleGrab('A');
                      }
                    }}
                    disabled={isGrabbingDeckA || deckAJustGrabbed}
                    className={`absolute -bottom-8 left-1/2 transform -translate-x-1/2 w-[32px] h-[18px] flex items-center justify-center text-[9px] font-bold tracking-wider rounded border transition-all duration-200 hover:scale-105 shadow-lg ${
                      deckAJustGrabbed
                        ? 'bg-[#81E4F2] border-[#81E4F2] text-slate-900 cursor-default'
                        : isGrabbingDeckA
                        ? 'bg-red-600 border-red-400 text-white animate-pulse cursor-wait'
                        : deckARadioPlayTime >= 10
                        ? 'bg-gradient-to-br from-orange-600 to-orange-700 border-orange-400/50 text-white hover:from-orange-500 hover:to-orange-600'
                        : 'bg-gradient-to-br from-green-600 to-green-700 border-green-400/50 text-white hover:from-green-500 hover:to-green-600'
                    }`}
                    title={
                      deckAJustGrabbed
                        ? 'Grabbed! Now press play in the transport'
                        : isGrabbingDeckA
                        ? 'Grabbing audio...'
                        : deckARadioPlayTime >= 10
                        ? 'Grab audio from radio'
                        : 'Start radio playback'
                    }
                  >
                    {deckAJustGrabbed ? 'DONE' : isGrabbingDeckA ? 'REC' : deckARadioPlayTime >= 10 ? 'GRAB' : 'PLAY'}
                  </button>
                )}
              </div>

              {/* Waveforms */}
              <div className="absolute left-[76px] bottom-[48px]" style={{ width: '448px' }}>
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
                      width={448}
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
                    width={448}
                    height={28}
                    waveformColor="#FF6B6B"
                    className="border border-blue-500/30"
                  />
                </div>
              </div>

              {/* Deck B */}
              <div className="absolute right-0 bottom-[42px]">
                <SimplifiedDeckCompact
                  currentTrack={mixerState.deckB.track}
                  isPlaying={mixerState.deckB.playing}
                  isLoading={mixerState.deckB.loading}
                  onTrackDrop={loadTrackToDeckB}
                  onTrackClear={clearDeckB}
                  deck="B"
                  contentType={mixerState.deckB.contentType}
                />
                {/* Radio control button - PLAY (green) → GRAB (orange) → Done (cyan) */}
                {(mixerState.deckB.contentType === 'radio_station' || deckBJustGrabbed) && (
                  <button
                    onClick={() => {
                      if (!mixerState.deckB.playing || deckBRadioPlayTime < 10) {
                        handleRadioPlay('B');
                      } else if (deckBRadioPlayTime >= 10 && !deckBJustGrabbed) {
                        handleGrab('B');
                      }
                    }}
                    disabled={isGrabbingDeckB || deckBJustGrabbed}
                    className={`absolute -bottom-8 left-1/2 transform -translate-x-1/2 w-[32px] h-[18px] flex items-center justify-center text-[9px] font-bold tracking-wider rounded border transition-all duration-200 hover:scale-105 shadow-lg ${
                      deckBJustGrabbed
                        ? 'bg-[#81E4F2] border-[#81E4F2] text-slate-900 cursor-default'
                        : isGrabbingDeckB
                        ? 'bg-red-600 border-red-400 text-white animate-pulse cursor-wait'
                        : deckBRadioPlayTime >= 10
                        ? 'bg-gradient-to-br from-orange-600 to-orange-700 border-orange-400/50 text-white hover:from-orange-500 hover:to-orange-600'
                        : 'bg-gradient-to-br from-green-600 to-green-700 border-green-400/50 text-white hover:from-green-500 hover:to-green-600'
                    }`}
                    title={
                      deckBJustGrabbed
                        ? 'Grabbed! Now press play in the transport'
                        : isGrabbingDeckB
                        ? 'Grabbing audio...'
                        : deckBRadioPlayTime >= 10
                        ? 'Grab audio from radio'
                        : 'Start radio playback'
                    }
                  >
                    {deckBJustGrabbed ? 'DONE' : isGrabbingDeckB ? 'REC' : deckBRadioPlayTime >= 10 ? 'GRAB' : 'PLAY'}
                  </button>
                )}
              </div>
            </div>

            {/* Volume Controls and Crossfader */}
            <div className="absolute left-[76px] bottom-0" style={{ width: '448px' }}>
              <div className="flex items-center justify-center gap-3">
                {/* Deck A Volume */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-cyan-400/70 font-mono">VOL A</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={mixerState.deckA.volume}
                    onChange={(e) => handleDeckAVolumeChange(Number(e.target.value))}
                    className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-3
                      [&::-webkit-slider-thumb]:h-3
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-cyan-400
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-3
                      [&::-moz-range-thumb]:h-3
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-cyan-400
                      [&::-moz-range-thumb]:border-0
                      [&::-moz-range-thumb]:cursor-pointer"
                    disabled={!mixerState.deckA.track}
                  />
                </div>

                {/* Crossfader */}
                <div className="w-[200px]">
                  <CrossfaderControlCompact
                    position={mixerState.crossfaderPosition}
                    onPositionChange={handleCrossfaderChange}
                  />
                </div>

                {/* Deck B Volume */}
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={mixerState.deckB.volume}
                    onChange={(e) => handleDeckBVolumeChange(Number(e.target.value))}
                    className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-3
                      [&::-webkit-slider-thumb]:h-3
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-blue-400
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-3
                      [&::-moz-range-thumb]:h-3
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-blue-400
                      [&::-moz-range-thumb]:border-0
                      [&::-moz-range-thumb]:cursor-pointer"
                    disabled={!mixerState.deckB.track}
                  />
                  <span className="text-[10px] text-blue-400/70 font-mono">VOL B</span>
                </div>
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
