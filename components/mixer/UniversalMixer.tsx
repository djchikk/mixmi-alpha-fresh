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
import { Music, Radio } from 'lucide-react';
import { useMixer } from '@/contexts/MixerContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { IPTrack } from '@/types';

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
  masterDeck: 'A' | 'B' | null; // Which deck is tempo master (null = auto-determined by priority)
}

// Helper function to format time in MM:SS
const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function UniversalMixer({ className = "" }: UniversalMixerProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

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
    syncActive: false,
    masterDeck: null // Auto-determined initially
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

  // Use mixer context for crate (collection) management
  const { addTrackToCollection } = useMixer();

  // Use toast for notifications
  const { showToast } = useToast();

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

  // Check if content type is eligible to be tempo master
  const isMasterEligible = (contentType?: string): boolean => {
    return contentType === 'loop' || contentType === 'full_song';
  };

  // Determine master BPM based on content-type hierarchy and user selection
  // Priority: Loop (3) > Song (2) > Radio/Grabbed Radio (1)
  // If both decks have same priority, user can select master via masterDeck
  const determineMasterBPM = (
    deckA: typeof mixerState.deckA,
    deckB: typeof mixerState.deckB,
    masterDeckSelection: 'A' | 'B' | null = null
  ): number => {
    const getPriority = (contentType?: string): number => {
      if (contentType === 'loop') return 3;
      if (contentType === 'full_song') return 2;
      if (contentType === 'radio_station' || contentType === 'grabbed_radio') return 1;
      return 0;
    };

    const priorityA = getPriority(deckA.contentType);
    const priorityB = getPriority(deckB.contentType);

    // If user has explicitly selected a master deck, and it's master-eligible, use it
    if (masterDeckSelection === 'A' && isMasterEligible(deckA.contentType) && deckA.track?.bpm) {
      console.log(`🎵 Master BPM: ${deckA.track.bpm} from Deck A (user selected)`);
      return deckA.track.bpm;
    }
    if (masterDeckSelection === 'B' && isMasterEligible(deckB.contentType) && deckB.track?.bpm) {
      console.log(`🎵 Master BPM: ${deckB.track.bpm} from Deck B (user selected)`);
      return deckB.track.bpm;
    }

    // Otherwise, use priority system
    if (priorityA > priorityB && deckA.track?.bpm) {
      console.log(`🎵 Master BPM: ${deckA.track.bpm} from Deck A (${deckA.contentType})`);
      return deckA.track.bpm;
    } else if (priorityB > priorityA && deckB.track?.bpm) {
      console.log(`🎵 Master BPM: ${deckB.track.bpm} from Deck B (${deckB.contentType})`);
      return deckB.track.bpm;
    } else if (priorityA === priorityB && deckA.track?.bpm) {
      // Same priority, default to Deck A (unless user selected B)
      console.log(`🎵 Master BPM: ${deckA.track.bpm} from Deck A (same priority)`);
      return deckA.track.bpm;
    }

    // Default to 120 BPM (e.g., Radio + Radio)
    console.log(`🎵 Master BPM: 120 (default)`);
    return 120;
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

    setMixerState(prev => {
      // Reset masterDeck if Deck A was master or if neither deck will be eligible
      const shouldResetMaster = prev.masterDeck === 'A' || !isMasterEligible(prev.deckB.contentType);
      const newMasterDeck = shouldResetMaster ? null : prev.masterDeck;
      const newMasterBPM = shouldResetMaster ? 120 : prev.masterBPM;

      if (shouldResetMaster) {
        console.log('🔄 Reset masterDeck: Deck A cleared');
      }

      return {
        ...prev,
        masterDeck: newMasterDeck,
        masterBPM: newMasterBPM,
        deckA: {
          ...prev.deckA,
          track: null,
          playing: false,
          loading: false,
          audioState: undefined,
          audioControls: undefined
        }
      };
    });
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

    setMixerState(prev => {
      // Reset masterDeck if Deck B was master or if neither deck will be eligible
      const shouldResetMaster = prev.masterDeck === 'B' || !isMasterEligible(prev.deckA.contentType);
      const newMasterDeck = shouldResetMaster ? null : prev.masterDeck;
      const newMasterBPM = shouldResetMaster ? 120 : prev.masterBPM;

      if (shouldResetMaster) {
        console.log('🔄 Reset masterDeck: Deck B cleared');
      }

      return {
        ...prev,
        masterDeck: newMasterDeck,
        masterBPM: newMasterBPM,
        deckB: {
          ...prev.deckB,
          track: null,
          playing: false,
          loading: false,
          audioState: undefined,
          audioControls: undefined
        }
      };
    });
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
        const isSong = contentType === 'full_song';

        // Configure looping based on content type
        if (audioControls) {
          if (isRadio) {
            // Radio: no looping (continuous stream)
            audioControls.setLoopEnabled(false);
            console.log('📻 Radio station: looping disabled');
          } else if (isSong) {
            // Songs: no looping (play to end)
            audioControls.setLoopEnabled(false);
            console.log('🎵 Song: looping disabled (will play to end)');
          } else {
            // Loops and grabbed radio: enable looping
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

        // For songs, add 'ended' event listener to stop playback when finished
        if (isSong && audioState.audio) {
          audioState.audio.addEventListener('ended', () => {
            console.log('🎵 Song finished playing');
            setMixerState(prev => ({
              ...prev,
              deckA: { ...prev.deckA, playing: false }
            }));
          });
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

          // Determine master deck state
          let newMasterDeck = prev.masterDeck;

          // Reset masterDeck if neither deck is master-eligible
          if (!isMasterEligible(newDeckAState.contentType) && !isMasterEligible(prev.deckB.contentType)) {
            newMasterDeck = null;
            console.log('🔄 Reset masterDeck: neither deck is master-eligible');
          }
          // Auto-set master deck if both are master-eligible and masterDeck not yet set
          else if (prev.masterDeck === null && isMasterEligible(newDeckAState.contentType) && isMasterEligible(prev.deckB.contentType)) {
            newMasterDeck = 'A';
            console.log('🎚️ Auto-set masterDeck to A: both decks master-eligible');
          }
          // Reset masterDeck if it was pointing to this deck but new content is not eligible
          else if (prev.masterDeck === 'A' && !isMasterEligible(newDeckAState.contentType)) {
            newMasterDeck = null;
            console.log('🔄 Reset masterDeck: Deck A no longer master-eligible');
          }

          // Determine master BPM based on both decks
          const newMasterBPM = determineMasterBPM(newDeckAState, prev.deckB, newMasterDeck);

          return {
            ...prev,
            masterBPM: newMasterBPM,
            masterDeck: newMasterDeck,
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
        const isSong = contentType === 'full_song';

        // Configure looping based on content type
        if (audioControls) {
          if (isRadio) {
            // Radio: no looping (continuous stream)
            audioControls.setLoopEnabled(false);
            console.log('📻 Radio station: looping disabled');
          } else if (isSong) {
            // Songs: no looping (play to end)
            audioControls.setLoopEnabled(false);
            console.log('🎵 Song: looping disabled (will play to end)');
          } else {
            // Loops and grabbed radio: enable looping
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

        // For songs, add 'ended' event listener to stop playback when finished
        if (isSong && audioState.audio) {
          audioState.audio.addEventListener('ended', () => {
            console.log('🎵 Song finished playing');
            setMixerState(prev => ({
              ...prev,
              deckB: { ...prev.deckB, playing: false }
            }));
          });
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

          // Determine master deck state
          let newMasterDeck = prev.masterDeck;

          // Reset masterDeck if neither deck is master-eligible
          if (!isMasterEligible(prev.deckA.contentType) && !isMasterEligible(newDeckBState.contentType)) {
            newMasterDeck = null;
            console.log('🔄 Reset masterDeck: neither deck is master-eligible');
          }
          // Auto-set master deck if both are master-eligible and masterDeck not yet set
          else if (prev.masterDeck === null && isMasterEligible(prev.deckA.contentType) && isMasterEligible(newDeckBState.contentType)) {
            newMasterDeck = 'A';
            console.log('🎚️ Auto-set masterDeck to A: both decks master-eligible');
          }
          // Reset masterDeck if it was pointing to this deck but new content is not eligible
          else if (prev.masterDeck === 'B' && !isMasterEligible(newDeckBState.contentType)) {
            newMasterDeck = null;
            console.log('🔄 Reset masterDeck: Deck B no longer master-eligible');
          }

          // Determine master BPM based on both decks
          const newMasterBPM = determineMasterBPM(prev.deckA, newDeckBState, newMasterDeck);

          return {
            ...prev,
            masterBPM: newMasterBPM,
            masterDeck: newMasterDeck,
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
  const handlePackDrop = async (packTrack: any, deck: 'A' | 'B') => {
    console.log(`📦 Adding pack to crate with auto-expand:`, packTrack);

    try {
      // Determine what type of content to fetch
      const contentTypeToFetch = packTrack.content_type === 'loop_pack' ? 'loop'
        : packTrack.content_type === 'station_pack' ? 'radio_station'
        : 'full_song';

      const packId = packTrack.pack_id || packTrack.id.split('-loc-')[0];

      // Fetch child tracks to load first one to deck
      const { data, error } = await supabase
        .from('ip_tracks')
        .select('*')
        .eq('pack_id', packId)
        .eq('content_type', contentTypeToFetch)
        .order('pack_position', { ascending: true });

      if (error) {
        console.error('❌ Error fetching pack contents:', error);
        showToast('Failed to load pack contents', 'error');
        return;
      }

      if (!data || data.length === 0) {
        console.warn('⚠️ No tracks found in pack');
        showToast('No tracks found in pack', 'warning');
        return;
      }

      console.log(`✅ Found ${data.length} tracks in pack`);

      // Add the pack container to the crate (not individual tracks)
      console.log(`📦 Adding pack container to crate:`, packTrack.title);
      addTrackToCollection(packTrack);

      // Auto-expand the pack in the crate - wait for next render cycle
      if ((window as any).expandPackInCrate) {
        console.log(`🎯 Triggering auto-expand for pack:`, packTrack.id);

        // Use requestAnimationFrame for reliable timing after render
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Double RAF ensures DOM is fully updated
            try {
              if ((window as any).expandPackInCrate) {
                (window as any).expandPackInCrate(packTrack);
              } else {
                console.warn('⚠️ expandPackInCrate not available');
              }
            } catch (error) {
              console.error('❌ Failed to auto-expand pack:', error);
            }
          });
        });
      }

      // Load the first track to the deck
      const firstTrack = data[0];
      const loadFunction = deck === 'A' ? loadTrackToDeckA : loadTrackToDeckB;

      // Convert IPTrack to Track format
      const mixerTrack: Track = {
        id: firstTrack.id,
        title: firstTrack.title,
        artist: firstTrack.artist || 'Unknown Artist',
        imageUrl: firstTrack.cover_image_url || '',
        audioUrl: contentTypeToFetch === 'radio_station'
          ? ((firstTrack as any).stream_url || firstTrack.audio_url)
          : firstTrack.audio_url,
        bpm: firstTrack.bpm || 120,
        content_type: firstTrack.content_type,
        pack_position: firstTrack.pack_position
      };

      await loadFunction(mixerTrack);

      // Show success toast
      const emoji = packTrack.content_type === 'station_pack' ? '📻'
        : packTrack.content_type === 'ep' ? '🎵'
        : '🔁';
      const itemName = packTrack.content_type === 'station_pack' ? 'stations'
        : packTrack.content_type === 'ep' ? 'tracks'
        : 'loops';

      showToast(`${emoji} ${data.length} ${itemName} unpacked to crate!`, 'success');

    } catch (error) {
      console.error('❌ Error unpacking pack:', error);
      showToast('Failed to unpack content', 'error');
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
      // Check if both decks are radio/non-master-eligible
      const deckAEligible = isMasterEligible(mixerState.deckA.contentType);
      const deckBEligible = isMasterEligible(mixerState.deckB.contentType);

      if (!deckAEligible && !deckBEligible) {
        // Both are radio or other non-master content - cannot sync
        console.warn(`⚠️ Cannot sync: neither deck has master-eligible content (loop or song)`);
        showToast('⚠️ Cannot sync radio streams', 'warning');
        return;
      }

      const deckAIsSong = mixerState.deckA.contentType === 'full_song';
      const deckBIsSong = mixerState.deckB.contentType === 'full_song';
      const deckAIsLoop = mixerState.deckA.contentType === 'loop';
      const deckBIsLoop = mixerState.deckB.contentType === 'loop';

      // Handle song + loop sync (time-stretch song to match loop)
      if ((deckAIsSong && deckBIsLoop) || (deckBIsSong && deckAIsLoop)) {
        const songDeck = deckAIsSong ? 'A' : 'B';
        const loopDeck = deckAIsLoop ? 'A' : 'B';

        const songState = songDeck === 'A' ? mixerState.deckA : mixerState.deckB;
        const loopState = loopDeck === 'A' ? mixerState.deckA : mixerState.deckB;

        const songBPM = songState.track?.bpm;
        const loopBPM = loopState.track?.bpm;

        if (!songBPM) {
          // Song has no BPM - show warning
          console.warn(`⚠️ Song has no BPM metadata, cannot sync`);
          showToast('⚠️ Song has no BPM and cannot sync', 'warning');
          return; // Don't enable sync
        }

        if (songBPM && loopBPM) {
          // Time-stretch song to match loop BPM
          const playbackRate = loopBPM / songBPM;

          if (songState.audioState?.audio) {
            songState.audioState.audio.playbackRate = playbackRate;
            console.log(`🎵 Song synced: ${songBPM} BPM → ${loopBPM} BPM (${playbackRate.toFixed(3)}x)`);
            showToast(`🎵 Synced to ${loopBPM} BPM (${playbackRate.toFixed(2)}x)`, 'success');
          }
        }
      } else if (!deckAIsSong && !deckBIsSong) {
        // Both are loops - use existing loop sync
        // Respect master deck order: master first, slave second
        const masterDeck = mixerState.masterDeck || 'A'; // Default to A if not set
        const audioContext = mixerState.deckA.audioState.audioContext;

        const masterDeckState = masterDeck === 'A' ? mixerState.deckA : mixerState.deckB;
        const slaveDeckState = masterDeck === 'A' ? mixerState.deckB : mixerState.deckA;

        syncEngineRef.current = new SimpleLoopSync(
          audioContext,
          { ...masterDeckState.audioState, audioControls: masterDeckState.audioControls, track: masterDeckState.track },
          { ...slaveDeckState.audioState, audioControls: slaveDeckState.audioControls, track: slaveDeckState.track }
        );

        await syncEngineRef.current.enableSync();
        console.log(`🔄 Loop sync enabled: Deck ${masterDeck} is master`);
      } else if (deckAIsSong && deckBIsSong) {
        // Both are songs - sync to master deck's BPM
        const masterDeck = mixerState.masterDeck || 'A'; // Default to A if not set
        const slaveDeck = masterDeck === 'A' ? 'B' : 'A';

        const masterState = masterDeck === 'A' ? mixerState.deckA : mixerState.deckB;
        const slaveState = slaveDeck === 'A' ? mixerState.deckA : mixerState.deckB;

        const masterBPM = masterState.track?.bpm;
        const slaveBPM = slaveState.track?.bpm;

        if (!masterBPM || !slaveBPM) {
          console.warn(`⚠️ One or both songs have no BPM metadata`);
          showToast('⚠️ Songs have no BPM and cannot sync', 'warning');
          return;
        }

        const playbackRate = masterBPM / slaveBPM;
        if (slaveState.audioState?.audio) {
          slaveState.audioState.audio.playbackRate = playbackRate;
          console.log(`🎵 Deck ${slaveDeck} song synced to Deck ${masterDeck}: ${slaveBPM} BPM → ${masterBPM} BPM (${playbackRate.toFixed(3)}x)`);
          showToast(`🎵 Songs synced to ${masterBPM} BPM (Deck ${masterDeck} master)`, 'success');
        }
      }
    } else if (!newSyncState) {
      // Disable sync - reset playback rates
      if (mixerState.deckA.contentType === 'full_song' && mixerState.deckA.audioState?.audio) {
        mixerState.deckA.audioState.audio.playbackRate = 1.0;
        console.log('🎵 Deck A song playback rate reset to 1.0x');
      }
      if (mixerState.deckB.contentType === 'full_song' && mixerState.deckB.audioState?.audio) {
        mixerState.deckB.audioState.audio.playbackRate = 1.0;
        console.log('🎵 Deck B song playback rate reset to 1.0x');
      }

      if (syncEngineRef.current) {
        syncEngineRef.current.disableSync();
        syncEngineRef.current = null;
      }
    }

    setMixerState(prev => ({ ...prev, syncActive: newSyncState }));
  }, [mixerState, showToast]);

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

  // Toggle master deck selection
  const handleMasterDeckToggle = async () => {
    const currentSyncActive = mixerState.syncActive;
    const deckAIsLoop = mixerState.deckA.contentType === 'loop';
    const deckBIsLoop = mixerState.deckB.contentType === 'loop';
    const bothAreLoops = deckAIsLoop && deckBIsLoop;

    // Calculate new master deck before state update
    const newMasterDeck = mixerState.masterDeck === 'A' ? 'B' : 'A';

    setMixerState(prev => {
      // Recalculate master BPM with new selection
      const newMasterBPM = determineMasterBPM(prev.deckA, prev.deckB, newMasterDeck);

      console.log(`🎚️ Master deck toggled to: ${newMasterDeck}`);

      // If SYNC is active, need to re-sync to new master
      if (prev.syncActive) {
        const masterState = newMasterDeck === 'A' ? prev.deckA : prev.deckB;
        const slaveState = newMasterDeck === 'A' ? prev.deckB : prev.deckA;

        const masterBPM = masterState.track?.bpm;
        const slaveBPM = slaveState.track?.bpm;

        // Re-apply sync with new master (for songs)
        if (slaveState.contentType === 'full_song' && masterBPM && slaveBPM && slaveState.audioState?.audio) {
          const playbackRate = masterBPM / slaveBPM;
          slaveState.audioState.audio.playbackRate = playbackRate;
          console.log(`🎵 Re-synced to new master: ${slaveBPM} BPM → ${masterBPM} BPM (${playbackRate.toFixed(3)}x)`);
        }
      }

      return {
        ...prev,
        masterDeck: newMasterDeck,
        masterBPM: newMasterBPM
      };
    });

    // For loops, we need to re-create the SimpleLoopSync engine with new master
    if (currentSyncActive && bothAreLoops && mixerState.deckA.audioState && mixerState.deckB.audioState) {
      // Disable current sync
      if (syncEngineRef.current) {
        syncEngineRef.current.disableSync();
        syncEngineRef.current = null;
      }

      // Re-create sync with new master order
      const audioContext = mixerState.deckA.audioState.audioContext;

      // Pass decks in order: master first, slave second
      const masterDeckState = newMasterDeck === 'A' ? mixerState.deckA : mixerState.deckB;
      const slaveDeckState = newMasterDeck === 'A' ? mixerState.deckB : mixerState.deckA;

      syncEngineRef.current = new SimpleLoopSync(
        audioContext,
        { ...masterDeckState.audioState, audioControls: masterDeckState.audioControls, track: masterDeckState.track },
        { ...slaveDeckState.audioState, audioControls: slaveDeckState.audioControls, track: slaveDeckState.track }
      );

      await syncEngineRef.current.enableSync();
      console.log(`🔄 Re-synced loops: Deck ${newMasterDeck} is now master`);
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
          <div className="flex justify-center items-center gap-16 mb-5">
            {/* Deck A Controls - Fixed width container to prevent shifting */}
            <div className="w-[100px] flex justify-center">
              {(mixerState.deckA.contentType === 'radio_station' || deckAJustGrabbed) ? (
                <button
                  onClick={() => {
                    if (!mixerState.deckA.playing || deckARadioPlayTime < 10) {
                      handleRadioPlay('A');
                    } else if (deckARadioPlayTime >= 10 && !deckAJustGrabbed) {
                      handleGrab('A');
                    }
                  }}
                  disabled={isGrabbingDeckA || deckAJustGrabbed}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-wider rounded-full border transition-all duration-200 hover:scale-105 shadow-lg ${
                    deckAJustGrabbed
                      ? 'bg-[#81E4F2] border-[#81E4F2] text-slate-900 cursor-default'
                      : isGrabbingDeckA
                      ? 'bg-red-600 border-red-400 text-white animate-pulse cursor-wait'
                      : deckARadioPlayTime >= 10
                      ? 'bg-gradient-to-br from-orange-600 to-orange-700 border-orange-400/50 text-white hover:from-orange-500 hover:to-orange-600'
                      : 'bg-[#81E4F2] border-[#81E4F2] text-slate-900 hover:bg-[#81E4F2]/90'
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
                  <Radio size={12} />
                  <span>{deckAJustGrabbed ? 'DONE' : isGrabbingDeckA ? 'REC' : deckARadioPlayTime >= 10 ? 'GRAB' : 'PLAY'}</span>
                </button>
              ) : mixerState.deckA.contentType === 'full_song' ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="text-[10px] font-mono text-gray-400">
                    {formatTime(mixerState.deckA.audioState?.currentTime || 0)} / {formatTime(mixerState.deckA.audioState?.audio?.duration || 0)}
                  </div>
                  {mixerState.syncActive && mixerState.deckA.audioState?.audio && (
                    <div className="text-[9px] font-bold text-cyan-400">
                      {mixerState.deckA.audioState.audio.playbackRate.toFixed(2)}x
                    </div>
                  )}
                </div>
              ) : (
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

            {/* Master Deck Selector - only show when both decks are master-eligible */}
            {isMasterEligible(mixerState.deckA.contentType) && isMasterEligible(mixerState.deckB.contentType) && (
              <div className="absolute" style={{ top: '60px', left: '50%', transform: 'translateX(-50%)' }}>
                <button
                  onClick={handleMasterDeckToggle}
                  className="flex items-center gap-1 px-2 py-0.5 bg-gray-900/50 border border-gray-700 rounded hover:border-cyan-500 transition-all"
                  title="Toggle master deck"
                >
                  <span className={`text-[9px] font-bold transition-colors ${mixerState.masterDeck === 'A' ? 'text-cyan-400' : 'text-gray-600'}`}>
                    A
                  </span>
                  <span className="text-[8px] text-gray-500">Master</span>
                  <span className={`text-[9px] font-bold transition-colors ${mixerState.masterDeck === 'B' ? 'text-cyan-400' : 'text-gray-600'}`}>
                    B
                  </span>
                </button>
              </div>
            )}

            {/* Deck B Controls - Fixed width container to prevent shifting */}
            <div className="w-[100px] flex justify-center">
              {(mixerState.deckB.contentType === 'radio_station' || deckBJustGrabbed) ? (
                <button
                  onClick={() => {
                    if (!mixerState.deckB.playing || deckBRadioPlayTime < 10) {
                      handleRadioPlay('B');
                    } else if (deckBRadioPlayTime >= 10 && !deckBJustGrabbed) {
                      handleGrab('B');
                    }
                  }}
                  disabled={isGrabbingDeckB || deckBJustGrabbed}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-wider rounded-full border transition-all duration-200 hover:scale-105 shadow-lg ${
                    deckBJustGrabbed
                      ? 'bg-[#81E4F2] border-[#81E4F2] text-slate-900 cursor-default'
                      : isGrabbingDeckB
                      ? 'bg-red-600 border-red-400 text-white animate-pulse cursor-wait'
                      : deckBRadioPlayTime >= 10
                      ? 'bg-gradient-to-br from-orange-600 to-orange-700 border-orange-400/50 text-white hover:from-orange-500 hover:to-orange-600'
                      : 'bg-[#81E4F2] border-[#81E4F2] text-slate-900 hover:bg-[#81E4F2]/90'
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
                  <Radio size={12} />
                  <span>{deckBJustGrabbed ? 'DONE' : isGrabbingDeckB ? 'REC' : deckBRadioPlayTime >= 10 ? 'GRAB' : 'PLAY'}</span>
                </button>
              ) : mixerState.deckB.contentType === 'full_song' ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="text-[10px] font-mono text-gray-400">
                    {formatTime(mixerState.deckB.audioState?.currentTime || 0)} / {formatTime(mixerState.deckB.audioState?.audio?.duration || 0)}
                  </div>
                  {mixerState.syncActive && mixerState.deckB.audioState?.audio && (
                    <div className="text-[9px] font-bold text-cyan-400">
                      {mixerState.deckB.audioState.audio.playbackRate.toFixed(2)}x
                    </div>
                  )}
                </div>
              ) : (
                <LoopControlsCompact
                  loopLength={mixerState.deckB.loopLength}
                  loopEnabled={mixerState.deckB.loopEnabled}
                  onLoopChange={(length) => handleLoopLengthChange('B', length)}
                  onLoopToggle={() => handleLoopToggle('B')}
                  color="cyan"
                  disabled={!mixerState.deckB.track}
                />
              )}
            </div>
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
                  onPackDrop={(pack) => handlePackDrop(pack, 'A')}
                  onTrackClear={clearDeckA}
                  deck="A"
                  contentType={mixerState.deckA.contentType}
                />
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
                  onPackDrop={(pack) => handlePackDrop(pack, 'B')}
                  onTrackClear={clearDeckB}
                  deck="B"
                  contentType={mixerState.deckB.contentType}
                />
              </div>
            </div>

            {/* Volume Controls and Crossfader */}
            <div className="absolute left-[76px] bottom-0" style={{ width: '448px' }}>
              <div className="flex items-center justify-center gap-3">
                {/* Deck A Volume */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-mono">VOL A</span>
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
                      [&::-webkit-slider-thumb]:bg-gray-300
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-3
                      [&::-moz-range-thumb]:h-3
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-gray-300
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
                      [&::-webkit-slider-thumb]:bg-gray-300
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-3
                      [&::-moz-range-thumb]:h-3
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-gray-300
                      [&::-moz-range-thumb]:border-0
                      [&::-moz-range-thumb]:cursor-pointer"
                    disabled={!mixerState.deckB.track}
                  />
                  <span className="text-[10px] text-gray-400 font-mono">VOL B</span>
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
