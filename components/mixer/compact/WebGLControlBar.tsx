"use client"

import React, { memo, useCallback } from 'react'
import { WebGLEffectType } from './WebGLVideoDisplay'

export type CrossfadeMode = 'slide' | 'blend' | 'cut'

interface WebGLControlBarProps {
  crossfadeMode: CrossfadeMode
  onCrossfadeModeChange: (mode: CrossfadeMode) => void
  activeEffect: WebGLEffectType
  onEffectChange: (effect: WebGLEffectType) => void
  onOpenSettings: () => void
}

const WebGLControlBar = memo(function WebGLControlBar({
  crossfadeMode,
  onCrossfadeModeChange,
  activeEffect,
  onEffectChange,
  onOpenSettings
}: WebGLControlBarProps) {

  const handleEffectToggle = useCallback((effectType: WebGLEffectType) => {
    if (activeEffect === effectType) {
      onEffectChange(null)
    } else {
      onEffectChange(effectType)
      // Auto-open settings panel when effect is turned on
      onOpenSettings()
    }
  }, [activeEffect, onEffectChange, onOpenSettings])

  return (
    <div
      className="bg-black/90 backdrop-blur-sm px-4 py-3 rounded-b-lg"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-center">
        {/* FX Section - Mix mode removed, defaulting to blend */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase text-white/90">FX:</span>
          <div className="flex gap-3">
            {/* VHS - Pink */}
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={() => handleEffectToggle('vhs')}
                className="relative overflow-hidden transition-all active:scale-95"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '5px',
                  backgroundColor: '#000000',
                  boxShadow: activeEffect === 'vhs' ? '0 0 10px rgba(236, 132, 243, 0.5)' : 'none'
                }}
                title="VHS Glitch - Click to toggle"
              >
                <div
                  className="absolute inset-0 transition-opacity duration-200"
                  style={{
                    background: 'radial-gradient(circle at center, #FFFFFF 0%, #F3C2F7 30%, #EC84F3 100%)',
                    opacity: activeEffect === 'vhs' ? 1 : 0.65
                  }}
                />
              </button>
              <span className="text-[7px] font-bold uppercase text-slate-500">VHS</span>
            </div>

            {/* ASCII - Orange */}
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={() => handleEffectToggle('ascii')}
                className="relative overflow-hidden transition-all active:scale-95"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '5px',
                  backgroundColor: '#000000',
                  boxShadow: activeEffect === 'ascii' ? '0 0 10px rgba(255, 171, 107, 0.5)' : 'none'
                }}
                title="ASCII - Click to toggle"
              >
                <div
                  className="absolute inset-0 transition-opacity duration-200"
                  style={{
                    background: 'radial-gradient(circle at center, #FFFFFF 0%, #FFD4A3 30%, #FFAB6B 100%)',
                    opacity: activeEffect === 'ascii' ? 1 : 0.65
                  }}
                />
              </button>
              <span className="text-[7px] font-bold uppercase text-slate-500">ASCII</span>
            </div>

            {/* Dither - Yellow */}
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={() => handleEffectToggle('dither')}
                className="relative overflow-hidden transition-all active:scale-95"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '5px',
                  backgroundColor: '#000000',
                  boxShadow: activeEffect === 'dither' ? '0 0 10px rgba(255, 230, 107, 0.5)' : 'none'
                }}
                title="Dither - Click to toggle"
              >
                <div
                  className="absolute inset-0 transition-opacity duration-200"
                  style={{
                    background: 'radial-gradient(circle at center, #FFFFFF 0%, #FFF9A3 30%, #FFE66B 100%)',
                    opacity: activeEffect === 'dither' ? 1 : 0.65
                  }}
                />
              </button>
              <span className="text-[7px] font-bold uppercase text-slate-500">DTHR</span>
            </div>

            {/* Halftone - Green */}
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={() => handleEffectToggle('halftone')}
                className="relative overflow-hidden transition-all active:scale-95"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '5px',
                  backgroundColor: '#000000',
                  boxShadow: activeEffect === 'halftone' ? '0 0 10px rgba(107, 255, 170, 0.5)' : 'none'
                }}
                title="Halftone - Click to toggle"
              >
                <div
                  className="absolute inset-0 transition-opacity duration-200"
                  style={{
                    background: 'radial-gradient(circle at center, #FFFFFF 0%, #A3FFB8 30%, #6BFFAA 100%)',
                    opacity: activeEffect === 'halftone' ? 1 : 0.65
                  }}
                />
              </button>
              <span className="text-[7px] font-bold uppercase text-slate-500">HALF</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default WebGLControlBar
