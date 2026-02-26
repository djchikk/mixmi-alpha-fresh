'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useDrop } from 'react-dnd';
import Header from '@/components/layout/Header';
import Crate from '@/components/shared/Crate';
import GraphSidebar from '@/components/creation-graph/GraphSidebar';
import GraphDetailPanel from '@/components/creation-graph/GraphDetailPanel';
import { GraphNode, GraphEdge, NodeType, EdgeType } from '@/components/creation-graph/types';
import { SAMPLE_DATA } from '@/components/creation-graph/sampleData';

const ForceGraph = dynamic(
  () => import('@/components/creation-graph/ForceGraph'),
  { ssr: false }
);

type DataMode = 'sample' | 'live' | 'dropped';

export default function CreationGraphPage() {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [focusDepth, setFocusDepth] = useState<number | null>(null);
  const [dataMode, setDataMode] = useState<DataMode>('sample');
  const [liveNodes, setLiveNodes] = useState<GraphNode[]>([]);
  const [liveLinks, setLiveLinks] = useState<GraphEdge[]>([]);
  const [droppedNodes, setDroppedNodes] = useState<GraphNode[]>([]);
  const [droppedLinks, setDroppedLinks] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dropMessage, setDropMessage] = useState<string | null>(null);

  const [nodeVisibility, setNodeVisibility] = useState<Record<NodeType, boolean>>({
    seed: true,
    remix: true,
    stem: false,
    artist: false,
  });

  const [edgeVisibility, setEdgeVisibility] = useState<Record<EdgeType, boolean>>({
    sampled_from: true,
    remixed_by: true,
    collaborated: true,
    payment: true,
  });

  // Fetch live data
  useEffect(() => {
    if (dataMode !== 'live') return;
    if (liveNodes.length > 0) return;

    setLoading(true);
    setLoadError(null);

    fetch('/api/creation-graph/data')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setLoadError(data.error);
        } else {
          setLiveNodes(data.nodes || []);
          setLiveLinks(data.links || []);
        }
      })
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [dataMode, liveNodes.length]);

  // Handle track drop — fetch its remix tree
  const handleTrackDrop = useCallback(async (track: { id?: string; title?: string }) => {
    if (!track?.id) return;

    const cleanId = track.id.includes('-loc-') ? track.id.split('-loc-')[0] : track.id;

    setLoading(true);
    setLoadError(null);
    setDropMessage(`Loading graph for "${track.title || 'track'}"...`);

    try {
      const res = await fetch(`/api/creation-graph/track?id=${cleanId}`);
      const data = await res.json();

      if (data.error) {
        setLoadError(data.error);
        setDropMessage(null);
        return;
      }

      if (data.nodes.length <= 1) {
        // No connections found — show message but still display the node
        setDropMessage(`"${track.title}" has no remix connections yet`);
        setTimeout(() => setDropMessage(null), 3000);
      } else {
        setDropMessage(null);
      }

      setDroppedNodes(data.nodes || []);
      setDroppedLinks(data.links || []);
      setSelectedNode(null);
      setFocusDepth(null);
      setDataMode('dropped');
    } catch (err) {
      setLoadError((err as Error).message);
      setDropMessage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Drop target for the graph area
  const [{ isOver }, dropRef] = useDrop(() => ({
    accept: ['COLLECTION_TRACK', 'CRATE_TRACK', 'GLOBE_CARD', 'TRACK_CARD'],
    drop: (item: { track?: Record<string, unknown>; id?: string; title?: string }) => {
      const track = item.track || item;
      handleTrackDrop(track as { id?: string; title?: string });
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [handleTrackDrop]);

  const activeNodes = dataMode === 'sample' ? SAMPLE_DATA.nodes
    : dataMode === 'live' ? liveNodes
    : droppedNodes;
  const activeLinks = dataMode === 'sample' ? SAMPLE_DATA.links
    : dataMode === 'live' ? liveLinks
    : droppedLinks;

  const handleToggleNode = useCallback((type: NodeType) => {
    setNodeVisibility(prev => ({ ...prev, [type]: !prev[type] }));
  }, []);

  const handleToggleEdge = useCallback((type: EdgeType) => {
    setEdgeVisibility(prev => ({ ...prev, [type]: !prev[type] }));
  }, []);

  const handleSetFocusDepth = useCallback((depth: number | null) => {
    setFocusDepth(depth);
  }, []);

  const handleSelectNode = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
    if (!node) setFocusDepth(null);
  }, []);

  const handleSwitchMode = useCallback((mode: DataMode) => {
    setSelectedNode(null);
    setFocusDepth(null);
    setDataMode(mode);
  }, []);

  const handleRefreshLive = useCallback(() => {
    setLiveNodes([]);
    setLiveLinks([]);
    setDataMode('live');
  }, []);

  return (
    <>
      <Header />

      <div
        className="fixed inset-0 top-[56px] flex overflow-hidden"
        style={{ background: '#0d1117' }}
      >
        {/* Left Sidebar */}
        <GraphSidebar
          nodeVisibility={nodeVisibility}
          edgeVisibility={edgeVisibility}
          focusDepth={focusDepth}
          hasSelection={!!selectedNode}
          onToggleNode={handleToggleNode}
          onToggleEdge={handleToggleEdge}
          onSetFocusDepth={handleSetFocusDepth}
        >
          {/* Data source toggle */}
          <div className="px-4 py-4 border-b border-[#21262d]">
            <div className="text-[10px] uppercase tracking-[0.15em] text-[#484f58] mb-3">
              Data Source
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => handleSwitchMode('sample')}
                className={`flex-1 py-1.5 text-[11px] rounded transition-colors ${
                  dataMode === 'sample'
                    ? 'bg-[#81E4F2]/15 text-[#81E4F2]'
                    : 'text-[#8b949e] hover:bg-white/5 hover:text-[#e6edf3]'
                }`}
              >
                Sample
              </button>
              <button
                onClick={() => handleSwitchMode('live')}
                className={`flex-1 py-1.5 text-[11px] rounded transition-colors ${
                  dataMode === 'live'
                    ? 'bg-[#A78BFA]/15 text-[#A78BFA]'
                    : 'text-[#8b949e] hover:bg-white/5 hover:text-[#e6edf3]'
                }`}
              >
                Live
              </button>
              {droppedNodes.length > 0 && (
                <button
                  onClick={() => handleSwitchMode('dropped')}
                  className={`flex-1 py-1.5 text-[11px] rounded transition-colors ${
                    dataMode === 'dropped'
                      ? 'bg-[#34D399]/15 text-[#34D399]'
                      : 'text-[#8b949e] hover:bg-white/5 hover:text-[#e6edf3]'
                  }`}
                >
                  Drop
                </button>
              )}
            </div>
            {dataMode === 'live' && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-[#8b949e]">
                  {loading ? 'Loading...' : loadError ? 'Error' : `${liveNodes.length} nodes`}
                </span>
                <button
                  onClick={handleRefreshLive}
                  className="text-[10px] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
                >
                  Refresh
                </button>
              </div>
            )}
            {dataMode === 'dropped' && (
              <div className="mt-2 text-[10px] text-[#8b949e]">
                {droppedNodes.length} nodes from drop
              </div>
            )}
            {loadError && (
              <div className="mt-1 text-[10px] text-red-400">{loadError}</div>
            )}
          </div>
        </GraphSidebar>

        {/* Main Graph Area — drop target */}
        <div ref={dropRef as unknown as React.Ref<HTMLDivElement>} className="flex-1 h-full relative">
          {loading ? (
            <div className="flex-1 h-full flex items-center justify-center" style={{ background: '#0d1117' }}>
              <div className="text-[#8b949e] text-sm">{dropMessage || 'Loading...'}</div>
            </div>
          ) : (
            <ForceGraph
              key={`${dataMode}-${activeNodes.length}`}
              nodes={activeNodes}
              links={activeLinks}
              nodeVisibility={nodeVisibility}
              edgeVisibility={edgeVisibility}
              focusDepth={focusDepth}
              selectedNodeId={selectedNode?.id ?? null}
              onSelectNode={handleSelectNode}
            />
          )}

          {/* Drop overlay */}
          {isOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117]/80 z-10 pointer-events-none">
              <div className="text-[#81E4F2] text-lg font-medium border-2 border-dashed border-[#81E4F2]/40 rounded-xl px-8 py-4">
                Drop to explore remix tree
              </div>
            </div>
          )}

          {/* Status message */}
          {dropMessage && !loading && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-[#161b22] border border-[#21262d] rounded-lg px-4 py-2 text-[12px] text-[#8b949e]">
              {dropMessage}
            </div>
          )}
        </div>

        {/* Right Detail Panel */}
        {selectedNode && (
          <GraphDetailPanel
            node={selectedNode}
            allNodes={activeNodes}
            onClose={() => handleSelectNode(null)}
          />
        )}
      </div>

      {/* Persistent Crate */}
      <Crate />
    </>
  );
}
