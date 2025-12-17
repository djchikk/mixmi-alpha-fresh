"use client";

import React, { memo, useState } from 'react';
import { X, Palette, Wind, Grid3x3, Circle } from 'lucide-react';

export type CrossfadeMode = 'slide' | 'blend' | 'cut';
type VideoFXType = 'colorShift' | 'pixelate' | 'invert' | 'bw';

interface VideoFXPanelProps {
  isOpen: boolean;
  onClose: () => void;
  crossfadeMode: CrossfadeMode;
  onCrossfadeModeChange: (mode: CrossfadeMode) => void;
  onTriggerFX: (fxType: VideoFXType, intensity: number) => void;
  className?: string;
}

const VideoFXPanel = memo(function VideoFXPanel({
  isOpen,
  onClose,
  crossfadeMode,
  onCrossfadeModeChange,
  onTriggerFX,
  className = ''
}: VideoFXPanelProps) {
  const [activeEffect, setActiveEffect] = useState<VideoFXType | null>(null);

  if (!isOpen) return null;

  const handleEffectStart = (fxType: VideoFXType) => {
    console.log(`🎥 Starting video effect: ${fxType}`);
    setActiveEffect(fxType);
    onTriggerFX(fxType, 1.0); // Full intensity for now
  };

  const handleEffectStop = () => {
    if (!activeEffect) return;
    console.log(`🎥 Stopping video effect: ${activeEffect}`);
    onTriggerFX(activeEffect, 0); // Reset to 0
    setActiveEffect(null);
  };

  return (
    <div className={`video-fx-panel bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden flex flex-col ${className}`}>
      {/* Panel Header with Crossfade Mode Selector */}
      <div className="flex items-center justify-between border-b border-slate-700 px-2 py-1.5 gap-2">
        {/* Crossfade Mode Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[7px] font-bold uppercase text-slate-400">Mix:</span>
          <select
            value={crossfadeMode}
            onChange={(e) => onCrossfadeModeChange(e.target.value as CrossfadeMode)}
            className="px-1.5 h-4 rounded text-[7px] font-bold uppercase bg-slate-800 border border-slate-600 text-slate-300 cursor-pointer hover:border-cyan-400 transition-all"
          >
            <option value="slide">SLIDE</option>
            <option value="blend">BLEND</option>
            <option value="cut">CUT</option>
          </select>
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
          {/* Color Shift */}
          <button
            onPointerDown={() => handleEffectStart('colorShift')}
            onPointerUp={handleEffectStop}
            onPointerLeave={handleEffectStop}
            className={`group relative flex flex-col items-center justify-center bg-slate-800 border-2 rounded-lg transition-all ${
              activeEffect === 'colorShift'
                ? 'border-pink-400 bg-pink-900 scale-95 shadow-lg shadow-pink-500/50'
                : 'border-slate-600 hover:border-pink-400 hover:bg-slate-700 active:scale-95'
            }`}
            style={{ borderColor: activeEffect === 'colorShift' ? '#f472b6' : 'rgba(244, 114, 182, 0.3)' }}
          >
            <Palette size={16} className="text-pink-400 mb-1" />
            <div className="text-[8px] font-bold uppercase text-slate-300">Color</div>
          </button>

          {/* Pixelate */}
          <button
            onPointerDown={() => handleEffectStart('pixelate')}
            onPointerUp={handleEffectStop}
            onPointerLeave={handleEffectStop}
            className={`group relative flex flex-col items-center justify-center bg-slate-800 border-2 rounded-lg transition-all ${
              activeEffect === 'pixelate'
                ? 'border-cyan-400 bg-cyan-900 scale-95 shadow-lg shadow-cyan-500/50'
                : 'border-slate-600 hover:border-cyan-400 hover:bg-slate-700 active:scale-95'
            }`}
            style={{ borderColor: activeEffect === 'pixelate' ? '#22d3ee' : 'rgba(34, 211, 238, 0.3)' }}
          >
            <Grid3x3 size={16} className="text-cyan-400 mb-1" />
            <div className="text-[8px] font-bold uppercase text-slate-300">Pixel</div>
          </button>

          {/* Invert */}
          <button
            onPointerDown={() => handleEffectStart('invert')}
            onPointerUp={handleEffectStop}
            onPointerLeave={handleEffectStop}
            className={`group relative flex flex-col items-center justify-center bg-slate-800 border-2 rounded-lg transition-all ${
              activeEffect === 'invert'
                ? 'border-purple-400 bg-purple-900 scale-95 shadow-lg shadow-purple-500/50'
                : 'border-slate-600 hover:border-purple-400 hover:bg-slate-700 active:scale-95'
            }`}
            style={{ borderColor: activeEffect === 'invert' ? '#c084fc' : 'rgba(192, 132, 252, 0.3)' }}
          >
            <Grid3x3 size={16} className="text-purple-400 mb-1" />
            <div className="text-[8px] font-bold uppercase text-slate-300">Invert</div>
          </button>

          {/* B&W Noir */}
          <button
            onPointerDown={() => handleEffectStart('bw')}
            onPointerUp={handleEffectStop}
            onPointerLeave={handleEffectStop}
            className={`group relative flex flex-col items-center justify-center bg-slate-800 border-2 rounded-lg transition-all ${
              activeEffect === 'bw'
                ? 'border-green-400 bg-green-900 scale-95 shadow-lg shadow-green-500/50'
                : 'border-slate-600 hover:border-green-400 hover:bg-slate-700 active:scale-95'
            }`}
            style={{ borderColor: activeEffect === 'bw' ? '#4ade80' : 'rgba(74, 222, 128, 0.3)' }}
          >
            <Circle size={16} className="text-green-400 mb-1" />
            <div className="text-[8px] font-bold uppercase text-slate-300">B&W</div>
          </button>
        </div>
      </div>
    </div>
  );
});

export default VideoFXPanel;
