"use client";

import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { NodeMeshProps } from './types';
import { latLngToVector3 } from './Globe';

const RADIO_ORANGE = '#FB923C';

export function RadioNodeMesh({ node, onClick, onHover }: NodeMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const wave1Ref = useRef<THREE.Mesh>(null);
  const wave2Ref = useRef<THREE.Mesh>(null);
  const wave3Ref = useRef<THREE.Mesh>(null);
  const towerRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();

  // Animation values for smooth transitions
  const hoverTransition = useRef({
    scale: 1,
    intensity: 0.8
  });

  // Calculate position
  const dynamicPosition = latLngToVector3(node.coordinates.lat, node.coordinates.lng, 1.02);

  // Update animations
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const time = state.clock.elapsedTime;
    const cameraDistance = camera.position.length();

    // Scale compensation to maintain constant visual size
    const referenceDistance = 2.5;
    const scaleCompensation = cameraDistance / referenceDistance;
    let constantSizeScale = scaleCompensation * 0.8;
    const minScale = 0.5;
    const maxScale = 3.0;
    constantSizeScale = Math.max(minScale, Math.min(maxScale, constantSizeScale));
    groupRef.current.scale.setScalar(constantSizeScale);

    // Smooth hover transitions
    const transitionSpeed = 8;
    const targetScale = hovered ? 1.2 : 1;
    const targetIntensity = hovered ? 1.2 : 0.8;

    hoverTransition.current.scale += (targetScale - hoverTransition.current.scale) * delta * transitionSpeed;
    hoverTransition.current.intensity += (targetIntensity - hoverTransition.current.intensity) * delta * transitionSpeed;

    // Animate the tower with subtle pulsing
    if (towerRef.current) {
      const pulse = Math.sin(time * 3) * 0.05 + 1;
      towerRef.current.scale.setScalar(hoverTransition.current.scale * pulse);
    }

    // Animate broadcast waves - expanding and fading
    if (wave1Ref.current) {
      const wave1Progress = (time * 1.2) % 2;
      wave1Ref.current.scale.setScalar(1 + wave1Progress * 1.5);
      (wave1Ref.current.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, (1 - wave1Progress / 2) * 0.6 * hoverTransition.current.intensity);
    }

    if (wave2Ref.current) {
      const wave2Progress = ((time * 1.2) + 0.66) % 2;
      wave2Ref.current.scale.setScalar(1 + wave2Progress * 1.5);
      (wave2Ref.current.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, (1 - wave2Progress / 2) * 0.6 * hoverTransition.current.intensity);
    }

    if (wave3Ref.current) {
      const wave3Progress = ((time * 1.2) + 1.33) % 2;
      wave3Ref.current.scale.setScalar(1 + wave3Progress * 1.5);
      (wave3Ref.current.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, (1 - wave3Progress / 2) * 0.6 * hoverTransition.current.intensity);
    }
  });

  const handleClick = (e: any) => {
    console.log('🎙️ RadioNodeMesh clicked:', node.title, node);
    e.stopPropagation();
    onClick();
  };

  const handlePointerOver = () => {
    setHovered(true);
    onHover(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    onHover(false);
    document.body.style.cursor = 'default';
  };

  return (
    <group ref={groupRef} position={dynamicPosition}>
      {/* Broadcast wave 1 - outermost */}
      <mesh ref={wave1Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.015, 0.02, 32]} />
        <meshBasicMaterial
          color={RADIO_ORANGE}
          transparent
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Broadcast wave 2 - middle */}
      <mesh ref={wave2Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.015, 0.02, 32]} />
        <meshBasicMaterial
          color={RADIO_ORANGE}
          transparent
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Broadcast wave 3 - innermost */}
      <mesh ref={wave3Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.015, 0.02, 32]} />
        <meshBasicMaterial
          color={RADIO_ORANGE}
          transparent
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Glow effect around tower */}
      <mesh
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial
          color={RADIO_ORANGE}
          opacity={hovered ? 0.5 : 0.3}
          transparent
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Tower base - larger cylinder */}
      <mesh
        position={[0, -0.005, 0]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <cylinderGeometry args={[0.012, 0.015, 0.015, 8]} />
        <meshStandardMaterial
          color={RADIO_ORANGE}
          emissive={RADIO_ORANGE}
          emissiveIntensity={hovered ? 0.8 : 0.5}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>

      {/* Tower mast - thin cylinder */}
      <mesh
        position={[0, 0.01, 0]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <cylinderGeometry args={[0.004, 0.006, 0.025, 6]} />
        <meshStandardMaterial
          color={RADIO_ORANGE}
          emissive={RADIO_ORANGE}
          emissiveIntensity={hovered ? 1.0 : 0.6}
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>

      {/* Tower tip - small sphere */}
      <mesh
        ref={towerRef}
        position={[0, 0.024, 0]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[0.008, 16, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={RADIO_ORANGE}
          emissiveIntensity={hovered ? 1.5 : 1.0}
          metalness={0.8}
          roughness={0.1}
        />
      </mesh>

      {/* Aggregation indicator - show track count for aggregated nodes */}
      {node.isAggregated && node.trackCount && node.trackCount > 1 && (
        <group position={[0, 0.045, 0]}>
          {/* Background circle for better visibility */}
          <mesh>
            <circleGeometry args={[0.018, 16]} />
            <meshBasicMaterial
              color="#000000"
              opacity={0.8}
              transparent
            />
          </mesh>
          {/* Track count text */}
          <Text
            fontSize={0.02}
            color={RADIO_ORANGE}
            anchorX="center"
            anchorY="middle"
            position={[0, 0, 0.001]}
            renderOrder={999}
          >
            {node.trackCount}
          </Text>
        </group>
      )}
    </group>
  );
}
