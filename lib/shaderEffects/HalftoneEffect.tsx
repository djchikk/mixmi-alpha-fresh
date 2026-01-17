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

  // Rotate a 2D point around origin
  vec2 rotate2D(vec2 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  }

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

    // Cell size based on granularity (smaller = more dots)
    float cellSize = mix(4.0, 20.0, 1.0 - effectiveGranularity);

    // Grid angle - classic halftone uses 45 degrees, add slight animation
    float angle = 0.785398; // 45 degrees in radians
    if (audioReactive) {
      angle += sin(time * 0.5) * 0.1 * audioLevel;
    }

    // Convert UV to pixel coordinates
    vec2 pixelCoord = uv * resolution;

    // Rotate the coordinate system for angled grid
    vec2 rotatedCoord = rotate2D(pixelCoord, angle);

    // Find which cell we're in
    vec2 cellIndex = floor(rotatedCoord / cellSize);
    vec2 cellCenter = (cellIndex + 0.5) * cellSize;

    // Rotate back to get the actual center position in UV space
    vec2 centerUV = rotate2D(cellCenter, -angle) / resolution;

    // Sample the color at cell center
    vec3 sampleColor = texture2D(inputBuffer, centerUV).rgb;

    // Calculate luminosity at cell center
    float luma = dot(sampleColor, vec3(0.299, 0.587, 0.114));

    // Invert luma for dot size (darker = bigger dots)
    float dotSize = (1.0 - luma) * cellSize * 0.5 * effectiveIntensity;

    // Add subtle pulsing to dot size with audio
    if (audioReactive) {
      dotSize *= 1.0 + audioLevel * 0.3;
    }

    // Distance from current pixel to cell center
    vec2 toCenter = rotatedCoord - cellCenter;
    float dist = length(toCenter);

    // Create the dot with smooth edges
    float dot = 1.0 - smoothstep(dotSize - 1.0, dotSize + 1.0, dist);

    // Mono halftone base color (black dots on white, or inverse)
    vec3 halftoneColor = vec3(1.0 - dot);

    // Option to tint with original color based on intensity
    // At low intensity, more color comes through; at high intensity, more pure halftone
    vec3 tintedHalftone = mix(
      halftoneColor * sampleColor * 2.0,  // Tinted version
      halftoneColor,                       // Pure mono version
      effectiveIntensity * 0.7
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
