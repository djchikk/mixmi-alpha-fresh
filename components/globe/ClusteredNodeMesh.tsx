"use client";

import React, { useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
// import { Text } from '@react-three/drei'; // Uncomment if re-enabling count badge
import { TrackNode } from './types';

// Content type colors matching the rest of the app
const CONTENT_TYPE_COLORS = {
  loop: '#A084F9',        // Purple
  loop_pack: '#A084F9',   // Purple
  full_song: '#A8E66B',   // Gold
  ep: '#A8E66B',          // Gold
  video_clip: '#5BB5F9',  // Blue
  radio_station: '#FFC044', // Orange
  station_pack: '#FFC044',  // Orange
};

// Fixed particle configuration - 6 particles in a scattered arrangement
// Pre-calculated random positions for consistent look
const PARTICLE_CONFIG = [
  { offsetX: -0.006, offsetY: 0.004, offsetZ: 0.003, size: 0.005, color: 'loop' },
  { offsetX: 0.005, offsetY: -0.003, offsetZ: 0.004, size: 0.0045, color: 'loop' },
  { offsetX: 0.003, offsetY: 0.006, offsetZ: -0.002, size: 0.0048, color: 'full_song' },
  { offsetX: -0.004, offsetY: -0.005, offsetZ: -0.003, size: 0.0055, color: 'full_song' },
  { offsetX: 0.007, offsetY: 0.002, offsetZ: -0.003, size: 0.004, color: 'radio_station' },
  { offsetX: -0.002, offsetY: -0.001, offsetZ: 0.006, size: 0.0048, color: 'video_clip' },
];

interface ClusteredNodeMeshProps {
  nodes: TrackNode[];
  position: THREE.Vector3;
  onClick: (nodes: TrackNode[]) => void;
  onHover: (hovering: boolean, nodes: TrackNode[]) => void;
}

// Individual particle component with its own jiggle animation
function Particle({
  offset,
  size,
  color,
  index,
  hovered
}: {
  offset: THREE.Vector3;
  size: number;
  color: string;
  index: number;
  hovered: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  // Each particle has its own animation timing offset
  const animationOffset = useMemo(() => index * 0.7, [index]);

  useFrame((state) => {
    if (meshRef.current && glowRef.current) {
      const time = state.clock.elapsedTime + animationOffset;

      // Gentle jiggle animation - small random movement (reduced by 75% from original)
      const jiggleX = Math.sin(time * 1.5) * 0.00075 + Math.sin(time * 2.3) * 0.0005;
      const jiggleY = Math.cos(time * 1.8) * 0.00075 + Math.cos(time * 2.1) * 0.0005;
      const jiggleZ = Math.sin(time * 2.0) * 0.0005 + Math.cos(time * 1.6) * 0.0005;

      meshRef.current.position.set(
        offset.x + jiggleX,
        offset.y + jiggleY,
        offset.z + jiggleZ
      );
      glowRef.current.position.copy(meshRef.current.position);

      // Subtle scale pulsing
      const pulse = 1 + Math.sin(time * 3) * 0.1;
      const hoverScale = hovered ? 1.3 : 1;
      meshRef.current.scale.setScalar(pulse * hoverScale);
      glowRef.current.scale.setScalar(pulse * hoverScale * 1.5);
    }
  });

  return (
    <>
      {/* Glow effect for each particle */}
      <mesh ref={glowRef} position={[offset.x, offset.y, offset.z]}>
        <sphereGeometry args={[size * 1.5, 8, 8]} />
        <meshBasicMaterial
          color={color}
          opacity={hovered ? 0.5 : 0.25}
          transparent
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Core particle */}
      <mesh ref={meshRef} position={[offset.x, offset.y, offset.z]}>
        <sphereGeometry args={[size, 8, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.8 : 0.4}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
    </>
  );
}

export function ClusteredNodeMesh({ nodes, position, onClick, onHover }: ClusteredNodeMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const hitAreaRef = useRef<THREE.Mesh>(null);
  // const textRef = useRef<any>(null); // Uncomment if re-enabling count badge
  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();

  // const nodeCount = nodes.length; // Uncomment if re-enabling count badge

  // Create particles with colors based on content type distribution
  const particles = useMemo(() => {
    return PARTICLE_CONFIG.map((config, index) => {
      const colorKey = config.color as keyof typeof CONTENT_TYPE_COLORS;
      const color = CONTENT_TYPE_COLORS[colorKey] || '#5BB5F9';

      return {
        offset: new THREE.Vector3(config.offsetX, config.offsetY, config.offsetZ),
        size: config.size,
        color,
        index,
      };
    });
  }, []);

  // Scale based on camera distance
  useFrame(() => {
    if (groupRef.current) {
      const cameraDistance = camera.position.length();
      const baseScale = 1;
      const scaleCompensation = cameraDistance / 2.5;

      // Clusters are slightly larger than single nodes
      const clusterScale = 1.2;
      groupRef.current.scale.setScalar(baseScale * scaleCompensation * clusterScale);
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
      {/* Invisible hit area for click/hover detection (reduced by 75% from original) */}
      <mesh
        ref={hitAreaRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[0.01, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Render each particle */}
      {particles.map((particle) => (
        <Particle
          key={particle.index}
          offset={particle.offset}
          size={particle.size}
          color={particle.color}
          index={particle.index}
          hovered={hovered}
        />
      ))}

      {/* Count badge for clusters - commented out for now, can be re-enabled later
      {nodeCount > 1 && (
        <Text
          ref={textRef}
          position={[0.015, 0.015, 0]}
          fontSize={0.009}
          color={hovered ? "#ffffff" : "#cccccc"}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.001}
          outlineColor="#000000"
          fontWeight="bold"
        >
          {nodeCount}
        </Text>
      )}
      */}
    </group>
  );
}
