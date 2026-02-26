'use client';

import { NodeType, EdgeType, NODE_COLORS, EDGE_COLORS, NODE_LABELS, EDGE_LABELS } from './types';

interface GraphSidebarProps {
  nodeVisibility: Record<NodeType, boolean>;
  edgeVisibility: Record<EdgeType, boolean>;
  focusDepth: number | null; // null = All
  hasSelection: boolean;
  onToggleNode: (type: NodeType) => void;
  onToggleEdge: (type: EdgeType) => void;
  onSetFocusDepth: (depth: number | null) => void;
  children?: React.ReactNode;
}

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative w-8 h-[18px] rounded-full transition-colors ${
        disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
      } ${on ? 'bg-white/20' : 'bg-white/5'}`}
    >
      <span
        className={`absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all ${
          on ? 'left-[15px] bg-white' : 'left-[2px] bg-white/30'
        }`}
      />
    </button>
  );
}

const NODE_TYPE_ORDER: NodeType[] = ['seed', 'remix', 'stem', 'artist'];
const EDGE_TYPE_ORDER: EdgeType[] = ['sampled_from', 'remixed_by', 'collaborated', 'payment'];
const FOCUS_OPTIONS: (number | null)[] = [null, 1, 2, 3];

export default function GraphSidebar({
  nodeVisibility,
  edgeVisibility,
  focusDepth,
  hasSelection,
  onToggleNode,
  onToggleEdge,
  onSetFocusDepth,
  children,
}: GraphSidebarProps) {
  return (
    <div className="w-[220px] h-full bg-[#161b22] border-r border-[#21262d] flex flex-col overflow-y-auto">
      {/* Logo / Title */}
      <div className="px-4 py-5 border-b border-[#21262d]">
        <div className="text-[10px] uppercase tracking-[0.15em] text-[#8b949e] mb-1">
          mixmi
        </div>
        <div className="text-[13px] font-medium text-[#e6edf3]">
          Creation Graph
        </div>
      </div>

      {/* Data source toggle (injected from parent) */}
      {children}

      {/* Node Types */}
      <div className="px-4 py-4 border-b border-[#21262d]">
        <div className="text-[10px] uppercase tracking-[0.15em] text-[#484f58] mb-3">
          Node Types
        </div>
        <div className="space-y-2.5">
          {NODE_TYPE_ORDER.map(type => {
            const isDataType = type === 'seed' || type === 'remix';
            return (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: NODE_COLORS[type] }}
                  />
                  <span className={`text-[12px] ${isDataType ? 'text-[#e6edf3]' : 'text-[#484f58]'}`}>
                    {NODE_LABELS[type]}
                  </span>
                </div>
                <Toggle
                  on={nodeVisibility[type]}
                  onToggle={() => onToggleNode(type)}
                  disabled={!isDataType}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Edge Types */}
      <div className="px-4 py-4 border-b border-[#21262d]">
        <div className="text-[10px] uppercase tracking-[0.15em] text-[#484f58] mb-3">
          Edge Types
        </div>
        <div className="space-y-2.5">
          {EDGE_TYPE_ORDER.map(type => (
            <div key={type} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-0.5 rounded-full"
                  style={{ backgroundColor: EDGE_COLORS[type] }}
                />
                <span className="text-[12px] text-[#e6edf3]">
                  {EDGE_LABELS[type]}
                </span>
              </div>
              <Toggle
                on={edgeVisibility[type]}
                onToggle={() => onToggleEdge(type)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Focus Depth */}
      <div className="px-4 py-4 border-b border-[#21262d]">
        <div className="text-[10px] uppercase tracking-[0.15em] text-[#484f58] mb-3">
          Focus Depth
        </div>
        <div className="flex gap-1">
          {FOCUS_OPTIONS.map(depth => (
            <button
              key={depth ?? 'all'}
              onClick={() => onSetFocusDepth(depth)}
              disabled={!hasSelection && depth !== null}
              className={`flex-1 py-1 text-[11px] rounded transition-colors ${
                focusDepth === depth
                  ? 'bg-white/10 text-[#e6edf3]'
                  : !hasSelection && depth !== null
                  ? 'text-[#484f58] cursor-not-allowed'
                  : 'text-[#8b949e] hover:bg-white/5 hover:text-[#e6edf3]'
              }`}
            >
              {depth === null ? 'All' : `${depth}`}
            </button>
          ))}
        </div>
        {!hasSelection && (
          <div className="text-[10px] text-[#484f58] mt-2">
            Select a node to filter by depth
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-4 mt-auto">
        <div className="text-[10px] uppercase tracking-[0.15em] text-[#484f58] mb-3">
          Legend
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {NODE_TYPE_ORDER.map(type => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                style={{ backgroundColor: NODE_COLORS[type] }}
              />
              <span className="text-[10px] text-[#8b949e]">{NODE_LABELS[type]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
