"use client";

import React, { useRef, useMemo, forwardRef, useImperativeHandle, ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WorldOutlines } from './WorldOutlines';

interface GlobeMeshProps {
  children?: ReactNode;
}

export const GlobeMesh = forwardRef<THREE.Group, GlobeMeshProps>(({ children }, ref) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireframeRef = useRef<THREE.LineSegments>(null);
  const groupRef = useRef<THREE.Group>(null);
  const continentRef = useRef<THREE.Group>(null);

  // Expose the group ref to parent component
  useImperativeHandle(ref, () => groupRef.current!);

  // Rotate the globe slowly - reduced speed by 60%
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.02; // Reduced from 0.05 to 0.02
    }
  });

  // Create continent-like patterns
  const continentGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    
    // Simple continent outlines (simplified for MVP)
    // These are rough approximations of continents
    const continentPaths = [
      // Africa/Europe
      { lat: 35, lng: 10 },
      { lat: 20, lng: 15 },
      { lat: 0, lng: 20 },
      { lat: -30, lng: 25 },
      { lat: -35, lng: 20 },
      
      // Americas
      { lat: 60, lng: -100 },
      { lat: 45, lng: -95 },
      { lat: 30, lng: -90 },
      { lat: 10, lng: -80 },
      { lat: -10, lng: -75 },
      { lat: -40, lng: -70 },
      { lat: -55, lng: -70 },
      
      // Asia
      { lat: 60, lng: 100 },
      { lat: 40, lng: 120 },
      { lat: 20, lng: 110 },
      { lat: 0, lng: 105 },
      { lat: -10, lng: 120 },
      
      // Australia
      { lat: -20, lng: 135 },
      { lat: -25, lng: 145 },
      { lat: -35, lng: 140 },
    ];

    continentPaths.forEach(({ lat, lng }) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);
      const radius = 1.01; // Slightly above the sphere surface
      
      const x = -(radius * Math.sin(phi) * Math.cos(theta));
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      
      positions.push(x, y, z);
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, []);

  return (
    <group ref={groupRef}>
      {/* Main ocean sphere - deeper ocean blue */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          color="#203356"
          emissive="#203356"
          emissiveIntensity={0.18}
          roughness={0.8}
          metalness={0.1}
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
      <group ref={continentRef}>
        <WorldOutlines />
      </group>
      
      {/* Render children (nodes) as part of the globe group */}
      {children}
    </group>
  );
});