"use client"

/**
 * HolographicEffect - Iridescent color shifting shader
 *
 * Creates a holographic/iridescent effect like holographic trading cards.
 * Colors shift based on luminosity and animate over time.
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

  // Convert RGB to HSV
  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  // Convert HSV to RGB
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  // Rainbow color based on position and time
  vec3 rainbow(float t) {
    return hsv2rgb(vec3(t, 0.8, 1.0));
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 color = inputColor.rgb;

    // Calculate luminosity
    float luma = dot(color, vec3(0.299, 0.587, 0.114));

    // Calculate effective intensity
    float effectiveIntensity = intensity;
    float effectiveGranularity = granularity;

    if (audioReactive) {
      float audioBoost = ridiculousMode ? audioLevel * 3.0 : audioLevel;
      effectiveIntensity = clamp(intensity + audioBoost * 0.5, 0.0, 1.5);
      effectiveGranularity = clamp(granularity + audioBoost * 0.3, 0.0, 1.0);
    }

    // Create holographic shift based on position, luminosity, and time
    float shift = uv.x * effectiveGranularity * 2.0
                + uv.y * effectiveGranularity * 1.5
                + luma * 0.5
                + time * 0.15;

    // Add subtle wave pattern
    float wave = sin(uv.x * 20.0 * effectiveGranularity + time) * 0.05;
    float wave2 = sin(uv.y * 15.0 * effectiveGranularity + time * 0.7) * 0.05;
    shift += wave + wave2;

    // Get rainbow color
    vec3 holoColor = rainbow(fract(shift));

    // Blend holographic color with original based on intensity
    // Preserve luminosity structure while adding iridescence
    vec3 blendedColor = mix(color, holoColor * (0.5 + luma * 0.5), effectiveIntensity * 0.6);

    // Add shimmer highlights on bright areas
    float shimmer = sin(shift * 30.0 + time * 2.0) * 0.5 + 0.5;
    shimmer = pow(shimmer, 3.0) * luma * effectiveIntensity * 0.3;
    blendedColor += vec3(shimmer);

    // Apply saturation adjustment
    vec3 gray = vec3(dot(blendedColor, vec3(0.299, 0.587, 0.114)));
    blendedColor = mix(gray, blendedColor, saturation);

    // Mix with original based on wet/dry
    vec3 finalColor = mix(color, blendedColor, wetDry);

    outputColor = vec4(finalColor, inputColor.a);
  }
`

class HolographicEffectImpl extends Effect {
  constructor({
    intensity = 0.5,
    granularity = 0.5,
    wetDry = 1.0,
    saturation = 1.0,
    audioLevel = 0,
    audioReactive = false,
    ridiculousMode = false
  } = {}) {
    super('HolographicEffect', fragmentShader, {
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

interface HolographicEffectProps {
  intensity?: number
  granularity?: number
  wetDry?: number
  saturation?: number
  audioLevel?: number
  audioReactive?: boolean
  ridiculousMode?: boolean
}

export const HolographicEffect = forwardRef<HolographicEffectImpl, HolographicEffectProps>(
  function HolographicEffect(
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
      return new HolographicEffectImpl({
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

export { HolographicEffectImpl }
