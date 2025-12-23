/**
 * SIMPLIFIED MIXER AUDIO SYSTEM
 * MC Claude's back-to-basics approach - what actually worked!
 * Integrates SimplifiedDualLooper with mixer interface
 */

import { SimplifiedDualLooper } from './simplifiedDualLooper';
import { audioContextManager } from './audioContextManager';

interface SimplifiedMixerState {
  deckA: {
    isLoaded: boolean;
    isPlaying: boolean;
    bpm: number;
    audioBuffer: AudioBuffer | null;
    duration: number;
  };
  deckB: {
    isLoaded: boolean;
    isPlaying: boolean;
    bpm: number;
    audioBuffer: AudioBuffer | null;
    duration: number;
  };
  syncEnabled: boolean;
  masterBPM: number;
}

interface SimplifiedMixerControls {
  // Deck A controls
  loadTrackA: (audioUrl: string, bpm: number) => Promise<void>;
  playA: () => void;
  pauseA: () => void;
  stopA: () => void;
  setBPMA: (bpm: number) => void;
  setVolumeA: (volume: number) => void;

  // Deck B controls
  loadTrackB: (audioUrl: string, bpm: number) => Promise<void>;
  playB: () => void;
  pauseB: () => void;
  stopB: () => void;
  setBPMB: (bpm: number) => void;
  setVolumeB: (volume: number) => void;

  // Sync controls
  enableSync: (masterBPM?: number) => void;
  disableSync: () => void;

  // Cleanup
  cleanup: () => void;

  // Get state
  getState: () => SimplifiedMixerState;
}

export class SimplifiedMixerAudio {
  private static audioContext: AudioContext | null = null;
  private static looper: SimplifiedDualLooper | null = null;
  private static state: SimplifiedMixerState = {
    deckA: {
      isLoaded: false,
      isPlaying: false,
      bpm: 120,
      audioBuffer: null,
      duration: 0
    },
    deckB: {
      isLoaded: false,
      isPlaying: false,
      bpm: 120,
      audioBuffer: null,
      duration: 0
    },
    syncEnabled: false,
    masterBPM: 120
  };

  /**
   * Initialize the simplified mixer system
   */
  static async initialize(): Promise<SimplifiedMixerControls> {
    console.log('🎯 SimplifiedMixerAudio: Initializing...');

    // Get singleton AudioContext
    if (!this.audioContext) {
      try {
        this.audioContext = await audioContextManager.getAudioContext();
        console.log('✅ SimplifiedMixerAudio: Using singleton AudioContext');
      } catch (error) {
        console.error('🚨 SimplifiedMixerAudio: AudioContext initialization failed:', error);
        throw error;
      }
    }

    // Initialize SimplifiedDualLooper
    if (!this.looper) {
      this.looper = new SimplifiedDualLooper(this.audioContext);
      console.log('✅ SimplifiedMixerAudio: SimplifiedDualLooper initialized');
    }

    return this.createControls();
  }

  /**
   * Load audio file and decode to AudioBuffer
   */
  private static async loadAudioBuffer(audioUrl: string): Promise<AudioBuffer> {
    console.log('📂 SimplifiedMixerAudio: Loading audio from:', audioUrl);

    try {
      // Add cache buster for fresh loading
      const cacheBustUrl = `${audioUrl}?t=${Date.now()}`;
      
      const response = await fetch(cacheBustUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!this.audioContext) {
        throw new Error('AudioContext not initialized');
      }

      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log('✅ SimplifiedMixerAudio: Audio buffer decoded successfully');
      
      return audioBuffer;
    } catch (error) {
      console.error('🚨 SimplifiedMixerAudio: Audio loading failed:', error);
      throw error;
    }
  }

  /**
   * Create mixer controls
   */
  private static createControls(): SimplifiedMixerControls {
    return {
      // Deck A controls
      loadTrackA: async (audioUrl: string, bpm: number) => {
        try {
          const audioBuffer = await this.loadAudioBuffer(audioUrl);
          await this.looper?.loadTrack('A', audioBuffer, bpm);
          
          this.state.deckA.isLoaded = true;
          this.state.deckA.bpm = bpm;
          this.state.deckA.audioBuffer = audioBuffer;
          this.state.deckA.duration = audioBuffer.duration;
          
          console.log(`✅ SimplifiedMixerAudio: Deck A loaded - ${bpm} BPM, ${audioBuffer.duration.toFixed(2)}s`);
        } catch (error) {
          console.error('🚨 SimplifiedMixerAudio: Deck A load failed:', error);
          throw error;
        }
      },

      playA: () => {
        if (!this.state.deckA.isLoaded) {
          console.warn('⚠️ SimplifiedMixerAudio: Deck A not loaded');
          return;
        }
        
        this.looper?.play('A');
        this.state.deckA.isPlaying = true;
        console.log('▶️ SimplifiedMixerAudio: Deck A playing');
      },

      pauseA: () => {
        this.looper?.pause('A');
        this.state.deckA.isPlaying = false;
        console.log('⏸️ SimplifiedMixerAudio: Deck A paused');
      },

      stopA: () => {
        this.looper?.stop('A');
        this.state.deckA.isPlaying = false;
        console.log('⏹️ SimplifiedMixerAudio: Deck A stopped');
      },

      setBPMA: (bpm: number) => {
        this.looper?.updateBPM('A', bpm);
        this.state.deckA.bpm = bpm;
        console.log(`🎵 SimplifiedMixerAudio: Deck A BPM updated to ${bpm}`);
      },

      setVolumeA: (volume: number) => {
        this.looper?.setVolume('A', volume);
        console.log(`🔊 SimplifiedMixerAudio: Deck A volume set to ${volume}`);
      },

      // Deck B controls
      loadTrackB: async (audioUrl: string, bpm: number) => {
        try {
          const audioBuffer = await this.loadAudioBuffer(audioUrl);
          await this.looper?.loadTrack('B', audioBuffer, bpm);
          
          this.state.deckB.isLoaded = true;
          this.state.deckB.bpm = bpm;
          this.state.deckB.audioBuffer = audioBuffer;
          this.state.deckB.duration = audioBuffer.duration;
          
          console.log(`✅ SimplifiedMixerAudio: Deck B loaded - ${bpm} BPM, ${audioBuffer.duration.toFixed(2)}s`);
        } catch (error) {
          console.error('🚨 SimplifiedMixerAudio: Deck B load failed:', error);
          throw error;
        }
      },

      playB: () => {
        if (!this.state.deckB.isLoaded) {
          console.warn('⚠️ SimplifiedMixerAudio: Deck B not loaded');
          return;
        }
        
        this.looper?.play('B');
        this.state.deckB.isPlaying = true;
        console.log('▶️ SimplifiedMixerAudio: Deck B playing');
      },

      pauseB: () => {
        this.looper?.pause('B');
        this.state.deckB.isPlaying = false;
        console.log('⏸️ SimplifiedMixerAudio: Deck B paused');
      },

      stopB: () => {
        this.looper?.stop('B');
        this.state.deckB.isPlaying = false;
        console.log('⏹️ SimplifiedMixerAudio: Deck B stopped');
      },

      setBPMB: (bpm: number) => {
        this.looper?.updateBPM('B', bpm);
        this.state.deckB.bpm = bpm;
        console.log(`🎵 SimplifiedMixerAudio: Deck B BPM updated to ${bpm}`);
      },

      setVolumeB: (volume: number) => {
        this.looper?.setVolume('B', volume);
        console.log(`🔊 SimplifiedMixerAudio: Deck B volume set to ${volume}`);
      },

      // Sync controls
      enableSync: (masterBPM?: number) => {
        const bpm = masterBPM || this.state.deckA.bpm;
        this.looper?.enableSync(bpm);
        this.state.syncEnabled = true;
        this.state.masterBPM = bpm;
        console.log(`🔄 SimplifiedMixerAudio: Sync enabled at ${bpm} BPM`);
      },

      disableSync: () => {
        this.state.syncEnabled = false;
        console.log('🔄 SimplifiedMixerAudio: Sync disabled');
      },

      // Cleanup
      cleanup: () => {
        // Clean up looper resources but NOT the singleton AudioContext
        this.looper?.cleanup();
        this.state.deckA.isPlaying = false;
        this.state.deckB.isPlaying = false;
        // Note: We do NOT nullify this.audioContext here as it's a singleton
        console.log('🧹 SimplifiedMixerAudio: Cleanup complete (AudioContext singleton preserved)');
      },

      // Get current state
      getState: () => ({ ...this.state })
    };
  }

  /**
   * Get current mixer state
   */
  static getState(): SimplifiedMixerState {
    return { ...this.state };
  }

  /**
   * Check if mixer is ready
   */
  static isReady(): boolean {
    return !!(this.audioContext && this.looper);
  }
}

// Export for easy usage
export type { SimplifiedMixerControls, SimplifiedMixerState };
export const initSimplifiedMixer = SimplifiedMixerAudio.initialize.bind(SimplifiedMixerAudio); 