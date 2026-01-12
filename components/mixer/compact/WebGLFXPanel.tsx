"use client"

import React, { memo } from 'react'
import { X } from 'lucide-react'
import { WebGLEffectType } from './WebGLVideoDisplay'

interface WebGLFXPanelProps {
  isOpen: boolean
  onClose: () => void
  activeEffect: WebGLEffectType
  intensity: number
  onIntensityChange: (value: number) => void
  granularity: number
  onGranularityChange: (value: number) => void
  wetDry: number
  onWetDryChange: (value: number) => void
  audioReactive: boolean
  ditherColor: string
  onDitherColorChange: (color: string) => void
  ridiculousMode: boolean
  onRidiculousModeChange: (enabled: boolean) => void
  saturation: number
  onSaturationChange: (value: number) => void
  className?: string
}

const WebGLFXPanel = memo(function WebGLFXPanel({
  isOpen,
  onClose,
  activeEffect,
  intensity,
  onIntensityChange,
  granularity,
  onGranularityChange,
  wetDry,
  onWetDryChange,
  audioReactive,
  ditherColor,
  onDitherColorChange,
  ridiculousMode,
  onRidiculousModeChange,
  saturation,
  onSaturationChange,
  className = ''
}: WebGLFXPanelProps) {

  if (!isOpen) return null

  const currentEffect = activeEffect
  const showControls = currentEffect !== null

  return (
    <div className={`webgl-fx-panel bg-black/90 backdrop-blur-sm rounded-lg shadow-2xl overflow-hidden flex flex-col ${className}`}>
      {/* Header with title and close button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
        <span className="text-[9px] font-bold uppercase text-slate-400">FX Settings</span>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-red-400 transition-all"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* RIDICULOUS MODE - Only show when audio reactive is on */}
      {audioReactive && (
        <div className="px-3 py-2">
          <button
            onClick={() => onRidiculousModeChange(!ridiculousMode)}
            className={`w-full py-1.5 rounded-md font-bold text-[8px] uppercase tracking-wider transition-all ${
              ridiculousMode
                ? 'bg-gradient-to-r from-fuchsia-500 via-red-500 to-yellow-500 text-white shadow-lg shadow-fuchsia-500/30 animate-pulse'
                : 'bg-slate-800/50 border border-fuchsia-400/30 text-fuchsia-400 hover:border-fuchsia-400/60'
            }`}
          >
            RIDICULOUS
          </button>
        </div>
      )}

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
