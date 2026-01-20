"use client"

import React, { memo, useCallback, useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Volume2, VolumeX } from 'lucide-react'
import WebGLVideoDisplay, { WebGLEffectType, CrossfadeMode, WebGLVideoEffects } from './compact/WebGLVideoDisplay'
import Knob from './compact/Knob'
import { Track } from './types'

interface VideoMixerLargeProps {
  // Video tracks
  videoATrack: Track | null
  videoBTrack: Track | null
  // Video volumes (0-100)
  videoAVolume: number
  videoBVolume: number
  onVideoAVolumeChange: (volume: number) => void
  onVideoBVolumeChange: (volume: number) => void
  // Video crossfader (0-100)
  videoCrossfaderPosition: number
  onVideoCrossfaderChange: (position: number) => void
  // Crossfade mode
  crossfadeMode: CrossfadeMode
  onCrossfadeModeChange: (mode: CrossfadeMode) => void
  // Effects
  activeEffect: WebGLEffectType
  onEffectChange: (effect: WebGLEffectType) => void
  intensity: number
  onIntensityChange: (value: number) => void
  granularity: number
  onGranularityChange: (value: number) => void
  wetDry: number
  onWetDryChange: (value: number) => void
  saturation: number
  onSaturationChange: (value: number) => void
  ditherColor: string
  onDitherColorChange: (color: string) => void
  // Audio reactive
  audioReactive: boolean
  onAudioReactiveChange: (enabled: boolean) => void
  audioLevel: number
  // Boost/Ridiculous mode
  ridiculousMode: boolean
  onRidiculousModeChange: (enabled: boolean) => void
  // Collapse/visibility
  isCollapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  onHide: () => void
  // Drag state
  position: { x: number; y: number }
  onPositionChange: (position: { x: number; y: number }) => void
  // Clear functions
  onClearVideoA?: () => void
  onClearVideoB?: () => void
}

// FX Button component
function FXButton({
  active,
  onClick,
  gradient,
  glow,
  label,
  children
}: {
  active: boolean
  onClick: () => void
  gradient: string
  glow: string
  label: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        className="relative overflow-hidden transition-all active:scale-95"
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '8px',
          backgroundColor: '#000000',
          border: active ? `2px solid ${glow}` : '2px solid transparent',
          boxShadow: active ? `0 0 12px ${glow}` : 'none'
        }}
        title={label}
      >
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{
            background: gradient,
            opacity: active ? 1 : 0.6
          }}
        />
        {children && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            {children}
          </div>
        )}
      </button>
      <span className="text-[9px] font-bold uppercase text-slate-400">{label}</span>
    </div>
  )
}

// Audio Level Meter for REACT button
function AudioLevelMeter({ level, active }: { level: number; active: boolean }) {
  const bars = 6
  const filledBars = Math.round(level * bars)

  return (
    <div className="flex flex-col gap-0.5" style={{ height: '32px' }}>
      {Array.from({ length: bars }).map((_, i) => {
        const barIndex = bars - 1 - i
        const isFilled = barIndex < filledBars && active
        return (
          <div
            key={i}
            className="transition-all duration-75"
            style={{
              width: '4px',
              height: '4px',
              borderRadius: '1px',
              backgroundColor: isFilled
                ? barIndex >= 4 ? '#ef4444' : barIndex >= 2 ? '#eab308' : '#22c55e'
                : '#334155'
            }}
          />
        )
      })}
    </div>
  )
}

// Mix Mode Button
function MixModeButton({
  mode,
  currentMode,
  onClick,
  label
}: {
  mode: CrossfadeMode
  currentMode: CrossfadeMode
  onClick: () => void
  label: string
}) {
  const isActive = mode === currentMode
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-xs font-bold uppercase rounded transition-all ${
        isActive
          ? 'bg-[#81E4F2]/20 text-[#81E4F2] border border-[#81E4F2]'
          : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-500'
      }`}
    >
      {label}
    </button>
  )
}

const VideoMixerLarge = memo(function VideoMixerLarge({
  videoATrack,
  videoBTrack,
  videoAVolume,
  videoBVolume,
  onVideoAVolumeChange,
  onVideoBVolumeChange,
  videoCrossfaderPosition,
  onVideoCrossfaderChange,
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
  saturation,
  onSaturationChange,
  ditherColor,
  onDitherColorChange,
  audioReactive,
  onAudioReactiveChange,
  audioLevel,
  ridiculousMode,
  onRidiculousModeChange,
  isCollapsed,
  onCollapsedChange,
  onHide,
  position,
  onPositionChange,
  onClearVideoA,
  onClearVideoB
}: VideoMixerLargeProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const hasVideoA = Boolean(videoATrack?.content_type === 'video_clip')
  const hasVideoB = Boolean(videoBTrack?.content_type === 'video_clip')
  const hasBothVideos = hasVideoA && hasVideoB
  const showFXPanel = activeEffect !== null

  // Drag handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag from header area
    const target = e.target as HTMLElement
    if (!target.closest('.drag-handle')) return

    e.preventDefault()
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }, [position])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      onPositionChange({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, onPositionChange])

  // Effect toggle handler
  const handleEffectToggle = useCallback((effectType: WebGLEffectType) => {
    if (activeEffect === effectType) {
      onEffectChange(null)
    } else {
      onEffectChange(effectType)
    }
  }, [activeEffect, onEffectChange])

  // Crossfader handling
  const crossfaderRef = useRef<HTMLDivElement>(null)
  const [localCrossfaderPosition, setLocalCrossfaderPosition] = useState(videoCrossfaderPosition)

  useEffect(() => {
    setLocalCrossfaderPosition(videoCrossfaderPosition)
  }, [videoCrossfaderPosition])

  const updateCrossfaderPosition = useCallback((clientX: number) => {
    if (crossfaderRef.current) {
      const rect = crossfaderRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
      setLocalCrossfaderPosition(percentage)
      onVideoCrossfaderChange(percentage)
    }
  }, [onVideoCrossfaderChange])

  const handleCrossfaderMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    updateCrossfaderPosition(e.clientX)

    const handleMouseMove = (e: MouseEvent) => {
      updateCrossfaderPosition(e.clientX)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [updateCrossfaderPosition])

  // Build effects object for WebGL
  const effects: WebGLVideoEffects = {
    activeEffect,
    intensity,
    granularity,
    wetDry,
    audioReactive,
    ditherColor,
    audioLevel,
    ridiculousMode,
    saturation
  }

  return (
    <div
      ref={containerRef}
      className="video-mixer-large bg-[#0a0a0f] rounded-lg overflow-hidden shadow-2xl"
      style={{
        width: '360px',
        position: 'fixed',
        left: position.x === 0 ? 'auto' : `${position.x}px`,
        right: position.x === 0 ? '24px' : 'auto',
        top: position.y === 0 ? '50%' : `${position.y}px`,
        transform: position.y === 0 ? 'translateY(-50%)' : 'none',
        zIndex: isDragging ? 200 : 50,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header - Drag Handle */}
      <div
        className="drag-handle bg-gradient-to-r from-[#5BB5F9] to-[#38BDF8] px-4 py-2 flex items-center justify-between"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <span className="text-white text-sm font-bold">VIDEO MIXER</span>
        <span className="text-white/60 text-[10px] uppercase">Drag to move</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCollapsedChange(!isCollapsed)}
            className="hover:bg-white/20 rounded p-0.5 transition-colors"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? (
              <ChevronUp className="w-5 h-5 text-white" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Video Display Area - Hidden when collapsed */}
      {!isCollapsed && (
        <div className="relative" style={{ height: '360px' }}>
          <WebGLVideoDisplay
            deckATrack={videoATrack}
            deckBTrack={videoBTrack}
            deckAPlaying={true}
            deckBPlaying={true}
            deckAVolume={videoAVolume}
            deckBVolume={videoBVolume}
            crossfaderPosition={videoCrossfaderPosition}
            crossfadeMode={crossfadeMode}
            effects={effects}
            height={360}
          />

          {/* DECK A Label - top left (smaller) */}
          {hasVideoA && (
            <div className="absolute top-2 left-2 bg-black/80 px-1.5 py-0.5 rounded">
              <span className="text-[#81E4F2] text-[10px] font-bold">DECK A</span>
            </div>
          )}

          {/* DECK B Label - top right (only when both videos loaded, smaller) */}
          {hasBothVideos && (
            <div className="absolute top-2 right-2 bg-black/80 px-1.5 py-0.5 rounded">
              <span className="text-[#81E4F2] text-[10px] font-bold">DECK B</span>
            </div>
          )}

          {/* Empty state when no videos */}
          {!hasVideoA && !hasVideoB && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90">
              <div className="text-center">
                <div className="text-slate-500 text-sm">No video loaded</div>
                <div className="text-slate-600 text-xs mt-1">Drop video clips to mixer decks</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MIX Mode Row - centered */}
      <div className="px-4 py-3 border-t border-slate-800">
        <div className="flex items-center justify-center gap-2">
          <MixModeButton
            mode="slide"
            currentMode={crossfadeMode}
            onClick={() => onCrossfadeModeChange('slide')}
            label="Slide"
          />
          <MixModeButton
            mode="blend"
            currentMode={crossfadeMode}
            onClick={() => onCrossfadeModeChange('blend')}
            label="Blend"
          />
          <MixModeButton
            mode="cut"
            currentMode={crossfadeMode}
            onClick={() => onCrossfadeModeChange('cut')}
            label="Cut"
          />
        </div>
      </div>

      {/* Video Crossfader Row (only when both videos loaded) */}
      {hasBothVideos && (
        <div className="px-4 py-3 border-t border-slate-800">
          <div className="flex items-center gap-3">
            {/* Volume A */}
            <button
              onClick={() => onVideoAVolumeChange(videoAVolume > 0 ? 0 : 100)}
              className={`p-1.5 rounded transition-colors ${
                videoAVolume > 0 ? 'text-slate-400 hover:text-white' : 'text-slate-600'
              }`}
              title={videoAVolume > 0 ? 'Mute A' : 'Unmute A'}
            >
              {videoAVolume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <span className="text-[10px] font-bold text-slate-500">A</span>

            {/* Crossfader */}
            <div
              ref={crossfaderRef}
              className="flex-1 h-10 relative cursor-pointer"
              onMouseDown={handleCrossfaderMouseDown}
            >
              {/* Track */}
              <div className="absolute top-1/2 left-4 right-4 h-1 bg-slate-700 -translate-y-1/2 rounded">
                {/* Center marker */}
                <div className="absolute left-1/2 top-1/2 w-0.5 h-3 bg-slate-500 -translate-x-1/2 -translate-y-1/2" />
              </div>
              {/* Handle */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-slate-600 border-2 border-slate-400 rounded-lg cursor-grab hover:border-[#81E4F2] transition-colors"
                style={{
                  left: `calc(16px + (100% - 48px) * ${localCrossfaderPosition / 100})`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#81E4F2]" />
              </div>
            </div>

            <span className="text-[10px] font-bold text-slate-500">B</span>
            {/* Volume B */}
            <button
              onClick={() => onVideoBVolumeChange(videoBVolume > 0 ? 0 : 100)}
              className={`p-1.5 rounded transition-colors ${
                videoBVolume > 0 ? 'text-slate-400 hover:text-white' : 'text-slate-600'
              }`}
              title={videoBVolume > 0 ? 'Mute B' : 'Unmute B'}
            >
              {videoBVolume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* FX Row */}
      <div className="px-4 py-3 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* VHS - Pink/Magenta */}
            <FXButton
              active={activeEffect === 'vhs'}
              onClick={() => handleEffectToggle('vhs')}
              gradient="radial-gradient(circle at center, #FFFFFF 0%, #F3C2F7 30%, #EC84F3 100%)"
              glow="rgba(236, 132, 243, 0.6)"
              label="VHS"
            />
            {/* ASCII - Orange */}
            <FXButton
              active={activeEffect === 'ascii'}
              onClick={() => handleEffectToggle('ascii')}
              gradient="radial-gradient(circle at center, #FFFFFF 0%, #FFD4A3 30%, #FFAB6B 100%)"
              glow="rgba(255, 171, 107, 0.6)"
              label="ASCII"
            />
            {/* Dither - Yellow */}
            <FXButton
              active={activeEffect === 'dither'}
              onClick={() => handleEffectToggle('dither')}
              gradient="radial-gradient(circle at center, #FFFFFF 0%, #FFF9A3 30%, #FFE66B 100%)"
              glow="rgba(255, 230, 107, 0.6)"
              label="DTHR"
            />
            {/* Halftone - Green */}
            <FXButton
              active={activeEffect === 'halftone'}
              onClick={() => handleEffectToggle('halftone')}
              gradient="radial-gradient(circle at center, #FFFFFF 0%, #A3FFB8 30%, #6BFFAA 100%)"
              glow="rgba(107, 255, 170, 0.6)"
              label="HALF"
            />
          </div>

          {/* REACT button with meter */}
          <div className="flex items-center gap-1.5">
            <FXButton
              active={audioReactive}
              onClick={() => onAudioReactiveChange(!audioReactive)}
              gradient="radial-gradient(circle at center, #FFFFFF 0%, #93C5FD 30%, #3B82F6 100%)"
              glow="rgba(59, 130, 246, 0.6)"
              label="REACT"
            />
            <AudioLevelMeter level={audioLevel} active={audioReactive} />
          </div>
        </div>
      </div>

      {/* Knobs Row (only when FX is active) */}
      {showFXPanel && (
        <div className="px-4 py-4 border-t border-slate-800">
          <div className="flex items-center justify-center gap-4">
            <Knob
              value={intensity}
              onChange={onIntensityChange}
              label="INT"
              size={44}
            />
            <Knob
              value={granularity}
              onChange={onGranularityChange}
              label="GRAIN"
              size={44}
            />
            <Knob
              value={wetDry}
              onChange={onWetDryChange}
              label="WET"
              size={44}
            />
            <Knob
              value={saturation}
              onChange={onSaturationChange}
              label="SAT"
              size={44}
              min={0}
              max={2}
            />
            {/* XL Button - extreme mode */}
            <button
              onClick={() => onRidiculousModeChange(!ridiculousMode)}
              className="flex flex-col items-center gap-1 transition-all active:scale-95"
              title={ridiculousMode ? 'XL Mode ON - Click to disable' : 'XL Mode OFF - Click to enable extreme mode'}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '8px',
                  backgroundColor: ridiculousMode ? '#7c3aed' : '#1e1b4b',
                  border: ridiculousMode ? '2px solid #a78bfa' : '2px solid #4c1d95',
                  boxShadow: ridiculousMode ? '0 0 12px rgba(139, 92, 246, 0.5)' : 'none'
                }}
              >
                <span
                  className="text-base font-black"
                  style={{ color: ridiculousMode ? '#fff' : '#7c3aed' }}
                >
                  XL
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Dither Color Picker (only when dither is active) */}
      {activeEffect === 'dither' && (
        <div className="px-4 py-3 border-t border-slate-800">
          <div className="flex items-center justify-center gap-3">
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
              className="w-20 px-2 py-1 text-xs font-mono bg-slate-800 border border-slate-600 rounded text-slate-300 uppercase"
              placeholder="#FFFFFF"
              maxLength={7}
            />
            {/* Preset colors */}
            <div className="flex gap-1.5">
              {['#5BB5F9', '#FFFFFF', '#FFE66B', '#6BFFAA'].map((color) => (
                <button
                  key={color}
                  onClick={() => onDitherColorChange(color)}
                  className={`w-5 h-5 rounded border-2 transition-all ${
                    ditherColor === color ? 'border-white scale-110' : 'border-slate-600 hover:border-slate-400'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export default VideoMixerLarge
