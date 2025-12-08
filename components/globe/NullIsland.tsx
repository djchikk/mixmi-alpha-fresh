"use client";

import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from './Globe';

interface NullIslandProps {
  onClick?: () => void;
}

/**
 * Null Island - The legendary home of coordinates (0, 0)
 * Where forgetful uploaders and borderless content creators unite! 🏝️
 */
export function NullIsland({ onClick }: NullIslandProps) {
  const islandRef = useRef<THREE.Group>(null);
  const palmRef = useRef<THREE.Group>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  // Gentle floating animation
  useFrame((state) => {
    if (islandRef.current) {
      islandRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.002;
    }
    if (palmRef.current) {
      palmRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.2) * 0.05;
    }
  });

  // Position at exactly 0° latitude, 0° longitude
  const islandPosition = latLngToVector3(0, 0, 1.005); // Just above the globe surface

  return (
    <group
      ref={islandRef}
      position={islandPosition}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setIsHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setIsHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Invisible click area - larger than island for easier clicking */}
      <mesh visible={false}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Main island base - bigger tropical shape */}
      <mesh>
        <cylinderGeometry args={[0.032, 0.024, 0.008, 8]} />
        <meshLambertMaterial
          color="#d4a574"
          emissive="#8b7355"
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* Beach ring */}
      <mesh position={[0, 0.005, 0]}>
        <cylinderGeometry args={[0.038, 0.032, 0.003, 12]} />
        <meshLambertMaterial
          color="#f4e4bc"
          emissive="#d4c49a"
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* Palm tree trunk */}
      <group ref={palmRef}>
        <mesh position={[0.012, 0.016, 0.008]}>
          <cylinderGeometry args={[0.002, 0.0028, 0.022, 6]} />
          <meshLambertMaterial
            color="#8b4513"
            emissive="#654321"
            emissiveIntensity={0.1}
          />
        </mesh>

        {/* Palm fronds */}
        {[0, 60, 120, 180, 240, 300].map((angle, i) => (
          <mesh
            key={i}
            position={[
              0.012 + Math.cos(angle * Math.PI / 180) * 0.008,
              0.028,
              0.008 + Math.sin(angle * Math.PI / 180) * 0.008
            ]}
            rotation={[
              Math.PI / 2 + Math.sin(angle * Math.PI / 180) * 0.3,
              angle * Math.PI / 180,
              0
            ]}
          >
            <planeGeometry args={[0.022, 0.006]} />
            <meshLambertMaterial
              color="#228b22"
              emissive="#1a6b1a"
              emissiveIntensity={0.1}
              side={THREE.DoubleSide}
              transparent
              opacity={0.8}
            />
          </mesh>
        ))}
      </group>

      {/* Flag pole - bigger for visibility */}
      <mesh position={[-0.014, 0.014, -0.012]}>
        <cylinderGeometry args={[0.0008, 0.0008, 0.016, 4]} />
        <meshLambertMaterial color="#666666" />
      </mesh>

      {/* Null Island flag - bigger and brighter */}
      <mesh position={[-0.008, 0.02, -0.012]}>
        <planeGeometry args={[0.008, 0.006]} />
        <meshLambertMaterial
          color="#ff6b9d"
          emissive="#cc547e"
          emissiveIntensity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Enhanced glow effect - brighter on hover */}
      <mesh>
        <cylinderGeometry args={[0.048, 0.042, 0.001, 16]} />
        <meshBasicMaterial
          color="#81E4F2"
          transparent
          opacity={isHovered ? 0.4 : 0.15}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Water ripples - larger */}
      <mesh position={[0, -0.002, 0]}>
        <ringGeometry args={[0.044, 0.058, 16]} />
        <meshBasicMaterial
          color="#00aacc"
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}