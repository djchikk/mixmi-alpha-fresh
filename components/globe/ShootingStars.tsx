"use client";

import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface ShootingStarData {
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  progress: number;
  speed: number;
  opacity: number;
}

export function ShootingStars() {
  const { scene } = useThree();
  const starsRef = useRef<ShootingStarData[]>([]);
  const linesRef = useRef<THREE.Line[]>([]);
  
  useEffect(() => {
    // Create a pool of shooting star lines
    for (let i = 0; i < 3; i++) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(6); // 2 points
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      
      const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        linewidth: 1
      });
      
      const line = new THREE.Line(geometry, material);
      line.visible = false;
      linesRef.current.push(line);
      scene.add(line);
    }
    
    // Cleanup
    return () => {
      linesRef.current.forEach(line => {
        scene.remove(line);
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      });
    };
  }, [scene]);
  
  // Create a new shooting star
  const createShootingStar = () => {
    // Find an available line
    const availableIndex = starsRef.current.findIndex(star => star.progress >= 1);
    const lineIndex = availableIndex !== -1 ? availableIndex : starsRef.current.length;
    
    if (lineIndex >= 3) return; // Max 3 concurrent shooting stars
    
    // Random start position in the sky
    const radius = 4 + Math.random() * 2; // Distance from center
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5 + Math.PI * 0.25; // Upper hemisphere
    
    const startPos = new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
    
    // Direction and end position
    const direction = new THREE.Vector3(
      -0.5 + Math.random(),
      -0.3 - Math.random() * 0.2,
      -0.5 + Math.random()
    ).normalize();
    
    const endPos = startPos.clone().add(direction.multiplyScalar(1.5 + Math.random()));
    
    const starData: ShootingStarData = {
      startPos,
      endPos,
      progress: 0,
      speed: 0.015 + Math.random() * 0.01,
      opacity: 0.6 + Math.random() * 0.3
    };
    
    if (availableIndex !== -1) {
      starsRef.current[availableIndex] = starData;
    } else {
      starsRef.current.push(starData);
    }
  };
  
  // Animation loop
  useFrame(() => {
    starsRef.current.forEach((star, index) => {
      if (star.progress >= 1) return;
      
      const line = linesRef.current[index];
      if (!line) return;
      
      // Update progress
      star.progress += star.speed;
      
      if (star.progress < 1) {
        // Calculate positions
        const headProgress = Math.min(star.progress * 1.5, 1);
        const tailProgress = Math.max(star.progress * 1.5 - 0.3, 0);
        
        const head = star.startPos.clone().lerp(star.endPos, headProgress);
        const tail = star.startPos.clone().lerp(star.endPos, tailProgress);
        
        // Update line geometry
        const positions = line.geometry.attributes.position.array as Float32Array;
        positions[0] = tail.x; positions[1] = tail.y; positions[2] = tail.z;
        positions[3] = head.x; positions[4] = head.y; positions[5] = head.z;
        line.geometry.attributes.position.needsUpdate = true;
        
        // Fade in and out
        const fadeIn = Math.min(star.progress * 4, 1);
        const fadeOut = Math.max(1 - (star.progress - 0.7) * 3.3, 0);
        (line.material as THREE.LineBasicMaterial).opacity = star.opacity * fadeIn * fadeOut;
        
        line.visible = true;
      } else {
        line.visible = false;
        (line.material as THREE.LineBasicMaterial).opacity = 0;
      }
    });
  });
  
  // Trigger shooting stars occasionally
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < 0.25) { // 25% chance every interval
        createShootingStar();
      }
    }, 6000); // Check every 6 seconds
    
    // Create one immediately for effect
    setTimeout(() => createShootingStar(), 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  return null; // This component doesn't render anything directly
}