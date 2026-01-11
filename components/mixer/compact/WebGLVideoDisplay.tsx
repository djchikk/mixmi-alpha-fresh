"use client"

import React, { useEffect, useRef, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Track } from '../types'
import { VhsGlitchEffect } from '@/lib/shaderEffects/VhsGlitchEffect'
import { AsciiEffect } from '@/lib/shaderEffects/AsciiEffect'
import { Vector2 } from 'three'

export type CrossfadeMode = 'slide' | 'blend' | 'cut'
export type WebGLEffectType = 'vhs' | 'ascii' | 'dither' | null

interface WebGLVideoEffects {
  activeEffect: WebGLEffectType
  intensity: number      // 0-1
  granularity: number    // 0-1
  wetDry: number         // 0-1
  audioReactive: boolean
}

interface WebGLVideoDisplayProps {
  deckATrack: Track | null
  deckBTrack: Track | null
  deckAPlaying: boolean
  deckBPlaying: boolean
  crossfaderPosition: number // 0-100, where 50 is center
  crossfadeMode?: CrossfadeMode
  effects?: WebGLVideoEffects
}

const defaultEffects: WebGLVideoEffects = {
  activeEffect: null,
  intensity: 0.5,
  granularity: 0.5,
  wetDry: 1.0,
  audioReactive: false
}

// Video plane component that renders a video texture
interface VideoPlaneProps {
  videoUrl: string | null
  isPlaying: boolean
  opacity: number
  clipLeft?: number  // 0-1, portion to clip from left
  clipRight?: number // 0-1, portion to clip from right
  position?: [number, number, number]
  visible: boolean
}

function VideoPlane({
  videoUrl,
  isPlaying,
  opacity,
  clipLeft = 0,
  clipRight = 0,
  position = [0, 0, 0],
  visible
}: VideoPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const textureRef = useRef<THREE.VideoTexture | null>(null)
  const [videoReady, setVideoReady] = useState(false)

  // Create video element
  useEffect(() => {
    if (!videoUrl) {
      setVideoReady(false)
      return
    }

    const video = document.createElement('video')
    video.src = videoUrl
    video.crossOrigin = 'anonymous'
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    video.addEventListener('loadeddata', () => {
      setVideoReady(true)
    })

    video.load()
    videoRef.current = video

    // Create texture
    const texture = new THREE.VideoTexture(video)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.format = THREE.RGBAFormat
    texture.colorSpace = THREE.SRGBColorSpace
    textureRef.current = texture

    return () => {
      video.pause()
      video.src = ''
      video.load()
      texture.dispose()
      videoRef.current = null
      textureRef.current = null
      setVideoReady(false)
    }
  }, [videoUrl])

  // Sync play/pause
  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoReady) return

    if (isPlaying) {
      video.play().catch(err => {
        console.warn('WebGL video autoplay prevented:', err)
      })
    } else {
      video.pause()
    }
  }, [isPlaying, videoReady])

  // Update texture each frame
  useFrame(() => {
    if (textureRef.current && videoRef.current && !videoRef.current.paused) {
      textureRef.current.needsUpdate = true
    }
  })

  // Calculate UV offset for clipping (slide mode)
  const uvOffset = useMemo(() => {
    return { left: clipLeft, right: clipRight }
  }, [clipLeft, clipRight])

  if (!videoUrl || !videoReady || !visible) return null

  // Adjust plane width and position for slide mode clipping
  const planeWidth = 2 * (1 - clipLeft - clipRight)
  const xOffset = (clipLeft - clipRight)

  return (
    <mesh
      ref={meshRef}
      position={[position[0] + xOffset, position[1], position[2]]}
    >
      <planeGeometry args={[planeWidth, 2]} />
      <meshBasicMaterial
        map={textureRef.current}
        transparent={true}
        opacity={opacity}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}

// Scene component that handles crossfade
interface VideoSceneProps {
  deckAUrl: string | null
  deckBUrl: string | null
  deckAPlaying: boolean
  deckBPlaying: boolean
  deckAHasVideo: boolean
  deckBHasVideo: boolean
  crossfaderPosition: number
  crossfadeMode: CrossfadeMode
}

function VideoScene({
  deckAUrl,
  deckBUrl,
  deckAPlaying,
  deckBPlaying,
  deckAHasVideo,
  deckBHasVideo,
  crossfaderPosition,
  crossfadeMode
}: VideoSceneProps) {
  const { size } = useThree()

  // Calculate crossfade parameters based on mode
  // Using the same logic as the original VideoDisplayArea
  let deckAOpacity = 1
  let deckBOpacity = 1
  let deckAClipLeft = 0
  let deckAClipRight = 0
  let deckBClipLeft = 0
  let deckBClipRight = 0
  let showDeckA = deckAHasVideo
  let showDeckB = deckBHasVideo

  if (deckAHasVideo && deckBHasVideo) {
    switch (crossfadeMode) {
      case 'slide':
        // Split-screen with moving divider
        // Deck A shows from left, clipped on right
        // Deck B shows from right, clipped on left
        const splitPoint = crossfaderPosition / 100
        deckAClipRight = splitPoint
        deckBClipLeft = 1 - splitPoint
        deckAOpacity = 1
        deckBOpacity = 1
        break

      case 'blend':
        // Opacity crossfade
        deckAOpacity = (100 - crossfaderPosition) / 100
        deckBOpacity = crossfaderPosition / 100
        break

      case 'cut':
        // Hard cut at 50%
        if (crossfaderPosition < 50) {
          showDeckB = false
          deckAOpacity = 1
        } else {
          showDeckA = false
          deckBOpacity = 1
        }
        break
    }
  }

  return (
    <>
      {/* Deck A Video */}
      <VideoPlane
        videoUrl={deckAUrl}
        isPlaying={deckAPlaying}
        opacity={deckAOpacity}
        clipLeft={deckAClipLeft}
        clipRight={deckAClipRight}
        position={[0, 0, 0]}
        visible={showDeckA}
      />

      {/* Deck B Video - slightly in front for blend mode layering */}
      <VideoPlane
        videoUrl={deckBUrl}
        isPlaying={deckBPlaying}
        opacity={deckBOpacity}
        clipLeft={deckBClipLeft}
        clipRight={deckBClipRight}
        position={[0, 0, 0.001]}
        visible={showDeckB}
      />
    </>
  )
}

// Main component
export default function WebGLVideoDisplay({
  deckATrack,
  deckBTrack,
  deckAPlaying,
  deckBPlaying,
  crossfaderPosition,
  crossfadeMode = 'slide',
  effects = defaultEffects
}: WebGLVideoDisplayProps) {
  // Check if decks have video content
  const deckAHasVideo = Boolean(deckATrack?.content_type === 'video_clip' && (deckATrack as any).video_url)
  const deckBHasVideo = Boolean(deckBTrack?.content_type === 'video_clip' && (deckBTrack as any).video_url)

  // Don't render if no videos
  if (!deckAHasVideo && !deckBHasVideo) {
    return null
  }

  const deckAUrl = deckAHasVideo ? (deckATrack as any).video_url : null
  const deckBUrl = deckBHasVideo ? (deckBTrack as any).video_url : null

  return (
    <div className="webgl-video-display rounded-lg overflow-hidden bg-black relative" style={{ height: '408px' }}>
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

        <VideoScene
          deckAUrl={deckAUrl}
          deckBUrl={deckBUrl}
          deckAPlaying={deckAPlaying}
          deckBPlaying={deckBPlaying}
          deckAHasVideo={deckAHasVideo}
          deckBHasVideo={deckBHasVideo}
          crossfaderPosition={crossfaderPosition}
          crossfadeMode={crossfadeMode}
        />

        {/* Post-processing effects */}
        <EffectComposer>
          {effects.activeEffect === 'vhs' && (
            <VhsGlitchEffect
              intensity={effects.intensity}
              granularity={effects.granularity}
              wetDry={effects.wetDry}
              animated={true}
            />
          )}
          {effects.activeEffect === 'ascii' && (
            <AsciiEffect
              intensity={effects.intensity}
              granularity={effects.granularity}
              wetDry={effects.wetDry}
              colorMode={true}
              resolution={new Vector2(408, 408)}
            />
          )}
        </EffectComposer>
      </Canvas>

      {/* Deck Labels - HTML overlay */}
      {deckAHasVideo && (
        <div className="absolute top-2 left-2 bg-black/70 text-cyan-400 px-2 py-1 rounded text-xs font-bold pointer-events-none">
          DECK A
        </div>
      )}
      {deckBHasVideo && (
        <div className="absolute top-2 right-2 bg-black/70 text-blue-400 px-2 py-1 rounded text-xs font-bold pointer-events-none">
          DECK B
        </div>
      )}

      {/* Center Split Line for slide mode */}
      {deckAHasVideo && deckBHasVideo && crossfadeMode === 'slide' && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/30 pointer-events-none transition-all duration-200 ease-out"
          style={{
            left: `${100 - crossfaderPosition}%`
          }}
        />
      )}
    </div>
  )
}

export type { WebGLVideoEffects, WebGLEffectType }
