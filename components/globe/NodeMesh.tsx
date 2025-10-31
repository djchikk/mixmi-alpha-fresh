"use client";

import React, { useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { NodeMeshProps } from './types';
import { latLngToVector3 } from './Globe';

// Subtle color palette for default state
const SUBTLE_COLORS = [
  '#ff99cc', // Soft pink
  '#99ffcc', // Soft mint
  '#cc99ff', // Soft lavender
  '#ffcc99', // Soft peach
  '#99ccff', // Soft sky
];

// Vibrant colors for hover state
const VIBRANT_COLORS = [
  '#ff0066', // Hot pink
  '#00ff88', // Electric green
  '#00bbff', // Bright cyan
  '#ffaa00', // Vibrant orange
  '#ff00ff', // Magenta
];

export function NodeMesh({ node, onClick, onHover }: NodeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const outerGlowRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();
  
  // Animation values for smooth transitions
  const hoverTransition = useRef({
    scale: 1,
    glowOpacity: 0.2,
    glowScale: 1
  });
  
  // Calculate dynamic position based on zoom level
  const [dynamicPosition, setDynamicPosition] = useState<THREE.Vector3>(() => {
    return latLngToVector3(node.coordinates.lat, node.coordinates.lng, 1.02);
  });
  
  // Calculate offset based on node grouping and zoom level
  const calculateOffset = useMemo(() => {
    // Add null safety check
    const nodeId = node.id || 'fallback';

    // Use the loc-N suffix to determine position in circle
    const locMatch = nodeId.match(/-loc-(\d+)$/);
    const locationIndex = locMatch ? parseInt(locMatch[1]) : 0;

    // Also hash the base track ID for additional offset
    const baseId = nodeId.split('-loc-')[0];
    const hash = baseId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Calculate angle for circular arrangement
    const angle = (locationIndex * Math.PI * 2) / 3 + (hash % 360) * Math.PI / 180;
    
    return { angle, locationIndex };
  }, [node.id]);
  
  // Debug log for specific tracks
  if (node.title === "3 Location Test") {
    console.log(`🎯 Rendering node for "${node.title}" at ${node.location}:`, {
      coordinates: node.coordinates,
      position: dynamicPosition,
      id: node.id
    });
  }
  
  // Assign colors based on node ID
  const colorIndex = useMemo(() => {
    // Use node ID to deterministically assign a color (with null safety)
    const nodeId = node.id || 'fallback';
    const hash = nodeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash % SUBTLE_COLORS.length;
  }, [node.id]);
  
  const subtleColor = SUBTLE_COLORS[colorIndex];
  const vibrantColor = VIBRANT_COLORS[colorIndex];
  
  // Update position and scale based on camera distance
  useFrame((state, delta) => {
    if (groupRef.current && meshRef.current && glowRef.current && ringRef.current) {
      // Calculate camera distance to globe center
      const cameraDistance = camera.position.length();
      
      // Calculate zoom-dependent spread (more zoom = more spread)
      // Map camera distance (1.2 to 5) to spread radius (0.01 to 0.15)
      const minDist = 1.2;
      const maxDist = 5;
      const minRadius = 0.01;
      const maxRadius = 0.15;
      
      // Invert the relationship: closer camera = larger spread
      const normalizedDist = (cameraDistance - minDist) / (maxDist - minDist);
      const spreadRadius = maxRadius - (normalizedDist * (maxRadius - minRadius));
      
      // Only apply offset if this node has a location index (multi-location track)
      if (calculateOffset.locationIndex > 0) {
        const offsetLat = Math.sin(calculateOffset.angle) * spreadRadius;
        const offsetLng = Math.cos(calculateOffset.angle) * spreadRadius;
        
        const offsetPosition = latLngToVector3(
          node.coordinates.lat + offsetLat,
          node.coordinates.lng + offsetLng,
          1.02
        );
        
        groupRef.current.position.copy(offsetPosition);
      } else {
        // Single location nodes stay at their original position
        const basePosition = latLngToVector3(node.coordinates.lat, node.coordinates.lng, 1.02);
        groupRef.current.position.copy(basePosition);
      }
      
      // Scale nodes to maintain constant visual size
      // Inverse compensation: as camera gets closer (zoom in), nodes scale up
      // This keeps them the same pixel size on screen
      const referenceDistance = 2.5; // Our default camera distance
      
      // Calculate scale needed to maintain constant pixel size
      const scaleCompensation = cameraDistance / referenceDistance;
      let constantSizeScale = scaleCompensation * 0.8; // 0.8 factor for fine-tuning
      
      // Clamp scale to reasonable bounds
      const minScale = 0.5; // Prevent dots from getting too small
      const maxScale = 3.0; // Prevent dots from getting too large
      constantSizeScale = Math.max(minScale, Math.min(maxScale, constantSizeScale));
      
      groupRef.current.scale.setScalar(constantSizeScale);
      
      // Smooth hover transitions
      const transitionSpeed = 8; // Higher = faster transition
      const targetScale = hovered ? 1.2 : 1;
      const targetGlowOpacity = hovered ? 0.7 : 0.2;
      const targetGlowScale = hovered ? 1.4 : 1;
      
      // Interpolate values
      hoverTransition.current.scale += (targetScale - hoverTransition.current.scale) * delta * transitionSpeed;
      hoverTransition.current.glowOpacity += (targetGlowOpacity - hoverTransition.current.glowOpacity) * delta * transitionSpeed;
      hoverTransition.current.glowScale += (targetGlowScale - hoverTransition.current.glowScale) * delta * transitionSpeed;
      
      // Pulsing animation continues even on hover
      const time = state.clock.elapsedTime;
      const basePulse = Math.sin(time * 2) * 0.1;
      
      // Apply smooth scale animation with hover effect
      const scale = hoverTransition.current.scale + basePulse;
      meshRef.current.scale.setScalar(scale);
      
      // Glow expands smoothly on hover
      glowRef.current.scale.setScalar(hoverTransition.current.glowScale + basePulse * 0.5);
      
      // Ring also pulses
      ringRef.current.scale.setScalar(1 + basePulse * 0.3);
      
      // Update outer glow if exists
      if (outerGlowRef.current) {
        outerGlowRef.current.scale.setScalar(hoverTransition.current.glowScale * 1.5);
      }
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

  return (
    <group ref={groupRef} position={dynamicPosition}>
      {/* Extra outer glow for enhanced hover effect */}
      <mesh ref={outerGlowRef}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshBasicMaterial
          color={vibrantColor}
          opacity={hovered ? hoverTransition.current.glowOpacity * 0.4 : 0}
          transparent
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Main glow effect - transitions to vibrant on hover */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial
          color={hovered ? vibrantColor : "#ffffff"}
          opacity={hoverTransition.current.glowOpacity}
          transparent
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Middle layer - white base with subtle color hint */}
      <mesh>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          opacity={0.6}
          transparent
        />
      </mesh>
      
      {/* Core node - solid white with color tint */}
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
      
      {/* Outer ring for visibility - matches the color theme */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.022, 0.028, 16]} />
        <meshBasicMaterial
          color={hovered ? vibrantColor : "#81E4F2"}
          opacity={hovered ? 1 : 0.6}
          transparent
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Aggregation indicator - show track count for aggregated nodes */}
      {node.isAggregated && node.trackCount && node.trackCount > 1 && (
        <group position={[0, 0.04, 0]}>
          {/* Background circle for better visibility */}
          <mesh>
            <circleGeometry args={[0.018, 16]} />
            <meshBasicMaterial
              color="#000000"
              opacity={0.8}
              transparent
            />
          </mesh>
          {/* Track count text */}
          <Text
            fontSize={0.02}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            position={[0, 0, 0.001]}
            renderOrder={999}
          >
            {node.trackCount}
          </Text>
        </group>
      )}
    </group>
  );
}