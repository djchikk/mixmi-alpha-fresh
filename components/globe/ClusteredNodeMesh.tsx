"use client";

import React, { useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { TrackNode } from './types';
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

interface ClusteredNodeMeshProps {
  nodes: TrackNode[];
  position: THREE.Vector3;
  onClick: (nodes: TrackNode[]) => void;
  onHover: (hovering: boolean, nodes: TrackNode[]) => void;
}

export function ClusteredNodeMesh({ nodes, position, onClick, onHover }: ClusteredNodeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const textRef = useRef<any>(null);
  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();
  
  // Calculate color based on first node
  const colorIndex = useMemo(() => {
    const hash = nodes[0].id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hash % SUBTLE_COLORS.length;
  }, [nodes]);
  
  const subtleColor = SUBTLE_COLORS[colorIndex];
  const vibrantColor = VIBRANT_COLORS[colorIndex];
  const nodeCount = nodes.length;
  
  // Scale and update position based on camera
  useFrame((state) => {
    if (groupRef.current && meshRef.current && glowRef.current && ringRef.current) {
      // Calculate camera distance
      const cameraDistance = camera.position.length();
      
      // Scale nodes to maintain constant visual size
      const baseScale = 1;
      const scaleCompensation = cameraDistance / 2.5;
      groupRef.current.scale.setScalar(baseScale * scaleCompensation);
      
      // Make clustered nodes slightly larger based on count
      const clusterScale = 1 + Math.log(nodeCount) * 0.1;
      
      // Pulsing animation
      const time = state.clock.elapsedTime;
      const basePulse = Math.sin(time * 2) * 0.1;
      
      // Scale animation with hover effect
      const hoverScale = hovered ? 1.5 : 1;
      const scale = hoverScale * clusterScale + basePulse;
      meshRef.current.scale.setScalar(scale);
      
      // Glow expands more on hover
      const glowScale = hovered ? 1.3 : 1;
      glowRef.current.scale.setScalar(glowScale * clusterScale + basePulse * 0.5);
      
      // Ring also pulses
      ringRef.current.scale.setScalar(clusterScale + basePulse * 0.3);
      
      // Orient text to face camera
      if (textRef.current && nodeCount > 1) {
        textRef.current.lookAt(camera.position);
      }
    }
  });

  const handlePointerOver = () => {
    setHovered(true);
    onHover(true, nodes);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    onHover(false, nodes);
    document.body.style.cursor = 'default';
  };

  const handleClick = () => {
    onClick(nodes);
  };

  return (
    <group ref={groupRef} position={position}>
      {/* Outer glow effect */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial
          color={hovered ? vibrantColor : "#ffffff"}
          opacity={hovered ? 0.5 : 0.2}
          transparent
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Middle layer */}
      <mesh>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          opacity={0.6}
          transparent
        />
      </mesh>
      
      {/* Core node */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
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
      
      {/* Outer ring */}
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
      
      {/* Count badge for clusters */}
      {nodeCount > 1 && (
        <Text
          ref={textRef}
          position={[0.025, 0.025, 0]}
          fontSize={0.02}
          color={hovered ? vibrantColor : "#ffffff"}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.002}
          outlineColor="#000000"
        >
          {nodeCount}
        </Text>
      )}
    </group>
  );
}