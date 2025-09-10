"use client";

import React, { useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';

interface GeoJSONFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
  properties: any;
}

interface GeoJSONData {
  type: string;
  features: GeoJSONFeature[];
}

export function WorldOutlines() {
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch GeoJSON data
  useEffect(() => {
    const fetchWorldData = async () => {
      try {
        // Using a simplified world map GeoJSON
        const response = await fetch(
          'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson'
        );
        const data = await response.json();
        setGeoData(data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load world data:', error);
        setLoading(false);
      }
    };

    fetchWorldData();
  }, []);

  // Convert GeoJSON to Three.js geometries with geometry merging optimization
  const continentGeometries = useMemo(() => {
    if (!geoData) return [];

    const GLOBE_RADIUS = 1;
    const mainLinePoints: THREE.Vector3[] = [];
    const glowLinePoints: THREE.Vector3[] = [];
    const lineSegments: number[] = []; // Track where each line segment ends

    geoData.features.forEach((feature) => {
      if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
        const coordinates = feature.geometry.coordinates;
        
        // Handle both Polygon and MultiPolygon
        const polygons = feature.geometry.type === "Polygon" ? [coordinates] : coordinates;
        
        polygons.forEach((polygon: number[][][]) => {
          // Skip small islands (less than 10 points)
          if (polygon[0].length < 10) return;
          
          const segmentPoints: THREE.Vector3[] = [];
          
          // Convert lat/lon to 3D positions
          polygon[0].forEach(([lon, lat]) => {
            // Skip invalid coordinates
            if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
            
            const phi = (90 - lat) * Math.PI / 180;
            const theta = (lon + 180) * Math.PI / 180;
            
            const x = -(GLOBE_RADIUS * 1.002 * Math.sin(phi) * Math.cos(theta));
            const y = GLOBE_RADIUS * 1.002 * Math.cos(phi);
            const z = GLOBE_RADIUS * 1.002 * Math.sin(phi) * Math.sin(theta);
            
            segmentPoints.push(new THREE.Vector3(x, y, z));
          });
          
          if (segmentPoints.length > 2) {
            // Add points to merged arrays
            mainLinePoints.push(...segmentPoints);
            glowLinePoints.push(...segmentPoints);
            lineSegments.push(mainLinePoints.length);
          }
        });
      }
    });

    // Create merged geometries
    const geometries: { geometry: THREE.BufferGeometry; isMainLine: boolean; segmentEnds: number[] }[] = [];
    
    if (mainLinePoints.length > 0) {
      // Create merged main line geometry
      const mainGeometry = new THREE.BufferGeometry().setFromPoints(mainLinePoints);
      geometries.push({ geometry: mainGeometry, isMainLine: true, segmentEnds: lineSegments });
      
      // Create merged glow geometry
      const glowGeometry = new THREE.BufferGeometry().setFromPoints(glowLinePoints);
      geometries.push({ geometry: glowGeometry, isMainLine: false, segmentEnds: lineSegments });
    }

    return geometries;
  }, [geoData]);

  if (loading) {
    return null; // Don't render anything while loading
  }

  return (
    <>
      {continentGeometries.map(({ geometry, isMainLine, segmentEnds }, index) => {
        // Create line segments for the merged geometry
        const indices: number[] = [];
        let lastEnd = 0;
        
        segmentEnds.forEach((end) => {
          for (let i = lastEnd; i < end - 1; i++) {
            indices.push(i, i + 1);
          }
          // Close the loop by connecting last to first point of this segment
          if (end > lastEnd) {
            indices.push(end - 1, lastEnd);
          }
          lastEnd = end;
        });
        
        // Set the index attribute for line segments
        geometry.setIndex(indices);
        
        if (isMainLine) {
          // Render multiple passes for the blue-to-gold gradient effect
          return (
            <React.Fragment key={index}>
              {/* Main continent outline - bright cyan */}
              <lineSegments geometry={geometry}>
                <lineBasicMaterial 
                  color="#00ffff"
                  opacity={0.8}
                  transparent
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </lineSegments>
              
              {/* Glow effect */}
              <lineSegments geometry={geometry}>
                <lineBasicMaterial 
                  color="#00ffff"
                  opacity={0.3}
                  transparent
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </lineSegments>
            </React.Fragment>
          );
        } else {
          // Additional glow layer for depth
          return (
            <lineSegments key={index} geometry={geometry}>
              <lineBasicMaterial 
                color="#00ffff"
                opacity={0.1}
                transparent
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </lineSegments>
          );
        }
      })}
    </>
  );
}