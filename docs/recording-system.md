# Recording System Documentation

**Created:** February 2, 2026
**Status:** Core functionality working, UX polish needed

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
│  │                    MediaRecorder                         │    │
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
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Payment Flow                                                    │
│  1. Prepare payment → Get recipients from IP splits              │
│  2. Build SUI transaction → Split payment to all recipients      │
│  3. zkLogin sign → User approves                                 │
│  4. Execute on-chain → USDC transfers                            │
│  5. Upload audio → Direct to Supabase Storage                    │
│  6. Create draft → ip_tracks with is_draft: true                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Recording Flow

### 1. Armed Recording State

When user presses Record button:

```
Idle → Armed (500ms visual) → Count-in (1-2-3-4) → Recording
```

**States in `useMixerRecording`:**
- `idle` - Not recording
- `armed` - Waiting to start (shows "ARM" on button)
- `countingIn` - 4-beat count-in (shows beat number)
- `recording` - Actually capturing audio
- `stopped` - Recording complete, ready for trim

### 2. Audio Capture

The recording hook (`hooks/useMixerRecording.ts`) captures audio by:

1. Creating a `MediaStreamAudioDestinationNode`
2. Connecting it to the mixer's `masterGain` node (post-crossfader)
3. Using `MediaRecorder` to capture the stream
4. Converting the result to an `AudioBuffer` for waveform display

```typescript
const streamDestination = audioContext.createMediaStreamDestination();
masterGain.connect(streamDestination);
const mediaRecorder = new MediaRecorder(streamDestination.stream);
```

### 3. Waveform & Trim

After recording stops:
- Waveform is generated (800 data points)
- Initial trim is set to full recording, snapped to 8-bar boundaries
- User can drag handles or use nudge buttons to adjust

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

### IP Split Resolution

For each source track, the API:
1. Fetches composition and production split data
2. Resolves SUI addresses for each recipient
3. Calculates their share of the 80% creators cut
4. Builds a multi-recipient payment transaction

---

## File Structure

### New Files Created

```
hooks/
  useMixerRecording.ts         # Recording state machine

components/mixer/recording/
  RecordingWidget.tsx          # Main modal (uses React Portal)
  RecordingWaveform.tsx        # Canvas waveform with drag handles
  TrimControls.tsx             # Nudge buttons
  BlockAudition.tsx            # Per-block preview
  CostDisplay.tsx              # Pricing breakdown

lib/recording/
  paymentCalculation.ts        # Pricing utilities

app/api/recording/
  calculate-cost/route.ts      # Cost estimation
  prepare-payment/route.ts     # Build payment recipients
  get-upload-url/route.ts      # Signed URL for direct upload
  confirm-and-save/route.ts    # Create draft track
```

### Modified Files

```
components/mixer/UniversalMixer.tsx
  - Added useMixerRecording hook
  - Added RecordingWidget rendering
  - Wired handleRecordToggle

components/mixer/compact/MasterTransportControlsCompact.tsx
  - Added record button with armed/count-in states
  - Visual feedback for recording states

config/pricing.ts
  - Added PRICING.remix section

types/index.ts
  - Added SourceTrackMetadata interface
```

---

## Database Schema

### New Columns on `ip_tracks`

```sql
remixer_stake_percentage DECIMAL(5,2)  -- 15% for remixes
source_tracks_metadata JSONB           -- Genealogy info
source_track_ids UUID[]                -- Parent track IDs
recording_cost_usdc DECIMAL(10,6)      -- Cost paid
recording_payment_tx TEXT              -- SUI tx hash
recording_payment_status TEXT          -- pending/confirmed
recorded_bars INTEGER                  -- Number of bars
remix_depth INTEGER                    -- Generation (1 for first remix)
```

### New Tables

```sql
recording_payments
  - id, payer info, cost breakdown, tx details
  - Links to draft_track_id after save

recording_payment_recipients
  - Per-recipient payment records
  - Tracks who got paid how much
```

---

## API Endpoints

### POST /api/recording/calculate-cost
Calculate cost before recording.

**Request:**
```json
{ "bars": 24, "trackCount": 2 }
```

**Response:**
```json
{
  "calculation": {
    "bars": 24,
    "blocks": 3,
    "totalCost": 0.60,
    "split": { "platform": 0.03, "creators": 0.48, "remixerStake": 0.09 }
  }
}
```

### POST /api/recording/prepare-payment
Prepare payment with recipient list.

**Request:**
```json
{
  "bars": 24,
  "sourceTrackIds": ["uuid1", "uuid2"],
  "payerSuiAddress": "0x...",
  "payerPersonaId": "uuid"
}
```

**Response:**
```json
{
  "payment": {
    "id": "payment-uuid",
    "totalCost": 0.60,
    "recipients": [
      { "sui_address": "0x...", "amount": 0.03, "payment_type": "platform" },
      { "sui_address": "0x...", "amount": 0.24, "payment_type": "composition" }
    ],
    "sourceTracksMetadata": [...]
  }
}
```

### POST /api/recording/get-upload-url
Get signed URL for direct Supabase upload (bypasses Vercel's 4.5MB limit).

**Request:**
```json
{ "paymentId": "uuid", "walletAddress": "0x..." }
```

**Response:**
```json
{
  "uploadUrl": "https://...signed-url...",
  "publicUrl": "https://...public-url...",
  "storagePath": "audio/recordings/filename.wav"
}
```

### POST /api/recording/confirm-and-save
Create draft track after payment confirmed.

**Request:**
```json
{
  "paymentId": "uuid",
  "txHash": "...",
  "audioUrl": "https://...",
  "title": "Recording 2/2/2026",
  "bpm": 120,
  "bars": 24,
  "creatorSuiAddress": "0x...",
  "sourceTracksMetadata": [...]
}
```

**Response:**
```json
{
  "draft": {
    "id": "track-uuid",
    "title": "...",
    "audioUrl": "...",
    "remixDepth": 1
  }
}
```

---

## Known Issues & Future Work

### Recording Issues
- [ ] Loops sometimes fall out of sync - need to play a few cycles before recording
- [ ] Armed flow simplified - originally waited for full cycle, now starts immediately
- [ ] Count-in timing may need adjustment based on BPM

### Trim UI Issues
- [ ] Drag handles are clunky - hard to select exact 8-bar section
- [ ] Could add click-to-set-position on waveform
- [ ] Nudge controls work but UX could be smoother

### Future Enhancements
- [ ] Video recording support (capture video along with audio)
- [ ] TING token minting for AI-generated visuals
- [ ] Automatic remix cover image generator
- [ ] Wallet activity/transaction history view
- [ ] Better sync management before recording

---

## Testing Checklist

1. **Recording Capture**
   - [ ] Load two tracks in mixer
   - [ ] Play and sync them
   - [ ] Press Record → ARM appears
   - [ ] Count-in (1-2-3-4) happens
   - [ ] Recording indicator active
   - [ ] Press Record again to stop

2. **Trim Modal**
   - [ ] Modal appears centered (uses React Portal)
   - [ ] Waveform displays with 8-bar grid
   - [ ] Drag handles adjust selection
   - [ ] Cost updates as selection changes
   - [ ] Block audition plays correct sections

3. **Payment Flow**
   - [ ] "Confirm & Pay" shows correct amount
   - [ ] Status cycles: Preparing → Signing → Executing → Saving
   - [ ] No errors during process
   - [ ] Success message appears

4. **Draft Creation**
   - [ ] Draft appears in "My Work" tab
   - [ ] Audio plays correctly
   - [ ] Metadata shows source tracks
   - [ ] Payment record in database

5. **Payment Distribution**
   - [ ] Platform receives 5%
   - [ ] Creators receive 80% (split by IP ratios)
   - [ ] Check recipient wallet balances
