"use client"

import React, { memo } from 'react'
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
    <div className={`webgl-fx-panel bg-black/90 backdrop-blur-sm rounded-t-none overflow-hidden flex flex-col ${className}`}>
      {/* Controls - Only show when effect is active */}
      {showControls && (
        <div className="px-3 py-2 space-y-1.5">
          {/* Knob Controls Row with optional Boost button */}
          <div className="flex justify-center items-start gap-4 py-2" onMouseDown={(e) => e.stopPropagation()}>
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
            {/* Boost "11" Button - Only show when audio reactive is on */}
            {audioReactive && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-[7px] font-bold uppercase text-slate-400 tracking-wide">
                  BOOST
                </span>
                <button
                  onClick={() => onRidiculousModeChange(!ridiculousMode)}
                  className={`w-8 h-8 rounded-md font-black text-[11px] transition-all ${
                    ridiculousMode
                      ? 'bg-gradient-to-r from-fuchsia-500 via-red-500 to-yellow-500 text-white shadow-lg shadow-fuchsia-500/30 animate-pulse'
                      : 'bg-slate-800/50 border border-fuchsia-400/30 text-fuchsia-400 hover:border-fuchsia-400/60'
                  }`}
                  title="Turn it up to 11!"
                >
                  11
                </button>
              </div>
            )}
          </div>

          {/* Dither Color - Only show when dither is active */}
          {currentEffect === 'dither' && (
            <div className="flex justify-center items-center gap-3 pt-1 border-t border-slate-700/30" onMouseDown={(e) => e.stopPropagation()}>
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
                className="w-16 px-1.5 py-0.5 text-[8px] font-mono bg-slate-800 border border-slate-600 rounded text-slate-300 uppercase"
                placeholder="#FFFFFF"
                maxLength={7}
              />
              {/* Preset palette swatches */}
              <div className="flex items-center gap-1.5">
                {[
                  { color: '#00FFFF', name: 'Cyber' },
                  { color: '#FF00FF', name: 'Retrowave' },
                  { color: '#FFC044', name: 'Amber' },
                  { color: '#00FF00', name: 'Matrix' },
                ].map((preset) => (
                  <button
                    key={preset.color}
                    onClick={() => onDitherColorChange(preset.color)}
                    className={`w-5 h-5 rounded-sm border transition-all hover:scale-110 ${
                      ditherColor.toUpperCase() === preset.color
                        ? 'border-white ring-1 ring-white/50'
                        : 'border-slate-600 hover:border-slate-400'
                    }`}
                    style={{ backgroundColor: preset.color }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export default WebGLFXPanel
