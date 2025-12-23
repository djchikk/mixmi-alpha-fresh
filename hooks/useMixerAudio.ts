import { useState, useRef, useEffect, useCallback } from 'react';
import { Track, AudioState, AudioControls } from '@/components/mixer/types';
import { createMixerAudio, initMixerAudio, MixerAudioEngine, SimpleLoopSync } from '@/lib/mixerAudio';

interface CrossfaderGainRef {
  deckA: GainNode | null;
  deckB: GainNode | null;
}

interface LoadAudioResult {
  audioState: AudioState;
  audioControls: AudioControls;
  trackBPM: number;
}

interface UseMixerAudioReturn {
  audioInitialized: boolean;
  crossfaderGainRef: React.MutableRefObject<CrossfaderGainRef>;
  syncEngineRef: React.MutableRefObject<SimpleLoopSync | null>;
  initializeAudio: () => Promise<void>;
  cleanupDeckAudio: (audioControls: AudioControls | undefined, deckName: string) => Promise<void>;
  loadAudioForDeck: (track: Track, deckName: string) => Promise<LoadAudioResult | null>;
  resetSyncState: () => void;
}

export function useMixerAudio(): UseMixerAudioReturn {
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  // References for audio nodes and sync engine
  const crossfaderGainRef = useRef<CrossfaderGainRef>({
    deckA: null,
    deckB: null
  });
  
  const syncEngineRef = useRef<SimpleLoopSync | null>(null);

  // Initialize audio system
  const initializeAudio = useCallback(async () => {
    if (audioInitialized) {
      console.log('🎵 Audio already initialized, skipping...');
      return;
    }
    
    try {
      console.log('🎵 Initializing mixer audio system...');
      await initMixerAudio();
      setAudioInitialized(true);
      console.log('✅ Mixer audio system initialized successfully');
    } catch (error) {
      console.error('🚨 Failed to initialize mixer audio:', error);
      if (error instanceof Error) {
        console.error('🚨 Audio initialization stack trace:', error.stack);
      }
      setAudioInitialized(false);
      throw error;
    }
  }, [audioInitialized]);

  // Extract cleanup logic to reduce complexity
  const cleanupDeckAudio = useCallback(async (audioControls: AudioControls | undefined, deckName: string) => {
    if (!audioControls) return;
    
    console.log(`🛑 Cleaning up ${deckName} audio`);
    try {
      if (typeof audioControls.pause === 'function') audioControls.pause();
      if (typeof audioControls.stop === 'function') audioControls.stop();
      if (typeof audioControls.cleanup === 'function') audioControls.cleanup();
      console.log(`✅ ${deckName} cleanup complete`);
    } catch (error) {
      console.warn(`⚠️ Error cleaning up ${deckName}:`, error);
    }
  }, []);

  // Extract audio loading logic
  const loadAudioForDeck = useCallback(async (track: Track, deckName: string, contentType?: string): Promise<LoadAudioResult | null> => {
    if (!track.audioUrl) return null;

    const isRadio = contentType === 'radio_station';
    console.log(`🎵 Loading audio for ${deckName}:`, track.audioUrl.substring(0, 50) + '...', isRadio ? '📻 RADIO' : contentType === 'full_song' ? '🎵 SONG' : '🔁 LOOP');

    const { state: audioState, controls: audioControls } = await createMixerAudio(
      track.audioUrl,
      deckName.slice(-1) as 'A' | 'B',
      isRadio,
      contentType || 'loop'
    );
    
    // Set BPM and gain reference
    const trackBPM = track.bpm || 120;
    audioState.bpm = trackBPM;
    audioControls.setBPM(trackBPM);
    
    if (deckName === 'A' || deckName === 'Deck A') {
      crossfaderGainRef.current.deckA = audioState.gainNode;
    } else {
      crossfaderGainRef.current.deckB = audioState.gainNode;
    }
    
    return { audioState, audioControls, trackBPM };
  }, []);

  // Reset sync state
  const resetSyncState = useCallback(() => {
    if (syncEngineRef.current) {
      console.log('🔄 SYNC: Resetting sync state');
      try {
        syncEngineRef.current.disableSync();
        syncEngineRef.current = null;
      } catch (error) {
        console.warn('⚠️ Error resetting sync state:', error);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Skip cleanup in development to prevent issues with hot reload
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Development mode: Skipping audio cleanup for hot reload');
        return;
      }
      
      console.log('🧹 Cleaning up mixer audio on unmount');
      
      try {
        MixerAudioEngine.cleanup();
        setAudioInitialized(false);
      } catch (error) {
        console.warn('🚨 Error cleaning up audio engine:', error);
      }
      
      // Clean up sync engine
      resetSyncState();
    };
  }, []);

  return {
    audioInitialized,
    crossfaderGainRef,
    syncEngineRef,
    initializeAudio,
    cleanupDeckAudio,
    loadAudioForDeck,
    resetSyncState
  };
}