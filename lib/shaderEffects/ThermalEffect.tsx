"use client"

/**
 * ThermalEffect - Heat Map Visualization shader
 *
 * Converts the image to a thermal camera aesthetic, mapping luminosity
 * to a heat color gradient (black→blue→purple→red→orange→yellow→white).
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

  // Thermal color palette - maps 0-1 to heat colors
  vec3 thermalColor(float t) {
    // Color stops: black → blue → purple → red → orange → yellow → white
    vec3 black = vec3(0.0, 0.0, 0.0);
    vec3 darkBlue = vec3(0.0, 0.0, 0.5);
    vec3 blue = vec3(0.0, 0.2, 0.8);
    vec3 purple = vec3(0.5, 0.0, 0.8);
    vec3 red = vec3(0.9, 0.1, 0.1);
    vec3 orange = vec3(1.0, 0.5, 0.0);
    vec3 yellow = vec3(1.0, 1.0, 0.2);
    vec3 white = vec3(1.0, 1.0, 1.0);

    // Interpolate between color stops
    if (t < 0.14) {
      return mix(black, darkBlue, t / 0.14);
    } else if (t < 0.28) {
      return mix(darkBlue, blue, (t - 0.14) / 0.14);
    } else if (t < 0.42) {
      return mix(blue, purple, (t - 0.28) / 0.14);
    } else if (t < 0.56) {
      return mix(purple, red, (t - 0.42) / 0.14);
    } else if (t < 0.70) {
      return mix(red, orange, (t - 0.56) / 0.14);
    } else if (t < 0.85) {
      return mix(orange, yellow, (t - 0.70) / 0.15);
    } else {
      return mix(yellow, white, (t - 0.85) / 0.15);
    }
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 color = inputColor.rgb;

    // Calculate luminosity
    float luma = dot(color, vec3(0.299, 0.587, 0.114));

    // Calculate effective intensity
    float effectiveIntensity = intensity;
    float effectiveGranularity = granularity;

    if (audioReactive) {
      float audioBoost = ridiculousMode ? audioLevel * 3.5 : audioLevel;
      effectiveIntensity = clamp(intensity + audioBoost * 0.5, 0.0, 1.5);
      effectiveGranularity = clamp(granularity + audioBoost * 0.3, 0.0, 1.0);
    }

    // Add subtle heat shimmer/distortion
    float shimmer = sin(uv.y * 50.0 * effectiveGranularity + time * 3.0) * 0.003;
    shimmer += sin(uv.x * 30.0 * effectiveGranularity + time * 2.0) * 0.002;
    float distortedLuma = luma + shimmer * effectiveIntensity;

    // Add heat rise animation effect
    float heatRise = sin(uv.x * 10.0 + time) * 0.02 * effectiveGranularity;
    distortedLuma += heatRise * (1.0 - uv.y); // More effect at bottom

    // Clamp and apply thermal color mapping
    distortedLuma = clamp(distortedLuma, 0.0, 1.0);

    // Quantize for that digital thermal camera look (controlled by granularity)
    float levels = mix(256.0, 16.0, effectiveGranularity);
    float quantized = floor(distortedLuma * levels) / levels;

    // Mix between smooth and quantized based on granularity
    float finalLuma = mix(distortedLuma, quantized, effectiveGranularity * 0.5);

    // Get thermal color
    vec3 thermalCol = thermalColor(finalLuma);

    // Add subtle hot spot glow on brightest areas
    float hotGlow = smoothstep(0.8, 1.0, finalLuma) * effectiveIntensity * 0.3;
    thermalCol += vec3(hotGlow, hotGlow * 0.8, hotGlow * 0.3);

    // Apply saturation adjustment (thermal is already colored, so this adjusts vibrancy)
    vec3 gray = vec3(dot(thermalCol, vec3(0.299, 0.587, 0.114)));
    thermalCol = mix(gray, thermalCol, saturation);

    // Mix with original based on wet/dry
    vec3 finalColor = mix(color, thermalCol, wetDry * effectiveIntensity);

    outputColor = vec4(finalColor, inputColor.a);
  }
`

class ThermalEffectImpl extends Effect {
  constructor({
    intensity = 0.5,
    granularity = 0.5,
    wetDry = 1.0,
    saturation = 1.0,
    audioLevel = 0,
    audioReactive = false,
    ridiculousMode = false
  } = {}) {
    super('ThermalEffect', fragmentShader, {
      uniforms: new Map([
        ['intensity', new Uniform(intensity)],
        ['granularity', new Uniform(granularity)],
        ['wetDry', new Uniform(wetDry)],
        ['time', new Uniform(0)],
        ['saturation', new Uniform(saturation)],
        ['audioLevel', new Uniform(audioLevel)],
        ['audioReactive', new Uniform(audioReactive)],
        ['ridiculousMode', new Uniform(ridiculousMode)]
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

interface ThermalEffectProps {
  intensity?: number
  granularity?: number
  wetDry?: number
  saturation?: number
  audioLevel?: number
  audioReactive?: boolean
  ridiculousMode?: boolean
}

export const ThermalEffect = forwardRef<ThermalEffectImpl, ThermalEffectProps>(
  function ThermalEffect(
    {
      intensity = 0.5,
      granularity = 0.5,
      wetDry = 1.0,
      saturation = 1.0,
      audioLevel = 0,
      audioReactive = false,
      ridiculousMode = false
    },
    ref
  ) {
    const effect = useMemo(() => {
      return new ThermalEffectImpl({
        intensity,
        granularity,
        wetDry,
        saturation,
        audioLevel,
        audioReactive,
        ridiculousMode
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
    }, [effect, intensity, granularity, wetDry, saturation, audioLevel, audioReactive, ridiculousMode])

    return <primitive ref={ref} object={effect} />
  }
)

export { ThermalEffectImpl }
