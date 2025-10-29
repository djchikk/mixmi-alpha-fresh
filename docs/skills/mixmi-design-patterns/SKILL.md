---
name: mixmi-design-patterns
description: Comprehensive playbook for extending the mixmi platform with new content types, features, and UI components while maintaining visual consistency and architectural patterns
metadata:
  status: Active
  implementation: Alpha
  last_updated: 2025-10-26
---

# mixmi Alpha - Design Patterns & Extension Guide

> Comprehensive playbook for extending the platform with new content types, features, and UI components while maintaining visual consistency and architectural patterns

## Overview

This document serves as the **design system playbook** for extending mixmi Alpha. It captures the patterns, principles, and conventions that make the platform cohesive and scalable.

**Use this guide when:**
- Adding new content types (radio stations, videos, playlists, events)
- Designing new card components
- Creating new user flows
- Extending database schema
- Building new modals or UI elements

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

## Draggable Pattern

### Drag-and-Drop Architecture

**Draggable Items:**
```typescript
// What can be dragged
'loop'      → Mixer channels
'loop_pack' → Crate, Mixer (auto-unpacks)
'song'      → Crate only
'ep'        → Crate only
'mix'       → Crate, Mixer (Gen 1+)
```

**Drop Targets:**
```typescript
// Where things can be dropped
'mixer'     // Accepts: loops, mixes
'crate'     // Accepts: all content types
'playlist'  // Accepts: all content types (future)
'calendar'  // Accepts: events (future)
```

**Implementation Pattern:**
```tsx
const DraggableCard = ({ content, size }) => {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('content/type', content.content_type);
    e.dataTransfer.setData('content/id', content.id);
    
    // Visual feedback
    e.currentTarget.classList.add('opacity-50');
  };
  
  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('opacity-50');
  };
  
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className="cursor-move"
    >
      {/* Card content */}
    </div>
  );
};
```

## Modal Patterns

### Modal Types & Sizes

**Track Details Modal (320px)**
```tsx
<Modal maxWidth="320px">
  <TrackDetailsModal
    track={track}
    showIPSplits
    showDraggable
  />
</Modal>
```

**Upload Modal (480px)**
```tsx
<Modal maxWidth="480px">
  <UploadModal
    contentType={selectedType}
    onUploadComplete={handleComplete}
  />
</Modal>
```

**Video Player Modal (90vw)**
```tsx
<Modal maxWidth="90vw">
  <VideoPlayer
    video={video}
    autoPlay
    showComments
  />
</Modal>
```

### Modal Sizing Guidelines

```typescript
// Standard modals
max-w-[320px]  // Mobile/track details

// Wide modals
max-w-[480px]  // Upload forms, video players

// Full-width modals
max-w-[90vw]   // Image galleries, event details
```

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

## Related Skills

- **mixmi-component-library** - Component reference and implementation details
- **mixmi-mixer-architecture** - Technical architecture for audio features
- **mixmi-user-flows** - User journey patterns and workflows
- **mixmi-database-schema** - Database structure and types