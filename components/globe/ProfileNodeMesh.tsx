"use client";

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { Text, RoundedBox } from '@react-three/drei';
import { NodeMeshProps } from './types';
import { latLngToVector3 } from './Globe';

// Zoom level thresholds
const ZOOM_LEVELS = {
  FAR: { min: 2.5, max: 8 },      // Colored dots
  MEDIUM: { min: 1.8, max: 2.5 }, // Rounded squares
  CLOSE: { min: 1.05, max: 1.8 }  // Profile pictures
};

// Color palettes (same as NodeMesh for consistency)
const SUBTLE_COLORS = [
  '#ff99cc', // Soft pink
  '#99ffcc', // Soft mint
  '#cc99ff', // Soft lavender
  '#ffcc99', // Soft peach
  '#99ccff', // Soft sky
];

const VIBRANT_COLORS = [
  '#ff0066', // Hot pink
  '#00ff88', // Electric green
  '#00bbff', // Bright cyan
  '#ffaa00', // Vibrant orange
  '#ff00ff', // Magenta
];

export function ProfileNodeMesh({ node, onClick, onHover }: NodeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();
  const [zoomLevel, setZoomLevel] = useState<'far' | 'medium' | 'close'>('far');
  const [profileTexture, setProfileTexture] = useState<THREE.Texture | null>(null);
  
  // Calculate position
  const position = useMemo(() => {
    return latLngToVector3(node.coordinates.lat, node.coordinates.lng, 1.02);
  }, [node.coordinates]);
  
  // Assign colors based on node ID (consistent with original)
  const colorIndex = useMemo(() => {
    const hash = node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash % SUBTLE_COLORS.length;
  }, [node.id]);
  
  const subtleColor = SUBTLE_COLORS[colorIndex];
  const vibrantColor = VIBRANT_COLORS[colorIndex];
  
  // Load profile image texture if available
  useEffect(() => {
    if (node.profileImageUrl || (node.isAggregated && node.imageUrl)) {
      const imageUrl = node.profileImageUrl || node.imageUrl;
      const loader = new THREE.TextureLoader();
      
      loader.load(
        imageUrl,
        (texture) => {
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          setProfileTexture(texture);
        },
        undefined,
        (error) => {
          console.warn('Failed to load profile image:', error);
        }
      );
    }
  }, [node.profileImageUrl, node.imageUrl, node.isAggregated]);
  
  // Update zoom level and handle animations
  useFrame(() => {
    if (!groupRef.current) return;
    
    const distance = camera.position.length();
    
    // Determine zoom level
    if (distance >= ZOOM_LEVELS.FAR.min) {
      setZoomLevel('far');
    } else if (distance >= ZOOM_LEVELS.MEDIUM.min) {
      setZoomLevel('medium');
    } else {
      setZoomLevel('close');
    }
    
    // Scale compensation to maintain consistent visual size
    const referenceDistance = 2.5;
    const scaleCompensation = distance / referenceDistance;
    
    // Different scale factors for different zoom levels
    let scale = scaleCompensation;
    if (zoomLevel === 'far') {
      scale *= 0.7; // Smaller dots when far
    } else if (zoomLevel === 'medium') {
      scale *= 0.9; // Medium size for squares
    } else {
      scale *= 1.2; // Larger for profile pics
    }
    
    // Apply hover effect
    if (hovered) {
      scale *= 1.2;
    }
    
    // Smooth transition
    groupRef.current.scale.lerp(
      new THREE.Vector3(scale, scale, scale),
      0.1
    );
    
    // Billboard effect for close zoom (always face camera)
    if (zoomLevel === 'close') {
      groupRef.current.lookAt(camera.position);
    }
  });
  
  const handlePointerOver = () => {
    setHovered(true);
    onHover(true);
    document.body.style.cursor = 'pointer';
  };
  
  const handlePointerOut = () => {
    setHovered(false);
    onHover(false);
    document.body.style.cursor = 'default';
  };
  
  // Render different geometries based on zoom level
  const renderNode = () => {
    switch (zoomLevel) {
      case 'far':
        // Beautiful colored dots (preserve existing look)
        return (
          <>
            {/* Outer glow */}
            <mesh>
              <sphereGeometry args={[0.035, 16, 16]} />
              <meshBasicMaterial
                color={hovered ? vibrantColor : subtleColor}
                opacity={0.2}
                transparent
                blending={THREE.AdditiveBlending}
              />
            </mesh>
            
            {/* Core dot */}
            <mesh
              ref={meshRef}
              onClick={onClick}
              onPointerOver={handlePointerOver}
              onPointerOut={handlePointerOut}
            >
              <sphereGeometry args={[0.018, 16, 16]} />
              <meshStandardMaterial
                color={hovered ? vibrantColor : "#ffffff"}
                emissive={hovered ? vibrantColor : subtleColor}
                emissiveIntensity={hovered ? 0.8 : 0.3}
                metalness={0.3}
                roughness={0.4}
              />
            </mesh>
          </>
        );
        
      case 'medium':
        // Rounded squares with color hint
        return (
          <>
            <RoundedBox
              args={[0.04, 0.04, 0.002]}
              radius={0.008}
              onClick={onClick}
              onPointerOver={handlePointerOver}
              onPointerOut={handlePointerOut}
            >
              <meshStandardMaterial
                color={hovered ? vibrantColor : "#ffffff"}
                emissive={subtleColor}
                emissiveIntensity={hovered ? 0.6 : 0.2}
                metalness={0.2}
                roughness={0.6}
              />
            </RoundedBox>
            
            {/* Small indicator for aggregated nodes */}
            {node.isAggregated && node.trackCount && node.trackCount > 1 && (
              <mesh position={[0.02, 0.02, 0.001]}>
                <circleGeometry args={[0.008, 16]} />
                <meshBasicMaterial color="#000000" opacity={0.8} transparent />
              </mesh>
            )}
          </>
        );
        
      case 'close':
        // Profile pictures with name
        return (
          <>
            {/* Profile image or colored square */}
            <RoundedBox
              args={[0.06, 0.06, 0.002]}
              radius={0.01}
              onClick={onClick}
              onPointerOver={handlePointerOver}
              onPointerOut={handlePointerOut}
            >
              {profileTexture ? (
                <meshBasicMaterial map={profileTexture} />
              ) : (
                <meshStandardMaterial
                  color={vibrantColor}
                  emissive={subtleColor}
                  emissiveIntensity={0.3}
                />
              )}
            </RoundedBox>
            
            {/* Border/frame */}
            <mesh position={[0, 0, -0.001]}>
              <RoundedBox args={[0.065, 0.065, 0.001]} radius={0.011}>
                <meshBasicMaterial 
                  color={hovered ? vibrantColor : "#ffffff"} 
                  opacity={hovered ? 0.8 : 0.3} 
                  transparent 
                />
              </RoundedBox>
            </mesh>
            
            {/* Artist name below */}
            <Text
              position={[0, -0.045, 0]}
              fontSize={0.015}
              color={hovered ? vibrantColor : "#ffffff"}
              anchorX="center"
              anchorY="top"
              outlineWidth={0.002}
              outlineColor="#000000"
            >
              {node.artistName || node.artist || 'Artist'}
            </Text>
            
            {/* Track count for aggregated nodes */}
            {node.isAggregated && node.trackCount && node.trackCount > 1 && (
              <group position={[0.025, 0.025, 0.002]}>
                <mesh>
                  <circleGeometry args={[0.01, 16]} />
                  <meshBasicMaterial color="#ff0066" />
                </mesh>
                <Text
                  fontSize={0.012}
                  color="#ffffff"
                  anchorX="center"
                  anchorY="middle"
                  position={[0, 0, 0.001]}
                >
                  {node.trackCount}
                </Text>
              </group>
            )}
          </>
        );
    }
  };
  
  return (
    <group ref={groupRef} position={position}>
      {renderNode()}
    </group>
  );
}