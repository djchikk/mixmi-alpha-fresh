"use client"

import React, { useState } from 'react'
import { AvatarEffectType, AvatarEffectSettings } from './AvatarEffectPreview'
import Knob from '../mixer/compact/Knob'

interface AvatarEffectControlsProps {
  effects: AvatarEffectSettings
  onEffectsChange: (effects: AvatarEffectSettings) => void
}

export default function AvatarEffectControls({
  effects,
  onEffectsChange
}: AvatarEffectControlsProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showAttribution, setShowAttribution] = useState(false)

  const handleEffectToggle = (effectType: AvatarEffectType) => {
    onEffectsChange({
      ...effects,
      type: effects.type === effectType ? null : effectType
    })
  }

  const updateEffect = (key: keyof AvatarEffectSettings, value: any) => {
    onEffectsChange({ ...effects, [key]: value })
  }

  return (
    <div
      className="bg-slate-900/80 rounded-lg p-3 space-y-3 relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setShowAttribution(false)
      }}
    >
      {/* Effect Type Buttons */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <span className="text-[10px] font-bold uppercase text-slate-400">FX:</span>

        {/* No Effect - Red circle with slash */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={() => handleEffectToggle(null as any)}
            className="relative overflow-hidden transition-all active:scale-95 flex items-center justify-center"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: '#000000',
              boxShadow: effects.type === null ? '0 0 12px rgba(239, 68, 68, 0.6)' : 'none'
            }}
            title="No Effect"
          >
            <div
              className="absolute inset-0 transition-opacity duration-200"
              style={{
                background: 'radial-gradient(circle at center, #1a1a1a 0%, #0a0a0a 100%)',
                opacity: effects.type === null ? 1 : 0.5
              }}
            />
            {/* Red circle with slash */}
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 relative z-10"
              style={{ opacity: effects.type === null ? 1 : 0.6 }}
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke="#EF4444"
                strokeWidth="2"
              />
              <line
                x1="6"
                y1="6"
                x2="18"
                y2="18"
                stroke="#EF4444"
                strokeWidth="2"
              />
            </svg>
          </button>
          <span className="text-[8px] font-bold uppercase text-slate-500">OFF</span>
        </div>

        {/* VHS - Pink */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={() => handleEffectToggle('vhs')}
            className="relative overflow-hidden transition-all active:scale-95"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: '#000000',
              boxShadow: effects.type === 'vhs' ? '0 0 12px rgba(236, 132, 243, 0.6)' : 'none'
            }}
            title="VHS Glitch"
          >
            <div
              className="absolute inset-0 transition-opacity duration-200"
              style={{
                background: 'radial-gradient(circle at center, #FFFFFF 0%, #F3C2F7 30%, #EC84F3 100%)',
                opacity: effects.type === 'vhs' ? 1 : 0.5
              }}
            />
          </button>
          <span className="text-[8px] font-bold uppercase text-slate-500">VHS</span>
        </div>

        {/* ASCII - Orange */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={() => handleEffectToggle('ascii')}
            className="relative overflow-hidden transition-all active:scale-95"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: '#000000',
              boxShadow: effects.type === 'ascii' ? '0 0 12px rgba(255, 171, 107, 0.6)' : 'none'
            }}
            title="ASCII"
          >
            <div
              className="absolute inset-0 transition-opacity duration-200"
              style={{
                background: 'radial-gradient(circle at center, #FFFFFF 0%, #FFD4A3 30%, #FFAB6B 100%)',
                opacity: effects.type === 'ascii' ? 1 : 0.5
              }}
            />
          </button>
          <span className="text-[8px] font-bold uppercase text-slate-500">ASCII</span>
        </div>

        {/* Dither - Yellow */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={() => handleEffectToggle('dither')}
            className="relative overflow-hidden transition-all active:scale-95"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: '#000000',
              boxShadow: effects.type === 'dither' ? '0 0 12px rgba(255, 230, 107, 0.6)' : 'none'
            }}
            title="Dither"
          >
            <div
              className="absolute inset-0 transition-opacity duration-200"
              style={{
                background: 'radial-gradient(circle at center, #FFFFFF 0%, #FFF9A3 30%, #FFE66B 100%)',
                opacity: effects.type === 'dither' ? 1 : 0.5
              }}
            />
          </button>
          <span className="text-[8px] font-bold uppercase text-slate-500">DTHR</span>
        </div>

        {/* Holographic - Cyan (Claude's effect) */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={() => handleEffectToggle('holographic')}
            className="relative overflow-hidden transition-all active:scale-95"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: '#000000',
              boxShadow: effects.type === 'holographic' ? '0 0 12px rgba(0, 229, 255, 0.6)' : 'none'
            }}
            title="Holographic - Iridescent color shifting"
          >
            <div
              className="absolute inset-0 transition-opacity duration-200"
              style={{
                background: 'radial-gradient(circle at center, #FFFFFF 0%, #80F2FF 30%, #00E5FF 100%)',
                opacity: effects.type === 'holographic' ? 1 : 0.5
              }}
            />
          </button>
          <span className="text-[8px] font-bold uppercase text-slate-500">HOLO</span>
        </div>

        {/* Prism - Purple (Claude's effect) */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={() => handleEffectToggle('prism')}
            className="relative overflow-hidden transition-all active:scale-95"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: '#000000',
              boxShadow: effects.type === 'prism' ? '0 0 12px rgba(179, 136, 255, 0.6)' : 'none'
            }}
            title="Prism - Chromatic dispersion/RGB split"
          >
            <div
              className="absolute inset-0 transition-opacity duration-200"
              style={{
                background: 'radial-gradient(circle at center, #FFFFFF 0%, #D9C4FF 30%, #B388FF 100%)',
                opacity: effects.type === 'prism' ? 1 : 0.5
              }}
            />
          </button>
          <span className="text-[8px] font-bold uppercase text-slate-500">PRISM</span>
        </div>

        {/* Thermal - Red (Claude's effect) */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={() => handleEffectToggle('thermal')}
            className="relative overflow-hidden transition-all active:scale-95"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: '#000000',
              boxShadow: effects.type === 'thermal' ? '0 0 12px rgba(255, 82, 82, 0.6)' : 'none'
            }}
            title="Thermal - Heat map visualization"
          >
            <div
              className="absolute inset-0 transition-opacity duration-200"
              style={{
                background: 'radial-gradient(circle at center, #FFFFFF 0%, #FFA9A9 30%, #FF5252 100%)',
                opacity: effects.type === 'thermal' ? 1 : 0.5
              }}
            />
          </button>
          <span className="text-[8px] font-bold uppercase text-slate-500">THRML</span>
        </div>

        {/* Neon - Blue (Claude's effect) */}
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={() => handleEffectToggle('neon')}
            className="relative overflow-hidden transition-all active:scale-95"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: '#000000',
              boxShadow: effects.type === 'neon' ? '0 0 12px rgba(68, 138, 255, 0.6)' : 'none'
            }}
            title="Neon Glow - Edge detection with glow"
          >
            <div
              className="absolute inset-0 transition-opacity duration-200"
              style={{
                background: 'radial-gradient(circle at center, #FFFFFF 0%, #A2C4FF 30%, #448AFF 100%)',
                opacity: effects.type === 'neon' ? 1 : 0.5
              }}
            />
          </button>
          <span className="text-[8px] font-bold uppercase text-slate-500">NEON</span>
        </div>
      </div>

      {/* Controls - Only show when effect is active */}
      {effects.type && (
        <>
          {/* Knob Controls Row */}
          <div className="flex justify-center gap-3 pt-2 border-t border-slate-700/50">
            <Knob
              value={effects.intensity}
              onChange={(v) => updateEffect('intensity', v)}
              label="INT"
              size={28}
            />
            <Knob
              value={effects.granularity}
              onChange={(v) => updateEffect('granularity', v)}
              label="GRAIN"
              size={28}
            />
            <Knob
              value={effects.wetDry}
              onChange={(v) => updateEffect('wetDry', v)}
              label="WET"
              size={28}
            />
            <Knob
              value={effects.saturation}
              onChange={(v) => updateEffect('saturation', v)}
              label="SAT"
              size={28}
              min={0}
              max={2}
            />
          </div>

          {/* Dither Color - Only show when dither is active */}
          {effects.type === 'dither' && (
            <div className="flex justify-center items-center gap-2 pt-2 border-t border-slate-700/50">
              <input
                type="color"
                value={effects.ditherColor}
                onChange={(e) => updateEffect('ditherColor', e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border border-slate-600 bg-transparent"
                title="Dither highlight color"
              />
              <div className="flex items-center gap-1">
                {[
                  { color: '#00FFFF', name: 'Cyber' },
                  { color: '#FF00FF', name: 'Retrowave' },
                  { color: '#FFC044', name: 'Amber' },
                  { color: '#00FF00', name: 'Matrix' },
                ].map((preset) => (
                  <button
                    key={preset.color}
                    onClick={() => updateEffect('ditherColor', preset.color)}
                    className={`w-5 h-5 rounded-sm border transition-all hover:scale-110 ${
                      effects.ditherColor.toUpperCase() === preset.color
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
        </>
      )}

      {/* Info icon - appears on hover */}
      <button
        onClick={() => setShowAttribution(!showAttribution)}
        className={`absolute left-2 bottom-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-200 ${
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
        <div className="absolute left-2 bottom-9 bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl z-[100] w-64">
          <div className="text-[9px] font-bold uppercase text-slate-400 mb-2">Avatar FX Credits</div>
          <div className="space-y-1.5 text-[8px] text-slate-300">
            <div>
              <span className="text-slate-500">Vision & Design:</span>
              <br />Sandy Hoover (Mixmi)
            </div>
            <div>
              <span className="text-slate-500">VHS, ASCII, DTHR shaders based on:</span>
              <br />Pablo Stanley / <a href="https://efecto.app" target="_blank" rel="noopener noreferrer" className="text-[#5BB5F9] hover:underline">efecto.app</a>
            </div>
            <div>
              <span className="text-slate-500">HOLO, PRISM, THRML, NEON shaders:</span>
              <br />Original designs by <span className="text-[#00E5FF]">Claude</span> (Anthropic)
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
  )
}
