"use client";

import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TrackNode } from './types';
import { latLngToVector3 } from './Globe';
import { ProfileNodeMesh } from './ProfileNodeMesh';

// Node size categories based on zoom
const ZOOM_LEVELS = {
  FAR: { min: 3, max: 8, scale: 1, glowOpacity: 0.5, nodeSize: 0.02 },
  MEDIUM: { min: 1.8, max: 3, scale: 0.5, glowOpacity: 0.25, nodeSize: 0.015 },
  CLOSE: { min: 1.05, max: 1.8, scale: 0.2, glowOpacity: 0, nodeSize: 0.01 }
};

// Color palettes
const COLORS = [
  '#ff0066', // Hot pink
  '#00ff88', // Electric green
  '#00bbff', // Bright cyan
  '#ffaa00', // Vibrant orange
  '#ff00ff', // Magenta
  '#ffff00', // Yellow
  '#00ffff', // Cyan
  '#ff6b6b', // Coral
];

interface GridNodeSystemProps {
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

// Group nodes by location
function groupNodesByLocation(nodes: TrackNode[]): LocationGroup[] {
  const groups = new Map<string, LocationGroup>();
  
  nodes.forEach(node => {
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

// Calculate grid position for a node
function getGridPosition(index: number, total: number, baseSpacing: number): { x: number; y: number } {
  // Calculate grid dimensions
  const cols = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / cols);
  
  // Calculate position in grid
  const col = index % cols;
  const row = Math.floor(index / cols);
  
  // Center the grid
  const offsetX = (cols - 1) * baseSpacing / 2;
  const offsetY = (rows - 1) * baseSpacing / 2;
  
  return {
    x: col * baseSpacing - offsetX,
    y: row * baseSpacing - offsetY
  };
}

// Individual node component
function GridNode({ 
  node, 
  position, 
  color, 
  onClick, 
  onHover,
  groupSize 
}: { 
  node: TrackNode; 
  position: THREE.Vector3;
  color: string;
  onClick: () => void;
  onHover: (hovering: boolean) => void;
  groupSize: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const outerGlowRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [hovered, setHovered] = React.useState(false);
  
  // Animation values for smooth transitions
  const hoverTransition = useRef({
    scale: 1,
    glowOpacity: 0.3,
    glowScale: 1
  });
  
  useFrame((state, delta) => {
    if (!groupRef.current || !meshRef.current || !glowRef.current || !ringRef.current) return;
    
    const distance = camera.position.length();
    
    // Determine zoom level
    let zoomLevel = ZOOM_LEVELS.FAR;
    if (distance <= ZOOM_LEVELS.CLOSE.max) {
      zoomLevel = ZOOM_LEVELS.CLOSE;
    } else if (distance <= ZOOM_LEVELS.MEDIUM.max) {
      zoomLevel = ZOOM_LEVELS.MEDIUM;
    }
    
    // Progressive scaling
    const t = (distance - zoomLevel.min) / (zoomLevel.max - zoomLevel.min);
    const scaleFactor = Math.max(0.1, Math.min(1, t));
    
    // Maintain constant visual size with inverse scaling
    const referenceDistance = 2.5;
    const scaleCompensation = distance / referenceDistance;
    
    // Base scale that keeps dots at consistent pixel size
    let constantSizeScale = scaleCompensation * 0.7; // Fine-tuned for clusters
    
    // Apply additional scaling for groups in close view
    if (distance < ZOOM_LEVELS.CLOSE.max && groupSize > 1) {
      constantSizeScale *= 0.8; // Make nodes slightly smaller when in groups
    }
    
    // Clamp scale to reasonable bounds
    const minScale = 0.4;
    const maxScale = 2.5;
    constantSizeScale = Math.max(minScale, Math.min(maxScale, constantSizeScale));
    
    groupRef.current.scale.setScalar(constantSizeScale);
    
    // Smooth hover transitions
    const transitionSpeed = 8;
    const targetScale = hovered ? 1.2 : 1;
    const targetGlowOpacity = hovered ? 0.7 : zoomLevel.glowOpacity * scaleFactor;
    const targetGlowScale = hovered ? 1.4 : 1;
    
    // Interpolate values
    hoverTransition.current.scale += (targetScale - hoverTransition.current.scale) * delta * transitionSpeed;
    hoverTransition.current.glowOpacity += (targetGlowOpacity - hoverTransition.current.glowOpacity) * delta * transitionSpeed;
    hoverTransition.current.glowScale += (targetGlowScale - hoverTransition.current.glowScale) * delta * transitionSpeed;
    
    // Fade glow based on zoom and hover
    if (glowRef.current.material instanceof THREE.MeshBasicMaterial) {
      glowRef.current.material.opacity = hoverTransition.current.glowOpacity;
    }
    
    // Apply glow scale
    glowRef.current.scale.setScalar(hoverTransition.current.glowScale);
    
    // Show ring when close, hide when far
    if (ringRef.current.material instanceof THREE.MeshBasicMaterial) {
      const ringOpacity = hovered ? 1 : (distance < ZOOM_LEVELS.MEDIUM.max ? 0.8 : 0);
      ringRef.current.material.opacity = ringOpacity;
    }
    
    // Subtle pulse continues on hover
    const time = state.clock.elapsedTime;
    const basePulse = Math.sin(time * 2) * 0.05;
    const scale = hoverTransition.current.scale + basePulse;
    meshRef.current.scale.setScalar(scale);
    
    // Update outer glow if exists
    if (outerGlowRef.current) {
      outerGlowRef.current.scale.setScalar(hoverTransition.current.glowScale * 1.5);
    }
  });
  
  return (
    <group ref={groupRef} position={position}>
      {/* Extra outer glow for enhanced hover effect */}
      <mesh ref={outerGlowRef}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={hovered ? hoverTransition.current.glowOpacity * 0.4 : 0}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Main glow effect */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Core node */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={() => {
          setHovered(true);
          onHover(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          onHover(false);
          document.body.style.cursor = 'default';
        }}
      >
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshStandardMaterial 
          color={hovered ? '#ffffff' : color} 
          emissive={color}
          emissiveIntensity={hovered ? 0.8 : 0.5}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
      
      {/* Ring for better visibility when zoomed in */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.025, 0.03, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export function GridNodeSystem({ nodes, onNodeClick, onNodeHover }: GridNodeSystemProps) {
  const { camera } = useThree();
  
  // Group nodes by location
  const locationGroups = useMemo(() => {
    return groupNodesByLocation(nodes);
  }, [nodes]);
  
  // Track camera distance for grid spacing
  const [cameraDistance, setCameraDistance] = React.useState(2.5);
  
  useFrame(() => {
    setCameraDistance(camera.position.length());
  });
  
  // Calculate grid spacing based on zoom
  const gridSpacing = useMemo(() => {
    if (cameraDistance < ZOOM_LEVELS.CLOSE.max) {
      return 0.02; // Very tight grid when close (like app icons)
    } else if (cameraDistance < ZOOM_LEVELS.MEDIUM.max) {
      return 0.05; // Medium spacing with some spread
    }
    return 0; // No grid spacing when far - nodes overlap
  }, [cameraDistance]);
  
  return (
    <>
      {locationGroups.map((group) => {
        const basePosition = latLngToVector3(group.lat, group.lng, 1.02);
        
        return (
          <group key={group.key}>
            {group.nodes.map((node, index) => {
              // Assign color based on node ID
              const colorIndex = node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % COLORS.length;
              const color = COLORS[colorIndex];
              
              // Calculate position
              let finalPosition = basePosition;
              
              // Apply grid positioning when zoomed in and multiple nodes
              if (group.nodes.length > 1 && gridSpacing > 0) {
                const gridPos = getGridPosition(index, group.nodes.length, 1);
                
                // Create offset vector in 3D space
                const right = new THREE.Vector3(1, 0, 0);
                const up = new THREE.Vector3(0, 1, 0);
                
                // Orient to surface normal
                const normal = basePosition.clone().normalize();
                const tangent = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
                const bitangent = normal.clone().cross(tangent).normalize();
                
                // Apply grid offset
                const offset = tangent.multiplyScalar(gridPos.x * gridSpacing)
                  .add(bitangent.multiplyScalar(gridPos.y * gridSpacing));
                
                finalPosition = basePosition.clone().add(offset);
              }
              
              // Use ProfileNodeMesh for aggregated nodes, GridNode for regular
              if (node.isAggregated) {
                return (
                  <ProfileNodeMesh
                    key={node.id}
                    node={node}
                    onClick={() => onNodeClick?.(node)}
                    onHover={(hovering) => onNodeHover?.(hovering ? node : null)}
                  />
                );
              }
              
              return (
                <GridNode
                  key={node.id}
                  node={node}
                  position={finalPosition}
                  color={color}
                  onClick={() => onNodeClick?.(node)}
                  onHover={(hovering) => onNodeHover?.(hovering ? node : null)}
                  groupSize={group.nodes.length}
                />
              );
            })}
          </group>
        );
      })}
    </>
  );
}