"use client";

import React, { useState, useEffect, useRef, memo } from 'react';
import { Repeat } from 'lucide-react';

interface TransportControlsProps {
  isPlaying: boolean;
  loopLength: number;
  loopEnabled: boolean; // 🔄 NEW: Independent loop enabled state
  deck: 'A' | 'B';
  onPlayPause: () => void;
  onRestart: () => void;
  onLoopChange: (length: number) => void;
  onLoopToggle: () => void; // 🔄 NEW: Toggle loop on/off
  className?: string;
}

const TransportControls = memo(function TransportControls({
  isPlaying,
  loopLength,
  loopEnabled,
  deck,
  onPlayPause,
  onRestart,
  onLoopChange,
  onLoopToggle,
  className = ""
}: TransportControlsProps) {
  const loopOptions = [0.125, 0.25, 0.5, 1, 2, 4, 8];
  const [dropdownOpen, setDropdownOpen] = useState(false); // 🔄 NEW: Click-based dropdown
  const dropdownRef = useRef<HTMLDivElement>(null); // 🔄 NEW: For outside click detection

  // 🔄 NEW: Close dropdown when clicking outside
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

  // FX button removed - FX are always in the chain, controlled by power buttons

  const loopControls = (
    <div className="loop-controls-container flex items-center gap-2">
      {/* Loop Toggle Button */}
      <button
        onClick={onLoopToggle}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 ${
          loopEnabled
            ? 'bg-cyan-400 border-cyan-400 text-slate-900 shadow-lg shadow-cyan-400/50'
            : 'border border-slate-600 text-slate-500 hover:border-slate-500 hover:text-slate-400'
        }`}
        title={loopEnabled ? 'Disable Loop' : 'Enable Loop'}
      >
        <Repeat size={16} className={`transition-colors ${
          loopEnabled ? 'text-slate-900' : 'text-slate-500'
        }`} />
      </button>

      {/* Loop Length Selector */}
      <div className="loop-selector-compact relative" ref={dropdownRef}>
        <div 
          className={`flex items-center gap-3 px-3 py-1.5 border rounded-full cursor-pointer transition-colors h-9 ${
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
          <span className={`text-sm font-semibold min-w-[24px] text-center ${
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
                  className={`px-2 py-1 rounded text-xs transition-all min-w-[24px] hover:scale-105 ${
                    loopLength === option
                      ? 'bg-cyan-400 text-slate-900 shadow-sm shadow-cyan-400/50'
                      : 'border border-slate-600 text-slate-400 hover:border-cyan-400 hover:text-cyan-300 hover:bg-slate-700'
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

  const restartButton = (
    <button 
      onClick={onRestart}
      className="w-12 h-12 border border-slate-600 text-slate-400 rounded-full hover:border-slate-500 hover:text-slate-300 transition-all hover:scale-105 flex items-center justify-center"
    >
      ⏮
    </button>
  );

  const playButton = (
    <button 
      onClick={onPlayPause}
      className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all ${
        isPlaying 
          ? 'bg-cyan-400 border-cyan-400 text-slate-900 shadow-lg shadow-cyan-400/50' 
          : 'border border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
      }`}
    >
      {isPlaying ? '⏸' : '▶'}
    </button>
  );

  return (
    <div className={`flex gap-4 items-center ${className}`}>
      {deck === 'A' ? (
        <>
          {restartButton}
          {playButton}
          {loopControls}
        </>
      ) : (
        <>
          {loopControls}
          {playButton}
          {restartButton}
        </>
      )}
    </div>
  );
});

export default TransportControls; 