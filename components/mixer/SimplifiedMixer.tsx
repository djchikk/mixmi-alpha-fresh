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
import * as Dialog from '@radix-ui/react-dialog';
import { Keyboard } from 'lucide-react';
import { IPTrack } from '@/types';

// Type definitions for FX Component extended HTMLDivElement
interface FXElement extends HTMLDivElement {
  audioInput?: GainNode;
  audioOutput?: GainNode;
  resetToDefaults?: () => void;
}

// Extend Window interface for cart functionality
declare global {
  interface Window {
    addToCart?: (track: Track) => void;
  }
}

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
    boostLevel: number; // 0=off, 1=gentle (cyan), 2=aggressive (orange)
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
    boostLevel: number; // 0=off, 1=gentle (cyan), 2=aggressive (orange)
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
      loopPosition: 0,
      boostLevel: 0 // 0=off, 1=gentle, 2=aggressive
    },
    deckB: {
      track: null,
      playing: false,
      loopEnabled: true,
      loopLength: 8,
      loopPosition: 0,
      boostLevel: 0 // 0=off, 1=gentle, 2=aggressive
    },
    masterBPM: 120,
    crossfaderPosition: 50,
    syncActive: false
  });

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

  // Keyboard shortcuts modal state
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Use refs for audio time tracking to avoid state update race conditions
  const deckACurrentTimeRef = useRef(0);
  const deckBCurrentTimeRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  // Track active FX retry timeouts for proper cleanup
  const fxRetryTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());

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
  const deckAFXRef = React.useRef<FXElement>(null);
  const deckBFXRef = React.useRef<FXElement>(null);

  // Use the mixer audio hook
  const {
    audioInitialized,
    crossfaderGainRef,
    syncEngineRef,
    initializeAudio,
    cleanupDeckAudio,
    loadAudioForDeck,
    resetSyncState
  } = useMixerAudio();

  // Use the mixer context for loaded tracks
  const { addLoadedTrack, clearLoadedTracks } = useMixer();

  // Initialize audio on mount
  useEffect(() => {
    if (!audioInitialized) {
      initializeAudio();
    }
  }, []); // Empty dependency array - only run once on mount

  // Update current time for waveforms using requestAnimationFrame (prevents race conditions)
  useEffect(() => {
    const updateCurrentTime = () => {
      // Update refs directly (no state updates = no race conditions)
      if (mixerState.deckA.playing && mixerState.deckA.audioState?.audio) {
        deckACurrentTimeRef.current = mixerState.deckA.audioState.audio.currentTime;
        // Update the audioState for waveform display
        mixerState.deckA.audioState.currentTime = deckACurrentTimeRef.current;
      }

      if (mixerState.deckB.playing && mixerState.deckB.audioState?.audio) {
        deckBCurrentTimeRef.current = mixerState.deckB.audioState.audio.currentTime;
        // Update the audioState for waveform display
        mixerState.deckB.audioState.currentTime = deckBCurrentTimeRef.current;
      }

      // Continue animation loop if either deck is playing
      if (mixerState.deckA.playing || mixerState.deckB.playing) {
        animationFrameRef.current = requestAnimationFrame(updateCurrentTime);
      }
    };

    // Start animation loop if needed
    if (mixerState.deckA.playing || mixerState.deckB.playing) {
      animationFrameRef.current = requestAnimationFrame(updateCurrentTime);
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [mixerState.deckA.playing, mixerState.deckB.playing, mixerState.deckA.audioState, mixerState.deckB.audioState]);

  // Reusable FX connection helper with retry logic and timeout tracking
  const connectDeckFX = useCallback((
    deckName: 'A' | 'B',
    fxRef: React.RefObject<FXElement>,
    audioState: any, // MixerAudioState type
    retryCount = 0
  ): boolean => {
    console.log(`🎛️ Attempting to connect Deck ${deckName} FX (attempt ${retryCount + 1})`);

    if (fxRef.current) {
      const hasAudioInput = !!fxRef.current.audioInput;
      const hasAudioOutput = !!fxRef.current.audioOutput;

      if (hasAudioInput && hasAudioOutput) {
        const fxInput = fxRef.current.audioInput;
        const fxOutput = fxRef.current.audioOutput;

        try {
          // Disconnect existing connections
          audioState.hiCutNode.disconnect();
          audioState.compressorBypass.disconnect();
          audioState.compressorEffect.disconnect();
          audioState.compressorNode.disconnect();
          audioState.gainNode.disconnect();

          // Reconnect audio routing through FX: EQ → FX → compressor (w/ bypass) → gain → analyzer → master
          audioState.hiCutNode.connect(fxInput);
          fxOutput.connect(audioState.compressorBypass);
          fxOutput.connect(audioState.compressorNode);
          audioState.compressorBypass.connect(audioState.gainNode);
          audioState.compressorNode.connect(audioState.compressorEffect);
          audioState.compressorEffect.connect(audioState.gainNode);
          audioState.gainNode.connect(audioState.analyzerNode);
          audioState.analyzerNode.connect(audioState.audioContext.destination);

          console.log(`🎛️ Deck ${deckName} FX connected to audio chain successfully`);

          // Reset FX to defaults for new track
          if (fxRef.current.resetToDefaults) {
            fxRef.current.resetToDefaults();
          }

          return true;
        } catch (error) {
          console.error(`🎛️ Failed to connect Deck ${deckName} FX:`, error);
          // Fall back to direct connection
          audioState.hiCutNode.connect(audioState.compressorBypass);
          audioState.hiCutNode.connect(audioState.compressorNode);
          audioState.compressorBypass.connect(audioState.gainNode);
          audioState.compressorNode.connect(audioState.compressorEffect);
          audioState.compressorEffect.connect(audioState.gainNode);
          audioState.gainNode.connect(audioState.analyzerNode);
          audioState.analyzerNode.connect(audioState.audioContext.destination);
          return false;
        }
      }
    }

    // FX not ready, use direct connection and retry
    try {
      audioState.hiCutNode.disconnect();
      audioState.compressorBypass.disconnect();
      audioState.compressorEffect.disconnect();
      audioState.compressorNode.disconnect();
      audioState.gainNode.disconnect();

      audioState.hiCutNode.connect(audioState.compressorBypass);
      audioState.hiCutNode.connect(audioState.compressorNode);
      audioState.compressorBypass.connect(audioState.gainNode);
      audioState.compressorNode.connect(audioState.compressorEffect);
      audioState.compressorEffect.connect(audioState.gainNode);
      audioState.gainNode.connect(audioState.analyzerNode);
      audioState.analyzerNode.connect(audioState.audioContext.destination);
    } catch (e) {
      // Ignore if already connected
    }

    // Retry up to 10 times with exponential backoff
    if (retryCount < 10) {
      const timeout = setTimeout(() => {
        fxRetryTimeoutsRef.current.delete(timeout);
        connectDeckFX(deckName, fxRef, audioState, retryCount + 1);
      }, 100 * Math.pow(1.5, retryCount));
      fxRetryTimeoutsRef.current.add(timeout);
    }
    return false;
  }, []);

  // Cleanup all FX retry timeouts and sync engine on unmount
  useEffect(() => {
    return () => {
      // Clear FX retry timeouts
      fxRetryTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      fxRetryTimeoutsRef.current.clear();

      // Reset sync engine state
      resetSyncState();
    };
  }, [resetSyncState]);

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
        addLoadedTrack(data as IPTrack);
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
      if (syncWasActive) {
        resetSyncState();

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

        // Connect FX using shared helper function
        connectDeckFX('A', deckAFXRef, audioState);
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
        addLoadedTrack(data as IPTrack);
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
      if (syncWasActive) {
        resetSyncState();

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

        // Connect FX using shared helper function
        connectDeckFX('B', deckBFXRef, audioState);
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

  const handleReturnToStart = useCallback(async () => {
    const wasPlaying = mixerState.deckA.playing || mixerState.deckB.playing;

    // Stop both decks and reset to beginning
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

    // If was playing, restart playback immediately
    if (wasPlaying) {
      // Small delay to ensure stop completes
      setTimeout(async () => {
        if (mixerState.deckA.audioControls && mixerState.deckA.track) {
          await mixerState.deckA.audioControls.play();
          setMixerState(prev => ({
            ...prev,
            deckA: { ...prev.deckA, playing: true }
          }));
        }
        if (mixerState.deckB.audioControls && mixerState.deckB.track) {
          await mixerState.deckB.audioControls.play();
          setMixerState(prev => ({
            ...prev,
            deckB: { ...prev.deckB, playing: true }
          }));
        }
      }, 100);
    }

    console.log(`🔄 Return to start - ${wasPlaying ? 'restarting playback' : 'staying paused'}`);
  }, [mixerState]);

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
    } else if (!newSyncState) {
      // Disable sync using shared cleanup method
      resetSyncState();
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
    if (window.addToCart) {
      window.addToCart(track);
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

  // Boost toggle handlers - Progressive: 0 (off) → 1 (gentle/cyan) → 2 (aggressive/orange) → 0
  const handleBoostToggle = (deck: 'A' | 'B') => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';
    const currentLevel = mixerState[deckKey].boostLevel;
    const newLevel = (currentLevel + 1) % 3; // Cycle through 0, 1, 2

    setMixerState(prev => ({
      ...prev,
      [deckKey]: {
        ...prev[deckKey],
        boostLevel: newLevel
      }
    }));

    // Update audio controls
    const audioControls = mixerState[deckKey].audioControls;
    if (audioControls && audioControls.setBoost) {
      audioControls.setBoost(newLevel);
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

  // Keyboard shortcuts for mixer control
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();

      switch (key) {
        case '?':
          // ?: Show keyboard shortcuts
          e.preventDefault();
          setShowKeyboardShortcuts(true);
          break;

        case ' ':
          // Space: Master play/pause
          e.preventDefault();
          handleMasterPlayAfterCountIn();
          break;

        case 'a':
          // A: Toggle Deck A play/pause
          e.preventDefault();
          handleDeckAPlayPause();
          break;

        case 'b':
          // B: Toggle Deck B play/pause
          e.preventDefault();
          handleDeckBPlayPause();
          break;

        case 'arrowleft':
          // Left arrow: Move crossfader left (towards A)
          e.preventDefault();
          handleCrossfaderChange(Math.max(0, mixerState.crossfaderPosition - 5));
          break;

        case 'arrowright':
          // Right arrow: Move crossfader right (towards B)
          e.preventDefault();
          handleCrossfaderChange(Math.min(100, mixerState.crossfaderPosition + 5));
          break;

        case '1':
        case '2':
        case '4':
        case '8':
          // Number keys: Set loop length for both decks
          e.preventDefault();
          const length = parseInt(key);
          handleLoopLengthChange('A', length);
          handleLoopLengthChange('B', length);
          console.log(`⌨️ Loop length set to ${length} bars`);
          break;

        case 's':
          // S: Toggle sync
          e.preventDefault();
          handleSync();
          break;

        case 'r':
          // R: Toggle recording
          e.preventDefault();
          handleRecordToggle();
          break;

        case 'escape':
          // Escape: Return to start
          e.preventDefault();
          handleReturnToStart();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [
    mixerState.crossfaderPosition,
    handleDeckAPlayPause,
    handleDeckBPlayPause,
    handleMasterPlayAfterCountIn,
    handleCrossfaderChange,
    handleLoopLengthChange,
    handleSync,
    handleRecordToggle,
    handleReturnToStart
  ]);

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

      {/* Keyboard Shortcuts Modal */}
      <Dialog.Root open={showKeyboardShortcuts} onOpenChange={setShowKeyboardShortcuts}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-800 rounded-lg p-6 shadow-2xl border border-slate-600 z-50 max-w-md w-full">
            <Dialog.Title className="text-xl font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Keyboard size={20} className="text-[#81E4F2]" />
              Keyboard Shortcuts
            </Dialog.Title>

            <div className="space-y-3 text-sm">
              {/* Transport Controls */}
              <div>
                <div className="text-xs text-[#81E4F2] font-bold uppercase tracking-wider mb-2">Transport</div>
                <div className="space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span>Master Play/Pause</span>
                    <kbd className="px-2 py-0.5 bg-slate-700 rounded text-slate-200 font-mono text-xs">Space</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Deck A Play/Pause</span>
                    <kbd className="px-2 py-0.5 bg-slate-700 rounded text-slate-200 font-mono text-xs">A</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Deck B Play/Pause</span>
                    <kbd className="px-2 py-0.5 bg-slate-700 rounded text-slate-200 font-mono text-xs">B</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Return to Start</span>
                    <kbd className="px-2 py-0.5 bg-slate-700 rounded text-slate-200 font-mono text-xs">Esc</kbd>
                  </div>
                </div>
              </div>

              {/* Crossfader */}
              <div>
                <div className="text-xs text-[#81E4F2] font-bold uppercase tracking-wider mb-2">Crossfader</div>
                <div className="space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span>Move Left (towards A)</span>
                    <kbd className="px-2 py-0.5 bg-slate-700 rounded text-slate-200 font-mono text-xs">←</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Move Right (towards B)</span>
                    <kbd className="px-2 py-0.5 bg-slate-700 rounded text-slate-200 font-mono text-xs">→</kbd>
                  </div>
                </div>
              </div>

              {/* Loop Controls */}
              <div>
                <div className="text-xs text-[#81E4F2] font-bold uppercase tracking-wider mb-2">Loop Length</div>
                <div className="space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span>Set 1, 2, 4, or 8 bars</span>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-0.5 bg-slate-700 rounded text-slate-200 font-mono text-xs">1</kbd>
                      <kbd className="px-2 py-0.5 bg-slate-700 rounded text-slate-200 font-mono text-xs">2</kbd>
                      <kbd className="px-2 py-0.5 bg-slate-700 rounded text-slate-200 font-mono text-xs">4</kbd>
                      <kbd className="px-2 py-0.5 bg-slate-700 rounded text-slate-200 font-mono text-xs">8</kbd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Other Controls */}
              <div>
                <div className="text-xs text-[#81E4F2] font-bold uppercase tracking-wider mb-2">Other</div>
                <div className="space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span>Toggle Sync</span>
                    <kbd className="px-2 py-0.5 bg-slate-700 rounded text-slate-200 font-mono text-xs">S</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Toggle Recording</span>
                    <kbd className="px-2 py-0.5 bg-slate-700 rounded text-slate-200 font-mono text-xs">R</kbd>
                  </div>
                </div>
              </div>
            </div>

            <Dialog.Close asChild>
              <button className="mt-6 w-full px-4 py-2 bg-[#81E4F2] text-slate-900 rounded-lg font-bold hover:bg-[#81E4F2]/80 transition-all">
                Got it!
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Top Section - Decks, Crates, and BPM */}
      <div className="flex justify-center items-end mb-3" style={{ gap: waveformWidth >= 700 ? '48px' : waveformWidth >= 600 ? '32px' : waveformWidth >= 500 ? '16px' : '8px' }}>
        {/* Left: Volume A + Deck A + Loop Controls + Track Info */}
        <div className="flex gap-4 items-center">
          {/* Deck A Controls */}
          <div className="flex gap-3 items-end">
            {/* Volume Fader */}
            <div className="flex flex-col items-center gap-1" style={{ width: '40px' }}>
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Vol</div>
              <div className="relative flex flex-col items-center">
                {/* Tick marks */}
                <div className="absolute left-[-12px] top-0 bottom-0 flex flex-col justify-between text-[8px] text-slate-500 font-mono" style={{ height: '140px' }}>
                  <span>10</span>
                  <span>8</span>
                  <span>6</span>
                  <span>4</span>
                  <span>2</span>
                  <span>0</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="100"
                  onChange={(e) => {
                    const volume = parseInt(e.target.value) / 100;
                    mixerState.deckA.audioControls?.setVolume(volume);
                  }}
                  className="volume-fader"
                  style={{
                    height: '140px',
                    width: '10px',
                    writingMode: 'vertical-lr',
                    direction: 'rtl',
                    appearance: 'none',
                    background: 'rgba(0, 0, 0, 0.6)',
                    borderRadius: '6px',
                    outline: 'none',
                    border: '1px solid rgba(129, 228, 242, 0.3)',
                    padding: '4px 0'
                  }}
                />
              </div>
              <div className="text-[8px] text-slate-600 font-mono mt-1">A</div>
            </div>
          </div>

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

          {/* Transport Controls with Keyboard Shortcut */}
          <div className="flex flex-col items-center">
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
              onReturnToStart={handleReturnToStart}
              onRecordToggle={handleRecordToggle}
              onSyncToggle={handleSync}
              onMasterSyncReset={handleMasterSyncReset}
            />

            {/* Keyboard Shortcuts Button */}
            <button
              onClick={() => setShowKeyboardShortcuts(true)}
              className="mt-1 w-8 h-8 rounded-full bg-transparent hover:bg-slate-700/30 text-slate-500 hover:text-[#81E4F2] flex items-center justify-center transition-all"
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard size={16} />
            </button>
          </div>
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

          {/* Deck B Controls */}
          <div className="flex gap-3 items-end">
            {/* Volume Fader */}
            <div className="flex flex-col items-center gap-1" style={{ width: '40px' }}>
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Vol</div>
              <div className="relative flex flex-col items-center">
                {/* Tick marks */}
                <div className="absolute right-[-12px] top-0 bottom-0 flex flex-col justify-between text-[8px] text-slate-500 font-mono" style={{ height: '140px' }}>
                  <span>10</span>
                  <span>8</span>
                  <span>6</span>
                  <span>4</span>
                  <span>2</span>
                  <span>0</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="100"
                  onChange={(e) => {
                    const volume = parseInt(e.target.value) / 100;
                    mixerState.deckB.audioControls?.setVolume(volume);
                  }}
                  className="volume-fader"
                  style={{
                    height: '140px',
                    width: '10px',
                    writingMode: 'vertical-lr',
                    direction: 'rtl',
                    appearance: 'none',
                    background: 'rgba(0, 0, 0, 0.6)',
                    borderRadius: '6px',
                    outline: 'none',
                    border: '1px solid rgba(129, 228, 242, 0.3)',
                    padding: '4px 0'
                  }}
                />
              </div>
              <div className="text-[8px] text-slate-600 font-mono mt-1">B</div>
            </div>
          </div>
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
              masterBPM={mixerState.masterBPM}
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
            {/* TODO: BOOST feature - needs refinement, commented out for now
            <button
              onClick={() => handleBoostToggle('A')}
              disabled={!mixerState.deckA.track}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all uppercase tracking-wider ${
                mixerState.deckA.boostLevel === 2
                  ? 'bg-orange-500 border-2 border-orange-500 text-white hover:bg-orange-600 active:bg-orange-700'
                  : mixerState.deckA.boostLevel === 1
                  ? 'bg-[#81E4F2] border-2 border-[#81E4F2] text-slate-900 hover:bg-[#81E4F2]/80 active:bg-[#81E4F2]/90'
                  : mixerState.deckA.track
                  ? 'bg-black border-2 border-slate-400 text-slate-200 hover:bg-slate-600 hover:border-slate-300 hover:text-white'
                  : 'bg-black border-2 border-slate-700 text-slate-600 cursor-not-allowed'
              }`}
              style={{ minWidth: '72px' }}
              title={
                mixerState.deckA.boostLevel === 2
                  ? 'BOOST+ (Aggressive) - Click for OFF'
                  : mixerState.deckA.boostLevel === 1
                  ? 'BOOST (Gentle) - Click for BOOST+'
                  : 'Boost OFF - Click for BOOST'
              }
            >
              {mixerState.deckA.boostLevel === 2 ? 'BOOST+' : 'BOOST'}
            </button>
            */}

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

            {/* TODO: BOOST feature - needs refinement, commented out for now
            <button
              onClick={() => handleBoostToggle('B')}
              disabled={!mixerState.deckB.track}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all uppercase tracking-wider ${
                mixerState.deckB.boostLevel === 2
                  ? 'bg-orange-500 border-2 border-orange-500 text-white hover:bg-orange-600 active:bg-orange-700'
                  : mixerState.deckB.boostLevel === 1
                  ? 'bg-[#81E4F2] border-2 border-[#81E4F2] text-slate-900 hover:bg-[#81E4F2]/80 active:bg-[#81E4F2]/90'
                  : mixerState.deckB.track
                  ? 'bg-black border-2 border-slate-400 text-slate-200 hover:bg-slate-600 hover:border-slate-300 hover:text-white'
                  : 'bg-black border-2 border-slate-700 text-slate-600 cursor-not-allowed'
              }`}
              style={{ minWidth: '72px' }}
              title={
                mixerState.deckB.boostLevel === 2
                  ? 'BOOST+ (Aggressive) - Click for OFF'
                  : mixerState.deckB.boostLevel === 1
                  ? 'BOOST (Gentle) - Click for BOOST+'
                  : 'Boost OFF - Click for BOOST'
              }
            >
              {mixerState.deckB.boostLevel === 2 ? 'BOOST+' : 'BOOST'}
            </button>
            */}
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
              masterBPM={mixerState.masterBPM}
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

      {/* Volume Fader Styling - Professional DJ Style */}
      <style jsx global>{`
        .volume-fader::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 8px;
          background: #1e293b;
          border: 2px solid rgba(129, 228, 242, 0.5);
          border-radius: 3px;
          cursor: grab;
          box-shadow:
            0 0 6px rgba(129, 228, 242, 0.3),
            0 2px 4px rgba(0, 0, 0, 0.4),
            inset 0 0 0 1px rgba(129, 228, 242, 0.15);
          transition: all 0.15s ease;
          position: relative;
        }

        .volume-fader::-webkit-slider-thumb:hover {
          background: #2d3e56;
          border-color: #A0EDF9;
          box-shadow:
            0 0 12px rgba(129, 228, 242, 0.7),
            0 2px 6px rgba(0, 0, 0, 0.4),
            inset 0 0 0 1px rgba(129, 228, 242, 0.3);
        }

        .volume-fader::-webkit-slider-thumb:active {
          cursor: grabbing;
          background: #1e293b;
          box-shadow:
            0 0 16px rgba(129, 228, 242, 0.9),
            0 1px 2px rgba(0, 0, 0, 0.5),
            inset 0 0 0 1px rgba(129, 228, 242, 0.4);
        }

        .volume-fader::-moz-range-thumb {
          width: 20px;
          height: 8px;
          background: #1e293b;
          border: 2px solid rgba(129, 228, 242, 0.5);
          border-radius: 3px;
          cursor: grab;
          box-shadow:
            0 0 6px rgba(129, 228, 242, 0.3),
            0 2px 4px rgba(0, 0, 0, 0.4),
            inset 0 0 0 1px rgba(129, 228, 242, 0.15);
          transition: all 0.15s ease;
        }

        .volume-fader::-moz-range-thumb:hover {
          background: #2d3e56;
          border-color: #A0EDF9;
          box-shadow:
            0 0 12px rgba(129, 228, 242, 0.7),
            0 2px 6px rgba(0, 0, 0, 0.4),
            inset 0 0 0 1px rgba(129, 228, 242, 0.3);
        }

        .volume-fader::-moz-range-thumb:active {
          cursor: grabbing;
          background: #1e293b;
          box-shadow:
            0 0 16px rgba(129, 228, 242, 0.9),
            0 1px 2px rgba(0, 0, 0, 0.5),
            inset 0 0 0 1px rgba(129, 228, 242, 0.4);
        }
      `}</style>
    </div>
  );
}