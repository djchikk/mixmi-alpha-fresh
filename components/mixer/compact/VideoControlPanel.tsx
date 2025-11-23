"use client";

import React from 'react';
import { Palette, Grid3x3, FlipHorizontal, Wind } from 'lucide-react';

export type CrossfadeMode = 'slide' | 'blend' | 'cut';
type VideoFXType = 'colorShift' | 'pixelate' | 'invert' | 'mirror';

interface VideoControlPanelProps {
  crossfadeMode: CrossfadeMode;
  onCrossfadeModeChange: (mode: CrossfadeMode) => void;
  onTriggerFX: (fxType: VideoFXType, intensity: number) => void;
  activeEffect: VideoFXType | null;
  onEffectStart: (fxType: VideoFXType) => void;
  onEffectStop: () => void;
}

export default function VideoControlPanel({
  crossfadeMode,
  onCrossfadeModeChange,
  onTriggerFX,
  activeEffect,
  onEffectStart,
  onEffectStop
}: VideoControlPanelProps) {
  return (
    <div className="bg-slate-900/95 backdrop-blur-sm border-t border-slate-700/50 px-4 py-2 rounded-b-lg">
      <div className="flex items-center justify-center gap-6">
        {/* Mix Mode Section */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase text-slate-400">MIX:</span>
          <div className="flex gap-1">
            <button
              onClick={() => onCrossfadeModeChange('slide')}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                crossfadeMode === 'slide'
                  ? 'bg-cyan-500 text-slate-900 shadow-lg shadow-cyan-500/50'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-cyan-400'
              }`}
            >
              SLIDE
            </button>
            <button
              onClick={() => onCrossfadeModeChange('blend')}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                crossfadeMode === 'blend'
                  ? 'bg-cyan-500 text-slate-900 shadow-lg shadow-cyan-500/50'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-cyan-400'
              }`}
            >
              BLEND
            </button>
            <button
              onClick={() => onCrossfadeModeChange('cut')}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                crossfadeMode === 'cut'
                  ? 'bg-cyan-500 text-slate-900 shadow-lg shadow-cyan-500/50'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-cyan-400'
              }`}
            >
              CUT
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-600/50" />

        {/* FX Section */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase text-slate-400">FX:</span>
          <div className="flex gap-1">
            {/* Color Shift */}
            <button
              onPointerDown={() => onEffectStart('colorShift')}
              onPointerUp={onEffectStop}
              onPointerLeave={onEffectStop}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 ${
                activeEffect === 'colorShift'
                  ? 'bg-pink-500 text-white scale-95 shadow-lg shadow-pink-500/50'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-pink-400'
              }`}
            >
              <Palette size={12} />
              COLOR
            </button>

            {/* Pixelate */}
            <button
              onPointerDown={() => onEffectStart('pixelate')}
              onPointerUp={onEffectStop}
              onPointerLeave={onEffectStop}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 ${
                activeEffect === 'pixelate'
                  ? 'bg-cyan-500 text-white scale-95 shadow-lg shadow-cyan-500/50'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-cyan-400'
              }`}
            >
              <Grid3x3 size={12} />
              PIXEL
            </button>

            {/* Invert */}
            <button
              onPointerDown={() => onEffectStart('invert')}
              onPointerUp={onEffectStop}
              onPointerLeave={onEffectStop}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 ${
                activeEffect === 'invert'
                  ? 'bg-purple-500 text-white scale-95 shadow-lg shadow-purple-500/50'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-purple-400'
              }`}
            >
              <Wind size={12} />
              INVERT
            </button>

            {/* Mirror */}
            <button
              onPointerDown={() => onEffectStart('mirror')}
              onPointerUp={onEffectStop}
              onPointerLeave={onEffectStop}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 ${
                activeEffect === 'mirror'
                  ? 'bg-green-500 text-white scale-95 shadow-lg shadow-green-500/50'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-green-400'
              }`}
            >
              <FlipHorizontal size={12} />
              MIRROR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
