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
  contentType?: string; // Track content type (full_song shows section selector)
  sectionLoopPosition?: number; // Which section to loop (0-indexed)
  onSectionPositionChange?: (position: number) => void; // Callback when section changes
  trackDuration?: number; // Track duration in seconds
  trackBPM?: number; // Track BPM for calculating sections
}

const LoopControlsCompact = memo(function LoopControlsCompact({
  loopLength,
  loopEnabled,
  onLoopChange,
  onLoopToggle,
  className = "",
  color = 'cyan',
  disabled = false,
  contentType,
  sectionLoopPosition = 0,
  onSectionPositionChange,
  trackDuration,
  trackBPM
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

  // 🎵 Calculate number of sections for songs
  const isSong = contentType === 'full_song';
  const calculateSections = (): number => {
    if (!isSong || !trackDuration || !trackBPM || !loopLength) return 0;
    const barDuration = (60 / trackBPM) * 4; // 4 beats per bar
    const sectionDuration = barDuration * loopLength; // Duration of one section in seconds
    return Math.floor(trackDuration / sectionDuration);
  };
  const numberOfSections = calculateSections();

  return (
    <div className={`loop-controls-container flex items-center gap-2 ${disabled ? 'opacity-30 pointer-events-none' : ''} ${className}`}>
      {/* Loop Toggle Button */}
      <button
        onClick={disabled ? undefined : onLoopToggle}
        disabled={disabled}
        className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
          disabled
            ? 'border border-slate-700 text-slate-600 cursor-not-allowed'
            : loopEnabled
            ? 'bg-[#81E4F2] border-[#81E4F2] text-slate-900 shadow-lg shadow-[#81E4F2]/50 hover:scale-105'
            : 'border border-slate-600 text-slate-500 hover:border-slate-500 hover:text-slate-400 hover:scale-105'
        }`}
        title={disabled ? 'Load a track to enable loop controls' : loopEnabled ? 'Disable Loop' : 'Enable Loop'}
      >
        <Repeat size={12} className={`transition-colors ${
          disabled ? 'text-slate-600' : loopEnabled ? 'text-slate-900' : 'text-slate-500'
        }`} />
      </button>

      {/* Loop Length Selector */}
      <div className="loop-selector-compact relative" ref={dropdownRef}>
        <div 
          className={`flex items-center gap-2 px-2 py-1 border rounded-full cursor-pointer transition-colors h-5 ${
            loopEnabled 
              ? 'bg-slate-800 border-slate-600 hover:border-slate-500' 
              : 'bg-slate-800/50 border-slate-700 opacity-50'
          }`}
          onClick={() => loopEnabled && setDropdownOpen(!dropdownOpen)}
        >
          <span 
            className={`loop-arrow text-xs cursor-pointer select-none transition-colors ${
              loopEnabled ? 'text-slate-500 hover:text-slate-400' : 'text-slate-600'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (loopEnabled) handleLoopDecrease();
            }}
          >◀</span>
          <span className={`text-xs font-semibold min-w-[20px] text-center ${
            loopEnabled ? 'text-slate-200' : 'text-slate-500'
          }`}>
            {loopLength === 0.125 ? '1/8' : loopLength < 1 ? `${loopLength * 4}/4` : loopLength}
          </span>
          <span 
            className={`loop-arrow text-xs cursor-pointer select-none transition-colors ${
              loopEnabled ? 'text-slate-500 hover:text-slate-400' : 'text-slate-600'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (loopEnabled) handleLoopIncrease();
            }}
          >▶</span>
        </div>
        
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

      {/* 🎵 Section Selector (for songs only) */}
      {isSong && numberOfSections > 1 && loopEnabled && (
        <div className="section-selector flex items-center gap-1">
          {Array.from({ length: Math.min(numberOfSections, 12) }, (_, i) => (
            <button
              key={i}
              onClick={() => onSectionPositionChange?.(i)}
              className={`section-button px-1.5 py-0.5 rounded text-[10px] font-semibold min-w-[18px] transition-all ${
                sectionLoopPosition === i
                  ? 'bg-[#81E4F2] text-slate-900 shadow-sm shadow-[#81E4F2]/50'
                  : 'border border-slate-600 text-slate-400 hover:border-[#81E4F2] hover:text-[#81E4F2] hover:bg-slate-700'
              }`}
              title={`Loop section ${i + 1}`}
            >
              {i + 1}
            </button>
          ))}
          {numberOfSections > 12 && (
            <span className="text-[10px] text-slate-500">+{numberOfSections - 12}</span>
          )}
        </div>
      )}
    </div>
  );
});

export default LoopControlsCompact;