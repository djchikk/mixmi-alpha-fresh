"use client"

/**
 * PrismEffect - Chromatic Dispersion/RGB Split shader
 *
 * Separates RGB channels with different offsets, like light through a prism.
 * Creates a dreamy, ethereal quality with subtle animation.
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

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Calculate effective intensity
    float effectiveIntensity = intensity;
    float effectiveGranularity = granularity;

    if (audioReactive) {
      float audioBoost = ridiculousMode ? audioLevel * 4.0 : audioLevel;
      effectiveIntensity = clamp(intensity + audioBoost * 0.6, 0.0, 1.5);
      effectiveGranularity = clamp(granularity + audioBoost * 0.4, 0.0, 1.0);
    }

    // Calculate offset amount based on distance from center
    vec2 center = vec2(0.5);
    vec2 toCenter = uv - center;
    float dist = length(toCenter);

    // Animate the offset direction
    float angle = atan(toCenter.y, toCenter.x);
    float animatedAngle = angle + time * 0.3 * effectiveGranularity;

    // Calculate RGB channel offsets
    float offsetAmount = effectiveIntensity * 0.03 * (1.0 + dist * 2.0);

    // Add subtle pulsing
    float pulse = 1.0 + sin(time * 2.0) * 0.2 * effectiveGranularity;
    offsetAmount *= pulse;

    // Create directional offsets for each channel
    vec2 redOffset = vec2(cos(animatedAngle), sin(animatedAngle)) * offsetAmount;
    vec2 greenOffset = vec2(0.0); // Green stays centered
    vec2 blueOffset = vec2(cos(animatedAngle + 3.14159), sin(animatedAngle + 3.14159)) * offsetAmount;

    // Sample each channel at different positions
    float r = texture2D(inputBuffer, uv + redOffset).r;
    float g = texture2D(inputBuffer, uv + greenOffset).g;
    float b = texture2D(inputBuffer, uv + blueOffset).b;

    vec3 prismColor = vec3(r, g, b);

    // Add subtle rainbow edge fringing
    float fringe = sin(dist * 30.0 - time * 2.0) * 0.5 + 0.5;
    fringe = pow(fringe, 4.0) * effectiveIntensity * 0.15;
    prismColor += vec3(fringe * 0.3, fringe * 0.1, fringe * 0.4);

    // Apply saturation adjustment
    vec3 gray = vec3(dot(prismColor, vec3(0.299, 0.587, 0.114)));
    prismColor = mix(gray, prismColor, saturation);

    // Mix with original based on wet/dry
    vec3 originalColor = inputColor.rgb;
    vec3 finalColor = mix(originalColor, prismColor, wetDry);

    outputColor = vec4(finalColor, inputColor.a);
  }
`

class PrismEffectImpl extends Effect {
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
    super('PrismEffect', fragmentShader, {
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

interface PrismEffectProps {
  intensity?: number
  granularity?: number
  wetDry?: number
  saturation?: number
  audioLevel?: number
  audioReactive?: boolean
  ridiculousMode?: boolean
  resolution?: { x: number; y: number }
}

export const PrismEffect = forwardRef<PrismEffectImpl, PrismEffectProps>(
  function PrismEffect(
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
      return new PrismEffectImpl({
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

export { PrismEffectImpl }
