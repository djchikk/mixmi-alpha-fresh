"use client";

import React, { memo } from 'react';
import { Repeat } from 'lucide-react';

interface LoopControlsProps {
  loopLength: number;
  loopEnabled: boolean;
  onLoopChange: (length: number) => void;
  onLoopToggle: () => void;
  className?: string;
  color?: 'cyan' | 'blue'; // For deck-specific styling
  disabled?: boolean; // Fully disabled when no track loaded
  reverse?: boolean; // Reverse order for deck symmetry
}

const LoopControlsCompact = memo(function LoopControlsCompact({
  loopLength,
  loopEnabled,
  onLoopChange,
  onLoopToggle,
  className = "",
  color = 'cyan',
  disabled = false,
  reverse = false
}: LoopControlsProps) {
  const loopOptions = [0.125, 0.25, 0.5, 1, 2, 4, 8];

  const handleLoopDecrease = () => {
    const currentIndex = loopOptions.indexOf(loopLength);
    if (currentIndex > 0) {
      onLoopChange(loopOptions[currentIndex - 1]);
    }
  };

  const handleLoopIncrease = () => {
    const currentIndex = loopOptions.indexOf(loopLength);
    if (currentIndex < loopOptions.length - 1) {
      onLoopChange(loopOptions[currentIndex + 1]);
    }
  };

  // Format loop length for display
  const formatLoopLength = (length: number) => {
    if (length === 0.125) return '⅛';
    if (length === 0.25) return '¼';
    if (length === 0.5) return '½';
    return length.toString();
  };

  return (
    <div className={`loop-controls-container flex items-center ${reverse ? 'flex-row-reverse' : ''} ${disabled ? 'opacity-30 pointer-events-none' : ''} ${className}`}>
      {/* Compact Loop Control - djay Pro style: ◀ [🔄number] ▶ */}
      <div className="loop-selector-compact relative flex items-center gap-1">
        {/* Decrease Arrow */}
        <button
          className={`text-[10px] px-1 py-0.5 transition-colors ${
            disabled ? 'text-slate-600 cursor-not-allowed' : loopEnabled ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled && loopEnabled) handleLoopDecrease();
          }}
          disabled={disabled || !loopEnabled}
          title="Decrease loop length"
        >◀</button>

        {/* Loop Icon with Number Inside - clickable to toggle loop on/off */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onLoopToggle();
          }}
          disabled={disabled}
          className={`relative flex items-center justify-center transition-all hover:scale-105 ${
            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          }`}
          title={disabled ? 'Load a track to enable loop controls' : loopEnabled ? 'Click to disable loop' : 'Click to enable loop'}
        >
          {/* Loop arrows icon - larger to wrap around number */}
          <Repeat
            size={22}
            strokeWidth={1.5}
            className={`transition-colors ${
              disabled ? 'text-slate-700' : loopEnabled ? 'text-[#81E4F2]' : 'text-slate-500 hover:text-slate-400'
            }`}
          />
          {/* Number positioned inside the loop icon */}
          <span
            className={`absolute text-[9px] font-bold pointer-events-none ${
              disabled ? 'text-slate-600' : loopEnabled ? 'text-white' : 'text-slate-500'
            }`}
          >
            {formatLoopLength(loopLength)}
          </span>
        </button>

        {/* Increase Arrow */}
        <button
          className={`text-[10px] px-1 py-0.5 transition-colors ${
            disabled ? 'text-slate-600 cursor-not-allowed' : loopEnabled ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled && loopEnabled) handleLoopIncrease();
          }}
          disabled={disabled || !loopEnabled}
          title="Increase loop length"
        >▶</button>
      </div>
    </div>
  );
});

export default LoopControlsCompact;