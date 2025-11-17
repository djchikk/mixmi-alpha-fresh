"use client";

import React, { memo, useState, useRef } from 'react';
import { X, Repeat, Waves, AudioWaveform, CircleSlash } from 'lucide-react';

type InstantFXType = 'echoOut' | 'filterSweep' | 'reverb' | 'brake';

interface DeckFXPanelProps {
  deck: 'A' | 'B';
  isOpen: boolean;
  onClose: () => void;
  onTriggerFX: (fxType: InstantFXType) => void;
  hiCutEnabled: boolean;
  loCutEnabled: boolean;
  onHiCutToggle: () => void;
  onLoCutToggle: () => void;
  className?: string;
}

const DeckFXPanel = memo(function DeckFXPanel({
  deck,
  isOpen,
  onClose,
  onTriggerFX,
  hiCutEnabled,
  loCutEnabled,
  onHiCutToggle,
  onLoCutToggle,
  className = ''
}: DeckFXPanelProps) {
  const [activeEffect, setActiveEffect] = useState<InstantFXType | null>(null);
  const cleanupFnRef = useRef<(() => void) | null>(null);

  if (!isOpen) return null;

  const color = deck === 'A' ? '#81E4F2' : '#60A5FA'; // Cyan for A, Blue for B

  const handleEffectStart = (fxType: InstantFXType) => {
    // Don't start if another effect is already active
    if (activeEffect) return;

    console.log(`🎛️ Starting effect: ${fxType}`);
    setActiveEffect(fxType);

    // All effects now return cleanup functions for hold-to-activate
    const cleanup = (onTriggerFX as any)(fxType) as () => void;
    cleanupFnRef.current = cleanup;
  };

  const handleEffectStop = () => {
    if (!activeEffect) return;

    console.log(`🎛️ Stopping effect: ${activeEffect}`);

    // Call cleanup function if it exists
    if (cleanupFnRef.current) {
      cleanupFnRef.current();
      cleanupFnRef.current = null;
    }

    setActiveEffect(null);
  };

  return (
    <div className={`deck-fx-panel bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden flex flex-col ${className}`}>
      {/* Panel Header with EQ Filters */}
      <div className="flex items-center justify-between border-b border-slate-700 px-2 py-1.5 gap-1.5">
        {/* LO CUT and HI CUT buttons */}
        <div className="flex gap-1">
          <button
            onClick={onLoCutToggle}
            className={`px-1.5 h-4 rounded text-[7px] font-bold uppercase transition-all border ${
              loCutEnabled
                ? 'bg-slate-900 border-purple-500 text-purple-300 shadow-md shadow-purple-500/50'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-purple-400'
            }`}
            title="Low Cut Filter (removes bass)"
          >
            LO CUT
          </button>
          <button
            onClick={onHiCutToggle}
            className={`px-1.5 h-4 rounded text-[7px] font-bold uppercase transition-all border ${
              hiCutEnabled
                ? 'bg-slate-900 border-orange-500 text-orange-300 shadow-md shadow-orange-500/50'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-orange-400'
            }`}
            title="High Cut Filter (removes highs)"
          >
            HI CUT
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-red-400 transition-all"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>

      {/* 2x2 Effect Pads Grid */}
      <div className="flex-1 p-2.5">
        <div className="grid grid-cols-2 gap-1.5 h-full">
          {/* Echo Out */}
          <button
            onPointerDown={() => handleEffectStart('echoOut')}
            onPointerUp={handleEffectStop}
            onPointerLeave={handleEffectStop}
            className={`group relative flex flex-col items-center justify-center bg-slate-800 border-2 rounded-lg transition-all ${
              activeEffect === 'echoOut'
                ? 'border-cyan-400 bg-cyan-900 scale-95 shadow-lg shadow-cyan-500/50'
                : 'border-slate-600 hover:border-cyan-400 hover:bg-slate-700 active:scale-95'
            }`}
            style={{ borderColor: activeEffect === 'echoOut' ? '#22d3ee' : 'rgba(100, 200, 255, 0.3)' }}
          >
            <Repeat size={16} className="text-cyan-400 mb-1" />
            <div className="text-[8px] font-bold uppercase text-slate-300">Echo Out</div>
          </button>

          {/* Filter Sweep */}
          <button
            onPointerDown={() => handleEffectStart('filterSweep')}
            onPointerUp={handleEffectStop}
            onPointerLeave={handleEffectStop}
            className={`group relative flex flex-col items-center justify-center bg-slate-800 border-2 rounded-lg transition-all ${
              activeEffect === 'filterSweep'
                ? 'border-purple-400 bg-purple-900 scale-95 shadow-lg shadow-purple-500/50'
                : 'border-slate-600 hover:border-purple-400 hover:bg-slate-700 active:scale-95'
            }`}
            style={{ borderColor: activeEffect === 'filterSweep' ? '#c084fc' : 'rgba(168, 85, 247, 0.3)' }}
          >
            <Waves size={16} className="text-purple-400 mb-1" />
            <div className="text-[8px] font-bold uppercase text-slate-300">Filter</div>
          </button>

          {/* Flanger */}
          <button
            onPointerDown={() => handleEffectStart('reverb')}
            onPointerUp={handleEffectStop}
            onPointerLeave={handleEffectStop}
            className={`group relative flex flex-col items-center justify-center bg-slate-800 border-2 rounded-lg transition-all ${
              activeEffect === 'reverb'
                ? 'border-blue-400 bg-blue-900 scale-95 shadow-lg shadow-blue-500/50'
                : 'border-slate-600 hover:border-blue-400 hover:bg-slate-700 active:scale-95'
            }`}
            style={{ borderColor: activeEffect === 'reverb' ? '#60a5fa' : 'rgba(96, 165, 250, 0.3)' }}
          >
            <AudioWaveform size={16} className="text-blue-400 mb-1" />
            <div className="text-[8px] font-bold uppercase text-slate-300">Flanger</div>
          </button>

          {/* Brake */}
          <button
            onPointerDown={() => handleEffectStart('brake')}
            onPointerUp={handleEffectStop}
            onPointerLeave={handleEffectStop}
            className={`group relative flex flex-col items-center justify-center bg-slate-800 border-2 rounded-lg transition-all ${
              activeEffect === 'brake'
                ? 'border-red-400 bg-red-900 scale-95 shadow-lg shadow-red-500/50'
                : 'border-slate-600 hover:border-red-400 hover:bg-slate-700 active:scale-95'
            }`}
            style={{ borderColor: activeEffect === 'brake' ? '#f87171' : 'rgba(248, 113, 113, 0.3)' }}
          >
            <CircleSlash size={16} className="text-red-400 mb-1" />
            <div className="text-[8px] font-bold uppercase text-slate-300">Brake</div>
          </button>
        </div>
      </div>
    </div>
  );
});

export default DeckFXPanel;
