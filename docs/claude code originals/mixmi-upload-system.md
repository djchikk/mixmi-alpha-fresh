---
name: mixmi-upload-system
description: Complete guide to mixmi's content upload system including Quick/Advanced modes, file handling, and metadata requirements
---

# mixmi Upload System

Complete reference for uploading songs, loops, loop packs, EPs, and mixes to the mixmi platform.

---

## Table of Contents

1. [Upload Modes Overview](#upload-modes-overview)
2. [Content Types](#content-types)
3. [Quick Upload Flow](#quick-upload-flow)
4. [Advanced Upload Flow](#advanced-upload-flow)
5. [File Upload Handling](#file-upload-handling)
6. [Attribution System](#attribution-system)
7. [Location Tagging](#location-tagging)
8. [Validation Rules](#validation-rules)
9. [API Integration](#api-integration)

---

## Upload Modes Overview

### Quick Upload Mode

**Purpose:** Fast, minimal-field upload for experienced users
**Fields:** Essential metadata only (~7 fields)
**Time:** ~60 seconds
**Best For:** Quick content drops, single loops, simple attribution

**Key Features:**
- Auto-fill attribution with authenticated wallet
- BPM auto-detection
- Default pricing
- Minimal validation

---

### Advanced Upload Mode

**Purpose:** Complete metadata entry with full control
**Fields:** All optional fields available (~25 fields)
**Time:** 3-5 minutes
**Best For:** Professional releases, complex attribution, detailed metadata

**Key Features:**
- Full metadata control
- Custom licensing options
- Detailed social/contact info
- Collaboration preferences
- Version tracking

---

## Content Types

### 1. Full Song

**Database Value:** `content_type = 'full_song'`

**Characteristics:**
- Complete musical composition
- Cannot be used in mixer (only loops allowed)
- Download-only (no remix licensing)
- Duration: Typically 2+ minutes

**Pricing:**
- `remix_price_stx = 0` (songs can't be remixed)
- `download_price_stx = 2.5` (default, customizable)
- `allow_downloads = true`

**Required Fields:**
- Title, artist, audio file
- Location (geographic pin)
- Cover image (optional, defaults to placeholder)

---

### 2. Loop

**Database Value:** `content_type = 'loop'`

**Characteristics:**
- Individual music loop (seamless)
- Can be loaded into mixer
- Available for remixing
- Duration: Typically 4-32 bars (~10-60 seconds)

**Pricing:**
- `remix_price_stx = 1.0` (default)
- `download_price_stx = NULL` (optional)
- `allow_downloads = false` (default)

**Required Fields:**
- Title, artist, audio file
- **BPM** (required for loops!)
- Loop category (Instrumental, Vocal, Beats, Stem, Other)
- Location

**Categories:**
```typescript
const LOOP_CATEGORIES = [
  'instrumental',
  'vocal',
  'beats',
  'stem',
  'other'
];
```

---

### 3. Loop Pack

**Database Value:** `content_type = 'loop_pack'`

**Characteristics:**
- Collection of 2-5 related loops
- All loops must have same BPM
- Each loop gets individual database record
- Master record links them together

**Pricing:**
- Per-loop pricing (each loop: 1 STX remix default)
- Optional: Pack download price (sum of individual loops)

**Required Fields:**
- Pack title, artist
- 2-5 audio files (min 2, max 5)
- **BPM** (same for all loops in pack)
- Loop category (same for all)
- Location
- Cover image (shared by all loops)

**Database Structure:**
```sql
-- Master pack record
id: "pack-uuid"
content_type: "loop_pack"
title: "Trap Pack Vol 1"
total_loops: 3
pack_id: NULL  -- Master has no pack_id

-- Individual loop records
id: "loop-uuid-1"
content_type: "loop"
title: "Trap Pack Vol 1 - Loop 1"
pack_id: "pack-uuid"  -- Links to master
pack_position: 1

id: "loop-uuid-2"
content_type: "loop"
title: "Trap Pack Vol 1 - Loop 2"
pack_id: "pack-uuid"
pack_position: 2

id: "loop-uuid-3"
content_type: "loop"
title: "Trap Pack Vol 1 - Loop 3"
pack_id: "pack-uuid"
pack_position: 3
```

---

### 4. EP (Extended Play)

**Database Value:** `content_type = 'ep'`

**Characteristics:**
- Collection of 2+ full songs
- Like loop pack but for songs
- Each song gets individual record
- Cannot be used in mixer

**Pricing:**
- Per-song download pricing
- Optional: EP bundle price

**Required Fields:**
- EP title, artist
- 2+ audio files
- Location
- Cover image

**Database Structure:**
- Same as loop pack but with `content_type = 'full_song'` for children

---

### 5. Mix (Remix)

**Database Value:** `content_type = 'mix'`

**Characteristics:**
- Derivative work from 2 source loops
- Tracks IP attribution from parents
- Remixer gets 20% commission on sales (planned)

**Pricing:**
- `remix_price_stx = 1.0` (if someone wants to remix this mix)
- `download_price_stx = sum of parent loop download prices` (if both allow)

**Required Fields:**
- Title, artist, audio file
- `source_track_ids` (array of 2 parent loop UUIDs)
- `remix_depth = 1` (generation number)
- Location (inherited or custom)

**Attribution:**
- Automatically calculated from source loops
- 50/50 split between loops
- See `lib/calculateRemixSplits.ts`

**Status:** Recording interface not yet implemented (manual upload for now)

---

## Quick Upload Flow

### Opening the Modal

**Triggers:**
1. Click "Upload" button in header
2. Click "Sign In and Upload" on Welcome page
3. Click "+" button in own store
4. Keyboard shortcut: `Cmd+U` (planned)

**Component:** `IPTrackModal` (`components/modals/IPTrackModal.tsx`)

---

### Step 1: Select Content Type

**UI:** 5 large buttons with icons
- 🎵 Song
- 🔁 Loop
- 📦 Loop Pack
- 💿 EP
- 🎚️ Mix (planned)

**Action:** Sets `content_type` state
**Default:** None (user must choose)

---

### Step 2: Quick Mode Fields

**Toggle:** "Quick Upload" switch (enabled by default)

**Fields Displayed:**

#### Essential Metadata
1. **Title** (text input, required)
   - Placeholder: "Track name"
   - Max length: 200 characters

2. **Artist** (text input, required)
   - Placeholder: "Artist name"
   - Auto-fill from previous uploads
   - Max length: 100 characters

3. **Audio File(s)** (file upload, required)
   - Songs/Loops: 1 file
   - Loop Packs: 2-5 files
   - EPs: 2+ files
   - Formats: WAV, MP3, FLAC, etc.
   - Max size: 10MB per file

4. **Cover Image** (file upload, optional)
   - Formats: PNG, JPG, WebP, GIF
   - Max size: 5MB
   - Default: Placeholder image if not provided

5. **BPM** (number input, required for loops/packs)
   - Auto-detected but user override required
   - Range: 60-200 BPM
   - Whole numbers only (no decimals)
   - Why: Mixer compatibility

6. **Location** (autocomplete, required)
   - Mapbox autocomplete with 5 suggestions
   - Worldwide support
   - Indigenous territory recognition
   - Exact coordinates preserved
   - Multiple locations supported (Advanced mode)

#### Auto-Filled Attribution

7. **"Use authenticated account" checkbox** (checked by default)
   - Auto-fills `composition_split_1_wallet` with user's wallet
   - Auto-fills `composition_split_1_percentage` with 100%
   - Auto-fills `production_split_1_wallet` with user's wallet
   - Auto-fills `production_split_1_percentage` with 100%
   - User can uncheck to manually enter different wallets

---

### Step 3: Submit

**Button:** "Save Track" (cyan, bottom-right)

**5-Stage Processing Pipeline:**

```
Stage 1: Validating metadata ⏳
  - Check required fields
  - Validate BPM (for loops)
  - Validate split percentages (must = 100%)
  - Check authentication

Stage 2: Uploading audio ⏳
  - Upload to Supabase Storage (user-content bucket)
  - Path: {walletAddress}/audio-{timestamp}.wav
  - Progress bar displayed
  - BPM detection running (if not manually set)

Stage 3: Uploading cover ⏳
  - Upload to Supabase Storage (track-covers bucket)
  - Path: {walletAddress}/cover-{timestamp}.png
  - Image optimization
  - Default placeholder if no image provided

Stage 4: Saving to database ⏳
  - Insert into ip_tracks table
  - Row Level Security applies
  - UUID generated
  - Timestamps set

Stage 5: Complete ✅
  - Toast notification
  - Modal closes
  - Content appears on globe (after refresh)
```

**Hook:** `useIPTrackSubmit` (`hooks/useIPTrackSubmit.ts`, 33KB)

---

## Advanced Upload Flow

### Enabling Advanced Mode

**Toggle:** "Quick Upload" switch (disable it)

**Effect:** Shows all optional fields in 7-step wizard

---

### Step 1: Content Type (same as Quick)

---

### Step 2: Audio Upload

**Fields:**
- Audio file picker (or drag-and-drop planned)
- BPM display (auto-detected)
- BPM manual override (required for loops)
- Duration display
- Waveform preview (planned)

**BPM Detection:**
- Hook: `useAudioUpload` (`hooks/useAudioUpload.ts`)
- Algorithm: `lib/bpmDetection.ts`
- Auto-runs on file upload
- User MUST verify/override
- Why: Prevents decimal precision issues in mixer

---

### Step 3: Basic Metadata

**Fields:**
1. **Title** (required)
2. **Artist** (required)
3. **Version** (optional)
   - Example: "Radio Edit", "Extended Mix", "Instrumental"
4. **Description** (optional)
   - Textarea, 500 characters
5. **Tell Us More** (optional)
   - Additional context, 1000 characters
6. **Tags** (optional)
   - Comma-separated
   - Auto-suggest from existing tags
   - Example: "trap, 808, dark"

**Loop-Specific:**
7. **Loop Category** (required for loops)
   - Dropdown: Instrumental, Vocal, Beats, Stem, Other

**Musical Metadata:**
8. **Musical Key** (optional)
   - Dropdown: C, C#, D, etc. + major/minor
9. **ISRC Code** (optional)
   - International Standard Recording Code
   - Format validation: XX-XXX-YY-NNNNN

---

### Step 4: Cover Image Upload

**Component:** `TrackCoverUploader` (`components/shared/TrackCoverUploader.tsx`)

**Features:**
- File picker or URL input
- Image preview
- Crop tool (react-easy-crop)
- Zoom and rotate
- 3-stage progress:
  1. Selecting file
  2. Cropping
  3. Uploading

**Storage:**
- Bucket: `track-covers` (dedicated, public)
- Organization: `{walletAddress}/cover-{timestamp}.{ext}`
- Optimization: Image compression on upload

---

### Step 5: Attribution Splits

**The Most Complex Step**

#### Two Separate Pies

**Composition Rights (100% pie):**
- Up to 3 contributors
- Each contributor: wallet address + percentage
- Must total exactly 100%
- Who wrote/composed the music

**Production Rights (100% pie):**
- Up to 3 contributors (can be different people)
- Each contributor: wallet address + percentage
- Must total exactly 100%
- Who produced/engineered the track

#### UI Layout

```
Composition Splits
├── Contributor 1 [✓ Use authenticated account]
│   ├── Wallet: SP... [auto-filled or manual]
│   └── Percentage: 100% [slider or input]
├── Contributor 2 [+ Add]
│   ├── Wallet: [empty]
│   └── Percentage: 0%
└── Contributor 3 [+ Add]
    ├── Wallet: [empty]
    └── Percentage: 0%

Production Splits
└── (same structure)
```

**Validation:**
- Real-time percentage total display
- Red warning if not 100%
- Cannot submit if invalid
- Wallet format validation (SP/SM addresses only)

#### Preset System

**Component:** `SplitPresetManager` (`components/modals/SplitPresetManager.tsx`)

**Features:**
- Save current splits as preset
- Name preset (e.g., "My Band", "Producer Team")
- Load preset into form
- Delete saved presets
- LocalStorage + Supabase persistence

**Use Case:**
- Band always splits 33/33/34 for composition
- Producer always gets 100% production
- Save once, load every time

---

### Step 6: Licensing & Pricing

**Component:** `SimplifiedLicensingStep` (`components/modals/steps/SimplifiedLicensingStep.tsx`)

#### Remix Licensing (Loops Only)

**Field:** "Allow Remixing"
- Checkbox, enabled by default for loops
- If enabled: Set remix price

**Remix Price:**
- Default: 1 STX per loop
- Can be set to 0 (free remixing)
- Range: 0-100 STX

#### Download Licensing

**Field:** "Allow Downloads"
- Checkbox, disabled by default
- If enabled: Set download price

**Download Price:**
- No default (user must set)
- Range: 0.5-1000 STX
- Can be 0 (free download with attribution)

#### Advanced Options (Planned)

- Custom license text
- Creative Commons selection
- Commercial use permissions
- Territory restrictions

#### Collaboration Preferences

- "Open to collaboration" checkbox
- Future: Collaboration invitation system

#### Terms Acceptance

- "I agree to mixmi Terms of Service" checkbox
- Required to submit
- Link to `/terms` page

---

### Step 7: Location & Social

#### Location Tagging

**Component:** `useLocationAutocomplete` hook

**Features:**
- Mapbox autocomplete
- 5 suggestions per search
- Worldwide coverage
- Indigenous territory recognition
  - Standing Rock
  - Pine Ridge
  - Navajo Nation
  - More hardcoded territories
- Exact coordinate preservation

**Multiple Locations:**
- Can add multiple (stored in JSONB `locations` array)
- First location is `primary_location`
- Displayed on globe at first location

**UI:**
```
Location: [_______________] 🔍

Suggestions:
┌──────────────────────┐
│ 🏙️ Los Angeles, CA   │
│ 🏙️ Louisiana, USA    │
│ 🏙️ Louisville, KY    │
│ 🏔️ Louisiana Nation  │
│ 🏙️ London, UK        │
└──────────────────────┘
```

#### Social URLs

**Fields (all optional):**
- Instagram URL
- Twitter/X URL
- YouTube URL
- SoundCloud URL
- Spotify URL
- Bandcamp URL
- Website URL

**Storage:** JSONB `social_urls` field

#### Contact Information

**Fields (all optional):**
- Email address
- Phone number
- Booking email

**Storage:** JSONB `contact_info` field

---

### Step 8: Review & Submit

**Summary Display:**
- All entered metadata
- Preview of cover image
- Attribution split visualization
- Pricing summary
- Location map preview (planned)

**Edit Buttons:**
- Each section has "Edit" button
- Jumps back to that step
- Preserves all other data

**Submit:**
- Same 5-stage pipeline as Quick mode
- Additional validation for advanced fields
- Longer processing time (more data)

---

## File Upload Handling

### Audio File Upload

**Hook:** `useAudioUpload` (`hooks/useAudioUpload.ts`)

#### Supported Formats

```typescript
const AUDIO_FORMATS = [
  'audio/wav',
  'audio/mpeg',   // MP3
  'audio/mp4',    // M4A
  'audio/flac',
  'audio/ogg',
  'audio/webm'
];
```

#### File Size Limits

- **Single file:** 10MB maximum
- **Loop pack:** 10MB per file, 50MB total
- **EP:** 10MB per file, 100MB total

#### Upload Process

```typescript
// 1. File selection
const handleFile = (file: File) => {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File too large');
  }

  setUploadedAudioFile(file);
  processAudioFile(file);
};

// 2. BPM detection (for loops)
const processAudioFile = async (file: File) => {
  setIsDetectingBPM(true);
  const detectedBPM = await detectBPM(file);
  setIsDetectingBPM(false);

  onBPMDetected(detectedBPM);
};

// 3. Upload to Supabase Storage
const uploadAudio = async (file: File, walletAddress: string) => {
  const fileName = `audio-${Date.now()}.${getExtension(file)}`;
  const filePath = `${walletAddress}/${fileName}`;

  const { data, error } = await supabase.storage
    .from('user-content')
    .upload(filePath, file, {
      onUploadProgress: (progress) => {
        setAudioUploadProgress(progress.loaded / progress.total * 100);
      }
    });

  if (error) throw error;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('user-content')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
};
```

#### Duration Detection

```typescript
const detectDuration = (file: File): Promise<number> => {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
      URL.revokeObjectURL(audio.src);
    });
  });
};
```

---

### Cover Image Upload

**Component:** `TrackCoverUploader` (`components/shared/TrackCoverUploader.tsx`)

#### Supported Formats

```typescript
const IMAGE_FORMATS = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif'
];
```

#### File Size Limit

- **Maximum:** 5MB

#### Upload Process

```typescript
// 1. File selection
const handleImageSelect = (file: File) => {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image too large (max 5MB)');
  }

  setSelectedImage(file);
  setShowCropTool(true);
};

// 2. Crop with react-easy-crop
<Cropper
  image={imagePreview}
  crop={crop}
  zoom={zoom}
  aspect={1} // Square crop for 160px cards
  onCropChange={setCrop}
  onZoomChange={setZoom}
  onCropComplete={onCropComplete}
/>

// 3. Upload cropped image
const uploadCroppedImage = async (croppedBlob: Blob) => {
  const fileName = `cover-${Date.now()}.png`;
  const filePath = `${walletAddress}/${fileName}`;

  const { data, error } = await supabase.storage
    .from('track-covers')
    .upload(filePath, croppedBlob, {
      contentType: 'image/png',
      onUploadProgress: (progress) => {
        setUploadProgress(progress.loaded / progress.total * 100);
      }
    });

  if (error) throw error;

  // Get public URL (clean, not base64!)
  const { data: urlData } = supabase.storage
    .from('track-covers')
    .getPublicUrl(filePath);

  return urlData.publicUrl; // ~100 character URL
};
```

#### Why This Matters (Performance)

**Before (Sept 2025):**
- Base64 images stored in database
- 500KB+ strings causing JSON corruption
- Globe loading: 32+ seconds

**After:**
- Clean Supabase Storage URLs (~100 chars)
- Separate `track-covers` bucket
- Globe loading: 17ms (1,882x faster!)

---

### Loop Pack Multi-File Handling

**Special Logic for 2-5 Files**

```typescript
const handleLoopPackUpload = async (files: File[]) => {
  if (files.length < 2 || files.length > 5) {
    throw new Error('Loop packs must have 2-5 loops');
  }

  // 1. Validate all files have audio format
  files.forEach(file => {
    if (!AUDIO_FORMATS.includes(file.type)) {
      throw new Error(`Invalid file type: ${file.name}`);
    }
  });

  // 2. Detect BPM for all files
  const bpms = await Promise.all(
    files.map(file => detectBPM(file))
  );

  // 3. Warn if BPMs don't match
  const avgBPM = Math.round(bpms.reduce((a, b) => a + b) / bpms.length);
  const hasVariance = bpms.some(bpm => Math.abs(bpm - avgBPM) > 2);

  if (hasVariance) {
    showToast('Warning: Loops have different BPMs. Mixer may not sync properly.', 'warning');
  }

  // 4. Upload all files
  const audioUrls = await Promise.all(
    files.map((file, index) => uploadAudio(file, walletAddress))
  );

  return { audioUrls, avgBPM, totalLoops: files.length };
};
```

---

## Attribution System

### Database Schema (Per Track)

```sql
-- Composition Splits (up to 3)
composition_split_1_wallet VARCHAR NOT NULL
composition_split_1_percentage INTEGER NOT NULL
composition_split_2_wallet VARCHAR
composition_split_2_percentage INTEGER
composition_split_3_wallet VARCHAR
composition_split_3_percentage INTEGER

-- Production Splits (up to 3)
production_split_1_wallet VARCHAR NOT NULL
production_split_1_percentage INTEGER NOT NULL
production_split_2_wallet VARCHAR
production_split_2_percentage INTEGER
production_split_3_wallet VARCHAR
production_split_3_percentage INTEGER
```

### Validation Rules

**1. Percentages Must Total 100%**
```typescript
const validateCompositionSplits = (track: IPTrack): boolean => {
  const total =
    (track.composition_split_1_percentage || 0) +
    (track.composition_split_2_percentage || 0) +
    (track.composition_split_3_percentage || 0);

  return total === 100;
};
```

**2. Wallet Addresses Must Be Valid**
```typescript
const isValidStacksAddress = (address: string): boolean => {
  // Must start with SP (mainnet) or ST (testnet)
  if (!address.startsWith('SP') && !address.startsWith('ST')) {
    return false;
  }

  // Must be 41-42 characters
  if (address.length < 41 || address.length > 42) {
    return false;
  }

  // Only alphanumeric characters
  return /^[A-Z0-9]+$/.test(address);
};
```

**3. Alpha Code Conversion (Backend)**

UI can accept alpha codes (e.g., `mixmi-ABC123`), but backend converts to wallet addresses before saving:

```typescript
// Frontend: User types alpha code
composition_split_1_wallet = "mixmi-ABC123"

// Backend: Convert via API
const response = await fetch('/api/auth/resolve-wallet', {
  method: 'POST',
  body: JSON.stringify({ authIdentity: "mixmi-ABC123" })
});

const { walletAddress } = await response.json();
// walletAddress = "SP1ABC..."

// Save to database with real wallet
composition_split_1_wallet = "SP1ABC..."
```

**Why:** Prevents security scanner warnings about "wallet address collection" in UI

---

### Auto-Fill With Authenticated Account

**Checkbox:** "Use authenticated account"

**When Checked:**
```typescript
const autoFillSplits = (walletAddress: string) => {
  setFormData({
    ...formData,
    composition_split_1_wallet: walletAddress,
    composition_split_1_percentage: 100,
    production_split_1_wallet: walletAddress,
    production_split_1_percentage: 100
  });
};
```

**User Can:**
- Uncheck to manually enter different wallets
- Add additional contributors (split 2, split 3)
- Adjust percentages with slider or number input

---

## Location Tagging

### Mapbox Integration

**Hook:** `useLocationAutocomplete` (`hooks/useLocationAutocomplete.ts`)

**API Key:** `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`

**Endpoint:** `https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json`

### Search Flow

```typescript
const handleLocationSearch = async (query: string) => {
  if (query.length < 3) {
    return; // Minimum 3 characters
  }

  // Debounce 300ms
  await delay(300);

  // Check hardcoded territories first
  const territoryMatch = INDIGENOUS_TERRITORIES.find(t =>
    t.name.toLowerCase().includes(query.toLowerCase())
  );

  if (territoryMatch) {
    return [territoryMatch];
  }

  // Query Mapbox API
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
    `access_token=${MAPBOX_TOKEN}&` +
    `limit=5&` +
    `types=place,region,country`
  );

  const data = await response.json();

  // Parse results
  return data.features.map(feature => ({
    name: feature.place_name,
    lat: feature.center[1],
    lng: feature.center[0],
    emoji: getLocationEmoji(feature)
  }));
};
```

### Hardcoded Indigenous Territories

```typescript
const INDIGENOUS_TERRITORIES = [
  {
    name: "Standing Rock",
    lat: 46.0833,
    lng: -100.7667,
    emoji: "🏔️"
  },
  {
    name: "Pine Ridge Reservation",
    lat: 43.1667,
    lng: -102.5500,
    emoji: "🏔️"
  },
  {
    name: "Navajo Nation",
    lat: 36.0544,
    lng: -109.7466,
    emoji: "🏔️"
  }
  // ... more territories
];
```

**Why Hardcoded:**
- Instant search (no API call)
- Guaranteed accuracy
- Cultural respect (proper names)
- Icon differentiation (🏔️ vs 🏙️)

### Coordinate Preservation

**Critical:** Store exact lat/lng from user's selection, don't re-geocode!

```typescript
const handleLocationSelect = (suggestion: LocationSuggestion) => {
  // ✅ CORRECT: Use exact coordinates from suggestion
  setFormData({
    ...formData,
    location_lat: suggestion.lat,
    location_lng: suggestion.lng,
    primary_location: suggestion.name
  });

  // ❌ WRONG: Re-geocode the name (causes drift)
  // const coords = await geocode(suggestion.name);
  // This caused "Belen, New Mexico" to appear in Brazil!
};
```

**Result:** Perfect location accuracy worldwide

---

## Validation Rules

### Required Fields

**All Content Types:**
- ✅ Title
- ✅ Artist
- ✅ Audio file(s)
- ✅ Location
- ✅ Composition split 1 (wallet + percentage)
- ✅ Production split 1 (wallet + percentage)
- ✅ Terms acceptance

**Loops Only:**
- ✅ BPM (manually verified, even if auto-detected)
- ✅ Loop category

**Loop Packs Only:**
- ✅ 2-5 audio files
- ✅ Consistent BPM across all loops
- ✅ Loop category (same for all)

**Remixes Only:**
- ✅ source_track_ids (2 parent loops)
- ✅ remix_depth (generation number)

### Validation Functions

```typescript
// Hook: useIPTrackForm
const validateForm = (): string[] => {
  const errors: string[] = [];

  // Title
  if (!formData.title || formData.title.trim() === '') {
    errors.push('Title is required');
  }

  // Artist
  if (!formData.artist || formData.artist.trim() === '') {
    errors.push('Artist is required');
  }

  // Audio
  if (!formData.audio_url && !uploadedAudioFile) {
    errors.push('Audio file is required');
  }

  // BPM (loops only)
  if (formData.content_type === 'loop' && !formData.bpm) {
    errors.push('BPM is required for loops');
  }

  // Location
  if (!formData.location_lat || !formData.location_lng) {
    errors.push('Location is required');
  }

  // Composition splits
  if (!validateSplits('composition')) {
    errors.push('Composition splits must total 100%');
  }

  // Production splits
  if (!validateSplits('production')) {
    errors.push('Production splits must total 100%');
  }

  // Terms
  if (!termsAccepted) {
    errors.push('You must accept the terms of service');
  }

  return errors;
};
```

### Real-Time Validation

**Split Percentage Validation:**
```typescript
const SplitPercentageDisplay = () => {
  const total =
    composition_split_1_percentage +
    composition_split_2_percentage +
    composition_split_3_percentage;

  const isValid = total === 100;

  return (
    <div className={isValid ? 'text-green-500' : 'text-red-500'}>
      Total: {total}% {isValid ? '✓' : '✗ Must equal 100%'}
    </div>
  );
};
```

**BPM Validation:**
```typescript
const validateBPM = (bpm: number): boolean => {
  // Must be whole number
  if (bpm % 1 !== 0) {
    showToast('BPM must be a whole number (no decimals)', 'error');
    return false;
  }

  // Reasonable range
  if (bpm < 60 || bpm > 200) {
    showToast('BPM must be between 60 and 200', 'warning');
    return false;
  }

  return true;
};
```

---

## API Integration

### Database Insertion

**Endpoint:** Direct Supabase client (no API route)

**Hook:** `useIPTrackSubmit` (`hooks/useIPTrackSubmit.ts`)

```typescript
const submitTrack = async (formData: IPTrackFormData) => {
  // 1. Upload audio files
  const audioUrl = await uploadAudio(uploadedAudioFile, walletAddress);

  // 2. Upload cover image
  const coverUrl = await uploadCoverImage(coverImage, walletAddress);

  // 3. Prepare database record
  const trackRecord = {
    // Identity
    id: uuid(),
    title: formData.title,
    artist: formData.artist,
    version: formData.version,
    description: formData.description,

    // Content classification
    content_type: formData.content_type,
    loop_category: formData.loop_category,
    tags: formData.tags,

    // Musical metadata
    bpm: formData.bpm,
    key: formData.key,

    // Pricing
    remix_price_stx: formData.remix_price_stx || 1.0,
    download_price_stx: formData.download_price_stx || null,
    allow_downloads: formData.allow_downloads || false,

    // IP Attribution
    composition_split_1_wallet: formData.composition_split_1_wallet,
    composition_split_1_percentage: formData.composition_split_1_percentage,
    composition_split_2_wallet: formData.composition_split_2_wallet,
    composition_split_2_percentage: formData.composition_split_2_percentage,
    composition_split_3_wallet: formData.composition_split_3_wallet,
    composition_split_3_percentage: formData.composition_split_3_percentage,

    production_split_1_wallet: formData.production_split_1_wallet,
    production_split_1_percentage: formData.production_split_1_percentage,
    production_split_2_wallet: formData.production_split_2_wallet,
    production_split_2_percentage: formData.production_split_2_percentage,
    production_split_3_wallet: formData.production_split_3_wallet,
    production_split_3_percentage: formData.production_split_3_percentage,

    // Media
    audio_url: audioUrl,
    cover_image_url: coverUrl,

    // Location
    location_lat: formData.location_lat,
    location_lng: formData.location_lng,
    primary_location: formData.primary_location,
    locations: formData.locations, // JSONB array

    // Metadata
    primary_uploader_wallet: walletAddress,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // 4. Insert into database
  const { data, error } = await supabase
    .from('ip_tracks')
    .insert([trackRecord])
    .select();

  if (error) throw error;

  return data[0];
};
```

### Loop Pack Insertion

**Special Logic: Create Multiple Records**

```typescript
const submitLoopPack = async (formData, audioFiles) => {
  // 1. Create master pack record
  const packId = uuid();
  const packRecord = {
    id: packId,
    content_type: 'loop_pack',
    title: formData.title,
    artist: formData.artist,
    total_loops: audioFiles.length,
    pack_id: null, // Master has no pack_id
    cover_image_url: await uploadCoverImage(...),
    // ... other metadata
  };

  await supabase.from('ip_tracks').insert([packRecord]);

  // 2. Create individual loop records
  for (let i = 0; i < audioFiles.length; i++) {
    const audioUrl = await uploadAudio(audioFiles[i], walletAddress);

    const loopRecord = {
      id: uuid(),
      content_type: 'loop',
      title: `${formData.title} - Loop ${i + 1}`,
      artist: formData.artist,
      pack_id: packId, // Link to master
      pack_position: i + 1,
      audio_url: audioUrl,
      cover_image_url: packRecord.cover_image_url, // Same as pack
      bpm: formData.bpm, // Same BPM for all
      loop_category: formData.loop_category, // Same category
      // ... copy attribution from pack
    };

    await supabase.from('ip_tracks').insert([loopRecord]);
  }
};
```

---

## Known Limitations

**What Works:**
- ✅ Quick and Advanced modes
- ✅ Multi-file loop pack upload
- ✅ BPM auto-detection with manual override
- ✅ Cover image crop and upload
- ✅ Attribution split presets
- ✅ Worldwide location tagging
- ✅ Alpha authentication

**What's Missing:**
- ❌ Audio drag-and-drop (only file picker)
- ❌ Waveform preview during upload
- ❌ Bulk upload (upload multiple tracks at once)
- ❌ CSV import for metadata
- ❌ Auto-tagging from audio analysis
- ❌ Duplicate detection
- ❌ Version history
- ❌ Draft saving
- ❌ Upload resume (if network fails)

**Constraints:**
- 3 contributors max per category (composition/production)
- 5 loops max per pack
- 10MB per audio file
- 5MB per cover image
- BPM must be whole number (no decimals)
- Alpha whitelist required

---

## Code Locations

**Main Modal:**
- `components/modals/IPTrackModal.tsx`

**Hooks:**
- `hooks/useIPTrackForm.ts` - Form state
- `hooks/useAudioUpload.ts` - Audio processing
- `hooks/useIPTrackSubmit.ts` - Submission (33KB)
- `hooks/useLocationAutocomplete.ts` - Location search
- `hooks/useSplitPresets.ts` - Preset management

**Components:**
- `components/shared/TrackCoverUploader.tsx` - Cover upload
- `components/modals/SplitPresetManager.tsx` - Preset UI
- `components/modals/steps/SimplifiedLicensingStep.tsx` - Licensing
- `components/shared/ArtistAutosuggest.tsx` - Artist autocomplete

**Utilities:**
- `lib/bpmDetection.ts` - BPM algorithm
- `lib/locationLookup.ts` - Mapbox integration
- `lib/imageUtils.ts` - Image optimization
- `lib/supabase-storage.ts` - Storage operations
