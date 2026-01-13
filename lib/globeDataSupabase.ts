import { TrackNode } from '@/components/globe/types';
import { IPTrack } from '@/types';
import { supabase } from '@/lib/supabase';

// Function to generate coordinates around Null Island (0, 0)
// For tracks without location data - spreads them in a clickable cluster
function generateNullIslandCoordinates(): { lat: number; lng: number } {
  // Generate coordinates in a circular pattern around (0, 0)
  // Spread within ~2.5 degrees radius to keep nodes clustered but clickable
  const radius = Math.random() * 2.5; // Random distance from center (0-2.5 degrees)
  const angle = Math.random() * Math.PI * 2; // Random angle (0-360 degrees)

  const lat = radius * Math.sin(angle);
  const lng = radius * Math.cos(angle);

  return { lat, lng };
}

// Convert IP tracks to globe nodes
export function convertIPTrackToNode(track: IPTrack): TrackNode | TrackNode[] {
  // Check if we have multiple locations
  if (track.locations && Array.isArray(track.locations) && track.locations.length > 0) {
    // Create a node for each location
    return track.locations.map((location, index) => ({
      id: `${track.id}-loc-${index}`,
      title: track.title,
      artist: track.artist || track.creator || 'Unknown Artist',
      coordinates: { lat: location.lat, lng: location.lng },
      genre: track.loop_category || track.content_type,
      content_type: track.content_type,
      duration: track.duration,
      imageUrl: track.cover_image_url || undefined, // Now uses clean Supabase Storage URLs
      audioUrl: track.stream_url || track.video_url || track.audio_url, // Use stream_url for radio, video_url for video clips, audio_url for music
      stream_url: track.stream_url, // Keep stream_url for radio stations
      video_url: track.video_url, // Keep video_url for video clips
      location: location.name, // Add location name for display
      // Include metadata fields
      tags: track.tags,
      description: track.description,
      license: track.license,
      price_stx: track.price_stx,
      bpm: track.bpm,
      // Add aggregation support fields
      uploaderAddress: track.uploader_address || track.primary_uploader_wallet,
      latestActivity: track.updated_at || track.created_at,
      // Add profile image URL - for now using a placeholder
      profileImageUrl: track.profile_image_url || undefined,
      artistName: track.artist || track.creator || 'Unknown Artist',
      // Add IP rights fields for modal display
      composition_split: track.composition_split_1_percentage || 0,
      production_split: track.production_split_1_percentage || 0,
      wallet_address: track.composition_split_1_wallet || track.uploader_address || track.primary_uploader_wallet,
      // Sacred/devotional content protection
      remix_protected: track.remix_protected || false,
      // Pre-generated thumbnails
      thumb_64_url: track.thumb_64_url || undefined,
      thumb_160_url: track.thumb_160_url || undefined,
      thumb_256_url: track.thumb_256_url || undefined,
      // Portal fields
      portal_username: track.portal_username || undefined,
      // Video crop data for WebGL display
      video_crop_x: track.video_crop_x,
      video_crop_y: track.video_crop_y,
      video_crop_width: track.video_crop_width,
      video_crop_height: track.video_crop_height,
      video_crop_zoom: track.video_crop_zoom,
      video_natural_width: track.video_natural_width,
      video_natural_height: track.video_natural_height
    }));
  }
  
  // Use single coordinates if available, otherwise send to Null Island
  const hasLocation = track.location_lat && track.location_lng;
  const coordinates = hasLocation
    ? { lat: track.location_lat, lng: track.location_lng }
    : generateNullIslandCoordinates();

  return {
    id: track.id,
    title: track.title,
    artist: track.artist || track.creator || 'Unknown Artist',
    coordinates,
    genre: track.loop_category || track.content_type,
    content_type: track.content_type,
    duration: track.duration,
    imageUrl: track.cover_image_url || undefined, // Now uses clean Supabase Storage URLs
    audioUrl: track.stream_url || track.video_url || track.audio_url, // Use stream_url for radio, video_url for video clips, audio_url for music
    stream_url: track.stream_url, // Keep stream_url for radio stations
    video_url: track.video_url, // Keep video_url for video clips
    location: hasLocation ? track.primary_location : 'Null Island 🏝️', // Show Null Island for tracks without location
    // Include metadata fields
    tags: track.tags,
    description: track.description,
    license: track.license,
    price_stx: track.price_stx,
    bpm: track.bpm,
    // Add aggregation support fields
    uploaderAddress: track.uploader_address || track.primary_uploader_wallet,
    latestActivity: track.updated_at || track.created_at,
    // Add profile image URL - for now using a placeholder
    // In production, this would come from joining with profiles table
    profileImageUrl: track.profile_image_url || undefined,
    artistName: track.artist || track.creator || 'Unknown Artist',
    // Add IP rights fields for modal display
    composition_split: track.composition_split_1_percentage || 0,
    production_split: track.production_split_1_percentage || 0,
    wallet_address: track.composition_split_1_wallet || track.uploader_address || track.primary_uploader_wallet,
    // Sacred/devotional content protection
    remix_protected: track.remix_protected || false,
    // Pre-generated thumbnails
    thumb_64_url: track.thumb_64_url || undefined,
    thumb_160_url: track.thumb_160_url || undefined,
    thumb_256_url: track.thumb_256_url || undefined,
    // Portal fields
    portal_username: track.portal_username || undefined,
    // Video crop data for WebGL display
    video_crop_x: track.video_crop_x,
    video_crop_y: track.video_crop_y,
    video_crop_width: track.video_crop_width,
    video_crop_height: track.video_crop_height,
    video_crop_zoom: track.video_crop_zoom,
    video_natural_width: track.video_natural_width,
    video_natural_height: track.video_natural_height
  };
}

// Sample profile images for testing
const sampleProfileImages = [
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&q=80',
  'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=200&h=200&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&q=80',
  'https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=200&h=200&q=80',
  'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200&h=200&q=80'
];


// Fetch tracks from all known creators
export async function fetchGlobeTracksFromSupabase(): Promise<TrackNode[]> {
  try {
    // Fetching tracks from Supabase
    
    // Fetch all tracks from the ip_tracks table
    // We're not filtering by wallet address to get ALL tracks for the globe
    // Filter out individual tracks that belong to packs/EPs (keep standalone content and master pack/EP records)
    // REMOVED 50-track limit for alpha testing - users need to see all their content
    // TODO: For production scaling, implement pagination/virtual loading:
    // - Load tracks in geographic regions as user navigates globe
    // - Implement distance-based LOD (Level of Detail)  
    // - Add pagination with "load more" for dense areas
    // - Consider clustering/aggregation for performance
    // Fetch all tracks with proper filtering for loop packs and deleted content
    // We want: standalone content (pack_id null) OR container records (pack_position = 0)
    // This excludes individual tracks within packs/EPs but includes the pack/EP containers themselves
    const { data, error } = await supabase
      .from('ip_tracks')
      .select('id, title, artist, content_type, location_lat, location_lng, primary_location, audio_url, stream_url, video_url, cover_image_url, thumb_64_url, thumb_160_url, thumb_256_url, tags, description, notes, bpm, price_stx, created_at, updated_at, composition_split_1_wallet, composition_split_1_percentage, production_split_1_wallet, production_split_1_percentage, uploader_address, primary_uploader_wallet, locations, remix_protected, pack_id, pack_position, portal_username') // Includes thumbnail URLs for optimized image loading
      .is('deleted_at', null) // Exclude soft-deleted tracks from globe display
      .or('pack_id.is.null,pack_position.eq.0') // Standalone content OR pack/EP container records
      .order('created_at', { ascending: false })
    
    // Tracks found in Supabase
    
    if (error) {
      console.error('Error fetching tracks:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      // No tracks found in Supabase
      return [];
    }
    
    // Processing tracks data
    
    
    // Convert IP tracks to globe nodes
    const nodes: TrackNode[] = [];
    
    for (const track of data) {
      const result = convertIPTrackToNode(track);
      if (Array.isArray(result)) {
        nodes.push(...result);
      } else {
        nodes.push(result);
      }
    }
    
    // Add sample profile images for testing
    // In production, these would come from user profiles
    const artistMap = new Map<string, string>();
    nodes.forEach((node, index) => {
      // Map artists to consistent profile images
      const artistKey = node.uploaderAddress || node.artist;
      if (!artistMap.has(artistKey)) {
        artistMap.set(artistKey, sampleProfileImages[artistMap.size % sampleProfileImages.length]);
      }
      node.profileImageUrl = artistMap.get(artistKey);
    });
    
    // Created nodes from tracks
    
    return nodes;
  } catch (error) {
    console.error('Failed to fetch globe tracks:', error);
    return [];
  }
}

// Export a cached version that can be used immediately while real data loads
export const fallbackGlobeNodes: TrackNode[] = [
  {
    id: "fallback-1",
    title: "Loading tracks...",
    artist: "Please wait",
    coordinates: { lat: 40.7128, lng: -74.0060 },
  }
];