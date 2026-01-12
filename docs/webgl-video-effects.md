# WebGL Video Effects Pipeline v1.0

> A real-time video effects system for the Mixmi Universal Mixer, featuring shader-based visual effects with audio reactivity.

**Created:** January 11, 2026
**Platform:** Mixmi Alpha

---

## Attribution & Credits

### Human Contributors
- **Sandy Hoover** (Mixmi) - Product vision, design direction, UI/UX decisions, creative guidance throughout the iterative development process

### AI Contributors
- **Claude** (Anthropic, via Claude Desktop) - Strategic planning, specification development, Efecto.app integration research, collaborative design sessions
- **Claude Code** (Anthropic, Opus 4.5 model) - Implementation, technical architecture, GLSL shader development, React component engineering

### Inspiration & Dependencies
- **Pablo Stanley / Efecto** ([efecto.app](https://efecto.app)) - Shader effect concepts and color palette inspiration. Pablo's generous sharing of his work and open approach to creative tools directly influenced the dither color presets and overall effect aesthetic
- **Three.js** - Core 3D rendering library
- **React Three Fiber** (@react-three/fiber) - React renderer for Three.js
- **postprocessing** - Post-processing effects library for Three.js
- **Reloop** - Hardware DJ controller design inspiration for the rotary knob UI

### A Note on AI Attribution
This documentation represents an experiment in crediting AI systems as collaborators in creative and technical work. As Mixmi builds toward a token-based attribution system, this record establishes precedent for tracking AI contributions alongside human ones. The collaborative nature of this work—iterating through design decisions, debugging together, and refining the user experience—demonstrates a new model of human-AI creative partnership.

---

## Technical Architecture

### Overview

The WebGL effects pipeline renders video content through a Three.js scene with real-time shader-based post-processing. The system supports multiple effect types, crossfade modes between two video sources, and audio-reactive parameter modulation.

```
Video Sources (Deck A/B)
        ↓
HTML5 Video Elements
        ↓
Three.js VideoTexture
        ↓
WebGL Scene (PlaneGeometry + ShaderMaterial)
        ↓
EffectComposer (postprocessing)
        ↓
Custom Effect Passes (VHS/ASCII/Dither)
        ↓
Canvas Output
```

### File Structure

```
components/mixer/compact/
├── WebGLVideoDisplay.tsx      # Main WebGL renderer component
├── WebGLControlBar.tsx        # Inline MIX/FX controls with effect buttons
├── WebGLFXPanel.tsx           # Expandable panel with knobs and color picker
├── Knob.tsx                   # Reloop-style rotary knob component
└── VideoDisplayArea.tsx       # Container managing display mode switching

lib/effects/
├── VHSEffect.ts               # VHS glitch/distortion shader
├── ASCIIEffect.ts             # ASCII character rendering shader
└── DitherEffect.ts            # Ordered dithering shader with color
```

### Effect System

Each effect extends the `postprocessing` library's `Effect` class:

```typescript
import { Effect } from 'postprocessing'

export class CustomEffect extends Effect {
  constructor() {
    super('CustomEffect', fragmentShader, {
      uniforms: new Map([
        ['intensity', new Uniform(0.5)],
        ['time', new Uniform(0)],
        // ... additional uniforms
      ])
    })
  }
}
```

### Shader Uniforms

All effects share common uniforms for consistent control:

| Uniform | Type | Range | Description |
|---------|------|-------|-------------|
| `intensity` | float | 0-1 | Effect strength/amount |
| `time` | float | 0-∞ | Animation time in seconds |
| `resolution` | vec2 | - | Output resolution in pixels |
| `granularity` | float | 0-1 | Detail/grain level |
| `wetDry` | float | 0-1 | Mix between original and effected |
| `saturation` | float | 0-2 | Color saturation multiplier |

### Effect-Specific Parameters

**VHS Effect:**
- Scanline intensity and spacing
- Chromatic aberration amount
- Noise/static grain
- Horizontal distortion

**ASCII Effect:**
- Character cell size (granularity)
- Character set density
- Edge detection influence
- Color preservation

**Dither Effect:**
- Dither pattern size (granularity)
- Highlight color (hex)
- Pattern type (ordered/Bayer)
- Color reduction levels

### Audio Reactivity

When enabled, audio levels modulate effect parameters in real-time:

```typescript
// Audio analysis runs in animation frame
const analyzeAudio = () => {
  analyser.getByteFrequencyData(dataArray)
  const average = dataArray.reduce((a, b) => a + b) / dataArray.length
  const normalizedLevel = average / 255 // 0-1 range

  // Modulate effect intensity
  effect.uniforms.get('intensity').value =
    baseIntensity + (normalizedLevel * reactivityAmount)
}
```

The VU meter visualizes this with 8 LED segments:
- Green (segments 1-4): Low levels
- Yellow (segments 5-6): Mid levels
- Red (segments 7-8): Peak levels

### Crossfade Modes

Three modes for transitioning between Deck A and Deck B:

| Mode | Behavior |
|------|----------|
| **Slide** | Split-screen wipe, position follows crossfader |
| **Blend** | Opacity crossfade between sources |
| **Cut** | Hard switch at 50% crossfader position |

---

## UI Components

### WebGLControlBar

Inline control bar rendered directly below the video display:

- **MIX Section:** Slide/Blend/Cut mode buttons
- **FX Section:** Effect toggle buttons (VHS, ASCII, DTHR, REACT)
- **VU Meter:** 8-segment audio level indicator (appears when REACT active)

Effect buttons use radial gradient styling with glow effects when active:
- VHS: Pink/Magenta (#EC84F3)
- ASCII: Orange (#FFAB6B)
- Dither: Yellow (#FFE66B)
- React: Green (#6BFFAA)

### WebGLFXPanel

Expandable panel with detailed controls:

- **Knob Row:** INT (Intensity), GRAIN (Granularity), WET (Wet/Dry), SAT (Saturation)
- **BOOST Button:** "11" mode for extreme audio reactivity (only when REACT on)
- **Color Section:** Picker + hex input + preset swatches (only for Dither effect)

### Knob Component

Reloop-inspired rotary knob with:
- 270° rotation range (-135° to +135°)
- Vertical drag interaction (up = increase, down = decrease)
- Dark textured surface with ridged pattern
- White indicator dot
- Double-click to reset to center

### Color Presets

Quick-select swatches for Dither effect:
- **Cyber:** #00FFFF (Electric cyan)
- **Retrowave:** #FF00FF (Hot pink)
- **Amber:** #FFC044 (Warm gold)
- **Matrix:** #00FF00 (Classic green)

---

## Adding New Effects

### 1. Create Effect Class

```typescript
// lib/effects/NewEffect.ts
import { Effect } from 'postprocessing'
import { Uniform } from 'three'

const fragmentShader = `
  uniform float intensity;
  uniform float time;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec4 color = inputColor;
    // Your shader logic here
    outputColor = mix(inputColor, color, intensity);
  }
`

export class NewEffect extends Effect {
  constructor() {
    super('NewEffect', fragmentShader, {
      uniforms: new Map([
        ['intensity', new Uniform(0.5)],
        ['time', new Uniform(0)]
      ])
    })
  }

  update(renderer, inputBuffer, deltaTime) {
    this.uniforms.get('time').value += deltaTime
  }
}
```

### 2. Register in WebGLVideoDisplay

```typescript
// Add to WebGLEffectType union
export type WebGLEffectType = 'vhs' | 'ascii' | 'dither' | 'neweffect' | null

// Add to effect creation logic
case 'neweffect':
  return new NewEffect()
```

### 3. Add UI Controls

Add button to WebGLControlBar with appropriate color scheme and label.

---

## Performance Considerations

- Effects run at display refresh rate (typically 60fps)
- Video textures update every frame when playing
- Audio analysis uses Web Audio API's AnalyserNode
- Effect switching is instantaneous (no transition)
- Unused effects are not processed (conditional rendering)

### Optimization Tips

- Use `needsUpdate = false` on static textures
- Batch uniform updates when possible
- Consider reducing resolution for mobile devices
- Dispose of effects properly on unmount

---

## Future Possibilities

- Additional effects: Glitch, Pixelate, RGB Split, Kaleidoscope
- Effect chaining (multiple effects simultaneously)
- Preset system for saving/loading effect configurations
- MIDI controller mapping for hardware control
- Effect recording/export for video output
- LFO modulation for automated parameter movement

---

## Version History

### v1.0 (January 11, 2026)
- Initial release with VHS, ASCII, and Dither effects
- Audio reactivity with VU meter visualization
- Reloop-style rotary knob controls
- Color picker with preset palettes for Dither
- Three crossfade modes (Slide, Blend, Cut)
- "11" boost mode for extreme audio reactivity

---

*This documentation was collaboratively created by humans and AI systems working together. It represents not just technical specifications, but a record of creative partnership.*
