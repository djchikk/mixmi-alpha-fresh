# mixmi Alpha - Claude Code Reference

Technical reference for the mixmi alpha platform. For future Claude sessions.

---

## Quick Reference

### Content Type Colors
| Type | Color | Hex |
|------|-------|-----|
| Loop | Bright Lavender | #A084F9 |
| Song | Lime Green | #A8E66B |
| Video | Lighter Sky Blue | #5BB5F9 |
| Radio | Golden Amber | #FFC044 |
| Portal | White | #FFFFFF |
| Sync/UI | Cyan | #81E4F2 |

### Content Type Detection
```typescript
const isRadio = contentType === 'radio_station' || contentType === 'grabbed_radio';
const isVideo = contentType === 'video_clip';
const isSong = contentType === 'full_song';
const isLoop = contentType === 'loop';
const isPack = ['loop_pack', 'station_pack', 'ep'].includes(contentType);
const isPortal = contentType === 'portal';
```

### Video Detection
```typescript
const isVideo = url && (url.includes('.mp4') || url.includes('.webm') || url.includes('video/'));
```

### BPM Priority (Master Tempo)
```typescript
loop: 3, full_song: 2, radio_station: 1, grabbed_radio: 1, default: 0
```

### Button Standard
Contextual buttons: `w-[72px] h-[20px]`, 9px bold text, 10px icons.

---

## Core Features

### Universal Mixer
Two-deck audio/video mixer at `/globe` page.

**Audio Handling:**
- Audio plays via HTMLAudioElement (not video element)
- Video elements always render with `muted={true}`
- AUDIO button controls audio element volume
- Radio streams proxy through `/api/radio-proxy`

**Video Display:**
- `VideoDisplayArea.tsx` - 408px height display
- Crossfade modes: slide (split-screen), blend (opacity), cut (hard at 50%)
- Effects: color shift, pixelate, invert, B&W

**Radio GRAB:**
1. Radio loads → MediaRecorder captures rolling 20-second buffer
2. After 10 seconds, PLAY button → GRAB (orange)
3. Click GRAB → captures audio, creates blob URL
4. Grabbed audio loads to deck with inherited BPM

**Pack Handling:**
Dropping packs on decks unpacks them - first item loads, rest expands in crate.

### Upload Studio
Conversational upload at `/upload-studio`.

**Voice Support:**
- Mic button records via MediaRecorder (webm/opus)
- `/api/upload-studio/voice/transcribe` → OpenAI Whisper STT
- `/api/upload-studio/voice/speak` → OpenAI TTS
- `inputMode` tracking determines if TTS plays response

**Preview Card:**
- Live preview builds as chatbot collects info
- 160×160px card matching globe style
- Shows locations, tags, content type color

**Sacred Content Protection:**
- `remix_protected` boolean field
- Chatbot detects spiritual/ceremonial context, offers protection
- Protected tracks can stream/download but not load in mixer

### Portal System
Circular cards for super-curators at specific locations.

**Visual:**
- 160px circular card (vs square for other content)
- 6px iridescent shimmer border
- White globe node color (#FFFFFF)
- No playback elements - links to profiles

**Admin:** `/admin/portals` - access code protected CRUD interface

### Drag & Drop
Full symmetry between Globe, Crate, Playlist, and Decks.

**Pattern:**
- Type: `COLLECTION_TRACK`
- Required fields: id, title, audioUrl, bpm, stream_url, content_type
- Combine refs: `drag(drop(ref))` for dual capability
- Use `fromPlaylist` flag for internal vs external drops

---

## Key File Locations

### Mixer
- `components/mixer/UniversalMixer.tsx` - Main mixer component
- `components/mixer/compact/VideoDisplayArea.tsx` - Video display with effects
- `components/mixer/compact/SimplifiedDeckCompact.tsx` - Deck thumbnails
- `components/mixer/compact/MasterTransportControlsCompact.tsx` - Transport

### Upload Studio
- `components/upload-studio/ConversationalUploader.tsx` - Chat UI with voice
- `components/upload-studio/UploadPreviewCard.tsx` - Live preview card
- `lib/upload-studio/system-prompt.ts` - Chatbot personality
- `app/api/upload-studio/submit/route.ts` - Track submission
- `app/api/upload-studio/voice/transcribe/route.ts` - Whisper STT
- `app/api/upload-studio/voice/speak/route.ts` - OpenAI TTS

### Playback
- `components/SimplePlaylistPlayer.tsx` - Playlist with drag support
- `components/SimpleRadioPlayer.tsx` - Radio player with CORS proxy
- `components/RadioWidget.tsx` - Radio widget

### Globe & Cards
- `lib/globeDataSupabase.ts` - Globe data fetching
- `contexts/MixerContext.tsx` - Global crate/collection state
- `components/cards/GlobeTrackCard.tsx` - Main card router
- `components/cards/PortalCard.tsx` - Circular portal cards

### Profile
- `components/profile/ProfileImage.tsx` - Avatar (video support)
- `components/cards/GalleryCard.tsx` - Gallery items (video support)

---

## Database Fields

### ip_tracks
- `content_type` - loop, full_song, video_clip, radio_station, loop_pack, ep, station_pack, portal
- `remix_protected` (boolean) - Prevents mixer loading
- `stream_url` - Radio station stream URL
- `bpm` - Beats per minute
- `video_crop_x/y/width/height/zoom` - Video crop data
- `video_natural_width/height` - Original video dimensions
- `portal_username` - For portal content_type, username for profile link

### user_profiles
- `sticker_id` (default 'daisy-blue')
- `sticker_visible` (default true)

---

## Technical Patterns

### Radio Stations
Always proxy through CORS proxy:
```typescript
const proxiedUrl = `/api/radio-proxy?url=${encodeURIComponent(stream_url)}`;
```

### Memory Cleanup
```typescript
useEffect(() => {
  return () => {
    audio.pause();
    audio.src = '';
    audio.load();
    recorder?.stop();
    clearTimeout(timerRef.current);
  };
}, []);
```

### User Search API
```typescript
// GET /api/profile/search-users?q=searchterm
// Searches both user_profiles and personas tables
const response = await fetch(`/api/profile/search-users?q=${encodeURIComponent(query)}`);
const { users } = await response.json();
// Returns: [{ walletAddress, username, displayName, avatarUrl, suiAddress, isPersona }]
// - suiAddress: SUI payment address (for personas with wallets)
// - isPersona: true if from personas table (new system)
```

---

## Known Issues

### Loop Pack Pricing Display
- TrackDetailsModal shows per-loop price labeled as "full pack" price
- Should use `price_stx` for pack total, `download_price_stx` for per-loop

### Edit Form - Video Covers
- Edit form doesn't accept video clips as cover images (chatbot does)
- Fix: Update `IPTrackModal.tsx` cover image upload to accept video

---

## SUI Blockchain & USDC Pricing (December 2025)

### Authentication Methods
Three auth types in `AuthContext`:
| Auth Type | `walletAddress` (STX) | `suiAddress` (SUI) | Use Case |
|-----------|----------------------|-------------------|----------|
| `wallet` | ✅ Real STX | ❌ null | Stacks wallet users |
| `invite` | ✅ From alpha_users | ❌ null | Invite code only |
| `zklogin` | ⚠️ Linked if exists | ✅ Real SUI | Google OAuth + invite |

### zkLogin Signup Flow (January 2026)
New users signing up with Google/Apple OAuth:

1. **SignInModal** - User enters invite code, chooses username (3-30 chars)
2. **Username check** - Validates against BOTH `user_profiles` AND `personas` tables
3. **OAuth redirect** - Stores pending state in sessionStorage with `chosenUsername`
4. **Callback** - Extracts JWT, calls salt API with invite code and username
5. **Salt API** creates:
   - `zklogin_users` record (google_sub, salt, sui_address, invite_code)
   - `accounts` record (sui_address, zklogin_salt)
   - `personas` record (username, wallet_address = sui_address)
   - `user_profiles` record (wallet_address = sui_address, username)

**Returning user detection**: Salt API checks `google_sub` first. If found, returns existing salt (same SUI address) and skips record creation.

**Important for testing**: To re-register a Google account, delete from `zklogin_users`:
```sql
DELETE FROM zklogin_users WHERE email = 'user@gmail.com';
```

**Profile page SUI handling**: URLs can contain SUI addresses (`/profile/0x123...`). Profile page detects `0x` prefix and looks up persona by `wallet_address`.

### USDC Pricing Model
All prices now in USDC (centralized in `config/pricing.ts`):
```typescript
mixer: { loopRecording: 0.10, songSection: 0.10, videoClip: 0.10 }
download: { loop: 2.00, song: 1.00, videoClip: 2.00 }
contact: { inquiryFee: 1.00, creatorCutPercent: 100 }
account: { maxPersonas: 5, maxTbdWallets: 5 }
```

### New Database Tables (Accounting System)
- **accounts** - Parent account linking multiple auth methods
- **personas** - Up to 5 identities per account, each with USDC balance
- **tbd_wallets** - Hold earnings for collaborators without mixmi accounts
- **earnings** - Transaction log (direct sales, Gen 1/2 remix royalties)
- **zklogin_users** - SUI addresses linked to invite codes

### Display Address Priority
```typescript
// For UI display, prefer SUI address
const displayAddress = suiAddress || walletAddress;
// For auth/profile lookups, prefer STX
const effectiveAddress = walletAddress || suiAddress;
```

### Key Files for SUI/Accounting
- `config/pricing.ts` - Single source of truth for all prices
- `contexts/AuthContext.tsx` - Auth state with personas
- `supabase/migrations/20251226000000_add_persona_accounting.sql` - Core tables
- `supabase/migrations/20251226000002_add_usdc_pricing.sql` - USDC columns

See `docs/sui-accounting-system.md` for detailed database schemas.

---

## Persona System (December 2025)

### Overview
Users can have multiple identities (personas) under one account. Each persona has its own username, display name, avatar, bio, and linked wallet address. Content is uploaded under a specific persona.

### Database Structure

**accounts** - Parent container for auth methods
- `id` (uuid) - Primary key
- `sui_address` - zkLogin SUI address (primary identifier)
- `stx_address` - Legacy Stacks wallet (optional link)
- `created_at`, `updated_at`

**personas** - Individual identities (up to 5 per account)
- `id` (uuid) - Primary key
- `account_id` (uuid) - FK to accounts
- `username` - Unique, URL-safe identifier
- `display_name` - Human-readable name
- `avatar_url` - Profile image (supports video)
- `bio` - Profile description
- `wallet_address` - STX wallet OR SUI login address (for pure zkLogin users)
- `sui_address` - Generated SUI wallet for receiving payments (different from login address)
- `is_active` (boolean) - Soft delete flag
- `usdc_balance` - Earnings balance
- `created_at`, `updated_at`

### Username Lookup Pattern
When displaying usernames (profile/store links), always check personas first:
```typescript
// Priority: personas.username → user_profiles.username
const { data: personaData } = await supabase
  .from('personas')
  .select('username, display_name')
  .eq('wallet_address', walletAddress)
  .eq('is_active', true)
  .maybeSingle();

if (personaData?.username) {
  return personaData.username;
}

// Fall back to user_profiles
const { data } = await supabase
  .from('user_profiles')
  .select('username')
  .eq('wallet_address', walletAddress)
  .single();
```

**Components using this pattern:**
- `CompactTrackCardWithFlip.tsx` - Track cards on globe
- `TrackDetailsModal.tsx` - Track detail popup
- `SimplifiedMixer.tsx` - Mixer deck info (A & B)
- `SimplifiedDeck.tsx` - Standalone deck component

### Admin Page (`/admin/users`)
Access-code protected interface for managing accounts and personas.

**Forms:**
1. **Search User** - Find by wallet, username, or invite code
2. **Create Account** - New account from SUI address
3. **Add Persona** - Create persona under existing account
4. **Link STX Wallet** - Connect Stacks wallet to account
5. **Delete Persona** - Remove persona (unlinks tracks first)
6. **Edit Persona** - Change username or display name

**Key behaviors:**
- Admin-created personas bypass the 5-persona limit trigger
- Deleting the only persona on an account deletes the account too
- Tracks are unlinked (persona_id set to null) before persona deletion

### API Routes
```
POST /api/admin/create-account      - Create account from SUI address
POST /api/admin/add-persona-to-account - Add persona to existing account
POST /api/admin/link-stx-wallet     - Link STX wallet to account
POST /api/admin/delete-persona      - Delete persona (unlinks tracks)
POST /api/admin/edit-persona        - Edit username/display_name
```

### Header Persona Switcher
`components/layout/Header.tsx` shows persona dropdown for zkLogin users:
- Lists all personas for current account
- Shows avatar (supports video), username, display name
- Click to switch active persona
- Scrollable list (`max-h-64 overflow-y-auto`)

### Profile/Store URL Resolution
URLs can use either persona username or wallet address:
- `/profile/tokyo-denpa` - Persona username (preferred)
- `/profile/SP123...` - Wallet address (fallback)
- `/store/tokyo-denpa` - Store by persona username

Profile pages check if URL identifier is a username vs wallet:
```typescript
const isUsername = !identifier.startsWith('SP') && !identifier.startsWith('ST');
```

### Key Files
- `app/admin/users/page.tsx` - Admin management UI
- `app/api/admin/*.ts` - Admin API routes
- `components/layout/Header.tsx` - Persona switcher dropdown
- `contexts/AuthContext.tsx` - Auth state with personas array
- `app/profile/[walletAddress]/page.tsx` - Profile page routing
- `scripts/backup-tables.js` - Database backup utility

### Backup Script
Before major changes, run database backup:
```bash
node scripts/backup-tables.js
```
Creates JSON exports of ip_tracks, user_profiles, personas, accounts, alpha_users in `/backups/YYYY-MM-DD/`.

---

## Agent System (Bestie) - December 2025

### Overview
"Bestie" is the in-app search agent that helps users find content by vibe/description. Accessible via robot emoji button next to Crate on the globe page.

### Key Files
- `components/AgentWidget.tsx` - Pop-out widget UI
- `components/agent/AgentVibeMatcher.tsx` - Search input component
- `lib/agent/vibeMatch.ts` - Core search logic with synonym expansion
- `app/api/agent/vibe-match/route.ts` - API endpoint (logs searches)

### How Search Works
1. User enters description (e.g., "chill japanese loops")
2. `parseDescription()` extracts: content types, BPM, energy, texture
3. `extractSearchKeywords()` pulls meaningful words (filters stop words)
4. `expandKeywordsWithSynonyms()` adds related terms from DB
5. `inferTermsFromScripts()` detects Japanese/Chinese/Korean/Arabic characters
6. Query filters by content type, BPM range
7. Tracks scored by keyword matches (weighted by synonym strength)
8. Top 5 results added to user's Crate

### Database Tables

**search_synonyms** - Maps search terms to related terms
| Column | Type | Description |
|--------|------|-------------|
| search_term | text | What user might search |
| matches_term | text | What it should also match |
| category | text | location, genre, mood, language, content_type |
| weight | decimal | 1.0 = exact, 0.5-0.9 = related |

**agent_search_logs** - Analytics for improving metadata
| Column | Type | Description |
|--------|------|-------------|
| query | text | Raw search input |
| mode | text | 'hunt' (text) or 'vibe' (track-based) |
| parsed_criteria | jsonb | Extracted BPM, content types, etc. |
| results_count | integer | How many tracks returned |

### Adding Synonyms
```sql
INSERT INTO search_synonyms (search_term, matches_term, category, weight)
VALUES ('trap', 'hiphop', 'genre', 0.6);
```

### Script Detection
Non-Latin characters automatically infer location context:
- Japanese (hiragana/katakana/kanji) → "japanese", "japan", "tokyo"
- Korean (hangul) → "korean", "korea", "seoul"
- Chinese → "chinese", "china"
- Arabic → "arabic", "middle east"

Works both directions: search terms AND track metadata.

See `docs/agent-synonym-system.md` for detailed documentation.

---

## Project Info

**Stack:** Next.js 14.2.33, TypeScript, Tailwind, Supabase, SUI blockchain (zkLogin), Stacks wallet (legacy)

**Fresh migration:** December 21, 2025 - Migrated to `mixmi-alpha-fresh-11` for clean build environment.

**SUI Transition:** December 26, 2025 - Added USDC pricing, persona accounting system, zkLogin support.

**Agent System:** December 29, 2025 - Added Bestie agent with synonym expansion and search logging.

**Manager Wallet System:** December 29, 2025 - Each persona gets its own SUI wallet for real on-chain accounting.

---

## Manager Wallet System (December 2025)

### Overview
Each persona under an account gets its own **real SUI wallet address**. The zkLogin account holder acts as the **custodian/manager** of all persona wallets. This enables:
- Labels managing artist rosters
- Family members managing relatives' accounts
- Community leaders handling accounts for people with limited tech access

### Architecture
```
Account (zkLogin = Manager)
├── Persona "Artist A" → generated SUI address 0xabc...
├── Persona "Artist B" → generated SUI address 0xdef...
└── TBD Wallet "Kwame" → generated SUI address 0x123...
```

### Key Points
- **Real on-chain accounting**: Each persona has a verifiable SUI address with actual USDC
- **Manager controls all**: zkLogin holder can view balances and withdraw from any persona
- **Encrypted storage**: Private keys encrypted with user's zkLogin credentials + server secret
- **Platform can't access**: Only authenticated user can decrypt persona keys

### Database Fields
```sql
-- personas table
sui_address TEXT,              -- Generated SUI address
sui_keypair_encrypted TEXT,    -- Encrypted private key
sui_keypair_nonce TEXT,        -- Encryption nonce
payout_address TEXT,           -- Optional external payout address
```

### Key Files
- `docs/manager-wallet-system.md` - Detailed architecture documentation
- `lib/sui/keypair-manager.ts` - Keypair generation and encryption
- `app/api/personas/create/route.ts` - Creates persona with wallet
- `app/api/personas/generate-wallets/route.ts` - Generates wallets for existing personas
- `app/api/auth/zklogin/salt/route.ts` - Stores salt in accounts, triggers wallet generation
- `components/account/EarningsTab.tsx` - Balance display and withdrawal UI

### Use Case: Kenya Example
John in Nairobi manages accounts for his cousin Mary (musician) and friend Peter (producer). Each has their own wallet, John handles technical side, sends payouts via M-Pesa.

See `docs/manager-wallet-system.md` for full documentation.
