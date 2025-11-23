"use client";

import React, { memo, useState, useRef } from 'react';
import { X } from 'lucide-react';

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
    <div className={`deck-fx-panel bg-black/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-2xl ${className}`}>
      {/* Compact vertical layout */}
      <div className="flex flex-col gap-2">
        {/* FX Buttons with gradients and labels - matching video FX colors */}
        <div className="flex justify-center gap-2">
          {/* Echo Out - Pink (like video colorShift) */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              onPointerDown={() => handleEffectStart('echoOut')}
              onPointerUp={handleEffectStop}
              onPointerLeave={handleEffectStop}
              className="relative overflow-hidden transition-all"
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                backgroundColor: '#000000'
              }}
            >
              <div
                className="absolute inset-0 transition-opacity duration-200"
                style={{
                  background: 'radial-gradient(circle at center, #FFFFFF 0%, #F3C2F7 30%, #EC84F3 100%)',
                  opacity: activeEffect === 'echoOut' ? 1 : 0.65
                }}
              />
            </button>
            <span className="text-[8px] font-bold uppercase text-slate-400">ECHO</span>
          </div>

          {/* Filter Sweep - Orange (like video pixelate) */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              onPointerDown={() => handleEffectStart('filterSweep')}
              onPointerUp={handleEffectStop}
              onPointerLeave={handleEffectStop}
              className="relative overflow-hidden transition-all"
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                backgroundColor: '#000000'
              }}
            >
              <div
                className="absolute inset-0 transition-opacity duration-200"
                style={{
                  background: 'radial-gradient(circle at center, #FFFFFF 0%, #FFD4A3 30%, #FFAB6B 100%)',
                  opacity: activeEffect === 'filterSweep' ? 1 : 0.65
                }}
              />
            </button>
            <span className="text-[8px] font-bold uppercase text-slate-400">FLTR</span>
          </div>

          {/* Flanger - Yellow (like video invert) */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              onPointerDown={() => handleEffectStart('reverb')}
              onPointerUp={handleEffectStop}
              onPointerLeave={handleEffectStop}
              className="relative overflow-hidden transition-all"
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                backgroundColor: '#000000'
              }}
            >
              <div
                className="absolute inset-0 transition-opacity duration-200"
                style={{
                  background: 'radial-gradient(circle at center, #FFFFFF 0%, #FFF9A3 30%, #FFE66B 100%)',
                  opacity: activeEffect === 'reverb' ? 1 : 0.65
                }}
              />
            </button>
            <span className="text-[8px] font-bold uppercase text-slate-400">FLNG</span>
          </div>

          {/* Brake - Green (like video mirror) */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              onPointerDown={() => handleEffectStart('brake')}
              onPointerUp={handleEffectStop}
              onPointerLeave={handleEffectStop}
              className="relative overflow-hidden transition-all"
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                backgroundColor: '#000000'
              }}
            >
              <div
                className="absolute inset-0 transition-opacity duration-200"
                style={{
                  background: 'radial-gradient(circle at center, #FFFFFF 0%, #A3FFB8 30%, #6BFFAA 100%)',
                  opacity: activeEffect === 'brake' ? 1 : 0.65
                }}
              />
            </button>
            <span className="text-[8px] font-bold uppercase text-slate-400">BRK</span>
          </div>
        </div>

        {/* LO CUT / HI CUT buttons - single line, wider */}
        <div className="flex justify-center gap-2">
          <button
            onClick={onLoCutToggle}
            className={`px-3 py-0.5 rounded-md text-[10px] font-bold uppercase transition-all whitespace-nowrap border ${
              loCutEnabled
                ? 'bg-[#81E4F2]/10 text-[#81E4F2] border-[#81E4F2]/40 shadow-sm shadow-[#81E4F2]/20'
                : 'bg-slate-800/50 text-slate-400 border-transparent hover:bg-slate-700'
            }`}
            title="Low Cut Filter (removes bass)"
          >
            LO CUT
          </button>
          <button
            onClick={onHiCutToggle}
            className={`px-3 py-0.5 rounded-md text-[10px] font-bold uppercase transition-all whitespace-nowrap border ${
              hiCutEnabled
                ? 'bg-[#81E4F2]/10 text-[#81E4F2] border-[#81E4F2]/40 shadow-sm shadow-[#81E4F2]/20'
                : 'bg-slate-800/50 text-slate-400 border-transparent hover:bg-slate-700'
            }`}
            title="High Cut Filter (removes highs)"
          >
            HI CUT
          </button>
        </div>
      </div>
    </div>
  );
});

export default DeckFXPanel;
