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
  uniform float uSaturation;

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

    // XL mode boost: adds static intensity boost even without audio reactive
    float xlBoost = uRidiculousMode ? 0.5 : 0.0;
    audioBoost += xlBoost;

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
    if (uRidiculousMode) {
      // Static XL effects (work without audio reactive)
      // Subtle random pixel flips for texture
      float staticFlipNoise = random(uv * 100.0 + floor(uTime * 3.0));
      if (staticFlipNoise > 0.95) {
        finalColor = 1.0 - finalColor;
      }

      // Occasional horizontal tear lines (subtle)
      float staticTearLine = random(vec2(floor(uv.y * 30.0), floor(uTime * 2.0)));
      if (staticTearLine > 0.92) {
        vec2 tearUV = uv + vec2((staticTearLine - 0.5) * 0.1, 0.0);
        vec4 tearColor = texture2D(inputBuffer, tearUV);
        float tearLuma = dot(tearColor.rgb, vec3(0.299, 0.587, 0.114));
        finalColor = mix(finalColor, mix(uColor1, uColor2, step(0.5, tearLuma)), 0.5);
      }

      // Audio reactive XL effects (only when REACT is on)
      if (uAudioReactive) {
        // Invert the dither pattern on strong beats
        if (uAudioLevel > 0.65) {
          finalColor = 1.0 - finalColor;
        }

        // Threshold chaos - randomly flip pixels based on audio
        float flipChance = uAudioLevel * 0.4;
        float flipNoise = random(uv * 100.0 + uTime);
        if (flipNoise < flipChance) {
          finalColor = 1.0 - finalColor;
        }

        // Strobe flash on peaks
        if (uAudioLevel > 0.8 && random(vec2(floor(uTime * 12.0), 0.0)) > 0.5) {
          finalColor = vec3(1.0);
        }

        // Horizontal tear/glitch lines
        float tearLine = random(vec2(floor(uv.y * 30.0), floor(uTime * 6.0)));
        if (tearLine > 0.85 && uAudioLevel > 0.4) {
          vec2 tearUV = uv + vec2((tearLine - 0.5) * 0.2, 0.0);
          vec4 tearColor = texture2D(inputBuffer, tearUV);
          float tearLuma = dot(tearColor.rgb, vec3(0.299, 0.587, 0.114));
          finalColor = mix(uColor1, uColor2, step(0.5, tearLuma));
        }

        // Random blocks of inverted dither
        float blockX = floor(uv.x * 8.0);
        float blockY = floor(uv.y * 8.0);
        float blockNoise = random(vec2(blockX + blockY * 8.0, floor(uTime * 5.0)));
        if (blockNoise > 0.9 - uAudioLevel * 0.3) {
          finalColor = 1.0 - finalColor;
        }
      }
    }

    // === SATURATION ===
    float grayFinal = dot(finalColor, vec3(0.299, 0.587, 0.114));
    finalColor = mix(vec3(grayFinal), finalColor, uSaturation);

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
  saturation?: number
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
      saturation = 1.0,
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
        ["uSaturation", new Uniform(saturation)],
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
  saturation?: number
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
    saturation = 1.0,
  } = props

  const effect = useMemo(
    () => new DitherEffectImpl({ intensity, granularity, wetDry, color1, color2, audioLevel, audioReactive, ridiculousMode, saturation }),
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
    effect.uniforms.get("uSaturation")!.value = saturation
  }, [effect, intensity, granularity, wetDry, color1, color2, audioLevel, audioReactive, ridiculousMode, saturation])

  return <primitive ref={ref} object={effect} dispose={null} />
})

DitherEffect.displayName = "DitherEffect"

export type { DitherEffectProps }
