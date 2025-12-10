"use client";

import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { NodeMeshProps } from './types';
import { latLngToVector3 } from './Globe';

const RADIO_ORANGE = '#FFC044';

// Set to true to enable pulsing animation (disabled for now - too many stations)
const ENABLE_PULSE_ANIMATION = false;

export function RadioNodeMesh({ node, onClick, onHover }: NodeMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const pulse1Ref = useRef<THREE.Mesh>(null);
  const pulse2Ref = useRef<THREE.Mesh>(null);
  const pulse3Ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();

  // Animation values for smooth transitions
  const hoverTransition = useRef({
    scale: 1,
    intensity: 0.4
  });

  // Calculate position
  const dynamicPosition = latLngToVector3(node.coordinates.lat, node.coordinates.lng, 1.02);

  // Update animations
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const time = state.clock.elapsedTime;
    const cameraDistance = camera.position.length();

    // Scale compensation to maintain constant visual size (matches GridNodeSystem)
    const referenceDistance = 2.5;
    const scaleCompensation = cameraDistance / referenceDistance;
    let constantSizeScale = scaleCompensation * 0.7; // Same as other content nodes
    const minScale = 0.4;
    const maxScale = 2.5;
    constantSizeScale = Math.max(minScale, Math.min(maxScale, constantSizeScale));
    groupRef.current.scale.setScalar(constantSizeScale);

    // Smooth hover transitions
    const transitionSpeed = 8;
    const targetScale = hovered ? 1.2 : 1;
    const targetIntensity = hovered ? 0.8 : 0.4;

    hoverTransition.current.scale += (targetScale - hoverTransition.current.scale) * delta * transitionSpeed;
    hoverTransition.current.intensity += (targetIntensity - hoverTransition.current.intensity) * delta * transitionSpeed;

    // Core sphere - only subtle pulse on hover
    if (coreRef.current) {
      if (ENABLE_PULSE_ANIMATION) {
        const corePulse = Math.sin(time * 2) * 0.1 + 1;
        coreRef.current.scale.setScalar(corePulse * hoverTransition.current.scale);
      } else {
        coreRef.current.scale.setScalar(hoverTransition.current.scale);
      }
    }

    // Pulsing spheres animation (only if enabled)
    if (ENABLE_PULSE_ANIMATION) {
      if (pulse1Ref.current) {
        const pulse1Progress = (time * 0.8) % 2;
        const pulse1Scale = 1 + pulse1Progress * 1.0;
        pulse1Ref.current.scale.setScalar(pulse1Scale);
        (pulse1Ref.current.material as THREE.MeshBasicMaterial).opacity =
          Math.max(0, (1 - pulse1Progress / 2) * 0.35 * hoverTransition.current.intensity);
      }

      if (pulse2Ref.current) {
        const pulse2Progress = ((time * 0.8) + 0.66) % 2;
        const pulse2Scale = 1 + pulse2Progress * 1.0;
        pulse2Ref.current.scale.setScalar(pulse2Scale);
        (pulse2Ref.current.material as THREE.MeshBasicMaterial).opacity =
          Math.max(0, (1 - pulse2Progress / 2) * 0.35 * hoverTransition.current.intensity);
      }

      if (pulse3Ref.current) {
        const pulse3Progress = ((time * 0.8) + 1.33) % 2;
        const pulse3Scale = 1 + pulse3Progress * 1.0;
        pulse3Ref.current.scale.setScalar(pulse3Scale);
        (pulse3Ref.current.material as THREE.MeshBasicMaterial).opacity =
          Math.max(0, (1 - pulse3Progress / 2) * 0.35 * hoverTransition.current.intensity);
      }
    }
  });

  const handleClick = (e: any) => {
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
      {/* Core sphere - same size as other content nodes (0.0099 matches GridNodeSystem) */}
      <mesh
        ref={coreRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[0.0099, 16, 16]} />
        <meshStandardMaterial
          color={RADIO_ORANGE} // Full Tomato Coral #FFC044
          emissive={RADIO_ORANGE}
          emissiveIntensity={hovered ? 0.8 : 0.4}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>

      {/* Pulsing spheres - only rendered when animation is enabled */}
      {ENABLE_PULSE_ANIMATION && (
        <>
          {/* Pulsing sphere 1 - outermost */}
          <mesh
            ref={pulse1Ref}
            onClick={handleClick}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
            <sphereGeometry args={[0.0099, 16, 16]} />
            <meshBasicMaterial
              color={RADIO_ORANGE}
              transparent
              opacity={0.25}
              blending={THREE.AdditiveBlending}
            />
          </mesh>

          {/* Pulsing sphere 2 - middle */}
          <mesh
            ref={pulse2Ref}
            onClick={handleClick}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
            <sphereGeometry args={[0.0099, 16, 16]} />
            <meshBasicMaterial
              color={RADIO_ORANGE}
              transparent
              opacity={0.25}
              blending={THREE.AdditiveBlending}
            />
          </mesh>

          {/* Pulsing sphere 3 - innermost */}
          <mesh
            ref={pulse3Ref}
            onClick={handleClick}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
            <sphereGeometry args={[0.0099, 16, 16]} />
            <meshBasicMaterial
              color={RADIO_ORANGE}
              transparent
              opacity={0.25}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </>
      )}

      {/* Aggregation indicator - show track count for aggregated nodes */}
      {node.isAggregated && node.trackCount && node.trackCount > 1 && (
        <group position={[0, 0.03, 0]}>
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
