"use client"

import React, { memo, useCallback } from 'react'
import { X } from 'lucide-react'
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
  ditherColor: string
  onDitherColorChange: (color: string) => void
  ridiculousMode: boolean
  onRidiculousModeChange: (enabled: boolean) => void
  saturation: number
  onSaturationChange: (value: number) => void
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
  ditherColor,
  onDitherColorChange,
  ridiculousMode,
  onRidiculousModeChange,
  saturation,
  onSaturationChange,
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
    <div className={`webgl-fx-panel bg-black/90 backdrop-blur-sm rounded-lg shadow-2xl overflow-hidden flex flex-col ${className}`}>
      {/* Crossfade Mode Buttons - Pill style like the inspiration */}
      <div className="flex items-center justify-center gap-1 px-3 py-2 border-b border-slate-700/50">
        <span className="text-[9px] font-bold uppercase text-slate-500 mr-2">MIX:</span>
        {(['slide', 'blend', 'cut'] as CrossfadeMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => onCrossfadeModeChange(mode)}
            className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
              crossfadeMode === mode
                ? 'bg-[#81E4F2]/15 text-[#81E4F2] border border-[#81E4F2]/50'
                : 'bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-700/50'
            }`}
          >
            {mode}
          </button>
        ))}

        {/* Close button */}
        <button
          onClick={onClose}
          className="ml-2 text-slate-500 hover:text-red-400 transition-all"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* FX Buttons with Gradient Style */}
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-center gap-1 mb-2">
          <span className="text-[9px] font-bold uppercase text-slate-500 mr-2">FX:</span>

          {/* VHS - Pink gradient */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={() => handleEffectToggle('vhs')}
              className="relative overflow-hidden transition-all active:scale-95"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: '#000000',
                boxShadow: currentEffect === 'vhs' ? '0 0 12px rgba(236, 132, 243, 0.6)' : 'none'
              }}
            >
              <div
                className="absolute inset-0 transition-opacity duration-200"
                style={{
                  background: 'radial-gradient(circle at center, #FFFFFF 0%, #F3C2F7 30%, #EC84F3 100%)',
                  opacity: currentEffect === 'vhs' ? 1 : 0.5
                }}
              />
            </button>
            <span className="text-[7px] font-bold uppercase text-slate-500">VHS</span>
          </div>

          {/* ASCII - Orange gradient */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={() => handleEffectToggle('ascii')}
              className="relative overflow-hidden transition-all active:scale-95"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: '#000000',
                boxShadow: currentEffect === 'ascii' ? '0 0 12px rgba(255, 171, 107, 0.6)' : 'none'
              }}
            >
              <div
                className="absolute inset-0 transition-opacity duration-200"
                style={{
                  background: 'radial-gradient(circle at center, #FFFFFF 0%, #FFD4A3 30%, #FFAB6B 100%)',
                  opacity: currentEffect === 'ascii' ? 1 : 0.5
                }}
              />
            </button>
            <span className="text-[7px] font-bold uppercase text-slate-500">ASCII</span>
          </div>

          {/* Dither - Yellow-green gradient */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={() => handleEffectToggle('dither')}
              className="relative overflow-hidden transition-all active:scale-95"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: '#000000',
                boxShadow: currentEffect === 'dither' ? '0 0 12px rgba(200, 255, 107, 0.6)' : 'none'
              }}
            >
              <div
                className="absolute inset-0 transition-opacity duration-200"
                style={{
                  background: 'radial-gradient(circle at center, #FFFFFF 0%, #E8FFA3 30%, #C8FF6B 100%)',
                  opacity: currentEffect === 'dither' ? 1 : 0.5
                }}
              />
            </button>
            <span className="text-[7px] font-bold uppercase text-slate-500">DTHR</span>
          </div>

          {/* Audio Reactive - Green/Teal gradient */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={handleReactiveToggle}
              className="relative overflow-hidden transition-all active:scale-95"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: '#000000',
                boxShadow: audioReactive ? '0 0 12px rgba(107, 255, 170, 0.6)' : 'none'
              }}
            >
              <div
                className="absolute inset-0 transition-opacity duration-200"
                style={{
                  background: 'radial-gradient(circle at center, #FFFFFF 0%, #A3FFB8 30%, #6BFFAA 100%)',
                  opacity: audioReactive ? 1 : 0.5
                }}
              />
              {/* Pulsing indicator when active */}
              {audioReactive && (
                <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              )}
            </button>
            <span className="text-[7px] font-bold uppercase text-slate-500">REACT</span>
          </div>
        </div>

        {/* RIDICULOUS MODE - Only show when audio reactive is on */}
        {audioReactive && (
          <button
            onClick={() => onRidiculousModeChange(!ridiculousMode)}
            className={`w-full py-1 rounded-md font-bold text-[8px] uppercase tracking-wider transition-all mb-2 ${
              ridiculousMode
                ? 'bg-gradient-to-r from-fuchsia-500 via-red-500 to-yellow-500 text-white shadow-lg shadow-fuchsia-500/30 animate-pulse'
                : 'bg-slate-800/50 border border-fuchsia-400/30 text-fuchsia-400 hover:border-fuchsia-400/60'
            }`}
          >
            {ridiculousMode ? 'RIDICULOUS' : 'RIDICULOUS'}
          </button>
        )}
      </div>

      {/* Controls - Only show when effect is active */}
      {showControls && (
        <div className="border-t border-slate-700/50 px-3 py-2 space-y-1.5">
          {/* Intensity */}
          <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
            <span className="text-[8px] font-bold uppercase text-slate-500 w-14">Intensity</span>
            <input
              type="range"
              min="0"
              max="100"
              value={intensity * 100}
              onChange={(e) => onIntensityChange(Number(e.target.value) / 100)}
              className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#81E4F2]"
            />
            <span className="text-[8px] font-mono text-slate-500 w-7 text-right">
              {Math.round(intensity * 100)}%
            </span>
          </div>

          {/* Granularity */}
          <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
            <span className="text-[8px] font-bold uppercase text-slate-500 w-14">Grain</span>
            <input
              type="range"
              min="0"
              max="100"
              value={granularity * 100}
              onChange={(e) => onGranularityChange(Number(e.target.value) / 100)}
              className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#81E4F2]"
            />
            <span className="text-[8px] font-mono text-slate-500 w-7 text-right">
              {Math.round(granularity * 100)}%
            </span>
          </div>

          {/* Wet/Dry */}
          <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
            <span className="text-[8px] font-bold uppercase text-slate-500 w-14">Wet/Dry</span>
            <input
              type="range"
              min="0"
              max="100"
              value={wetDry * 100}
              onChange={(e) => onWetDryChange(Number(e.target.value) / 100)}
              className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#81E4F2]"
            />
            <span className="text-[8px] font-mono text-slate-500 w-7 text-right">
              {Math.round(wetDry * 100)}%
            </span>
          </div>

          {/* Saturation */}
          <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
            <span className="text-[8px] font-bold uppercase text-slate-500 w-14">Saturate</span>
            <input
              type="range"
              min="0"
              max="200"
              value={saturation * 100}
              onChange={(e) => onSaturationChange(Number(e.target.value) / 100)}
              className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#81E4F2]"
            />
            <span className="text-[8px] font-mono text-slate-500 w-7 text-right">
              {Math.round(saturation * 100)}%
            </span>
          </div>

          {/* Dither Color - Only show when dither is active */}
          {currentEffect === 'dither' && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-700/30" onMouseDown={(e) => e.stopPropagation()}>
              <span className="text-[8px] font-bold uppercase text-slate-500 w-14">Color</span>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="color"
                  value={ditherColor}
                  onChange={(e) => onDitherColorChange(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border border-slate-600 bg-transparent"
                  title="Choose dither highlight color"
                />
                <input
                  type="text"
                  value={ditherColor}
                  onChange={(e) => {
                    const val = e.target.value
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                      onDitherColorChange(val)
                    }
                  }}
                  className="flex-1 px-1.5 py-0.5 text-[8px] font-mono bg-slate-800 border border-slate-600 rounded text-slate-300 uppercase"
                  placeholder="#FFFFFF"
                  maxLength={7}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export default WebGLFXPanel
