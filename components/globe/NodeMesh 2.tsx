"use client";

import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
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
  const [hovered, setHovered] = useState(false);
  
  // Get position from coordinates
  const position = latLngToVector3(node.coordinates.lat, node.coordinates.lng, 1.02);
  
  // Assign colors based on node ID
  const colorIndex = useMemo(() => {
    // Use node ID to deterministically assign a color
    const hash = node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash % SUBTLE_COLORS.length;
  }, [node.id]);
  
  const subtleColor = SUBTLE_COLORS[colorIndex];
  const vibrantColor = VIBRANT_COLORS[colorIndex];
  
  // Animate the glow effect
  useFrame((state) => {
    if (meshRef.current) {
      const scale = hovered ? 1.5 : 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      meshRef.current.scale.setScalar(scale);
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
    <group position={position}>
      {/* Glow effect */}
      <mesh>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial
          color={hovered ? "#FFE4B5" : "#81E4F2"}
          opacity={0.4}
          transparent
        />
      </mesh>
      
      {/* Core node */}
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshStandardMaterial
          color={hovered ? "#FFE4B5" : "#81E4F2"}
          emissive={hovered ? "#FFE4B5" : "#81E4F2"}
          emissiveIntensity={0.8}
        />
      </mesh>
      
      {/* Outer ring for visibility */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.03, 0.04, 16]} />
        <meshBasicMaterial
          color={hovered ? "#FFE4B5" : "#81E4F2"}
          opacity={0.8}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}