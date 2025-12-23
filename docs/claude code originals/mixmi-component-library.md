# mixmi Alpha - Component Library Reference

**Skill Purpose:** Complete component inventory and design system reference for the mixmi Alpha platform

**Last Updated:** October 26, 2025

---

## Overview

The mixmi Alpha component library is built with:
- **Next.js 14** with TypeScript and App Router
- **Tailwind CSS** for styling with custom design tokens
- **shadcn/ui** (Radix UI primitives) for accessible components
- **React DnD** for drag-and-drop interactions
- **Three.js** with @react-three/fiber for 3D globe
- **Tone.js** for professional audio processing

---

## Design System Fundamentals

### Color Palette

**Primary Colors:**
```javascript
background: '#101726'    // Deep navy background
border: '#151C2A'        // Subtle borders
accent: '#81E4F2'        // Cyan accent (links, highlights)
```

**Content Type Colors:**
```javascript
// Loops (Purple)
loop: '#9772F4'          // Standard loop border
loopLight: '#C4AEF8'     // Loop pack badges

// Songs (Gold/Cream)
song: '#FFE4B5'          // Song borders and badges

// UI Elements
slate-900: '#0F172A'     // Modal backgrounds
slate-800: '#1E293B'     // Card backgrounds
gray-700: '#374151'      // Disabled states
```

**Usage:**
- **Purple (#9772F4):** Loops, loop packs, mixer theme, vocal content
- **Gold (#FFE4B5):** Songs, EPs, instrumental content
- **Cyan (#81E4F2):** Interactive elements, links, purchase buttons
- **Navy (#101726):** Page backgrounds, maintaining 3D globe visibility

---

### Typography

**Font Stack:**
```css
/* Body/UI */
font-family: system-ui, -apple-system, sans-serif

/* Monospace (Metadata, BPM, Prices) */
font-family: monospace
```

**Font Sizes:**
```css
text-xs:   0.75rem  (12px)  /* Metadata, BPM badges */
text-sm:   0.875rem (14px)  /* Body text, descriptions */
text-base: 1rem     (16px)  /* Standard text */
text-lg:   1.125rem (18px)  /* Modal titles */
text-xl:   1.25rem  (20px)  /* Section headers */
text-2xl:  1.5rem   (24px)  /* Page titles */
```

**Font Weights:**
```css
font-medium: 500  /* Standard UI text */
font-bold:   700  /* Headers, emphasis */
```

---

### Spacing & Layout

**Grid System:**
- **160px base unit:** Track cards, consistent spacing
- **64px thumbnails:** Crate view, compact displays
- **320px modal cards:** Expanded detail views
- **Responsive breakpoints:**
  - Mobile: 400px (sm)
  - Tablet: 500px (md)
  - Laptop: 600px (lg)
  - Desktop: 700px (xl)

**Padding Scale:**
```css
p-1:  0.25rem  (4px)
p-2:  0.5rem   (8px)
p-3:  0.75rem  (12px)
p-4:  1rem     (16px)
p-6:  1.5rem   (24px)
```

**Gap Scale (Flexbox/Grid):**
```css
gap-1:  0.25rem  (4px)   /* Tight groupings */
gap-2:  0.5rem   (8px)   /* Standard spacing */
gap-4:  1rem     (16px)  /* Loose spacing */
```

---

### Border Radius

**Standard Radii:**
```css
rounded:     0.25rem  (4px)   /* Buttons, badges */
rounded-md:  0.375rem (6px)   /* Cards, inputs */
rounded-lg:  0.5rem   (8px)   /* Modals, large cards */
rounded-full: 9999px          /* Circular badges, avatars */
```

---

## Core Components

### 1. TrackCard (CompactTrackCardWithFlip)

**File:** `components/cards/CompactTrackCardWithFlip.tsx`

**Purpose:** Primary music content display component used across Globe, Store, and Search

**Dimensions:** 160x160px base card

**Features:**
- **Drag-and-drop:** Enabled via react-dnd (type: 'TRACK_CARD')
- **Hover overlay:** Shows title, artist, metadata on hover
- **Play preview:** 20-second audio preview with play/pause
- **Info modal:** Opens TrackDetailsModal with comprehensive track info
- **Purchase button:** Adds to cart with price display
- **Content type indicators:** Color-coded borders (purple for loops, gold for songs)
- **Loop pack/EP expansion:** Chevron button expands to show individual tracks

**Border Variants:**
```typescript
// Songs & EPs
border-[#FFE4B5] border-2

// Loops (single)
border-[#9772F4] border-2

// Loop Packs & EPs (multi-track)
border-[#9772F4] border-4  // Thicker border indicates pack
border-[#FFE4B5] border-4
```

**Hover Overlay Structure:**
```tsx
// Top: Title + Artist (linked to store/profile)
<div className="absolute top-1 left-2 right-2">
  <Link href="/store/{username}">{track.title}</Link>
  <Link href="/profile/{username}">{track.artist}</Link>
</div>

// Center: Play button (absolutely positioned)
<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
  <PlayButton />
</div>

// Bottom: Price/Remix Icon + Content Type + BPM
<div className="absolute bottom-2 left-2 right-2 flex justify-between">
  <PriceButton />
  <ContentTypeBadge />
  <BPMBadge />
</div>
```

**Icon Positions:**
- **Info icon:** Left side, vertically centered (hover only)
- **Chevron (packs/EPs):** Right side, vertically centered (hover only)
- **Delete button (edit mode):** Top-right corner
- **Track number badge:** Top-left (for pack tracks only)

**Loop Pack Expansion:**
```tsx
// Vertical dropdown drawer (slideDown animation)
<div className="w-[160px] bg-slate-900 border-2 rounded-b-lg">
  {packLoops.map((loop, index) => (
    <DraggableTrack key={loop.id}>
      <div className="flex items-center gap-2 px-2 py-1 h-[28px]">
        <NumberBadge>{index + 1}</NumberBadge>
        <BPM>{loop.bpm}</BPM>
        <PlayButton />
      </div>
    </DraggableTrack>
  ))}
</div>
```

**Pricing Display Logic:**
```typescript
// Songs/EPs: ALWAYS show download price
if (content_type === 'full_song' || content_type === 'ep') {
  return <PriceButton>{download_price_stx || 'Free'}</PriceButton>;
}

// Loops/Packs: Check allow_downloads flag
if (allow_downloads === false) {
  return <MixerBadge title="Platform remix only - 1 STX per loop">M</MixerBadge>;
}
if (download_price_stx !== null) {
  return <PriceButton>{download_price_stx}</PriceButton>;
}
// Fallback: Remix-only
return <MixerBadge>M</MixerBadge>;
```

**Generation Indicators:**
```typescript
// For loops and mixes only (not songs/EPs)
remix_depth === 0 → '🌱 LOOP'  // Original seed
remix_depth === 1 → '🌿 LOOP'  // Generation 1
remix_depth === 2 → '🌳 LOOP'  // Generation 2
```

**Key Props:**
```typescript
interface CompactTrackCardWithFlipProps {
  track: IPTrack;
  isPlaying: boolean;
  onPlayPreview: (trackId: string, audioUrl?: string) => void;
  onStopPreview?: () => void;
  showEditControls: boolean;  // Shows delete button
  onPurchase?: (track: IPTrack) => void;
  onEditTrack?: (track: IPTrack) => void;
  onDeleteTrack?: (trackId: string) => void;
}
```

**Usage:**
```tsx
<CompactTrackCardWithFlip
  track={track}
  isPlaying={playingTrack === track.id}
  onPlayPreview={handlePlayPreview}
  onStopPreview={handleStopPreview}
  showEditControls={isEditMode}
  onPurchase={handleAddToCart}
/>
```

---

### 2. Grid Layout System

**Standard Grid:**
```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
  {tracks.map(track => (
    <CompactTrackCardWithFlip key={track.id} track={track} {...props} />
  ))}
</div>
```

**Responsive Breakpoints:**
- Mobile (default): 2 columns
- Small (640px): 3 columns
- Medium (768px): 4 columns
- Large (1024px): 5 columns
- XL (1280px): 6 columns

**Pagination:**
```typescript
const TRACKS_PER_PAGE = 24;  // Divisible by 2,3,4,6 for clean grids
```

---

### 3. Modal Components

#### TrackDetailsModal

**File:** `components/modals/TrackDetailsModal.tsx`

**Purpose:** Comprehensive track information display

**Size:** 320px width, max 70vh height

**Sections (in order):**
1. **Header:** Track title + artist (linked)
2. **Individual Loops/Songs** (packs/EPs only) - Draggable to crate/mixer
3. **Price & License:** License type + pricing info
4. **Basic Info:** Title, artist, type, generation
5. **Source Tracks** (remixes only) - Shows parent tracks with view links
6. **Tags:** Genre/mood/location tags
7. **Metadata:** BPM, key, duration
8. **Description:** User-provided description
9. **Notes & Credits:** Additional information
10. **IP Rights:** Composition + production splits (detailed for remixes)

**Individual Loop/Song Display (Loop Packs/EPs):**
```tsx
<div className="space-y-2">
  {packLoops.map((loop, index) => (
    <DraggableModalTrack key={loop.id} track={loop}>
      <div className="flex items-center gap-3 p-2 bg-slate-800/50 rounded border border-gray-700">
        <NumberBadge color={content_type === 'ep' ? '#FFE4B5' : '#9772F4'}>
          {index + 1}
        </NumberBadge>
        <div className="flex-1">
          <div className="text-xs font-medium">{loop.title}</div>
          <div className="text-xs text-gray-500">{loop.bpm} BPM</div>
        </div>
        <GripVertical className="opacity-0 group-hover:opacity-100" />
        <PlayPauseButton />
      </div>
    </DraggableModalTrack>
  ))}
</div>
```

**IP Rights Display (Remixes):**
```tsx
// Grouped by source loop for clarity
{sourceTracks.map(sourceLoop => (
  <div key={sourceLoop.id}>
    <div className="text-cyan-400 font-semibold">From: {sourceLoop.title}</div>

    {/* Composition: 50% contribution */}
    <div className="mb-3">
      <div className="text-gray-400">IDEA (Composition): contributes 50%</div>
      {compSplits.map(split => (
        <div>• Creator: {split.percentage}% → {split.percentage * 0.5}% of remix</div>
      ))}
    </div>

    {/* Production: 50% contribution */}
    <div>
      <div className="text-gray-400">IMPLEMENTATION (Recording): contributes 50%</div>
      {prodSplits.map(split => (
        <div>• Creator: {split.percentage}% → {split.percentage * 0.5}% of remix</div>
      ))}
    </div>
  </div>
))}

{/* Remixer commission note */}
<div className="mt-4 p-2 bg-slate-800/50 rounded">
  Note: Remixer receives 20% commission on sales, separate from IP ownership.
</div>
```

**IP Rights Display (Originals):**
```tsx
{/* Composition Rights */}
<div className="mb-4">
  <div className="text-gray-400 font-semibold">IDEA (Composition):</div>
  {compositionSplits.map(split => (
    <div>• Creator: {split.percentage}% [{formatWallet(split.wallet)}]</div>
  ))}
</div>

{/* Production Rights */}
<div>
  <div className="text-gray-400 font-semibold">IMPLEMENTATION (Recording):</div>
  {productionSplits.map(split => (
    <div>• Creator: {split.percentage}% [{formatWallet(split.wallet)}]</div>
  ))}
</div>
```

**Key Features:**
- **Portal rendering:** Uses `createPortal()` for proper z-index stacking
- **ESC key support:** Closes modal on Escape key
- **Click outside:** Closes on backdrop click
- **Audio playback:** 20-second previews for individual loops
- **Drag-and-drop:** Individual tracks draggable to crate/mixer

---

#### IPTrackModal (Upload Modal)

**File:** `components/modals/IPTrackModal.tsx`

**Purpose:** Complete content upload interface

**Modes:**
1. **Quick Upload:** Minimal form (~60 seconds, 7 fields)
2. **Advanced Upload:** 7-step wizard (~5 minutes, full metadata)

**Upload Types:**
- Song (full_song)
- Loop (loop)
- Loop Pack (loop_pack)
- EP (ep)

**Quick Upload Fields:**
```typescript
// Step 1: Content selection
content_type: 'full_song' | 'loop' | 'loop_pack' | 'ep'

// Step 2: Files
audio_files: File[]       // 10MB max per file
cover_image: File         // 5MB max (PNG/JPG/WebP/GIF)

// Step 3: Basic metadata
title: string
artist: string
bpm: number              // Required for loops, optional for songs

// Step 4: Pricing
license_selection: 'platform_remix' | 'platform_download'
remix_price_stx: number    // Default 1.0
download_price_stx: number // Only if allow_downloads = true
allow_downloads: boolean   // Default false for loops

// Step 5: Location
primary_location: string   // From Mapbox autocomplete
location_lat: number       // Exact coordinates preserved
location_lng: number

// Step 6: IP Attribution
composition_split_1_wallet: string
composition_split_1_percentage: number
production_split_1_wallet: string
production_split_1_percentage: number

// Step 7: Agreement
agreed_to_terms: boolean
```

**Advanced Upload Additional Fields:**
```typescript
// Metadata
version: string
description: string
tell_us_more: string
key: string                // Musical key
tags: string[]
isrc: string

// Collaboration
composition_split_2_wallet: string
composition_split_2_percentage: number
composition_split_3_wallet: string
composition_split_3_percentage: number
production_split_2_wallet: string
production_split_2_percentage: number
production_split_3_wallet: string
production_split_3_percentage: number

// Licensing
open_to_collaboration: boolean
```

**File Upload Pipeline:**
```typescript
// 1. Validate files
audio_files.forEach(file => {
  if (file.size > 10 * 1024 * 1024) throw 'File too large';
  if (!['audio/mpeg', 'audio/wav', 'audio/mp3'].includes(file.type))
    throw 'Invalid format';
});

// 2. Upload to Supabase Storage
const audioPath = `${walletAddress}/audio-${timestamp}.${ext}`;
await supabase.storage.from('user-content').upload(audioPath, file);

const coverPath = `${walletAddress}/cover-${timestamp}.${ext}`;
await supabase.storage.from('track-covers').upload(coverPath, coverImage);

// 3. Insert to database
await supabase.from('ip_tracks').insert({
  ...formData,
  audio_url: audioPublicUrl,
  cover_image_url: coverPublicUrl,
  primary_uploader_wallet: walletAddress
});
```

**Validation Rules:**
```typescript
// Split validation (must total 100%)
composition_total === 100 && production_total === 100

// BPM requirements
if (content_type === 'loop') {
  bpm: required, integer, 60-200 range
}

// Pricing constraints
if (allow_downloads === false) {
  download_price_stx: must be NULL
}
if (allow_downloads === true) {
  download_price_stx: required, >= 0
}

// File counts
loop_pack: 2-5 audio files
ep: 2-10 audio files
full_song: 1 audio file
loop: 1 audio file
```

---

#### SignInModal

**File:** `components/modals/SignInModal.tsx`

**Purpose:** Dual authentication (Stacks wallet + alpha invite code)

**Authentication Paths:**

**Path 1: Stacks Wallet**
```tsx
<button onClick={connectWallet}>
  Connect Stacks Wallet
</button>

// Uses @stacks/connect
showConnect({
  appDetails: {
    name: 'mixmi Alpha',
    icon: '/logo.png'
  },
  onFinish: (data) => {
    const walletAddress = data.userSession.loadUserData()
      .profile.stxAddress.mainnet;
    // Check alpha_users whitelist
    verifyAlphaUser(walletAddress);
  }
});
```

**Path 2: Alpha Invite Code**
```tsx
<input
  placeholder="Enter your alpha code (mixmi-ABC123)"
  onChange={handleCodeInput}
/>

// Server-side validation
const response = await fetch('/api/alpha-auth', {
  method: 'POST',
  body: JSON.stringify({ alpha_code: code })
});

// Returns wallet address if approved
const { wallet_address } = await response.json();
```

**Security:**
- Alpha codes converted to wallet addresses server-side
- No wallet terminology in UI (security scanner compliance)
- Server-side whitelist check via Supabase service role key

---

### 4. Audio Components

#### SimplifiedMixer

**File:** `components/mixer/SimplifiedMixer.tsx`

**Purpose:** Professional dual-deck DJ interface

**Architecture:**
```typescript
interface SimplifiedMixerState {
  deckA: DeckState;
  deckB: DeckState;
  masterBPM: number;
  crossfaderPosition: number;  // 0-100 (0=A only, 50=center, 100=B only)
  syncActive: boolean;
}

interface DeckState {
  track: Track | null;
  playing: boolean;
  loopEnabled: boolean;
  loopLength: number;        // 2, 4, 8, 16 bars
  loopPosition: number;
  boostLevel: number;        // 0=off, 1=gentle, 2=aggressive
}
```

**Features:**
- **Dual Deck System:** Independent deck A/B with synchronized playback
- **BPM Sync Engine:** Auto-match tempo, increment/decrement master BPM
- **Loop Controls:** 2/4/8/16 bar loops with position control
- **Crossfader:** Smooth blending between decks
- **FX Chain:** Reverb, delay, filter per deck
- **Waveform Display:** Real-time visual feedback with scrolling playhead
- **Recording:** Capture live mix (MP3 export)

**UI Layout:**
```tsx
<div className="mixer-container">
  {/* Top: Master controls */}
  <MasterTransportControls
    masterBPM={masterBPM}
    syncActive={syncActive}
    onBPMChange={handleBPMChange}
    onSyncToggle={toggleSync}
  />

  {/* Middle: Dual decks */}
  <div className="grid grid-cols-2 gap-4">
    <SimplifiedDeck
      deck="A"
      track={deckA.track}
      playing={deckA.playing}
      {...deckAControls}
    />
    <SimplifiedDeck
      deck="B"
      track={deckB.track}
      playing={deckB.playing}
      {...deckBControls}
    />
  </div>

  {/* Center: Crossfader */}
  <CrossfaderControl
    position={crossfaderPosition}
    onChange={handleCrossfaderChange}
  />

  {/* Bottom: Loop controls */}
  <div className="grid grid-cols-2 gap-4">
    <LoopControls deck="A" {...deckA} />
    <LoopControls deck="B" {...deckB} />
  </div>
</div>
```

**Audio Processing:**
```typescript
// Uses Tone.js for professional audio
import * as Tone from 'tone';

// Deck audio chain
const player = new Tone.Player(audioUrl);
const filter = new Tone.Filter(20000, 'lowpass');
const reverb = new Tone.Reverb(2.0);
const delay = new Tone.FeedbackDelay('8n', 0.5);
const gain = new Tone.Gain(1.0);

player
  .connect(filter)
  .connect(reverb)
  .connect(delay)
  .connect(gain)
  .connect(crossfader);

// Crossfader mixing
const crossfaderGainA = (100 - position) / 100;
const crossfaderGainB = position / 100;
```

**Sync Engine:**
```typescript
class SimpleLoopSync {
  masterBPM: number;

  syncDeck(deck: DeckState) {
    const originalBPM = deck.track.bpm;
    const ratio = this.masterBPM / originalBPM;
    deck.audioPlayer.playbackRate = ratio;
  }

  updateMasterBPM(newBPM: number) {
    this.masterBPM = newBPM;
    if (syncActive) {
      this.syncDeck(deckA);
      this.syncDeck(deckB);
    }
  }
}
```

**Loop Implementation:**
```typescript
const loopDuration = (60 / bpm) * 4 * loopLength;  // Seconds per loop
player.loop = loopEnabled;
player.loopStart = loopPosition * loopDuration;
player.loopEnd = loopPosition * loopDuration + loopDuration;
```

**Recording Flow:**
```typescript
// Start recording
const audioCtx = getAudioContext();
const destination = audioCtx.createMediaStreamDestination();
const mediaRecorder = new MediaRecorder(destination.stream);

// Connect mixer output to recorder
mixerGain.connect(destination);

// Capture chunks
mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

// Export
mediaRecorder.onstop = () => {
  const blob = new Blob(chunks, { type: 'audio/mp3' });
  const url = URL.createObjectURL(blob);
  downloadMix(url);
};
```

**Stability Fixes (Oct 23, 2025):**
- Memory leak prevention with proper audio cleanup
- Race condition elimination using requestAnimationFrame
- Type safety improvements (removed all 'any' types)
- FX retry logic refactoring with timeout cleanup
- Sync engine state management consolidation

---

#### Crate Component

**File:** `components/shared/Crate.tsx`

**Purpose:** Persistent track collection across Globe, Store, Mixer pages

**Features:**
- **Global State:** MixerContext persistence
- **localStorage:** Track collection persists across sessions
- **Drag-and-drop:** Accept tracks from cards, decks
- **Context-aware:** Different behavior per page
- **Audio preview:** 20-second playback for tracks
- **Pack expansion:** Horizontal slide-out for loop packs/EPs

**UI States:**
```tsx
// Collapsed (showing count only)
<div className="crate-collapsed">
  <span>Crate ({collection.length})</span>
  <ChevronUp />
</div>

// Expanded (horizontal scroll)
<div className="crate-expanded flex gap-2 overflow-x-auto">
  {collection.map((track, index) => (
    <DraggableTrack key={track.id} index={index}>
      <CrateCard track={track} />
    </DraggableTrack>
  ))}
</div>
```

**CrateCard Display (64px):**
```tsx
<div className="w-16 h-16 relative">
  {/* Cover image */}
  <SafeImage
    src={getOptimizedTrackImage(track, 64)}
    alt={track.title}
    className="w-full h-full object-cover"
  />

  {/* Hover overlay */}
  <div className="absolute inset-0 bg-black/80 opacity-0 hover:opacity-100">
    <InfoIcon size="sm" onClick={openModal} />
    <PlayButton size="sm" onClick={playPreview} />
    <RemoveButton size="sm" onClick={removeFromCrate} />
  </div>

  {/* Pack expansion chevron */}
  {(content_type === 'loop_pack' || content_type === 'ep') && (
    <ChevronRight
      className="absolute right-0 top-1/2 -translate-y-1/2"
      onClick={expandPack}
    />
  )}
</div>
```

**Pack Expansion (Horizontal):**
```tsx
{isPackExpanded && (
  <div className="ml-2 flex gap-1 animate-slideInRight">
    {packTracks.map((track, index) => (
      <DraggablePackTrack key={track.id} track={track}>
        <div className="w-16 h-16 relative">
          <NumberBadge>{index + 1}</NumberBadge>
          <SafeImage src={track.cover_image_url} />
          <PlayButton />
        </div>
      </DraggablePackTrack>
    ))}
  </div>
)}
```

**Drag-and-Drop Integration:**
```typescript
// Accept tracks from anywhere
const [{ isOver }, drop] = useDrop({
  accept: ['TRACK_CARD', 'DECK_TRACK', 'COLLECTION_TRACK'],
  drop: (item: { track: IPTrack }) => {
    if (!collection.some(t => t.id === item.track.id)) {
      addTrackToCollection(item.track);
    }
  }
});

// Expose global functions
useEffect(() => {
  window.addToCollection = (track) => addTrackToCollection(track);
  window.removeFromCollection = (trackId) => {
    const index = collection.findIndex(t => t.id === trackId);
    if (index !== -1) removeTrackFromCollection(index);
  };
  window.clearCollection = () => clearCollection();
}, [collection]);
```

**Context-Aware Behavior:**
```typescript
const context = getContext(); // 'globe' | 'store' | 'mixer'

// Globe: Collection staging for mixer
if (context === 'globe') {
  return <Crate showMixerButton={true} />;
}

// Store: Purchase cart
if (context === 'store') {
  return <Crate showPurchaseButton={true} />;
}

// Mixer: Track loading queue
if (context === 'mixer') {
  return <Crate showLoadButtons={true} />;
}
```

---

### 5. Form Components

#### Form Inputs (shadcn/ui)

**Text Input:**
```tsx
<Input
  type="text"
  placeholder="Enter title"
  value={formData.title}
  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
  className="bg-slate-800 border-gray-700 text-white"
/>
```

**Textarea:**
```tsx
<Textarea
  placeholder="Describe your track..."
  value={formData.description}
  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
  rows={4}
  className="bg-slate-800 border-gray-700 text-white resize-none"
/>
```

**Select Dropdown:**
```tsx
<Select
  value={formData.license_selection}
  onValueChange={(value) => setFormData({ ...formData, license_selection: value })}
>
  <SelectTrigger className="bg-slate-800 border-gray-700 text-white">
    <SelectValue placeholder="Select license" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="platform_remix">Platform Remix Only</SelectItem>
    <SelectItem value="platform_download">Platform Remix + Download</SelectItem>
  </SelectContent>
</Select>
```

**Number Input (BPM):**
```tsx
<Input
  type="number"
  min={60}
  max={200}
  step={1}
  value={formData.bpm || ''}
  onChange={(e) => setFormData({ ...formData, bpm: parseInt(e.target.value) })}
  className="bg-slate-800 border-gray-700 text-white"
/>
```

**Toggle Switch:**
```tsx
<Switch
  checked={formData.allow_downloads}
  onCheckedChange={(checked) => setFormData({ ...formData, allow_downloads: checked })}
  className="data-[state=checked]:bg-accent"
/>
```

**Checkbox:**
```tsx
<Checkbox
  id="terms"
  checked={formData.agreed_to_terms}
  onCheckedChange={(checked) => setFormData({ ...formData, agreed_to_terms: checked })}
  className="border-gray-700"
/>
<label htmlFor="terms" className="text-sm text-gray-300">
  I agree to terms and conditions
</label>
```

---

#### File Upload Components

**Audio File Upload:**
```tsx
<input
  type="file"
  accept="audio/mpeg,audio/wav,audio/mp3"
  multiple={content_type === 'loop_pack' || content_type === 'ep'}
  onChange={(e) => {
    const files = Array.from(e.target.files || []);
    // Validate file size
    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        alert('File too large (max 10MB)');
        return;
      }
    });
    setAudioFiles(files);
  }}
  className="hidden"
  ref={audioInputRef}
/>

<button onClick={() => audioInputRef.current?.click()}>
  Choose Audio Files
</button>

{/* File list preview */}
{audioFiles.map((file, i) => (
  <div key={i} className="flex items-center justify-between p-2 bg-slate-800 rounded">
    <span className="text-sm text-white truncate">{file.name}</span>
    <span className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
  </div>
))}
```

**TrackCoverUploader:**
```tsx
// components/shared/TrackCoverUploader.tsx
<div className="border-2 border-dashed border-gray-700 rounded-lg p-4">
  {preview ? (
    <div className="relative">
      <img src={preview} alt="Preview" className="w-full h-48 object-cover rounded" />
      <button
        onClick={clearImage}
        className="absolute top-2 right-2 p-1 bg-red-600 rounded"
      >
        Remove
      </button>
    </div>
  ) : (
    <button onClick={() => fileInputRef.current?.click()}>
      <Upload className="w-8 h-8 text-gray-400 mb-2" />
      <span className="text-sm text-gray-400">Upload Cover Image</span>
      <span className="text-xs text-gray-500">PNG, JPG, WebP, GIF (max 5MB)</span>
    </button>
  )}
</div>

<input
  type="file"
  accept="image/png,image/jpeg,image/webp,image/gif"
  onChange={handleFileChange}
  className="hidden"
  ref={fileInputRef}
/>
```

---

#### Location Search (Mapbox)

**File:** Used in IPTrackModal

**Implementation:**
```tsx
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

// Initialize geocoder
const geocoder = new MapboxGeocoder({
  accessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
  placeholder: 'Search for a location...',
  types: 'place,locality,neighborhood'
});

// Handle selection
geocoder.on('result', (e) => {
  const { center, place_name } = e.result;
  setFormData({
    ...formData,
    primary_location: place_name,
    location_lng: center[0],  // Exact coordinates preserved
    location_lat: center[1]   // No re-geocoding!
  });
});
```

**Indigenous Territory Support:**
```typescript
// Hardcoded territories for instant search
const indigenousTerritories = [
  {
    name: '🏔️ Standing Rock Sioux Reservation',
    lat: 45.8302,
    lng: -100.4913
  },
  {
    name: '🏔️ Pine Ridge Reservation',
    lat: 43.2306,
    lng: -102.5519
  },
  {
    name: '🏔️ Navajo Nation',
    lat: 36.0544,
    lng: -109.5465
  }
  // ... more territories
];

// Hybrid search: territories first, then Mapbox
const searchLocation = async (query: string) => {
  const territoryMatch = indigenousTerritories.find(t =>
    t.name.toLowerCase().includes(query.toLowerCase())
  );

  if (territoryMatch) {
    return territoryMatch;
  }

  return await mapboxGeocoder.query(query);
};
```

---

### 6. Utility Components

#### SafeImage

**File:** `components/shared/SafeImage.tsx`

**Purpose:** Graceful image loading with fallbacks

**Features:**
- User-provided URL detection
- Next.js Image for optimized images
- Regular img tag for external URLs
- Error handling with fallback placeholder
- Automatic retry logic

**Usage:**
```tsx
<SafeImage
  src={track.cover_image_url}
  alt={track.title}
  className="w-full h-full object-cover"
  fill
  fallbackSrc="/placeholders/error-placeholder.svg"
  onError={() => console.log('Image failed to load')}
/>
```

**Detection Logic:**
```typescript
const isUserProvidedUrl = (url: string): boolean => {
  if (!url) return false;
  if (url.startsWith('/')) return false;          // Local paths
  if (url.startsWith('data:')) return false;      // Base64
  if (url.includes('supabase.co/storage/')) return false;  // Cloud storage
  return true;  // Everything else is user-provided
};
```

---

#### InfoIcon

**File:** `components/shared/InfoIcon.tsx`

**Purpose:** Consistent info button across card sizes

**Sizes:**
```typescript
size: 'sm' | 'md' | 'lg'

sm: { container: 'w-4 h-4', text: 'text-sm' }   // 64px cards
md: { container: 'w-6 h-6', text: 'text-lg' }   // 160px cards
lg: { container: 'w-8 h-8', text: 'text-2xl' }  // 280px cards
```

**Usage:**
```tsx
<InfoIcon
  size="md"
  onClick={handleInfoClick}
  title="View track details"
  className="text-white hover:text-white"  // Custom colors
/>
```

---

### 7. Layout Components

#### Header

**File:** `components/layout/Header.tsx`

**Features:**
- **Navigation:** Globe, Welcome, Mixer, Upload links
- **Authentication:** Stacks wallet connect + alpha code
- **Shopping Cart:** Global cart icon with popover
- **User Menu:** My Profile, My Store links
- **Mobile Menu:** Hamburger menu for responsive

**Cart Popover:**
```tsx
<div className="fixed top-20 right-4 z-30">
  <button onClick={() => setShowCartPopover(!showCartPopover)}>
    <ShoppingCart className="w-6 h-6" />
    {cart.length > 0 && (
      <span className="badge">{cart.length}</span>
    )}
  </button>

  {showCartPopover && (
    <div className="cart-popover absolute top-full mt-2 right-0 w-80">
      {/* Cart items */}
      {cart.map(item => (
        <CartItem key={item.id} item={item} onRemove={removeFromCart} />
      ))}

      {/* Total */}
      <div className="border-t p-3">
        <div>Total: {cartTotal.toFixed(2)} STX</div>
        <button onClick={purchaseAll}>Purchase All</button>
      </div>
    </div>
  )}
</div>
```

---

## Responsive Design Patterns

### Mobile-First Breakpoints

**Tailwind Breakpoints:**
```css
sm:  640px   /* Small tablets */
md:  768px   /* Tablets */
lg:  1024px  /* Laptops */
xl:  1280px  /* Desktops */
2xl: 1536px  /* Large desktops */
```

**Card Grid Responsive:**
```tsx
<div className="
  grid
  grid-cols-2      /* Mobile: 2 columns */
  sm:grid-cols-3   /* Tablet: 3 columns */
  md:grid-cols-4   /* Medium: 4 columns */
  lg:grid-cols-5   /* Laptop: 5 columns */
  xl:grid-cols-6   /* Desktop: 6 columns */
  gap-4
">
  {tracks.map(track => <TrackCard key={track.id} track={track} />)}
</div>
```

**Mixer Responsive:**
```tsx
// Mobile: Stack decks vertically
<div className="
  flex flex-col      /* Mobile: vertical */
  lg:flex-row        /* Desktop: horizontal */
  gap-4
">
  <SimplifiedDeck deck="A" />
  <SimplifiedDeck deck="B" />
</div>

// Waveform width adjusts
const waveformWidth = {
  sm: 400,   // Mobile
  md: 500,   // Tablet
  lg: 600,   // Laptop
  xl: 700    // Desktop
};
```

**Header Navigation:**
```tsx
{/* Desktop: Horizontal nav */}
<nav className="hidden md:flex gap-8">
  <Link href="/">Globe</Link>
  <Link href="/mixer">Mixer</Link>
</nav>

{/* Mobile: Hamburger menu */}
<button className="md:hidden" onClick={toggleMobileMenu}>
  {isMobileMenuOpen ? <X /> : <Menu />}
</button>

{isMobileMenuOpen && (
  <nav className="md:hidden flex flex-col gap-4 p-6">
    <Link href="/">Globe</Link>
    <Link href="/mixer">Mixer</Link>
  </nav>
)}
```

---

## Animation & Transitions

### Standard Transitions

**Hover Effects:**
```css
transition-all duration-300 hover:scale-105
```

**Button Presses:**
```css
active:scale-95 transition-transform
```

**Fade In:**
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}
```

**Slide Down (Pack Expansion):**
```css
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Slide In Right (Crate Expansion):**
```css
@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

---

## Accessibility Features

### Keyboard Support

**ESC Key (Modals):**
```typescript
useEffect(() => {
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  if (isOpen) {
    document.addEventListener('keydown', handleEsc);
  }

  return () => document.removeEventListener('keydown', handleEsc);
}, [isOpen, onClose]);
```

**Tab Navigation:**
```tsx
// Ensure proper tab order
<button tabIndex={0}>Primary Action</button>
<button tabIndex={1}>Secondary Action</button>
```

### ARIA Labels

**Buttons:**
```tsx
<button
  aria-label="Play track preview"
  title="Play track preview"
  onClick={handlePlay}
>
  <PlayIcon />
</button>
```

**Modals:**
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <h2 id="modal-title">Track Details</h2>
  {/* Modal content */}
</div>
```

---

## Performance Optimizations

### Image Optimization

**getOptimizedTrackImage Helper:**
```typescript
// lib/imageOptimization.ts
export function getOptimizedTrackImage(track: IPTrack, targetSize: number): string {
  const imageUrl = track.cover_image_url || track.imageUrl;

  // For Supabase Storage URLs, use transform API
  if (imageUrl?.includes('supabase.co/storage/')) {
    return `${imageUrl}?width=${targetSize}&quality=80`;
  }

  // For other URLs, return as-is
  return imageUrl || '/placeholders/default-cover.svg';
}

// Usage
<SafeImage
  src={getOptimizedTrackImage(track, 64)}   // Crate: 64px
  src={getOptimizedTrackImage(track, 160)}  // Card: 160px
  src={getOptimizedTrackImage(track, 320)}  // Modal: 320px
/>
```

**Parallel Loading:**
```tsx
// Load cover images in parallel
const loadImages = async (tracks: IPTrack[]) => {
  const imagePromises = tracks.map(track =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(track);
      img.onerror = () => resolve(track);  // Continue even on error
      img.src = getOptimizedTrackImage(track, 160);
    })
  );

  await Promise.all(imagePromises);
};
```

### Audio Optimization

**20-Second Preview:**
```typescript
const handlePlayPreview = async (trackId: string, audioUrl: string) => {
  // Stop previous audio
  if (currentAudio) {
    currentAudio.pause();
    setCurrentAudio(null);
  }

  // Play new audio
  const audio = new Audio(audioUrl);
  audio.crossOrigin = 'anonymous';
  await audio.play();
  setCurrentAudio(audio);
  setPlayingTrack(trackId);

  // Auto-stop after 20 seconds
  const timeout = setTimeout(() => {
    audio.pause();
    setCurrentAudio(null);
    setPlayingTrack(null);
  }, 20000);

  // Cleanup on unmount
  return () => {
    audio.pause();
    clearTimeout(timeout);
  };
};
```

**Mixer Audio Cleanup:**
```typescript
useEffect(() => {
  return () => {
    // Cleanup all audio elements on unmount
    if (deckAAudio) deckAAudio.pause();
    if (deckBAudio) deckBAudio.pause();
    if (loopAudio) loopAudio.pause();

    // Clear FX retry timeouts
    fxRetryTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    fxRetryTimeoutsRef.current.clear();
  };
}, []);
```

---

## Common Patterns & Best Practices

### Drag-and-Drop Pattern

**Step 1: Make Component Draggable:**
```tsx
import { useDrag } from 'react-dnd';

const [{ isDragging }, drag] = useDrag(() => ({
  type: 'TRACK_CARD',
  item: () => ({
    track: {
      ...track,
      imageUrl: getOptimizedTrackImage(track, 64),
      cover_image_url: track.cover_image_url,  // Preserve high-res
      audioUrl: track.audio_url
    }
  }),
  collect: (monitor) => ({
    isDragging: monitor.isDragging()
  })
}), [track]);

return (
  <div ref={drag} style={{ opacity: isDragging ? 0.5 : 1 }}>
    {/* Card content */}
  </div>
);
```

**Step 2: Make Target Droppable:**
```tsx
import { useDrop } from 'react-dnd';

const [{ isOver, canDrop }, drop] = useDrop(() => ({
  accept: ['TRACK_CARD', 'COLLECTION_TRACK'],
  drop: (item: { track: IPTrack }) => {
    handleDroppedTrack(item.track);
  },
  collect: (monitor) => ({
    isOver: monitor.isOver(),
    canDrop: monitor.canDrop()
  })
}), []);

return (
  <div
    ref={drop}
    className={`
      ${isOver && canDrop ? 'bg-accent/20 border-accent' : ''}
    `}
  >
    {/* Drop target content */}
  </div>
);
```

---

### Modal Pattern

**Step 1: State Management:**
```tsx
const [isOpen, setIsOpen] = useState(false);
const [selectedTrack, setSelectedTrack] = useState<IPTrack | null>(null);

const openModal = (track: IPTrack) => {
  setSelectedTrack(track);
  setIsOpen(true);
};

const closeModal = () => {
  setIsOpen(false);
  setSelectedTrack(null);
};
```

**Step 2: Modal Component:**
```tsx
import { createPortal } from 'react-dom';

export default function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative z-10 bg-slate-900 rounded-lg max-w-md p-6">
        {children}
      </div>
    </div>,
    document.body
  ) : null;
}
```

---

### Loading States Pattern

**Button Loading:**
```tsx
<button
  onClick={handleSubmit}
  disabled={isLoading}
  className={`
    px-4 py-2 rounded
    ${isLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-accent hover:bg-accent/80'}
  `}
>
  {isLoading ? (
    <div className="flex items-center gap-2">
      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
      <span>Loading...</span>
    </div>
  ) : (
    'Submit'
  )}
</button>
```

**Page Loading:**
```tsx
{isLoading ? (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin w-12 h-12 border-4 border-accent border-t-transparent rounded-full" />
  </div>
) : (
  <div>{/* Page content */}</div>
)}
```

---

## Key Takeaways

### Component Inventory Summary

**22 shadcn/ui primitives:** button, input, select, dialog, dropdown-menu, toast, accordion, tabs, popover, checkbox, radio-group, switch, slider, progress, badge, card, label, separator, scroll-area, tooltip, command, avatar

**Core Components:**
- CompactTrackCardWithFlip (160px track cards)
- TrackDetailsModal (comprehensive track info)
- IPTrackModal (upload interface)
- SimplifiedMixer (professional DJ interface)
- Crate (persistent collection)
- Header (navigation + cart)

**Utility Components:**
- SafeImage (graceful image loading)
- InfoIcon (consistent info buttons)
- TrackCoverUploader (dedicated image upload)

**Design Tokens:**
- Purple (#9772F4): Loops, mixer, vocals
- Gold (#FFE4B5): Songs, EPs, instrumentals
- Cyan (#81E4F2): Accent, interactive elements
- Navy (#101726): Background

**Performance:**
- Image optimization via getOptimizedTrackImage
- 20-second audio previews
- Proper cleanup on unmount
- Parallel loading strategies

**Accessibility:**
- Keyboard support (ESC, Tab navigation)
- ARIA labels on interactive elements
- Focus management in modals
- Screen reader compatibility

---

## Related Skills

- **mixmi-user-flows.md** - Step-by-step user journeys using these components
- **mixmi-upload-system.md** - Deep dive into upload components and flow
- **mixmi-payment-flow.md** - Shopping cart and payment components
- **mixmi-database-schema.md** - Data structures that power these components

---

**End of Component Library Reference**
