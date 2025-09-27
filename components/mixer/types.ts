import { MixerAudioState, MixerAudioControls } from '@/lib/mixerAudio';

export interface Track {
  id: string;
  title: string;
  artist: string;
  imageUrl: string;
  bpm: number;
  audioUrl?: string;
  content_type?: 'loop' | 'full_song'; // Added to maintain content type for UI
  price_stx?: number; // Price in STX for purchase
}

export interface FXState {
  selectedFX: 'FILTER' | 'REVERB' | 'DELAY';
  filterValue: number;
  reverbValue: number;
  delayValue: number;
}

export interface DeckState {
  track: Track | null;
  playing: boolean;
  loop: number;
  loopEnabled: boolean; // 🔄 NEW: Independent loop on/off per deck
  loopPosition: number; // 🎯 NEW: Loop start position in bars (0-based)
  fx: FXState;
  loading?: boolean; // Hot-swap protection
  // Audio system integration
  audioState?: MixerAudioState;
  audioControls?: MixerAudioControls;
}

export interface MixerState {
  deckA: DeckState;
  deckB: DeckState;
  masterBPM: number;
  crossfaderPosition: number;
  syncActive: boolean;
  recordingRemix: boolean;
  saveRemixState: 'idle' | 'recording' | 'processing' | 'saved';
}