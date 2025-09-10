"use client";

import React, { useRef, forwardRef, useImperativeHandle, ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WorldOutlines } from './WorldOutlines';

interface GlobeMeshProps {
  children?: ReactNode;
}

export const GlobeMesh = forwardRef<THREE.Group, GlobeMeshProps>(({ children }, ref) => {
  const groupRef = useRef<THREE.Group>(null);

  // Expose the group ref to parent component
  useImperativeHandle(ref, () => groupRef.current!);

  // Rotate the globe slowly - reduced for easier dot tracking
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.015; // Reduced from 0.02 for easier interaction
    }
  });


  return (
    <group ref={groupRef}>
      {/* Main ocean sphere */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial 
          color="#203356"
          emissive="#203356"
          emissiveIntensity={0.18}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>
      
      {/* Subtle glow layer */}
      <mesh>
        <sphereGeometry args={[1.001, 64, 64]} />
        <meshBasicMaterial
          color="#203356"
          opacity={0.3}
          transparent
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* World outlines with real GeoJSON data */}
      <WorldOutlines />
      
      {/* Render children (nodes) as part of the globe group */}
      {children}
    </group>
  );
});