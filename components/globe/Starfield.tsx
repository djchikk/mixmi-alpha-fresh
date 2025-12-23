"use client";

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Starfield() {
  const starsRef = useRef<THREE.Points>(null);
  
  // Create star positions and properties
  const { positions, sizes, phases } = useMemo(() => {
    const starCount = 1000;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const phases = new Float32Array(starCount);
    
    for (let i = 0; i < starCount; i++) {
      // Distribute stars in a large sphere around the globe
      const radius = 200 + Math.random() * 300;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
      
      // Random sizes for variety
      sizes[i] = 0.5 + Math.random() * 2.0;
      
      // Random phase for twinkling
      phases[i] = Math.random() * Math.PI * 2;
    }
    
    return { positions, sizes, phases };
  }, []);
  
  // Create geometry
  const starsGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    return geometry;
  }, [positions, sizes, phases]);
  
  // Animate twinkling
  useFrame((state) => {
    if (starsRef.current) {
      const material = starsRef.current.material as THREE.PointsMaterial;
      const sizeAttribute = starsRef.current.geometry.getAttribute('size');
      const phaseAttribute = starsRef.current.geometry.getAttribute('phase');
      
      const time = state.clock.elapsedTime;
      
      for (let i = 0; i < sizeAttribute.count; i++) {
        const phase = phaseAttribute.getX(i);
        const baseSize = sizes[i];
        
        // Create twinkling effect with sine wave
        const twinkle = Math.sin(time * 2 + phase) * 0.3 + 0.7;
        sizeAttribute.setX(i, baseSize * twinkle);
      }
      
      sizeAttribute.needsUpdate = true;
      
      // Slowly rotate the entire starfield
      starsRef.current.rotation.y += 0.0001;
      
      // Pulse the overall opacity for subtle breathing effect
      material.opacity = 0.6 + Math.sin(time * 0.5) * 0.2;
    }
  });
  
  return (
    <points ref={starsRef} geometry={starsGeometry}>
      <pointsMaterial
        color="#ffffff"
        size={1.5}
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation={false}
      />
    </points>
  );
}