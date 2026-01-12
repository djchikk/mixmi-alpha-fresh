"use client"

import React, { memo, useCallback } from 'react'
import { WebGLEffectType } from './WebGLVideoDisplay'

export type CrossfadeMode = 'slide' | 'blend' | 'cut'

interface WebGLControlBarProps {
  crossfadeMode: CrossfadeMode
  onCrossfadeModeChange: (mode: CrossfadeMode) => void
  activeEffect: WebGLEffectType
  onEffectChange: (effect: WebGLEffectType) => void
  audioReactive: boolean
  onAudioReactiveChange: (enabled: boolean) => void
  audioLevel: number // 0-1 for VU meter
  onOpenSettings: () => void
}

const WebGLControlBar = memo(function WebGLControlBar({
  crossfadeMode,
  onCrossfadeModeChange,
  activeEffect,
  onEffectChange,
  audioReactive,
  onAudioReactiveChange,
  audioLevel,
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

  const handleReactiveToggle = useCallback(() => {
    const newReactive = !audioReactive
    onAudioReactiveChange(newReactive)
    if (newReactive && !activeEffect) {
      onEffectChange('vhs')
    }
  }, [audioReactive, activeEffect, onAudioReactiveChange, onEffectChange])

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
            {(['slide', 'blend', 'cut'] as CrossfadeMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onCrossfadeModeChange(mode)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition-all border ${
                  crossfadeMode === mode
                    ? 'bg-[#81E4F2]/10 text-[#81E4F2] border-[#81E4F2]/40 shadow-sm shadow-[#81E4F2]/20'
                    : 'bg-slate-700/40 text-slate-400 border-transparent hover:bg-slate-600/50'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* FX Section */}
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

            {/* Dither - Yellow-green */}
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

            {/* Audio Reactive - Green with VU Meter on right */}
            <div className="flex flex-col items-center gap-0.5 relative">
              <button
                onClick={handleReactiveToggle}
                className="relative overflow-hidden transition-all active:scale-95"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '5px',
                  backgroundColor: '#000000',
                  boxShadow: audioReactive ? '0 0 10px rgba(107, 255, 170, 0.5)' : 'none'
                }}
                title="Audio Reactive - Click to toggle"
              >
                <div
                  className="absolute inset-0 transition-opacity duration-200"
                  style={{
                    background: 'radial-gradient(circle at center, #FFFFFF 0%, #A3FFB8 30%, #6BFFAA 100%)',
                    opacity: audioReactive ? 1 : 0.65
                  }}
                />
              </button>
              <span className="text-[7px] font-bold uppercase text-slate-500">REACT</span>
              {/* Vertical VU Meter - absolutely positioned to the right */}
              {audioReactive && (
                <div className="absolute left-full top-0 ml-1 flex flex-col-reverse gap-0.5 h-7">
                  {Array.from({ length: 8 }).map((_, i) => {
                    const threshold = (i + 1) / 8
                    const isActive = audioLevel >= threshold
                    // Green for low, yellow for mid, red for high
                    let color = 'bg-emerald-500'
                    if (i >= 6) color = 'bg-red-500'
                    else if (i >= 4) color = 'bg-yellow-500'

                    return (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-sm transition-all duration-75 ${
                          isActive ? color : 'bg-slate-700/50'
                        }`}
                        style={{
                          opacity: isActive ? 1 : 0.3,
                          boxShadow: isActive && i >= 6 ? '0 0 3px rgba(239, 68, 68, 0.6)' :
                                     isActive && i >= 4 ? '0 0 3px rgba(234, 179, 8, 0.4)' :
                                     isActive ? '0 0 3px rgba(16, 185, 129, 0.4)' : 'none'
                        }}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default WebGLControlBar
