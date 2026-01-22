"use client";

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { TrackNode } from './types';

interface ConnectionArcsProps {
  selectedNode: TrackNode | null;
  allNodes: TrackNode[];
}

// Helper function to create an arc between two points on a sphere
function createArc(start: THREE.Vector3, end: THREE.Vector3, segments: number = 50): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  
  // Calculate the angle between points
  const angle = start.angleTo(end);
  
  // Get the midpoint for the arc peak
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  
  // Calculate arc height based on distance (higher for longer distances)
  const baseRadius = start.length(); // Should be ~1.02
  const arcHeightMultiplier = 0.15 + (angle / Math.PI) * 0.2; // Height varies from 0.15 to 0.35 (50% of previous)
  const maxHeight = baseRadius * (1 + arcHeightMultiplier);
  
  // Create a curved path using a quadratic bezier approach
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    
    // Interpolate between start and end
    const point = new THREE.Vector3().lerpVectors(start, end, t);
    
    // Calculate height for this point (peaks at midpoint)
    const heightFactor = Math.sin(t * Math.PI); // 0 at ends, 1 at middle
    const currentRadius = baseRadius + (maxHeight - baseRadius) * heightFactor;
    
    // Scale the point to the correct radius
    point.normalize().multiplyScalar(currentRadius);
    
    points.push(point);
  }
  
  return points;
}

// Animated Arc component
function AnimatedArc({ arc }: { arc: any }) {
  const meshRef = useRef<any>(null);
  const glowRef = useRef<any>(null);
  
  // Animate the arc with a pulsing glow
  useFrame((state) => {
    if (meshRef.current && glowRef.current) {
      const time = state.clock.getElapsedTime();
      // Pulsing effect
      const pulse = Math.sin(time * 2) * 0.2 + 0.8;
      if (meshRef.current.material) {
        meshRef.current.material.opacity = pulse * 0.8;
      }
      if (glowRef.current.material) {
        glowRef.current.material.opacity = pulse * 0.2;
      }
    }
  });
  
  // Create a curve from the points
  const curve = new THREE.CatmullRomCurve3(arc.points);
  
  return (
    <group>
      {/* Main arc tube */}
      <mesh ref={meshRef}>
        <tubeGeometry args={[curve, 64, 0.004, 8, false]} />
        <meshBasicMaterial
          color="#00ffff"
          opacity={0.8}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Glow effect - larger tube with lower opacity */}
      <mesh ref={glowRef}>
        <tubeGeometry args={[curve, 64, 0.012, 8, false]} />
        <meshBasicMaterial
          color="#00ffff"
          opacity={0.3}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Connection points - small spheres at start and end */}
      <mesh position={arc.points[0]}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          emissive="#00ffff"
          emissiveIntensity={0.5}
        />
      </mesh>
      
      <mesh position={arc.points[arc.points.length - 1]}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          emissive="#00ffff"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
}

export function ConnectionArcs({ selectedNode, allNodes }: ConnectionArcsProps) {
  const arcs = useMemo(() => {
    if (!selectedNode) return [];
    
    console.log('🎯 ConnectionArcs - selectedNode:', selectedNode.title, selectedNode.id);

    // Add null safety check for selectedNode.id
    if (!selectedNode.id) {
      console.warn('⚠️ ConnectionArcs - selectedNode has no ID');
      return [];
    }

    // Special logging for test tracks
    if (selectedNode.title === "3 Location Test" || selectedNode.title === "multilocation fun") {
      console.log('🔍 Multi-location track detected!');
    }

    // Extract the base track ID from the selected node
    const baseTrackId = selectedNode.id.includes('-loc-')
      ? selectedNode.id.split('-loc-')[0]
      : selectedNode.id;
    
    console.log('📌 Base track ID:', baseTrackId);
    
    // Find all nodes that belong to the same track
    const relatedNodes = allNodes.filter(node => {
      // Add null safety check
      if (!node.id) return false;

      const nodeBaseId = node.id.includes('-loc-')
        ? node.id.split('-loc-')[0]
        : node.id;
      const isRelated = nodeBaseId === baseTrackId && node.id !== selectedNode.id;
      
      if (isRelated) {
        console.log('✅ Found related node:', node.id, node.title, node.location);
      }
      
      return isRelated;
    });
    
    console.log(`🌐 Found ${relatedNodes.length} related nodes for track ${baseTrackId}`);
    console.log('🌐 Total nodes available:', allNodes.length);
    
    // Debug: Log the coordinates of all nodes
    console.log('📍 Selected node:', selectedNode.id, selectedNode.location, selectedNode.coordinates);
    relatedNodes.forEach(node => {
      console.log('📍 Related node:', node.id, node.location, node.coordinates);
    });
    
    // Create arcs from selected node to all related nodes
    return relatedNodes.map(targetNode => {
      // Use the same conversion as in Globe.tsx
      const phi1 = (90 - selectedNode.coordinates.lat) * (Math.PI / 180);
      const theta1 = (selectedNode.coordinates.lng + 180) * (Math.PI / 180);
      
      // Add node elevation (nodes are slightly above the surface)
      const nodeElevation = 1.02; // Nodes are at radius 1.02 per NodeMesh.tsx
      
      const startPos = new THREE.Vector3(
        -(Math.sin(phi1) * Math.cos(theta1)) * nodeElevation,
        Math.cos(phi1) * nodeElevation,
        Math.sin(phi1) * Math.sin(theta1) * nodeElevation
      );
      
      const phi2 = (90 - targetNode.coordinates.lat) * (Math.PI / 180);
      const theta2 = (targetNode.coordinates.lng + 180) * (Math.PI / 180);
      
      const endPos = new THREE.Vector3(
        -(Math.sin(phi2) * Math.cos(theta2)) * nodeElevation,
        Math.cos(phi2) * nodeElevation,
        Math.sin(phi2) * Math.sin(theta2) * nodeElevation
      );
      
      return {
        id: `${selectedNode.id}-to-${targetNode.id}`,
        points: createArc(startPos, endPos, 40), // More segments for smoother curve
        fromLocation: selectedNode.location || 'Unknown',
        toLocation: targetNode.location || 'Unknown',
        startCoords: selectedNode.coordinates,
        endCoords: targetNode.coordinates
      };
    });
  }, [selectedNode, allNodes]);
  
  // No arcs to render
  if (arcs.length === 0) {
    return null;
  }
  
  return (
    <group>
      {arcs.map((arc, index) => {
        return (
          <React.Fragment key={arc.id}>
            {/* Simple line segments approach */}
            {arc.points.map((point, i) => {
              if (i === arc.points.length - 1) return null;
              const nextPoint = arc.points[i + 1];
              
              return (
                <line key={`${arc.id}-segment-${i}`}>
                  <bufferGeometry>
                    <float32BufferAttribute
                      attach="attributes-position"
                      count={2}
                      array={new Float32Array([
                        point.x, point.y, point.z,
                        nextPoint.x, nextPoint.y, nextPoint.z
                      ])}
                      itemSize={3}
                    />
                  </bufferGeometry>
                  <lineBasicMaterial
                    color="#00ffff"
                    opacity={0.8}
                    transparent
                    linewidth={2}
                  />
                </line>
              );
            })}
            
            {/* Connection dots at endpoints */}
            <mesh position={arc.points[0]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshBasicMaterial color="#00ffff" />
            </mesh>
            
            <mesh position={arc.points[arc.points.length - 1]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshBasicMaterial color="#00ffff" />
            </mesh>
          </React.Fragment>
        );
      })}
    </group>
  );
}