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

    // Ensure we have audioUrl
    const audioUrl = track.audioUrl || (track as any).audio_url;
    if (!audioUrl) {
      console.error('❌ Track missing audioUrl:', track);
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

      if (syncWasActive && syncEngineRef.current) {
        syncEngineRef.current.disableSync();
        syncEngineRef.current = null;

        if (mixerState.deckB.audioState?.audio && mixerState.deckB.audioControls) {
          mixerState.deckB.audioState.audio.playbackRate = 1.0;
          mixerState.deckB.audioControls.setLoopPosition(0);
        }
      }

      const audioResult = await loadAudioForDeck(track, 'Deck A');

      if (audioResult) {
        const { audioState, audioControls, trackBPM } = audioResult;

        // Set initial volume
        if (audioState.audio) {
          audioState.audio.volume = mixerState.deckA.volume / 100;
        }

        if (audioControls) {
          audioControls.setLoopEnabled(mixerState.deckA.loopEnabled);
          audioControls.setLoopLength(mixerState.deckA.loopLength);
          audioControls.setLoopPosition(0);
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
            loopPosition: 0
          }
        }));
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

    const audioUrl = track.audioUrl || (track as any).audio_url;
    if (!audioUrl) {
      console.error('❌ Track missing audioUrl:', track);
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

      if (syncWasActive && syncEngineRef.current) {
        syncEngineRef.current.disableSync();
        syncEngineRef.current = null;

        if (mixerState.deckA.audioState?.audio && mixerState.deckA.audioControls) {
          mixerState.deckA.audioState.audio.playbackRate = 1.0;
          mixerState.deckA.audioControls.setLoopPosition(0);
        }
      }

      const audioResult = await loadAudioForDeck(track, 'Deck B');

      if (audioResult) {
        const { audioState, audioControls } = audioResult;

        // Set initial volume
        if (audioState.audio) {
          audioState.audio.volume = mixerState.deckB.volume / 100;
        }

        if (audioControls) {
          audioControls.setLoopEnabled(mixerState.deckB.loopEnabled);
          audioControls.setLoopLength(mixerState.deckB.loopLength);
          audioControls.setLoopPosition(0);
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
            loopPosition: 0
          }
        }));
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
              disabled={!mixerState.deckA.track}
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
              disabled={!mixerState.deckB.track}
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
                  onTrackClear={clearDeckB}
                  deck="B"
                />
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
