"use client";

import React from 'react';

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
    <div
      className="bg-black/90 backdrop-blur-sm px-4 py-3 rounded-b-lg"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-center gap-6">
        {/* Mix Mode Section */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase text-white/90">MIX:</span>
          <div className="flex gap-1">
            <button
              onClick={() => onCrossfadeModeChange('slide')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-all border ${
                crossfadeMode === 'slide'
                  ? 'bg-[#81E4F2]/10 text-[#81E4F2] border-[#81E4F2]/40 shadow-sm shadow-[#81E4F2]/20'
                  : 'bg-slate-700/40 text-slate-400 border-transparent hover:bg-slate-600/50'
              }`}
            >
              SLIDE
            </button>
            <button
              onClick={() => onCrossfadeModeChange('blend')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-all border ${
                crossfadeMode === 'blend'
                  ? 'bg-[#81E4F2]/10 text-[#81E4F2] border-[#81E4F2]/40 shadow-sm shadow-[#81E4F2]/20'
                  : 'bg-slate-700/40 text-slate-400 border-transparent hover:bg-slate-600/50'
              }`}
            >
              BLEND
            </button>
            <button
              onClick={() => onCrossfadeModeChange('cut')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-all border ${
                crossfadeMode === 'cut'
                  ? 'bg-[#81E4F2]/10 text-[#81E4F2] border-[#81E4F2]/40 shadow-sm shadow-[#81E4F2]/20'
                  : 'bg-slate-700/40 text-slate-400 border-transparent hover:bg-slate-600/50'
              }`}
            >
              CUT
            </button>
          </div>
        </div>

        {/* FX Section */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase text-white/90">FX:</span>
          <div className="flex gap-2">
            {/* Color Shift - Pink */}
            <button
              onPointerDown={() => onEffectStart('colorShift')}
              onPointerUp={onEffectStop}
              onPointerLeave={onEffectStop}
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
                  opacity: activeEffect === 'colorShift' ? 1 : 0.65
                }}
              />
            </button>

            {/* Pixelate - Orange */}
            <button
              onPointerDown={() => onEffectStart('pixelate')}
              onPointerUp={onEffectStop}
              onPointerLeave={onEffectStop}
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
                  opacity: activeEffect === 'pixelate' ? 1 : 0.65
                }}
              />
            </button>

            {/* Invert - Yellow */}
            <button
              onPointerDown={() => onEffectStart('invert')}
              onPointerUp={onEffectStop}
              onPointerLeave={onEffectStop}
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
                  opacity: activeEffect === 'invert' ? 1 : 0.65
                }}
              />
            </button>

            {/* Mirror - Green */}
            <button
              onPointerDown={() => onEffectStart('mirror')}
              onPointerUp={onEffectStop}
              onPointerLeave={onEffectStop}
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
                  opacity: activeEffect === 'mirror' ? 1 : 0.65
                }}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
