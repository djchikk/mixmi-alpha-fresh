"use client"

/**
 * NeonGlowEffect - Edge Detection with Neon Glow shader
 *
 * Detects edges in the image and applies a vibrant neon glow effect.
 * Creates a cyberpunk/synthwave aesthetic with customizable glow colors.
 *
 * Design Credit: Claude (Anthropic) - January 2026
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

  // Sobel edge detection
  float sobelEdge(vec2 uv, vec2 texelSize) {
    // Sample surrounding pixels
    float tl = dot(texture2D(inputBuffer, uv + vec2(-texelSize.x, texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
    float t  = dot(texture2D(inputBuffer, uv + vec2(0.0, texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
    float tr = dot(texture2D(inputBuffer, uv + vec2(texelSize.x, texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
    float l  = dot(texture2D(inputBuffer, uv + vec2(-texelSize.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float r  = dot(texture2D(inputBuffer, uv + vec2(texelSize.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float bl = dot(texture2D(inputBuffer, uv + vec2(-texelSize.x, -texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
    float b  = dot(texture2D(inputBuffer, uv + vec2(0.0, -texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));
    float br = dot(texture2D(inputBuffer, uv + vec2(texelSize.x, -texelSize.y)).rgb, vec3(0.299, 0.587, 0.114));

    // Sobel operators
    float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
    float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;

    return sqrt(gx*gx + gy*gy);
  }

  // Neon color palette - cycles through vibrant colors
  vec3 neonColor(float t) {
    vec3 pink = vec3(1.0, 0.2, 0.6);
    vec3 cyan = vec3(0.0, 1.0, 1.0);
    vec3 purple = vec3(0.6, 0.2, 1.0);
    vec3 blue = vec3(0.2, 0.4, 1.0);

    float segment = fract(t) * 4.0;
    if (segment < 1.0) {
      return mix(pink, cyan, segment);
    } else if (segment < 2.0) {
      return mix(cyan, purple, segment - 1.0);
    } else if (segment < 3.0) {
      return mix(purple, blue, segment - 2.0);
    } else {
      return mix(blue, pink, segment - 3.0);
    }
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 color = inputColor.rgb;

    // Calculate effective intensity
    float effectiveIntensity = intensity;
    float effectiveGranularity = granularity;

    if (audioReactive) {
      float audioBoost = ridiculousMode ? audioLevel * 4.0 : audioLevel;
      effectiveIntensity = clamp(intensity + audioBoost * 0.7, 0.0, 1.5);
      effectiveGranularity = clamp(granularity + audioBoost * 0.5, 0.0, 1.0);
    }

    // Calculate texel size based on granularity
    vec2 texelSize = vec2(1.0) / resolution;
    texelSize *= 1.0 + effectiveGranularity * 3.0; // Coarser detection at higher granularity

    // Detect edges
    float edge = sobelEdge(uv, texelSize);

    // Enhance edge contrast
    edge = smoothstep(0.1, 0.5 + effectiveGranularity * 0.3, edge);
    edge = pow(edge, 0.8);

    // Animated color based on position and time
    float colorPhase = uv.x * 0.5 + uv.y * 0.3 + time * 0.2;

    // Add pulsing glow
    float pulse = sin(time * 3.0) * 0.5 + 0.5;
    pulse = 0.7 + pulse * 0.3;

    // Get neon color
    vec3 glowColor = neonColor(colorPhase) * pulse;

    // Create glow effect (edge with bloom)
    float glow = edge * effectiveIntensity * 2.0;
    float bloom = edge * effectiveIntensity * 0.5;
    bloom = pow(bloom, 0.5); // Soft bloom falloff

    // Combine edge and bloom
    vec3 neonEdge = glowColor * glow;
    vec3 neonBloom = glowColor * bloom * 0.5;

    // Dark background option based on intensity
    float darkBg = effectiveIntensity * 0.7;
    vec3 darkenedColor = color * (1.0 - darkBg * 0.8);

    // Combine: darkened original + neon edges + bloom
    vec3 neonResult = darkenedColor + neonEdge + neonBloom;

    // Add scan line effect for extra cyberpunk feel
    float scanLine = sin(uv.y * resolution.y * 0.5 + time * 2.0) * 0.5 + 0.5;
    scanLine = pow(scanLine, 8.0) * effectiveGranularity * 0.1;
    neonResult += glowColor * scanLine;

    // Apply saturation adjustment
    vec3 gray = vec3(dot(neonResult, vec3(0.299, 0.587, 0.114)));
    neonResult = mix(gray, neonResult, saturation);

    // Mix with original based on wet/dry
    vec3 finalColor = mix(color, neonResult, wetDry);

    outputColor = vec4(finalColor, inputColor.a);
  }
`

class NeonGlowEffectImpl extends Effect {
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
    super('NeonGlowEffect', fragmentShader, {
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

interface NeonGlowEffectProps {
  intensity?: number
  granularity?: number
  wetDry?: number
  saturation?: number
  audioLevel?: number
  audioReactive?: boolean
  ridiculousMode?: boolean
  resolution?: { x: number; y: number }
}

export const NeonGlowEffect = forwardRef<NeonGlowEffectImpl, NeonGlowEffectProps>(
  function NeonGlowEffect(
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
      return new NeonGlowEffectImpl({
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

export { NeonGlowEffectImpl }
