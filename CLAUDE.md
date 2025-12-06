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
| Loop | Purple | #9772F4 |
| Song | Wheat | #FFE4B5 |
| Video | Blue | #2792F5 |
| Radio | Orange | #FB923C |
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

## Key File Locations

### Mixer System
- `components/mixer/UniversalMixer.tsx` - Main mixer component
- `components/mixer/compact/VideoDisplayArea.tsx` - Video display with effects
- `components/mixer/compact/SectionNavigator.tsx` - Song section navigation
- `components/mixer/compact/MasterTransportControlsCompact.tsx` - Transport controls

### Upload System
- `components/upload-studio/ConversationalUploader.tsx` - Chat-based upload
- `lib/upload-studio/system-prompt.ts` - Chatbot personality and guidance
- `app/api/upload-studio/submit/route.ts` - Track submission API

### Playback
- `components/SimplePlaylistPlayer.tsx` - Playlist with drag support
- `components/SimpleRadioPlayer.tsx` - Radio player with CORS proxy
- `components/RadioWidget.tsx` - Radio widget with pack handling

### Globe & Data
- `lib/globeDataSupabase.ts` - Globe data fetching
- `contexts/MixerContext.tsx` - Global crate/collection state

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
