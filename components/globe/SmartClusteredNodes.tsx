"use client";

import React, { useMemo, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { TrackNode } from './types';
import { NodeMesh } from './NodeMesh';
import { RadioNodeMesh } from './RadioNodeMesh';
import { latLngToVector3 } from './Globe';

interface SmartClusteredNodesProps {
  nodes: TrackNode[];
  onNodeClick?: (node: TrackNode) => void;
  onNodeHover?: (node: TrackNode | null) => void;
}

interface LocationGroup {
  key: string;
  nodes: TrackNode[];
  lat: number;
  lng: number;
}

// Group nodes by exact location
function groupNodesByLocation(nodes: TrackNode[]): LocationGroup[] {
  const groups = new Map<string, LocationGroup>();
  
  nodes.forEach(node => {
    // Create a key based on rounded coordinates (to handle minor floating point differences)
    const lat = Math.round(node.coordinates.lat * 1000) / 1000;
    const lng = Math.round(node.coordinates.lng * 1000) / 1000;
    const key = `${lat},${lng}`;
    
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        nodes: [],
        lat: node.coordinates.lat,
        lng: node.coordinates.lng
      });
    }
    
    groups.get(key)!.nodes.push(node);
  });
  
  return Array.from(groups.values());
}

export function SmartClusteredNodes({ nodes, onNodeClick, onNodeHover }: SmartClusteredNodesProps) {
  const { camera } = useThree();
  const [cameraDistance, setCameraDistance] = useState(2.5);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  
  // Debug: log initial nodes
  console.log(`🎯 SmartClusteredNodes received ${nodes.length} nodes`);
  
  // Update camera distance
  useFrame(() => {
    const distance = camera.position.length();
    setCameraDistance(distance);
  });
  
  // Group nodes by location
  const locationGroups = useMemo(() => {
    const groups = groupNodesByLocation(nodes);
    console.log('📍 Location groups:', groups.map(g => ({
      location: g.nodes[0]?.location || `${g.lat},${g.lng}`,
      count: g.nodes.length,
      nodes: g.nodes.map(n => n.title)
    })));
    return groups;
  }, [nodes]);
  
  // Calculate dynamic spread radius based on zoom
  const spreadRadius = useMemo(() => {
    const minDist = 1.2;
    const maxDist = 5;
    const minRadius = 0.5;   // Half a degree at max zoom
    const maxRadius = 2.0;   // 2 degrees at min zoom
    
    const normalizedDist = Math.max(0, Math.min(1, (cameraDistance - minDist) / (maxDist - minDist)));
    return maxRadius - (normalizedDist * (maxRadius - minRadius));
  }, [cameraDistance]);
  
  // Handle cluster click
  const handleGroupClick = useCallback((group: LocationGroup) => {
    // For now, just click the first node
    if (onNodeClick && group.nodes.length > 0) {
      onNodeClick(group.nodes[0]);
    }
  }, [onNodeClick]);
  
  // Debug: log what we're rendering
  console.log(`🎨 Rendering ${locationGroups.length} location groups`);
  
  // If no nodes, return null
  if (nodes.length === 0) {
    console.log('⚠️ No nodes to render');
    return null;
  }
  
  // Helper function to render the appropriate node mesh
  const renderNode = (node: TrackNode, onClick: () => void, onHover: (hovering: boolean) => void) => {
    const isRadioStation = node.content_type === 'radio_station' || node.content_type === 'station_pack';
    const NodeComponent = isRadioStation ? RadioNodeMesh : NodeMesh;

    return (
      <NodeComponent
        key={node.id}
        node={node}
        onClick={onClick}
        onHover={onHover}
      />
    );
  };

  // If grouping fails, render nodes directly
  if (locationGroups.length === 0) {
    console.log('⚠️ Grouping failed, rendering nodes directly');
    return (
      <>
        {nodes.map((node) => renderNode(
          node,
          () => onNodeClick?.(node),
          (hovering) => onNodeHover?.(hovering ? node : null)
        ))}
      </>
    );
  }
  
  return (
    <>
      {locationGroups.map((group) => {
        const isHovered = hoveredGroup === group.key;
        
        if (group.nodes.length === 1) {
          // Single node - render normally
          return renderNode(
            group.nodes[0],
            () => onNodeClick?.(group.nodes[0]),
            (hovering) => {
              setHoveredGroup(hovering ? group.key : null);
              onNodeHover?.(hovering ? group.nodes[0] : null);
            }
          );
        }
        
        // Multiple nodes at same location - spread them out
        return (
          <group key={group.key}>
            {group.nodes.map((node, index) => {
              // Calculate position in a spiral pattern for better distribution
              const angleStep = (Math.PI * 2) / group.nodes.length;
              const angle = index * angleStep;
              
              // Add a small spiral offset for very dense clusters
              const spiralOffset = (index / group.nodes.length) * 0.01;
              const radius = spreadRadius + spiralOffset;
              
              // Calculate offset in degrees (radius is already in degrees)
              const offsetLat = Math.sin(angle) * radius;
              const offsetLng = Math.cos(angle) * radius;
              
              // Apply offset to position
              const position = latLngToVector3(
                group.lat + offsetLat,
                group.lng + offsetLng,
                1.02
              );
              
              return (
                <group key={node.id} position={position}>
                  {renderNode(
                    node,
                    () => onNodeClick?.(node),
                    (hovering) => {
                      setHoveredGroup(hovering ? group.key : null);
                      onNodeHover?.(hovering ? node : null);
                    }
                  )}
                </group>
              );
            })}
            
            {/* Count indicator for clusters - only show when zoomed out */}
            {group.nodes.length > 2 && cameraDistance > 3 && (
              <group position={latLngToVector3(group.lat, group.lng, 1.025)}>
                <Text
                  fontSize={0.03 * (cameraDistance / 2.5)}
                  color={isHovered ? "#ff0066" : "#ffffff"}
                  anchorX="center"
                  anchorY="middle"
                  outlineWidth={0.003}
                  outlineColor="#000000"
                  renderOrder={999}
                >
                  {group.nodes.length}
                </Text>
              </group>
            )}
            
            {/* Invisible click target for entire cluster when zoomed out */}
            {group.nodes.length > 3 && cameraDistance > 2 && (
              <mesh 
                position={latLngToVector3(group.lat, group.lng, 1.02)}
                onClick={() => handleGroupClick(group)}
                onPointerOver={() => {
                  setHoveredGroup(group.key);
                  document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                  setHoveredGroup(null);
                  document.body.style.cursor = 'default';
                }}
              >
                <sphereGeometry args={[spreadRadius * 2, 16, 16]} />
                <meshBasicMaterial 
                  transparent 
                  opacity={0} 
                />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}