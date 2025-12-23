# mixmi Alpha - Design Patterns & Extension Guide

**Skill Purpose:** Comprehensive playbook for extending the platform with new content types, features, and UI components while maintaining visual consistency and architectural patterns

**Last Updated:** October 26, 2025

---

## Overview

This document serves as the **design system playbook** for extending mixmi Alpha. It captures the patterns, principles, and conventions that make the platform cohesive and scalable.

**Use this guide when:**
- Adding new content types (radio stations, videos, playlists, events)
- Designing new card components
- Creating new user flows
- Extending database schema
- Building new modals or UI elements

---

## Content Type Taxonomy

### Current Content Types

**Music Content:**
```typescript
'loop'       // 8-bar loops (remixable)
'loop_pack'  // Collections of 2-5 loops
'full_song'  // Complete songs (download only)
'ep'         // Collections of 2-10 songs
'mix'        // Recorded remixes (Gen 1+)
```

**User Content:**
```typescript
'profile'    // User profiles
'store'      // Creator stores (collections of tracks)
```

### Content Type Hierarchy

```
Music Content
├── Remixable (can be loaded to mixer)
│   ├── loop (single 8-bar loop)
│   └── mix (recorded remix, Gen 1+)
│
├── Multi-track Collections
│   ├── loop_pack (2-5 loops)
│   └── ep (2-10 songs)
│
└── Download-only
    └── full_song (complete song)

User Content
├── profile (artist/creator page)
└── store (curated content collection)
```

---

## Card Size Hierarchy

### The Three Card Sizes

**64px - Compact (Crate View)**
- **Purpose:** Dense collections, horizontal scrolling
- **Context:** Crate component, playlist thumbnails
- **Information:** Cover image + minimal metadata on hover
- **Expansion:** Horizontal slide-out for packs/EPs

**160px - Standard (Primary UI)**
- **Purpose:** Main browsing interface
- **Context:** Globe, Store, Search results
- **Information:** Cover + full hover overlay with metadata
- **Expansion:** Vertical dropdown for packs/EPs

**320px - Detail (Modal View)**
- **Purpose:** Comprehensive information display
- **Context:** TrackDetailsModal, expanded views
- **Information:** Full metadata, IP splits, draggable tracks
- **Expansion:** No expansion (full detail already shown)

### Card Size Decision Matrix

```
Content Density
  Low  ────────────────────────────────────  High
   │                                           │
 320px                160px                  64px
   │                    │                      │
Detail View        Standard View         Compact View
   │                    │                      │
Modals              Browse/Shop             Crate
```

---

## Color Symbolism System

### Current Color Meanings

**Purple (#9772F4) - "Remixable"**
- **Applies to:** Loops, loop packs, mixes
- **Meaning:** Content that can be loaded to mixer
- **Usage:** Card borders, badges, mixer theme
- **Variants:**
  - Standard: `#9772F4`
  - Light (badges): `#C4AEF8`
  - Dark (hover): `#7B5FD3`

**Gold (#FFE4B5) - "Complete/Download"**
- **Applies to:** Songs, EPs
- **Meaning:** Finished content, download-only
- **Usage:** Card borders, badges
- **Variants:**
  - Standard: `#FFE4B5`
  - No variants (sufficient contrast)

**Cyan (#81E4F2) - "Interactive/Accent"**
- **Applies to:** Buttons, links, purchase actions
- **Meaning:** User action, interactive element
- **Usage:** Call-to-action buttons, sync indicators
- **Variants:**
  - Standard: `#81E4F2`
  - Hover: `#6BC8D6`

### Future Color Extensions

**When to add new colors:**
- New fundamental content category (not subcategory)
- Distinct user interaction type
- New platform feature area (e.g., live streaming)

**Proposed colors for future content types:**

```typescript
// Radio/Streaming (live content)
teal: '#14B8A6'       // Teal for real-time/live
meaning: "Streaming/Live"

// Video (visual content)
pink: '#F472B6'       // Pink for video/visual
meaning: "Video/Visual"

// Events (time-based)
amber: '#F59E0B'      // Amber for events/concerts
meaning: "Event/Scheduled"

// Playlists (curated collections)
indigo: '#6366F1'     // Indigo for curation
meaning: "Curated/Playlist"
```

**Color Assignment Checklist:**
1. Does this represent a fundamentally new content category?
2. Does the color contrast well with existing palette?
3. Does it work on dark background (#101726)?
4. Does it have semantic meaning (e.g., teal = water/flow = streaming)?
5. Is there a lighter variant for badges/accents?

---

## Border Patterns

### Border Thickness System

**2px - Single Item**
- **Applies to:** Individual loops, songs
- **Meaning:** Standalone content
- **Class:** `border-2`

**4px - Collection**
- **Applies to:** Loop packs, EPs
- **Meaning:** Contains multiple tracks
- **Class:** `border-4`

**Future:**
```typescript
// 6px - Featured/Premium
border-6  // Featured content, premium tier

// 8px - Live/Active
border-8  // Currently streaming, active event
```

### Border Style Patterns

**Solid - Standard Content**
```css
border-2 border-[#9772F4]  /* Loop */
border-4 border-[#FFE4B5]  /* EP */
```

**Dashed - Planned/Upcoming**
```css
border-2 border-dashed border-[#F59E0B]  /* Upcoming event */
```

**Gradient - Special Status**
```css
border-2 bg-gradient-to-r from-[#9772F4] to-[#81E4F2]  /* Featured mix */
```

---

## Badge Conventions

### Badge Types & Positioning

**Number Badges (Track Position)**
- **Position:** Top-left corner
- **Size:** 24px × 24px (160px cards), 20px × 20px (64px cards)
- **Color:** Content type color (purple for loops, gold for songs)
- **Text:** White or black (based on background contrast)
- **Usage:** Individual tracks in packs/EPs

**Metadata Badges (BPM, Duration)**
- **Position:** Bottom-right corner (hover overlay)
- **Size:** Auto-width, 20px height
- **Font:** Monospace, bold
- **Color:** White text on transparent
- **Usage:** Technical metadata display

**Status Badges (Generation, Type)**
- **Position:** Bottom-center (hover overlay)
- **Size:** Auto-width, 20px height
- **Font:** Monospace, medium weight
- **Usage:** Content type, generation indicators

**Icon Badges (Price, Mixer)**
- **Position:** Bottom-left corner (hover overlay)
- **Size:** Auto-width, 28px height for buttons
- **Color:** Cyan background (#81E4F2) for prices
- **Usage:** Purchase buttons, mixer-only indicators

### Badge Hierarchy (Priority Order)

```
1. Track Number (top-left)     - Highest priority (pack navigation)
2. Price/Action (bottom-left)  - User action (purchase/remix)
3. Type (bottom-center)        - Content classification
4. BPM (bottom-right)          - Technical metadata
```

---

## Expansion Patterns

### Vertical Expansion (Globe/Store Context)

**When to use:**
- Standard 160px cards
- Browsing/discovery context
- Desktop/laptop screens

**Implementation:**
```tsx
{/* Trigger: Chevron button on right side */}
<ChevronDown
  className="absolute right-1 top-1/2 -translate-y-1/2"
  onClick={() => setIsExpanded(true)}
/>

{/* Expansion: Dropdown drawer below card */}
{isExpanded && (
  <div
    className="w-[160px] bg-slate-900 border-2 border-t-0 rounded-b-lg"
    style={{ animation: 'slideDown 0.2s ease-out' }}
  >
    {/* Individual track rows (28px each) */}
    {tracks.map((track, i) => (
      <DraggableTrack key={track.id}>
        <div className="flex items-center gap-2 px-2 py-1 h-[28px]">
          <NumberBadge>{i + 1}</NumberBadge>
          <MetadataBadge>{track.bpm} BPM</MetadataBadge>
          <PlayButton />
        </div>
      </DraggableTrack>
    ))}
  </div>
)}
```

### Horizontal Expansion (Crate Context)

**When to use:**
- Compact 64px cards
- Horizontal scroll areas
- Space-constrained contexts

**Implementation:**
```tsx
{/* Trigger: Chevron button on right edge */}
<ChevronRight
  className="absolute right-0 top-1/2 -translate-y-1/2"
  onClick={() => setIsExpanded(true)}
/>

{/* Expansion: Slide-out to right */}
{isExpanded && (
  <div
    className="ml-2 flex gap-1"
    style={{ animation: 'slideInRight 0.2s ease-out' }}
  >
    {/* Individual track cards (64px each) */}
    {tracks.map((track, i) => (
      <DraggableTrack key={track.id}>
        <div className="w-16 h-16 relative">
          <NumberBadge>{i + 1}</NumberBadge>
          <CoverImage src={track.cover_image_url} />
          <PlayButton size="sm" />
        </div>
      </DraggableTrack>
    ))}
  </div>
)}
```

### Expansion Decision Matrix

```
Context:        Globe/Store         Crate
Card Size:      160px               64px
Direction:      Vertical ↓          Horizontal →
Animation:      slideDown           slideInRight
Track Size:     28px rows           64px cards
Trigger:        Chevron (right)     Chevron (right)
```

---

## Icon Positioning Rules

### Standard Icon Positions (160px Cards)

**Hover Overlay Icons:**

```
┌─────────────────────────┐
│ [Track#]         [Del]  │ ← Top corners
│                         │
│  [Info]          [▼]    │ ← Vertical center
│                         │
│                         │
│         [Play]          │ ← Absolute center
│                         │
│                         │
│ [Price] [Type]   [BPM]  │ ← Bottom edge
└─────────────────────────┘
```

**Position Coordinates:**
```typescript
// Top-left: Track number (static, no hover)
top: 4px, left: 4px

// Top-right: Delete button (edit mode only)
top: 4px, right: 4px

// Left-center: Info icon (hover only)
top: 50%, left: 4px, transform: translateY(-50%)

// Right-center: Chevron (packs/EPs, hover only)
top: 50%, right: 4px, transform: translateY(-50%)

// Absolute center: Play button (hover only)
top: 50%, left: 50%, transform: translate(-50%, -50%)

// Bottom-left: Price/action button (hover only)
bottom: 8px, left: 8px

// Bottom-center: Content type badge (hover only)
bottom: 8px, left: 50%, transform: translateX(-50%)

// Bottom-right: BPM badge (hover only)
bottom: 8px, right: 8px
```

### Icon Size Scaling

```typescript
// 64px cards (Crate)
InfoIcon:     12px (w-3 h-3)
PlayButton:   12px (w-3 h-3)
NumberBadge:  16px (w-4 h-4)

// 160px cards (Standard)
InfoIcon:     24px (w-6 h-6)
PlayButton:   40px (w-10 h-10)
NumberBadge:  24px (w-6 h-6)

// 320px cards (Modal)
InfoIcon:     32px (w-8 h-8)
PlayButton:   48px (w-12 h-12)
NumberBadge:  32px (w-8 h-8)
```

---

## Generation Indicators

### Current System (Remix Genealogy)

**Emoji-based Visual Hierarchy:**
```typescript
remix_depth === 0 → '🌱'  // Seed (original)
remix_depth === 1 → '🌿'  // Sprout (Gen 1)
remix_depth === 2 → '🌳'  // Tree (Gen 2)
remix_depth >= 3 → '🌳'  // Tree (Gen 3+)
```

**Usage Pattern:**
```tsx
{/* Content type badge with generation */}
<span className="text-xs font-mono text-white">
  {remix_depth === 0 && '🌱 LOOP'}
  {remix_depth === 1 && '🌿 LOOP'}
  {remix_depth === 2 && '🌳 LOOP'}
  {remix_depth === 0 && content_type === 'mix' && '🌿 MIX'}
</span>
```

**Rules:**
- Only show for loops and mixes (not songs/EPs)
- Generation 0 = seed emoji
- Generation 1+ = growth progression
- Mixes always start at Gen 1 minimum (never Gen 0)

### Future Extensions

**Collaborative Genealogy:**
```typescript
// Multiple source loops with different generations
mix_sources: [
  { id: 'abc', remix_depth: 0 },  // 🌱
  { id: 'def', remix_depth: 1 }   // 🌿
]
// Result: Mix inherits highest generation + 1
mix.remix_depth = 2  // 🌳
```

**Heritage Pools (Future Gen 2+ Payment):**
```typescript
// Visual indicator for heritage pool complexity
heritage_pool_size === 'simple' → '💧'   // Few contributors
heritage_pool_size === 'medium' → '🌊'   // Many contributors
heritage_pool_size === 'complex' → '🌀'  // Very complex attribution
```

---

## Drag-and-Drop Behavior Patterns

### Content Type Drag Rules

**Loop (single):**
```typescript
draggable_to: ['crate', 'mixer_deck_a', 'mixer_deck_b']
restrictions: none
```

**Loop Pack:**
```typescript
draggable_to: ['crate']  // Not mixer (must expand first)
restrictions: 'Must expand to drag individual loops'
error_message: 'Loop packs must be expanded first. Hover and click chevron.'
```

**Song / EP:**
```typescript
draggable_to: ['crate']  // Not mixer (download-only)
restrictions: 'No mixer support'
error_message: 'Songs cannot be loaded to mixer. Add to Crate for purchase.'
```

**Mix (recorded):**
```typescript
draggable_to: ['crate']  // Not mixer (final output)
restrictions: 'No re-mixing'
error_message: 'Mixes cannot be loaded to mixer. Download or add to Crate.'
```

### Future Content Type Drag Behaviors

**Radio Station:**
```typescript
draggable_to: ['radio_widget', 'favorites']
restrictions: 'Must be live'
content_type: 'radio_station'
color: '#14B8A6'  // Teal
```

**Video:**
```typescript
draggable_to: ['video_player', 'playlist']
restrictions: none
content_type: 'video'
color: '#F472B6'  // Pink
```

**Playlist:**
```typescript
draggable_to: ['radio_widget', 'favorites']
restrictions: none
content_type: 'playlist'
color: '#6366F1'  // Indigo
```

**Event:**
```typescript
draggable_to: ['calendar', 'favorites']
restrictions: 'Must have valid date'
content_type: 'event'
color: '#F59E0B'  // Amber
```

---

## Modal Structure Patterns

### Standard Modal Layout

**Fixed Structure (all modals):**
```tsx
<div className="modal-container fixed inset-0 z-50 flex items-center justify-center">
  {/* Backdrop */}
  <div
    className="absolute inset-0 bg-black/70 backdrop-blur-sm"
    onClick={onClose}
  />

  {/* Modal content */}
  <div className="relative z-10 bg-slate-900 rounded-lg max-w-[320px] max-h-[70vh]">
    {/* Header */}
    <div className="bg-slate-800 px-6 py-4 border-b border-gray-700 flex justify-between">
      <h2 className="text-white text-sm font-bold tracking-wider">
        {title}
      </h2>
      <button onClick={onClose}>✕</button>
    </div>

    {/* Scrollable content */}
    <div className="overflow-y-auto max-h-[calc(70vh-120px)] p-6">
      {children}
    </div>
  </div>
</div>
```

**Section Divider Pattern:**
```tsx
const Divider = ({ title }: { title: string }) => (
  <div className="mb-3">
    <div className="text-gray-400 text-xs font-bold tracking-wider mb-1">
      {title}
    </div>
    <div className="border-b border-gray-700">
      <div className="h-px bg-gradient-to-r from-gray-600 to-transparent" />
    </div>
  </div>
);

// Usage
<Divider title="BASIC INFO" />
<Divider title="IP RIGHTS" />
<Divider title="METADATA" />
```

**Information Display Pattern:**
```tsx
{/* Label-value pairs */}
<div className="space-y-1 text-xs">
  <div className="flex">
    <span className="text-gray-500 w-24">Title:</span>
    <span className="text-gray-300">{track.title}</span>
  </div>
  <div className="flex">
    <span className="text-gray-500 w-24">Artist:</span>
    <span className="text-gray-300">{track.artist}</span>
  </div>
</div>
```

---

## Extension Checklist for New Content Types

### Template: Adding "Radio Station" Content Type

**Step 1: Define Content Type**
```typescript
// types/index.ts
export interface RadioStation {
  id: string;
  title: string;
  host: string;                  // Radio host/DJ
  description: string;
  cover_image_url: string;
  stream_url: string;            // Live stream URL
  schedule?: string;             // Broadcasting schedule
  genre_tags: string[];
  listener_count?: number;       // Current listeners
  is_live: boolean;              // Currently broadcasting
  content_type: 'radio_station';
  primary_uploader_wallet: string;
  created_at: string;
  updated_at: string;
}
```

**Step 2: Choose Visual Identity**
```typescript
// Color: Teal (#14B8A6) - represents streaming/flow
border_color: '#14B8A6'
badge_color: '#14B8A6'
border_thickness: 2  // Single item (not collection)
```

**Step 3: Design 160px Card**
```tsx
<div className="w-[160px] h-[160px] rounded-lg border-2 border-[#14B8A6]">
  {/* Cover image */}
  <SafeImage src={station.cover_image_url} alt={station.title} />

  {/* Hover overlay */}
  <div className="hover-overlay">
    {/* Top: Title + Host */}
    <div className="absolute top-1 left-2 right-2">
      <div className="text-white text-sm truncate">{station.title}</div>
      <div className="text-gray-300 text-xs truncate">{station.host}</div>
    </div>

    {/* Center: Play/Listen button */}
    <button className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      {is_live ? <PlayIcon /> : <OfflineIcon />}
    </button>

    {/* Bottom: Live indicator + Listeners + Genre */}
    <div className="absolute bottom-2 left-2 right-2 flex justify-between">
      {/* Live badge */}
      {is_live && (
        <div className="bg-[#14B8A6] text-white px-2 py-0.5 rounded text-xs flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          LIVE
        </div>
      )}

      {/* Genre badge */}
      <span className="text-xs font-mono text-white">
        {genre_tags[0]?.toUpperCase()}
      </span>

      {/* Listener count */}
      {listener_count && (
        <span className="text-xs text-white">
          👥 {listener_count}
        </span>
      )}
    </div>
  </div>
</div>
```

**Step 4: Define Drag-and-Drop Behavior**
```typescript
// Can be dragged to:
draggable_to: ['radio_widget', 'favorites']

// Cannot be dragged to:
not_draggable_to: ['mixer', 'crate']

// Drag item structure
const dragItem = {
  type: 'RADIO_STATION',
  station: {
    id: station.id,
    title: station.title,
    stream_url: station.stream_url,
    is_live: station.is_live
  }
};

// Drop validation
const canDrop = (item: DragItem) => {
  if (item.type !== 'RADIO_STATION') return false;
  if (!item.station.is_live) {
    showToast('Station is offline', 'error');
    return false;
  }
  return true;
};
```

**Step 5: Create Modal View**
```tsx
<RadioStationModal station={station} isOpen={isOpen} onClose={onClose}>
  <Divider title="STATION INFO" />
  <div className="space-y-1 text-xs">
    <div className="flex">
      <span className="text-gray-500 w-24">Host:</span>
      <span className="text-gray-300">{station.host}</span>
    </div>
    <div className="flex">
      <span className="text-gray-500 w-24">Status:</span>
      <span className={station.is_live ? 'text-green-400' : 'text-gray-500'}>
        {station.is_live ? '🟢 Live' : '⚫ Offline'}
      </span>
    </div>
  </div>

  <Divider title="SCHEDULE" />
  <div className="text-xs text-gray-300">{station.schedule}</div>

  <Divider title="DESCRIPTION" />
  <div className="text-xs text-gray-300">{station.description}</div>

  {/* Listen button */}
  {station.is_live && (
    <button
      onClick={() => playRadioStation(station.stream_url)}
      className="w-full mt-4 px-4 py-2 bg-[#14B8A6] text-white rounded"
    >
      🎧 Listen Live
    </button>
  )}
</RadioStationModal>
```

**Step 6: Update Database Schema**
```sql
-- Create radio_stations table
CREATE TABLE radio_stations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR NOT NULL,
  host VARCHAR NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  stream_url TEXT NOT NULL,
  schedule TEXT,
  genre_tags TEXT[],
  listener_count INTEGER DEFAULT 0,
  is_live BOOLEAN DEFAULT false,
  content_type VARCHAR DEFAULT 'radio_station',
  primary_uploader_wallet VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_radio_stations_is_live ON radio_stations(is_live);
CREATE INDEX idx_radio_stations_host ON radio_stations(primary_uploader_wallet);
```

**Step 7: Add to TypeScript Types**
```typescript
// types/index.ts
export type ContentType =
  | 'loop'
  | 'loop_pack'
  | 'full_song'
  | 'ep'
  | 'mix'
  | 'radio_station';  // ← Add new type

export interface RadioStation {
  // ... (from Step 1)
}

// Union type for all content
export type Content = IPTrack | RadioStation;
```

**Step 8: Integration Points**
```typescript
// Search: Add to search filters
<Select>
  <SelectItem value="all">All Content</SelectItem>
  <SelectItem value="loops">Loops</SelectItem>
  <SelectItem value="songs">Songs</SelectItem>
  <SelectItem value="radio">Radio Stations</SelectItem>  {/* ← New */}
</Select>

// Globe: Add to clustering system
const getContentColor = (content: Content) => {
  if (content.content_type === 'radio_station') {
    return '#14B8A6';  // Teal for radio
  }
  // ... existing logic
};

// Store: Add to content grid
{stations.map(station => (
  <RadioStationCard key={station.id} station={station} />
))}
```

---

## Pricing Display Patterns

### Current Pricing Logic

**Songs/EPs (Always Download Price):**
```typescript
if (content_type === 'full_song' || content_type === 'ep') {
  return (
    <PriceButton>
      {download_price_stx || 'Free'}
    </PriceButton>
  );
}
```

**Loops/Packs (Download or Remix):**
```typescript
// Priority 1: Check allow_downloads flag
if (allow_downloads === false) {
  return <MixerBadge>M</MixerBadge>;  // Remix-only
}

// Priority 2: Check download_price_stx
if (download_price_stx !== null) {
  return <PriceButton>{download_price_stx}</PriceButton>;
}

// Fallback: Remix-only
return <MixerBadge>M</MixerBadge>;
```

**Mixes (Always Remix-only for MVP):**
```typescript
if (content_type === 'mix') {
  return <MixerBadge>M</MixerBadge>;
}
```

### Future Pricing Extensions

**Subscription Content (Radio, Playlists):**
```typescript
// Monthly subscription indicator
if (requires_subscription) {
  return (
    <SubscriptionBadge>
      💎 Premium
    </SubscriptionBadge>
  );
}

// Freemium with ads
if (has_ads && !user.is_premium) {
  return (
    <FreeBadge>
      Free (ads)
    </FreeBadge>
  );
}
```

**Event Tickets:**
```typescript
// Ticket price for live events
if (content_type === 'event') {
  return (
    <TicketButton>
      🎟️ {ticket_price_stx} STX
    </TicketButton>
  );
}
```

**Pay-What-You-Want:**
```typescript
// Flexible pricing
if (pricing_model === 'flexible') {
  return (
    <FlexiblePriceButton>
      Name Your Price (min {min_price_stx} STX)
    </FlexiblePriceButton>
  );
}
```

---

## Responsive Design Patterns

### Card Grid Responsive Breakpoints

**Standard Grid:**
```tsx
<div className="
  grid
  grid-cols-2      {/* Mobile: 2 columns */}
  sm:grid-cols-3   {/* Tablet: 3 columns */}
  md:grid-cols-4   {/* Small laptop: 4 columns */}
  lg:grid-cols-5   {/* Laptop: 5 columns */}
  xl:grid-cols-6   {/* Desktop: 6 columns */}
  gap-4
">
```

**Content-Specific Grids:**
```typescript
// Radio stations (larger cards)
grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4

// Videos (16:9 aspect ratio)
grid-cols-1 sm:grid-cols-2 lg:grid-cols-3

// Events (timeline layout)
flex flex-col gap-4  // No grid, vertical timeline
```

### Modal Responsive Widths

```typescript
// Standard modals
max-w-[320px]  // Mobile/track details

// Wide modals
max-w-[480px]  // Upload forms, video players

// Full-width modals
max-w-[90vw]   // Image galleries, event details
```

---

## Animation Standards

### Standard Transitions

**Hover States:**
```css
transition-all duration-300 hover:scale-105
```

**Button Presses:**
```css
active:scale-95 transition-transform
```

**Fade In (Overlays):**
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}
```

**Slide Down (Vertical Expansion):**
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

**Slide In Right (Horizontal Expansion):**
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

### Custom Animations for New Content

**Live Pulse (Radio/Streaming):**
```css
@keyframes livePulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.2);
  }
}

.live-indicator {
  animation: livePulse 2s ease-in-out infinite;
}
```

**Event Countdown (Upcoming Events):**
```css
@keyframes countdownFlash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.countdown-badge {
  animation: countdownFlash 1s ease-in-out infinite;
}
```

---

## Accessibility Patterns

### ARIA Labels for New Content

**Radio Stations:**
```tsx
<button
  aria-label={`${is_live ? 'Listen to' : 'View'} ${station.title} by ${station.host}`}
  aria-live={is_live ? 'polite' : undefined}
>
  {is_live ? <PlayIcon /> : <OfflineIcon />}
</button>
```

**Events:**
```tsx
<div
  role="article"
  aria-labelledby={`event-title-${event.id}`}
  aria-describedby={`event-time-${event.id}`}
>
  <h3 id={`event-title-${event.id}`}>{event.title}</h3>
  <time id={`event-time-${event.id}`}>{event.start_time}</time>
</div>
```

**Videos:**
```tsx
<video
  aria-label={video.title}
  aria-describedby={`video-description-${video.id}`}
  controls
>
  <track kind="captions" src={video.captions_url} />
</video>
```

---

## Content Type Extension Examples

### Example 1: Video Content

**Visual Identity:**
```typescript
content_type: 'video'
border_color: '#F472B6'  // Pink
border_thickness: 2
badge_emoji: '🎥'
```

**Card Layout (160px):**
```tsx
<div className="w-[160px] h-[160px] border-2 border-[#F472B6]">
  {/* Thumbnail with play overlay */}
  <div className="relative">
    <img src={video.thumbnail_url} alt={video.title} />
    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
      <PlayIcon className="w-12 h-12 text-white" />
    </div>

    {/* Duration badge */}
    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs text-white">
      {formatDuration(video.duration)}
    </div>
  </div>

  {/* Hover overlay */}
  <div className="hover-overlay">
    <div className="absolute top-1 left-2 right-2">
      <div className="text-white text-sm truncate">{video.title}</div>
      <div className="text-gray-300 text-xs truncate">{video.creator}</div>
    </div>

    <div className="absolute bottom-2 left-2 right-2 flex justify-between">
      <span className="text-xs text-white">🎥 VIDEO</span>
      <span className="text-xs text-white">👁️ {video.view_count}</span>
    </div>
  </div>
</div>
```

**Drag Behavior:**
```typescript
draggable_to: ['video_player', 'playlist', 'crate']
```

**Database Schema:**
```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY,
  title VARCHAR NOT NULL,
  creator VARCHAR NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  video_url TEXT NOT NULL,
  duration INTEGER,  -- Seconds
  view_count INTEGER DEFAULT 0,
  content_type VARCHAR DEFAULT 'video',
  primary_uploader_wallet VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### Example 2: Event/Concert

**Visual Identity:**
```typescript
content_type: 'event'
border_color: '#F59E0B'  // Amber
border_thickness: 2
badge_emoji: '🎪'
border_style: 'dashed' // Upcoming events
```

**Card Layout (160px):**
```tsx
<div className="w-[160px] h-[160px] border-2 border-dashed border-[#F59E0B]">
  <SafeImage src={event.poster_url} alt={event.title} />

  <div className="hover-overlay">
    {/* Event title + artist */}
    <div className="absolute top-1 left-2 right-2">
      <div className="text-white text-sm truncate">{event.title}</div>
      <div className="text-gray-300 text-xs truncate">{event.artist}</div>
    </div>

    {/* Countdown timer */}
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
      <div className="text-white text-lg font-bold">
        {formatCountdown(event.start_time)}
      </div>
      <div className="text-gray-300 text-xs">until event</div>
    </div>

    {/* Bottom: Date + Ticket price */}
    <div className="absolute bottom-2 left-2 right-2 flex justify-between">
      <button className="bg-[#F59E0B] text-black px-2 py-1 rounded text-xs font-bold">
        🎟️ {event.ticket_price_stx} STX
      </button>
      <span className="text-xs text-white">
        {formatDate(event.start_time)}
      </span>
    </div>
  </div>
</div>
```

**Drag Behavior:**
```typescript
draggable_to: ['calendar', 'favorites']
```

**Database Schema:**
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  title VARCHAR NOT NULL,
  artist VARCHAR NOT NULL,
  description TEXT,
  poster_url TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  venue VARCHAR,
  ticket_price_stx DECIMAL(10,2),
  ticket_url TEXT,
  stream_url TEXT,  -- For virtual events
  is_virtual BOOLEAN DEFAULT false,
  content_type VARCHAR DEFAULT 'event',
  primary_uploader_wallet VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Key Design Principles

### 1. Visual Consistency

**Every content type must have:**
- Defined color from semantic palette
- Border thickness (2px single, 4px collection)
- 160px standard card layout
- Hover overlay structure
- Badge positioning rules

### 2. Functional Clarity

**Users should instantly understand:**
- What type of content this is (color + badge)
- How they can interact with it (hover state)
- Where they can use it (drag-and-drop affordance)
- What it costs or requires (pricing badge)

### 3. Scalable Architecture

**New content types should:**
- Follow existing TypeScript interfaces
- Use established component patterns
- Integrate with drag-and-drop system
- Work across all three card sizes
- Have clear database schema

### 4. Accessibility First

**All new content must:**
- Have proper ARIA labels
- Support keyboard navigation
- Provide text alternatives for icons
- Maintain color contrast ratios
- Work with screen readers

---

## Related Skills

- **mixmi-component-library.md** - Component reference and implementation details
- **mixmi-mixer-architecture.md** - Technical architecture for audio features
- **mixmi-user-flows.md** - User journey patterns and workflows
- **mixmi-database-schema.md** - Database structure and types

---

**End of Design Patterns & Extension Guide**
