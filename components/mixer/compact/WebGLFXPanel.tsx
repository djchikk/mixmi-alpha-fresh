"use client"

import React, { memo, useCallback } from 'react'
import { X, Tv, Type, Grid2x2, Waves } from 'lucide-react'
import { WebGLEffectType } from './WebGLVideoDisplay'

export type CrossfadeMode = 'slide' | 'blend' | 'cut'

interface WebGLFXPanelProps {
  isOpen: boolean
  onClose: () => void
  crossfadeMode: CrossfadeMode
  onCrossfadeModeChange: (mode: CrossfadeMode) => void
  activeEffect: WebGLEffectType
  onEffectChange: (effect: WebGLEffectType) => void
  intensity: number
  onIntensityChange: (value: number) => void
  granularity: number
  onGranularityChange: (value: number) => void
  wetDry: number
  onWetDryChange: (value: number) => void
  audioReactive: boolean
  onAudioReactiveChange: (enabled: boolean) => void
  className?: string
}

type EffectButtonType = 'vhs' | 'ascii' | 'dither'

const WebGLFXPanel = memo(function WebGLFXPanel({
  isOpen,
  onClose,
  crossfadeMode,
  onCrossfadeModeChange,
  activeEffect,
  onEffectChange,
  intensity,
  onIntensityChange,
  granularity,
  onGranularityChange,
  wetDry,
  onWetDryChange,
  audioReactive,
  onAudioReactiveChange,
  className = ''
}: WebGLFXPanelProps) {

  // Simple toggle behavior: click to turn on, click again to turn off
  const handleEffectToggle = useCallback((effectType: EffectButtonType) => {
    if (activeEffect === effectType) {
      // Already active - turn off
      onEffectChange(null)
    } else {
      // Turn on this effect (turns off any other)
      onEffectChange(effectType)
    }
  }, [activeEffect, onEffectChange])

  const handleReactiveToggle = useCallback(() => {
    const newReactive = !audioReactive
    onAudioReactiveChange(newReactive)

    // If turning on reactive with no effect active, default to VHS
    if (newReactive && !activeEffect) {
      onEffectChange('vhs')
    }
  }, [audioReactive, activeEffect, onAudioReactiveChange, onEffectChange])

  if (!isOpen) return null

  const currentEffect = activeEffect
  const showControls = currentEffect !== null

  return (
    <div className={`webgl-fx-panel bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden flex flex-col ${className}`}>
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

      {/* 2x2 Effect Buttons Grid */}
      <div className="p-2.5">
        <div className="grid grid-cols-2 gap-1.5" style={{ height: '80px' }}>
          {/* VHS Glitch - Pink */}
          <button
            onClick={() => handleEffectToggle('vhs')}
            className={`group relative flex flex-col items-center justify-center bg-slate-800 border-2 rounded-lg transition-all ${
              currentEffect === 'vhs'
                ? 'border-pink-400 bg-pink-900/50 shadow-lg shadow-pink-500/50'
                : 'border-pink-400/30 hover:border-pink-400 hover:bg-slate-700 active:scale-95'
            }`}
            title="VHS Glitch - Click to toggle"
          >
            <Tv size={16} className="text-pink-400 mb-1" />
            <div className="text-[8px] font-bold uppercase text-slate-300">VHS</div>
          </button>

          {/* ASCII - Orange */}
          <button
            onClick={() => handleEffectToggle('ascii')}
            className={`group relative flex flex-col items-center justify-center bg-slate-800 border-2 rounded-lg transition-all ${
              currentEffect === 'ascii'
                ? 'border-orange-400 bg-orange-900/50 shadow-lg shadow-orange-500/50'
                : 'border-orange-400/30 hover:border-orange-400 hover:bg-slate-700 active:scale-95'
            }`}
            title="ASCII - Click to toggle"
          >
            <Type size={16} className="text-orange-400 mb-1" />
            <div className="text-[8px] font-bold uppercase text-slate-300">ASCII</div>
          </button>

          {/* Dither - Yellow */}
          <button
            onClick={() => handleEffectToggle('dither')}
            className={`group relative flex flex-col items-center justify-center bg-slate-800 border-2 rounded-lg transition-all ${
              currentEffect === 'dither'
                ? 'border-yellow-400 bg-yellow-900/50 shadow-lg shadow-yellow-500/50'
                : 'border-yellow-400/30 hover:border-yellow-400 hover:bg-slate-700 active:scale-95'
            }`}
            title="Dither - Click to toggle"
          >
            <Grid2x2 size={16} className="text-yellow-400 mb-1" />
            <div className="text-[8px] font-bold uppercase text-slate-300">Dither</div>
          </button>

          {/* Audio Reactive - Green (Modifier) */}
          <button
            onClick={handleReactiveToggle}
            className={`group relative flex flex-col items-center justify-center bg-slate-800 border-2 rounded-lg transition-all ${
              audioReactive
                ? 'border-green-400 bg-green-900/50 scale-95 shadow-lg shadow-green-500/50'
                : 'border-green-400/30 hover:border-green-400 hover:bg-slate-700 active:scale-95'
            }`}
            title="Audio Reactive - Toggle to make effects respond to music"
          >
            <Waves size={16} className="text-green-400 mb-1" />
            <div className="text-[8px] font-bold uppercase text-slate-300">React</div>
            {audioReactive && (
              <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Universal Controls - Only show when effect is active */}
      {showControls && (
        <div className="border-t border-slate-700 px-2.5 py-2 space-y-2">
          {/* Intensity */}
          <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
            <span className="text-[8px] font-bold uppercase text-slate-400 w-16">Intensity</span>
            <input
              type="range"
              min="0"
              max="100"
              value={intensity * 100}
              onChange={(e) => onIntensityChange(Number(e.target.value) / 100)}
              className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <span className="text-[8px] font-mono text-slate-400 w-8 text-right">
              {Math.round(intensity * 100)}%
            </span>
          </div>

          {/* Granularity */}
          <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
            <span className="text-[8px] font-bold uppercase text-slate-400 w-16">Grain</span>
            <input
              type="range"
              min="0"
              max="100"
              value={granularity * 100}
              onChange={(e) => onGranularityChange(Number(e.target.value) / 100)}
              className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <span className="text-[8px] font-mono text-slate-400 w-8 text-right">
              {Math.round(granularity * 100)}%
            </span>
          </div>

          {/* Wet/Dry */}
          <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
            <span className="text-[8px] font-bold uppercase text-slate-400 w-16">Wet/Dry</span>
            <input
              type="range"
              min="0"
              max="100"
              value={wetDry * 100}
              onChange={(e) => onWetDryChange(Number(e.target.value) / 100)}
              className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <span className="text-[8px] font-mono text-slate-400 w-8 text-right">
              {Math.round(wetDry * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
})

export default WebGLFXPanel
