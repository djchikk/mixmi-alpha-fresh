# Conversational Upload System

Documentation for the AI-powered conversational upload experience in mixmi.

---

## Overview

The Conversational Upload System (aka "Upload Studio") provides a chat-based interface for creators to register their music, loops, video clips, and multi-file collections (loop packs and EPs) on mixmi. Instead of filling out forms, users have a natural conversation with an AI assistant that guides them through the process.

**Key Benefits:**
- Natural, low-friction upload experience
- Intelligent content type detection
- Story capture (notes, backstory, context)
- Smart defaults with full customization
- Multi-file support for packs and EPs
- Drag-and-drop file handling

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    ConversationalUploader                    │
│                  (components/upload-studio/)                 │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Chat UI   │  │  File Upload │  │  Extracted Data  │   │
│  │  Messages   │  │  Drag & Drop │  │     State        │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Routes                              │
│                                                             │
│  /api/upload-studio/chat      → Claude AI conversation      │
│  /api/upload-studio/upload-file → File storage (Supabase)   │
│  /api/upload-studio/submit    → Database insert             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      System Prompt                           │
│                  (lib/upload-studio/)                        │
│                                                             │
│  - Content type definitions                                 │
│  - Required fields per type                                 │
│  - Conversation guidelines                                  │
│  - Multi-file detection logic                               │
│  - Data extraction format                                   │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
components/upload-studio/
├── ConversationalUploader.tsx   # Main chat UI component

app/api/upload-studio/
├── chat/route.ts               # Claude AI conversation endpoint
├── upload-file/route.ts        # File upload to Supabase storage
├── submit/route.ts             # Final submission to ip_tracks table

lib/upload-studio/
├── system-prompt.ts            # AI system prompt & helpers
```

---

## Content Types

### Single File Types

| Type | Description | Required Fields | BPM |
|------|-------------|-----------------|-----|
| `loop` | 8-bar loops for remixing | title, artist, audio, BPM | Required (60-200) |
| `full_song` | Complete songs | title, artist, audio | Optional |
| `video_clip` | 5-second video loops | title, artist, video | Not applicable |

### Multi-File Types

| Type | Description | Required Fields | BPM |
|------|-------------|-----------------|-----|
| `loop_pack` | Bundle of 2-5 loops | pack_title, artist, 2-5 audio files | Required (consistent) |
| `ep` | Bundle of 2-5 songs | ep_title, artist, 2-5 audio files | Optional (can vary) |

---

## Data Flow

### 1. File Upload Flow

```
User drops/selects file(s)
        │
        ▼
┌───────────────────┐
│  handleFileSelect │  or  handleDrop
│  handleDrop       │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│   uploadFile()    │ → POST /api/upload-studio/upload-file
└───────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│                  Supabase Storage                      │
│                                                       │
│  Audio → user-content/{wallet}/{uuid}.{ext}           │
│  Video → video-clips/{wallet}/{uuid}.{ext}            │
│  Image → cover-images/{uuid}.{ext}                    │
└───────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│               Update extractedData                     │
│                                                       │
│  Single file: audio_url, bpm, duration                │
│  Multi-file:  loop_files[], ep_files[], detected_bpms │
└───────────────────────────────────────────────────────┘
```

### 2. Video Thumbnail Auto-Capture

For video clips, the system automatically:
1. Captures first frame at 0.1 seconds
2. Applies smart cropping for square aspect ratio:
   - **Landscape**: Center crop
   - **Portrait**: 20% from top (faces/action usually there)
   - **Square**: No crop needed
3. Uploads thumbnail to `cover-images` bucket
4. Stores crop data for playback consistency

### 3. Conversation Flow

```
User sends message
        │
        ▼
┌───────────────────┐
│   sendMessage()   │ → POST /api/upload-studio/chat
└───────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│                  Claude AI (Anthropic)                 │
│                                                       │
│  System Prompt + Message History + Current Data       │
│                       ▼                               │
│  Natural response + ```extracted { JSON } ```         │
└───────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────┐
│ parseExtractedData│ → Separate message from JSON
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ setExtractedData  │ → Merge new data with existing
└───────────────────┘
```

### 4. Submission Flow

```
User confirms "Ready to register"
        │
        ▼
┌───────────────────┐
│   submitTrack()   │ → POST /api/upload-studio/submit
└───────────────────┘
        │
        ├──────────────────────────────────────┐
        │                                      │
        ▼                                      ▼
┌─────────────────────┐          ┌─────────────────────────┐
│   Single Track      │          │   Multi-File (Pack/EP)  │
│                     │          │                         │
│   Insert 1 record   │          │   handleMultiFileSubmission()
│   to ip_tracks      │          │                         │
└─────────────────────┘          │   1. Create container   │
                                 │      (pack_position: 0) │
                                 │                         │
                                 │   2. Create children    │
                                 │      (pack_position: 1+)│
                                 │                         │
                                 │   All linked by pack_id │
                                 └─────────────────────────┘
```

---

## System Prompt Structure

The system prompt (`lib/upload-studio/system-prompt.ts`) defines how the AI assistant behaves.

### Key Sections

1. **Role Definition** - Friendly music registration assistant
2. **Content Types** - What types of content are supported
3. **Required Information** - What to collect per content type
4. **Always Gather These** - Critical fields that must be asked:
   - Location (for globe placement)
   - IP Splits (composition + production ownership)
   - Description vs Notes (short tagline vs long-form story)
   - Tags (genre, mood, use case)
   - Cover Image (for audio content)
   - Downloads & Pricing
   - Collaboration & Commercial signals

5. **Multi-File Detection** - How to handle 2-5 files:
   - Ask intent (loop pack, EP, or separate)
   - Validate BPM consistency for loop packs
   - Check for related versions in EPs

6. **AI Assistance Tracking** - Music must be 100% human-created
7. **Response Format** - Natural text + `\`\`\`extracted { JSON } \`\`\``

### Data Extraction Format

The AI returns structured data in a special code block:

```
Great! So "Sunset Groove" at 128 BPM, got it!

```extracted
{
  "title": "Sunset Groove",
  "bpm": 128,
  "content_type": "loop"
}
```
```

The `parseExtractedData()` function separates the user-visible message from the JSON data.

---

## Multi-File Handling

### Detection

When multiple audio files are uploaded, the system:
1. Stores URLs in both `loop_files[]` and `ep_files[]` arrays
2. Tracks all detected BPMs in `detected_bpms[]`
3. Chatbot asks user to clarify intent

### Loop Pack Flow

1. User uploads 2-5 audio files
2. Chatbot asks: "Loop pack, EP, or separate uploads?"
3. User selects "Loop pack"
4. **BPM Validation**:
   - If BPMs match: Proceed with single BPM
   - If BPMs differ: Flag gently, offer options:
     - Group by BPM (create separate packs)
     - Pick one BPM (if close enough)
     - Keep as-is (intentional variation)
5. Collect pack_title, artist, loop_category
6. On submit: Create container + N child records

### EP Flow

1. User uploads 2-5 audio files
2. Chatbot asks: "Loop pack, EP, or separate uploads?"
3. User selects "EP"
4. Chatbot asks: "Are any of these different versions of the same track?"
5. Track relationships noted (vocal/instrumental/ambient versions)
6. Collect ep_title, artist
7. On submit: Create container + N child records

### Database Structure

```sql
-- Container record (the pack/EP itself)
id: pack_id (uuid)
title: "Summer Vibes Pack"
content_type: "loop_pack" or "ep"
pack_id: pack_id (self-referential)
pack_position: 0
audio_url: first_child_url (for preview)

-- Child records (individual tracks)
id: unique_track_id
title: "Summer Vibes Pack - Track 1"
content_type: "loop" or "full_song"
pack_id: pack_id (links to container)
pack_position: 1, 2, 3, ...
audio_url: individual_file_url
```

---

## IP Splits & Credits

### Splits (Ownership)

Two separate "pies" that each add up to 100%:

1. **Composition Splits** (Creative Vision)
   - Who came up with the ideas, melodies, lyrics
   - The "songwriting" credit

2. **Production Splits** (Making It Happen)
   - Who performed, recorded, produced
   - The "recording" credit

```typescript
composition_splits: [
  { name: "Artist A", percentage: 50 },
  { name: "Artist B", percentage: 50 }
]

production_splits: [
  { name: "Artist A", percentage: 100 }
]
```

### Credits (Attribution)

Non-ownership recognition:
- Instruments played
- Technical roles (mixing, mastering)
- "Inspired by...", "Sample from..."

```typescript
credits: [
  { name: "Session Player", role: "Guitar" },
  { name: "Engineer", role: "Mixing" }
]
```

---

## Video Clip Handling

### Upload Process

1. Video uploaded to `video-clips` bucket
2. First frame captured at 0.1s
3. Smart crop applied for square thumbnail
4. Thumbnail uploaded to `cover-images` bucket
5. Crop data stored for consistent playback

### Crop Data Fields

```typescript
video_crop_x: number      // X position of crop area
video_crop_y: number      // Y position of crop area
video_crop_width: number  // Width of crop area
video_crop_height: number // Height of crop area
video_crop_zoom: number   // Zoom level (default 1.0)
video_natural_width: number  // Original video width
video_natural_height: number // Original video height
```

### Edit Flow

When editing a video clip:
1. Existing crop data loaded into state
2. User can adjust crop in modal
3. New crop data overwrites, OR
4. If no changes, existing crop data preserved

---

## ExtractedTrackData Interface

```typescript
interface ExtractedTrackData {
  // Core
  content_type?: string;
  title?: string;
  artist?: string;
  description?: string;
  notes?: string;
  tags?: string[];

  // Audio metadata
  bpm?: number;
  key?: string;
  duration?: number;
  loop_category?: string;

  // Location
  location?: string;
  additional_locations?: string[];

  // AI tracking
  ai_assisted_idea?: boolean;
  ai_assisted_implementation?: boolean;

  // Licensing
  allow_downloads?: boolean;
  download_price_stx?: number;
  open_to_collaboration?: boolean;
  open_to_commercial?: boolean;

  // Ownership
  composition_splits?: Array<{ wallet?: string; name?: string; percentage: number }>;
  production_splits?: Array<{ wallet?: string; name?: string; percentage: number }>;
  credits?: Array<{ name: string; role: string }>;

  // Media URLs
  audio_url?: string;
  video_url?: string;
  cover_image_url?: string;

  // Video crop data
  video_crop_x?: number;
  video_crop_y?: number;
  video_crop_width?: number;
  video_crop_height?: number;
  video_crop_zoom?: number;
  video_natural_width?: number;
  video_natural_height?: number;

  // Multi-file
  pack_title?: string;
  ep_title?: string;
  loop_files?: string[];
  ep_files?: string[];
  detected_bpms?: number[];
}
```

---

## UI Features

### Drag and Drop

The entire chat container supports drag-and-drop:
- Visual overlay appears when dragging files over
- Supports audio, video, and image files
- Multiple files can be dropped at once
- Unsupported file types are filtered with warning

### File Attachment Display

- Pending: Gray background
- Uploading: Blue with spinner
- Uploaded: Green with checkmark
- Error: Red with "Failed" text
- Remove button on each attachment

### Ready to Submit Banner

When all required data is collected:
- Green banner appears at bottom
- Shows track title and artist
- "Register Track" button
- Loading state during submission

---

## Chatbot Conversation Guidelines

### Tone
- Warm and enthusiastic about their music
- Concise (2-3 sentences usually)
- Ask one thing at a time
- Celebrate creative details
- Emojis sparingly but appropriately

### Story Capture
The chatbot should actively capture stories:
- When user shares backstory → offer to save as notes
- Compile scattered context into cohesive notes
- Never generate content, only compile what THEY said

### Alpha Reassurance
During alpha, emphasize:
- Nothing is permanent
- Everything is editable from dashboard
- Low-stakes, encouraging process

---

## Error Handling

### Upload Errors
- File too large → "Try compressing or shorter clip"
- Unsupported format → List supported formats
- Network error → "Try again" with helpful message

### Submission Errors
- Missing required fields → AI asks for them
- Database error → "Something went wrong, files are safe"
- Validation error → Specific guidance

---

## Future Enhancements

### Planned
- [ ] Individual track naming within packs
- [ ] BPM detection from audio files
- [ ] Waveform preview in chat
- [ ] Voice input option
- [ ] Batch upload progress

### Considerations
- Video duration validation (5-second limit)
- Audio duration detection
- Key detection from audio
- Genre auto-tagging from audio analysis

---

## Related Documentation

- [UNIVERSAL-MIXER.md](./UNIVERSAL-MIXER.md) - How content plays in the mixer
- [VIDEO-INTEGRATION.md](./VIDEO-INTEGRATION.md) - Video clip implementation details
- [CLAUDE.md](../CLAUDE.md) - Session development notes

---

*Documentation created November 29, 2025*
