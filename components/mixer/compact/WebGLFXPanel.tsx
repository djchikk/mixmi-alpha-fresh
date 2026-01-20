"use client"

import React, { memo, useState } from 'react'
import { ChevronUp } from 'lucide-react'
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
  ditherColor: string
  onDitherColorChange: (color: string) => void
  saturation: number
  onSaturationChange: (value: number) => void
  // These props are kept for compatibility but no longer displayed here
  audioReactive?: boolean
  onAudioReactiveChange?: (enabled: boolean) => void
  audioLevel?: number
  ridiculousMode?: boolean
  onRidiculousModeChange?: (enabled: boolean) => void
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
  ditherColor,
  onDitherColorChange,
  saturation,
  onSaturationChange,
  className = ''
}: WebGLFXPanelProps) {

  const [isHovered, setIsHovered] = useState(false)
  const [showAttribution, setShowAttribution] = useState(false)

  if (!isOpen) return null

  const currentEffect = activeEffect
  const showControls = currentEffect !== null

  return (
    <div
      className={`webgl-fx-panel bg-black/90 backdrop-blur-sm rounded-t-none flex flex-col relative ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setShowAttribution(false)
      }}
    >
      {/* Close button - always visible at top right */}
      <button
        onClick={onClose}
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors z-10"
        title="Close FX panel"
      >
        <ChevronUp size={14} strokeWidth={2.5} />
      </button>

      {/* No effect message */}
      {!showControls && (
        <div className="px-4 py-3 pt-6 text-center">
          <span className="text-[10px] text-slate-400">Select an effect above to adjust settings</span>
        </div>
      )}

      {/* Controls - Only show when effect is active */}
      {showControls && (
        <div className="px-3 py-2 space-y-1.5 relative pt-5">
          {/* Knobs Row - clean, minimal */}
          <div className="flex justify-center items-center gap-3 py-1" onMouseDown={(e) => e.stopPropagation()}>
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
            <div className="flex justify-center items-center gap-2 pt-1 border-t border-slate-700/30" onMouseDown={(e) => e.stopPropagation()}>
              <input
                type="color"
                value={ditherColor}
                onChange={(e) => onDitherColorChange(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border border-slate-600 bg-transparent"
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
            </div>
          )}

          {/* Info icon - appears on hover */}
          <button
            onClick={() => setShowAttribution(!showAttribution)}
            className={`absolute left-2 bottom-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-200 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            } ${
              showAttribution
                ? 'bg-slate-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
            }`}
            title="FX Credits"
          >
            i
          </button>

          {/* Attribution popover */}
          {showAttribution && (
            <div className="absolute left-2 bottom-8 bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl z-[100] w-64">
              <div className="text-[9px] font-bold uppercase text-slate-400 mb-2">FX Pipeline Credits</div>
              <div className="space-y-1.5 text-[8px] text-slate-300">
                <div>
                  <span className="text-slate-500">Vision & Design:</span>
                  <br />Sandy Hoover (Mixmi)
                </div>
                <div>
                  <span className="text-slate-500">VHS, ASCII, DTHR, HALF shaders based on:</span>
                  <br />Pablo Stanley / <a href="https://efecto.app" target="_blank" rel="noopener noreferrer" className="text-[#5BB5F9] hover:underline">efecto.app</a>
                </div>
                <div className="pt-1 border-t border-slate-700/50">
                  <span className="text-slate-500">Implementation:</span>
                  <br />Claude Code (Anthropic Opus 4.5)
                </div>
              </div>
              <div className="text-[7px] text-slate-500 mt-2 pt-2 border-t border-slate-700">
                January 2026
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export default WebGLFXPanel
