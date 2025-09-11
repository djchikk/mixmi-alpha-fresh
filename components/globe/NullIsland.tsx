"use client";

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from './Globe';

/**
 * Null Island - The legendary home of coordinates (0, 0)
 * Where forgetful uploaders and borderless content creators unite! 🏝️
 */
export function NullIsland() {
  const islandRef = useRef<THREE.Group>(null);
  const palmRef = useRef<THREE.Group>(null);
  
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
    <group ref={islandRef} position={islandPosition}>
      {/* Main island base - small tropical shape */}
      <mesh>
        <cylinderGeometry args={[0.012, 0.008, 0.003, 8]} />
        <meshLambertMaterial 
          color="#d4a574" 
          emissive="#8b7355"
          emissiveIntensity={0.1}
        />
      </mesh>
      
      {/* Beach ring */}
      <mesh position={[0, 0.002, 0]}>
        <cylinderGeometry args={[0.014, 0.012, 0.001, 12]} />
        <meshLambertMaterial 
          color="#f4e4bc" 
          emissive="#d4c49a"
          emissiveIntensity={0.1}
        />
      </mesh>
      
      {/* Palm tree trunk */}
      <group ref={palmRef}>
        <mesh position={[0.004, 0.006, 0.003]}>
          <cylinderGeometry args={[0.0008, 0.001, 0.008, 6]} />
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
              0.004 + Math.cos(angle * Math.PI / 180) * 0.003,
              0.01,
              0.003 + Math.sin(angle * Math.PI / 180) * 0.003
            ]}
            rotation={[
              Math.PI / 2 + Math.sin(angle * Math.PI / 180) * 0.3,
              angle * Math.PI / 180,
              0
            ]}
          >
            <planeGeometry args={[0.008, 0.002]} />
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
      
      {/* Tiny flag pole for fun */}
      <mesh position={[-0.005, 0.005, -0.004]}>
        <cylinderGeometry args={[0.0003, 0.0003, 0.006, 4]} />
        <meshLambertMaterial color="#666666" />
      </mesh>
      
      {/* Null Island flag */}
      <mesh position={[-0.003, 0.007, -0.004]}>
        <planeGeometry args={[0.003, 0.002]} />
        <meshLambertMaterial 
          color="#ff6b9d" 
          emissive="#cc547e"
          emissiveIntensity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Subtle glow effect */}
      <mesh>
        <cylinderGeometry args={[0.018, 0.015, 0.0005, 16]} />
        <meshBasicMaterial 
          color="#81E4F2"
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Water ripples */}
      <mesh position={[0, -0.001, 0]}>
        <ringGeometry args={[0.016, 0.022, 16]} />
        <meshBasicMaterial 
          color="#00aacc"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}