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
const response = await fetch(`/api/profile/search-users?q=${encodeURIComponent(query)}`);
const { users } = await response.json();
// Returns: [{ walletAddress, username, displayName, avatarUrl }]
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

## Project Info

**Stack:** Next.js 14.2.33, TypeScript, Tailwind, Supabase, Stacks wallet

**Fresh migration:** December 21, 2025 - Migrated to `mixmi-alpha-fresh-11` for clean build environment.
