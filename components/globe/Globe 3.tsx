"use client";

import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { GlobeProps, TrackNode } from './types';
import { GlobeMesh } from './GlobeMesh';
import { NodeMesh } from './NodeMesh';
import { ClusteredNodeMesh } from './ClusteredNodeMesh';
import { Starfield } from './Starfield';
import { ConnectionArcs } from './ConnectionArcs';
import { clusterNodes } from '@/lib/nodeClusteringUtils';

// Convert lat/lng to 3D position on sphere
export function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  
  return new THREE.Vector3(x, y, z);
}

// Component to track camera distance and manage clustering
function ClusteredNodes({ nodes, onNodeClick, onNodeHover }: { 
  nodes: TrackNode[]; 
  onNodeClick?: (node: TrackNode) => void;
  onNodeHover?: (node: TrackNode | null) => void;
}) {
  const { camera } = useThree();
  const [cameraDistance, setCameraDistance] = useState(2.5);
  
  // Update camera distance every frame
  useFrame(() => {
    const distance = camera.position.length();
    setCameraDistance(distance);
  });
  
  // Cluster nodes based on current camera distance
  const clusters = useMemo(() => {
    return clusterNodes(nodes, cameraDistance);
  }, [nodes, cameraDistance]);
  
  const handleClusterClick = (clusterNodes: TrackNode[]) => {
    // If single node, click it directly
    if (clusterNodes.length === 1 && onNodeClick) {
      onNodeClick(clusterNodes[0]);
    } else {
      // For multiple nodes, we could show a selection menu
      // For now, click the first node
      if (onNodeClick) {
        onNodeClick(clusterNodes[0]);
      }
    }
  };
  
  const handleClusterHover = (hovering: boolean, clusterNodes: TrackNode[]) => {
    if (onNodeHover) {
      onNodeHover(hovering ? clusterNodes[0] : null);
    }
  };
  
  return (
    <>
      {clusters.map(cluster => (
        <ClusteredNodeMesh
          key={cluster.id}
          nodes={cluster.nodes}
          position={cluster.position}
          onClick={handleClusterClick}
          onHover={handleClusterHover}
        />
      ))}
    </>
  );
}

export default function Globe({ nodes = [], onNodeClick, onNodeHover, selectedNode, hoveredNode }: GlobeProps) {
  const globeRef = useRef<THREE.Group>(null);

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
        {/* Blue-tinted ambient light */}
        <ambientLight intensity={0.25} color="#4488cc" />
        
        {/* Cyan rim light from behind */}
        <directionalLight position={[0, 0, -5]} intensity={0.7} color="#00ffff" />
        
        {/* Soft fill lights */}
        <directionalLight position={[5, 3, 5]} intensity={0.3} color="#6699ff" />
        <directionalLight position={[-5, -3, -5]} intensity={0.2} color="#4466aa" />
        
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
          {/* Clustered nodes */}
          <ClusteredNodes 
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
        
        {/* Controls */}
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minDistance={1.2}
          maxDistance={5}
          rotateSpeed={0.5}
          zoomSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}