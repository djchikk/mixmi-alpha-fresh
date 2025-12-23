import { TrackNode } from '@/components/globe/types';

export interface AggregationOptions {
  enabled: boolean;
  minTracksForAggregation?: number; // Only aggregate if user has more than X tracks
  preserveLatestImage?: boolean; // Use the most recent track's image
}

/**
 * Aggregates tracks by user and location
 * Each user at each location becomes a single node
 */
export function aggregateTracksByUser(
  tracks: TrackNode[], 
  options: AggregationOptions = { enabled: true, minTracksForAggregation: 1, preserveLatestImage: true }
): TrackNode[] {
  
  // If aggregation is disabled, return original tracks
  if (!options.enabled) {
    return tracks;
  }

  console.log(`📊 Aggregating ${tracks.length} tracks by user...`);
  
  const userLocationGroups = new Map<string, TrackNode>();
  const processedTracks: TrackNode[] = [];
  
  tracks.forEach(track => {
    // Skip if no uploader address (shouldn't happen, but safety check)
    if (!track.uploaderAddress) {
      processedTracks.push(track);
      return;
    }
    
    // Create unique key for user + location
    const locationKey = `${Math.round(track.coordinates.lat * 1000) / 1000}_${Math.round(track.coordinates.lng * 1000) / 1000}`;
    const key = `${track.uploaderAddress}_${locationKey}`;
    
    if (!userLocationGroups.has(key)) {
      // First track for this user at this location
      userLocationGroups.set(key, {
        ...track,
        id: `aggregated_${key}`,
        title: track.artist ? `${track.artist}` : 'Artist Collection',
        isAggregated: true,
        trackCount: 1,
        tracks: [track],
        latestActivity: track.latestActivity || new Date().toISOString(),
        // Preserve profile image and artist name
        profileImageUrl: track.profileImageUrl,
        artistName: track.artistName || track.artist
      });
    } else {
      // Add to existing group
      const group = userLocationGroups.get(key)!;
      group.trackCount = (group.trackCount || 0) + 1;
      group.tracks = [...(group.tracks || []), track];
      
      // Update to latest track info if newer
      if (track.latestActivity && (!group.latestActivity || track.latestActivity > group.latestActivity)) {
        group.latestActivity = track.latestActivity;
        
        if (options.preserveLatestImage && track.imageUrl) {
          group.imageUrl = track.imageUrl;
        }
      }
      
      // Update title with count
      group.title = `${track.artist || 'Artist'} (${group.trackCount} tracks)`;
    }
  });
  
  // Convert groups back to array, checking if they meet aggregation threshold
  userLocationGroups.forEach((group, key) => {
    if (group.trackCount && group.trackCount >= (options.minTracksForAggregation || 1)) {
      // Keep as aggregated node
      processedTracks.push(group);
    } else {
      // Return individual tracks if below threshold
      if (group.tracks) {
        processedTracks.push(...group.tracks);
      }
    }
  });
  
  console.log(`✅ Aggregation complete: ${tracks.length} tracks → ${processedTracks.length} nodes`);
  console.log(`📈 Reduction: ${Math.round((1 - processedTracks.length / tracks.length) * 100)}%`);
  
  return processedTracks;
}

/**
 * Toggles between aggregated and individual view
 */
export function toggleAggregation(
  originalTracks: TrackNode[],
  currentlyAggregated: boolean
): { tracks: TrackNode[], isAggregated: boolean } {
  if (currentlyAggregated) {
    // Return to individual tracks
    const individualTracks: TrackNode[] = [];
    
    originalTracks.forEach(track => {
      if (track.isAggregated && track.tracks) {
        // Expand aggregated node back to individual tracks
        individualTracks.push(...track.tracks);
      } else {
        individualTracks.push(track);
      }
    });
    
    return { tracks: individualTracks, isAggregated: false };
  } else {
    // Aggregate tracks
    return { 
      tracks: aggregateTracksByUser(originalTracks), 
      isAggregated: true 
    };
  }
}