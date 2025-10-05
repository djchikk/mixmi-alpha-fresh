"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Track } from '../types';
import { useMixerAudio } from '@/hooks/useMixerAudio';
import { applyCrossfader, SimpleLoopSync } from '@/lib/mixerAudio';
import SimplifiedDeckCompact from './SimplifiedDeckCompact';
import WaveformDisplayCompact from './WaveformDisplayCompact';
import CrossfaderControlCompact from './CrossfaderControlCompact';
import MasterTransportControlsCompact from './MasterTransportControlsCompact';
import LoopControlsCompact from './LoopControlsCompact';
import { Music } from 'lucide-react';

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

export default function SimplifiedMixerCompact({ className = "" }: SimplifiedMixerProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
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
    console.log('🎵 SimplifiedMixer: Loading track to Deck A:', track);
    console.log('Track details:', {
      id: track.id,
      title: track.title,
      artist: track.artist,
      audioUrl: track.audioUrl,
      audio_url: (track as any).audio_url,
      bpm: track.bpm
    });
    
    if (mixerState.deckA.loading) {
      console.log('⚠️ Deck A already loading, skipping');
      return;
    }
    
    // Ensure we have audioUrl - handle both formats as final safety check
    const audioUrl = track.audioUrl || (track as any).audio_url;
    if (!audioUrl) {
      console.error('❌ Track missing audioUrl AND audio_url:', track);
      return;
    }
    
    // Use the corrected audioUrl for the rest of the function
    track = { ...track, audioUrl };
    
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
    
    // Ensure we have audioUrl - handle both formats as final safety check
    const audioUrl = track.audioUrl || (track as any).audio_url;
    if (!audioUrl) {
      console.error('❌ Track missing audioUrl AND audio_url:', track);
      return;
    }
    
    // Use the corrected audioUrl for the rest of the function
    track = { ...track, audioUrl };
    
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
        // Notify other audio sources to pause
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
        // Notify other audio sources to pause
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
    const { deckA, deckB } = crossfaderGainRef.current;
    if (deckA && deckB) {
      const normalizedPosition = position / 100;
      applyCrossfader(deckA, deckB, normalizedPosition);
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

  // Expose loadMixerTracks method for FILL button
  useEffect(() => {
    (window as any).loadMixerTracks = async (trackA: any, trackB: any) => {
      console.log('🎛️ Mixer: Loading tracks from FILL:', trackA.title, '&', trackB.title);

      // Normalize track data from database format to Track type
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

      // Load track A to Deck A
      if (trackA) {
        console.log('🎛️ Mixer: Loading Deck A with:', normalizeTrack(trackA));
        await loadTrackToDeckA(normalizeTrack(trackA));
      }

      // Wait for Deck A to finish loading before loading Deck B
      await new Promise(resolve => setTimeout(resolve, 500));

      // Load track B to Deck B
      if (trackB) {
        console.log('🎛️ Mixer: Loading Deck B with:', normalizeTrack(trackB));
        await loadTrackToDeckB(normalizeTrack(trackB));
      }
    };

    return () => {
      delete (window as any).loadMixerTracks;
    };
  }, []);

  return (
    <div 
      className={`simplified-mixer bg-slate-900/30 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700/50 transition-all duration-300 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: isCollapsed ? '0.5rem 1rem' : '1.5rem',
        height: isCollapsed ? 'auto' : 'auto',
      }}
    >
      {/* Collapse/Expand Button - Only visible on hover */}
      {isHovered && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`absolute ${isCollapsed ? 'top-1' : 'top-2'} right-2 p-1 rounded hover:bg-white/10 transition-all duration-200 z-10`}
          style={{
            opacity: isHovered ? 1 : 0,
          }}
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
              className="text-gray-400"
            />
          </svg>
        </button>
      )}

      {/* Collapsed State */}
      {isCollapsed ? (
        <div className="flex items-center justify-center gap-4 py-1 pr-8"> {/* Added pr-8 for arrow space */}
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
            <span className="text-xs text-gray-400">Mini Mixer</span>
          )}
        </div>
      ) : (
        <>
          {/* Unified Mixer Container */}
          <div className="flex justify-center">
            <div className="w-[600px] relative">
          
          {/* Transport and Loop Controls Row */}
          <div className="flex justify-center items-center gap-16 mb-5">
            {/* Deck A Loop Controls */}
            <LoopControlsCompact
              loopLength={mixerState.deckA.loopLength}
              loopEnabled={mixerState.deckA.loopEnabled}
              onLoopChange={(length) => handleLoopLengthChange('A', length)}
              onLoopToggle={() => handleLoopToggle('A')}
              color="cyan"
              disabled={!mixerState.deckA.track}
            />

            {/* Master Transport */}
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
              onMasterPlay={handleMasterPlay}
              onMasterPlayAfterCountIn={handleMasterPlayAfterCountIn}
              onMasterStop={handleMasterStop}
              onRecordToggle={() => {}}
              onSyncToggle={handleSync}
              onMasterSyncReset={handleMasterSyncReset}
            />
            {/* Deck B Loop Controls */}
            <LoopControlsCompact
              loopLength={mixerState.deckB.loopLength}
              loopEnabled={mixerState.deckB.loopEnabled}
              onLoopChange={(length) => handleLoopLengthChange('B', length)}
              onLoopToggle={() => handleLoopToggle('B')}
              color="cyan"
              disabled={!mixerState.deckB.track}
            />
          </div>

          {/* Decks, Waveforms, and Crossfader Section */}
          <div className="h-[100px] relative">
          {/* Decks positioned at edges with waveforms between */}
          <div>
            {/* Deck A - positioned to center-align with gap between waveforms */}
            <div className="absolute left-0 bottom-[42px]">
              <SimplifiedDeckCompact 
                currentTrack={mixerState.deckA.track}
                isPlaying={mixerState.deckA.playing}
                isLoading={mixerState.deckA.loading}
                onTrackDrop={loadTrackToDeckA}
                onTrackClear={clearDeckA}
                deck="A"
              />
            </div>

            {/* Waveforms centered between decks with 4px gaps */}
            <div className="absolute left-[76px] bottom-[48px]" style={{ width: '448px' }}>
              <div>
                {/* Deck A Waveform */}
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
                
                {/* Deck B Waveform */}
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

            {/* Deck B - positioned to center-align with gap between waveforms */}
            <div className="absolute right-0 bottom-[42px]">
              <SimplifiedDeckCompact 
                currentTrack={mixerState.deckB.track}
                isPlaying={mixerState.deckB.playing}
                isLoading={mixerState.deckB.loading}
                onTrackDrop={loadTrackToDeckB}
                onTrackClear={clearDeckB}
                deck="B"
              />
            </div>
          </div>
          
          {/* Crossfader aligned with waveforms */}
          <div className="absolute left-[76px] bottom-0" style={{ width: '448px' }}>
            <div className="flex justify-center">
              <div className="w-[280px]" style={{ marginLeft: '2px' }}>
                <CrossfaderControlCompact 
                  position={mixerState.crossfaderPosition}
                  onPositionChange={handleCrossfaderChange}
                />
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