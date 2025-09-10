"use client";

import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from './Globe';

// Major cities with their coordinates
const MAJOR_CITIES = [
  { name: 'New York', lat: 40.7128, lng: -74.0060 },
  { name: 'London', lat: 51.5074, lng: -0.1278 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'Berlin', lat: 52.5200, lng: 13.4050 },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
  { name: 'Shanghai', lat: 31.2304, lng: 121.4737 },
  { name: 'Moscow', lat: 55.7558, lng: 37.6173 },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708 },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { name: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
  { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Mexico City', lat: 19.4326, lng: -99.1332 },
  { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
  { name: 'Bangkok', lat: 13.7563, lng: 100.5018 },
  { name: 'Seoul', lat: 37.5665, lng: 126.9780 },
];

// Warm city light colors
const LIGHT_COLORS = [
  "#FFFFCC", // Warm white
  "#FFE5B4", // Peach
  "#FFD700", // Gold
  "#FFA500", // Orange
  "#FFFACD", // Lemon chiffon
];

interface LightProps {
  offset: THREE.Vector3;
  phase: number;
  speed: number;
  size: number;
  color: string;
}

function TwinklingLight({ offset, phase, speed, size, color }: LightProps) {
  const lightRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (!lightRef.current || !lightRef.current.material) return;
    
    const time = state.clock.elapsedTime;
    const material = lightRef.current.material as THREE.MeshBasicMaterial;
    
    // Twinkling effect using sine wave with phase offset
    const twinkle = Math.sin(time * speed + phase) * 0.5 + 0.5; // 0 to 1
    material.opacity = 0.4 + twinkle * 0.6; // 0.4 to 1.0 opacity
    
    // Subtle scale pulse
    const scale = 1 + twinkle * 0.3;
    lightRef.current.scale.setScalar(scale);
    
    // Update glow
    if (glowRef.current && glowRef.current.material instanceof THREE.MeshBasicMaterial) {
      glowRef.current.material.opacity = twinkle * 0.3;
      glowRef.current.scale.setScalar(scale * 1.5);
    }
  });
  
  return (
    <group position={offset}>
      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[size * 2, 6, 6]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Core light */}
      <mesh ref={lightRef}>
        <sphereGeometry args={[size, 6, 6]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

interface CityMarkerProps {
  city: typeof MAJOR_CITIES[0];
}

function CityMarker({ city }: CityMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  
  // Calculate position on globe
  const position = React.useMemo(
    () => latLngToVector3(city.lat, city.lng, 1.01), // Slightly above globe surface
    [city.lat, city.lng]
  );
  
  // Generate random lights for this city
  const lights = React.useMemo(() => {
    const cityLights: LightProps[] = [];
    const numLights = 5 + Math.floor(Math.random() * 5); // 5-10 lights per city
    
    for (let i = 0; i < numLights; i++) {
      // Random position within small radius
      const angle = (i / numLights) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 0.005 + Math.random() * 0.01;
      const offset = new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        Math.random() * 0.005
      );
      
      cityLights.push({
        offset,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 2, // Varying twinkle speeds
        size: 0.001 + Math.random() * 0.002, // Varying sizes
        color: LIGHT_COLORS[Math.floor(Math.random() * LIGHT_COLORS.length)]
      });
    }
    
    return cityLights;
  }, []);
  
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    const distance = camera.position.length();
    
    // Only show cities when zoomed in past medium distance
    const visible = distance < 5.0;
    groupRef.current.visible = visible;
    
    if (!visible) return;
    
    // Scale based on zoom
    const referenceDistance = 2.5;
    const scaleCompensation = distance / referenceDistance;
    const baseScale = scaleCompensation * 0.8;
    
    // Fade in/out based on distance
    const fadeStart = 5.0;
    const fadeEnd = 3.0;
    const opacity = distance < fadeEnd ? 1 : (fadeStart - distance) / (fadeStart - fadeEnd);
    
    groupRef.current.scale.setScalar(baseScale);
    
    // Apply fade to group opacity
    groupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        child.material.opacity = Math.min(child.material.opacity, opacity);
      }
    });
  });
  
  return (
    <group ref={groupRef} position={position}>
      {/* Cluster of twinkling lights */}
      {lights.map((light, index) => (
        <TwinklingLight key={index} {...light} />
      ))}
    </group>
  );
}

export function CityMarkers() {
  return (
    <>
      {MAJOR_CITIES.map((city) => (
        <CityMarker key={city.name} city={city} />
      ))}
    </>
  );
}