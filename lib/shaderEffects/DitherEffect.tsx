"use client"

import { forwardRef, useMemo } from "react"
import { Effect, BlendFunction } from "postprocessing"
import { Uniform } from "three"

/**
 * Dither Effect
 * Adapted from Efecto export with universal controls
 *
 * Uses ordered dithering (Bayer matrix) for GPU performance
 * - Pixelation control
 * - Two-color palette (black + customizable color)
 * - Brightness/contrast adjustments
 * - Wet/dry mixing
 */

const fragmentShader = `
  uniform float uIntensity;
  uniform float uGranularity;
  uniform float uWetDry;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uThreshold;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uAudioLevel;
  uniform bool uAudioReactive;

  // 8x8 Bayer matrix for ordered dithering
  const int bayerMatrix[64] = int[64](
     0, 32,  8, 40,  2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44,  4, 36, 14, 46,  6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
     3, 35, 11, 43,  1, 33,  9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47,  7, 39, 13, 45,  5, 37,
    63, 31, 55, 23, 61, 29, 53, 21
  );

  float getBayerValue(vec2 coord) {
    int x = int(mod(coord.x, 8.0));
    int y = int(mod(coord.y, 8.0));
    return float(bayerMatrix[y * 8 + x]) / 64.0;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Early exit if completely dry
    if (uWetDry <= 0.0) {
      outputColor = inputColor;
      return;
    }

    // Audio reactive boost: when enabled, audio level modulates the effect
    float audioBoost = uAudioReactive ? uAudioLevel : 0.0;

    // Calculate pixelation from granularity (higher = larger blocks = coarser)
    // Range: 1 pixel (fine) to 8 pixels (blocky)
    // Audio reactive: pixelation increases with audio level for pulsing blocky effect
    float basePixelation = mix(1.0, 8.0, uGranularity);
    float pixelation = basePixelation * (1.0 + audioBoost * 1.0);

    // Apply pixelation
    vec2 pixelSize = vec2(pixelation) / resolution;
    vec2 pixelatedUV = floor(uv / pixelSize) * pixelSize + pixelSize * 0.5;

    vec4 color = texture2D(inputBuffer, pixelatedUV);

    // Calculate contrast from intensity (higher intensity = more contrast = harsher dither)
    // Audio reactive: contrast increases with audio level
    float contrast = mix(1.0, 1.8, uIntensity) * (1.0 + audioBoost * 0.4);
    float brightness = mix(0.9, 1.1, uIntensity) * (1.0 + audioBoost * 0.2);

    // Apply brightness and contrast
    color.rgb = ((color.rgb - 0.5) * contrast + 0.5) * brightness;
    color.rgb = clamp(color.rgb, 0.0, 1.0);

    // Calculate luminance
    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));

    // Get Bayer threshold for this pixel
    vec2 pixelCoord = uv * resolution / pixelation;
    float bayerThreshold = getBayerValue(pixelCoord);

    // Apply dithering threshold (intensity affects threshold spread)
    // Audio reactive: threshold spread increases with audio for more dramatic dither
    float thresholdMod = mix(0.8, 1.2, uIntensity) * (1.0 + audioBoost * 0.3);
    float ditherThreshold = bayerThreshold * thresholdMod;
    float ditheredValue = step(ditherThreshold, luma);

    // Map to two-color palette
    vec3 ditheredColor = mix(uColor1, uColor2, ditheredValue);

    // Mix with original based on wet/dry
    vec3 finalColor = mix(inputColor.rgb, ditheredColor, uWetDry);

    outputColor = vec4(finalColor, inputColor.a);
  }
`

// Helper to convert hex to RGB [0-1]
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [0, 0, 0]
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ]
}

interface DitherEffectOptions {
  intensity?: number
  granularity?: number
  wetDry?: number
  color1?: string
  color2?: string
  audioLevel?: number
  audioReactive?: boolean
}

class DitherEffectImpl extends Effect {
  constructor(options: DitherEffectOptions = {}) {
    const {
      intensity = 0.5,
      granularity = 0.3,
      wetDry = 1.0,
      color1 = "#000000",
      color2 = "#ffffff",
      audioLevel = 0,
      audioReactive = false,
    } = options

    const [r1, g1, b1] = hexToRgb(color1)
    const [r2, g2, b2] = hexToRgb(color2)

    super("DitherEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ["uIntensity", new Uniform(intensity)],
        ["uGranularity", new Uniform(granularity)],
        ["uWetDry", new Uniform(wetDry)],
        ["uBrightness", new Uniform(1.0)],
        ["uContrast", new Uniform(1.2)],
        ["uThreshold", new Uniform(1.0)],
        ["uColor1", new Uniform([r1, g1, b1])],
        ["uColor2", new Uniform([r2, g2, b2])],
        ["uAudioLevel", new Uniform(audioLevel)],
        ["uAudioReactive", new Uniform(audioReactive)],
      ]),
    })
  }
}

interface DitherEffectProps {
  intensity?: number
  granularity?: number
  wetDry?: number
  color1?: string
  color2?: string
  audioLevel?: number
  audioReactive?: boolean
}

export const DitherEffect = forwardRef<DitherEffectImpl, DitherEffectProps>((props, ref) => {
  const {
    intensity = 0.5,
    granularity = 0.3,
    wetDry = 1.0,
    color1 = "#000000",
    color2 = "#ffffff",
    audioLevel = 0,
    audioReactive = false,
  } = props

  const effect = useMemo(
    () => new DitherEffectImpl({ intensity, granularity, wetDry, color1, color2, audioLevel, audioReactive }),
    []
  )

  // Update uniforms when props change
  useMemo(() => {
    effect.uniforms.get("uIntensity")!.value = intensity
    effect.uniforms.get("uGranularity")!.value = granularity
    effect.uniforms.get("uWetDry")!.value = wetDry

    const [r1, g1, b1] = hexToRgb(color1)
    const [r2, g2, b2] = hexToRgb(color2)
    effect.uniforms.get("uColor1")!.value = [r1, g1, b1]
    effect.uniforms.get("uColor2")!.value = [r2, g2, b2]
    effect.uniforms.get("uAudioLevel")!.value = audioLevel
    effect.uniforms.get("uAudioReactive")!.value = audioReactive
  }, [effect, intensity, granularity, wetDry, color1, color2, audioLevel, audioReactive])

  return <primitive ref={ref} object={effect} dispose={null} />
})

DitherEffect.displayName = "DitherEffect"

export type { DitherEffectProps }
