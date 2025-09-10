"use client";

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { GlobeProps, TrackNode } from './types';
import { GlobeMesh } from './GlobeMesh';
import { NodeMesh } from './NodeMesh';
import { Starfield } from './Starfield';

// Convert lat/lng to 3D position on sphere
export function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  
  return new THREE.Vector3(x, y, z);
}

export default function Globe({ nodes = [], onNodeClick, onNodeHover }: GlobeProps) {
  const globeRef = useRef<THREE.Group>(null);
  
  const handleNodeClick = (node: TrackNode) => {
    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  const handleNodeHover = (node: TrackNode | null) => {
    if (onNodeHover) {
      onNodeHover(node);
    }
  };

  return (
    <div className="w-full h-full" style={{ minHeight: '600px' }}>
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 60 }}
        style={{ background: '#0a0a1a' }}
        onCreated={({ gl }) => {
          gl.setClearColor('#0a0a1a', 1);
        }}
      >
        {/* Night-time Earth lighting */}
        <ambientLight intensity={0.3} color="#4466aa" />
        <directionalLight position={[5, 3, 5]} intensity={0.6} color="#8899ff" />
        <directionalLight position={[-5, -3, -5]} intensity={0.3} color="#6677dd" />
        {/* Rim lighting for dramatic effect */}
        <directionalLight position={[0, 0, -5]} intensity={0.8} color="#00ffff" />
        
        {/* Background sphere with gradient effect */}
        <mesh>
          <sphereGeometry args={[800, 16, 16]} />
          <meshBasicMaterial 
            color="#0a0a1a"
            side={THREE.BackSide}
          />
        </mesh>
        
        {/* Starfield background */}
        <Starfield />
        
        {/* Globe mesh with nodes as children */}
        <GlobeMesh ref={globeRef}>
          {/* Track nodes - now children of the globe group */}
          {nodes.map((node) => (
            <NodeMesh
              key={node.id}
              node={node}
              onClick={() => handleNodeClick(node)}
              onHover={(hovering) => handleNodeHover(hovering ? node : null)}
            />
          ))}
        </GlobeMesh>
        
        {/* Controls */}
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minDistance={1.5}
          maxDistance={4}
          rotateSpeed={0.5}
          zoomSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}