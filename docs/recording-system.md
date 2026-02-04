# Recording System Documentation

**Created:** February 2, 2026
**Last Updated:** February 3, 2026
**Status:** Core functionality working, extensive fixes applied

---

## Overview

The Recording System allows users to capture crossfaded audio from the Universal Mixer, trim it to 8-bar blocks, pay IP holders for the source material, and save the result as a draft track.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Universal Mixer                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Deck A ──┐                                              │    │
│  │           ├── Crossfader ── Master Gain ──┬── Speakers  │    │
│  │  Deck B ──┘                               │              │    │
│  │                                           │              │    │
│  │                    MediaStreamDestination ◄┘              │    │
│  │                           │                              │    │
│  │                    MediaRecorder (48kHz)                 │    │
│  │                           │                              │    │
│  │                      Audio Blob                          │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   RecordingWidget (Modal)                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  RecordingWaveform - 8-bar grid with trim handles        │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  TrimControls - Nudge buttons (1 bar / 1 beat / 1/16)   │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  BlockAudition - Preview individual 8-bar blocks         │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  CostDisplay - Sausage link pricing breakdown            │    │
│  └─────────────────────────────────────────────────────────┘    │
│  [Cancel]                              [Confirm & Pay $X.XX]     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Recording Flow (Updated February 3, 2026)

### State Machine

```
Idle → PreCountdown (4-3-2-1) → Armed → Rehearsal (1 full loop) → Recording → Stopped
```

**States in `useMixerRecording`:**

| State | Description | Visual Feedback |
|-------|-------------|-----------------|
| `idle` | Not recording | Default button |
| `preCountdown` | 4-3-2-1 countdown before arming | Button shows countdown number (cyan) |
| `armed` | Waiting for loop restart | Button shows "ARM" |
| `rehearsal` | Sync stabilization cycle | Button shows "SYNC" (amber) |
| `recording` | Actually capturing audio | Button pulses red |
| `stopped` | Recording complete | Modal appears |

### Detailed Flow

1. **User presses Record button**
2. **Sync Reset** (ref-based, avoids bundler issues):
   - If sync active with both decks loaded, recreate sync engine
   - Resets both decks to original BPM
   - Creates fresh SimpleLoopSync with same master
3. **Pre-Countdown** (4-3-2-1):
   - Timed to BPM
   - Gives user visual/audio preparation time
   - Button shows "4", "3", "2", "1"
4. **Armed State**:
   - Auto-starts playback if not playing
   - Registers for `window.onMixerRecordingLoopRestart` callback
   - Waits for first loop restart (bar 1)
5. **Rehearsal Cycle**:
   - Full loop plays through (sync stabilization)
   - Ensures decks are properly synced before recording
   - On next loop restart → start recording
6. **Recording**:
   - MediaRecorder captures at browser default sample rate (usually 48000Hz)
   - Starts precisely at bar 1
   - Captures until user presses Record again
7. **Stopped**:
   - Recording modal appears
   - User trims to 8-bar blocks
   - Confirms and pays

### Sync Reset Implementation (Critical)

The sync reset uses a **ref-based approach** to avoid bundler initialization errors:

```typescript
// In UniversalMixer.tsx

// Ref stores the sync reset function
const resetSyncForRecordingRef = React.useRef<() => void>(() => {});

// useEffect updates the ref whenever state changes
useEffect(() => {
  resetSyncForRecordingRef.current = () => {
    if (!mixerState.syncActive || !bothDecksLoaded) return;

    // Stop old sync engine
    syncEngineRef.current?.stop();

    // Reset BPMs to original
    deckA.audioControls.setBPM(deckA.track.bpm);
    deckB.audioControls.setBPM(deckB.track.bpm);

    // Recreate sync engine
    syncEngineRef.current = new SimpleLoopSync(...);
    syncEngineRef.current.enableSync();
  };
}, [mixerState]);

// In handleRecordToggle - just call the ref
resetSyncForRecordingRef.current();
```

**Why ref-based?** Adding the sync reset logic directly to `handleRecordToggle` caused "Cannot access 'tw' before initialization" bundler errors due to circular dependencies in useCallback chains.

---

## Sample Rate Handling (Critical Fix - February 3, 2026)

### The Problem

- **Mixer AudioContext:** 44100Hz (Web Audio default)
- **MediaRecorder:** Captures at browser's default (typically 48000Hz)
- **Mismatch causes:** Recordings play at wrong speed (half speed if 48kHz interpreted as 44.1kHz)

### The Solution

**1. Decoding recorded audio:**
```typescript
// In useMixerRecording.ts - stopRecording()

// WRONG: Using mixer's context
const audioContext = getAudioContext(); // 44100Hz - CAUSES HALF SPEED!

// CORRECT: Fresh context at browser default
const decodeContext = new AudioContext(); // Browser default (48000Hz)
const audioBuffer = await decodeContext.decodeAudioData(arrayBuffer);
decodeContext.close();
```

**2. Trimming audio for save:**
```typescript
// In useMixerRecording.ts - getAudioForTrim()

// WRONG: Using mixer's context
const trimmedBuffer = getAudioContext().createBuffer(...); // 44100Hz - WRONG!

// CORRECT: Fresh context at recording's sample rate
const trimContext = new AudioContext({ sampleRate: audioBuffer.sampleRate });
const trimmedBuffer = trimContext.createBuffer(...);
trimContext.close();
```

### Key Principle

Always use a **fresh AudioContext** at the **appropriate sample rate**:
- For decoding: Browser default (no sample rate specified)
- For trimming: Match the audioBuffer's sample rate
- Close the context after use to free resources

---

## Audio FX Routing (Critical Fix - February 3, 2026)

### The Problem

Instant FX (Echo Out, Filter Sweep, Flanger, Gate) were connecting directly to `audioContext.destination`, bypassing the mixer chain entirely.

### Correct Audio Chain

```
source → loCutNode → hiCutNode → gainNode → analyzerNode → masterGain → crossfader → destination
```

### Fix Applied

All FX now route through `state.analyzerNode`:

```typescript
// WRONG - bypasses mixer
dryGain.connect(audioContext.destination);
wetGain.connect(audioContext.destination);

// CORRECT - maintains mixer chain
dryGain.connect(state.analyzerNode);
wetGain.connect(state.analyzerNode);

// Cleanup also corrected
state.gainNode.connect(state.analyzerNode); // Not audioContext.destination
```

### Affected Effects

- `triggerEchoOut` - Echo with feedback
- `triggerFilterSweep` - Sweeping low-pass filter
- `triggerReverb` (Flanger) - Modulated delay
- `triggerGate` - 16th note stutter

---

## Waveform Gradient Fix (February 3, 2026)

### The Problem

`RecordingWaveform.tsx` gradient color stops could exceed valid range [0, 1] when trim end equaled or exceeded total bars.

### The Fix

```typescript
// WRONG - can exceed 1.0
gradient.addColorStop(trimEndX / canvasWidth, '#64748b');

// CORRECT - clamped to valid range
const endStop = Math.max(0, Math.min(1, trimEndX / canvasWidth));
gradient.addColorStop(endStop, '#64748b');
```

---

## Dashboard Preview Limit (February 3, 2026)

**Change:** Removed 20-second preview timeout from `app/account/page.tsx`

Users can now play their own content in full on the dashboard (My Work tab). The preview limit remains on other pages (store, globe) for non-purchased content.

---

## File Structure

### Core Recording Files

```
hooks/
  useMixerRecording.ts         # Recording state machine & audio capture

components/mixer/recording/
  RecordingWidget.tsx          # Main modal with payment flow
  RecordingWaveform.tsx        # Canvas waveform with drag handles
  TrimControls.tsx             # Nudge buttons
  BlockAudition.tsx            # Per-block preview
  CostDisplay.tsx              # Pricing breakdown

lib/recording/
  paymentCalculation.ts        # Pricing utilities

lib/mixerAudio.ts              # Audio routing, FX implementations
```

### API Endpoints

```
app/api/recording/
  calculate-cost/route.ts      # Cost estimation
  prepare-payment/route.ts     # Build payment recipients
  get-upload-url/route.ts      # Signed URL for direct upload
  confirm-and-save/route.ts    # Create draft track
```

---

## Payment System ("Sausage Links")

### Pricing Formula

```
Cost = ceil(bars / 8) × $0.10 × number_of_tracks

Example: 24 bars with 2 tracks
  blocks = ceil(24/8) = 3
  cost = 3 × $0.10 × 2 = $0.60 USDC
```

### Payment Split

| Recipient | Percentage | Paid? |
|-----------|------------|-------|
| Platform | 5% | Yes |
| Gen 0 Creators | 80% | Yes (split by IP ratios) |
| Remixer Stake | 15% | No (stored in metadata) |

---

## Video Recording (February 3, 2026)

### Architecture

Video recording captures the WebGL canvas output alongside the audio mix:

```
┌─────────────────────────────────────────────────────────────────┐
│                    VideoMixerLarge                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  WebGLVideoDisplay                                       │    │
│  │    - THREE.js canvas with video textures                 │    │
│  │    - preserveDrawingBuffer: true (required for capture)  │    │
│  │    - Exposes getCanvas() and getVideoElements() via ref  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     useMixerRecording                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Audio: MediaRecorder on streamDestination.stream        │    │
│  │  Video: canvas.captureStream(30) + audio tracks          │    │
│  │    - 30fps video capture                                 │    │
│  │    - vp8 codec (webm format)                             │    │
│  │    - 2.5 Mbps video bitrate                              │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   RecordingWidget (Modal)                        │
│    - Uploads audio to audio/recordings/                          │
│    - Uploads video to video/recordings/ (if present)             │
│    - Saves draft with content_type: video_clip (if video)        │
└─────────────────────────────────────────────────────────────────┘
```

### Key Implementation Details

**1. Canvas Access via forwardRef:**
```typescript
// WebGLVideoDisplay.tsx
export interface WebGLVideoDisplayHandle {
  getCanvas: () => HTMLCanvasElement | null;
  getVideoElements: () => { videoA: HTMLVideoElement | null; videoB: HTMLVideoElement | null };
}
```

**2. Video Recording in useMixerRecording:**
```typescript
// Start video recording
const canvasStream = videoCanvas.captureStream(30);
const audioTracks = streamDestination.stream.getAudioTracks();
audioTracks.forEach(track => canvasStream.addTrack(track));

const videoRecorder = new MediaRecorder(canvasStream, {
  mimeType: 'video/webm;codecs=vp8,opus',
  videoBitsPerSecond: 2500000,
});
```

**3. Separate Audio and Video Blobs:**
- Audio is always recorded separately for waveform trimming UI
- Video includes audio track for final export
- Both are uploaded independently to Supabase Storage

### Browser Compatibility

- **Chrome:** Full support (primary target)
- **Firefox:** Should work (not tested)
- **Safari:** May require codec adjustments (not supported initially)

### Testing Video Recording

1. Load two video clips in mixer (or one video + audio)
2. Open Video Mixer Large panel
3. Press Record → countdown → ARM → SYNC → Recording
4. Both audio waveform and video are captured
5. Press Record again to stop
6. Modal shows audio waveform for trimming
7. Confirm → both audio and video uploaded
8. Draft saved with content_type: video_clip

---

## Known Issues & Future Work

### Resolved (February 3, 2026)

- [x] First recording sync failure - Fixed with ref-based sync reset
- [x] Half-speed playback in modal - Fixed with proper sample rate handling
- [x] Half-speed saved drafts - Fixed with matching AudioContext sample rate
- [x] Audio FX cut out deck - Fixed by routing through analyzerNode
- [x] Waveform gradient crash - Fixed with clamped color stops
- [x] Dashboard 20-second limit - Removed for user's own content

### Resolved (February 3, 2026 - Session 2)

- [x] Draft deletion fails - Fixed by deleting dependent records first (recording_payments, recording_payment_recipients)
- [x] Draft saving intermittent failure - Fixed wallet address priority mismatch (SUI address now prioritized to match dashboard query)

### Resolved (February 3, 2026 - Session 3)

- [x] Video recording support - Implemented canvas captureStream(30) from WebGLVideoDisplay

### Outstanding Issues

- [ ] Trim handles can be clunky - hard to select exact 8-bar section
- [ ] Content type combinations need testing (only loop+loop verified so far)
- [ ] Video recording needs testing (Chrome only, WebM format)

### Future Enhancements

- [ ] TING token minting for AI-generated visuals
- [ ] Automatic remix cover image generator
- [ ] Better trim UX (click-to-set, smarter snapping)

---

## Testing Checklist

### Recording Capture

1. Load two tracks in mixer
2. Play and sync them
3. Press Record → 4-3-2-1 countdown appears
4. "ARM" state → "SYNC" (rehearsal) → Recording starts
5. Recording indicator pulses red
6. Press Record again to stop → Modal appears

### Trim Modal

1. Modal appears centered (uses React Portal)
2. Waveform displays with 8-bar grid
3. Drag handles adjust selection (clamped to valid range)
4. Cost updates as selection changes
5. Block audition plays at correct speed

### Audio Quality

1. Recording in modal plays at correct speed
2. Saved draft plays at correct speed
3. Audio FX don't cut out the deck
4. FX still go through crossfader

### Payment Flow

1. "Confirm & Pay" shows correct amount
2. Status cycles: Preparing → Signing → Executing → Saving
3. No errors during process
4. Draft appears in "My Work" tab

---

## Debugging Tips

### Sample Rate Issues

Check console for:
```
🎵 Created decode AudioContext at 48000Hz (browser default)
🎵 Decoded audio: 13.38s, 48000Hz, 2 channels
🎵 Created trim AudioContext at 48000Hz to match recording
```

If you see 44100Hz for decode context, that's the bug.

### FX Routing Issues

Check console for:
```
🎛️ Deck A Echo Out active - release button to stop
✅ Deck A Echo Out stopped and cleaned up
```

If audio cuts out during FX, check that FX connect to `state.analyzerNode`.

### Sync Reset

Check console for:
```
🔴 Resetting sync engine before recording...
🔴 Sync engine reset complete
```

If first recording fails to sync, the reset isn't triggering.

---

## Content Type Testing Matrix

Recording has been verified with loop+loop mixing. Other combinations need testing:

| Deck A | Deck B | Status | Notes |
|--------|--------|--------|-------|
| Loop | Loop | ✅ Working | Base case, fully tested |
| Loop | Song | ⬜ Untested | Different BPM priority |
| Loop | Radio | ⬜ Untested | Radio uses grabbed 20-sec buffer |
| Loop | Video | ⬜ Untested | Video has separate audio element |
| Song | Song | ⬜ Untested | Longer duration content |
| Song | Radio | ⬜ Untested | Mixed duration/buffer content |
| Song | Video | ⬜ Untested | |
| Radio | Radio | ⬜ Untested | Both proxied streams |
| Radio | Video | ⬜ Untested | |
| Video | Video | ⬜ Untested | Both have crop data |

### Special Considerations by Content Type

**Songs:**
- Longer duration than loops
- BPM priority = 2 (higher than loops=3, so song controls tempo)
- May have variable BPM sections

**Radio:**
- Uses `stream_url` through CORS proxy
- GRAB button captures 20-second rolling buffer
- Grabbed audio inherits original radio's BPM
- Proxied URL: `/api/radio-proxy?url=${encodeURIComponent(stream_url)}`

**Video:**
- Audio plays via HTMLAudioElement (separate from video element)
- Video element always `muted={true}`
- Has crop data: `video_crop_x/y/width/height/zoom`
- Has natural dimensions: `video_natural_width/height`

---

## Version History

| Date | Changes |
|------|---------|
| Feb 2, 2026 | Initial recording system implementation |
| Feb 3, 2026 | Fixed sample rate mismatch (half-speed playback) |
| Feb 3, 2026 | Fixed first-recording sync failure (ref-based reset) |
| Feb 3, 2026 | Fixed FX routing (bypass mixer chain) |
| Feb 3, 2026 | Fixed waveform gradient crash |
| Feb 3, 2026 | Removed dashboard preview limit |
| Feb 3, 2026 | Restored 4-3-2-1 pre-countdown feature |
| Feb 3, 2026 | Fixed draft deletion (delete dependent records first) |
| Feb 3, 2026 | Fixed draft save intermittent failure (wallet address priority) |
| Feb 3, 2026 | Implemented video recording support (canvas capture from WebGL) |
