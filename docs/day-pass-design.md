# Playlist Day Pass - Design Document

## Overview

$1 USDC for 24 hours of unlimited playlist streaming, with plays tracked and revenue distributed to creators.

---

## User Experience

### Purchase Flow
1. User sees "Day Pass - $1" button in playlist widget header
2. Click opens purchase modal (or adds to cart)
3. Pay with SUI/USDC (same zkLogin flow as track purchases)
4. Pass activates immediately with 24-hour countdown

### Active Pass UI
- Countdown timer in playlist widget: "23:45:12 remaining"
- Play counter: "12 tracks played"
- Maybe: small progress bar showing time left

### Playback Changes
- Songs play in FULL (not 20-second preview)
- Loops play in full (same as now)
- Each completed play is logged for revenue share

---

## Revenue Model

### Pricing
- Day Pass: **$1 USDC**
- Platform fee: TBD% (start with 0% for testing?)

### Play Credits (for revenue distribution)
| Content Type | Credits per Play |
|--------------|------------------|
| Full Song | 5 credits |
| Loop Pack (per track) | 5 credits (treated like song) |
| Single Loop | 1 credit |

### Example Distribution
User plays during their day pass:
- 10 full songs (50 credits)
- 5 loops (5 credits)
- Total: 55 credits

Revenue per credit: $1 / 55 = ~$0.018

Song A (played 3 times): 15 credits × $0.018 = $0.27 → split among Song A's IP holders

---

## Database Schema

### Table: `day_passes`
```sql
CREATE TABLE day_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,          -- SUI address of buyer
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,     -- purchased_at + 24 hours
  amount_usdc DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  tx_hash TEXT,                        -- SUI transaction hash
  status TEXT NOT NULL DEFAULT 'active', -- active, expired, distributed
  distributed_at TIMESTAMPTZ,          -- when revenue was distributed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_day_passes_user ON day_passes(user_address);
CREATE INDEX idx_day_passes_status ON day_passes(status);
```

### Table: `day_pass_plays`
```sql
CREATE TABLE day_pass_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_pass_id UUID NOT NULL REFERENCES day_passes(id),
  track_id UUID NOT NULL REFERENCES ip_tracks(id),
  content_type TEXT NOT NULL,          -- full_song, loop, loop_pack
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER,            -- actual play duration
  credits INTEGER NOT NULL DEFAULT 1,  -- calculated credits for this play

  CONSTRAINT fk_day_pass FOREIGN KEY (day_pass_id) REFERENCES day_passes(id)
);

CREATE INDEX idx_plays_day_pass ON day_pass_plays(day_pass_id);
CREATE INDEX idx_plays_track ON day_pass_plays(track_id);
```

---

## API Endpoints

### POST /api/day-pass/purchase
Purchase a new day pass.
```typescript
Request: { userAddress: string }
Response: {
  dayPassId: string,
  expiresAt: string,
  txBytes: string,      // For SUI payment
  sponsorSignature: string
}
```

### POST /api/day-pass/log-play
Log a track play (called when track finishes).
```typescript
Request: {
  dayPassId: string,
  trackId: string,
  contentType: string,
  durationSeconds: number
}
Response: { success: true, totalPlays: number }
```

### GET /api/day-pass/status
Check if user has active pass.
```typescript
Request: ?userAddress=0x...
Response: {
  hasActivePass: boolean,
  dayPassId?: string,
  expiresAt?: string,
  remainingSeconds?: number,
  totalPlays?: number
}
```

### POST /api/day-pass/distribute
Distribute revenue for expired pass (can be automated via cron).
```typescript
Request: { dayPassId: string }
Response: {
  success: true,
  totalPlays: number,
  recipients: [{ address: string, amount: number }],
  txHash: string
}
```

---

## Implementation Plan

### Phase 1: Core Infrastructure
1. Create database tables
2. Create `lib/dayPass.ts` utilities
3. Create API endpoints for purchase and status

### Phase 2: Playlist Integration
1. Add day pass status check to SimplePlaylistPlayer
2. Remove 20-second limit when pass is active
3. Add play logging when track completes
4. Add UI for purchase button and countdown

### Phase 3: Revenue Distribution
1. Create distribution calculation function
2. Create batch payment transaction builder
3. Add admin/cron endpoint for distribution
4. Test with real payments on testnet

### Phase 4: Polish
1. Purchase from multiple locations (widget, cart, dedicated page)
2. Play history view for user
3. Creator dashboard showing day pass earnings

---

## Key Files to Create/Modify

### New Files
- `lib/dayPass.ts` - Day pass utilities
- `app/api/day-pass/purchase/route.ts`
- `app/api/day-pass/log-play/route.ts`
- `app/api/day-pass/status/route.ts`
- `app/api/day-pass/distribute/route.ts`
- `components/playlist/DayPassButton.tsx` - Purchase button component

### Modified Files
- `components/SimplePlaylistPlayer.tsx` - Add pass check, logging, UI
- `config/pricing.ts` - Add DAY_PASS_PRICE_USDC

---

## Open Questions

1. **When to distribute?**
   - Option A: Automatically when pass expires (cron job)
   - Option B: User manually triggers
   - Option C: Daily batch job for all expired passes

2. **Partial plays?**
   - Skip if < 30 seconds?
   - Proportional credits based on % played?

3. **Radio stations?**
   - Include in day pass? Different credit rate?

4. **Multiple passes?**
   - Can user buy another while one is active? (extend time?)

---

*Created: January 2026*
