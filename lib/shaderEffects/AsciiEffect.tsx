"use client"

import { forwardRef, useMemo } from "react"
import { Effect, BlendFunction } from "postprocessing"
import { Uniform, Vector2 } from "three"

/**
 * ASCII Effect
 * Adapted from Efecto export with universal controls
 *
 * Converts video to ASCII-style character rendering
 * - Cell-based sampling
 * - Character brightness mapping
 * - Optional color preservation
 * - Scanlines and post-processing
 */

const fragmentShader = `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uGranularity;
  uniform float uWetDry;
  uniform vec2 uResolution;
  uniform bool uColorMode;
  uniform float uScanlineIntensity;
  uniform float uAudioLevel;
  uniform bool uAudioReactive;
  uniform bool uRidiculousMode;
  uniform float uSaturation;

  // Helper functions
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  // ASCII character patterns based on brightness
  float getChar(float brightness, vec2 p) {
    vec2 grid = floor(p * 4.0);
    float val = 0.0;

    // Standard ASCII style with multiple brightness levels
    if (brightness < 0.1) {
      // Nearly black - single dot
      val = (grid.x == 1.0 && grid.y == 1.0) ? 0.2 : 0.0;
    } else if (brightness < 0.2) {
      // Very dark - period/comma
      val = (grid.x == 1.0 && grid.y == 1.0) ? 0.4 : 0.0;
    } else if (brightness < 0.3) {
      // Dark - colon
      val = ((grid.x == 1.0 || grid.x == 2.0) && (grid.y == 1.0 || grid.y == 2.0)) ? 0.6 : 0.0;
    } else if (brightness < 0.4) {
      // Medium dark - semicolon
      val = (grid.y == 1.0 || grid.y == 2.0) ? 0.7 : 0.0;
    } else if (brightness < 0.5) {
      // Medium - equals
      val = (grid.y == 1.0 || grid.y == 2.0) ? 0.8 : 0.0;
    } else if (brightness < 0.6) {
      // Medium bright - plus
      val = (grid.x == 1.0 || grid.x == 2.0 || grid.y == 1.0 || grid.y == 2.0) ? 0.85 : 0.0;
    } else if (brightness < 0.7) {
      // Bright - asterisk
      val = (grid.y == 0.0 || grid.y == 3.0) ? 0.9 : (grid.y == 1.0 || grid.y == 2.0) ? 0.7 : 0.0;
    } else if (brightness < 0.8) {
      // Very bright - hash
      val = (grid.x == 0.0 || grid.x == 2.0 || grid.y == 0.0 || grid.y == 2.0) ? 0.95 : 0.5;
    } else if (brightness < 0.9) {
      // Near white - at sign
      val = (grid.x == 0.0 || grid.x == 3.0 || grid.y == 0.0 || grid.y == 3.0) ? 1.0 : 0.6;
    } else {
      // White - solid block
      val = 1.0;
    }

    return val;
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

    // Calculate cell size from granularity (higher granularity = larger cells = coarser)
    // Range: 2 pixels (fine) to 16 pixels (coarse)
    // Audio reactive: cell size increases with audio level for pulsing effect
    float baseCellSize = mix(2.0, 16.0, uGranularity);
    float cellSize = baseCellSize * (1.0 + audioBoost * 0.5);

    // Calculate cell grid
    vec2 cellCount = uResolution / cellSize;
    vec2 cellCoord = floor(uv * cellCount);

    // Add jitter based on intensity (boosted by audio)
    float jitterThreshold = 0.5 - audioBoost * 0.3;
    if (uIntensity > jitterThreshold) {
      float jitterAmount = (uIntensity - jitterThreshold) * 2.0 * (1.0 + audioBoost);
      float jitterX = (random(vec2(cellCoord.y, floor(uTime * 10.0))) - 0.5) * jitterAmount * 0.5;
      cellCoord.x += jitterX;
    }

    // Sample center of cell
    vec2 cellUV = (cellCoord + 0.5) / cellCount;
    vec4 cellColor = texture2D(inputBuffer, cellUV);

    // Calculate brightness
    float brightness = dot(cellColor.rgb, vec3(0.299, 0.587, 0.114));

    // Boost contrast based on intensity (enhanced by audio)
    float contrastBoost = 1.0 + uIntensity + audioBoost * 0.5;
    brightness = (brightness - 0.5) * contrastBoost + 0.5;
    brightness = clamp(brightness, 0.0, 1.0);

    // Get local UV within cell
    vec2 localUV = fract(uv * cellCount);

    // Get character value
    float charValue = getChar(brightness, localUV);

    // Apply color mode (preserve original colors or grayscale)
    vec3 asciiColor;
    if (uColorMode) {
      // Boost saturation slightly for color mode
      vec3 boostedColor = cellColor.rgb * (1.0 + uIntensity * 0.3);
      asciiColor = boostedColor * charValue;
    } else {
      asciiColor = vec3(brightness * charValue);
    }

    // Add scanlines based on intensity
    float scanlineAmount = uIntensity * 0.3;
    if (scanlineAmount > 0.0) {
      float scanline = sin(uv.y * uResolution.y * 0.5) * 0.5 + 0.5;
      asciiColor *= 1.0 - (scanline * scanlineAmount);
    }

    // Add subtle noise based on intensity
    if (uIntensity > 0.3) {
      float noiseAmount = (uIntensity - 0.3) * 0.1;
      float noise = random(uv + uTime * 0.1);
      asciiColor += (noise - 0.5) * noiseAmount;
    }

    // Mix with original based on wet/dry
    vec3 finalColor = mix(inputColor.rgb, asciiColor, uWetDry);

    // === RIDICULOUS MODE EFFECTS ===
    if (uRidiculousMode) {
      // Static XL effects (work without audio reactive)
      // Slow color tint cycling
      float staticTintPhase = uTime * 0.5;
      vec3 staticTint = vec3(
        0.8 + 0.2 * sin(staticTintPhase),
        0.8 + 0.2 * sin(staticTintPhase + 2.094),
        0.8 + 0.2 * sin(staticTintPhase + 4.188)
      );
      finalColor = finalColor * staticTint * 1.2;

      // Subtle Matrix rain effect
      float rainColumn = floor(uv.x * 40.0);
      float rainSpeed = random(vec2(rainColumn, 0.0)) * 2.0 + 1.0;
      float rainPhase = fract(uv.y + uTime * rainSpeed * 0.3);
      float rainBrightness = smoothstep(0.0, 0.3, rainPhase) * smoothstep(1.0, 0.5, rainPhase);
      if (random(vec2(rainColumn, floor(uTime * 2.0))) > 0.8) {
        finalColor = mix(finalColor, finalColor * (0.7 + rainBrightness * 0.5), 0.3);
      }

      // Audio reactive XL effects (only when REACT is on)
      if (uAudioReactive) {
        // Negative flash on strong beats
        if (uAudioLevel > 0.75 && random(vec2(floor(uTime * 10.0), 0.0)) > 0.5) {
          finalColor = 1.0 - finalColor;
        }

        // Enhanced color tint cycling
        float tintPhase = uTime * 2.0 + uAudioLevel * 3.0;
        vec3 tint = vec3(
          0.5 + 0.5 * sin(tintPhase),
          0.5 + 0.5 * sin(tintPhase + 2.094),
          0.5 + 0.5 * sin(tintPhase + 4.188)
        );
        finalColor = mix(finalColor, finalColor * tint * 1.5, uAudioLevel * 0.5);

        // Scanline intensity boost
        float scanlinePulse = sin(uv.y * 200.0 + uTime * 20.0) * 0.5 + 0.5;
        finalColor *= 1.0 - (scanlinePulse * uAudioLevel * 0.4);

        // Random block glitches
        float blockX = floor(uv.x * 16.0);
        float blockY = floor(uv.y * 16.0);
        float blockNoise = random(vec2(blockX + blockY * 16.0, floor(uTime * 8.0)));
        if (blockNoise > 0.92 - uAudioLevel * 0.15) {
          finalColor = 1.0 - finalColor;
        }

        // Brightness pump with audio
        finalColor *= 0.8 + uAudioLevel * 0.5;
      }

      finalColor = clamp(finalColor, 0.0, 1.0);
    }

    // === SATURATION ===
    float grayFinal = dot(finalColor, vec3(0.299, 0.587, 0.114));
    finalColor = mix(vec3(grayFinal), finalColor, uSaturation);

    outputColor = vec4(finalColor, 1.0);
  }
`

interface AsciiEffectOptions {
  intensity?: number
  granularity?: number
  wetDry?: number
  colorMode?: boolean
  resolution?: Vector2
  audioLevel?: number
  audioReactive?: boolean
  ridiculousMode?: boolean
  saturation?: number
}

class AsciiEffectImpl extends Effect {
  constructor(options: AsciiEffectOptions = {}) {
    const {
      intensity = 0.5,
      granularity = 0.5,
      wetDry = 1.0,
      colorMode = true,
      resolution = new Vector2(408, 408),
      audioLevel = 0,
      audioReactive = false,
      ridiculousMode = false,
      saturation = 1.0,
    } = options

    super("AsciiEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ["uTime", new Uniform(0)],
        ["uIntensity", new Uniform(intensity)],
        ["uGranularity", new Uniform(granularity)],
        ["uWetDry", new Uniform(wetDry)],
        ["uResolution", new Uniform(resolution)],
        ["uColorMode", new Uniform(colorMode)],
        ["uScanlineIntensity", new Uniform(0)],
        ["uAudioLevel", new Uniform(audioLevel)],
        ["uAudioReactive", new Uniform(audioReactive)],
        ["uRidiculousMode", new Uniform(ridiculousMode)],
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

interface AsciiEffectProps {
  intensity?: number
  granularity?: number
  wetDry?: number
  colorMode?: boolean
  resolution?: Vector2
  audioLevel?: number
  audioReactive?: boolean
  ridiculousMode?: boolean
  saturation?: number
}

export const AsciiEffect = forwardRef<AsciiEffectImpl, AsciiEffectProps>((props, ref) => {
  const {
    intensity = 0.5,
    granularity = 0.5,
    wetDry = 1.0,
    colorMode = true,
    resolution = new Vector2(408, 408),
    audioLevel = 0,
    audioReactive = false,
    ridiculousMode = false,
    saturation = 1.0,
  } = props

  const effect = useMemo(
    () => new AsciiEffectImpl({ intensity, granularity, wetDry, colorMode, resolution, audioLevel, audioReactive, ridiculousMode, saturation }),
    []
  )

  // Update uniforms when props change
  useMemo(() => {
    effect.uniforms.get("uIntensity")!.value = intensity
    effect.uniforms.get("uGranularity")!.value = granularity
    effect.uniforms.get("uWetDry")!.value = wetDry
    effect.uniforms.get("uColorMode")!.value = colorMode
    effect.uniforms.get("uResolution")!.value = resolution
    effect.uniforms.get("uAudioLevel")!.value = audioLevel
    effect.uniforms.get("uAudioReactive")!.value = audioReactive
    effect.uniforms.get("uRidiculousMode")!.value = ridiculousMode
    effect.uniforms.get("uSaturation")!.value = saturation
  }, [effect, intensity, granularity, wetDry, colorMode, resolution, audioLevel, audioReactive, ridiculousMode, saturation])

  return <primitive ref={ref} object={effect} dispose={null} />
})

AsciiEffect.displayName = "AsciiEffect"

export type { AsciiEffectProps }
