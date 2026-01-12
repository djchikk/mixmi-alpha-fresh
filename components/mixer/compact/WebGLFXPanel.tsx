"use client"

import React, { memo } from 'react'
import { X } from 'lucide-react'
import { WebGLEffectType } from './WebGLVideoDisplay'
import Knob from './Knob'

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
  audioLevel: number  // 0-1, for VU meter display
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
  audioLevel,
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

      {/* Controls - Only show when effect is active */}
      {showControls && (
        <div className="px-3 py-2 space-y-1.5">
          {/* Audio Reactive Controls - Only show when audio reactive is on */}
          {audioReactive && (
            <div className="pb-1.5 border-b border-slate-700/30 space-y-1.5">
              {/* VU Meter */}
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold uppercase text-slate-500 w-14">Audio</span>
                <div className="flex-1 flex gap-0.5 h-3 items-center">
                  {/* 12 segment VU meter */}
                  {Array.from({ length: 12 }).map((_, i) => {
                    const threshold = (i + 1) / 12
                    const isActive = audioLevel >= threshold
                    // Green for low, yellow for mid, red for high
                    let color = 'bg-emerald-500'
                    if (i >= 9) color = 'bg-red-500'
                    else if (i >= 6) color = 'bg-yellow-500'

                    return (
                      <div
                        key={i}
                        className={`flex-1 h-full rounded-sm transition-all duration-75 ${
                          isActive ? color : 'bg-slate-700/50'
                        }`}
                        style={{
                          opacity: isActive ? 1 : 0.3,
                          boxShadow: isActive && i >= 9 ? '0 0 4px rgba(239, 68, 68, 0.5)' :
                                     isActive && i >= 6 ? '0 0 4px rgba(234, 179, 8, 0.3)' :
                                     isActive ? '0 0 4px rgba(16, 185, 129, 0.3)' : 'none'
                        }}
                      />
                    )
                  })}
                </div>
              </div>

              {/* "11" Boost Button */}
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold uppercase text-slate-500 w-14">Boost</span>
                <button
                  onClick={() => onRidiculousModeChange(!ridiculousMode)}
                  className={`px-3 py-1 rounded-md font-black text-[10px] transition-all ${
                    ridiculousMode
                      ? 'bg-gradient-to-r from-fuchsia-500 via-red-500 to-yellow-500 text-white shadow-lg shadow-fuchsia-500/30 animate-pulse'
                      : 'bg-slate-800/50 border border-fuchsia-400/30 text-fuchsia-400 hover:border-fuchsia-400/60'
                  }`}
                  title="Turn it up to 11!"
                >
                  11
                </button>
              </div>
            </div>
          )}

          {/* Knob Controls Row */}
          <div className="flex justify-center gap-4 py-2" onMouseDown={(e) => e.stopPropagation()}>
            <Knob
              value={intensity}
              onChange={onIntensityChange}
              label="INT"
              size={32}
            />
            <Knob
              value={granularity}
              onChange={onGranularityChange}
              label="GRAIN"
              size={32}
            />
            <Knob
              value={wetDry}
              onChange={onWetDryChange}
              label="WET"
              size={32}
            />
            <Knob
              value={saturation}
              onChange={onSaturationChange}
              label="SAT"
              size={32}
              min={0}
              max={2}
            />
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
