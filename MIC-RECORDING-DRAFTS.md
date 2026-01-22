# Mic Recording & Draft System

**Last Updated:** January 21, 2026

Documentation for the microphone recording feature and draft save system.

---

## Table of Contents

1. [Overview](#overview)
2. [User Workflow](#user-workflow)
3. [Technical Architecture](#technical-architecture)
4. [MicWidget Component](#micwidget-component)
5. [Precision Recording System](#precision-recording-system)
6. [Draft Save API](#draft-save-api)
7. [Database Schema](#database-schema)
8. [Multi-Take Bundling](#multi-take-bundling)
9. [Draft Display & Styling](#draft-display--styling)
10. [Integration Points](#integration-points)
11. [Testing Checklist](#testing-checklist)
12. [Known Issues & TODOs](#known-issues--todos)

---

## Overview

The mic recording system allows users to record vocals, instruments, or any audio synced to mixer loops. Recordings are saved as **drafts** that can be:

- Played back immediately
- Downloaded as WAV files
- Saved to Supabase for later use
- Bundled into **loop packs** (multiple takes)
- Eventually published as finalized tracks

### Key Features

- **Sample-accurate recording** via AudioWorklet (no MediaRecorder latency)
- **Sync to mixer loops** - recording starts on loop boundary
- **Exact duration** - recordings are precisely 1, 2, 4, or 8 cycles
- **WAV output** - uncompressed 16-bit PCM for quality
- **Multi-take bundling** - sequential takes become a loop pack
- **Draft management** - view, preview, delete in account page

---

## User Workflow

### Basic Recording Flow

```
1. User loads loops in mixer and starts playback
2. User clicks mic icon in Crate to open MicWidget
3. User selects cycle count (1, 2, 4, or 8)
4. User clicks "Arm" button
5. Widget shows "Waiting for loop..." (armed state)
6. On next loop restart, recording begins automatically
7. Recording auto-stops at exact cycle boundary
8. User can:
   - Preview the recording
   - Download as WAV
   - Save as draft (if signed in)
   - Discard and record again
```

### Multi-Take Session Flow

```
1. User records first take → saves as draft
2. Widget shows "Take 2" indicator
3. User records another take → saves as draft
4. Both takes are bundled under same pack_id
5. User can:
   - Continue adding takes (all bundled together)
   - Click "New Session" to start fresh pack
```

### Draft Management Flow

```
1. Drafts appear in Crate with dashed border + "Draft" badge
2. Drafts can be dragged to mixer decks
3. Account page has "Drafts" filter to view all drafts
4. Drafts can be published/finalized (future feature)
5. Drafts can be deleted (hidden) from account page
```

---

## Technical Architecture

### File Structure

```
components/
├── MicWidget.tsx                    # Recording UI & workflow

lib/audio/
├── PrecisionRecorder.ts             # AudioWorklet manager class

public/audio-worklets/
├── recording-processor.js           # AudioWorklet (runs on audio thread)

app/api/drafts/
├── save/route.ts                    # Draft save endpoint

contexts/
├── MixerContext.tsx                 # addTrackToCollection for crate
├── AuthContext.tsx                  # User & persona info for attribution
```

### Data Flow

```
MicWidget
    │
    ├─► PrecisionRecorder.startRecording(config)
    │       │
    │       ├─► AudioWorklet (recording-processor.js)
    │       │       └─► Captures exact N samples
    │       │
    │       └─► Returns RecordingResult (audioBuffer, wavBlob)
    │
    ├─► User clicks "Save as Draft"
    │       │
    │       └─► POST /api/drafts/save
    │               │
    │               ├─► Upload WAV to Supabase Storage
    │               └─► Insert record in ip_tracks (is_draft: true)
    │
    └─► addTrackToCollection(draftTrack)
            └─► Draft appears in Crate
```

---

## MicWidget Component

**Location:** `components/MicWidget.tsx`

### State Machine

```typescript
type RecordingState =
  | 'idle'           // Not recording, ready
  | 'armed'          // Waiting for next loop restart to begin
  | 'recording'      // Actively recording
  | 'processing'     // Processing recorded audio
  | 'complete';      // Recording complete, ready for actions
```

### Key State Variables

```typescript
// Recording state
const [recordingState, setRecordingState] = useState<RecordingState>('idle');
const [cycleCount, setCycleCount] = useState(1);  // 1, 2, 4, or 8 cycles
const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

// Draft saving state
const [isSaving, setIsSaving] = useState(false);
const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
const [currentPackId, setCurrentPackId] = useState<string | null>(null);  // Multi-take
const [takeCount, setTakeCount] = useState(0);
```

### Global Integration

The widget registers global callbacks for mixer integration:

```typescript
// Toggle visibility from Crate icon
(window as any).toggleMicWidget = () => setIsExpanded(prev => !prev);

// Called when mixer loop restarts - triggers recording start
(window as any).onMixerLoopRestart = (deckId: 'A' | 'B') => {
  if (recordingState === 'armed') {
    startActualRecording();
  }
};
```

### User Attribution

Recordings are attributed to the active persona:

```typescript
const effectiveWallet = activePersona?.wallet_address
  || activePersona?.sui_address
  || suiAddress
  || walletAddress;

const username = activePersona?.username || activePersona?.display_name || null;
```

---

## Precision Recording System

### Why AudioWorklet?

**MediaRecorder problems:**
- ~100-150ms start latency (browser-dependent)
- Variable timing due to JavaScript event loop
- WebM/Opus encoding introduces further uncertainty
- Not designed for musical timing precision

**AudioWorklet advantages:**
- Runs on dedicated audio thread
- Sample-accurate capture
- Exact sample count targeting
- Correlates with AudioContext.currentTime

### PrecisionRecorder Class

**Location:** `lib/audio/PrecisionRecorder.ts`

```typescript
export class PrecisionRecorder {
  // Initialize: create AudioContext, load worklet, get mic stream
  async initialize(): Promise<void>;

  // Start recording for exact duration
  async startRecording(config: RecordingConfig): Promise<RecordingResult>;

  // Manual stop (if needed)
  stopRecording(): void;

  // Clean up resources
  async cleanup(): Promise<void>;
}

interface RecordingConfig {
  bpm: number;
  bars: number;    // Bars per cycle (always 8)
  cycles: number;  // 1, 2, 4, or 8
}

interface RecordingResult {
  audioBuffer: AudioBuffer;
  wavBlob: Blob;
  durationSeconds: number;
  sampleRate: number;
  actualSamples: number;
  expectedSamples: number;
}
```

### Duration Calculation

```typescript
// 1 cycle = 8 bars = 32 beats
const beatsPerCycle = 32;
const secondsPerBeat = 60 / bpm;
const durationSeconds = cycles * beatsPerCycle * secondsPerBeat;
const expectedSamples = Math.round(durationSeconds * sampleRate);

// Example: 125 BPM, 1 cycle
// secondsPerBeat = 60/125 = 0.48s
// durationSeconds = 1 * 32 * 0.48 = 15.36s
// expectedSamples = 15.36 * 48000 = 737,280 samples
```

### AudioWorklet Processor

**Location:** `public/audio-worklets/recording-processor.js`

```javascript
class RecordingProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    if (this.isRecording && input) {
      // Store samples
      this.recordedChunks.push(new Float32Array(input[0]));
      this.samplesRecorded += input[0].length;

      // Auto-stop at target
      if (this.samplesRecorded >= this.targetSamples) {
        this.finishRecording('targetReached');
      }
    }
    return true;
  }
}
```

---

## Draft Save API

**Location:** `app/api/drafts/save/route.ts`

### POST /api/drafts/save

**Request (FormData):**
```
file: Blob              # WAV audio file
walletAddress: string   # Uploader wallet address
title: string           # Optional title (default: "Mic Recording")
username: string        # Optional persona username for attribution
cycleCount: string      # Number of cycles recorded
bpm: string             # BPM at time of recording
packId: string          # Optional - for multi-take bundling
```

**Response:**
```json
{
  "success": true,
  "track": {
    "id": "uuid",
    "title": "Mic Recording 1",
    "artist": "username",
    "audioUrl": "https://supabase.../audio/drafts/...",
    "bpm": 125,
    "content_type": "loop",
    "is_draft": true,
    "pack_id": "uuid or null",
    "pack_position": 1,
    "primary_uploader_wallet": "SP..."
  },
  "packId": "uuid"  // For next take bundling
}
```

### Storage Location

```
Supabase Storage: user-content bucket
Path: audio/drafts/draft-{wallet10chars}-{timestamp}.wav
```

### PATCH /api/drafts/save

Converts first draft to a pack when second take is added:

```json
// Request
{ "firstTrackId": "uuid", "walletAddress": "SP..." }

// Response
{ "success": true, "packId": "uuid" }
```

---

## Database Schema

### ip_tracks Table (Draft Fields)

| Column | Type | Description |
|--------|------|-------------|
| `is_draft` | boolean | true for unsaved/unpublished recordings |
| `pack_id` | uuid | Groups multi-take recordings together |
| `pack_position` | integer | Order within pack (1, 2, 3...) |
| `content_type` | text | 'loop' for individual, 'loop_pack' for bundle |
| `primary_uploader_wallet` | text | Wallet address of recorder |
| `bpm` | numeric | BPM at time of recording |

### Draft Record Example

```sql
INSERT INTO ip_tracks (
  id, title, artist, content_type, bpm, audio_url,
  is_draft, primary_uploader_wallet, pack_id, pack_position,
  composition_split_1_wallet, composition_split_1_percentage,
  production_split_1_wallet, production_split_1_percentage
) VALUES (
  'abc-123', 'Mic Recording 1', 'tokyo-denpa', 'loop', 125,
  'https://supabase.../audio/drafts/draft-SP1234...-1234567890.wav',
  true, 'SP1234...', null, null,
  'SP1234...', 100,  -- 100% composition to uploader
  'SP1234...', 100   -- 100% production to uploader
);
```

---

## Multi-Take Bundling

### How It Works

1. **First take:** Saved with `pack_id: null`, `pack_position: null`
2. **Response returns:** `packId: track.id` (the track's own ID)
3. **Second take:** Sent with `packId` from first take
4. **API converts first track:** Sets `pack_id: firstTrackId`, `pack_position: 1`
5. **Second track saved:** With `pack_id: firstTrackId`, `pack_position: 2`
6. **Subsequent takes:** Increment `pack_position`

### State Tracking in MicWidget

```typescript
// Track current pack for bundling
const [currentPackId, setCurrentPackId] = useState<string | null>(null);
const [takeCount, setTakeCount] = useState(0);

// After first save, store pack ID
if (result.packId && !currentPackId) {
  setCurrentPackId(result.packId);
}
setTakeCount(prev => prev + 1);

// On save, include pack ID if exists
if (currentPackId) {
  formData.append('packId', currentPackId);
}

// Reset for new session
const startNewPack = () => {
  setCurrentPackId(null);
  setTakeCount(0);
};
```

### Visual Feedback

```
Take 1: "Save as Draft"
Take 2: "Save as Draft (Take 2)" + "Take 2" badge in header
Take 3: "Save as Draft (Take 3)" + "Take 3" badge
...
After save: "Record Another Take" or "New Session" buttons
```

---

## Draft Display & Styling

### Crate Styling

**Location:** `components/shared/Crate.tsx`

```typescript
// Dashed border for drafts
const getBorderStyle = (track: any) => {
  return track.is_draft ? 'border-dashed' : 'border-solid';
};

// Applied to track thumbnail
className={`${getBorderColor(track)} ${getBorderThickness(track)} ${getBorderStyle(track)}`}
```

**Draft Badge (top-left corner):**
```tsx
{track.is_draft && (
  <div
    className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded text-[6px] font-bold uppercase"
    style={{
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      color: '#A084F9',
      border: '1px dashed #A084F9'
    }}
  >
    Draft
  </div>
)}
```

### Account Page Styling

**Location:** `app/account/page.tsx`

- "Drafts" filter button with dashed border
- Same dashed border on draft track cards
- Drafts filter shows count: `Drafts (3)`

### Color Coding

| Element | Color | Hex |
|---------|-------|-----|
| Draft badge text | Lavender | #A084F9 |
| Draft badge border | Lavender dashed | #A084F9 |
| Draft card border | Content-type color, dashed | varies |

---

## Integration Points

### Mixer Context

```typescript
// MixerContext provides crate management
const { addTrackToCollection } = useMixer();

// Add draft to crate after save
addTrackToCollection(draftTrack);
```

### Auth Context

```typescript
// AuthContext provides user info
const { walletAddress, suiAddress, isAuthenticated, activePersona } = useAuth();

// Use persona for attribution
const effectiveWallet = activePersona?.wallet_address || ...;
const username = activePersona?.username || ...;
```

### Mixer Sync

```typescript
// MicWidget registers callback
(window as any).onMixerLoopRestart = (deckId) => { ... };

// Mixer calls it on loop boundary (lib/mixerAudio.ts)
if ((window as any).onMixerLoopRestart) {
  (window as any).onMixerLoopRestart(this.deckId);
}
```

### BPM Access

```typescript
// MicWidget gets BPM from mixer
const bpm = (window as any).getMixerBPM?.() || 120;

// Mixer exposes BPM (UniversalMixer.tsx)
(window as any).getMixerBPM = () => mixerState.masterBPM;
```

---

## Testing Checklist

### Single Recording

- [ ] Arm recording while mixer is playing
- [ ] Recording starts on loop boundary
- [ ] Recording auto-stops at correct duration
- [ ] Preview plays correctly
- [ ] Download produces valid WAV
- [ ] Draft saves to Supabase
- [ ] Draft appears in Crate with badge
- [ ] Draft has dashed border
- [ ] Draft can be dragged to mixer deck
- [ ] Draft syncs properly when played

### Multi-Take Bundling

- [ ] First take saves normally
- [ ] "Take 2" badge appears
- [ ] Second take bundles with first (same pack_id)
- [ ] Both takes appear in Crate
- [ ] Pack position increments correctly
- [ ] "New Session" resets pack tracking
- [ ] Pack appears correctly in Account page

### Edge Cases

- [ ] Recording without mixer playing shows error
- [ ] Recording without mic permission shows helpful message
- [ ] Canceling armed state works
- [ ] Stopping during recording works
- [ ] Discarding unsaved recording resets state
- [ ] Network error during save shows error message

---

## Known Issues & TODOs

### TODO: Loop Pack Scenario
Multi-take bundling is implemented but needs testing:
- Verify pack_id is correctly shared between takes
- Verify PATCH endpoint converts first track properly
- Verify pack displays correctly in Account page

### TODO: Draft Styling in Crate
User reported Crate may not show draft styling consistently:
- Verify `is_draft` flag is present on track data
- Verify dashed border is rendering
- Compare with Account page styling

### TODO: Draft Publishing
No UI yet for:
- Converting draft to published track
- Setting metadata (title, tags, etc.)
- Setting collaboration splits
- Finalizing and removing draft status

### TODO: Draft Deletion
- Add delete button to draft cards in Crate
- Soft delete (set `is_deleted: true`)
- Confirm dialog before deletion

---

## Appendix: WAV File Format

The PrecisionRecorder outputs 16-bit PCM WAV files:

```
RIFF header (12 bytes)
├── "RIFF" (4 bytes)
├── File size - 8 (4 bytes)
└── "WAVE" (4 bytes)

fmt chunk (24 bytes)
├── "fmt " (4 bytes)
├── Chunk size: 16 (4 bytes)
├── Audio format: 1 (PCM) (2 bytes)
├── Channels: 1 (mono) (2 bytes)
├── Sample rate: 48000 (4 bytes)
├── Byte rate: 96000 (4 bytes)
├── Block align: 2 (2 bytes)
└── Bits per sample: 16 (2 bytes)

data chunk
├── "data" (4 bytes)
├── Data size (4 bytes)
└── Sample data (N bytes)
```

---

*Documentation created January 21, 2026*
*For: mixmi alpha platform*
*Authors: Sandy Hoover + Claude Code*
