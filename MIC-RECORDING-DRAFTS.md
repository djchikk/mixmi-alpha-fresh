# Mic Recording & Draft System

**Last Updated:** January 23, 2026

Complete documentation for the microphone recording feature, draft management, packaging, and publishing system.

---

## Table of Contents

1. [Overview](#overview)
2. [User Journey](#user-journey)
3. [Technical Architecture](#technical-architecture)
4. [MicWidget Component](#micwidget-component)
5. [Precision Recording System](#precision-recording-system)
6. [Draft Save API](#draft-save-api)
7. [Multi-Take Bundling](#multi-take-bundling)
8. [Packaging Takes into Loop Packs](#packaging-takes-into-loop-packs)
9. [Publishing Drafts](#publishing-drafts)
10. [Draft Display & Styling](#draft-display--styling)
11. [Database Schema](#database-schema)
12. [Integration Points](#integration-points)
13. [Testing Checklist](#testing-checklist)

---

## Overview

The mic recording system allows users to record vocals, instruments, or any audio perfectly synced to mixer loops. Recordings are saved as **drafts** that flow through a complete lifecycle:

```
Record → Save Draft → (Optional: Bundle Takes) → Package as Loop Pack → Edit Metadata → Publish
```

### Key Features

- **Sample-accurate recording** via AudioWorklet (no MediaRecorder latency)
- **Sync to mixer loops** - recording starts on loop boundary
- **Fixed 8-bar loops** - recordings are exactly 1 cycle (8 bars) for loop pack compatibility
- **WAV output** - uncompressed 16-bit PCM for quality
- **Multi-take sessions** - sequential takes bundled together
- **Loop pack packaging** - 2-5 takes become a publishable loop pack
- **Full publishing workflow** - add metadata, artwork, then publish to store
- **Crate integration** - drafts appear with visual distinction, update on publish

### Constraints

- **Loops are 8 bars** - fixed duration per recording
- **Max 5 loops per pack** - loop pack limit
- **Minimum 2 takes for packaging** - single takes remain individual loops

---

## User Journey

### Complete Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MIC RECORDING JOURNEY                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. SETUP                                                               │
│     └─► Load loops in mixer → Start playback → Click mic icon in Crate │
│                                                                         │
│  2. RECORD                                                              │
│     └─► Click "Arm" → Wait for loop restart → Auto-records 8 bars     │
│                                                                         │
│  3. REVIEW                                                              │
│     └─► Preview recording → Download WAV (optional) → Save as Draft   │
│                                                                         │
│  4. MULTI-TAKE (optional)                                               │
│     └─► Record another take → Both bundled → Repeat up to 5 takes     │
│                                                                         │
│  5. PACKAGE (when 2-5 takes saved)                                      │
│     └─► Click "Package as Loop Pack" → Creates draft loop pack         │
│                                                                         │
│  6. EDIT                                                                │
│     └─► Open in Dashboard → Edit title, artwork, BPM, splits           │
│                                                                         │
│  7. PUBLISH                                                             │
│     └─► Click "Publish" → Live on store → Crate card updates           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recording Flow (Detailed)

```
1. User loads loops in mixer and starts playback
2. User clicks mic icon in Crate to open MicWidget
3. User clicks "Arm" button
4. Widget shows "Waiting for loop..." (armed state)
5. On next loop restart, recording begins automatically
6. Widget shows "Recording 8 bars..." with visual feedback
7. Recording auto-stops at exact cycle boundary
8. User can:
   - Preview the recording
   - Download as WAV
   - Save as draft (if signed in)
   - Discard and record again
```

### Multi-Take Session Flow

```
1. User records first take → saves as draft "Mic Recording 1"
2. Widget shows "Take 2" indicator
3. User records another take → saves as "Mic Recording 2 - Take 2"
4. Both takes bundled under same pack_id
5. Widget shows "Package as Loop Pack" button (2+ takes)
6. User can:
   - Continue adding takes (up to 5)
   - Package current takes into a loop pack
   - Click "New Session" to start fresh
```

### Publishing Flow

```
1. Drafts appear in Dashboard with dashed border + "Draft" badge
2. User clicks edit button on draft → Opens edit modal
3. User adds:
   - Title and description
   - Cover artwork
   - BPM (if different from recording)
   - Collaboration splits
   - Tags
4. User saves edits (still a draft)
5. User clicks "Publish" button on dashboard card
6. Confirmation dialog appears
7. Track published → visible on store/globe
8. Crate card updates automatically (artwork, no more draft badge)
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
├── save/route.ts                    # Save individual draft takes
├── package/route.ts                 # Package takes into loop pack
├── publish/route.ts                 # Publish draft to store

contexts/
├── MixerContext.tsx                 # Collection management, updateTrackInCollection
├── AuthContext.tsx                  # User & persona info for attribution

components/shared/
├── Crate.tsx                        # Draft display, styling, global functions

components/cards/
├── CompactTrackCardWithFlip.tsx     # Dashboard card with publish button

components/mixer/compact/
├── SimplifiedDeckCompact.tsx        # Deck display for drafts
```

### Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           RECORDING DATA FLOW                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  MicWidget                                                               │
│      │                                                                   │
│      ├─► PrecisionRecorder.startRecording(config)                        │
│      │       │                                                           │
│      │       ├─► AudioWorklet (recording-processor.js)                   │
│      │       │       └─► Captures exact N samples on audio thread        │
│      │       │                                                           │
│      │       └─► Returns RecordingResult (audioBuffer, wavBlob)          │
│      │                                                                   │
│      ├─► User clicks "Save as Draft"                                     │
│      │       │                                                           │
│      │       └─► POST /api/drafts/save                                   │
│      │               │                                                   │
│      │               ├─► Upload WAV to Supabase Storage                  │
│      │               └─► Insert record in ip_tracks (is_draft: true)     │
│      │                                                                   │
│      └─► addTrackToCollection(draftTrack)                                │
│              └─► Draft appears in Crate with dashed border               │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                          PACKAGING DATA FLOW                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  MicWidget (2+ takes saved)                                              │
│      │                                                                   │
│      └─► User clicks "Package as Loop Pack"                              │
│              │                                                           │
│              └─► POST /api/drafts/package                                │
│                      │                                                   │
│                      ├─► Create loop_pack container (is_draft: true)     │
│                      ├─► Update child tracks → point to container        │
│                      └─► Return pack info                                │
│                                                                          │
│              └─► addTrackToCollection(packTrack)                         │
│                      └─► Draft pack appears in Crate                     │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                          PUBLISHING DATA FLOW                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Dashboard (draft card)                                                  │
│      │                                                                   │
│      └─► User clicks "Publish" button                                    │
│              │                                                           │
│              └─► POST /api/drafts/publish                                │
│                      │                                                   │
│                      ├─► Set is_draft: false on track                    │
│                      └─► If pack: also publish child tracks              │
│                                                                          │
│              └─► Fetch updated track from database                       │
│              └─► window.updateInCollection(trackId, updates)             │
│                      └─► Crate card updates with new artwork             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## MicWidget Component

**Location:** `components/MicWidget.tsx`

### State Machine

```typescript
type RecordingState =
  | 'idle'           // Not recording, ready
  | 'armed'          // Waiting for next loop restart to begin
  | 'recording'      // Actively recording 8 bars
  | 'processing'     // Processing recorded audio
  | 'complete';      // Recording complete, ready for actions
```

### Key State Variables

```typescript
// Recording (fixed at 1 cycle = 8 bars)
const cycleCount = 1; // Fixed: 1 cycle = 8 bars per loop
const [recordingState, setRecordingState] = useState<RecordingState>('idle');
const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

// Draft saving
const [isSaving, setIsSaving] = useState(false);
const [savedDraftId, setSavedDraftId] = useState<string | null>(null);

// Multi-take bundling
const [currentPackId, setCurrentPackId] = useState<string | null>(null);
const [takeCount, setTakeCount] = useState(0);

// Packaging
const [isPackaging, setIsPackaging] = useState(false);
const [isPackaged, setIsPackaged] = useState(false);
```

### User Attribution

```typescript
// Priority: SUI address preferred (for zkLogin users)
const effectiveWallet = activePersona?.sui_address
  || activePersona?.wallet_address
  || suiAddress
  || walletAddress;

const username = activePersona?.username || activePersona?.display_name || null;
```

### Global Integration

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
  async initialize(): Promise<void>;
  async startRecording(config: RecordingConfig): Promise<RecordingResult>;
  stopRecording(): void;
  async cleanup(): Promise<void>;
}

interface RecordingConfig {
  bpm: number;
  bars: number;    // Always 8 (1 cycle)
  cycles: number;  // Always 1 (for loop pack compatibility)
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
walletAddress: string   # Uploader wallet address (SUI or STX)
title: string           # Title (e.g., "Mic Recording 1")
username: string        # Optional persona username for artist attribution
cycleCount: string      # Number of cycles recorded (always "1")
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
    "primary_uploader_wallet": "0x..."
  },
  "packId": "uuid"
}
```

### Storage Location

```
Supabase Storage: user-content bucket
Path: audio/drafts/draft-{wallet10chars}-{timestamp}.wav
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

### State Tracking

```typescript
// Track current pack for bundling
const [currentPackId, setCurrentPackId] = useState<string | null>(null);
const [takeCount, setTakeCount] = useState(0);

// After first save
if (result.packId && !currentPackId) {
  setCurrentPackId(result.packId);
}
setTakeCount(prev => prev + 1);

// On subsequent saves
if (currentPackId) {
  formData.append('packId', currentPackId);
}

// Reset for new session
const startNewPack = () => {
  setCurrentPackId(null);
  setTakeCount(0);
  setIsPackaged(false);
};
```

---

## Packaging Takes into Loop Packs

**Location:** `app/api/drafts/package/route.ts`

### POST /api/drafts/package

Packages 2-5 individual draft takes into a draft loop pack container.

**Request:**
```json
{
  "packId": "uuid",           // First track's ID (shared pack_id)
  "walletAddress": "0x...",   // Owner's wallet address
  "title": "Draft Loop Pack (4 takes)"  // Optional title
}
```

**Response:**
```json
{
  "success": true,
  "pack": {
    "id": "new-uuid",
    "title": "Draft Loop Pack (4 takes)",
    "artist": "username",
    "content_type": "loop_pack",
    "bpm": 125,
    "is_draft": true,
    "trackCount": 4
  },
  "tracks": [
    { "id": "uuid", "title": "Mic Recording 1", "pack_position": 1 },
    { "id": "uuid", "title": "Mic Recording 2 - Take 2", "pack_position": 2 },
    ...
  ]
}
```

### What Packaging Does

1. Fetches all draft tracks with the given `pack_id`
2. Validates: 2-5 tracks required
3. Creates new `loop_pack` container record with:
   - `content_type: 'loop_pack'`
   - `is_draft: true`
   - `audio_url`: First track's audio (as preview)
   - 100% splits to uploader (default)
4. Updates all child tracks to point to new container
5. Returns pack info for crate display

### UI in MicWidget

```tsx
{/* Package Button - shown when 2-5 takes saved */}
{takeCount >= 2 && takeCount <= 5 && !isPackaged && (
  <button
    onClick={packageAsPack}
    disabled={isPackaging}
    className="w-full py-2 rounded-lg font-medium bg-[#A084F9] text-white"
  >
    {isPackaging ? 'Packaging...' : `Package as Loop Pack (${takeCount} takes)`}
  </button>
)}
```

---

## Publishing Drafts

**Location:** `app/api/drafts/publish/route.ts`

### POST /api/drafts/publish

**Request:**
```json
{
  "trackId": "uuid",
  "walletAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "track": {
    "id": "uuid",
    "title": "My Loop Pack",
    "content_type": "loop_pack",
    "is_draft": false
  }
}
```

### What Publishing Does

1. Verifies ownership (`primary_uploader_wallet` matches)
2. Sets `is_draft: false` on the track
3. If it's a pack (`loop_pack`, `ep`, `station_pack`): also publishes all child tracks
4. Returns success

### UI in Dashboard

The Publish button appears in the hover overlay on draft cards:

```tsx
{/* Publish Button - for drafts in dashboard only */}
{showEditControls && (track as any).is_draft && (
  <button
    onClick={handlePublishClick}
    disabled={isPublishing}
    className="absolute bottom-8 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wide animate-pulse"
    style={{
      backgroundColor: '#A084F9',
      color: '#FFFFFF',
      animation: isPublishing ? 'none' : 'pulse 2s ease-in-out infinite'
    }}
  >
    {isPublishing ? 'Publishing...' : 'Publish'}
  </button>
)}
```

### Crate Update on Publish

After publishing, the crate card updates automatically:

```typescript
// In handlePublishClick (CompactTrackCardWithFlip.tsx)

// Fetch updated track data
const { data: updatedTrack } = await supabase
  .from('ip_tracks')
  .select('*')
  .eq('id', track.id)
  .single();

// Update the track in the crate
if (updatedTrack && (window as any).updateInCollection) {
  (window as any).updateInCollection(track.id, {
    ...updatedTrack,
    is_draft: false,
    imageUrl: updatedTrack.cover_image_url,
    audioUrl: updatedTrack.audio_url
  });
}
```

---

## Draft Display & Styling

### Crate Styling

**Location:** `components/shared/Crate.tsx`

```typescript
// Border thickness - thick for drafts and packs
const getBorderThickness = (track: any) => {
  if (track.is_draft) return 'border-4';
  return isPack(track) ? 'border-4' : 'border-2';
};

// Border style - dashed for drafts
const getBorderStyle = (track: any) => {
  return track.is_draft ? 'border-dashed' : 'border-solid';
};
```

**Draft Badge:**
```tsx
{track.is_draft && (
  <div
    className="absolute -top-1 -left-1 px-1.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider z-20"
    style={{
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      color: '#A084F9',
      border: '1px dashed #A084F9'
    }}
  >
    Draft
  </div>
)}
```

**Take Number (for drafts without images):**
```tsx
{track.is_draft && track.title && (
  <span className="text-white text-[10px] font-bold opacity-70">
    {track.pack_position ? `Take ${track.pack_position}` :
     track.title.match(/(\d+)/) ? `Take ${track.title.match(/(\d+)/)?.[1]}` : ''}
  </span>
)}
```

### Deck Styling

**Location:** `components/mixer/compact/SimplifiedDeckCompact.tsx`

```tsx
{/* Gradient fallback for tracks without images */}
{!currentTrack.imageUrl && (
  <div
    className="w-full h-full flex items-center justify-center"
    style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
  >
    <svg className="w-6 h-6 text-white opacity-50" ...>
      {/* Music note icon */}
    </svg>
  </div>
)}

{/* Draft badge on deck */}
{(currentTrack as any).is_draft && (
  <div
    className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded text-[6px] font-bold uppercase tracking-wide pointer-events-none z-10"
    style={{
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      color: '#A084F9',
      border: '1px dashed #A084F9'
    }}
  >
    Draft
  </div>
)}
```

### Dashboard Styling

**Location:** `components/cards/CompactTrackCardWithFlip.tsx`

- Same dashed border pattern
- "Draft" badge in top-left corner
- Publish button with pulse animation (centered, bottom area of hover overlay)
- Drafts filter in account page shows count

### Color Coding

| Element | Color | Hex |
|---------|-------|-----|
| Draft badge text | Lavender | #A084F9 |
| Draft badge border | Lavender dashed | #A084F9 |
| Draft card border | Content-type color, dashed | varies |
| Publish button | Lavender | #A084F9 |
| Gradient (no image) | Purple gradient | #667eea → #764ba2 |

---

## Database Schema

### ip_tracks Table (Draft-Related Fields)

| Column | Type | Description |
|--------|------|-------------|
| `is_draft` | boolean | `true` for unpublished recordings |
| `pack_id` | uuid | Groups multi-take recordings together |
| `pack_position` | integer | Order within pack (1, 2, 3...) |
| `content_type` | text | `'loop'` for individual, `'loop_pack'` for bundle |
| `primary_uploader_wallet` | text | SUI or STX wallet address of recorder |
| `bpm` | numeric | BPM at time of recording |

### Draft Record Example

```sql
-- Individual draft loop
INSERT INTO ip_tracks (
  id, title, artist, content_type, bpm, audio_url,
  is_draft, primary_uploader_wallet, pack_id, pack_position,
  composition_split_1_wallet, composition_split_1_percentage,
  production_split_1_wallet, production_split_1_percentage
) VALUES (
  'abc-123', 'Mic Recording 1', 'fluffy-chick', 'loop', 125,
  'https://supabase.../audio/drafts/draft-0x1234...-1234567890.wav',
  true, '0x1234...', null, null,
  '0x1234...', 100,
  '0x1234...', 100
);

-- Draft loop pack container
INSERT INTO ip_tracks (
  id, title, artist, content_type, bpm, audio_url,
  is_draft, primary_uploader_wallet
) VALUES (
  'pack-456', 'Draft Loop Pack', 'fluffy-chick', 'loop_pack', 125,
  'https://supabase.../audio/drafts/draft-0x1234...-1234567890.wav',
  true, '0x1234...'
);

-- Child tracks point to pack
UPDATE ip_tracks SET pack_id = 'pack-456', pack_position = 1 WHERE id = 'abc-123';
UPDATE ip_tracks SET pack_id = 'pack-456', pack_position = 2 WHERE id = 'def-456';
```

---

## Integration Points

### MixerContext

```typescript
// Collection management
const {
  addTrackToCollection,      // Add draft to crate
  updateTrackInCollection,   // Update after publish
  removeTrackFromCollection,
  clearCollection
} = useMixer();
```

### Global Window Functions

```typescript
// Crate exposes these globally (Crate.tsx)
(window as any).addToCollection = (track) => { ... };
(window as any).updateInCollection = (trackId, updates) => { ... };
(window as any).removeFromCollection = (trackId) => { ... };

// MicWidget exposes these
(window as any).toggleMicWidget = () => { ... };
(window as any).onMixerLoopRestart = (deckId) => { ... };

// Mixer exposes BPM
(window as any).getMixerBPM = () => mixerState.masterBPM;
```

### AuthContext

```typescript
// User info for attribution
const { walletAddress, suiAddress, isAuthenticated, activePersona } = useAuth();

// Effective wallet (SUI preferred for zkLogin)
const effectiveWallet = activePersona?.sui_address
  || activePersona?.wallet_address
  || suiAddress
  || walletAddress;
```

### Mixer Sync

```typescript
// MicWidget registers callback
(window as any).onMixerLoopRestart = (deckId) => {
  if (recordingState === 'armed') {
    startActualRecording();
  }
};

// Mixer calls it on loop boundary (lib/mixerAudio.ts)
if ((window as any).onMixerLoopRestart) {
  (window as any).onMixerLoopRestart(this.deckId);
}
```

---

## Testing Checklist

### Recording
- [ ] Arm recording while mixer is playing
- [ ] Recording starts on loop boundary
- [ ] Recording auto-stops at 8 bars
- [ ] Preview plays correctly
- [ ] Download produces valid WAV
- [ ] Draft saves to Supabase

### Draft Display
- [ ] Draft appears in Crate with dashed border
- [ ] Draft shows "Draft" badge
- [ ] Draft shows "Take X" label (when no image)
- [ ] Draft can be dragged to mixer deck
- [ ] Deck shows gradient + "Draft" badge for drafts
- [ ] Draft syncs properly when played

### Multi-Take
- [ ] First take saves normally
- [ ] "Take 2" badge appears
- [ ] Second take bundles with first (same pack_id)
- [ ] Both takes appear in Crate
- [ ] Pack position increments correctly
- [ ] "New Session" resets pack tracking

### Packaging
- [ ] Package button appears at 2+ takes
- [ ] Package button hidden at 5+ takes
- [ ] Packaging creates loop_pack container
- [ ] Child tracks point to container
- [ ] Pack appears in Crate
- [ ] Pack has correct content_type

### Publishing
- [ ] Edit modal opens for draft
- [ ] Metadata can be added (title, artwork, etc.)
- [ ] Publish button visible on draft cards
- [ ] Confirmation dialog appears
- [ ] Track publishes successfully
- [ ] Crate card updates (artwork, no draft badge)
- [ ] Track visible on store/globe

### Edge Cases
- [ ] Recording without mixer playing shows error
- [ ] Recording without mic permission shows helpful message
- [ ] Canceling armed state works
- [ ] Stopping during recording works
- [ ] Discarding unsaved recording resets state
- [ ] Network error during save shows error message

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

*Documentation updated January 23, 2026*
*For: mixmi alpha platform*
*Authors: Sandy Hoover + Claude Code*
