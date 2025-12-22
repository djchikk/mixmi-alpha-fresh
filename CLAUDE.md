# Claude Code Session Notes

Documentation of development sessions with Claude Code for the mixmi alpha platform.

---

## Quick Reference: Key Patterns

### Video Detection
```typescript
const isVideo = url && (url.includes('.mp4') || url.includes('.webm') || url.includes('video/'));
```

### CORS Proxy for Radio
```typescript
const proxiedUrl = `/api/radio-proxy?url=${encodeURIComponent(stream_url)}`;
```

### Content Type Colors
| Type | Color | Hex |
|------|-------|-----|
| Loop | Bright Lavender | #A084F9 |
| Song | Lime Green | #A8E66B |
| Video | Lighter Sky Blue | #5BB5F9 |
| Radio | Golden Amber | #FFC044 |
| Portal | White | #FFFFFF |
| Sync/UI | Cyan | #81E4F2 |

### BPM Priority (Master Tempo)
```typescript
loop: 3, full_song: 2, radio_station: 1, grabbed_radio: 1, default: 0
```

### Button Standard: 72×20px
All contextual buttons (video mute, radio GRAB, section nav) use `w-[72px] h-[20px]`, 9px bold text, 10px icons.

---

## Session: November 3, 2025

**Focus:** Profile video support, sticker defaults, radio features, international radio expansion

### Video Support (Universal)
- MP4/WebM support for profile images, gallery items, header avatars
- Videos autoplay with loop, muted, playsInline
- Files: `ProfileImage.tsx`, `GalleryCard.tsx`, `Header.tsx`, `ImageUploader.tsx`

### Default Sticker Visibility
- New users see blue daisy sticker by default
- SQL: `ALTER COLUMN sticker_id SET DEFAULT 'daisy-blue'`, `sticker_visible SET DEFAULT true`
- Function: `initialize_user_profile` updated

### Radio Pack Fix
- Dropping station_pack on RadioWidget now loads first station automatically
- File: `components/RadioWidget.tsx`

### International Radio Test Accounts
- Eritrea, Brasil, Bhutan, India test accounts created
- Uses Radio Browser API: `https://de1.api.radio-browser.info/`

---

## Session: November 6, 2025

**Focus:** Universal Mixer with radio integration and pack handling

### Core Component
`components/mixer/UniversalMixer.tsx` (~1,600 lines)

### Radio GRAB Feature
1. Radio loads → MediaRecorder captures to rolling 20-second buffer
2. After 10 seconds, PLAY → GRAB (orange)
3. Click GRAB → captures audio, creates blob URL
4. Grabbed audio loads to deck with inherited BPM
5. Loop position selector finds rhythmic patterns

**States:** PLAY (cyan) → GRAB (orange) → REC (red pulsing) → DONE (cyan)

### Pack Drop Handling
Dropping packs on decks unpacks them:
- `loop_pack` → unpacks loops
- `station_pack` → unpacks radio stations
- `ep` → unpacks songs

First item loads to deck, pack expands in crate, toast confirms.

### Memory Management
On unmount: pause audio, clear src, stop MediaRecorders, clear timers, disconnect audio graph, clear buffers.

### Key Integrations
- `useMixer()` for crate management
- `useToast()` for notifications
- Window APIs: `loadMixerTracks()`, `clearMixerDecks()`, `expandPackInCrate()`

---

## Session: November 24, 2025

**Focus:** Button standardization, video integration, content-type color theming

### Button Standardization
All contextual buttons: 72×20px, bottom-[12px] positioning, 9px bold text, 10px icons.
- Video mute: blue (#2792F5) unmuted, red (#ef4444) muted
- Radio GRAB: orange (#FB923C)
- Section Navigator: wheat (#FFE4B5)

### Video Integration (Complete)
**Upload:** `VideoClipModal.tsx` - draggable crop, zoom 1.0x-3.0x, stores 7 crop fields

**Display:** `VideoDisplayArea.tsx` (408px height)
- Crossfade modes: slide (split-screen), blend (opacity), cut (hard switch at 50%)
- Effects: color shift, pixelate, invert, mirror

**Audio:** Per-deck mute via `mixerState.deckA.videoMuted`, video element always muted (audio via separate element)

**Sync Logic:** `bothVideos` detection disables sync when both decks have videos (different lengths can't sync)

---

## Session: November 25, 2025

**Focus:** Complete drag symmetry, critical bug fixes, alpha readiness

### Drag Symmetry (Complete)
```
✅ Globe → Crate/Playlist/Decks
✅ Crate → Playlist/Decks
✅ Playlist → Crate/Decks + internal reordering
✅ Decks → Playlist/Crate
✅ Collections → Playlist/Decks/Crate
```

**Pattern:** Both `useDrag` and `useDrop` use `COLLECTION_TRACK` type. Include ALL fields (id, title, audioUrl, bpm, stream_url). Use `fromPlaylist` flag for internal vs external.

### Bug Fixes
1. **BPM preservation:** Added `bpm` to PlaylistTrack interface
2. **Radio stream_url:** Added `stream_url` to PlaylistTrack, included in drag export
3. **CORS in production:** Radio player now uses `/api/radio-proxy` like mixer

File: `components/SimplePlaylistPlayer.tsx`

---

## Session: November 30, 2025

**Focus:** User persona handling, sacred content protection, inclusive design

### User Personas in Chatbot

**Professional ("Charles"):** Detects industry terms (sync licensing, PRO, publishing). Response: respect knowledge, clear boundaries, show how mixmi complements existing systems.

**Community ("Rural Kenya"):** Detects simple language, traditional/cultural references. Response: simple language, warm encouragement, explain concepts gently, respect communal ownership.

File: `lib/upload-studio/system-prompt.ts`

### Sacred Content Protection
New `remix_protected` boolean field prevents sacred content from loading in mixer while allowing streaming/downloads.

**Detection:** Religious/spiritual context, ceremonial music, user discomfort about remixing

**Flow:**
1. Chatbot detects sacred content, offers protection
2. `remix_protected: true` saved to database
3. Track appears on globe, can stream/download
4. Drag to mixer → redirects to playlist with toast: "This track is protected from remixing"

**Files:**
- `app/api/upload-studio/submit/route.ts` - stores field
- `components/mixer/UniversalMixer.tsx` - blocks loading, redirects to playlist
- `components/SimplePlaylistPlayer.tsx` - `window.addTrackToPlaylist` API
- `lib/globeDataSupabase.ts` - passes field through

### Sample Credit Culture
Chatbot now suggests IP credit when users mention sampling others' work (10-25% suggestion).

---

## Session: December 15, 2025

**Focus:** Live preview card for upload studio

### Upload Preview Card
New `UploadPreviewCard.tsx` component shows content card building in real-time as chatbot collects info.

**Features:**
- 160×160px card matching globe card style
- Border color changes by content type (uses standard color palette)
- Cyan title/artist text (#81E4F2) with dark gradient overlay
- Location pins displayed below card (all locations, not just primary)
- Tags displayed below card (up to 3 with +N indicator)
- Info button launches TrackDetailsModal with preview data

**Integration:**
- Positioned to right of chat, aligned near input area (`justify-end pb-32`)
- Hidden on mobile (`hidden lg:flex`)
- Receives `extractedData` from ConversationalUploader state

**Files:**
- `components/upload-studio/UploadPreviewCard.tsx` - Preview card component
- `components/upload-studio/ConversationalUploader.tsx` - Integration and layout

### Location Deduplication Fixes
- Country abbreviation matching (UK → United Kingdom, USA → United States)
- UK-style 4-part addresses handled as single location (≤3 commas threshold)
- Coordinate tolerance increased to 0.5 (~50km) for fuzzy matching

---

## Session: December 16, 2025

**Focus:** Conversation logging system for Upload Studio analytics

### Upload Session Recorder
Three-layer logging system to analyze and improve the chatbot:

**Layer 1 - Raw Transcripts:**
- Every message logged to `upload_session_events` table
- Attachments, timestamps, and full content preserved

**Layer 2 - AI Sense-Making:**
- `inferred_data` captures what chatbot extracted
- `confidence_scores` for field-level confidence
- `flags` for observations during conversation

**Layer 3 - Outcome Signals:**
- Track submitted/abandoned/error outcomes
- Link to final `ip_tracks` record
- Session duration and message counts

### Sensitivity Detection
Keyword scanning for traditional/sacred content communities:
- Keywords: god, prayer, sacred, ceremony, ancestor, blessing, spiritual, elder, tradition, secret, family only, not for everyone
- Triggers `sensitivity_signal` event with context
- Helps identify content needing cultural sensitivity

### Files
- `app/api/upload-studio/log-session/route.ts` - Logging API
- `components/upload-studio/ConversationalUploader.tsx` - Client integration
- `scripts/migrations/create-upload-sessions-table.sql` - Sessions table
- `scripts/migrations/add-upload-session-events.sql` - Events table

### Database Tables
- `upload_sessions` - Session summaries (outcome, inferred_data, flags)
- `upload_session_events` - Append-only event log (messages, signals)

See `docs/CONVERSATION-LOGGING.md` for full documentation.

---

## Session: December 17, 2025

**Focus:** Portal Cards for Portal Keepers (super-curators)

### Portal Card System
New content type `portal` for highlighting super-curators who manage multiple worlds/projects.

**Visual Design:**
- Circular 160px card (vs square for other content)
- 6px iridescent shimmer border (pearlescent animation)
- Scan line effect on hover
- White globe node color (#FFFFFF)
- Hover shows name (clickable to profile) + description

**No playback elements:** No play button, BPM, price, or content type badge - portals link to profiles, not audio.

### Admin Page
Hidden admin page at `/admin/portals` for creating/editing portals.
- Access code protected
- User search with autocomplete (or manual wallet/username entry)
- Mapbox location autocomplete
- Image upload with thumbnail generation
- Edit existing portals inline

### Key Files
- `components/cards/PortalCard.tsx` - Circular card with shimmer animation
- `components/cards/GlobeTrackCard.tsx` - Routes portal content_type to PortalCard
- `app/admin/portals/page.tsx` - Admin CRUD interface
- `components/globe/GridNodeSystem.tsx` - White node color for portals

### Database
Uses `ip_tracks` table with `content_type: 'portal'`:
- `portal_username` - Username for profile link
- `primary_uploader_wallet` - Portal Keeper's wallet (ownership)
- `title` - Display name on card
- `description` - 2-line description on hover
- `cover_image_url` - Circular profile image

See `docs/PORTAL-SYSTEM.md` for full documentation.

---

## Session: December 21, 2025

**Focus:** Voice input/output for Upload Studio chatbot, video mute button fix

### Voice Integration for Upload Chatbot
Full voice conversation support using OpenAI Whisper (STT) and OpenAI TTS.

**User Flow:**
1. User clicks mic button next to chat input
2. Browser records audio via MediaRecorder (webm/opus)
3. Audio sent to `/api/upload-studio/voice/transcribe` → OpenAI Whisper
4. Transcribed text appears in chat and sends to Anthropic
5. AI response automatically speaks back via TTS

**Key Implementation Details:**
- `inputMode` tracking: 'text' or 'voice' determines if TTS plays response
- `textOverride` parameter in `sendMessage()` bypasses async state issues with transcription
- TTS only plays for voice-initiated messages (not text typing)
- Recording indicator shows "Recording..." during capture

**Voice API Endpoints:**
```typescript
// Speech-to-Text (Whisper)
POST /api/upload-studio/voice/transcribe
Body: FormData with 'audio' file
Returns: { text: string }

// Text-to-Speech
POST /api/upload-studio/voice/speak
Body: { text: string, voice?: string }
Returns: audio/mpeg stream
```

**TTS Voices Available:** alloy, echo, fable, onyx, nova (default), shimmer

**Files:**
- `app/api/upload-studio/voice/transcribe/route.ts` - Whisper integration
- `app/api/upload-studio/voice/speak/route.ts` - TTS integration
- `components/upload-studio/ConversationalUploader.tsx` - Voice UI and state

### Video Mute Button Fix
Fixed AUDIO/MUTED buttons for video clips in mixer.

**Root Cause:** Deck thumbnail video in `SimplifiedDeckCompact.tsx` was missing `muted` attribute, playing audio directly and bypassing mixer audio controls.

**Fixes Applied:**
1. Added `muted` to deck thumbnail video element
2. Added `video_url` fallback when loading video clip audio (MP4 contains both tracks)
3. Mute button now respects deck volume slider when unmuting

**Architecture:**
- All video elements render with `muted={true}` (visual only)
- Audio plays via separate HTMLAudioElement created by `createMixerAudio`
- AUDIO button controls that audio element's volume (0 = muted, deck volume = unmuted)

---

## Key File Locations

### Mixer System
- `components/mixer/UniversalMixer.tsx` - Main mixer component
- `components/mixer/compact/VideoDisplayArea.tsx` - Video display with effects
- `components/mixer/compact/SectionNavigator.tsx` - Song section navigation
- `components/mixer/compact/MasterTransportControlsCompact.tsx` - Transport controls

### Upload System
- `components/upload-studio/ConversationalUploader.tsx` - Chat-based upload with voice
- `components/upload-studio/UploadPreviewCard.tsx` - Live preview card
- `lib/upload-studio/system-prompt.ts` - Chatbot personality and guidance
- `app/api/upload-studio/submit/route.ts` - Track submission API
- `app/api/upload-studio/log-session/route.ts` - Session logging API
- `app/api/upload-studio/voice/transcribe/route.ts` - Whisper STT API
- `app/api/upload-studio/voice/speak/route.ts` - OpenAI TTS API

### Playback
- `components/SimplePlaylistPlayer.tsx` - Playlist with drag support
- `components/SimpleRadioPlayer.tsx` - Radio player with CORS proxy
- `components/RadioWidget.tsx` - Radio widget with pack handling

### Globe & Data
- `lib/globeDataSupabase.ts` - Globe data fetching
- `contexts/MixerContext.tsx` - Global crate/collection state

### Portal System
- `components/cards/PortalCard.tsx` - Circular portal card with shimmer
- `components/cards/GlobeTrackCard.tsx` - Routes portals to PortalCard
- `app/admin/portals/page.tsx` - Admin CRUD for portals
- `components/globe/GridNodeSystem.tsx` - Node colors including portal white

### Profile & Display
- `components/profile/ProfileImage.tsx` - Profile avatar (video support)
- `components/cards/GalleryCard.tsx` - Gallery items (video support)
- `components/layout/Header.tsx` - Header avatars (video support)

---

## Database Fields Reference

### ip_tracks
- `remix_protected` (boolean, default false) - Prevents mixer loading
- `video_crop_x/y/width/height/zoom` - Video crop data
- `video_natural_width/height` - Original video dimensions
- `stream_url` - Radio station stream URL
- `bpm` - Beats per minute
- `portal_username` - For portal content_type, username for profile link
- `content_type` - Includes 'portal' for Portal Keeper cards

### user_profiles
- `sticker_id` (default 'daisy-blue')
- `sticker_visible` (default true)

---

## Technical Patterns for Future Claude

### Radio Stations
- Always use `stream_url` as primary audio source
- Always proxy through `/api/radio-proxy?url=...`
- Include fallback: `audioUrl: track.audio_url || track.stream_url`

### Drag & Drop
- Type: `COLLECTION_TRACK`
- Required fields: id, title, audioUrl, bpm, stream_url, content_type
- Combine refs: `drag(drop(ref))` for dual capability

### Content Type Detection
```typescript
const isRadio = contentType === 'radio_station' || contentType === 'grabbed_radio';
const isVideo = contentType === 'video_clip';
const isSong = contentType === 'full_song';
const isLoop = contentType === 'loop';
const isPack = ['loop_pack', 'station_pack', 'ep'].includes(contentType);
const isPortal = contentType === 'portal';
```

### Memory Cleanup Pattern
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
Search for mixmi users by username or display name. Useful for collaborator lookups, IP splits, spotlight linking.

```typescript
// GET /api/profile/search-users?q=searchterm
const response = await fetch(`/api/profile/search-users?q=${encodeURIComponent(query)}`);
const { users } = await response.json();
// Returns: { users: [{ walletAddress, username, displayName, avatarUrl }] }
```

**Features:**
- Searches both `username` and `display_name` fields (case insensitive)
- Excludes users with default "New User" display name
- Returns up to 8 results
- Debounce recommended (300ms) for live search

**Use cases:**
- Spotlight section: Link to other mixmi users' profiles/stores
- IP splits: Search for collaborators by name instead of wallet address
- Any user picker UI

---

## Known Issues (To Fix Later)

### Loop Pack Pricing Display (Dec 2024)
**Status:** Data saves correctly, display components use wrong field

**What's happening:**
- Chatbot correctly saves: `download_price_stx` = per-loop price, `price_stx` = total pack price
- TrackDetailsModal shows per-loop price labeled as "full pack" price
- Crate → Cart drag uses pack price for individual loops (should use per-loop)
- Globe card and Shopping Cart show correct prices

**Files to fix:**
- `components/modals/TrackDetailsModal.tsx` - Use `price_stx` for pack total display
- Crate drag handlers - Use `download_price_stx` for individual loop pricing

**Example:** 4-loop pack at 3 STX/loop should show "12 STX (full pack)" not "3 STX (full pack)"

### Edit Form - Video Clip Cover Images (Dec 2024)
**Status:** Edit form doesn't accept video clips as cover images

**What's happening:**
- The chatbot and upload flow accept 5-second MP4 clips as cover images
- But the edit form launched from Dashboard doesn't allow video uploads for cover
- Users who want to add/change to a video cover can't do it from edit form

**Files to fix:**
- `components/modals/IPTrackModal.tsx` - Update cover image upload to accept video

### Edit Form - Price Display (Dec 2024)
**Status:** Same issue as TrackDetailsModal - shows per-item price not pack total

**Files to fix:**
- `components/modals/IPTrackModal.tsx` - Price display section

### Song Upload - WAV File Size Limit (Dec 2024)
**Status:** FIXED - WAV rejected for songs/EPs with helpful message

**Solution implemented:**
- WAV still allowed for loops/loop packs (short files)
- WAV rejected for songs/EPs with message: "WAV files are too large for songs. Please use MP3, M4A, or FLAC format instead."
- Chatbot prompt updated to explain file format requirements

**Files updated:**
- `components/modals/IPTrackModal.tsx` - Added WAV check for songs/EPs
- `lib/upload-studio/system-prompt.ts` - Added file format guidance
