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

      {/* Top Section - Decks, Crates, and BPM */}
      <div className="flex justify-between items-start mb-8">
        {/* Deck A + Crate A */}
        <div className="flex gap-3 items-start">
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
          {/* Deck A Crate */}
          <DeckCrate
            deck="A"
            currentTrack={mixerState.deckA.track}
            loading={mixerState.deckA.loading}
          />
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

        {/* Crate B + Deck B */}
        <div className="flex gap-3 items-start">
          {/* Deck B Crate */}
          <DeckCrate
            deck="B"
            currentTrack={mixerState.deckB.track}
            loading={mixerState.deckB.loading}
          />
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
      </div>

      {/* FX Panels and Waveforms - 3 Column Grid */}
      <div className="grid gap-5 mb-8" style={{ gridTemplateColumns: '200px 1fr 200px' }}>
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