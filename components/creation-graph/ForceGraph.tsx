'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import ForceGraph3D from 'react-force-graph-3d';
import type { ForceGraphMethods } from 'react-force-graph-3d';
import * as THREE from 'three';
import {
  GraphNode, GraphEdge, NodeType, EdgeType,
  NODE_COLORS, EDGE_COLORS,
} from './types';
import { getConnectedIds, getNodesWithinHops } from './sampleData';

interface ForceGraphProps {
  nodes: GraphNode[];
  links: GraphEdge[];
  nodeVisibility: Record<NodeType, boolean>;
  edgeVisibility: Record<EdgeType, boolean>;
  focusDepth: number | null;
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNode | null) => void;
}

// Node size based on type and downloads
function getNodeSize(node: GraphNode): number {
  if (node.type === 'seed') return 10;
  // Remix: scale by downloads (min 4, max 8)
  return 4 + Math.min(4, (node.downloads / 100));
}

export default function ForceGraph({
  nodes,
  links,
  nodeVisibility,
  edgeVisibility,
  focusDepth,
  selectedNodeId,
  onSelectNode,
}: ForceGraphProps) {
  const fgRef = useRef<ForceGraphMethods | undefined>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const interactionTimeRef = useRef(Date.now());

  // Track dimensions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    obs.observe(container);
    return () => obs.disconnect();
  }, []);

  // Compute which nodes are "visible" (not dimmed) based on selection + focus depth
  const visibleNodeIds = useMemo(() => {
    if (!selectedNodeId) return null; // null = all visible

    if (focusDepth !== null) {
      return getNodesWithinHops(selectedNodeId, nodes, focusDepth);
    }

    return getConnectedIds(selectedNodeId, nodes);
  }, [selectedNodeId, focusDepth, nodes]);

  // Filter links by edge visibility
  const filteredLinks = useMemo(() => {
    return links.filter(l => edgeVisibility[l.type]);
  }, [links, edgeVisibility]);

  // Filter nodes by node type visibility
  const filteredNodes = useMemo(() => {
    return nodes.filter(n => nodeVisibility[n.type]);
  }, [nodes, nodeVisibility]);

  // Build graph data object (force-graph expects { nodes, links })
  const graphData = useMemo(() => ({
    nodes: filteredNodes,
    links: filteredLinks,
  }), [filteredNodes, filteredLinks]);

  // On engine ready: zoom to fit and start auto-rotate
  const handleEngineStop = useCallback(() => {
    if (!fgRef.current) return;
    fgRef.current.zoomToFit(800, 80);

    // Set up auto-rotate
    const controls = fgRef.current.controls();
    if (controls && 'autoRotate' in controls) {
      const orbit = controls as unknown as { autoRotate: boolean; autoRotateSpeed: number };
      const checkIdle = () => {
        const idleMs = Date.now() - interactionTimeRef.current;
        orbit.autoRotate = idleMs > 5000;
        orbit.autoRotateSpeed = 0.3;
      };
      setInterval(checkIdle, 1000);
    }
  }, []);

  // On node select: animate camera
  useEffect(() => {
    if (!selectedNodeId || !fgRef.current) return;
    const node = filteredNodes.find(n => n.id === selectedNodeId) as (GraphNode & { x?: number; y?: number; z?: number }) | undefined;
    if (!node || node.x === undefined) return;

    const distance = 120;
    const pos = {
      x: node.x! + distance * 0.5,
      y: node.y! + distance * 0.3,
      z: node.z! + distance,
    };
    fgRef.current.cameraPosition(pos, { x: node.x!, y: node.y!, z: node.z! }, 600);
  }, [selectedNodeId, filteredNodes]);

  const handleNodeClick = useCallback((node: object) => {
    const gNode = node as GraphNode;
    interactionTimeRef.current = Date.now();
    onSelectNode(gNode.id === selectedNodeId ? null : gNode);
  }, [onSelectNode, selectedNodeId]);

  const handleBackgroundClick = useCallback(() => {
    interactionTimeRef.current = Date.now();
    onSelectNode(null);
  }, [onSelectNode]);

  const handleNodeHover = useCallback((node: object | null) => {
    interactionTimeRef.current = Date.now();
    setHoveredNodeId(node ? (node as GraphNode).id : null);
  }, []);

  // Custom node Three.js object
  const nodeThreeObject = useCallback((node: object) => {
    const gNode = node as GraphNode;
    const group = new THREE.Group();

    const size = getNodeSize(gNode);
    const color = NODE_COLORS[gNode.type];

    // Determine opacity
    let opacity = 1;
    if (visibleNodeIds && !visibleNodeIds.has(gNode.id)) {
      opacity = 0.12;
    }

    // Main sphere
    const geometry = new THREE.SphereGeometry(size, 24, 24);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
    });
    const sphere = new THREE.Mesh(geometry, material);
    group.add(sphere);

    // Glow halo (larger, more transparent)
    const glowGeometry = new THREE.SphereGeometry(size * 1.6, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: opacity * 0.12,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    group.add(glow);

    // Seed gets extra pulsing ring
    if (gNode.type === 'seed') {
      const ringGeometry = new THREE.RingGeometry(size * 1.4, size * 1.7, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: opacity * 0.3,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      group.add(ring);
    }

    // Hover/selection ring
    if (gNode.id === hoveredNodeId || gNode.id === selectedNodeId) {
      const hRingGeo = new THREE.RingGeometry(size * 1.2, size * 1.35, 32);
      const hRingMat = new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      });
      group.add(new THREE.Mesh(hRingGeo, hRingMat));
    }

    return group;
  }, [visibleNodeIds, hoveredNodeId, selectedNodeId]);

  // Link styling
  const linkColor = useCallback((link: object) => {
    const edge = link as GraphEdge;
    const color = EDGE_COLORS[edge.type];
    // Dim if selection active and neither endpoint is visible
    if (visibleNodeIds) {
      const srcId = typeof edge.source === 'object' ? (edge.source as GraphNode).id : edge.source;
      const tgtId = typeof edge.target === 'object' ? (edge.target as GraphNode).id : edge.target;
      if (!visibleNodeIds.has(srcId) || !visibleNodeIds.has(tgtId)) {
        return 'rgba(255,255,255,0.03)';
      }
    }
    return color;
  }, [visibleNodeIds]);

  const linkWidth = useCallback((link: object) => {
    const edge = link as GraphEdge;
    if (edge.type === 'payment') return 0.5;
    if (edge.type === 'collaborated') return 1;
    return 1.5;
  }, []);

  // Link dash pattern for collaborated edges
  const linkLineDash = useCallback((link: object) => {
    const edge = link as GraphEdge;
    if (edge.type === 'collaborated') return [2, 2];
    if (edge.type === 'payment') return [1, 2];
    return undefined;
  }, []);

  // Directional particles on payment edges
  const linkDirectionalParticles = useCallback((link: object) => {
    const edge = link as GraphEdge;
    if (edge.type === 'payment' && edgeVisibility.payment) return 3;
    return 0;
  }, [edgeVisibility.payment]);

  const linkDirectionalParticleColor = useCallback(() => '#FBBF24', []);
  const linkDirectionalParticleWidth = useCallback(() => 2, []);
  const linkDirectionalParticleSpeed = useCallback(() => 0.006, []);

  // Node tooltip
  const nodeLabel = useCallback((node: object) => {
    const gNode = node as GraphNode;
    return `<div style="background:#161b22;border:1px solid #21262d;padding:6px 10px;border-radius:6px;font-size:12px;color:#e6edf3;pointer-events:none;">
      <strong>${gNode.title}</strong><br/>
      <span style="color:#8b949e">${gNode.artist} · ${gNode.location}</span>
    </div>`;
  }, []);

  // Node visibility based on type toggles
  const nodeVisibilityFn = useCallback((node: object) => {
    const gNode = node as GraphNode;
    return nodeVisibility[gNode.type];
  }, [nodeVisibility]);

  return (
    <div
      ref={containerRef}
      className="flex-1 h-full relative"
      style={{ background: '#0d1117' }}
    >
      <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        backgroundColor="#0d1117"
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={nodeLabel}
        nodeVisibility={nodeVisibilityFn}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkCurvature={0.2}
        linkOpacity={0.6}
        linkDirectionalParticles={linkDirectionalParticles}
        linkDirectionalParticleColor={linkDirectionalParticleColor}
        linkDirectionalParticleWidth={linkDirectionalParticleWidth}
        linkDirectionalParticleSpeed={linkDirectionalParticleSpeed}
        onBackgroundClick={handleBackgroundClick}
        onEngineStop={handleEngineStop}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        warmupTicks={50}
        cooldownTime={3000}
        {...{ linkLineDash } as Record<string, unknown>}
      />
    </div>
  );
}
