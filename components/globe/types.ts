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