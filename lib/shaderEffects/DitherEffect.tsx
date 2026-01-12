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
  uniform bool uRidiculousMode;
  uniform float uTime;

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

  // Random function for ridiculous mode
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
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

    // === RIDICULOUS MODE EFFECTS ===
    if (uRidiculousMode && uAudioReactive) {
      // Swap colors on beats
      if (uAudioLevel > 0.6) {
        finalColor = 1.0 - finalColor;
      }

      // Rainbow cycling through the dither
      float hueShift = uv.y * 3.14159 + uTime * 3.0 + uAudioLevel * 6.28318;
      float cosH = cos(hueShift);
      float sinH = sin(hueShift);
      mat3 hueMatrix = mat3(
        0.299 + 0.701*cosH + 0.168*sinH, 0.587 - 0.587*cosH + 0.330*sinH, 0.114 - 0.114*cosH - 0.497*sinH,
        0.299 - 0.299*cosH - 0.328*sinH, 0.587 + 0.413*cosH + 0.035*sinH, 0.114 - 0.114*cosH + 0.292*sinH,
        0.299 - 0.300*cosH + 1.250*sinH, 0.587 - 0.588*cosH - 1.050*sinH, 0.114 + 0.886*cosH - 0.203*sinH
      );
      finalColor = hueMatrix * finalColor;

      // Extreme saturation on peaks
      if (uAudioLevel > 0.5) {
        float gray = dot(finalColor, vec3(0.299, 0.587, 0.114));
        finalColor = mix(vec3(gray), finalColor, 1.0 + uAudioLevel * 4.0);
      }

      // Random color channel swapping
      if (uAudioLevel > 0.75 && random(vec2(floor(uTime * 4.0), 0.0)) > 0.5) {
        finalColor = finalColor.brg;
      }

      // Bright neon boost
      finalColor = finalColor * (1.2 + uAudioLevel * 1.5);
      finalColor = clamp(finalColor, 0.0, 1.0);
    }

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
  ridiculousMode?: boolean
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
      ridiculousMode = false,
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
        ["uRidiculousMode", new Uniform(ridiculousMode)],
        ["uTime", new Uniform(0)],
      ]),
    })
  }

  update(_renderer: any, _inputBuffer: any, deltaTime?: number) {
    if (deltaTime) {
      const timeUniform = this.uniforms.get("uTime")
      if (timeUniform) {
        timeUniform.value += deltaTime
      }
    }
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
  ridiculousMode?: boolean
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
    ridiculousMode = false,
  } = props

  const effect = useMemo(
    () => new DitherEffectImpl({ intensity, granularity, wetDry, color1, color2, audioLevel, audioReactive, ridiculousMode }),
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
    effect.uniforms.get("uRidiculousMode")!.value = ridiculousMode
  }, [effect, intensity, granularity, wetDry, color1, color2, audioLevel, audioReactive, ridiculousMode])

  return <primitive ref={ref} object={effect} dispose={null} />
})

DitherEffect.displayName = "DitherEffect"

export type { DitherEffectProps }
