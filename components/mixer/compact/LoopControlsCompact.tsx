"use client";

import React, { useState, useEffect, useRef, memo } from 'react';
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

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
      <div className="loop-selector-compact relative flex items-center gap-1" ref={dropdownRef}>
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
        >◀</button>

        {/* Loop Icon with Number Inside - clickable to toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onLoopToggle();
          }}
          disabled={disabled}
          className={`relative flex items-center justify-center transition-all hover:scale-105 ${
            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          }`}
          title={disabled ? 'Load a track to enable loop controls' : loopEnabled ? 'Disable Loop' : 'Enable Loop'}
        >
          {/* Loop arrows icon - larger to wrap around number */}
          <Repeat
            size={22}
            strokeWidth={1.5}
            className={`transition-colors ${
              disabled ? 'text-slate-700' : loopEnabled ? 'text-[#81E4F2]' : 'text-slate-600 hover:text-slate-500'
            }`}
          />
          {/* Number positioned inside the loop icon */}
          <span
            className={`absolute text-[9px] font-bold ${
              disabled ? 'text-slate-600' : loopEnabled ? 'text-white' : 'text-slate-500'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled && loopEnabled) setDropdownOpen(!dropdownOpen);
            }}
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
        >▶</button>
        
        {/* Loop Options - Click-based dropdown */}
        {dropdownOpen && loopEnabled && (
          <div className="loop-options absolute top-full left-1/2 transform -translate-x-1/2 mt-1 bg-slate-800 border border-slate-600 rounded-lg p-1 z-20 shadow-lg">
            <div className="flex gap-1">
              {loopOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    onLoopChange(option);
                    setDropdownOpen(false);
                  }}
                  className={`px-1.5 py-0.5 rounded text-xs transition-all min-w-[20px] hover:scale-105 ${
                    loopLength === option
                      ? 'bg-[#81E4F2] text-slate-900 shadow-sm shadow-[#81E4F2]/50'
                      : 'border border-slate-600 text-slate-400 hover:border-[#81E4F2] hover:text-[#81E4F2] hover:bg-slate-700'
                  }`}
                >
                  {option === 0.125 ? '1/8' : option < 1 ? `${option * 4}/4` : option}
                </button>
              ))}
            </div>
            {/* Close button */}
            <div className="text-center mt-1">
              <button
                onClick={() => setDropdownOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
});

export default LoopControlsCompact;