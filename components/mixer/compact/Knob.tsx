"use client"

import React, { useCallback, useRef, useState, useEffect } from 'react'

interface KnobProps {
  value: number // 0-1
  onChange: (value: number) => void
  label?: string
  size?: number // diameter in pixels
  min?: number
  max?: number
  showValue?: boolean
  valueFormat?: (value: number) => string
}

export default function Knob({
  value,
  onChange,
  label,
  size = 36,
  min = 0,
  max = 1,
  showValue = false,
  valueFormat = (v) => `${Math.round(v * 100)}%`
}: KnobProps) {
  const knobRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const startYRef = useRef(0)
  const startValueRef = useRef(0)

  // Convert value to rotation angle (270 degree range, from -135 to +135)
  const normalizedValue = (value - min) / (max - min)
  const rotation = -135 + (normalizedValue * 270)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    startYRef.current = e.clientY
    startValueRef.current = value
  }, [value])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    // Vertical drag: up increases, down decreases
    const deltaY = startYRef.current - e.clientY
    const sensitivity = 0.005 // How much value changes per pixel
    const deltaValue = deltaY * sensitivity * (max - min)
    const newValue = Math.max(min, Math.min(max, startValueRef.current + deltaValue))
    onChange(newValue)
  }, [isDragging, onChange, min, max])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Double-click to reset to center/default
  const handleDoubleClick = useCallback(() => {
    onChange((min + max) / 2)
  }, [onChange, min, max])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Label above knob */}
      {label && (
        <span className="text-[7px] font-bold uppercase text-slate-400 tracking-wide">
          {label}
        </span>
      )}

      {/* Knob container with tick marks */}
      <div className="relative" style={{ width: size + 12, height: size + 12 }}>
        {/* Min/Max tick marks */}
        <div
          className="absolute w-1 h-1 rounded-full bg-slate-600"
          style={{
            left: 2,
            bottom: 4,
          }}
        />
        <div
          className="absolute w-1 h-1 rounded-full bg-slate-600"
          style={{
            right: 2,
            bottom: 4,
          }}
        />

        {/* The knob itself */}
        <div
          ref={knobRef}
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full cursor-grab select-none ${
            isDragging ? 'cursor-grabbing' : ''
          }`}
          style={{
            width: size,
            height: size,
            // Dark textured background like Reloop
            background: `
              radial-gradient(circle at 30% 30%, #4a4a4a 0%, #2a2a2a 50%, #1a1a1a 100%)
            `,
            boxShadow: `
              inset 0 2px 4px rgba(255,255,255,0.1),
              inset 0 -2px 4px rgba(0,0,0,0.3),
              0 2px 8px rgba(0,0,0,0.5)
            `,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
        >
          {/* Ridged texture overlay */}
          <div
            className="absolute inset-1 rounded-full"
            style={{
              background: `
                repeating-conic-gradient(
                  from 0deg,
                  rgba(60,60,60,1) 0deg 10deg,
                  rgba(40,40,40,1) 10deg 20deg
                )
              `,
              opacity: 0.6,
            }}
          />

          {/* Center cap */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: size * 0.35,
              height: size * 0.35,
              background: 'radial-gradient(circle at 40% 40%, #3a3a3a 0%, #1a1a1a 100%)',
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.1), 0 1px 2px rgba(0,0,0,0.3)',
            }}
          />

          {/* Indicator dot */}
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white"
            style={{
              width: size * 0.1,
              height: size * 0.1,
              top: size * 0.12,
              boxShadow: '0 0 4px rgba(255,255,255,0.8)',
            }}
          />
        </div>
      </div>

      {/* Value display below */}
      {showValue && (
        <span className="text-[7px] font-mono text-slate-500">
          {valueFormat(value)}
        </span>
      )}
    </div>
  )
}
