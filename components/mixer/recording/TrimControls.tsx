"use client";

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PRICING } from '@/config/pricing';

interface TrimControlsProps {
  trimStartBars: number;
  trimEndBars: number;
  totalBars: number;
  onNudge: (point: 'start' | 'end', direction: 'left' | 'right', resolution: number) => void;
}

type Resolution = '1bar' | '1beat' | '1/16';

export default function TrimControls({
  trimStartBars,
  trimEndBars,
  totalBars,
  onNudge,
}: TrimControlsProps) {
  const [resolution, setResolution] = useState<Resolution>('1bar');

  // Resolution in bars
  const getResolutionValue = (): number => {
    switch (resolution) {
      case '1bar':
        return 1;
      case '1beat':
        return 0.25; // 1 beat = 1/4 bar
      case '1/16':
        return 0.0625; // 1/16 = 1/16 bar
      default:
        return 1;
    }
  };

  const barsPerBlock = PRICING.remix.barsPerBlock;
  const selectedBars = trimEndBars - trimStartBars;
  const selectedBlocks = Math.ceil(selectedBars / barsPerBlock);

  return (
    <div className="trim-controls bg-slate-800/50 rounded-lg p-3">
      {/* Resolution Selector */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="text-xs text-slate-400">Nudge:</span>
        <div className="flex gap-1">
          {(['1bar', '1beat', '1/16'] as Resolution[]).map((res) => (
            <button
              key={res}
              onClick={() => setResolution(res)}
              className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${
                resolution === res
                  ? 'bg-[#81E4F2] text-slate-900'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {res === '1bar' ? '1 BAR' : res === '1beat' ? '1 BEAT' : '1/16'}
            </button>
          ))}
        </div>
      </div>

      {/* Nudge Controls */}
      <div className="flex justify-between items-center gap-4">
        {/* IN Point */}
        <div className="flex-1">
          <div className="text-xs text-slate-400 text-center mb-1">IN</div>
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => onNudge('start', 'left', getResolutionValue())}
              disabled={trimStartBars <= 0}
              className="p-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Nudge IN left"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="w-16 text-center font-mono text-sm text-[#FBBF24]">
              {trimStartBars.toFixed(resolution === '1bar' ? 0 : 2)}
            </div>
            <button
              onClick={() => onNudge('start', 'right', getResolutionValue())}
              disabled={trimStartBars >= trimEndBars - barsPerBlock}
              className="p-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Nudge IN right"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Selection Info */}
        <div className="text-center">
          <div className="text-[10px] text-slate-500 uppercase">Selection</div>
          <div className="text-lg font-bold text-[#81E4F2]">
            {selectedBlocks} block{selectedBlocks !== 1 ? 's' : ''}
          </div>
          <div className="text-xs text-slate-400">({selectedBars} bars)</div>
        </div>

        {/* OUT Point */}
        <div className="flex-1">
          <div className="text-xs text-slate-400 text-center mb-1">OUT</div>
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => onNudge('end', 'left', getResolutionValue())}
              disabled={trimEndBars <= trimStartBars + barsPerBlock}
              className="p-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Nudge OUT left"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="w-16 text-center font-mono text-sm text-[#FBBF24]">
              {trimEndBars.toFixed(resolution === '1bar' ? 0 : 2)}
            </div>
            <button
              onClick={() => onNudge('end', 'right', getResolutionValue())}
              disabled={trimEndBars >= totalBars}
              className="p-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Nudge OUT right"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
