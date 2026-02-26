'use client';

import { GraphNode, NODE_COLORS } from './types';

interface GraphDetailPanelProps {
  node: GraphNode | null;
  allNodes: GraphNode[];
  onClose: () => void;
}

function GenerationBadge({ generation }: { generation: number }) {
  const labels = ['SEED', 'GEN 1', 'GEN 2', 'GEN 3'];
  const label = labels[generation] || `GEN ${generation}`;
  const isSeed = generation === 0;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
      style={{
        color: isSeed ? '#81E4F2' : '#A78BFA',
        backgroundColor: isSeed ? 'rgba(129,228,242,0.1)' : 'rgba(167,139,250,0.1)',
      }}
    >
      {label}
    </span>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[12px] text-[#8b949e]">{label}</span>
      <span className="text-[13px] text-[#e6edf3] font-medium">{value}</span>
    </div>
  );
}

export default function GraphDetailPanel({ node, allNodes, onClose }: GraphDetailPanelProps) {
  if (!node) return null;

  const parent = node.parentId ? allNodes.find(n => n.id === node.parentId) : null;
  const children = allNodes.filter(n => n.parentId === node.id);

  // Count countries reached (unique locations in this node's subtree)
  const getSubtreeLocations = (id: string): Set<string> => {
    const locs = new Set<string>();
    const n = allNodes.find(nd => nd.id === id);
    if (n) {
      locs.add(n.location);
      const kids = allNodes.filter(nd => nd.parentId === id);
      for (const kid of kids) {
        for (const loc of getSubtreeLocations(kid.id)) {
          locs.add(loc);
        }
      }
    }
    return locs;
  };
  const countriesReached = getSubtreeLocations(node.id).size;

  return (
    <div className="w-[320px] h-full bg-[#161b22] border-l border-[#21262d] overflow-y-auto animate-[slideIn_300ms_ease-out]">
      {/* Close button */}
      <div className="flex justify-end p-3">
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded text-[#8b949e] hover:text-[#e6edf3] hover:bg-white/5 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="px-5 pb-6 space-y-5">
        {/* Generation + Title */}
        <div>
          <GenerationBadge generation={node.generation} />
          <h2 className="text-[20px] font-semibold text-[#e6edf3] mt-2 leading-tight">
            {node.title}
          </h2>
          <p className="text-[14px] mt-1" style={{ color: NODE_COLORS[node.type] }}>
            {node.artist}
          </p>
          <p className="text-[12px] text-[#8b949e] mt-0.5">{node.location}</p>
        </div>

        <div className="h-px bg-[#21262d]" />

        {/* Stems */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-[#484f58] mb-2">
            Stems
          </div>
          <div className="flex flex-wrap gap-1.5">
            {node.stems.map(stem => (
              <span
                key={stem}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 text-[11px] text-[#e6edf3]"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                {stem}
              </span>
            ))}
          </div>
        </div>

        {/* Splits */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-[#484f58] mb-2">
            Revenue Split
          </div>
          <div className="space-y-1.5">
            {/* Show this node's split */}
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-[#e6edf3]">{node.artist}</span>
              <span className="text-[12px] text-[#FBBF24] font-medium">
                {node.splitPercent}%
              </span>
            </div>
            {/* If remix, show parent getting their cut */}
            {parent && (
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-[#8b949e]">{parent.artist}</span>
                <span className="text-[12px] text-[#8b949e]">
                  {parent.splitPercent}%
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-[#21262d]" />

        {/* Stats */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-[#484f58] mb-2">
            Stats
          </div>
          <div className="space-y-2">
            <StatRow label="Downloads" value={node.downloads.toLocaleString()} />
            <StatRow label="Remixes" value={node.remixCount} />
            <StatRow label="Countries reached" value={countriesReached} />
          </div>
        </div>

        <div className="h-px bg-[#21262d]" />

        {/* Lineage */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-[#484f58] mb-2">
            Lineage
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-[11px] text-[#484f58] w-14 flex-shrink-0 mt-0.5">Parent</span>
              {parent ? (
                <span className="text-[12px] text-[#81E4F2]">{parent.title}</span>
              ) : (
                <span className="text-[12px] text-[#484f58] italic">Original seed</span>
              )}
            </div>
            {children.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-[11px] text-[#484f58] w-14 flex-shrink-0 mt-0.5">Children</span>
                <div className="space-y-1">
                  {children.map(child => (
                    <div key={child.id} className="text-[12px] text-[#A78BFA]">
                      {child.title}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {children.length === 0 && (
              <div className="flex items-start gap-2">
                <span className="text-[11px] text-[#484f58] w-14 flex-shrink-0 mt-0.5">Children</span>
                <span className="text-[12px] text-[#484f58] italic">Leaf node</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
