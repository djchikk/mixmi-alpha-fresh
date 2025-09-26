"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Track, FXState, DeckState, MixerState } from './types';
import { useMixer } from '@/contexts/MixerContext';
import { useMixerAudio } from '@/hooks/useMixerAudio';
import { applyCrossfader, syncBPM, SimpleLoopSync, getAudioContext, getMasterGain } from '@/lib/mixerAudio';
import { mixerRecorder } from '@/lib/mixerRecording';
import { useNavigationCleanup } from '@/hooks/useNavigationCleanup';
import { supabase } from '@/lib/supabase';
import Deck from './Deck';
import DeckCrate from './DeckCrate';
import WaveformDisplay from './WaveformDisplay';
import TransportControls from './TransportControls';
import FXComponent from './FXComponent';
import CrossfaderControl from './CrossfaderControl';
import MasterTransportControls from './MasterTransportControls';
import RecordingPreview from './RecordingPreview';

interface MixerPageProps {
  onExit?: () => void;
}

// Storage keys for persistence
const MIXER_STATE_KEY = 'mixmi-mixer-state';

// Helper functions for state persistence
const saveMixerState = (state: MixerState) => {
  try {
    if (typeof window !== 'undefined') {
      // Create a clean state for persistence (exclude runtime audio objects)
      const { deckA, deckB, ...baseState } = state;
      const persistableState = {
        ...baseState,
        deckA: {
          track: deckA.track,
          playing: false, // Always save as false - playing is runtime-only
          loop: deckA.loop,
          fx: deckA.fx,
          loading: false // Reset loading state
        },
        deckB: {
          track: deckB.track,
          playing: false, // Always save as false - playing is runtime-only 
          loop: deckB.loop,
          fx: deckB.fx,
          loading: false // Reset loading state
        }
      };
      localStorage.setItem(MIXER_STATE_KEY, JSON.stringify(persistableState));
    }
  } catch (error) {
    console.warn('Failed to save mixer state:', error);
  }
};

const loadMixerState = (): MixerState | null => {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(MIXER_STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Failed to load mixer state:', error);
  }
  return null;
};

// Default mixer state
const getDefaultMixerState = (): MixerState => ({
  deckA: {
    track: null,
    playing: false,
    loop: 8,
    loopEnabled: true, // 🔄 NEW: Loop enabled by default
    loopPosition: 0, // 🎯 NEW: Start from beginning (bar 0)
    fx: {
      selectedFX: 'FILTER',
      filterValue: 50,
      reverbValue: 50,
      delayValue: 50
    }
  },
  deckB: {
    track: null,
    playing: false,
    loop: 8,
    loopEnabled: true, // 🔄 NEW: Loop enabled by default
    loopPosition: 0, // 🎯 NEW: Start from beginning (bar 0)
    fx: {
      selectedFX: 'FILTER',
      filterValue: 50,
      reverbValue: 50,
      delayValue: 50
    }
  },
  masterBPM: 120,
  crossfaderPosition: 50,
  syncActive: false,
  recordingRemix: false,
  saveRemixState: 'idle'
});

export default function MixerPage({ onExit }: MixerPageProps) {
  const router = useRouter();
  const { 
    consumePendingLoads, 
    setShouldNavigateToMixer, 
    pendingTrackLoads,
    addLoadedTrack,
    removeLoadedTrack,
    clearLoadedTracks
  } = useMixer();
  
  // Initialize mixer state with persistence
  const [mixerState, setMixerState] = useState<MixerState>(() => {
    // TEMPORARY: Disable localStorage to test audio issue
    return getDefaultMixerState();
    // return loadMixerState() || getDefaultMixerState();
  });

  // 🎵 NEW: Remember last known master BPM to display when stopped
  const [lastKnownMasterBPM, setLastKnownMasterBPM] = useState<number>(120);
  
  // Recording preview state
  const [recordingPreview, setRecordingPreview] = useState<{
    url: string;
    duration: number;
    bars: number;
    bpm: number;
  } | null>(null);

  // FX Component refs
  const deckAFXRef = useRef<HTMLDivElement>(null);
  const deckBFXRef = useRef<HTMLDivElement>(null);

  // Use the new audio management hook
  const {
    audioInitialized,
    crossfaderGainRef,
    syncEngineRef,
    initializeAudio,
    cleanupDeckAudio,
    loadAudioForDeck,
    resetSyncState
  } = useMixerAudio();

  // Navigation cleanup hook
  useNavigationCleanup(async () => {
    console.log('🧹 MixerPage: Cleaning up before navigation');
    // Clean up any deck-specific audio controls
    if (mixerState.deckA.audioControls) {
      await cleanupDeckAudio(mixerState.deckA.audioControls, 'Deck A');
    }
    if (mixerState.deckB.audioControls) {
      await cleanupDeckAudio(mixerState.deckB.audioControls, 'Deck B');
    }
    // Save current state
    saveMixerState(mixerState);
  });

  // Initialize audio context on component mount
  useEffect(() => {
    initializeAudio();
    // Navigation cleanup hook handles all cleanup
  }, []); // Only run once on mount
  
  // Track audioInitialized changes
  useEffect(() => {
  }, [audioInitialized]);

  // Track loading functions with audio integration
  const loadTrackToDeckA = async (track: Track) => {
    
    // HOT-SWAP PROTECTION: Prevent rapid successive operations
    if (mixerState.deckA.loading) {
      console.log('⚠️ Deck A already loading, skipping hot-swap request');
      return;
    }
    
    // Fetch remix depth information for the track
    try {
      const { data, error } = await supabase
        .from('ip_tracks')
        .select('id, title, remix_depth, source_track_ids')
        .eq('id', track.id)
        .single();
      
      if (!error && data) {
        // Add to loaded tracks with remix depth info
        addLoadedTrack({
          id: data.id,
          title: data.title,
          remix_depth: data.remix_depth || 0,
          source_track_ids: data.source_track_ids || []
        });
        console.log(`📊 Track loaded with remix depth: ${data.remix_depth || 0}`);
      }
    } catch (error) {
      console.error('Failed to fetch remix depth:', error);
    }
    
    // 🎵 SIMPLIFIED: Single state update for loading
    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, loading: true, playing: false }
    }));
    
    if (!audioInitialized) {
      console.warn('⚠️ Audio system not initialized for Deck A, attempting to re-initialize...');
      try {
        await initializeAudio();
        console.log('✅ Audio system re-initialized successfully for Deck A');
      } catch (error) {
        console.error('🚨 Failed to re-initialize audio system for Deck A:', error);
        setMixerState(prev => ({
          ...prev,
          deckA: { ...prev.deckA, loading: false }
        }));
        return;
      }
    }

    try {
      // SIMPLIFIED CLEANUP: Clean existing audio
      await cleanupDeckAudio(mixerState.deckA.audioControls, 'Deck A');
      
      // Small delay for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Load new audio
      const audioResult = await loadAudioForDeck(track, 'Deck A');
      
      if (audioResult) {
        const { audioState, audioControls, trackBPM } = audioResult;
        
        // 🎵 SIMPLIFIED: Single comprehensive state update with loop reset
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
            // 🔄 RESET: Clean slate for loop settings when new track loads
            loop: 8,          // Default to full track (no loop brackets)
            loopPosition: 0   // Reset to track start
          }
        }));

        // Update last known master BPM
        setLastKnownMasterBPM(trackBPM);
        console.log(`🎵 Updated last known master BPM to: ${trackBPM} (track loaded to Deck A)`);

        // Connect FX if available (with retry for timing issues)
        const connectFX = (retryCount = 0) => {
          console.log(`🎛️ Attempting to connect Deck A FX (attempt ${retryCount + 1})`);
          
          if (deckAFXRef.current) {
            const hasAudioInput = !!(deckAFXRef.current as any).audioInput;
            const hasAudioOutput = !!(deckAFXRef.current as any).audioOutput;
            console.log(`🎛️ Deck A FX state - ref: true, audioInput: ${hasAudioInput}, audioOutput: ${hasAudioOutput}`);
            
            if (hasAudioInput && hasAudioOutput) {
              const fxInput = (deckAFXRef.current as any).audioInput as GainNode;
              const fxOutput = (deckAFXRef.current as any).audioOutput as GainNode;
              console.log(`🎛️ FX nodes found for Deck A - input:`, fxInput, 'output:', fxOutput);
              
              try {
                // Disconnect existing connections
                console.log('🎛️ Disconnecting existing audio connections for FX insertion');
                audioState.filterNode.disconnect();
                audioState.gainNode.disconnect();
                
                // Reconnect audio routing through FX: filter → FX → gain → analyzer
                console.log('🎛️ Connecting: filterNode → FX input');
                audioState.filterNode.connect(fxInput);
                console.log('🎛️ Connecting: FX output → gainNode');
                fxOutput.connect(audioState.gainNode);
                console.log('🎛️ Connecting: gainNode → analyzerNode');
                audioState.gainNode.connect(audioState.analyzerNode);
                
                console.log('🎛️ Deck A FX connected to audio chain successfully');
                console.log('🎛️ Full audio path: source → filter → FX → gain → analyzer → masterGain → destination');
                
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
          console.log('🎛️ Deck A FX not ready, using direct connection');
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

        // 🎵 BEAT-SYNC START: Simple check for other deck playing
        if (mixerState.deckB.playing && mixerState.deckB.audioState) {
          console.log('🎼 BEAT-SYNC: Will start Deck A on next downbeat');
          // Simplified beat sync calculation
          const deckBBPM = mixerState.deckB.audioState.bpm || mixerState.masterBPM;
          const secondsPerBar = (4 * 60) / deckBBPM; // 4 beats per bar
          const timeToNextDownbeat = secondsPerBar - (mixerState.deckB.audioState.currentTime % secondsPerBar);
          
          setTimeout(async () => {
            if (audioControls && typeof audioControls.play === 'function') {
              try {
                await audioControls.play();
                setMixerState(prev => ({
                  ...prev,
                  deckA: { ...prev.deckA, playing: true }
                }));
                console.log('🎼 BEAT-SYNC: Started Deck A on downbeat');
              } catch (error) {
                console.warn('⚠️ Beat-sync start failed:', error);
              }
            }
          }, (timeToNextDownbeat * 1000) + 200);
        }
      } else {
        // No audio URL - just update track info
        setMixerState(prev => ({
          ...prev,
          deckA: { 
            ...prev.deckA, 
            track,
            playing: false,
            audioControls: undefined,
            audioState: undefined,
            loading: false
          }
        }));
      }
    } catch (error) {
      console.error('🚨 Failed to load audio for Deck A:', error);
      
      // Reset on error
      setMixerState(prev => ({
        ...prev,
        deckA: { 
          ...prev.deckA, 
          track: null,
          playing: false,
          audioControls: undefined,
          audioState: undefined,
          loading: false
        }
      }));
    }
  };

  const loadTrackToDeckB = async (track: Track) => {
    
    // HOT-SWAP PROTECTION: Prevent rapid successive operations
    if (mixerState.deckB.loading) {
      console.log('⚠️ Deck B already loading, skipping hot-swap request');
      return;
    }
    
    // Fetch remix depth information for the track
    try {
      const { data, error } = await supabase
        .from('ip_tracks')
        .select('id, title, remix_depth, source_track_ids')
        .eq('id', track.id)
        .single();
      
      if (!error && data) {
        // Add to loaded tracks with remix depth info
        addLoadedTrack({
          id: data.id,
          title: data.title,
          remix_depth: data.remix_depth || 0,
          source_track_ids: data.source_track_ids || []
        });
        console.log(`📊 Track loaded with remix depth: ${data.remix_depth || 0}`);
      }
    } catch (error) {
      console.error('Failed to fetch remix depth:', error);
    }
    
    // 🎵 SIMPLIFIED: Single state update for loading
    setMixerState(prev => ({
      ...prev,
      deckB: { ...prev.deckB, loading: true, playing: false }
    }));
    
    if (!audioInitialized) {
      console.warn('⚠️ Audio system not initialized for Deck B, attempting to re-initialize...');
      try {
        await initializeAudio();
        console.log('✅ Audio system re-initialized successfully for Deck B');
      } catch (error) {
        console.error('🚨 Failed to re-initialize audio system for Deck B:', error);
        setMixerState(prev => ({
          ...prev,
          deckB: { ...prev.deckB, loading: false }
        }));
        return;
      }
    }

    try {
      // SIMPLIFIED CLEANUP: Clean existing audio
      await cleanupDeckAudio(mixerState.deckB.audioControls, 'Deck B');
      
      // Small delay for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Load new audio
      const audioResult = await loadAudioForDeck(track, 'Deck B');
      
      if (audioResult) {
        const { audioState, audioControls, trackBPM } = audioResult;
        
        // 🎵 SIMPLIFIED: Single comprehensive state update with loop reset
        setMixerState(prev => ({
          ...prev,
          deckB: { 
            ...prev.deckB, 
            track,
            playing: false,
            audioState,
            audioControls,
            loading: false,
            // 🔄 RESET: Clean slate for loop settings when new track loads
            loop: 8,          // Default to full track (no loop brackets)
            loopPosition: 0   // Reset to track start
          }
        }));

        console.log('✅ Deck B audio loaded successfully');
        
        // Connect FX if available (with retry for timing issues)
        const connectFX = (retryCount = 0) => {
          console.log(`🎛️ Attempting to connect Deck B FX (attempt ${retryCount + 1})`);
          
          if (deckBFXRef.current) {
            const hasAudioInput = !!(deckBFXRef.current as any).audioInput;
            const hasAudioOutput = !!(deckBFXRef.current as any).audioOutput;
            console.log(`🎛️ Deck B FX state - ref: true, audioInput: ${hasAudioInput}, audioOutput: ${hasAudioOutput}`);
            
            if (hasAudioInput && hasAudioOutput) {
              const fxInput = (deckBFXRef.current as any).audioInput as GainNode;
              const fxOutput = (deckBFXRef.current as any).audioOutput as GainNode;
              console.log(`🎛️ FX nodes found for Deck B - input:`, fxInput, 'output:', fxOutput);
              
              try {
                // Disconnect existing connections
                console.log('🎛️ Disconnecting existing audio connections for FX insertion');
                audioState.filterNode.disconnect();
                audioState.gainNode.disconnect();
                
                // Reconnect audio routing through FX: filter → FX → gain → analyzer
                console.log('🎛️ Connecting: filterNode → FX input');
                audioState.filterNode.connect(fxInput);
                console.log('🎛️ Connecting: FX output → gainNode');
                fxOutput.connect(audioState.gainNode);
                console.log('🎛️ Connecting: gainNode → analyzerNode');
                audioState.gainNode.connect(audioState.analyzerNode);
                
                console.log('🎛️ Deck B FX connected to audio chain successfully');
                console.log('🎛️ Full audio path: source → filter → FX → gain → analyzer → masterGain → destination');
                
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
          console.log('🎛️ Deck B FX not ready, using direct connection');
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
        
        // 🎵 BEAT-SYNC START: Simple check for other deck playing
        if (mixerState.deckA.playing && mixerState.deckA.audioState) {
          console.log('🎼 BEAT-SYNC: Will start Deck B on next downbeat');
          // Simplified beat sync calculation
                     const deckABPM = mixerState.deckA.audioState.bpm || mixerState.masterBPM;
          const secondsPerBar = (4 * 60) / deckABPM; // 4 beats per bar
          const timeToNextDownbeat = secondsPerBar - (mixerState.deckA.audioState.currentTime % secondsPerBar);
          
          setTimeout(async () => {
            if (audioControls && typeof audioControls.play === 'function') {
              try {
                await audioControls.play();
                setMixerState(prev => ({
                  ...prev,
                  deckB: { ...prev.deckB, playing: true }
                }));
                console.log('🎼 BEAT-SYNC: Started Deck B on downbeat');
              } catch (error) {
                console.warn('⚠️ Beat-sync start failed:', error);
              }
            }
          }, (timeToNextDownbeat * 1000) + 200);
        }
      } else {
        // No audio URL - just update track info with loop reset
        setMixerState(prev => ({
          ...prev,
          deckB: { 
            ...prev.deckB, 
            track,
            playing: false,
            audioControls: undefined,
            audioState: undefined,
            loading: false,
            // 🔄 RESET: Clean slate for loop settings even without audio
            loop: 8,          // Default to full track
            loopPosition: 0   // Reset to track start
          }
        }));
      }
    } catch (error) {
      console.error('🚨 Failed to load audio for Deck B:', error);
      
      // Reset on error with clean loop state
      setMixerState(prev => ({
        ...prev,
        deckB: { 
          ...prev.deckB, 
          track: null,
          playing: false,
          audioControls: undefined,
          audioState: undefined,
          loading: false,
          // 🔄 RESET: Clean slate for loop settings on error too
          loop: 8,          // Default to full track
          loopPosition: 0   // Reset to track start
        }
      }));
    }
  };

  // Check for pending track loads on component mount and when new loads are added
  useEffect(() => {
    // Removed spammy debug logs for cleaner console
    
    if (pendingTrackLoads.length > 0) {
      
      const pendingLoads = consumePendingLoads();
      
      pendingLoads.forEach(({ track, deck }) => {
        if (deck === 'A') {
          loadTrackToDeckA(track);
        } else if (deck === 'B') {
          loadTrackToDeckB(track);
        }
      });
      
      // Clear navigation flag since we're now in the mixer
      setShouldNavigateToMixer(false);
      
    }
  }, [pendingTrackLoads.length, consumePendingLoads, loadTrackToDeckA, loadTrackToDeckB, setShouldNavigateToMixer]); // Run when pending loads change

  // Auto-save mixer state to localStorage whenever it changes
  useEffect(() => {
    // TEMPORARY: Disable auto-save for debugging (silent)
    // saveMixerState(mixerState);
  }, [mixerState]);

  // 🎨 NEW: Real-time current time tracking for waveform playback position
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

    // Update current time every 100ms when either deck is playing
    const interval = setInterval(updateCurrentTime, 100);
    
    return () => clearInterval(interval);
  }, [mixerState.deckA.playing, mixerState.deckB.playing]);

  // Save state (but exclude runtime audio objects)

  // Helper to get the actual master BPM (Deck A when playing, otherwise last known)
  // NOTE: playing state is runtime-only, never persisted to localStorage
  const getActualMasterBPM = () => {
    const deckAPlaying = mixerState.deckA.playing;
    const deckATrack = mixerState.deckA.track;
    const deckABPM = deckATrack?.bpm;
    
    // 🎵 ENHANCED: Always show current master BPM when playing, last known when stopped
    const displayBPM = deckAPlaying && deckABPM ? mixerState.masterBPM : lastKnownMasterBPM;
    
    // 🎵 DEBUG: Simple logging to track BPM accuracy
    if (deckAPlaying) {
      console.log(`🎛️ BPM DISPLAY: Showing ${displayBPM} BPM (masterState: ${mixerState.masterBPM}, track: ${deckABPM})`);
    }
    
    return displayBPM;
  };

  // Removed problematic resetSyncState function that was causing conflicts

  // 🎵 Reset everything to original track settings  
  const resetToOriginal = () => {
    console.log('🔄 RESET: Restoring tracks to original settings');
    
    // Reset sync state first
    if (syncEngineRef.current) {
      syncEngineRef.current.disableSync();
      syncEngineRef.current = null;
    }
    setMixerState(prev => ({ ...prev, syncActive: false }));
    console.log('🔄 RESET: Sync state cleared');
    
    // Get original track BPMs
    const deckAOriginalBPM = mixerState.deckA.track?.bpm || 120;
    const deckBOriginalBPM = mixerState.deckB.track?.bpm || 120;
    
    // Reset master BPM to Deck A original
    setMixerState(prev => ({
      ...prev,
      masterBPM: deckAOriginalBPM,
      deckA: { ...prev.deckA, loop: 8, loopPosition: 0 },
      deckB: { ...prev.deckB, loop: 8, loopPosition: 0 }
    }));
    
    // Reset audio controls to original settings
    if (mixerState.deckA.audioControls) {
      mixerState.deckA.audioControls.setPlaybackRate(1.0); // Original speed
      mixerState.deckA.audioControls.setBPM(deckAOriginalBPM);
      mixerState.deckA.audioControls.setLoopLength(8);
      mixerState.deckA.audioControls.setLoopPosition(0);
    }
    
    if (mixerState.deckB.audioControls) {
      mixerState.deckB.audioControls.setPlaybackRate(1.0); // Original speed  
      mixerState.deckB.audioControls.setBPM(deckBOriginalBPM);
      mixerState.deckB.audioControls.setLoopLength(8);
      mixerState.deckB.audioControls.setLoopPosition(0);
    }
    
    setLastKnownMasterBPM(deckAOriginalBPM);
    console.log(`🔄 RESET: Restored to original settings (Deck A: ${deckAOriginalBPM} BPM, 8-bar loops)`);
  };

  // 🔄 SIMPLE MASTER RESET: Stop transport, both tracks to start
  const handleMasterSyncReset = () => {
    console.log('🔄 MASTER RESET: Stopping transport and resetting both tracks to start');
    
    const deckAControls = mixerState.deckA.audioControls;
    const deckBControls = mixerState.deckB.audioControls;
    
    if (!deckAControls && !deckBControls) {
      console.warn('⚠️ No audio loaded on either deck');
      return;
    }

    try {
      // 1. Stop both decks (pause transport)
      if (deckAControls) {
        deckAControls.pause();
      }
      if (deckBControls) {
        deckBControls.pause();
      }

      // 2. Reset both tracks to position 0 (track start)
      if (deckAControls) {
        deckAControls.setLoopPosition(0);
        console.log('🔄 RESET: Deck A reset to track start');
      }
      
      if (deckBControls) {
        deckBControls.setLoopPosition(0);
        console.log('🔄 RESET: Deck B reset to track start');
      }

      // 3. Update state - both decks stopped, positions at 0
      setMixerState(prev => ({
        ...prev,
        deckA: { ...prev.deckA, playing: false, loopPosition: 0 },
        deckB: { ...prev.deckB, playing: false, loopPosition: 0 }
      }));
      
      console.log('🔄 MASTER RESET: Complete! Press play when ready.');
      
    } catch (error) {
      console.error('🚨 MASTER RESET: Failed:', error);
    }
  };

  // 🎯 Individual Deck Reset Handlers
  const handleDeckARestart = () => {
    
    if (!mixerState.deckA.audioControls) {
      console.warn('⚠️ No audio loaded on Deck A');
      return;
    }

    try {
      // Reset to beginning of track (position 0)
      mixerState.deckA.audioControls.setLoopPosition(0);
      
      // Update state
      setMixerState(prev => ({
        ...prev,
        deckA: { ...prev.deckA, loopPosition: 0 }
      }));
      
    } catch (error) {
      console.error('🚨 DECK A RESTART: Failed:', error);
    }
  };

  const handleDeckBRestart = () => {
    
    if (!mixerState.deckB.audioControls) {
      console.warn('⚠️ No audio loaded on Deck B');
      return;
    }

    try {
      // Reset to beginning of track (position 0)
      mixerState.deckB.audioControls.setLoopPosition(0);
      
      // Update state
      setMixerState(prev => ({
        ...prev,
        deckB: { ...prev.deckB, loopPosition: 0 }
      }));
      
    } catch (error) {
      console.error('🚨 DECK B RESTART: Failed:', error);
    }
  };

  // Handler functions
  const handleBPMChange = (delta: number) => {
    // 🎵 PROFESSIONAL DJ-style BPM adjustment with smart constraints
    const currentMasterBPM = mixerState.masterBPM;
    const trackBPM = mixerState.deckA.track?.bpm;
    const isPlaying = mixerState.deckA.playing || mixerState.deckB.playing;
    
    let newBPM = currentMasterBPM + delta;
    
    // 🎯 MC CLAUDE'S SMART CONSTRAINTS: ±10% while playing, unlimited when stopped
    if (isPlaying && trackBPM) {
      const tenPercentRange = trackBPM * 0.1;
      const minAllowed = trackBPM - tenPercentRange;
      const maxAllowed = trackBPM + tenPercentRange;
      
      // Constrain to ±10% of original track BPM while playing
      newBPM = Math.max(minAllowed, Math.min(maxAllowed, newBPM));
      
      console.log(`🎛️ BPM CONSTRAINT: Playing mode - limited to ${minAllowed.toFixed(1)}-${maxAllowed.toFixed(1)} BPM (±10% of ${trackBPM})`);
    } else {
      // Full range when stopped (60-200 BPM)
      newBPM = Math.max(60, Math.min(200, newBPM));
      
      if (!isPlaying) {
        console.log(`🎛️ BPM FREEDOM: Stopped mode - full range available (60-200 BPM)`);
      }
    }
    
    console.log(`🎛️ BPM CHANGE DEBUG:`, {
      currentMasterBPM,
      trackBPM,
      delta,
      newBPM,
      deckAPlaying: mixerState.deckA.playing
    });
    
    // Simple approach: let sync handle BPM changes without frequent resets
    
    // Update master BPM state
    setMixerState(prev => ({
      ...prev,
      masterBPM: newBPM
    }));
    
    // 🎵 NEW: Update last known master BPM when manual BPM changes
    setLastKnownMasterBPM(newBPM);
    
    // 🎵 PROFESSIONAL FEATURE: Apply real-time tempo adjustment to playing deck
    if (mixerState.deckA.playing && mixerState.deckA.audioControls) {
      // Calculate playback rate to achieve target BPM
      const originalBPM = mixerState.deckA.track?.bpm || 120;
      const playbackRate = newBPM / originalBPM;
      
      // 🔄 FIXED: Update both playback rate AND looper BPM for smooth looping
      mixerState.deckA.audioControls.setPlaybackRate(playbackRate);
      mixerState.deckA.audioControls.setBPM(newBPM); // This updates PreciseLooper calculations!
      
      // 🎯 SYNC FIX: Also update audioState BPM so sync engine can track it
      if (mixerState.deckA.audioState) {
        mixerState.deckA.audioState.bpm = newBPM;
      }
      
      console.log(`🎵 REAL-TIME BPM: Deck A tempo adjusted from ${originalBPM} to ${newBPM} BPM (rate: ${playbackRate.toFixed(3)}x, looper updated)`);
    }
    
    // Update sync engine if active
    if (mixerState.syncActive && syncEngineRef.current) {
      console.log('🔄 SYNC: Updating Deck B to follow new master tempo');
      try {
        syncEngineRef.current.updateMasterBPM(newBPM);
      } catch (error) {
        console.warn('⚠️ SYNC: Failed to update master BPM:', error);
      }
    }
    
    console.log(`🎵 Updated master BPM to: ${newBPM} (${mixerState.deckA.playing ? 'applied to playing deck' : 'ready for next play'})`);
  };

  // 🔄 AUTO-SYNC: If sync is enabled and both decks are now playing, apply sync
  const applySyncNow = useCallback(async () => {
    try {
      console.log('🔄 SYNC: Applying sync to currently playing tracks...');
      
      const audioContext = mixerState.deckA.audioState.audioContext;
      
      // 🎯 FIX: Ensure correct BPM values for sync engine
      if (mixerState.deckA.track?.bpm && mixerState.deckA.audioState) {
        // Deck A (master) should use current master BPM, not original track BPM
        mixerState.deckA.audioState.bpm = mixerState.masterBPM;
        console.log(`🎯 SYNC SETUP: Deck A BPM set to current master: ${mixerState.masterBPM}`);
      }
      
      if (mixerState.deckB.track?.bpm && mixerState.deckB.audioState) {
        // Deck B (slave) should use original track BPM for sync calculation
        mixerState.deckB.audioState.bpm = mixerState.deckB.track.bpm;
        console.log(`🎯 SYNC SETUP: Deck B BPM set to original track: ${mixerState.deckB.track.bpm}`);
      }
      
      // Enhanced audioState objects with controls and track info for sync
      const deckAWithControls = {
        ...mixerState.deckA.audioState,
        audioControls: mixerState.deckA.audioControls,
        track: mixerState.deckA.track
      };
      
      const deckBWithControls = {
        ...mixerState.deckB.audioState,
        audioControls: mixerState.deckB.audioControls,
        track: mixerState.deckB.track
      };
      
      // Create fresh sync engine
      syncEngineRef.current = new SimpleLoopSync(
        audioContext,
        deckAWithControls, // Master deck (Deck A) with full state
        deckBWithControls  // Slave deck (Deck B) with full state
      );
      
      // Apply sync immediately
      const syncTime = await syncEngineRef.current.enableSync();
      if (syncTime) {
        console.log(`✅ SYNC: Applied successfully! Time-stretching active.`);
      } else {
        console.warn('🚨 SYNC: Failed to apply - enableSync returned null');
      }
    } catch (error) {
      console.error('🚨 SYNC: Error applying sync:', error);
    }
  }, [mixerState.deckA, mixerState.deckB, mixerState.masterBPM]);

  // 🎵 SIMPLIFIED: Play/pause handlers with single state updates
  const handleDeckAPlayPause = useCallback(async () => {
    const { audioControls, audioState, playing } = mixerState.deckA;
    
    if (!audioControls || !audioState) {
      console.warn('⚠️ No audio loaded for Deck A');
      setMixerState(prev => ({
        ...prev,
        deckA: { ...prev.deckA, playing: false }
      }));
      return;
    }

    try {
      if (playing) {
        // Pause
        console.log('⏸️ Pausing Deck A');
        audioControls.pause();
        setMixerState(prev => ({
          ...prev,
          deckA: { ...prev.deckA, playing: false }
        }));
      } else {
        // Play
        console.log('▶️ Playing Deck A');
        await audioControls.play();
        setMixerState(prev => ({
          ...prev,
          deckA: { ...prev.deckA, playing: true }
        }));
        
        // Auto-apply sync if enabled and other deck is playing
        if (mixerState.syncActive && mixerState.deckB.playing) {
          setTimeout(() => applySyncNow(), 50);
        }
      }
    } catch (error) {
      console.error('🚨 Failed to control Deck A playback:', error);
      setMixerState(prev => ({
        ...prev,
        deckA: { ...prev.deckA, playing: false }
      }));
    }
  }, [mixerState.deckA, applySyncNow]);

  const handleDeckBPlayPause = useCallback(async () => {
    const { audioControls, audioState, playing } = mixerState.deckB;
    
    if (!audioControls || !audioState) {
      console.warn('⚠️ No audio loaded for Deck B');
      setMixerState(prev => ({
        ...prev,
        deckB: { ...prev.deckB, playing: false }
      }));
      return;
    }

    try {
      if (playing) {
        // Pause
        console.log('⏸️ Pausing Deck B');
        audioControls.pause();
        setMixerState(prev => ({
          ...prev,
          deckB: { ...prev.deckB, playing: false }
        }));
      } else {
        // Play
        console.log('▶️ Playing Deck B');
        await audioControls.play();
        setMixerState(prev => ({
          ...prev,
          deckB: { ...prev.deckB, playing: true }
        }));
        
        // Auto-apply sync if enabled and other deck is playing
        if (mixerState.syncActive && mixerState.deckA.playing) {
          setTimeout(() => applySyncNow(), 50);
        }
      }
    } catch (error) {
      console.error('🚨 Failed to control Deck B playback:', error);
      setMixerState(prev => ({
        ...prev,
        deckB: { ...prev.deckB, playing: false }
      }));
    }
  }, [mixerState.deckB, mixerState.syncActive, mixerState.deckA.playing, applySyncNow]);

  const handleSync = useCallback(async () => {
    const newSyncState = !mixerState.syncActive;
    
    console.log(`🎛️ SYNC: Toggle requested - ${newSyncState ? 'ENABLING' : 'DISABLING'} sync`);
    
    if (newSyncState) {
      // ENABLING SYNC
      const deckAReady = mixerState.deckA.audioState && mixerState.deckA.track;
      const deckBReady = mixerState.deckB.audioState && mixerState.deckB.track;
      
      if (!deckAReady || !deckBReady) {
        console.warn('🚨 SYNC: Cannot enable - both decks need tracks loaded');
        return;
      }
      
      // Apply sync if both decks are playing
      if (mixerState.deckA.playing && mixerState.deckB.playing) {
        console.log('🎛️ SYNC: Both decks playing - applying sync immediately');
        await applySyncNow();
      } else {
        console.log('🎛️ SYNC: Will apply when both decks are playing');
      }
      
    } else {
      // DISABLING SYNC
      console.log('🎛️ SYNC: Disabling sync...');
      if (syncEngineRef.current) {
        syncEngineRef.current.disableSync();
        syncEngineRef.current = null;
        console.log('✅ SYNC: Sync disabled and engine cleared');
      }
    }
    
    // Update the state
    setMixerState(prev => ({ ...prev, syncActive: newSyncState }));
    console.log(`✅ SYNC: State updated - syncActive: ${newSyncState}`);
  }, [mixerState.syncActive, mixerState.deckA, mixerState.deckB, applySyncNow]);

  // Additional handlers  
  const handleDeckALoopChange = useCallback((length: number) => {
    console.log(`🔄 LOOP CHANGE: Deck A loop length changed to ${length} bars`);
    
    // Simple approach: just update the loop length
    if (mixerState.deckA.audioControls) {
      mixerState.deckA.audioControls.setLoopLength(length);
    }
    
    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, loop: length }
    }));
  }, [mixerState.deckA.audioControls]);

  const handleDeckBLoopChange = useCallback((length: number) => {
    console.log(`🔄 LOOP CHANGE: Deck B loop length changed to ${length} bars`);
    
    // Simple approach: just update the loop length
    if (mixerState.deckB.audioControls) {
      mixerState.deckB.audioControls.setLoopLength(length);
    }
    
    setMixerState(prev => ({
      ...prev,
      deckB: { ...prev.deckB, loop: length }
    }));
  }, [mixerState.deckB.audioControls]);

  const handleDeckALoopToggle = useCallback(() => {
    const newLoopEnabled = !mixerState.deckA.loopEnabled;
    console.log(`🔄 LOOP TOGGLE: Deck A loop ${newLoopEnabled ? 'ENABLED' : 'DISABLED'}`);
    
    if (mixerState.deckA.audioControls) {
      mixerState.deckA.audioControls.setLoopEnabled(newLoopEnabled);
    }
    
    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, loopEnabled: newLoopEnabled }
    }));
  }, [mixerState.deckA.loopEnabled, mixerState.deckA.audioControls]);

  const handleDeckBLoopToggle = useCallback(() => {
    const newLoopEnabled = !mixerState.deckB.loopEnabled;
    console.log(`🔄 LOOP TOGGLE: Deck B loop ${newLoopEnabled ? 'ENABLED' : 'DISABLED'}`);
    
    if (mixerState.deckB.audioControls) {
      mixerState.deckB.audioControls.setLoopEnabled(newLoopEnabled);
    }
    
    setMixerState(prev => ({
      ...prev,
      deckB: { ...prev.deckB, loopEnabled: newLoopEnabled }
    }));
  }, [mixerState.deckB.loopEnabled, mixerState.deckB.audioControls]);

  const handleDeckALoopPositionChange = useCallback((position: number) => {
    console.log(`🎯 POSITION: Deck A loop position changed to bar ${position}`);
    
    if (mixerState.deckA.audioControls) {
      mixerState.deckA.audioControls.setLoopPosition(position);
    }
    
    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, loopPosition: position }
    }));
  }, [mixerState.deckA.audioControls]);

  const handleDeckBLoopPositionChange = useCallback((position: number) => {
    console.log(`🎯 POSITION: Deck B loop position changed to bar ${position}`);
    
    if (mixerState.deckB.audioControls) {
      mixerState.deckB.audioControls.setLoopPosition(position);
    }
    
    setMixerState(prev => ({
      ...prev,
      deckB: { ...prev.deckB, loopPosition: position }
    }));
  }, [mixerState.deckB.audioControls]);

  const handleDeckAFXChange = useCallback((newFX: Partial<FXState>) => {
    const { audioControls } = mixerState.deckA;
    
    if (audioControls && newFX.filterValue !== undefined) {
      const filterValue = (newFX.filterValue - 50) / 50;
      audioControls.setFilterValue(filterValue);
      console.log(`🎛️ Deck A filter: ${newFX.filterValue}% (${filterValue.toFixed(2)})`);
    }
    
    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, fx: { ...prev.deckA.fx, ...newFX } }
    }));
  }, [mixerState.deckA.audioControls]);

  const handleDeckBFXChange = (newFX: Partial<FXState>) => {
    const { audioControls } = mixerState.deckB;
    
    if (audioControls && newFX.filterValue !== undefined) {
      const filterValue = (newFX.filterValue - 50) / 50;
      audioControls.setFilterValue(filterValue);
      console.log(`🎛️ Deck B filter: ${newFX.filterValue}% (${filterValue.toFixed(2)})`);
    }
    
    setMixerState(prev => ({
      ...prev,
      deckB: { ...prev.deckB, fx: { ...prev.deckB.fx, ...newFX } }
    }));
  };

  const handleCrossfaderChange = useCallback((position: number) => {
    const { deckA, deckB } = crossfaderGainRef.current;
    if (deckA && deckB) {
      const normalizedPosition = position / 100;
      applyCrossfader(deckA, deckB, normalizedPosition);
      console.log(`🎚️ Crossfader: ${position}%`);
    }
    
    setMixerState(prev => ({ ...prev, crossfaderPosition: position }));
  }, []);



  const handleRecordToggle = async () => {
    const isRecording = mixerState.recordingRemix;
    
    if (!isRecording) {
      // Start recording
      // Get audio context and master gain node
      const audioContext = await getAudioContext();
      if (!audioContext) {
        console.error('❌ No audio context available');
        return;
      }

      // Get the master gain node
      const masterGain = getMasterGain();
      if (!masterGain) {
        console.error('❌ No master gain node available');
        return;
      }

      // Calculate current BPM (use Deck A's BPM if playing, otherwise master BPM)
      const currentBPM = mixerState.deckA.playing && mixerState.deckA.track?.bpm 
        ? mixerState.deckA.track.bpm 
        : mixerState.masterBPM;

      console.log('🎤 Starting 64-bar recording at', currentBPM, 'BPM');
      
      // Update state to show recording
      setMixerState(prev => ({ ...prev, recordingRemix: true }));

      // Capture BPM for use in the callback
      const recordingBPM = currentBPM;

      // Start recording 64 bars (this returns a promise that resolves when done)
      mixerRecorder.startRecording({
        bars: 64,
        bpm: recordingBPM,
        audioContext: audioContext,
        sourceNode: masterGain
      }).then(recordingResult => {
        // Recording complete - save the result
        console.log('✅ Recording complete:', recordingResult);
        console.log('🎵 Recording URL:', recordingResult.url);
        
        // Stop the mixer playback so user can preview recording
        handleMasterStop();
        
        // Show the recording preview
        setRecordingPreview({
          url: recordingResult.url,
          duration: recordingResult.duration,
          bars: recordingResult.bars,
          bpm: recordingBPM
        });
        
        // Update state
        setMixerState(prev => ({ ...prev, recordingRemix: false }));
      }).catch(error => {
        console.error('❌ Recording failed:', error);
        setMixerState(prev => ({ ...prev, recordingRemix: false }));
      });
    } else {
      // Stop recording early
      console.log('⏹️ Stopping recording early');
      
      // Get current BPM for effects tail capture
      const currentBPM = mixerState.deckA.playing && mixerState.deckA.track?.bpm 
        ? mixerState.deckA.track.bpm 
        : mixerState.masterBPM;
      
      // Stop recording with 1 bar delay to capture effects tail
      mixerRecorder.stopRecording(true, currentBPM);
      
      // Stop the mixer playback when stopping recording early
      handleMasterStop();
      
      setMixerState(prev => ({ ...prev, recordingRemix: false }));
    }
  };

  // FX handlers removed - FX are always in the chain

  // 🎯 MASTER TRANSPORT CONTROLS - Coordinated deck control with count-in
  const handleMasterPlay = () => {
    console.log('🎵 MASTER TRANSPORT: Master play triggered');
    
    // Determine which decks to play based on what's loaded
    const deckACanPlay = mixerState.deckA.audioControls && mixerState.deckA.track;
    const deckBCanPlay = mixerState.deckB.audioControls && mixerState.deckB.track;
    
    if (!deckACanPlay && !deckBCanPlay) {
      console.warn('🎵 MASTER TRANSPORT: No playable tracks loaded');
      return;
    }
    
    // This is the count-in trigger - actual play happens in handleMasterPlayAfterCountIn
    console.log('🎵 MASTER TRANSPORT: Count-in will trigger, then play all available decks');
  };

  // Direct play function called after count-in completes
  const handleMasterPlayAfterCountIn = useCallback(async () => {
    console.log('🎵 MASTER TRANSPORT: Playing after count-in complete');
    
    // Determine which decks to play based on what's loaded
    const deckACanPlay = mixerState.deckA.audioControls && mixerState.deckA.track;
    const deckBCanPlay = mixerState.deckB.audioControls && mixerState.deckB.track;
    
    if (!deckACanPlay && !deckBCanPlay) {
      console.warn('🎵 MASTER TRANSPORT: No playable tracks loaded');
      return;
    }
    
    // Always start both decks that are available
    console.log(`🎵 MASTER TRANSPORT: Starting all available decks (Sync: ${mixerState.syncActive ? 'ON' : 'OFF'})`);
    
    // Start Deck A if available and not playing
    if (deckACanPlay && !mixerState.deckA.playing) {
      console.log('🎵 MASTER TRANSPORT: Starting Deck A');
      await handleDeckAPlayPause();
      // Update last known master BPM from Deck A (always master)
      if (mixerState.deckA.track?.bpm) {
        setLastKnownMasterBPM(mixerState.deckA.track.bpm);
      }
    }
    
    // Start Deck B if available and not playing
    if (deckBCanPlay && !mixerState.deckB.playing) {
      console.log('🎵 MASTER TRANSPORT: Starting Deck B');
      await handleDeckBPlayPause();
    }
    
    // 🎯 CRITICAL: Apply sync AFTER both decks are playing
    if (mixerState.syncActive && deckACanPlay && deckBCanPlay) {
      console.log('🎵 MASTER TRANSPORT: Applying sync now that both decks are playing...');
      
      // Small delay to ensure audio elements are fully started
      setTimeout(async () => {
        await applySyncNow();
      }, 100); // 100ms delay to ensure audio is playing
    }
    
    // Log the result
    if (deckACanPlay && deckBCanPlay) {
      console.log(`🎵 MASTER TRANSPORT: Both decks started! ${mixerState.syncActive ? 'Sync will be applied shortly.' : 'Playing at independent BPMs.'}`);
    } else if (deckACanPlay) {
      console.log('🎵 MASTER TRANSPORT: Deck A started (Deck B not loaded)');
    } else if (deckBCanPlay) {
      console.log('🎵 MASTER TRANSPORT: Deck B started (Deck A not loaded)');
    }
  }, [mixerState.deckA, mixerState.deckB, mixerState.syncActive, handleDeckAPlayPause, handleDeckBPlayPause, applySyncNow]);

  const handleMasterStop = useCallback(() => {
    console.log('🎵 MASTER TRANSPORT: Master stop triggered');
    
    // 🎵 FIXED: Force immediate state reset to prevent play button getting stuck
    const wasAnyPlaying = mixerState.deckA.playing || mixerState.deckB.playing;
    
    if (wasAnyPlaying) {
      // Force immediate state update - don't rely on individual deck handlers
      setMixerState(prev => ({
        ...prev,
        deckA: { ...prev.deckA, playing: false },
        deckB: { ...prev.deckB, playing: false },
        syncActive: false // Also disable sync immediately
      }));
      
      // Then call the audio controls
      if (mixerState.deckA.playing && mixerState.deckA.audioControls) {
        console.log('🎵 MASTER TRANSPORT: Stopping Deck A audio');
        mixerState.deckA.audioControls.pause();
      }
      
      if (mixerState.deckB.playing && mixerState.deckB.audioControls) {
        console.log('🎵 MASTER TRANSPORT: Stopping Deck B audio');
        mixerState.deckB.audioControls.pause();
      }
      
      // Disable sync if active
      if (mixerState.syncActive && syncEngineRef.current) {
        syncEngineRef.current.disableSync();
        syncEngineRef.current = null;
        console.log('🎵 MASTER TRANSPORT: Sync engine disabled and cleared');
      }
      
      console.log('🎵 MASTER TRANSPORT: All decks stopped, state reset immediately');
    } else {
      console.log('🎵 MASTER TRANSPORT: No decks were playing');
    }
  }, [mixerState.deckA, mixerState.deckB, mixerState.syncActive]);

  const handleExit = useCallback(() => {
    if (onExit) {
      onExit();
    } else {
      router.push('/');
    }
  }, [onExit, router]);

  // Handle drag and drop from crates to decks
  const handleTrackDropToDeckA = useCallback((track: Track) => {
    loadTrackToDeckA(track);
  }, [loadTrackToDeckA, audioInitialized]);

  const handleTrackDropToDeckB = useCallback((track: Track) => {
    loadTrackToDeckB(track);
  }, [loadTrackToDeckB]);

  // Reset mixer to default state (useful for clearing loaded tracks)
  const handleResetMixer = useCallback(() => {
    console.log('🔄 Resetting mixer to default state');
    setMixerState(getDefaultMixerState());
    
    // Also clear from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(MIXER_STATE_KEY);
      console.log('🗑️ Mixer state cleared from localStorage');
    }
  }, []);

  return (
    <div className="w-full bg-slate-900 text-white overflow-hidden" style={{ height: 'calc(100vh - 80px)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Main Mixer Section */}
      <div className="h-full max-h-[800px] px-5 pt-5 pb-3 flex flex-col gap-3">
        {/* Top Section - Carousels, Crates and Master BPM */}
        <div className="flex justify-between items-center flex-shrink-0 mb-4">
          {/* Left Group: Deck A + Crate A */}
          <div className="flex items-center gap-12">
            {/* Deck A */}
            <Deck 
              currentTrack={mixerState.deckA.track}
              isPlaying={mixerState.deckA.playing}
              onTrackDrop={handleTrackDropToDeckA}
              deck="A"
            />

            {/* Deck A Crate */}
            <DeckCrate 
              deck="A"
              currentTrack={mixerState.deckA.track}
              loading={mixerState.deckA.loading}
            />
          </div>

          {/* Master BPM Control */}
          <div className="bmp-section flex flex-col items-center gap-4">
            {/* BPM Number and Controls - Aligned */}
            <div className="bmp-controls flex items-center justify-center gap-4">
              <button 
                onClick={() => handleBPMChange(-1)}
                className={`bmp-btn bg-transparent border rounded-full transition-all flex items-center justify-center border-slate-600 text-slate-300 hover:text-slate-200 hover:border-slate-500 hover:scale-105 active:scale-95`}
                style={{ 
                  width: '36px', 
                  height: '36px', 
                  fontSize: '20px',
                  lineHeight: '0',
                  padding: '0',
                  position: 'relative',
                  top: '-1px' // Fine-tune vertical alignment
                }}
                title="Decrease BPM (works during playback)"
              >
                <span style={{ position: 'relative', top: '-1px' }}>−</span>
              </button>
              <div className="text-6xl font-bold text-slate-200">
                {/* Show actual master BPM using helper function */}
                {getActualMasterBPM()}
              </div>
              <button 
                onClick={() => handleBPMChange(1)}
                className={`bmp-btn bg-transparent border rounded-full transition-all flex items-center justify-center border-slate-600 text-slate-300 hover:text-slate-200 hover:border-slate-500 hover:scale-105 active:scale-95`}
                style={{ 
                  width: '36px', 
                  height: '36px', 
                  fontSize: '18px',
                  lineHeight: '0',
                  padding: '0',
                  position: 'relative',
                  top: '-1px' // Fine-tune vertical alignment
                }}
                title="Increase BPM (works during playback)"
              >
                <span style={{ position: 'relative', top: '-2px' }}>+</span>
              </button>
            </div>
            {/* BPM Label - Shows source */}
            <div className="bmp-label text-xs text-slate-500 uppercase tracking-wider">
              {mixerState.deckA.playing && mixerState.deckA.track?.bpm 
                ? `Deck A BPM (${mixerState.masterBPM !== mixerState.deckA.track.bpm ? 'Tempo Adjusted' : 'Master'})` 
                : 'Manual BPM Control'}
            </div>
            
            {/* 🎯 MASTER TRANSPORT CONTROLS */}
            <MasterTransportControls
              deckALoaded={!!mixerState.deckA.track && !!mixerState.deckA.audioControls}
              deckBLoaded={!!mixerState.deckB.track && !!mixerState.deckB.audioControls}
              deckAPlaying={mixerState.deckA.playing}
              deckBPlaying={mixerState.deckB.playing}
              deckABPM={mixerState.deckA.track?.bpm || getActualMasterBPM()}
              syncActive={mixerState.syncActive}
              recordingRemix={mixerState.recordingRemix}
              onMasterPlay={handleMasterPlay}
              onMasterPlayAfterCountIn={handleMasterPlayAfterCountIn}
              onMasterStop={handleMasterStop}
              onRecordToggle={handleRecordToggle}
              onSyncToggle={handleSync}
              onMasterSyncReset={handleMasterSyncReset}
            />
          </div>

          {/* Right Group: Crate B + Deck B */}
          <div className="flex items-center gap-12">
            {/* Deck B Crate */}
            <DeckCrate 
              deck="B"
              currentTrack={mixerState.deckB.track}
              loading={mixerState.deckB.loading}
            />

            {/* Deck B */}
            <Deck 
              currentTrack={mixerState.deckB.track}
              isPlaying={mixerState.deckB.playing}
              onTrackDrop={handleTrackDropToDeckB}
              deck="B"
            />
          </div>
        </div>

        {/* Middle Section - FX and Waveform */}
        <div className="grid gap-5 flex-1 h-auto max-h-[280px] items-stretch" style={{ gridTemplateColumns: '200px 1fr 200px' }}>
          {/* Deck A FX - Fixed 200px width */}
          <div className="w-full h-full">
            {audioInitialized ? (
              <FXComponent 
                ref={deckAFXRef}
                audioContext={getAudioContext()}
                deckId="deckA"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <span>Initializing FX...</span>
              </div>
            )}
          </div>

          {/* Waveform Display - Content-Aware Analysis */}
          <div className="h-full max-h-[250px] space-y-4">
            {/* Deck A Waveform */}
            <div className="h-24 flex flex-col items-center">
              <div 
                className="mb-1 font-mono"
                style={{
                  fontSize: '12px',
                  color: '#999',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  opacity: 0.9
                }}
              >
                DECK A: {mixerState.deckA.track?.title || 'No track loaded'}
              </div>
              <WaveformDisplay 
                audioBuffer={mixerState.deckA.audioState?.audioBuffer}
                loopBoundaries={mixerState.deckA.audioState?.preciseLooper?.getLoopBoundaries() || null}
                currentTime={mixerState.deckA.audioState?.currentTime || 0}
                isPlaying={mixerState.deckA.playing}
                width={700}
                height={80}
                className="border border-emerald-500/30"
                // 🎯 NEW: Loop position props
                trackBPM={mixerState.deckA.track?.bpm || 120}
                loopEnabled={mixerState.deckA.loopEnabled}
                loopLength={mixerState.deckA.loop}
                loopPosition={mixerState.deckA.loopPosition}
                onLoopPositionChange={handleDeckALoopPositionChange}
              />
            </div>
            
            {/* Deck B Waveform */}
            <div className="h-24 flex flex-col items-center">
              <div 
                className="mb-1 font-mono"
                style={{
                  fontSize: '12px',
                  color: '#999',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  opacity: 0.9
                }}
              >
                DECK B: {mixerState.deckB.track?.title || 'No track loaded'}
              </div>
              <WaveformDisplay 
                 audioBuffer={mixerState.deckB.audioState?.audioBuffer}
                 loopBoundaries={mixerState.deckB.audioState?.preciseLooper?.getLoopBoundaries() || null}
                 currentTime={mixerState.deckB.audioState?.currentTime || 0}
                 isPlaying={mixerState.deckB.playing}
                 width={700}
                 height={80}
                 className="border border-blue-500/30"
                 // 🎯 NEW: Loop position props for Deck B
                 trackBPM={mixerState.deckB.track?.bpm || 120}
                 loopEnabled={mixerState.deckB.loopEnabled}
                 loopLength={mixerState.deckB.loop}
                 loopPosition={mixerState.deckB.loopPosition}
                 onLoopPositionChange={handleDeckBLoopPositionChange}
               />
            </div>
          </div>

          {/* Deck B FX - Fixed 200px width */}
          <div className="w-full h-full">
            {audioInitialized ? (
              <FXComponent 
                ref={deckBFXRef}
                audioContext={getAudioContext()}
                deckId="deckB"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <span>Initializing FX...</span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section - Transport Controls and Crossfader */}
        <div className="flex items-center justify-center gap-6 py-3 px-6 bg-slate-800/30 rounded-2xl border border-slate-700 min-h-[90px] flex-shrink-0">
          {/* Deck A Transport */}
          <TransportControls 
            isPlaying={mixerState.deckA.playing}
            loopLength={mixerState.deckA.loop}
            loopEnabled={mixerState.deckA.loopEnabled}
            deck="A"
            onPlayPause={handleDeckAPlayPause}
            onRestart={handleDeckARestart}
            onLoopChange={handleDeckALoopChange}
            onLoopToggle={handleDeckALoopToggle}
          />

          {/* Crossfader */}
          <CrossfaderControl 
            position={mixerState.crossfaderPosition}
            onPositionChange={handleCrossfaderChange}
          />

          {/* Deck B Transport */}
          <TransportControls 
            isPlaying={mixerState.deckB.playing}
            loopLength={mixerState.deckB.loop}
            loopEnabled={mixerState.deckB.loopEnabled}
            deck="B"
            onPlayPause={handleDeckBPlayPause}
            onRestart={handleDeckBRestart}
            onLoopChange={handleDeckBLoopChange}
            onLoopToggle={handleDeckBLoopToggle}
          />
        </div>
      </div>

      {/* Mobile Close Button */}
      <button 
        onClick={handleExit}
        className="fixed top-5 right-5 w-10 h-10 bg-slate-800/80 border border-slate-600 rounded-full text-slate-400 hover:bg-slate-700 hover:text-slate-300 transition-all hover:scale-110 flex items-center justify-center backdrop-blur-sm lg:hidden z-50"
        aria-label="Exit Mixer"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <line x1="5" y1="5" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="15" y1="5" x2="5" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      <style jsx global>{`
        @keyframes recordPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .recording {
          animation: recordPulse 1s infinite;
        }
      `}</style>
      
      {/* Recording Preview Modal */}
      {recordingPreview && (
        <RecordingPreview
          recordingUrl={recordingPreview.url}
          duration={recordingPreview.duration}
          bars={recordingPreview.bars}
          bpm={recordingPreview.bpm}
          deckATrack={mixerState.deckA.track}
          deckBTrack={mixerState.deckB.track}
          onClose={() => setRecordingPreview(null)}
          onSelectSegment={(start, end) => {
            console.log(`Selected bars ${start + 1} to ${end}`);
            // TODO: Implement save functionality
          }}
        />
      )}
    </div>
  );
} 