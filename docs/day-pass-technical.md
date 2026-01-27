# Day Pass System - Technical Documentation

Complete technical reference for the mixmi day pass streaming system.

---

## Overview

The day pass system enables $1 USDC purchases for 24 hours of unlimited full-song streaming. Every play is logged for credit-based revenue distribution to creators.

### Key Flows
1. **Purchase** - User buys day pass via zkLogin + sponsored SUI transaction
2. **Streaming** - Full songs unlocked (no 20-second preview limit)
3. **Logging** - Every play logged with credits based on content type
4. **Distribution** - When pass expires, $1 distributed to creators proportionally

---

## Database Tables

### `day_passes`
Tracks purchased day passes and their lifecycle.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_address` | TEXT | SUI address of buyer |
| `purchased_at` | TIMESTAMPTZ | When pass was purchased |
| `expires_at` | TIMESTAMPTZ | purchased_at + 24 hours |
| `amount_usdc` | DECIMAL(10,2) | Price paid (default $1.00) |
| `tx_hash` | TEXT | SUI transaction hash for purchase |
| `status` | TEXT | `pending`, `active`, `expired`, `distributed` |
| `distributed_at` | TIMESTAMPTZ | When revenue was distributed |
| `distribution_tx_hash` | TEXT | SUI tx for revenue distribution |

**Status Lifecycle:**
```
pending → active → expired → distributed
   ↑         ↑
   │         └── tx confirmed, pass valid
   └── created, awaiting payment
```

### `day_pass_plays`
Logs each track play during an active day pass (for revenue distribution).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `day_pass_id` | UUID | FK to day_passes |
| `track_id` | UUID | FK to ip_tracks (clean UUID, no -loc- suffix) |
| `content_type` | TEXT | full_song, loop, loop_pack, ep |
| `played_at` | TIMESTAMPTZ | When track was played |
| `duration_seconds` | INTEGER | Actual play duration |
| `credits` | INTEGER | Calculated credits (auto via trigger) |
| `globe_location` | INTEGER | Globe location index (for geo analytics) |

**Credits (auto-calculated by trigger):**
- `full_song` = 5 credits
- `loop_pack` = 5 credits
- `ep` = 5 credits
- `loop` = 1 credit

### `preview_plays`
Analytics table for 20-second previews (non-paying listeners).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `track_id` | UUID | FK to ip_tracks |
| `content_type` | TEXT | full_song, loop, etc. |
| `user_address` | TEXT | Optional (anonymous allowed) |
| `globe_location` | INTEGER | Globe location index |
| `played_at` | TIMESTAMPTZ | When preview was played |

**Note:** Preview plays do NOT count toward revenue distribution. They're purely for analytics.

---

## API Endpoints

### `POST /api/day-pass/purchase`
Creates a pending day pass and returns payment info.

**Request:**
```json
{
  "userAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "dayPassId": "uuid",
  "expiresAt": "2026-01-28T21:00:00Z",
  "amountUsdc": 1.00,
  "recipientAddress": "0x..." // Platform wallet
}
```

### `PUT /api/day-pass/purchase`
Confirms payment and activates the day pass.

**Request:**
```json
{
  "dayPassId": "uuid",
  "txHash": "SUI_TX_HASH"
}
```

**Response:**
```json
{
  "success": true,
  "dayPassId": "uuid",
  "expiresAt": "2026-01-28T21:00:00Z",
  "status": "active"
}
```

### `GET /api/day-pass/status`
Checks if user has an active day pass.

**Query:** `?userAddress=0x...`

**Response (active pass):**
```json
{
  "hasActivePass": true,
  "dayPassId": "uuid",
  "expiresAt": "2026-01-28T21:00:00Z",
  "remainingSeconds": 82800,
  "totalPlays": 15
}
```

**Response (no pass):**
```json
{
  "hasActivePass": false
}
```

### `POST /api/day-pass/log-play`
Logs a track play for revenue distribution.

**Request:**
```json
{
  "dayPassId": "uuid",
  "trackId": "uuid-loc-0",  // Location suffix stripped automatically
  "contentType": "full_song",
  "durationSeconds": 180
}
```

**Response:**
```json
{
  "success": true,
  "playId": "uuid",
  "credits": 5,
  "totalPlays": 16
}
```

### `POST /api/day-pass/log-preview`
Logs a 20-second preview play (analytics only).

**Request:**
```json
{
  "trackId": "uuid-loc-0",
  "contentType": "full_song",
  "userAddress": "0x..." // Optional
}
```

**Response:**
```json
{
  "success": true
}
```

---

## Client Components

### `SimplePlaylistPlayer.tsx`
Main playlist player with day pass integration.

**Key State:**
```typescript
const [dayPassStatus, setDayPassStatus] = useState<DayPassStatus>({
  hasActivePass: false
});
const [remainingTime, setRemainingTime] = useState<number>(0);
const [totalPlays, setTotalPlays] = useState<number>(0);
```

**Behavior:**
- Checks day pass status on mount and every 60 seconds
- If `hasActivePass: true`, full songs play completely (no 20s limit)
- If `hasActivePass: false`, full songs cut off at 20 seconds
- Logs plays when tracks end (if day pass active)
- Logs preview plays at 20 seconds (if no day pass)

### `DayPassPurchaseModal.tsx`
Purchase flow modal with zkLogin payment.

**Purchase Flow:**
1. Create pending day pass (POST /api/day-pass/purchase)
2. Build payment transaction client-side (buildSplitPaymentForSponsorship)
3. Get sponsorship (POST /api/sui/sponsor)
4. Sign with zkLogin ephemeral keypair
5. Execute transaction (POST /api/sui/execute)
6. Confirm purchase (PUT /api/day-pass/purchase)
7. Cache locally and update UI

### `lib/dayPass.ts`
Utility functions for day pass operations.

**Key Functions:**
- `checkDayPassStatus(userAddress)` - Check if user has active pass
- `logPlay(dayPassId, trackId, contentType, duration)` - Log a play
- `formatTimeRemaining(seconds)` - Format countdown as HH:MM:SS
- `cacheDayPassLocally(dayPassId, expiresAt)` - Store in localStorage
- `getLocalDayPass()` - Get cached pass (offline resilience)

**Constants:**
```typescript
export const DAY_PASS_PRICE_USDC = 1.00;
export const DAY_PASS_DURATION_HOURS = 24;

export const CREDITS = {
  FULL_SONG: 5,
  LOOP_PACK: 5,
  EP: 5,
  LOOP: 1,
};
```

---

## Revenue Distribution

### Credit Calculation
When a track is played, credits are assigned based on content type:

| Content Type | Credits | Rationale |
|--------------|---------|-----------|
| full_song | 5 | Full production, longer duration |
| ep | 5 | Same as song (per track) |
| loop_pack | 5 | Treated as short song |
| loop | 1 | Short, often used as samples |

### Distribution Formula
```
Creator Earnings = (Creator's Credits ÷ Total Credits) × $1.00
```

**Example:**
- Total plays generate 100 credits
- Your songs played = 30 credits
- Your share = 30/100 = 30% = $0.30

### Distribution Process (Future Implementation)
1. Day pass expires (status: `expired`)
2. System calculates total credits per track
3. For each track, look up creator's SUI wallet
4. Build multi-recipient payment transaction
5. Execute distribution
6. Update status to `distributed`

---

## Track ID Location Suffix

Tracks placed on the globe get a location suffix: `{uuid}-loc-{index}`

**Example:** `4ace81d6-b45c-40a4-873e-1934ef8b573c-loc-0`

**Handling:**
- API strips `-loc-X` before storing in `track_id` (UUID column)
- Location index stored separately in `globe_location` (INTEGER column)
- Preserves geographic analytics while maintaining FK integrity

---

## Database Functions & Triggers

### `calculate_play_credits(content_type)`
Returns credit value for a content type.

### `set_play_credits()` (Trigger)
Automatically sets `credits` column on INSERT based on `content_type`.

### `has_active_day_pass(user_address)`
Returns active pass info for a user.

### `get_day_pass_play_summary(day_pass_id)`
Returns aggregated credits per track for distribution.

---

## Analytics Queries

### Top played tracks (revenue)
```sql
SELECT
  t.title,
  t.artist,
  SUM(p.credits) as total_credits,
  COUNT(*) as play_count
FROM day_pass_plays p
JOIN ip_tracks t ON p.track_id = t.id
GROUP BY t.id
ORDER BY total_credits DESC
LIMIT 20;
```

### Preview to purchase conversion
```sql
SELECT
  track_id,
  COUNT(*) as preview_count,
  (SELECT COUNT(*) FROM day_pass_plays dp WHERE dp.track_id = pp.track_id) as full_plays
FROM preview_plays pp
GROUP BY track_id
ORDER BY preview_count DESC;
```

### Geographic engagement
```sql
SELECT
  globe_location,
  COUNT(*) as play_count,
  SUM(credits) as total_credits
FROM day_pass_plays
WHERE globe_location IS NOT NULL
GROUP BY globe_location
ORDER BY play_count DESC;
```

---

## File Locations

| File | Purpose |
|------|---------|
| `lib/dayPass.ts` | Client utilities, constants, types |
| `components/SimplePlaylistPlayer.tsx` | Playlist with day pass integration |
| `components/playlist/DayPassPurchaseModal.tsx` | Purchase flow modal |
| `app/api/day-pass/purchase/route.ts` | Create/confirm purchase |
| `app/api/day-pass/status/route.ts` | Check pass status |
| `app/api/day-pass/log-play/route.ts` | Log revenue plays |
| `app/api/day-pass/log-preview/route.ts` | Log preview plays |
| `config/pricing.ts` | Central pricing config |
| `docs/day-pass-economics.md` | Creator-facing economics doc |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PLATFORM_SUI_ADDRESS` | Platform wallet for day pass payments (optional - derived from sponsor key if not set) |
| `SUI_SPONSOR_PRIVATE_KEY` | Sponsor wallet private key (hex encoded) |

---

*Last updated: January 2026*
