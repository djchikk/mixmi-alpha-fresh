"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Track } from './types';
import { useMixerAudio } from '@/hooks/useMixerAudio';
import { applyCrossfader, SimpleLoopSync } from '@/lib/mixerAudio';
import SimplifiedDeck from './SimplifiedDeck';
import WaveformDisplay from './WaveformDisplay';
import CrossfaderControl from './CrossfaderControl';
import MasterTransportControls from './MasterTransportControls';
import LoopControls from './LoopControls';

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
    
    setMixerState(prev => ({
      ...prev,
      deckA: { ...prev.deckA, loading: true, playing: false }
    }));

    try {
      // Initialize audio if needed
      if (!audioInitialized) {
        console.log('🎵 Audio not initialized, initializing now...');
        await initializeAudio();
      }
      
      // Clean up existing audio
      await cleanupDeckAudio(mixerState.deckA.audioControls, 'Deck A');
      
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
          audioControls.setLoopPosition(mixerState.deckA.loopPosition);
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
            loading: false
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
    
    // Ensure we have audioUrl
    if (!track.audioUrl) {
      console.error('❌ Track missing audioUrl:', track);
      return;
    }
    
    setMixerState(prev => ({
      ...prev,
      deckB: { ...prev.deckB, loading: true, playing: false }
    }));

    try {
      // Initialize audio if needed
      if (!audioInitialized) {
        console.log('🎵 Audio not initialized, initializing now...');
        await initializeAudio();
      }
      
      // Clean up existing audio
      await cleanupDeckAudio(mixerState.deckB.audioControls, 'Deck B');
      
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
          audioControls.setLoopPosition(mixerState.deckB.loopPosition);
        }
        
        setMixerState(prev => ({
          ...prev,
          deckB: { 
            ...prev.deckB, 
            track,
            playing: false,
            audioState,
            audioControls,
            loading: false
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
        { ...mixerState.deckA.audioState, audioControls: mixerState.deckA.audioControls },
        { ...mixerState.deckB.audioState, audioControls: mixerState.deckB.audioControls }
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

  return (
    <div className={`simplified-mixer bg-slate-900 rounded-lg p-6 ${className}`}>

      {/* Top Section - Decks and BPM */}
      <div className="flex justify-between items-center mb-8">
        {/* Deck A */}
        <div>
          <SimplifiedDeck 
            currentTrack={mixerState.deckA.track}
            isPlaying={mixerState.deckA.playing}
            onTrackDrop={loadTrackToDeckA}
            deck="A"
          />
          {mixerState.deckA.track && (
            <div className="mt-2">
              {/* Loop controls for Deck A */}
              <LoopControls
                loopLength={mixerState.deckA.loopLength}
                loopEnabled={mixerState.deckA.loopEnabled}
                onLoopChange={(length) => handleLoopLengthChange('A', length)}
                onLoopToggle={() => handleLoopToggle('A')}
                color="cyan"
              />
            </div>
          )}
        </div>

        {/* Center Column - Master BPM and Transport */}
        <div className="text-center flex flex-col items-center gap-4">
          {/* Master BPM Control */}
          <div className="flex flex-col items-center gap-2">
            {/* BPM Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => handleBPMChange(-1)}
                className="w-12 h-12 rounded-full border-2 border-cyan-400 hover:bg-cyan-400/20 text-cyan-400 text-2xl font-bold flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                aria-label="Decrease BPM"
              >
                −
              </button>
              <div className="text-6xl font-bold text-white min-w-[140px] text-center">
                {mixerState.masterBPM}
              </div>
              <button
                onClick={() => handleBPMChange(1)}
                className="w-12 h-12 rounded-full border-2 border-cyan-400 hover:bg-cyan-400/20 text-cyan-400 text-2xl font-bold flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                aria-label="Increase BPM"
              >
                +
              </button>
            </div>
            {/* BPM Label */}
            <div className="text-xs uppercase tracking-wider text-slate-400">
              {mixerState.deckA.playing && mixerState.deckA.track?.bpm
                ? `Deck A BPM (Master)`
                : 'Master BPM'}
            </div>
          </div>

          {/* Master Transport Controls */}
          <MasterTransportControls
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
        </div>

        {/* Deck B */}
        <div>
          <SimplifiedDeck 
            currentTrack={mixerState.deckB.track}
            isPlaying={mixerState.deckB.playing}
            onTrackDrop={loadTrackToDeckB}
            deck="B"
          />
          {mixerState.deckB.track && (
            <div className="mt-2">
              {/* Loop controls for Deck B */}
              <LoopControls
                loopLength={mixerState.deckB.loopLength}
                loopEnabled={mixerState.deckB.loopEnabled}
                onLoopChange={(length) => handleLoopLengthChange('B', length)}
                onLoopToggle={() => handleLoopToggle('B')}
                color="blue"
              />
            </div>
          )}
        </div>
      </div>

      {/* Waveforms - Stacked Vertically */}
      <div className="space-y-2 mb-8">
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
            width={600}
            height={60}
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
            width={600}
            height={60}
            waveformColor="#FF6B6B"
            className="border border-blue-500/30"
          />
        </div>
      </div>

      {/* Crossfader */}
      <div className="flex justify-center">
        <CrossfaderControl 
          position={mixerState.crossfaderPosition}
          onPositionChange={handleCrossfaderChange}
        />
      </div>
    </div>
  );
}