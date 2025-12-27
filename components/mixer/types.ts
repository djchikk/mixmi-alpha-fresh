import { MixerAudioState, MixerAudioControls } from '@/lib/mixerAudio';

export interface Track {
  id: string;
  title: string;
  artist: string;
  imageUrl: string;
  cover_image_url?: string; // CRITICAL: Original full-res cover image URL for high-quality display
  bpm: number;
  audioUrl?: string;
  content_type?: 'loop' | 'full_song' | 'loop_pack' | 'ep' | 'mix' | 'video_clip' | 'radio_station' | 'grabbed_radio'; // Extended content types including video and radio
  video_url?: string; // For video clip content
  stream_url?: string; // For radio station streaming
  pack_position?: number; // Position within a pack (for numbering)
  notes?: string; // For lyrics/descriptions to display in CC overlay
  price_stx?: number; // Legacy price in STX
  download_price_stx?: number; // New pricing model for downloads
  allow_downloads?: boolean; // Download permission flag
  primary_uploader_wallet?: string; // For linking to creator's store
  created_at?: string; // For IPTrack conversion compatibility
  updated_at?: string; // For IPTrack conversion compatibility
  foundByAgent?: boolean; // Track was found by user's AI agent
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