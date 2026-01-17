"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Vector2 } from 'three'
import { VhsGlitchEffect } from '@/lib/shaderEffects/VhsGlitchEffect'
import { AsciiEffect } from '@/lib/shaderEffects/AsciiEffect'
import { DitherEffect } from '@/lib/shaderEffects/DitherEffect'
import { HolographicEffect } from '@/lib/shaderEffects/HolographicEffect'
import { PrismEffect } from '@/lib/shaderEffects/PrismEffect'
import { ThermalEffect } from '@/lib/shaderEffects/ThermalEffect'
import { NeonGlowEffect } from '@/lib/shaderEffects/NeonGlowEffect'
import { HalftoneEffect } from '@/lib/shaderEffects/HalftoneEffect'

export type AvatarEffectType = 'vhs' | 'ascii' | 'dither' | 'holographic' | 'prism' | 'thermal' | 'neon' | 'halftone' | null

export interface AvatarEffectSettings {
  type: AvatarEffectType
  intensity: number      // 0-1
  granularity: number    // 0-1
  wetDry: number         // 0-1
  saturation: number     // 0-2
  ditherColor: string    // Hex color for dither effect
}

export const defaultAvatarEffectSettings: AvatarEffectSettings = {
  type: null,
  intensity: 0.5,
  granularity: 0.5,
  wetDry: 0.8,
  saturation: 1.0,
  ditherColor: '#00FFFF'
}

interface AvatarEffectPreviewProps {
  imageUrl: string
  effects: AvatarEffectSettings
  size?: number // Width/height in pixels
  className?: string
}

// Component to render image texture on a plane
function ImagePlane({ imageUrl, isVideo }: { imageUrl: string; isVideo: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const textureRef = useRef<THREE.Texture | THREE.VideoTexture | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!imageUrl) return

    if (isVideo) {
      // Create video element for video avatars
      const video = document.createElement('video')
      video.src = imageUrl
      video.crossOrigin = 'anonymous'
      video.loop = true
      video.muted = true
      video.playsInline = true
      video.preload = 'auto'

      video.onloadeddata = () => {
        const texture = new THREE.VideoTexture(video)
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.format = THREE.RGBAFormat
        textureRef.current = texture
        videoRef.current = video
        video.play().catch(console.warn)
        setReady(true)
      }

      video.onerror = () => console.warn('Failed to load video:', imageUrl)

      return () => {
        video.pause()
        video.src = ''
        video.load()
        textureRef.current?.dispose()
      }
    } else {
      // Load static image
      const loader = new THREE.TextureLoader()
      loader.crossOrigin = 'anonymous'
      loader.load(
        imageUrl,
        (texture) => {
          texture.minFilter = THREE.LinearFilter
          texture.magFilter = THREE.LinearFilter
          textureRef.current = texture
          setReady(true)
        },
        undefined,
        (error) => console.warn('Failed to load image:', error)
      )

      return () => {
        textureRef.current?.dispose()
      }
    }
  }, [imageUrl, isVideo])

  // Update video texture each frame
  useFrame(() => {
    if (isVideo && textureRef.current && videoRef.current && !videoRef.current.paused) {
      (textureRef.current as THREE.VideoTexture).needsUpdate = true
    }
  })

  if (!ready || !textureRef.current) return null

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial map={textureRef.current} transparent={false} />
    </mesh>
  )
}

// Main preview component
export default function AvatarEffectPreview({
  imageUrl,
  effects,
  size = 200,
  className = ''
}: AvatarEffectPreviewProps) {
  // Detect if it's a video
  const isVideo = imageUrl && (
    imageUrl.includes('.mp4') ||
    imageUrl.includes('.webm') ||
    imageUrl.includes('video/')
  )

  if (!imageUrl) {
    return (
      <div
        className={`bg-slate-800 rounded-lg flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-slate-500 text-sm">No image</span>
      </div>
    )
  }

  // If no effect, just render the image/video directly without WebGL
  if (!effects.type) {
    return (
      <div
        className={`rounded-lg overflow-hidden ${className}`}
        style={{ width: size, height: size }}
      >
        {isVideo ? (
          <video
            src={imageUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={imageUrl}
            alt="Avatar preview"
            className="w-full h-full object-cover"
          />
        )}
      </div>
    )
  }

  // Render with WebGL effects
  return (
    <div
      className={`rounded-lg overflow-hidden bg-black ${className}`}
      style={{ width: size, height: size }}
    >
      <Canvas
        camera={{ position: [0, 0, 1], fov: 90 }}
        style={{ background: '#000000' }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance'
        }}
      >
        <color attach="background" args={['#000000']} />

        <ImagePlane imageUrl={imageUrl} isVideo={isVideo} />

        <EffectComposer>
          {effects.type === 'vhs' && (
            <VhsGlitchEffect
              intensity={effects.intensity}
              granularity={effects.granularity}
              wetDry={effects.wetDry}
              animated={true}
              audioLevel={0}
              audioReactive={false}
              ridiculousMode={false}
              saturation={effects.saturation}
            />
          )}
          {effects.type === 'ascii' && (
            <AsciiEffect
              intensity={effects.intensity}
              granularity={effects.granularity}
              wetDry={effects.wetDry}
              colorMode={true}
              resolution={new Vector2(size, size)}
              audioLevel={0}
              audioReactive={false}
              ridiculousMode={false}
              saturation={effects.saturation}
            />
          )}
          {effects.type === 'dither' && (
            <DitherEffect
              intensity={effects.intensity}
              granularity={effects.granularity}
              wetDry={effects.wetDry}
              color1="#000000"
              color2={effects.ditherColor}
              audioLevel={0}
              audioReactive={false}
              ridiculousMode={false}
              saturation={effects.saturation}
            />
          )}
          {effects.type === 'holographic' && (
            <HolographicEffect
              intensity={effects.intensity}
              granularity={effects.granularity}
              wetDry={effects.wetDry}
              audioLevel={0}
              audioReactive={false}
              ridiculousMode={false}
              saturation={effects.saturation}
            />
          )}
          {effects.type === 'prism' && (
            <PrismEffect
              intensity={effects.intensity}
              granularity={effects.granularity}
              wetDry={effects.wetDry}
              audioLevel={0}
              audioReactive={false}
              ridiculousMode={false}
              saturation={effects.saturation}
              resolution={{ x: size, y: size }}
            />
          )}
          {effects.type === 'thermal' && (
            <ThermalEffect
              intensity={effects.intensity}
              granularity={effects.granularity}
              wetDry={effects.wetDry}
              audioLevel={0}
              audioReactive={false}
              ridiculousMode={false}
              saturation={effects.saturation}
            />
          )}
          {effects.type === 'neon' && (
            <NeonGlowEffect
              intensity={effects.intensity}
              granularity={effects.granularity}
              wetDry={effects.wetDry}
              audioLevel={0}
              audioReactive={false}
              ridiculousMode={false}
              saturation={effects.saturation}
              resolution={{ x: size, y: size }}
            />
          )}
          {effects.type === 'halftone' && (
            <HalftoneEffect
              intensity={effects.intensity}
              granularity={effects.granularity}
              wetDry={effects.wetDry}
              audioLevel={0}
              audioReactive={false}
              ridiculousMode={false}
              saturation={effects.saturation}
              resolution={{ x: size, y: size }}
            />
          )}
        </EffectComposer>
      </Canvas>
    </div>
  )
}
