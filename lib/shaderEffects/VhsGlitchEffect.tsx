"use client"

import { forwardRef, useMemo } from "react"
import { Effect } from "postprocessing"
import { Uniform } from "three"

/**
 * VHS Glitch Effect
 * Adapted from Efecto export with added wet/dry mixing
 *
 * Combines multiple glitch techniques:
 * - RGB shift / chromatic aberration
 * - Scanlines
 * - Noise displacement
 * - Vertical bar distortion (VHS style)
 * - Film grain
 */

const fragmentShader = `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uGranularity;
  uniform float uWetDry;
  uniform float uSpeed;
  uniform bool uAnimated;

  // Pseudo-random function
  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // Noise function
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = rand(i);
    float b = rand(i + vec2(1.0, 0.0));
    float c = rand(i + vec2(0.0, 1.0));
    float d = rand(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Vertical bar for VHS distortion
  float verticalBar(float pos, float uvY, float offset) {
    float edge0 = pos - 0.02;
    float edge1 = pos + 0.02;
    float x = smoothstep(edge0, pos, uvY) * offset;
    x -= smoothstep(pos, edge1, uvY) * offset;
    return x;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Early exit if wet/dry is 0 (completely dry)
    if (uWetDry <= 0.0) {
      outputColor = inputColor;
      return;
    }

    float t = uAnimated ? uTime * uSpeed : 0.0;
    vec2 texCoord = uv;

    // Scale effect parameters by intensity
    float intensity = uIntensity;
    float granularity = uGranularity;

    // Derived parameters from intensity and granularity
    float grain = intensity * 2.0;
    float glitchBlocks = intensity * 0.15;
    float rgbShift = intensity * 2.5;
    float scanlines = granularity * 4.0;
    float noiseAmount = intensity * 0.3;
    float distortion = intensity * 0.5;

    // === VHS-STYLE VERTICAL BAR DISTORTION ===
    if (distortion > 0.0) {
      for (float i = 0.0; i < 0.71; i += 0.1313) {
        float d = mod(t * i, 1.7);
        float o = sin(1.0 - tan(t * 0.24 * i));
        o *= distortion * 0.05;
        texCoord.x += verticalBar(d, texCoord.y, o);
      }
    }

    // === NOISE DISPLACEMENT ===
    if (noiseAmount > 0.0) {
      float noiseY = texCoord.y * (50.0 + granularity * 200.0);
      noiseY = float(int(noiseY)) * (1.0 / (50.0 + granularity * 200.0));
      float noiseVal = rand(vec2(t * 0.00001, noiseY));
      texCoord.x += noiseVal * noiseAmount * 0.01;
    }

    // === RGB SHIFT / CHROMATIC ABERRATION ===
    vec2 direction = texCoord - 0.5;
    float dist = length(direction) * 0.7;
    vec2 offset = dist * normalize(direction) * rgbShift * 0.02;

    vec2 offsetR = offset + vec2(sin(t) * 0.003, 0.0) * rgbShift;
    vec2 offsetB = -offset + vec2(cos(t * 0.97) * 0.003, 0.0) * rgbShift;

    float r = texture2D(inputBuffer, texCoord + offsetR).r;
    float g = texture2D(inputBuffer, texCoord).g;
    float b = texture2D(inputBuffer, texCoord + offsetB).b;

    vec3 color = vec3(r, g, b);

    // === SCANLINES ===
    if (scanlines > 0.0) {
      float scanlineFreq = 400.0 + granularity * 400.0;
      float scanline = sin(uv.y * scanlineFreq + t * 10.0) * 0.5 + 0.5;
      scanline = pow(scanline, 1.5);
      color *= 1.0 - (scanline * scanlines * 0.15);

      float hLineFreq = 150.0 + granularity * 150.0;
      float hLine = sin(uv.y * hLineFreq) * 0.5 + 0.5;
      hLine = step(0.98, hLine);
      color *= 1.0 - (hLine * scanlines * 0.1);
    }

    // === RANDOM GLITCH BLOCKS ===
    if (glitchBlocks > 0.0 && uAnimated) {
      float blockSize = 10.0 + granularity * 20.0;
      float blockThreshold = 1.0 - (glitchBlocks * 0.15);
      float blockNoise = rand(vec2(floor(uv.y * blockSize), floor(t * 10.0)));
      if (blockNoise > blockThreshold) {
        float blockOffset = (rand(vec2(floor(t * 30.0), floor(uv.y * blockSize))) - 0.5) * 0.1 * glitchBlocks;
        vec2 blockUV = vec2(uv.x + blockOffset, uv.y);
        color = texture2D(inputBuffer, blockUV).rgb;
      }
    }

    // === FILM GRAIN ===
    if (grain > 0.0) {
      float grainAmount = grain * (0.5 + granularity * 0.5);
      float grainNoise = rand(uv + t) * 0.05 * grainAmount;
      color += grainNoise - (0.025 * grainAmount);
    }

    // === WET/DRY MIX ===
    vec3 finalColor = mix(inputColor.rgb, color, uWetDry);

    outputColor = vec4(finalColor, 1.0);
  }
`

interface VhsGlitchEffectOptions {
  intensity?: number
  granularity?: number
  wetDry?: number
  speed?: number
  animated?: boolean
}

class VhsGlitchEffectImpl extends Effect {
  constructor(options: VhsGlitchEffectOptions = {}) {
    const {
      intensity = 0.5,
      granularity = 0.5,
      wetDry = 1.0,
      speed = 1.5,
      animated = true,
    } = options

    super("VhsGlitchEffect", fragmentShader, {
      uniforms: new Map([
        ["uTime", new Uniform(0)],
        ["uIntensity", new Uniform(intensity)],
        ["uGranularity", new Uniform(granularity)],
        ["uWetDry", new Uniform(wetDry)],
        ["uSpeed", new Uniform(speed)],
        ["uAnimated", new Uniform(animated)],
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

interface VhsGlitchEffectProps {
  intensity?: number
  granularity?: number
  wetDry?: number
  speed?: number
  animated?: boolean
}

export const VhsGlitchEffect = forwardRef<VhsGlitchEffectImpl, VhsGlitchEffectProps>((props, ref) => {
  const {
    intensity = 0.5,
    granularity = 0.5,
    wetDry = 1.0,
    speed = 1.5,
    animated = true,
  } = props

  const effect = useMemo(
    () => new VhsGlitchEffectImpl({
      intensity, granularity, wetDry, speed, animated
    }),
    []
  )

  // Update uniforms when props change
  useMemo(() => {
    effect.uniforms.get("uIntensity")!.value = intensity
    effect.uniforms.get("uGranularity")!.value = granularity
    effect.uniforms.get("uWetDry")!.value = wetDry
    effect.uniforms.get("uSpeed")!.value = speed
    effect.uniforms.get("uAnimated")!.value = animated
  }, [effect, intensity, granularity, wetDry, speed, animated])

  return <primitive ref={ref} object={effect} dispose={null} />
})

VhsGlitchEffect.displayName = "VhsGlitchEffect"

export type { VhsGlitchEffectProps }
