import { TrackNode } from '@/components/globe/types';

export interface ClusterNode extends TrackNode {
  isCluster: true;
  tracks: TrackNode[];
  clusterCount: number;
  isExpanded?: boolean;
}

export interface ClusterOptions {
  enabled: boolean;
  distanceThreshold?: number; // Distance in degrees to group locations
  minTracksForCluster?: number; // Minimum tracks needed to create cluster
}

/**
 * Simple location-based clustering for globe nodes
 * Groups tracks by proximity and creates expandable clusters
 */
export function createLocationClusters(
  tracks: TrackNode[], 
  options: ClusterOptions = { 
    enabled: true, 
    distanceThreshold: 0.05, // ~5km radius
    minTracksForCluster: 2 
  }
): TrackNode[] {
  if (!options.enabled) {
    return tracks;
  }

  console.log(`🌸 Creating location clusters for ${tracks.length} tracks...`);
  
  const clusters = new Map<string, TrackNode[]>();
  const processedTracks: TrackNode[] = [];
  
  // Group tracks by rounded location
  tracks.forEach(track => {
    // Round coordinates to create location groups
    const precision = options.distanceThreshold || 0.05;
    const locationKey = `${Math.round(track.coordinates.lat / precision) * precision}_${Math.round(track.coordinates.lng / precision) * precision}`;
    
    if (!clusters.has(locationKey)) {
      clusters.set(locationKey, []);
    }
    clusters.get(locationKey)!.push(track);
  });
  
  // Create cluster nodes or individual nodes
  clusters.forEach((tracksInLocation, locationKey) => {
    if (tracksInLocation.length >= (options.minTracksForCluster || 2)) {
      // Create cluster node
      const firstTrack = tracksInLocation[0];
      const avgLat = tracksInLocation.reduce((sum, t) => sum + t.coordinates.lat, 0) / tracksInLocation.length;
      const avgLng = tracksInLocation.reduce((sum, t) => sum + t.coordinates.lng, 0) / tracksInLocation.length;
      
      // Get location name from first track, or generate one
      const locationName = firstTrack.location || 
        tracksInLocation.find(t => t.location)?.location || 
        `Location ${Math.round(avgLat * 100) / 100}, ${Math.round(avgLng * 100) / 100}`;
      
      const clusterNode: ClusterNode = {
        id: `cluster_${locationKey}`,
        title: `${locationName} (${tracksInLocation.length} tracks)`,
        artist: `${tracksInLocation.length} artists`,
        coordinates: { lat: avgLat, lng: avgLng },
        genre: 'cluster',
        content_type: 'cluster',
        imageUrl: firstTrack.imageUrl, // Use first track's image
        audioUrl: undefined, // Clusters don't have audio
        location: locationName,
        isCluster: true as const,
        tracks: tracksInLocation,
        clusterCount: tracksInLocation.length,
        isExpanded: false,
        // Visual indicators for cluster
        profileImageUrl: firstTrack.profileImageUrl,
        artistName: `${tracksInLocation.length} tracks`,
        uploaderAddress: 'cluster',
        latestActivity: tracksInLocation[0].latestActivity
      };
      
      processedTracks.push(clusterNode as TrackNode);
    } else {
      // Single track - add as individual node
      processedTracks.push(...tracksInLocation);
    }
  });
  
  console.log(`✅ Clustering complete: ${tracks.length} tracks → ${processedTracks.length} nodes`);
  const clusterCount = processedTracks.filter(n => (n as ClusterNode).isCluster).length;
  console.log(`🌸 Created ${clusterCount} clusters`);
  
  return processedTracks;
}

/**
 * Expand a cluster into individual track positions
 * Arranges tracks in a circle around the cluster center
 */
export function expandCluster(clusterNode: ClusterNode): TrackNode[] {
  const { tracks, coordinates } = clusterNode;
  const radius = 0.01; // ~1km radius for expansion
  
  return tracks.map((track, index) => {
    const angle = (index / tracks.length) * 2 * Math.PI;
    const expandedCoordinates = {
      lat: coordinates.lat + Math.cos(angle) * radius,
      lng: coordinates.lng + Math.sin(angle) * radius
    };
    
    return {
      ...track,
      id: `${track.id}_expanded`,
      coordinates: expandedCoordinates,
      isExpanded: true
    };
  });
}

/**
 * Check if a node is a cluster
 */
export function isClusterNode(node: TrackNode): node is ClusterNode {
  return (node as ClusterNode).isCluster === true;
}

/**
 * Get cluster statistics for debugging
 */
export function getClusterStats(nodes: TrackNode[]) {
  const clusters = nodes.filter(isClusterNode);
  const totalTracks = clusters.reduce((sum, cluster) => sum + cluster.clusterCount, 0);
  const individualNodes = nodes.filter(n => !isClusterNode(n));
  
  return {
    totalNodes: nodes.length,
    clusters: clusters.length,
    individualNodes: individualNodes.length,
    tracksInClusters: totalTracks,
    totalTracks: totalTracks + individualNodes.length
  };
}