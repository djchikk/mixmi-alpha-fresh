"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Track } from './types';
import { useMixerAudio } from '@/hooks/useMixerAudio';
import { applyCrossfader, SimpleLoopSync, getAudioContext } from '@/lib/mixerAudio';
import SimplifiedDeck from './SimplifiedDeck';
import WaveformDisplay from './WaveformDisplay';
import CrossfaderControl from './CrossfaderControl';
import MasterTransportControls from './MasterTransportControls';
import LoopControls from './LoopControls';
import FXComponent from './FXComponent';
import DeckCrate from './DeckCrate';

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
    <div className={`simplified-mixer bg-slate-900 rounded-lg p-4 mt-4 max-w-6xl mx-auto ${className}`}>

      {/* Top Section - Decks, Crates, and BPM */}
      <div className="flex justify-center items-end mb-8 gap-12">
        {/* Left: Deck A + Loop Controls + Track Info */}
        <div className="flex gap-4 items-center">
          <SimplifiedDeck
            currentTrack={mixerState.deckA.track}
            isPlaying={mixerState.deckA.playing}
            onTrackDrop={loadTrackToDeckA}
            deck="A"
            trackInfoPosition="none"
          />

          {/* Deck A Info Container: Track Info + Loop Controls stacked */}
          <div className="flex flex-col gap-8 items-start max-w-[140px]">
            {mixerState.deckA.track && (
              <div className="text-left w-full">
                <div className="text-white text-sm font-bold truncate">
                  {mixerState.deckA.track.title} - {mixerState.deckA.track.bpm}
                </div>
                <div className="text-slate-400 text-xs truncate">
                  by {mixerState.deckA.track.artist} →
                </div>
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
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => handleBPMChange(-1)}
                className="w-10 h-10 rounded-full border border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-300 text-xl flex items-center justify-center transition-all"
                aria-label="Decrease BPM"
              >
                −
              </button>
              <div className="text-6xl font-bold text-slate-300 min-w-[140px] text-center">
                {mixerState.masterBPM}
              </div>
              <button
                onClick={() => handleBPMChange(1)}
                className="w-10 h-10 rounded-full border border-slate-600 hover:border-slate-500 text-slate-400 hover:text-slate-300 text-xl flex items-center justify-center transition-all"
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
            recordingRemix={false}
            onMasterPlay={handleMasterPlay}
            onMasterPlayAfterCountIn={handleMasterPlayAfterCountIn}
            onMasterStop={handleMasterStop}
            onRecordToggle={() => {}}
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
                <div className="text-white text-sm font-bold truncate">
                  {mixerState.deckB.track.title} - {mixerState.deckB.track.bpm}
                </div>
                <div className="text-slate-400 text-xs truncate">
                  by {mixerState.deckB.track.artist} →
                </div>
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
            onTrackDrop={loadTrackToDeckB}
            deck="B"
            trackInfoPosition="none"
          />
        </div>
      </div>

      {/* FX Panels and Waveforms - 3 Column Grid */}
      <div className="grid gap-5 mb-5" style={{ gridTemplateColumns: '200px 1fr 200px' }}>
        {/* Deck A FX - Left Side */}
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

        {/* Waveforms - Center Column */}
        <div className="flex flex-col">
          {/* Spacer to push waveforms down */}
          <div className="h-4"></div>

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
                width={700}
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
                width={700}
                height={80}
                waveformColor="#FF6B6B"
                className="border border-blue-500/30"
              />
            </div>
          </div>

          {/* Crossfader with Deck Controls */}
          <div className="flex justify-center items-center gap-6 mt-8">
            {/* Deck A Play/Pause */}
            <button
              onClick={handleDeckAPlayPause}
              disabled={!mixerState.deckA.track}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-lg transition-all ${
                mixerState.deckA.playing
                  ? 'bg-cyan-400 border-2 border-cyan-400 text-slate-900 shadow-lg shadow-cyan-400/50 hover:bg-cyan-300'
                  : mixerState.deckA.track
                  ? 'border-2 border-slate-600 text-slate-400 hover:border-cyan-400 hover:text-cyan-400'
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
              className={`w-14 h-14 rounded-full flex items-center justify-center text-lg transition-all ${
                mixerState.deckB.playing
                  ? 'bg-cyan-400 border-2 border-cyan-400 text-slate-900 shadow-lg shadow-cyan-400/50 hover:bg-cyan-300'
                  : mixerState.deckB.track
                  ? 'border-2 border-slate-600 text-slate-400 hover:border-cyan-400 hover:text-cyan-400'
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
    </div>
  );
}