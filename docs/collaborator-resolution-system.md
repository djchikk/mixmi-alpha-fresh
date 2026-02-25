# Collaborator Resolution System

**Date:** February 24, 2026

How mixmi handles collaborators who aren't matched to a wallet at upload time, and the two paths to resolving them.

---

## Two Types of Unresolved Collaborators

When a creator uploads a track with collaborators, there are two ways an unresolved collaborator can be stored:

### 1. Pending Splits (`pending:Name` prefix)

**What:** A lightweight string convention. The split wallet field stores `pending:Name` instead of a real wallet address.

**When created:** During chatbot upload, when the system can't match a collaborator name to any persona or user profile. No wallet is generated — it's just a name placeholder.

**Example database value:** `composition_split_2_wallet = 'pending:Kwame'`

**Key behavior:**
- No wallet exists — earnings can't flow to this address
- The uploader's wallet effectively holds all earnings until resolved
- Cheapest/fastest path — no wallet generation, no persona creation
- Can be resolved later by replacing with a real wallet address

### 2. TBD Personas (`-tbd` suffix)

**What:** A real managed persona with a generated SUI wallet, created under the uploader's account.

**When created:** When the user explicitly clicks "Create managed wallet for [Name]" in the chatbot upload, the edit form's CollaboratorAutosuggest dropdown, or the Resolve tab's autocomplete (added Feb 25, 2026).

**Example database records:**
- `personas` row: `username = 'kwame-tbd'`, `sui_address = '0xabc...'`
- Split field: `composition_split_2_wallet = '0xabc...'` (the TBD persona's real wallet)

**Key behavior:**
- Has a real SUI wallet — can actually receive on-chain USDC
- Lives under the uploader's account (they manage it)
- Can accumulate real earnings from downloads/remixes
- Resolved via claim tokens (invite links) or admin linking

**Full TBD documentation:** See `docs/tbd-collaborator-system-2026-01-11.md`

---

## Resolution Paths

There are three places a user can resolve unresolved collaborators:

### Path 1: Edit Form (IPTrackModal)

**Where:** Dashboard > My Work > click track > Edit > "Who wrote it?" / "Who made it?" steps

**How it works:**
- Split fields show the raw wallet/pending value
- `pending:Name` values display the name with an amber "unresolved" badge
- Resolved wallet addresses show `@username` label in cyan below the field (Feb 24, 2026 addition)
- User can type a name to search via CollaboratorAutosuggest → select a user → wallet replaces the pending value
- If no match found, user can click "Create managed wallet" → creates a TBD persona
- On save, `useIPTrackSubmit.ts` calls `formatSplitWallet()` which auto-adds `pending:` prefix to non-wallet values

**Limitation:** One track at a time. If the same collaborator appears on 5 tracks, user must edit each one.

### Path 2: Resolve Tab in Earnings Dashboard (NEW - Feb 24, 2026)

**Where:** Dashboard > Earnings > Resolve tab

**Two sections:**

#### Pending Collaborators (top section)
- Scans all user's tracks for `pending:` prefix splits
- Groups by collaborator name across all tracks
- Shows: name, track count, split summary, expandable track list
- CollaboratorAutosuggest input for searching/matching
- If no user found, **"Create managed wallet"** option creates a TBD persona (Feb 25, 2026)
- Creating a TBD wallet auto-refreshes Wallets tab and Managed Accounts dropdown
- **"Resolve" button** — batch-updates ALL matching `pending:Name` splits across ALL tracks in one click
- Calls `POST /api/earnings/resolve-pending`

#### TBD Collaborators (bottom section)
- Shows TBD personas (those with `-tbd` suffix usernames)
- Three actions per TBD persona:
  - **Invite** — generates a claim link (shareable URL) for the collaborator to join mixmi
  - **Link to User** — search for existing mixmi user (TODO: actual linking not yet implemented)
  - **This is Me** — merge TBD into one of user's own personas (TODO: actual merge not yet implemented)

**Badge counter:** Shows total unresolved items (pending splits + TBD personas).

### Path 3: Claim Link (for TBD personas only)

**Where:** `/claim/[token]` — public page accessed via invite link

**How it works:**
- Manager generates invite link from Resolve tab
- Collaborator receives link, signs up or logs in
- Selects which of their personas to claim to
- System updates all track splits, transfers balance, archives TBD persona

---

## Data Flow

### Upload Flow
```
Creator uploads track with collaborator "Kwame"
    ↓
System searches personas/user_profiles for "Kwame"
    ↓
├── FOUND → Use their wallet address in split field
├── NOT FOUND → Store as "pending:Kwame" in split field
└── User clicks "Create managed wallet" → Create TBD persona → Use TBD wallet in split field
```

### Resolution Flow (Pending)
```
User goes to Earnings > Resolve tab
    ↓
System scans tracks for pending: splits, groups by name
    ↓
User searches for collaborator via autocomplete
    ↓
├── FOUND → Select user → wallet fills input
├── NOT FOUND → "Create managed wallet" → TBD persona created → wallet fills input
│   └── Wallets tab & Managed Accounts refresh automatically
└── MANUAL → Paste wallet address directly
    ↓
User clicks "Resolve"
    ↓
POST /api/earnings/resolve-pending
    ↓
All matching pending:Name values replaced with real wallet across all tracks
```

### Resolution Flow (TBD)
```
User goes to Earnings > Resolve tab
    ↓
System shows TBD personas (-tbd suffix)
    ↓
User clicks "Invite" → generates claim link
    ↓
Collaborator visits link → signs up → selects persona → claims
    ↓
All track splits updated, balance transferred, TBD persona archived
```

---

## Key Files

### Pending Splits System
| File | Purpose |
|------|---------|
| `hooks/useIPTrackSubmit.ts` | `formatSplitWallet()` — adds `pending:` prefix to non-wallet values (line 22-38) |
| `app/api/upload-studio/submit/route.ts` | `processSplits()` — creates `pending:Name` on upload (line 938-965) |
| `app/api/earnings/resolve-pending/route.ts` | Batch-resolves `pending:` splits across multiple tracks |
| `components/account/EarningsTab.tsx` | `fetchPendingSplits()`, `resolvePendingCollaborator()`, Pending Collaborators UI |
| `components/modals/IPTrackModal.tsx` | Per-track pending display (amber badge) and wallet username labels |

### TBD Persona System
| File | Purpose |
|------|---------|
| `app/api/upload-studio/create-collaborator-persona/route.ts` | Creates TBD persona with wallet |
| `app/api/personas/generate-claim-token/route.ts` | Generates invite link for TBD persona |
| `app/api/personas/claim-tbd/route.ts` | Processes claim (updates splits, transfers balance) |
| `app/claim/[token]/page.ts` | Public claim page UI |
| `components/account/EarningsTab.tsx` | `fetchTbdPersonas()`, TBD Collaborators UI, Invite/Link/Merge actions |
| `components/shared/CollaboratorAutosuggest.tsx` | Autocomplete with "Create managed wallet" option |

### Shared
| File | Purpose |
|------|---------|
| `components/shared/CollaboratorAutosuggest.tsx` | Used in both IPTrackModal and EarningsTab for user search |
| `app/api/profile/search-users/route.ts` | User search API (searches personas + user_profiles) |

---

## API Reference

### POST /api/earnings/resolve-pending

Batch-resolve `pending:` splits across multiple tracks.

**Request:**
```json
{
  "pendingName": "Kwame",
  "resolvedWallet": "0xabc123...",
  "trackIds": ["uuid1", "uuid2"],
  "uploaderWallet": "0xuploader..."
}
```

**Response:**
```json
{
  "success": true,
  "updatedFields": 4,
  "tracksProcessed": 2
}
```

**Security:** Verifies `primary_uploader_wallet` matches `uploaderWallet` for each track before updating.

---

## Testing Checklist (Feb 25, 2026)

### Pending Splits Resolution
- [x] Upload a track via chatbot with an unresolved collaborator (e.g., "me and Ray, 50/50")
- [x] Verify `pending:Ray` appears in the database split fields
- [x] Go to Account > Earnings > Resolve tab
- [x] Verify collaborator appears in Pending Collaborators section
- [ ] Click track count to expand — verify correct track titles shown
- [x] Search for a user via autocomplete in the resolve input
- [ ] Click Resolve — verify the split is updated in the database
- [ ] Verify collaborator disappears from pending list after resolution
- [ ] Open the track in edit form — verify wallet shows with @username label
- [ ] Verify badge counter decrements

### TBD Wallet Creation from Resolve Tab (NEW - Feb 25)
- [x] Search for a name with no matches in Resolve tab autocomplete
- [x] Verify "Create managed wallet for [Name]" option appears
- [x] Click create — verify wallet fills into the resolve input
- [x] Verify TBD persona appears in TBD Collaborators section below
- [x] Verify TBD wallet appears in Wallets tab
- [x] Verify TBD wallet appears in Managed Accounts dropdown

### Wallet Username Labels (Edit Form)
- [ ] Open a track with collaborator wallets in edit form
- [ ] Verify @username labels appear below wallet addresses in both composition and production splits
- [ ] Select a new collaborator via autocomplete — verify @username appears immediately
- [ ] Verify `pending:Name` entries show amber "unresolved" badge (not username label)

### Mixer Earnings Copy
- [ ] Open edit form licensing step for a song — verify simplified "$0.10 per remix use" wording
- [ ] Start a chatbot upload for a song — verify mixer question uses new wording
- [ ] Start a chatbot upload for a loop — verify mixer earnings uses new wording

---

## Bug Fixes (Feb 25, 2026)

### Infinite Spinner on Resolve Tab
**Problem:** Resolve tab showed an infinite spinner, never rendering content.

**Root cause:** `fetchTbdPersonas()` had two early-return paths (error and empty data) that didn't call `setLoadingTbd(false)`. The Resolve view spinner waits for both `loadingTbd` AND `loadingPending` to be false, so if the TBD fetch returned early (e.g., zero TBD personas), the spinner was stuck permanently.

**Fix:** Added `setLoadingTbd(false)` to both early-return paths in `fetchTbdPersonas()`.

**Commit:** `ca96bd3`
