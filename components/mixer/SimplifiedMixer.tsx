"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Track } from './types';
import { useMixerAudio } from '@/hooks/useMixerAudio';
import { useMixer } from '@/contexts/MixerContext';
import { supabase } from '@/lib/supabase';
import { applyCrossfader, SimpleLoopSync, getAudioContext, getMasterGain } from '@/lib/mixerAudio';
import { AudioTiming } from '@/lib/audioTiming';
import SimplifiedDeck from './SimplifiedDeck';
import WaveformDisplay from './WaveformDisplay';
import CrossfaderControl from './CrossfaderControl';
import MasterTransportControls from './MasterTransportControls';
import LoopControls from './LoopControls';
import FXComponent from './FXComponent';
import DeckCrate from './DeckCrate';
import RecordingPreview from './RecordingPreview';

interface SimplifiedMixerProps {
  className?: string;
}

// Simplified mixer state - just the essentials
interface SimplifiedMixerState {
  deckA: {
    track: Track | null;
    playing: boolean;
    audioState?: any;
    audioControls?: any;
    loading?: boolean;
    loopEnabled: boolean;
    loopLength: number;
    loopPosition: number;
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
  };
  masterBPM: number;
  crossfaderPosition: number;
  syncActive: boolean;
}

// Recording state
interface RecordingState {
  isRecording: boolean;
  recordingStartTime: number | null; // AudioContext.currentTime when recording starts
  barsRecorded: number;
  targetBars: number; // Safety limit (120 bars = ~15 min at 120 BPM)
  recordedUrl: string | null;
  recordedDuration: number | null;
  showPreview: boolean;
}

export default function SimplifiedMixer({ className = "" }: SimplifiedMixerProps) {
  // Initialize simplified mixer state
  const [mixerState, setMixerState] = useState<SimplifiedMixerState>({
    deckA: { 
      track: null, 
      playing: false,
      loopEnabled: true,
      loopLength: 8,
      loopPosition: 0
    },
    deckB: { 
      track: null, 
      playing: false,
      loopEnabled: true,
      loopLength: 8,
      loopPosition: 0
    },
    masterBPM: 120,
    crossfaderPosition: 50,
    syncActive: false
  });

  // Sync engine reference
  const syncEngineRef = React.useRef<SimpleLoopSync | null>(null);

  // Recording state and refs
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    recordingStartTime: null,
    barsRecorded: 0,
    targetBars: 120, // Safety limit: auto-stop at 120 bars (~15 min at 120 BPM)
    recordedUrl: null,
    recordedDuration: null,
    showPreview: false
  });
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const recordedChunksRef = React.useRef<Blob[]>([]);
  const mixerDestinationRef = React.useRef<MediaStreamAudioDestinationNode | null>(null);

  // Responsive waveform width based on breakpoints
  const [waveformWidth, setWaveformWidth] = useState(700);

  // Username state for linking to creator pages
  const [deckAUsername, setDeckAUsername] = useState<string | null>(null);
  const [deckBUsername, setDeckBUsername] = useState<string | null>(null);

  useEffect(() => {
    const updateWaveformWidth = () => {
      const width = window.innerWidth;
      if (width >= 1280) {
        setWaveformWidth(700); // Desktop: xl breakpoint
      } else if (width >= 1024) {
        setWaveformWidth(600); // Laptop: lg breakpoint
      } else if (width >= 768) {
        setWaveformWidth(500); // Tablet: md breakpoint
      } else {
        setWaveformWidth(400); // Mobile: sm breakpoint
      }
    };

    updateWaveformWidth();
    window.addEventListener('resize', updateWaveformWidth);
    return () => window.removeEventListener('resize', updateWaveformWidth);
  }, []);

  // Fetch username for Deck A track
  useEffect(() => {
    const fetchUsername = async () => {
      if (!mixerState.deckA.track?.primary_uploader_wallet) {
        setDeckAUsername(null);
        return;
      }

      const { data } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('wallet_address', mixerState.deckA.track.primary_uploader_wallet)
        .single();

      setDeckAUsername(data?.username || null);
    };

    fetchUsername();
  }, [mixerState.deckA.track?.primary_uploader_wallet]);

  // Fetch username for Deck B track
  useEffect(() => {
    const fetchUsername = async () => {
      if (!mixerState.deckB.track?.primary_uploader_wallet) {
        setDeckBUsername(null);
        return;
      }

      const { data } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('wallet_address', mixerState.deckB.track.primary_uploader_wallet)
        .single();

      setDeckBUsername(data?.username || null);
    };

    fetchUsername();
  }, [mixerState.deckB.track?.primary_uploader_wallet]);

  // FX Component refs
  const deckAFXRef = React.useRef<HTMLDivElement>(null);
  const deckBFXRef = React.useRef<HTMLDivElement>(null);

  // Use the mixer audio hook
  const {
    audioInitialized,
    crossfaderGainRef,
    initializeAudio,
    cleanupDeckAudio,
    loadAudioForDeck
  } = useMixerAudio();

  // Use the mixer context for loaded tracks
  const { addLoadedTrack, clearLoadedTracks } = useMixer();

  // Initialize audio on mount
  useEffect(() => {
    if (!audioInitialized) {
      initializeAudio();
    }
  }, []); // Empty dependency array - only run once on mount

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

  // Load track to Deck A
  const loadTrackToDeckA = async (track: Track) => {
    console.log('🎵 SimplifiedMixer: Loading track to Deck A:', track);

    if (mixerState.deckA.loading) {
      console.log('⚠️ Deck A already loading, skipping');
      return;
    }

    // Ensure we have audioUrl
    if (!track.audioUrl) {
      console.error('❌ Track missing audioUrl:', track);
      return;
    }

    // Fetch full track data including attribution splits
    // We'll replace the existing Deck A track in loadedTracks
    try {
      const { data, error } = await supabase
        .from('ip_tracks')
        .select('*')
        .eq('id', track.id)
        .single();

      if (!error && data) {
        // Add full IPTrack data to loadedTracks for remix split calculations
        // Note: addLoadedTrack already checks for duplicates by ID
        addLoadedTrack(data as any);
        console.log(`📊 Deck A track loaded with full data:`, {
          id: data.id,
          title: data.title,
          remix_depth: data.remix_depth || 0,
          hasCompositionSplits: !!(data.composition_split_1_wallet),
          hasProductionSplits: !!(data.production_split_1_wallet)
        });
      }
    } catch (error) {
      console.error('Failed to fetch full track data:', error);
    }

    // Check if sync is active before loading
    const syncWasActive = mixerState.syncActive;

    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, loading: true, playing: false },
      syncActive: false // Disable sync while loading
    }));

    try {
      // Initialize audio if needed
      if (!audioInitialized) {
        console.log('🎵 Audio not initialized, initializing now...');
        await initializeAudio();
      }

      // Clean up existing audio
      await cleanupDeckAudio(mixerState.deckA.audioControls, 'Deck A');

      // Disable sync engine if it was active and reset Deck B
      if (syncWasActive && syncEngineRef.current) {
        syncEngineRef.current.disableSync();
        syncEngineRef.current = null;

        // Reset Deck B to clean state (playback rate + loop position)
        if (mixerState.deckB.audioState?.audio && mixerState.deckB.audioControls) {
          mixerState.deckB.audioState.audio.playbackRate = 1.0;
          mixerState.deckB.audioControls.setLoopPosition(0); // Reset to start of loop
          console.log('🔄 Reset Deck B: playback rate to 1.0, loop position to 0');
        }
      }

      // Load new audio
      console.log('🎵 Loading audio for track:', track.audioUrl);
      const audioResult = await loadAudioForDeck(track, 'Deck A');
      
      if (audioResult) {
        const { audioState, audioControls, trackBPM } = audioResult;
        console.log('✅ Audio loaded successfully for Deck A');
        
        // Apply current loop settings to the new track
        if (audioControls) {
          audioControls.setLoopEnabled(mixerState.deckA.loopEnabled);
          audioControls.setLoopLength(mixerState.deckA.loopLength);
          audioControls.setLoopPosition(0); // Reset to start for new track
        }

        setMixerState(prev => ({
          ...prev,
          masterBPM: trackBPM,
          deckA: {
            ...prev.deckA,
            track,
            playing: false,
            audioState,
            audioControls,
            loading: false,
            loopPosition: 0 // Reset position in state too
          }
        }));

        // Connect FX if available (with retry for timing issues)
        const connectFX = (retryCount = 0) => {
          console.log(`🎛️ Attempting to connect Deck A FX (attempt ${retryCount + 1})`);

          if (deckAFXRef.current) {
            const hasAudioInput = !!(deckAFXRef.current as any).audioInput;
            const hasAudioOutput = !!(deckAFXRef.current as any).audioOutput;

            if (hasAudioInput && hasAudioOutput) {
              const fxInput = (deckAFXRef.current as any).audioInput as GainNode;
              const fxOutput = (deckAFXRef.current as any).audioOutput as GainNode;

              try {
                // Disconnect existing connections
                audioState.filterNode.disconnect();
                audioState.gainNode.disconnect();

                // Reconnect audio routing through FX: filter → FX → gain → analyzer
                audioState.filterNode.connect(fxInput);
                fxOutput.connect(audioState.gainNode);
                audioState.gainNode.connect(audioState.analyzerNode);

                console.log('🎛️ Deck A FX connected to audio chain successfully');

                // Reset FX to defaults for new track
                if ((deckAFXRef.current as any).resetToDefaults) {
                  (deckAFXRef.current as any).resetToDefaults();
                }

                return true;
              } catch (error) {
                console.error('🎛️ Failed to connect Deck A FX:', error);
                // Fall back to direct connection
                audioState.filterNode.connect(audioState.gainNode);
                audioState.gainNode.connect(audioState.analyzerNode);
                return false;
              }
            }
          }

          // FX not ready, use direct connection and retry
          try {
            audioState.filterNode.disconnect();
            audioState.filterNode.connect(audioState.gainNode);
            audioState.gainNode.connect(audioState.analyzerNode);
          } catch (e) {
            // Ignore if already connected
          }

          // Retry up to 10 times with exponential backoff
          if (retryCount < 10) {
            setTimeout(() => {
              connectFX(retryCount + 1);
            }, 100 * Math.pow(1.5, retryCount));
          }
          return false;
        };

        // Start connection attempts
        connectFX();
      } else {
        console.error('❌ No audio result returned');
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
    console.log('🎵 SimplifiedMixer: Loading track to Deck B:', track);

    if (mixerState.deckB.loading) {
      console.log('⚠️ Deck B already loading, skipping');
      return;
    }

    // Ensure we have audioUrl
    if (!track.audioUrl) {
      console.error('❌ Track missing audioUrl:', track);
      return;
    }

    // Fetch full track data including attribution splits
    try {
      const { data, error } = await supabase
        .from('ip_tracks')
        .select('*')
        .eq('id', track.id)
        .single();

      if (!error && data) {
        // Add full IPTrack data to loadedTracks for remix split calculations
        addLoadedTrack(data as any);
        console.log(`📊 Track loaded with full data:`, {
          id: data.id,
          title: data.title,
          remix_depth: data.remix_depth || 0,
          hasCompositionSplits: !!(data.composition_split_1_wallet),
          hasProductionSplits: !!(data.production_split_1_wallet)
        });
      }
    } catch (error) {
      console.error('Failed to fetch full track data:', error);
    }

    // Check if sync is active before loading
    const syncWasActive = mixerState.syncActive;

    setMixerState(prev => ({
      ...prev,
      deckB: { ...prev.deckB, loading: true, playing: false },
      syncActive: false // Disable sync while loading
    }));

    try {
      // Initialize audio if needed
      if (!audioInitialized) {
        console.log('🎵 Audio not initialized, initializing now...');
        await initializeAudio();
      }

      // Clean up existing audio
      await cleanupDeckAudio(mixerState.deckB.audioControls, 'Deck B');

      // Disable sync engine if it was active and reset Deck A
      if (syncWasActive && syncEngineRef.current) {
        syncEngineRef.current.disableSync();
        syncEngineRef.current = null;

        // Reset Deck A to clean state (playback rate + loop position)
        if (mixerState.deckA.audioState?.audio && mixerState.deckA.audioControls) {
          mixerState.deckA.audioState.audio.playbackRate = 1.0;
          mixerState.deckA.audioControls.setLoopPosition(0); // Reset to start of loop
          console.log('🔄 Reset Deck A: playback rate to 1.0, loop position to 0');
        }
      }

      // Load new audio
      console.log('🎵 Loading audio for track:', track.audioUrl);
      const audioResult = await loadAudioForDeck(track, 'Deck B');
      
      if (audioResult) {
        const { audioState, audioControls } = audioResult;
        console.log('✅ Audio loaded successfully for Deck B');
        
        // Apply current loop settings to the new track
        if (audioControls) {
          audioControls.setLoopEnabled(mixerState.deckB.loopEnabled);
          audioControls.setLoopLength(mixerState.deckB.loopLength);
          audioControls.setLoopPosition(0); // Reset to start for new track
        }

        setMixerState(prev => ({
          ...prev,
          deckB: {
            ...prev.deckB,
            track,
            playing: false,
            audioState,
            audioControls,
            loading: false,
            loopPosition: 0 // Reset position in state too
          }
        }));

        // Connect FX if available (with retry for timing issues)
        const connectFX = (retryCount = 0) => {
          console.log(`🎛️ Attempting to connect Deck B FX (attempt ${retryCount + 1})`);

          if (deckBFXRef.current) {
            const hasAudioInput = !!(deckBFXRef.current as any).audioInput;
            const hasAudioOutput = !!(deckBFXRef.current as any).audioOutput;

            if (hasAudioInput && hasAudioOutput) {
              const fxInput = (deckBFXRef.current as any).audioInput as GainNode;
              const fxOutput = (deckBFXRef.current as any).audioOutput as GainNode;

              try {
                // Disconnect existing connections
                audioState.filterNode.disconnect();
                audioState.gainNode.disconnect();

                // Reconnect audio routing through FX: filter → FX → gain → analyzer
                audioState.filterNode.connect(fxInput);
                fxOutput.connect(audioState.gainNode);
                audioState.gainNode.connect(audioState.analyzerNode);

                console.log('🎛️ Deck B FX connected to audio chain successfully');

                // Reset FX to defaults for new track
                if ((deckBFXRef.current as any).resetToDefaults) {
                  (deckBFXRef.current as any).resetToDefaults();
                }

                return true;
              } catch (error) {
                console.error('🎛️ Failed to connect Deck B FX:', error);
                // Fall back to direct connection
                audioState.filterNode.connect(audioState.gainNode);
                audioState.gainNode.connect(audioState.analyzerNode);
                return false;
              }
            }
          }

          // FX not ready, use direct connection and retry
          try {
            audioState.filterNode.disconnect();
            audioState.filterNode.connect(audioState.gainNode);
            audioState.gainNode.connect(audioState.analyzerNode);
          } catch (e) {
            // Ignore if already connected
          }

          // Retry up to 10 times with exponential backoff
          if (retryCount < 10) {
            setTimeout(() => {
              connectFX(retryCount + 1);
            }, 100 * Math.pow(1.5, retryCount));
          }
          return false;
        };

        // Start connection attempts
        connectFX();
      } else {
        console.error('❌ No audio result returned');
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
    // Reset both decks to start
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
      // Enable sync
      const audioContext = mixerState.deckA.audioState.audioContext;

      syncEngineRef.current = new SimpleLoopSync(
        audioContext,
        { ...mixerState.deckA.audioState, audioControls: mixerState.deckA.audioControls, track: mixerState.deckA.track },
        { ...mixerState.deckB.audioState, audioControls: mixerState.deckB.audioControls, track: mixerState.deckB.track }
      );

      await syncEngineRef.current.enableSync();
    } else if (!newSyncState && syncEngineRef.current) {
      // Disable sync
      syncEngineRef.current.disableSync();
      syncEngineRef.current = null;
    }
    
    setMixerState(prev => ({ ...prev, syncActive: newSyncState }));
  }, [mixerState]);

  // Crossfader handler
  const handleCrossfaderChange = useCallback((position: number) => {
    console.log('🎚️ Crossfader position:', position);
    const { deckA, deckB } = crossfaderGainRef.current;
    console.log('🎚️ Gain nodes:', { deckA: !!deckA, deckB: !!deckB });

    if (deckA && deckB) {
      const normalizedPosition = position / 100;
      applyCrossfader(deckA, deckB, normalizedPosition);
    } else {
      console.warn('⚠️ Crossfader: One or both gain nodes are missing!');
    }

    setMixerState(prev => ({ ...prev, crossfaderPosition: position }));
  }, []);

  // BPM change handler
  const handleBPMChange = (delta: number) => {
    const newBPM = Math.max(60, Math.min(200, mixerState.masterBPM + delta));
    
    setMixerState(prev => ({
      ...prev,
      masterBPM: newBPM
    }));
    
    // Apply to playing deck
    if (mixerState.deckA.playing && mixerState.deckA.audioControls) {
      const originalBPM = mixerState.deckA.track?.bpm || 120;
      const playbackRate = newBPM / originalBPM;
      mixerState.deckA.audioControls.setPlaybackRate(playbackRate);
      mixerState.deckA.audioControls.setBPM(newBPM);
    }
  };

  // Clear deck handlers
  const handleClearDeckA = async () => {
    console.log('🗑️ Clearing Deck A');
    await cleanupDeckAudio(mixerState.deckA.audioControls, 'Deck A');
    setMixerState(prev => ({
      ...prev,
      deckA: {
        ...prev.deckA,
        track: null,
        playing: false,
        audioState: undefined,
        audioControls: undefined,
        loopPosition: 0
      }
    }));
  };

  const handleClearDeckB = async () => {
    console.log('🗑️ Clearing Deck B');
    await cleanupDeckAudio(mixerState.deckB.audioControls, 'Deck B');
    setMixerState(prev => ({
      ...prev,
      deckB: {
        ...prev.deckB,
        track: null,
        playing: false,
        audioState: undefined,
        audioControls: undefined,
        loopPosition: 0
      }
    }));
  };

  // Add to cart handler
  const handleAddToCart = (track: Track) => {
    console.log('🛒 Adding track to cart:', track);
    // Use global cart function if available
    if ((window as any).addToCart) {
      (window as any).addToCart(track);
    }
  };

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
    
    // Update audio controls
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
    
    // Update audio controls
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

    // Update audio controls
    const audioControls = mixerState[deckKey].audioControls;
    if (audioControls && audioControls.setLoopPosition) {
      audioControls.setLoopPosition(position);
    }
  };

  // Recording handlers
  const setupMixerRecording = useCallback(() => {
    const audioContext = getAudioContext();
    if (!audioContext) {
      console.error('❌ No audio context available');
      return null;
    }

    // Create mixer destination node if it doesn't exist
    if (!mixerDestinationRef.current) {
      mixerDestinationRef.current = audioContext.createMediaStreamDestination();
      console.log('🎙️ Created MediaStreamDestination for recording');
    }

    // CRITICAL: Connect to the MASTER gain node to capture everything
    // This captures the final mix AFTER crossfader, FX, loop controls, etc.
    const masterGain = getMasterGain();
    if (masterGain) {
      try {
        // Disconnect previous connection if exists
        masterGain.disconnect(mixerDestinationRef.current);
      } catch (e) {
        // Not connected yet, that's fine
      }

      // Connect master to recording destination
      masterGain.connect(mixerDestinationRef.current);
      console.log('✅ Master gain connected to recording destination');
      console.log('🎚️ Recording will capture: Crossfader ✓ FX ✓ Loop Controls ✓ Master Volume ✓');
    } else {
      console.error('❌ Master gain node not available');
      return null;
    }

    return mixerDestinationRef.current.stream;
  }, []);

  const startRecording = useCallback(() => {
    console.log('🎙️ Starting mixer recording...');

    const stream = setupMixerRecording();
    if (!stream) {
      console.error('❌ Failed to setup mixer recording');
      return;
    }

    const audioContext = getAudioContext();
    if (!audioContext) {
      console.error('❌ No audio context available for recording');
      return;
    }

    // Clear previous recording
    recordedChunksRef.current = [];

    // Create MediaRecorder
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    // Capture the start time from AudioContext for sample-accurate timing
    const recordingStartTime = audioContext.currentTime;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      console.log('🎙️ Recording stopped, processing audio...');
      const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);

      // Calculate actual duration using AudioContext time
      const recordingEndTime = audioContext.currentTime;
      const actualDuration = recordingEndTime - recordingStartTime;

      setRecordingState(prev => ({
        ...prev,
        isRecording: false,
        recordedUrl: url,
        recordedDuration: actualDuration,
        showPreview: true
      }));

      console.log(`✅ Recording complete: ${actualDuration.toFixed(2)}s (${AudioTiming.timeToBar(actualDuration, mixerState.masterBPM).toFixed(1)} bars)`);
    };

    mediaRecorder.start(100); // Collect data every 100ms
    mediaRecorderRef.current = mediaRecorder;

    setRecordingState(prev => ({
      ...prev,
      isRecording: true,
      recordingStartTime: recordingStartTime,
      barsRecorded: 0
    }));

    console.log(`✅ Recording started at AudioContext time: ${recordingStartTime.toFixed(3)}s`);
  }, [setupMixerRecording, mixerState.masterBPM]);

  const stopRecording = useCallback(() => {
    console.log('🎙️ Stopping recording...');

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop mixer playback when recording stops
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

    console.log('⏸️ Mixer playback stopped');
  }, [mixerState]);

  const handleRecordToggle = useCallback(() => {
    if (recordingState.isRecording) {
      stopRecording();
    } else {
      // Ensure both decks are loaded
      if (!mixerState.deckA.track || !mixerState.deckB.track) {
        console.warn('⚠️ Both decks must have tracks loaded to record');
        return;
      }

      // Start playback if not already playing
      if (!mixerState.deckA.playing) {
        handleDeckAPlayPause();
      }
      if (!mixerState.deckB.playing) {
        handleDeckBPlayPause();
      }

      // Start recording
      setTimeout(() => startRecording(), 100); // Small delay to ensure playback starts
    }
  }, [recordingState.isRecording, mixerState, stopRecording, startRecording, handleDeckAPlayPause, handleDeckBPlayPause]);

  // Monitor playback to count bars and auto-stop recording at target (sample-accurate with AudioContext)
  useEffect(() => {
    if (!recordingState.isRecording || recordingState.recordingStartTime === null) return;

    const audioContext = getAudioContext();
    if (!audioContext) {
      console.error('❌ No audio context available for monitoring recording');
      return;
    }

    const checkBars = setInterval(() => {
      // Use AudioContext.currentTime for sample-accurate timing (not Date.now()!)
      const currentTime = audioContext.currentTime;
      const elapsedTime = currentTime - recordingState.recordingStartTime!;

      // Calculate bars recorded using centralized AudioTiming utility
      const barsRecorded = Math.floor(AudioTiming.timeToBar(elapsedTime, mixerState.masterBPM));

      // Safety auto-stop at 120 bars limit
      if (barsRecorded >= recordingState.targetBars) {
        console.warn(`⚠️ Reached safety limit of ${recordingState.targetBars} bars, auto-stopping recording`);
        stopRecording();
      } else if (barsRecorded > recordingState.barsRecorded) {
        setRecordingState(prev => ({ ...prev, barsRecorded }));
        console.log(`🎙️ Bar ${barsRecorded + 1} recorded (${elapsedTime.toFixed(2)}s elapsed)`);
      }
    }, 100); // Check every 100ms

    return () => clearInterval(checkBars);
  }, [recordingState.isRecording, recordingState.recordingStartTime, recordingState.targetBars, recordingState.barsRecorded, mixerState.masterBPM, stopRecording]);

  return (
    <div className={`simplified-mixer bg-slate-900 rounded-lg p-4 mt-4 mx-auto ${className}`} style={{ maxWidth: '1168px' }}>

      {/* Top Section - Decks, Crates, and BPM */}
      <div className="flex justify-center items-end mb-8" style={{ gap: waveformWidth >= 700 ? '48px' : waveformWidth >= 600 ? '32px' : waveformWidth >= 500 ? '16px' : '8px' }}>
        {/* Left: Deck A + Loop Controls + Track Info */}
        <div className="flex gap-4 items-center">
          <SimplifiedDeck
            currentTrack={mixerState.deckA.track}
            isPlaying={mixerState.deckA.playing}
            isLoading={mixerState.deckA.loading}
            onTrackDrop={loadTrackToDeckA}
            onClearDeck={handleClearDeckA}
            onAddToCart={handleAddToCart}
            deck="A"
            trackInfoPosition="none"
          />

          {/* Deck A Info Container: Track Info + Loop Controls stacked */}
          <div className="flex flex-col gap-8 items-start max-w-[140px]">
            {mixerState.deckA.track && (
              <div className="text-left w-full">
                {mixerState.deckA.track.primary_uploader_wallet ? (
                  <Link
                    href={deckAUsername ? `/store/${deckAUsername}` : `/store/${mixerState.deckA.track.primary_uploader_wallet}`}
                    className="text-slate-300 text-sm font-bold truncate hover:text-[#81E4F2] transition-colors block cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ pointerEvents: 'auto' }}
                  >
                    {mixerState.deckA.track.title} - {mixerState.deckA.track.bpm}
                  </Link>
                ) : (
                  <div className="text-slate-300 text-sm font-bold truncate">
                    {mixerState.deckA.track.title} - {mixerState.deckA.track.bpm}
                  </div>
                )}
                {mixerState.deckA.track.primary_uploader_wallet ? (
                  <Link
                    href={deckAUsername ? `/profile/${deckAUsername}` : `/profile/${mixerState.deckA.track.primary_uploader_wallet}`}
                    className="text-slate-400 text-xs truncate hover:text-[#81E4F2] transition-colors block cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ pointerEvents: 'auto' }}
                  >
                    by {mixerState.deckA.track.artist} →
                  </Link>
                ) : (
                  <div className="text-slate-400 text-xs truncate">
                    by {mixerState.deckA.track.artist}
                  </div>
                )}
              </div>
            )}
            <LoopControls
              loopLength={mixerState.deckA.loopLength}
              loopEnabled={mixerState.deckA.loopEnabled}
              onLoopChange={(length) => handleLoopLengthChange('A', length)}
              onLoopToggle={() => handleLoopToggle('A')}
              color="cyan"
            />
          </div>
        </div>

        {/* Center Column - BPM and Transport */}
        <div className="text-center flex flex-col items-center gap-6">
          {/* Master BPM Control */}
          <div className="flex flex-col items-center gap-2">
            {/* BPM Controls */}
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => handleBPMChange(-1)}
                className="w-8 h-8 rounded-full border border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-300 text-lg flex items-center justify-center transition-all"
                aria-label="Decrease BPM"
              >
                −
              </button>
              <div className="text-6xl font-bold text-slate-300 min-w-[140px] text-center">
                {mixerState.masterBPM}
              </div>
              <button
                onClick={() => handleBPMChange(1)}
                className="w-8 h-8 rounded-full border border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-300 text-lg flex items-center justify-center transition-all"
                aria-label="Increase BPM"
              >
                +
              </button>
            </div>
            {/* BPM Label */}
            <div className="text-xs uppercase tracking-wider text-slate-400">
              {mixerState.syncActive
                ? 'Deck A BPM (Master)'
                : 'Manual BPM Control'}
            </div>
          </div>

          {/* Transport Controls */}
          <MasterTransportControls
            variant="simplified"
            deckALoaded={!!mixerState.deckA.track}
            deckBLoaded={!!mixerState.deckB.track}
            deckAPlaying={mixerState.deckA.playing}
            deckBPlaying={mixerState.deckB.playing}
            deckABPM={mixerState.deckA.track?.bpm || mixerState.masterBPM}
            syncActive={mixerState.syncActive}
            recordingRemix={recordingState.isRecording}
            onMasterPlay={handleMasterPlay}
            onMasterPlayAfterCountIn={handleMasterPlayAfterCountIn}
            onMasterStop={handleMasterStop}
            onRecordToggle={handleRecordToggle}
            onSyncToggle={handleSync}
            onMasterSyncReset={handleMasterSyncReset}
          />
        </div>

        {/* Right: Loop Controls + Track Info + Deck B */}
        <div className="flex gap-4 items-center">
          {/* Deck B Info Container: Track Info + Loop Controls stacked */}
          <div className="flex flex-col gap-8 items-start max-w-[140px]">
            {mixerState.deckB.track && (
              <div className="text-left w-full">
                {mixerState.deckB.track.primary_uploader_wallet ? (
                  <Link
                    href={deckBUsername ? `/store/${deckBUsername}` : `/store/${mixerState.deckB.track.primary_uploader_wallet}`}
                    className="text-slate-300 text-sm font-bold truncate hover:text-[#81E4F2] transition-colors block cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ pointerEvents: 'auto' }}
                  >
                    {mixerState.deckB.track.title} - {mixerState.deckB.track.bpm}
                  </Link>
                ) : (
                  <div className="text-slate-300 text-sm font-bold truncate">
                    {mixerState.deckB.track.title} - {mixerState.deckB.track.bpm}
                  </div>
                )}
                {mixerState.deckB.track.primary_uploader_wallet ? (
                  <Link
                    href={deckBUsername ? `/profile/${deckBUsername}` : `/profile/${mixerState.deckB.track.primary_uploader_wallet}`}
                    className="text-slate-400 text-xs truncate hover:text-[#81E4F2] transition-colors block cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ pointerEvents: 'auto' }}
                  >
                    by {mixerState.deckB.track.artist} →
                  </Link>
                ) : (
                  <div className="text-slate-400 text-xs truncate">
                    by {mixerState.deckB.track.artist}
                  </div>
                )}
              </div>
            )}
            <LoopControls
              loopLength={mixerState.deckB.loopLength}
              loopEnabled={mixerState.deckB.loopEnabled}
              onLoopChange={(length) => handleLoopLengthChange('B', length)}
              onLoopToggle={() => handleLoopToggle('B')}
              color="blue"
            />
          </div>

          <SimplifiedDeck
            currentTrack={mixerState.deckB.track}
            isPlaying={mixerState.deckB.playing}
            isLoading={mixerState.deckB.loading}
            onTrackDrop={loadTrackToDeckB}
            onClearDeck={handleClearDeckB}
            onAddToCart={handleAddToCart}
            deck="B"
            trackInfoPosition="none"
          />
        </div>
      </div>

      {/* FX Panels and Waveforms - 3 Column Grid */}
      <div className="grid gap-5 mb-5" style={{ gridTemplateColumns: waveformWidth >= 600 ? '200px 1fr 200px' : '1fr' }}>
        {/* Deck A FX - Left Side */}
        <div className={`w-full h-full ${waveformWidth < 600 ? 'hidden' : ''}`}>
          {audioInitialized ? (
            <FXComponent
              ref={deckAFXRef}
              audioContext={getAudioContext()}
              deckId="deckA"
              audioControls={mixerState.deckA.audioControls}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <span>Initializing FX...</span>
            </div>
          )}
        </div>

        {/* Waveforms - Center Column */}
        <div className="flex flex-col">
          {/* Spacer to push waveforms down */}
          <div className="h-6"></div>

          <div className="space-y-2">
            {/* Deck A Waveform */}
            <div className="flex justify-center">
              <WaveformDisplay
                audioBuffer={mixerState.deckA.audioState?.audioBuffer}
                currentTime={mixerState.deckA.audioState?.currentTime || 0}
                isPlaying={mixerState.deckA.playing}
                trackBPM={mixerState.deckA.track?.bpm || mixerState.masterBPM}
                loopEnabled={mixerState.deckA.loopEnabled}
                loopLength={mixerState.deckA.loopLength}
                loopPosition={mixerState.deckA.loopPosition}
                onLoopPositionChange={(position) => handleLoopPositionChange('A', position)}
                width={waveformWidth}
                height={80}
                waveformColor="#FF6B6B"
                className="border border-emerald-500/30"
              />
            </div>

            {/* Deck B Waveform */}
            <div className="flex justify-center">
              <WaveformDisplay
                audioBuffer={mixerState.deckB.audioState?.audioBuffer}
                currentTime={mixerState.deckB.audioState?.currentTime || 0}
                isPlaying={mixerState.deckB.playing}
                trackBPM={mixerState.deckB.track?.bpm || mixerState.masterBPM}
                loopEnabled={mixerState.deckB.loopEnabled}
                loopLength={mixerState.deckB.loopLength}
                loopPosition={mixerState.deckB.loopPosition}
                onLoopPositionChange={(position) => handleLoopPositionChange('B', position)}
                width={waveformWidth}
                height={80}
                waveformColor="#FF6B6B"
                className="border border-blue-500/30"
              />
            </div>
          </div>

          {/* Crossfader with Deck Controls */}
          <div className="flex justify-center items-center gap-6" style={{ marginTop: '52px' }}>
            {/* Deck A Play/Pause */}
            <button
              onClick={handleDeckAPlayPause}
              disabled={!mixerState.deckA.track}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all ${
                mixerState.deckA.playing
                  ? 'bg-[#81E4F2] border-2 border-[#81E4F2] text-slate-900 shadow-lg shadow-[#81E4F2]/50 hover:bg-[#81E4F2]/80'
                  : mixerState.deckA.track
                  ? 'border-2 border-slate-600 text-slate-400 hover:border-[#81E4F2] hover:text-[#81E4F2]'
                  : 'border-2 border-slate-700 text-slate-600 cursor-not-allowed'
              }`}
              title={mixerState.deckA.playing ? 'Pause Deck A' : 'Play Deck A'}
            >
              {mixerState.deckA.playing ? (
                <svg width="14" height="18" viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="0" y="0" width="4" height="18" rx="1" fill="currentColor"/>
                  <rect x="10" y="0" width="4" height="18" rx="1" fill="currentColor"/>
                </svg>
              ) : (
                <svg width="14" height="18" viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 1 L13 9 L2 17 Z" fill="currentColor"/>
                </svg>
              )}
            </button>

            <CrossfaderControl
              position={mixerState.crossfaderPosition}
              onPositionChange={handleCrossfaderChange}
            />

            {/* Deck B Play/Pause */}
            <button
              onClick={handleDeckBPlayPause}
              disabled={!mixerState.deckB.track}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all ${
                mixerState.deckB.playing
                  ? 'bg-[#81E4F2] border-2 border-[#81E4F2] text-slate-900 shadow-lg shadow-[#81E4F2]/50 hover:bg-[#81E4F2]/80'
                  : mixerState.deckB.track
                  ? 'border-2 border-slate-600 text-slate-400 hover:border-[#81E4F2] hover:text-[#81E4F2]'
                  : 'border-2 border-slate-700 text-slate-600 cursor-not-allowed'
              }`}
              title={mixerState.deckB.playing ? 'Pause Deck B' : 'Play Deck B'}
            >
              {mixerState.deckB.playing ? (
                <svg width="14" height="18" viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="0" y="0" width="4" height="18" rx="1" fill="currentColor"/>
                  <rect x="10" y="0" width="4" height="18" rx="1" fill="currentColor"/>
                </svg>
              ) : (
                <svg width="14" height="18" viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 1 L13 9 L2 17 Z" fill="currentColor"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Deck B FX - Right Side */}
        <div className={`w-full h-full ${waveformWidth < 600 ? 'hidden' : ''}`}>
          {audioInitialized ? (
            <FXComponent
              ref={deckBFXRef}
              audioContext={getAudioContext()}
              deckId="deckB"
              audioControls={mixerState.deckB.audioControls}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <span>Initializing FX...</span>
            </div>
          )}
        </div>
      </div>

      {/* Recording Preview Modal */}
      {recordingState.showPreview && recordingState.recordedUrl && (
        <RecordingPreview
          recordingUrl={recordingState.recordedUrl}
          duration={recordingState.recordedDuration || 0}
          bars={recordingState.barsRecorded} // Actual bars recorded
          bpm={mixerState.masterBPM}
          deckATrack={mixerState.deckA.track}
          deckBTrack={mixerState.deckB.track}
          onClose={() => {
            setRecordingState(prev => ({
              ...prev,
              showPreview: false,
              recordedUrl: null,
              recordedDuration: null,
              barsRecorded: 0
            }));
            if (recordingState.recordedUrl) {
              URL.revokeObjectURL(recordingState.recordedUrl);
            }
          }}
          onSave={(selectedSegment) => {
            console.log('💾 Save remix with segment:', selectedSegment);
            // TODO: Implement save remix flow with payment
          }}
          onSelectSegment={(start, end) => {
            console.log('📍 Selected segment:', { start, end });
          }}
        />
      )}
    </div>
  );
}