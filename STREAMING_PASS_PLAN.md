# Playlist Streaming Pass - Implementation Plan

## Status: ON HOLD - Awaiting Smart Contract Implementation

This feature requires smart contracts for payment splitting before it can be deployed.

---

## Overview
Allow users to purchase temporary streaming passes to play full-length songs in the Playlist Widget, with competitive artist payment rates.

## Pricing Model

### Pass Price
- **1-hour streaming pass = 2 STX** (~$2)
- Much more affordable than original 5 STX proposal
- Still provides **100x better rates than Spotify** for artists

### Weighted Time Consumption
To fairly compensate artists while keeping pricing simple:

- **Loops**: Consume credits at **1x rate**
  - 1 second played = 1 second deducted

- **Songs**: Consume credits at **4x rate**
  - 1 second played = 4 seconds deducted
  - Reflects higher value of full compositions

### What 60 Minutes Buys
With 3600 seconds of credits:
- **60 minutes of loops** (3600s ÷ 1 = 3600s playback)
- **15 minutes of songs** (3600s ÷ 4 = 900s playback)
- **Mix and match!** Users can play any combination

### Why This Is Fair
- Users complained loops and songs should have different rates ✓
- Songs are 4x longer on average and have more production value
- Artists get compensated proportionally to content value
- Simple to understand: "songs cost more streaming time"

---

## Technical Implementation

### 1. Time Tracking (Active Listening Only)
- Timer counts down **only while tracks are playing**
- Pauses when user pauses/skips
- Resumes when playback resumes
- Fairer for users, better UX

### 2. State Management

#### Client-Side (localStorage)
```typescript
interface StreamingPass {
  purchaseDate: number;        // timestamp
  totalSeconds: number;        // total credits purchased (3600)
  remainingSeconds: number;    // credits remaining
  txId?: string;              // Stacks transaction ID
}
```

#### Database Tables (Supabase)

**`playlist_streaming_passes`** - Purchase records
```sql
CREATE TABLE playlist_streaming_passes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_wallet TEXT NOT NULL,
  purchase_date TIMESTAMP NOT NULL DEFAULT NOW(),
  duration_seconds INT NOT NULL,
  stx_amount DECIMAL NOT NULL,
  tx_id TEXT,
  contract_call_data JSONB,  -- Smart contract call details
  created_at TIMESTAMP DEFAULT NOW()
);
```

**`playlist_streams`** - Artist payout tracking
```sql
CREATE TABLE playlist_streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pass_id UUID REFERENCES playlist_streaming_passes(id),
  track_id TEXT NOT NULL,
  artist_wallet TEXT NOT NULL,
  seconds_streamed INT NOT NULL,
  weighted_seconds INT NOT NULL,  -- Actual consumption (songs × 4)
  content_type TEXT NOT NULL,     -- 'loop' or 'full_song'
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### 3. Smart Contract Requirements

**BLOCKER: This feature needs the following smart contracts:**

#### Payment Splitter Contract
```clarity
;; Required functionality:
;; 1. Accept STX payment for streaming pass
;; 2. Escrow funds until streaming occurs
;; 3. Split payments to artists based on actual listening
;; 4. Handle platform fee (if any)
;; 5. Support batch payouts (gas efficiency)
```

#### Key Contract Functions Needed
- `purchase-streaming-pass` - User buys pass
- `record-stream` - Log what was streamed
- `claim-artist-payout` - Artist withdraws earnings
- `calculate-splits` - Pro-rata distribution logic

---

## UI/UX Flow

### 1. User Journey
1. User adds songs to Playlist
2. Clicks play → sees "Get Streaming Pass" prompt
3. Modal shows pricing and benefits
4. User connects wallet & pays 2 STX
5. Smart contract records purchase
6. Credits activate immediately
7. User streams music, timer counts down
8. Time remaining shown in Playlist header

### 2. Playlist Widget Updates

#### New State Variables
```typescript
const [hasStreamingPass, setHasStreamingPass] = useState(false);
const [remainingSeconds, setRemainingSeconds] = useState(0);
const [showPassModal, setShowPassModal] = useState(false);
const [lastTickTime, setLastTickTime] = useState<number | null>(null);
```

#### Playback Logic Changes
```typescript
// Before playing a full_song:
if (track.content_type === 'full_song' && !hasStreamingPass) {
  // Show purchase modal instead of playing
  setShowPassModal(true);
  return;
}

// During playback (every second):
if (hasStreamingPass && isPlaying) {
  const consumed = track.content_type === 'full_song' ? 4 : 1;
  const remaining = consumeStreamingTime(1, track.content_type);

  if (remaining === 0) {
    // Pass depleted - pause and show recharge prompt
    setIsPlaying(false);
    setHasStreamingPass(false);
  }
}
```

#### Header Display
```tsx
{hasStreamingPass && (
  <div className="text-xs text-[#81E4F2] font-mono">
    {formatTime(remainingSeconds)} left
  </div>
)}
```

### 3. Track Display Updates
Show users what they're getting:
```tsx
<div className="text-[9px] text-gray-500">
  {track.content_type === 'full_song'
    ? hasStreamingPass ? 'Full song' : '20s preview'
    : 'Full loop'
  }
</div>
```

---

## Artist Payout Calculation

### Per-Stream Tracking
Every time a track plays, log to `playlist_streams`:
```typescript
{
  pass_id: "uuid-of-purchase",
  track_id: "track-123",
  artist_wallet: "SP2J6ZY...",
  seconds_streamed: 180,        // 3 minutes actual playback
  weighted_seconds: 720,        // 3 min × 4 for songs
  content_type: "full_song"
}
```

### Payout Distribution
For each streaming pass purchase:
1. Sum all `weighted_seconds` from that pass
2. Calculate each artist's share: `(their_weighted_seconds / total_weighted_seconds) × 2 STX`
3. Trigger smart contract payout

### Example
User buys 1-hour pass (2 STX), streams:
- Artist A: 10 min of loops = 600 weighted seconds
- Artist B: 5 min of songs = 1200 weighted seconds (5 × 60 × 4)
- **Total**: 1800 weighted seconds

**Payouts:**
- Artist A: (600 / 1800) × 2 STX = **0.667 STX**
- Artist B: (1200 / 1800) × 2 STX = **1.333 STX**

---

## Files Already Created (Ready to Use When Smart Contracts Deploy)

✅ **`lib/streamingPass.ts`** - Complete utility functions
- Pass creation, validation, time consumption
- Weighted multipliers (1x loops, 4x songs)
- Time formatting and estimates
- localStorage management
- **STATUS:** Already implemented and committed to repo

✅ **`components/modals/StreamingPassModal.tsx`** - Purchase UI
- Beautiful modal with pricing display
- Explains weighted time system
- Shows what 60 min can buy
- Artist support messaging
- Ready for Stacks wallet integration
- **STATUS:** Already implemented and committed to repo

These files are production-ready and just need smart contract integration!

## Next Steps (When Smart Contracts Ready)

1. **Deploy Smart Contracts**
   - Payment splitter
   - Artist payout logic
   - Platform fee handling

2. **Integrate Wallet Connection**
   - Add Stacks wallet call to `StreamingPassModal`
   - Handle transaction signing
   - Record tx_id in database

3. **Update PlaylistWidget**
   - Import streaming pass utilities
   - Add pass state management
   - Modify playback logic
   - Add time tracking interval
   - Show remaining time in header

4. **Database Migration**
   - Create tables in Supabase
   - Set up indexes for efficient queries

5. **Admin Dashboard**
   - View streaming analytics
   - Trigger artist payouts
   - Monitor platform revenue

6. **Testing**
   - Test pass purchase flow
   - Verify weighted consumption
   - Test edge cases (pass depletion mid-song)
   - Verify payout calculations

---

## Artist Compensation Comparison

### Spotify
- ~$0.003 - $0.005 per stream
- Average 3-min song = **$0.004**

### Our Platform (Example)
User pays 2 STX for 60 min, streams twelve 5-min songs:
- 60 min ÷ 12 = 5 min/song
- 2 STX ÷ 12 = **0.167 STX/song** (~$0.17)

**Artists earn ~42x more per stream!** 🎵💰

Even accounting for shorter streams and mixed content, artists will earn **10-100x** more than traditional streaming platforms.

---

## Open Questions

1. **Platform fee?** Should Mixmi take a small percentage (5-10%)?
2. **Pass expiration?** Credits never expire, or expire after X days?
3. **Bulk discounts?** Offer 3-hour or 24-hour passes at better rates?
4. **Gift passes?** Allow users to gift streaming credits?
5. **Subscription model?** Monthly unlimited streaming for power users?

---

## Demo Mode (Current Implementation)

The modal and utilities are functional for testing:
- Modal can be opened to see UI/UX
- Purchase button creates a pass (no payment)
- All calculations work correctly
- Perfect for demos and user testing

Just need to comment out or gate the actual purchase flow until contracts are ready.

---

**Created:** 2025-10-04
**Status:** Ready for smart contract implementation
**Priority:** High - Great revenue opportunity + artist value prop
