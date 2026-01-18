"use client"

import React, { memo, useState } from 'react'
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
  onAudioReactiveChange: (enabled: boolean) => void
  audioLevel: number  // 0-1, for VU meter display
  ditherColor: string
  onDitherColorChange: (color: string) => void
  ridiculousMode: boolean
  onRidiculousModeChange: (enabled: boolean) => void
  saturation: number
  onSaturationChange: (value: number) => void
  className?: string
}

// FX-style button component (matches the effect buttons exactly)
function FXButton({
  active,
  onClick,
  color = 'blue',
  children
}: {
  active: boolean
  onClick: () => void
  color?: 'blue' | 'fuchsia'
  children?: React.ReactNode
}) {
  // Gradient colors matching FX button style
  const colors = {
    blue: {
      gradient: 'radial-gradient(circle at center, #FFFFFF 0%, #93C5FD 30%, #3B82F6 100%)',
      glow: 'rgba(59, 130, 246, 0.5)'
    },
    fuchsia: {
      gradient: 'radial-gradient(circle at center, #FFFFFF 0%, #F0ABFC 30%, #D946EF 100%)',
      glow: 'rgba(217, 70, 239, 0.5)'
    }
  }
  const c = colors[color]

  return (
    <button
      onClick={onClick}
      className="relative overflow-hidden transition-all active:scale-95"
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '5px',
        backgroundColor: '#000000',
        boxShadow: active ? `0 0 10px ${c.glow}` : 'none'
      }}
    >
      {/* Gradient fill */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{
          background: c.gradient,
          opacity: active ? 1 : 0.65
        }}
      />
      {/* Content centered */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        {children}
      </div>
    </button>
  )
}

// Dark circular VU Needle Meter component
function VUMeter({ level, active }: { level: number; active: boolean }) {
  // Needle rotation: -50deg (min) to +30deg (max) - asymmetric like real VU
  const rotation = -50 + (level * 80)

  return (
    <div
      className={`relative transition-opacity ${
        active ? 'opacity-100' : 'opacity-40'
      }`}
      style={{
        width: '52px',
        height: '52px',
        borderRadius: '50%',
        // Dark face with subtle gradient
        background: 'radial-gradient(circle at 30% 30%, #2a2a2a 0%, #0a0a0a 70%, #000000 100%)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), 0 1px 2px rgba(255,255,255,0.05)'
      }}
    >
      {/* SVG for scale and labels */}
      <svg viewBox="0 0 52 52" className="absolute inset-0 w-full h-full">
        {/* dB LEVEL label */}
        <text x="26" y="12" textAnchor="middle" fontSize="4" fill="#888" fontFamily="sans-serif" letterSpacing="0.5">
          dB LEVEL
        </text>

        {/* Scale arc - yellow/gold zone (normal) */}
        <path
          d="M 8 38 Q 14 18 26 14"
          fill="none"
          stroke="#D4A84B"
          strokeWidth="1"
        />
        {/* Scale arc - red zone (hot) */}
        <path
          d="M 26 14 Q 38 18 44 38"
          fill="none"
          stroke="#DC2626"
          strokeWidth="1"
        />

        {/* Scale numbers - gold for normal, red for hot */}
        <text x="10" y="36" fontSize="4" fill="#D4A84B" fontFamily="sans-serif">20</text>
        <text x="13" y="28" fontSize="4" fill="#D4A84B" fontFamily="sans-serif">10</text>
        <text x="18" y="22" fontSize="3.5" fill="#D4A84B" fontFamily="sans-serif">5</text>
        <text x="24" y="19" fontSize="4" fill="#D4A84B" fontFamily="sans-serif">0</text>
        <text x="32" y="22" fontSize="3.5" fill="#DC2626" fontFamily="sans-serif">3</text>
        <text x="38" y="28" fontSize="4" fill="#DC2626" fontFamily="sans-serif">+</text>

        {/* VU text */}
        <text x="26" y="44" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#D4A84B" fontFamily="serif">
          VU
        </text>
      </svg>

      {/* Needle */}
      <div
        className="absolute transition-transform duration-75"
        style={{
          bottom: '10px',
          left: '50%',
          width: '1.5px',
          height: '22px',
          marginLeft: '-0.75px',
          transformOrigin: 'bottom center',
          transform: `rotate(${rotation}deg)`,
          background: active
            ? 'linear-gradient(to top, #D4A84B 0%, #F5D67A 100%)'
            : 'linear-gradient(to top, #555 0%, #777 100%)',
          borderRadius: '1px'
        }}
      />

      {/* Needle pivot - gold oval */}
      <div
        className="absolute"
        style={{
          bottom: '8px',
          left: '50%',
          width: '8px',
          height: '4px',
          marginLeft: '-4px',
          borderRadius: '50%',
          backgroundColor: active ? '#D4A84B' : '#555',
          boxShadow: '0 0 2px rgba(0,0,0,0.5)'
        }}
      />

      {/* Peak LED indicator */}
      <div
        className="absolute"
        style={{
          top: '10px',
          right: '8px',
          width: '4px',
          height: '4px',
          borderRadius: '50%',
          backgroundColor: level > 0.8 ? '#DC2626' : '#4a1a1a',
          boxShadow: level > 0.8 ? '0 0 4px #DC2626' : 'none'
        }}
      />
    </div>
  )
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
  onAudioReactiveChange,
  audioLevel,
  ditherColor,
  onDitherColorChange,
  ridiculousMode,
  onRidiculousModeChange,
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
      {/* Controls - Only show when effect is active */}
      {showControls && (
        <div className="px-3 py-2 space-y-1.5 relative">
          {/* Controls Row - REACT/VU/11 on left, knobs on right */}
          <div className="flex justify-center items-center gap-2 py-2" onMouseDown={(e) => e.stopPropagation()}>
            {/* REACT button - matches FX button style, blue */}
            <FXButton
              active={audioReactive}
              onClick={() => onAudioReactiveChange(!audioReactive)}
              color="blue"
            >
              {/* Audio wave icon */}
              <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ color: '#000000' }}>
                <path
                  fill="none"
                  d="M12 4v16M8 7v10M4 10v4M16 7v10M20 10v4"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </FXButton>

            {/* VU Meter */}
            <VUMeter level={audioLevel} active={audioReactive} />

            {/* 11 Boost button - matches FX button style, fuchsia */}
            <FXButton
              active={ridiculousMode}
              onClick={() => onRidiculousModeChange(!ridiculousMode)}
              color="fuchsia"
            >
              <span className="text-[11px] font-black" style={{ color: '#000000' }}>
                11
              </span>
            </FXButton>

            {/* Small spacer */}
            <div className="w-1" />

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
