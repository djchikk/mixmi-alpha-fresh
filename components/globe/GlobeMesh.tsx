"use client";

import React, { useRef, forwardRef, useImperativeHandle, ReactNode, useMemo } from 'react';
import { useFrame, useLoader, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { WorldOutlines } from './WorldOutlines';

// Custom atmosphere shader with fresnel effect
const AtmosphereShaderMaterial = shaderMaterial(
  {
    glowColor: new THREE.Color('#81E4F2'),
    glowIntensity: 0.6,
    glowPower: 3.5,
  },
  // Vertex shader
  `
    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment shader - fresnel effect (brighter at edges)
  `
    uniform vec3 glowColor;
    uniform float glowIntensity;
    uniform float glowPower;
    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    void main() {
      float fresnel = pow(1.0 - abs(dot(vNormal, vPositionNormal)), glowPower);
      gl_FragColor = vec4(glowColor, fresnel * glowIntensity);
    }
  `
);

// Extend Three.js with our custom material
extend({ AtmosphereShaderMaterial });

// TypeScript declaration for the custom material
declare global {
  namespace JSX {
    interface IntrinsicElements {
      atmosphereShaderMaterial: any;
    }
  }
}

interface GlobeMeshProps {
  children?: ReactNode;
}

export const GlobeMesh = forwardRef<THREE.Group, GlobeMeshProps>(({ children }, ref) => {
  const groupRef = useRef<THREE.Group>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);

  // Load the Earth texture
  const earthTexture = useLoader(THREE.TextureLoader, '/textures/earth-blue-marble.jpg');

  // Configure texture settings
  useMemo(() => {
    if (earthTexture) {
      earthTexture.colorSpace = THREE.SRGBColorSpace;
      earthTexture.anisotropy = 16; // Sharper texture at angles
    }
  }, [earthTexture]);

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
      {/* Base dark ocean sphere */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          color="#1a2a45"
          emissive="#1a2a45"
          emissiveIntensity={0.15}
          metalness={0.2}
          roughness={0.8}
        />
      </mesh>

      {/* Earth texture layer - subtle overlay */}
      <mesh>
        <sphereGeometry args={[1.002, 64, 64]} />
        <meshBasicMaterial
          map={earthTexture}
          opacity={0.35}
          transparent
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Subtle blue tint overlay to unify colors */}
      <mesh>
        <sphereGeometry args={[1.003, 64, 64]} />
        <meshBasicMaterial
          color="#203356"
          opacity={0.25}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* World outlines with real GeoJSON data */}
      <WorldOutlines />

      {/* Render children (nodes) as part of the globe group */}
      {children}

      {/* Atmosphere glow - fresnel effect (brighter at edges) - cool side */}
      <mesh ref={atmosphereRef} scale={[1.03, 1.03, 1.03]}>
        <sphereGeometry args={[1, 64, 64]} />
        <atmosphereShaderMaterial
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          glowColor={new THREE.Color('#81E4F2')}
          glowIntensity={0.18}
          glowPower={6.0}
        />
      </mesh>

      {/* Warm sunlit atmosphere edge - golden hour glow on sun side */}
      <mesh scale={[1.035, 1.035, 1.035]} position={[0.015, 0.01, 0.008]}>
        <sphereGeometry args={[1, 64, 64]} />
        <atmosphereShaderMaterial
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          glowColor={new THREE.Color('#FFAA66')}
          glowIntensity={0.12}
          glowPower={8.0}
        />
      </mesh>
    </group>
  );
});