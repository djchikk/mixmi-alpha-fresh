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
  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();

  // Animation values for smooth transitions
  const hoverTransition = useRef({
    scale: 1,
    intensity: 0.8
  });

  // Calculate position
  const dynamicPosition = latLngToVector3(node.coordinates.lat, node.coordinates.lng, 1.02);

  // Calculate rotation to make circles face outward from globe surface
  // The circles should be perpendicular to the radius vector (surface normal)
  const surfaceNormal = dynamicPosition.clone().normalize();
  const upVector = new THREE.Vector3(0, 1, 0);

  // Create a quaternion that orients the circle to face along the surface normal
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(upVector, surfaceNormal);

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

    // Animate broadcast waves - expanding and fading
    if (wave1Ref.current) {
      const wave1Progress = (time * 1.0) % 2;
      wave1Ref.current.scale.setScalar(1 + wave1Progress * 1.2);
      (wave1Ref.current.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, (1 - wave1Progress / 2) * 0.8 * hoverTransition.current.intensity);
    }

    if (wave2Ref.current) {
      const wave2Progress = ((time * 1.0) + 0.66) % 2;
      wave2Ref.current.scale.setScalar(1 + wave2Progress * 1.2);
      (wave2Ref.current.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, (1 - wave2Progress / 2) * 0.8 * hoverTransition.current.intensity);
    }

    if (wave3Ref.current) {
      const wave3Progress = ((time * 1.0) + 1.33) % 2;
      wave3Ref.current.scale.setScalar(1 + wave3Progress * 1.2);
      (wave3Ref.current.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, (1 - wave3Progress / 2) * 0.8 * hoverTransition.current.intensity);
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
    <group ref={groupRef} position={dynamicPosition} quaternion={quaternion}>
      {/* Broadcast wave 1 - outermost */}
      <mesh
        ref={wave1Ref}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <circleGeometry args={[0.015, 32]} />
        <meshBasicMaterial
          color={RADIO_ORANGE}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Broadcast wave 2 - middle */}
      <mesh
        ref={wave2Ref}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <circleGeometry args={[0.015, 32]} />
        <meshBasicMaterial
          color={RADIO_ORANGE}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Broadcast wave 3 - innermost */}
      <mesh
        ref={wave3Ref}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <circleGeometry args={[0.015, 32]} />
        <meshBasicMaterial
          color={RADIO_ORANGE}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

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
