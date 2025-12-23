import { TrackNode } from '@/components/globe/types';
import * as THREE from 'three';
import { latLngToVector3 } from '@/components/globe/Globe';

export interface NodeCluster {
  id: string;
  nodes: TrackNode[];
  center: { lat: number; lng: number };
  position: THREE.Vector3;
}

// Haversine distance between two lat/lng points in kilometers
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Cluster nodes based on proximity and zoom level
export function clusterNodes(nodes: TrackNode[], cameraDistance: number): NodeCluster[] {
  // Dynamic clustering distance based on zoom
  // Closer camera = smaller clustering distance
  const minDistance = 1.2;
  const maxDistance = 5;
  const minClusterRadius = 10; // km at max zoom
  const maxClusterRadius = 500; // km at min zoom
  
  const normalizedDist = (cameraDistance - minDistance) / (maxDistance - minDistance);
  const clusterRadius = minClusterRadius + normalizedDist * (maxClusterRadius - minClusterRadius);
  
  const clusters: NodeCluster[] = [];
  const processed = new Set<string>();
  
  nodes.forEach(node => {
    if (processed.has(node.id)) return;
    
    // Find all nodes within cluster radius
    const clusterNodes = nodes.filter(other => {
      if (processed.has(other.id)) return false;
      const distance = haversineDistance(
        node.coordinates.lat, node.coordinates.lng,
        other.coordinates.lat, other.coordinates.lng
      );
      return distance <= clusterRadius;
    });
    
    // Mark all nodes as processed
    clusterNodes.forEach(n => processed.add(n.id));
    
    // Calculate cluster center (average position)
    const centerLat = clusterNodes.reduce((sum, n) => sum + n.coordinates.lat, 0) / clusterNodes.length;
    const centerLng = clusterNodes.reduce((sum, n) => sum + n.coordinates.lng, 0) / clusterNodes.length;
    
    clusters.push({
      id: `cluster-${node.id}`,
      nodes: clusterNodes,
      center: { lat: centerLat, lng: centerLng },
      position: latLngToVector3(centerLat, centerLng, 1.02)
    });
  });
  
  return clusters;
}

// Apply smart offset to nodes within a cluster for better visibility
export function applyClusterOffset(
  nodes: TrackNode[], 
  clusterCenter: { lat: number; lng: number },
  cameraDistance: number
): Array<{ node: TrackNode; offset: THREE.Vector3 }> {
  if (nodes.length === 1) {
    return [{
      node: nodes[0],
      offset: latLngToVector3(clusterCenter.lat, clusterCenter.lng, 1.02)
    }];
  }
  
  // Dynamic spread radius based on zoom
  const minDist = 1.2;
  const maxDist = 5;
  const minRadius = 0.02;
  const maxRadius = 0.2;
  
  const normalizedDist = (cameraDistance - minDist) / (maxDist - minDist);
  const spreadRadius = maxRadius - (normalizedDist * (maxRadius - minRadius));
  
  return nodes.map((node, index) => {
    const angle = (index * Math.PI * 2) / nodes.length;
    const offsetLat = Math.sin(angle) * spreadRadius;
    const offsetLng = Math.cos(angle) * spreadRadius;
    
    return {
      node,
      offset: latLngToVector3(
        clusterCenter.lat + offsetLat,
        clusterCenter.lng + offsetLng,
        1.02
      )
    };
  });
}