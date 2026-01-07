"use client";

import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { GlobeProps, TrackNode } from './types';
import { GlobeMesh } from './GlobeMesh';
import { NodeMesh } from './NodeMesh';
import { GridNodeSystem } from './GridNodeSystem';
import { Starfield } from './Starfield';
import { ConnectionArcs } from './ConnectionArcs';
import { NullIsland } from './NullIsland';

// Convert lat/lng to 3D position on sphere
export function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
}

export default function Globe({ nodes = [], onNodeClick, onNodeHover, selectedNode, hoveredNode, backgroundMode = false, onNullIslandClick }: GlobeProps & { onNullIslandClick?: () => void }) {
  const globeRef = useRef<THREE.Group>(null);

  return (
    <div className="w-full h-full" style={{ minHeight: '600px' }}>
      <Canvas
        camera={{ 
          position: [0, 0, 2.5], 
          fov: 60,
          near: 0.01,  // Allow very close zoom
          far: 1000    // Maintain far distance
        }}
        style={{ background: '#0a0a1a' }}
        onCreated={({ gl }) => {
          gl.setClearColor('#0a0a1a', 1);
        }}
      >
        {/* Golden hour in space lighting */}
        {/* Neutral ambient with slight warmth */}
        <ambientLight intensity={0.2} color="#9999aa" />

        {/* Main "sun" light - warm golden, upper right */}
        <directionalLight
          position={[4, 3, 2]}
          intensity={1.2}
          color="#FFD699"
        />

        {/* Secondary warm fill - softer, from the side */}
        <directionalLight
          position={[2, 1, 4]}
          intensity={0.4}
          color="#FFCC88"
        />

        {/* Cool shadow fill - opposite side for contrast */}
        <directionalLight
          position={[-4, -2, -3]}
          intensity={0.25}
          color="#4477aa"
        />

        {/* Subtle cyan rim light from behind - reduced */}
        <directionalLight
          position={[0, 0, -5]}
          intensity={0.3}
          color="#66ccdd"
        />
        
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
          {/* Null Island - Home of (0,0) coordinates! 🏝️ */}
          <NullIsland onClick={onNullIslandClick} />
          
          {/* Grid-based node system with zoom levels */}
          <GridNodeSystem
            nodes={nodes}
            onNodeClick={onNodeClick}
            onNodeHover={onNodeHover}
          />
          
          {/* Connection arcs when a node is selected or hovered - inside the globe group */}
          <ConnectionArcs 
            selectedNode={selectedNode || hoveredNode} 
            allNodes={nodes} 
          />
        </GlobeMesh>
        
        {/* Controls with deeper zoom - disabled in background mode */}
        {!backgroundMode && (
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            minDistance={1.05}  // Much closer zoom
            maxDistance={8}     // Slightly farther max
            rotateSpeed={0.5}
            zoomSpeed={0.2}     // Even more gradual zoom (was 0.4)
            enableDamping={true}
            dampingFactor={0.1}   // Even smoother damping (was 0.08)
          />
        )}
      </Canvas>
    </div>
  );
}