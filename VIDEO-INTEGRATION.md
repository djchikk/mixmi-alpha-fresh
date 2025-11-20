# Video Integration Plan

## Vision
Add short-form video clips (5 seconds) as a new content type in Mixmi, integrating seamlessly with the Universal Mixer for creative visual mixing alongside audio.

## Content Type Specification

### `video_clip`
- **Duration**: 5 seconds (loopable)
- **Format**: MP4 (H.264 video, AAC audio)
- **Resolution**: TBD (suggest 720p for balance of quality/file size)
- **Audio**: Optional (can have audio track or be silent)
- **Storage**: Supabase Storage bucket `video-clips/`
- **BPM**: Optional (for sync-capable clips)
- **Color**: Green (#10B981) - distinct from loops (purple), songs (gold), radio (orange)

## Database Schema Changes

### `ip_tracks` table
Add new field:
- `video_url` (text, nullable) - URL to video file in Supabase Storage

Update content_type enum to include:
- `video_clip` - Single 5-second video with optional audio

### Storage Buckets
- **Bucket name**: `video-clips`
- **Public access**: Yes (for playback)
- **File naming**: `{uuid}.mp4`
- **Max file size**: 10MB (5 seconds @ 720p ~2-5MB)

## Implementation Phases

### Phase 1: Single Video in Deck (MVP)
**Goal**: Upload and play video clips in mixer decks, replacing cover artwork

**Components**:
1. TypeScript type updates (add `video_clip` to content_type union)
2. Database migration (add `video_url` field)
3. ContentTypeSelector - enable Video option
4. VideoClipModal - upload UI for video clips
5. Video file upload to Supabase Storage
6. SimplifiedDeckCompact - render `<video>` element when video_clip loaded
7. Transport control sync - play/pause/loop video with audio
8. Globe/Collection cards - show video thumbnail/preview

**Features**:
- Video plays in 72x72px deck square
- Video loops according to loop length selector
- Audio (if present) mixes normally via crossfader
- No BPM sync required (plays at natural speed)
- Can mix video+audio from Deck A with audio from Deck B

**User Flow**:
1. User clicks "Add Content" → selects "Video"
2. Uploads 5-second MP4 with title/artist/tags
3. Video appears in Globe/collection with animated thumbnail
4. Drag video to deck → replaces cover image with playing video
5. Transport controls play/pause/loop video
6. Crossfader mixes audio (video from A, song from B, etc.)

### Phase 2: Dual Video Visual Mixing
**Goal**: When both decks have videos, create dynamic visual split controlled by crossfader

**Components**:
1. VideoMixerDisplay - new component above/overlaying mixer
2. Vertical split rendering using CSS clip-path
3. Crossfader integration - position controls split line
4. Fullscreen mode option
5. Video sync - both videos play in sync with their decks

**Visual Behavior**:
- **Crossfader at 0% (full left)**: Only Deck A video visible
- **Crossfader at 50% (center)**: Both videos visible, split vertically down middle
- **Crossfader at 100% (full right)**: Only Deck B video visible
- Split line smoothly slides as crossfader moves
- Videos maintain independent playback timing based on deck transport

**Creative Possibilities**:
- Intentional split compositions (left half one video, right half another)
- Dynamic visual transitions synchronized with audio crossfades
- Creates a "visual DJ" experience

## Technical Considerations

### Video Playback Sync
- Use HTML5 `<video>` element
- Sync with Tone.js transport via `useEffect` watching play/pause state
- Loop length selector controls video loop points (same as audio)
- `currentTime` manipulation for precise looping

### Performance
- 5-second clips keep file sizes small (~2-5MB)
- Preload videos when dragged to deck
- Consider video pooling/caching for smooth switching

### Browser Compatibility
- HTML5 video widely supported
- MP4/H.264 universal format
- Fallback to thumbnail if video fails to load

### Mobile Considerations
- Smaller viewport may need different video display strategy
- Consider performance on mobile devices
- May need lower resolution videos for mobile

## Color System

| Content Type | Color | Use Case |
|-------------|-------|----------|
| `loop` | Purple (#9772F4) | Audio loops |
| `full_song` | Gold (#FFE4B5) | Full songs |
| `radio_station` | Orange (#FB923C) | Live radio streams |
| `grabbed_radio` | Orange (#FB923C) | Grabbed radio moments |
| **`video_clip`** | **Green (#10B981)** | **5-second video clips** |

## File Structure

```
components/
  modals/
    VideoClipModal.tsx          # NEW: Video upload modal
  mixer/
    VideoMixerDisplay.tsx       # NEW: Dual video display (Phase 2)
    compact/
      SimplifiedDeckCompact.tsx # MODIFY: Support video rendering
  cards/
    VideoClipCard.tsx           # NEW: Video preview card

hooks/
  useVideoUpload.ts             # NEW: Video upload logic
  useVideoPlayback.ts           # NEW: Video sync with transport

lib/
  videoUtils.ts                 # NEW: Video processing utilities

types/
  index.ts                      # MODIFY: Add video_clip type
```

## Migration Path

### Step 1: Foundation (Current Task)
- [x] Planning document
- [ ] TypeScript type updates
- [ ] Database schema migration
- [ ] Enable video in ContentTypeSelector

### Step 2: Upload Flow
- [ ] VideoClipModal component
- [ ] Video file validation (duration, format, size)
- [ ] Supabase Storage upload
- [ ] Database record creation

### Step 3: Display & Playback
- [ ] Video cards in Globe/collections
- [ ] Video in SimplifiedDeckCompact
- [ ] Transport control integration
- [ ] Loop length functionality

### Step 4: Testing & Refinement
- [ ] Upload various video formats
- [ ] Test audio mixing (video + audio)
- [ ] Test loop lengths with video
- [ ] Performance testing

### Step 5: Dual Video (Phase 2)
- [ ] VideoMixerDisplay component
- [ ] Crossfader-controlled split
- [ ] Fullscreen mode
- [ ] Polish and effects

## Success Criteria

### Phase 1 Complete When:
- ✅ Users can upload 5-second video clips
- ✅ Videos appear in Globe/collections with previews
- ✅ Videos can be dragged to mixer decks
- ✅ Videos play/pause/loop with transport controls
- ✅ Video audio mixes with other deck's audio via crossfader
- ✅ No performance issues or crashes

### Phase 2 Complete When:
- ✅ Two videos create vertical split display
- ✅ Crossfader smoothly controls split position
- ✅ Visual mixing feels intuitive and creative
- ✅ Performance remains smooth with dual video

## Next Steps
1. Add `video_clip` to TypeScript content_type union
2. Create database migration for `video_url` field
3. Enable Video option in ContentTypeSelector
4. Begin VideoClipModal implementation

---

**Last Updated**: 2025-11-19
**Status**: Planning → Implementation
