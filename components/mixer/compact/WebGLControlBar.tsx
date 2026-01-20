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
  // Audio reactive controls
  audioReactive?: boolean
  onAudioReactiveChange?: (enabled: boolean) => void
  ridiculousMode?: boolean
  onRidiculousModeChange?: (enabled: boolean) => void
}

// Compact FX button - 20x20px
function FXButton({
  active,
  onClick,
  gradient,
  glow,
  title,
  children
}: {
  active: boolean
  onClick: () => void
  gradient: string
  glow: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="relative overflow-hidden transition-all active:scale-95"
      style={{
        width: '20px',
        height: '20px',
        borderRadius: '4px',
        backgroundColor: '#000000',
        boxShadow: active ? `0 0 8px ${glow}` : 'none'
      }}
      title={title}
    >
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{
          background: gradient,
          opacity: active ? 1 : 0.55
        }}
      />
      {children && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          {children}
        </div>
      )}
    </button>
  )
}

const WebGLControlBar = memo(function WebGLControlBar({
  crossfadeMode,
  onCrossfadeModeChange,
  activeEffect,
  onEffectChange,
  onOpenSettings,
  audioReactive = false,
  onAudioReactiveChange,
  ridiculousMode = false,
  onRidiculousModeChange
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
      className="bg-black/90 backdrop-blur-sm px-3 py-2 rounded-b-lg"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-center gap-3">
        {/* REACT button - audio reactive toggle */}
        <FXButton
          active={audioReactive}
          onClick={() => onAudioReactiveChange?.(!audioReactive)}
          gradient="radial-gradient(circle at center, #FFFFFF 0%, #93C5FD 30%, #3B82F6 100%)"
          glow="rgba(59, 130, 246, 0.5)"
          title={audioReactive ? "Audio Reactive ON - Click to disable" : "Audio Reactive OFF - Click to enable"}
        >
          {/* Audio wave icon */}
          <svg viewBox="0 0 24 24" className="w-3 h-3" style={{ color: '#000000' }}>
            <path
              fill="none"
              d="M12 4v16M8 7v10M4 10v4M16 7v10M20 10v4"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </FXButton>

        {/* FX Buttons - compact row */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase text-white/70 mr-0.5">FX</span>

          {/* VHS - Pink */}
          <FXButton
            active={activeEffect === 'vhs'}
            onClick={() => handleEffectToggle('vhs')}
            gradient="radial-gradient(circle at center, #FFFFFF 0%, #F3C2F7 30%, #EC84F3 100%)"
            glow="rgba(236, 132, 243, 0.5)"
            title="VHS Glitch"
          />

          {/* ASCII - Orange */}
          <FXButton
            active={activeEffect === 'ascii'}
            onClick={() => handleEffectToggle('ascii')}
            gradient="radial-gradient(circle at center, #FFFFFF 0%, #FFD4A3 30%, #FFAB6B 100%)"
            glow="rgba(255, 171, 107, 0.5)"
            title="ASCII"
          />

          {/* Dither - Yellow */}
          <FXButton
            active={activeEffect === 'dither'}
            onClick={() => handleEffectToggle('dither')}
            gradient="radial-gradient(circle at center, #FFFFFF 0%, #FFF9A3 30%, #FFE66B 100%)"
            glow="rgba(255, 230, 107, 0.5)"
            title="Dither"
          />

          {/* Halftone - Green */}
          <FXButton
            active={activeEffect === 'halftone'}
            onClick={() => handleEffectToggle('halftone')}
            gradient="radial-gradient(circle at center, #FFFFFF 0%, #A3FFB8 30%, #6BFFAA 100%)"
            glow="rgba(107, 255, 170, 0.5)"
            title="Halftone"
          />
        </div>

        {/* 11 button - ridiculous/extreme mode */}
        <FXButton
          active={ridiculousMode}
          onClick={() => onRidiculousModeChange?.(!ridiculousMode)}
          gradient="radial-gradient(circle at center, #FFFFFF 0%, #F0ABFC 30%, #D946EF 100%)"
          glow="rgba(217, 70, 239, 0.5)"
          title={ridiculousMode ? "EXTREME MODE ON - Click to disable" : "EXTREME MODE OFF - Click to enable"}
        >
          <span className="text-[9px] font-black" style={{ color: '#000000' }}>
            11
          </span>
        </FXButton>
      </div>
    </div>
  )
})

export default WebGLControlBar
