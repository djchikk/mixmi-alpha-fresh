"use client";

import React, { memo } from 'react';
import { X } from 'lucide-react';

interface DeckFXPanelProps {
  deck: 'A' | 'B';
  isOpen: boolean;
  onClose: () => void;

  // Hi/Lo Cut controls
  hiCutEnabled: boolean;
  loCutEnabled: boolean;
  onHiCutToggle: () => void;
  onLoCutToggle: () => void;

  // Pitch control
  pitchCents: number;
  onPitchChange: (cents: number) => void;
  onApplyPitch: () => void;
  isPitchProcessing: boolean;

  className?: string;
}

const DeckFXPanel = memo(function DeckFXPanel({
  deck,
  isOpen,
  onClose,
  hiCutEnabled,
  loCutEnabled,
  onHiCutToggle,
  onLoCutToggle,
  pitchCents,
  onPitchChange,
  onApplyPitch,
  isPitchProcessing,
  className = ''
}: DeckFXPanelProps) {
  if (!isOpen) return null;

  const color = deck === 'A' ? '#81E4F2' : '#60A5FA'; // Cyan for A, Blue for B
  const semitones = (pitchCents / 100).toFixed(1);
  const displayValue = pitchCents >= 0 ? `+${semitones}` : semitones;

  return (
    <div className={`deck-fx-panel bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border-b border-slate-700">
        <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
          Deck {deck} FX
        </h3>
        <button
          onClick={onClose}
          className="p-0.5 hover:bg-slate-700 rounded transition-colors"
          title="Close"
        >
          <X size={12} className="text-slate-400" />
        </button>
      </div>

      {/* Panel Content */}
      <div className="p-2.5">

          {/* Filters Section */}
          <div className="mb-3">
            <div className="text-[8px] text-slate-500 uppercase tracking-wider mb-1.5">Filters</div>
            <div className="flex gap-1.5">
              <button
                onClick={onHiCutToggle}
                className={`flex-1 px-2 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
                  hiCutEnabled
                    ? 'bg-gradient-to-b from-orange-500 to-red-500 text-white shadow-lg'
                    : 'bg-slate-800 border border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                HI CUT
              </button>
              <button
                onClick={onLoCutToggle}
                className={`flex-1 px-2 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
                  loCutEnabled
                    ? 'bg-gradient-to-b from-blue-500 to-purple-500 text-white shadow-lg'
                    : 'bg-slate-800 border border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                LO CUT
              </button>
            </div>
          </div>

          {/* Pitch Shift Section */}
          <div>
            <div className="text-[8px] text-slate-500 uppercase tracking-wider mb-1.5">Pitch Shift</div>

            {/* Pitch Slider */}
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex-1 relative">
                <input
                  type="range"
                  min="-1200"
                  max="1200"
                  step="50"
                  value={pitchCents}
                  onChange={(e) => onPitchChange(Number(e.target.value))}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-2.5
                    [&::-webkit-slider-thumb]:h-2.5
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-current
                    [&::-moz-range-thumb]:w-2.5
                    [&::-moz-range-thumb]:h-2.5
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-current
                    [&::-moz-range-thumb]:border-0"
                  style={{ color }}
                />
                {/* Center marker */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[1px] h-2.5 bg-slate-600 pointer-events-none" />
              </div>

              {/* Display Value */}
              <div className="text-xs font-mono font-bold min-w-[50px] text-right" style={{ color }}>
                {displayValue} st
              </div>
            </div>

            {/* Apply Button */}
            <button
              onClick={onApplyPitch}
              disabled={isPitchProcessing || pitchCents === 0}
              className={`w-full px-2 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
                isPitchProcessing
                  ? 'bg-slate-700 text-slate-500 cursor-wait'
                  : pitchCents === 0
                  ? 'bg-slate-800 border border-slate-700 text-slate-600 cursor-not-allowed'
                  : 'border-2 text-white hover:shadow-lg'
              }`}
              style={
                !isPitchProcessing && pitchCents !== 0
                  ? { borderColor: color, backgroundColor: `${color}20` }
                  : undefined
              }
            >
              {isPitchProcessing ? 'PROCESSING...' : pitchCents === 0 ? 'NO CHANGE' : 'APPLY PITCH SHIFT'}
            </button>

            {/* Info Text */}
            <div className="mt-1.5 text-[7px] text-slate-500 text-center leading-tight">
              Pitch shift will be applied to the audio buffer without affecting timing
            </div>
          </div>
      </div>
    </div>
  );
});

export default DeckFXPanel;
