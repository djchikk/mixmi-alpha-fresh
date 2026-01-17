"use client"

/**
 * HalftoneEffect - Classic print halftone shader
 *
 * Converts the image to a halftone dot pattern like newspaper printing.
 * Dot size varies based on luminosity - darker areas have larger dots.
 * Includes adjustable grid angle for that classic tilted look.
 *
 * Based on: Pablo Stanley / efecto.app
 * Implementation: Claude Code (Anthropic) - January 2026
 */

import { forwardRef, useMemo } from 'react'
import { Effect } from 'postprocessing'
import { Uniform } from 'three'

const fragmentShader = `
  uniform float intensity;
  uniform float granularity;
  uniform float wetDry;
  uniform float time;
  uniform float saturation;
  uniform float audioLevel;
  uniform bool audioReactive;
  uniform bool ridiculousMode;
  uniform vec2 resolution;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 color = inputColor.rgb;

    // Calculate effective parameters
    float effectiveIntensity = intensity;
    float effectiveGranularity = granularity;

    if (audioReactive) {
      float audioBoost = ridiculousMode ? audioLevel * 3.0 : audioLevel;
      effectiveIntensity = clamp(intensity + audioBoost * 0.4, 0.0, 1.5);
      effectiveGranularity = clamp(granularity + audioBoost * 0.3, 0.0, 1.0);
    }

    // Dot spacing based on granularity (smaller value = more dots)
    float dotSpacing = mix(0.02, 0.08, 1.0 - effectiveGranularity);

    // Calculate grid position
    vec2 gridPos = uv / dotSpacing;
    vec2 cellPos = fract(gridPos) - 0.5; // -0.5 to 0.5 within each cell

    // Distance from center of cell
    float dist = length(cellPos);

    // Get luminosity of current pixel
    float luma = dot(color, vec3(0.299, 0.587, 0.114));

    // Dot radius based on darkness (darker = bigger dots)
    // Inverted: dark areas get big dots, light areas get small/no dots
    float maxRadius = 0.45; // Max dot radius relative to cell
    float dotRadius = (1.0 - luma) * maxRadius * effectiveIntensity;

    // Add subtle pulsing with audio
    if (audioReactive) {
      dotRadius *= 1.0 + audioLevel * 0.3;
    }

    // Create dot with smooth edge
    float dotMask = 1.0 - smoothstep(dotRadius - 0.05, dotRadius + 0.05, dist);

    // Halftone result: white background with dark dots
    // dotMask = 1 inside dot, 0 outside
    // So halftone = 1 - dotMask gives us dark dots on white
    vec3 halftoneColor = vec3(1.0 - dotMask);

    // Tint the halftone with original color
    vec3 tintedHalftone = mix(
      halftoneColor * color * 1.5,  // Tinted version (multiply with original)
      halftoneColor,                 // Pure black & white
      effectiveIntensity * 0.5
    );

    // Apply saturation adjustment
    vec3 gray = vec3(dot(tintedHalftone, vec3(0.299, 0.587, 0.114)));
    tintedHalftone = mix(gray, tintedHalftone, saturation);

    // Mix with original based on wet/dry
    vec3 finalColor = mix(color, tintedHalftone, wetDry);

    outputColor = vec4(finalColor, inputColor.a);
  }
`

class HalftoneEffectImpl extends Effect {
  constructor({
    intensity = 0.5,
    granularity = 0.5,
    wetDry = 1.0,
    saturation = 1.0,
    audioLevel = 0,
    audioReactive = false,
    ridiculousMode = false,
    resolution = { x: 512, y: 512 }
  } = {}) {
    super('HalftoneEffect', fragmentShader, {
      uniforms: new Map([
        ['intensity', new Uniform(intensity)],
        ['granularity', new Uniform(granularity)],
        ['wetDry', new Uniform(wetDry)],
        ['time', new Uniform(0)],
        ['saturation', new Uniform(saturation)],
        ['audioLevel', new Uniform(audioLevel)],
        ['audioReactive', new Uniform(audioReactive)],
        ['ridiculousMode', new Uniform(ridiculousMode)],
        ['resolution', new Uniform([resolution.x, resolution.y])]
      ])
    })
  }

  update(_renderer: any, _inputBuffer: any, deltaTime: number) {
    const time = this.uniforms.get('time')
    if (time) {
      time.value += deltaTime
    }
  }
}

interface HalftoneEffectProps {
  intensity?: number
  granularity?: number
  wetDry?: number
  saturation?: number
  audioLevel?: number
  audioReactive?: boolean
  ridiculousMode?: boolean
  resolution?: { x: number; y: number }
}

export const HalftoneEffect = forwardRef<HalftoneEffectImpl, HalftoneEffectProps>(
  function HalftoneEffect(
    {
      intensity = 0.5,
      granularity = 0.5,
      wetDry = 1.0,
      saturation = 1.0,
      audioLevel = 0,
      audioReactive = false,
      ridiculousMode = false,
      resolution = { x: 512, y: 512 }
    },
    ref
  ) {
    const effect = useMemo(() => {
      return new HalftoneEffectImpl({
        intensity,
        granularity,
        wetDry,
        saturation,
        audioLevel,
        audioReactive,
        ridiculousMode,
        resolution
      })
    }, [])

    // Update uniforms when props change
    useMemo(() => {
      effect.uniforms.get('intensity')!.value = intensity
      effect.uniforms.get('granularity')!.value = granularity
      effect.uniforms.get('wetDry')!.value = wetDry
      effect.uniforms.get('saturation')!.value = saturation
      effect.uniforms.get('audioLevel')!.value = audioLevel
      effect.uniforms.get('audioReactive')!.value = audioReactive
      effect.uniforms.get('ridiculousMode')!.value = ridiculousMode
      effect.uniforms.get('resolution')!.value = [resolution.x, resolution.y]
    }, [effect, intensity, granularity, wetDry, saturation, audioLevel, audioReactive, ridiculousMode, resolution])

    return <primitive ref={ref} object={effect} />
  }
)

export { HalftoneEffectImpl }
