export interface ProfileData {
  id: string;
  name: string;
  title: string;
  bio: string;
  image: string;
  socialLinks: SocialLink[];
  sectionVisibility: {
    spotlight: boolean;
    media: boolean;
    shop: boolean;
    gallery: boolean;
    sticker: boolean;
  };
  sectionTitles: {
    spotlight: string;
    media: string;
    shop: string;
    gallery: string;
    sticker: string;
  };
  walletAddress?: string;
  showWalletAddress: boolean;
  btcAddress?: string;
  showBtcAddress: boolean;
  sticker: {
    id: string;
    customImage?: string;  // For custom uploaded stickers
    visible: boolean;
  };
}

export interface SpotlightItem {
  id: string;
  title: string;
  description: string;
  image: string;
  link: string;
  date?: string;
  category?: string;
}

export interface MediaItem {
  id: string;
  type: string; // youtube, spotify, soundcloud, etc.
  title?: string;
  rawUrl: string;
  embedUrl?: string;
  link?: string; // External link to the media source
}

export interface ShopItem {
  id: string;
  title: string;
  description: string;
  image: string;
  link?: string;
}

export interface GalleryItem {
  id: string;
  image: string;
  createdAt?: string;
}

export interface SocialLink {
  platform: string;
  url: string;
  icon?: string;
  displayName?: string;
}

// IP Attribution System Types
export interface IPTrack {
  id: string;
  title: string;
  version?: string; // New field for track version
  artist: string;
  description?: string;
  tell_us_more?: string; // New field for additional context
  notes?: string; // For lyrics/descriptions to display in CC overlay
  tags: string[];
  content_type: 'full_song' | 'loop' | 'loop_pack' | 'ep' | 'mix' | 'radio_station' | 'station_pack' | 'video_clip';
  loop_category?: string; // Only for loops: 'vocals', 'beats', 'instrumental', 'stem', 'other'
  sample_type: string; // Legacy field - will be replaced by content_type + loop_category
  bpm?: number; // Beats per minute - optional for full songs, essential for loops

  // Radio Station fields (for content_type: 'radio_station')
  stream_url?: string; // Direct audio stream endpoint
  metadata_api_url?: string; // Optional API for "Now Playing" info
  key?: string; // Musical key signature - optional for both
  isrc?: string;
  social_urls?: Record<string, string>;
  contact_info?: Record<string, string>;
  
  // New licensing and permissions fields
  license_type?: 'remix_only' | 'remix_external' | 'custom';
  allow_remixing?: boolean;
  open_to_collaboration?: boolean;
  agreed_to_terms?: boolean;

  // AI Assistance tracking
  ai_assisted_idea?: boolean; // AI used in concept, direction, creative ideas
  ai_assisted_implementation?: boolean; // AI used in production, editing, technical execution

  // Audio source tracking (for video clips - enables future modular audio IP)
  audio_source?: 'included' | 'silent' | 'separate'; // included = audio inherits video IP (default for 5-sec clips)

  // Pricing fields
  price_stx?: number; // Legacy combined price (kept for backward compatibility)
  remix_price_stx?: number; // Price to use this loop in a remix (default 1 STX per loop, 0 for free)
  download_price_stx?: number; // Price to download the audio file (NULL if downloads not available)
  allow_downloads?: boolean; // Whether this track can be downloaded (separate from remix rights)
  
  // Composition Splits (up to 3 owners)
  composition_split_1_wallet: string;
  composition_split_1_percentage: number;
  composition_split_2_wallet?: string;
  composition_split_2_percentage?: number;
  composition_split_3_wallet?: string;
  composition_split_3_percentage?: number;
  
  // Production Splits (up to 3 owners)
  production_split_1_wallet: string;
  production_split_1_percentage: number;
  production_split_2_wallet?: string;
  production_split_2_percentage?: number;
  production_split_3_wallet?: string;
  production_split_3_percentage?: number;
  
  // Media Assets
  cover_image_url?: string;
  audio_url?: string;
  video_url?: string; // For video_clip content type - URL to MP4 file in Supabase Storage
  
  // Loop Pack System
  pack_id?: string; // Links individual loops to their parent loop pack
  pack_position?: number; // Position within the loop pack (1, 2, 3, etc.)
  total_loops?: number; // For loop pack master records - total number of loops in the pack
  
  // Remix tracking
  remix_depth?: number; // Generation depth: 0=original, 1+=remix generation, null=full song
  source_track_ids?: string[]; // IDs of tracks this was remixed from
  
  // Metadata
  created_at: string;
  updated_at: string;
  deleted_at?: string | null; // Soft delete timestamp
  created_by?: string;
  
  // Location fields
  location_lat?: number;
  location_lng?: number;
  primary_location?: string;
  locations?: Array<{ lat: number; lng: number; name: string }>;
  
  // Collaboration System Fields (MC Claude enhancement)
  primary_uploader_wallet?: string; // Who "owns" this track in their store
  collaboration_preferences?: Record<string, boolean>; // JSONB field for collaboration control
  store_display_policy?: 'primary_only' | 'all_collaborations' | 'curated_collaborations';
  collaboration_type?: 'primary_artist' | 'featured_artist' | 'producer' | 'remixer' | 'composer' | 'vocalist';
}

export interface IPSplit {
  wallet: string;
  percentage: number;
  type: 'composition' | 'production';
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Content Types for the alpha three-tier system
export const CONTENT_TYPES = [
  'full_song',
  'loop',
  'loop_pack',
  'ep',
  'mix'
] as const;

export type ContentType = typeof CONTENT_TYPES[number];

// Predefined Loop Categories
export const LOOP_CATEGORIES = [
  { value: 'instrumental', label: 'Instrumental' },
  { value: 'vocal', label: 'Vocal' },
  { value: 'beats', label: 'Beats' },
  { value: 'stem', label: 'Stem' },
  { value: 'other', label: 'Other' }
] as const;

export type LoopCategory = typeof LOOP_CATEGORIES[number]['value'];

// Legacy Sample Types for filtering (deprecated - use content_type + loop_category)
export const SAMPLE_TYPES = [
  'VOCALS',
  'BEATS', 
  'FULL BACKING TRACKS',
  'LEADS AND TOPS',
  'instrumentals',
  'vocals'
] as const;

export type SampleType = typeof SAMPLE_TYPES[number];

// Helper type for filtering
export interface ContentFilter {
  type: 'all' | 'full_song' | 'loop';
  category?: string; // For loop subcategories
}

export const STORAGE_KEYS = {
  PROFILE: "profile",
  SPOTLIGHT: "spotlight", 
  MEDIA: "media",
  SHOP: "shop",
  GALLERY: "gallery",
  STICKER: "sticker",
  AUTH: "auth",
  IP_TRACKS: "ip_tracks",
  STORE_CARD: "store_card",
  STORE_CARD_VISIBLE: "store_card_visible"
};

export type StorageKeysType = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

export type StickerId = 
  | 'daisy-purple' 
  | 'daisy-pink' 
  | 'daisy-yellow' 
  | 'daisy-white'
  | 'daisy-blue'
  | 'moto-wheel-2'
  | 'gear-shiny'
  | 'lemon-slice'
  | 'lime-slice'
  | 'orange-slice'
  | 'pineapple-slice'
  | 'strawberry-slice'
  | 'custom';  // For user-uploaded stickers

export interface Sticker {
  id: StickerId;
  imageUrl: string;
  alt: string;
}

export interface Profile {
  id: string;
  name: string;
  title: string;
  bio: string;
  image: string;
  socialLinks: SocialLink[];
  sectionVisibility: {
    spotlight: boolean;
    media: boolean;
    shop: boolean;
    gallery: boolean;
    sticker: boolean;
  };
  walletAddress?: string;
  showWalletAddress: boolean;
  btcAddress?: string;
  showBtcAddress: boolean;
  sticker: {
    id: StickerId | null;
    visible: boolean;
  };
} 

// IP Track Split Preset System - for commonly used collaboration configurations
export interface IPTrackSplitPreset {
  id: string;
  name: string; // User-friendly name like "My Band", "Producer Team", etc.
  description?: string; // Optional description
  created_at: string;
  
  // Composition splits
  composition_split_1_wallet: string;
  composition_split_1_percentage: number;
  composition_split_2_wallet: string;
  composition_split_2_percentage: number;
  composition_split_3_wallet: string;
  composition_split_3_percentage: number;
  
  // Production splits
  production_split_1_wallet: string;
  production_split_1_percentage: number;
  production_split_2_wallet: string;
  production_split_2_percentage: number;
  production_split_3_wallet: string;
  production_split_3_percentage: number;
  
  // Optional defaults
  default_content_type?: ContentType;
  default_loop_category?: LoopCategory;
} 