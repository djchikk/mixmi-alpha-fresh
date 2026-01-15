export interface TrackNode {
  id: string;
  title: string;
  artist: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  // Ready for more fields later
  genre?: string;
  content_type?: string; // 'loop' | 'full_song' | 'nft'
  duration?: number;
  imageUrl?: string;
  audioUrl?: string;
  stream_url?: string; // For radio stations
  video_url?: string; // For video clips
  location?: string; // Location name for display
  // Metadata fields
  tags?: string[];
  description?: string;
  license?: string;
  price_stx?: string;
  bpm?: number;
  
  // Aggregation fields (optional)
  isAggregated?: boolean;
  trackCount?: number;
  tracks?: TrackNode[];
  uploaderAddress?: string;
  latestActivity?: string; // ISO date string
  
  // Profile/Artist fields for enhanced display
  profileImageUrl?: string; // Artist profile picture
  artistName?: string; // Display name for artist

  // Pre-generated thumbnail URLs
  thumb_64_url?: string;
  thumb_160_url?: string;
  thumb_256_url?: string;

  // Portal fields
  portal_username?: string;

  // Video crop data for WebGL display
  video_crop_x?: number;
  video_crop_y?: number;
  video_crop_width?: number;
  video_crop_height?: number;
  video_crop_zoom?: number;
  video_natural_width?: number;
  video_natural_height?: number;

  // IP Rights fields (for modal display)
  composition_split?: number;
  production_split?: number;
  wallet_address?: string; // SUI address (preferred) or Stacks wallet
  remix_protected?: boolean;

  // IPTrack compatibility fields
  primary_uploader_wallet?: string;
  cover_image_url?: string;
  audio_url?: string;

  // AI assistance flags for Creation display
  ai_assisted_idea?: boolean;
  ai_assisted_implementation?: boolean;
}

export interface GlobeProps {
  nodes?: TrackNode[];
  onNodeClick?: (node: TrackNode) => void;
  onNodeHover?: (node: TrackNode | null) => void;
  selectedNode?: TrackNode | null;
  hoveredNode?: TrackNode | null;
  backgroundMode?: boolean;
}

export interface NodeMeshProps {
  node: TrackNode;
  onClick: () => void;
  onHover: (hovering: boolean) => void;
}