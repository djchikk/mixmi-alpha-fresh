# Mixmi App Architecture Context

You are working on **Mixmi**, a professional music creation platform with blockchain-based IP attribution. Load full context from these key files:

## Core Architecture Documents
Read these files to understand the complete system:
- `/docs/CLAUDE.md` - Complete project overview with October 2025 achievements
- `/docs/REMIX-SYSTEM-AUTHORITATIVE.md` - **AUTHORITATIVE** remix IP and payment guide (Oct 2025)
- `/docs/INFINITE-REMIX-ARCHITECTURE-PROMPT.md` - Original remix planning context (historical)

## Current System Status (Auto-Updated)

**Branch**: `main` (auto-deploys to production on push)

## Pages & Routes

**Main Pages:**
- **`/` (Globe Page)** - 3D globe with track discovery
  - Tiny Mixer: Open on load, quick mixing (no recording), sync + loop length controls, no FX
  - Other widgets: Hidden until launched from right-side Widget Launcher buttons
  - Search: Persistent across pages, results draggable to mixer/crate or clickable to add to cart
- **`/mixer`** - Full-screen Big Mixer with FX, keyboard commands, recording capability
- **`/store/[username]`** - Creator stores (edit mode when authenticated)
- **`/profile/[username]`** - User profiles (edit mode when authenticated)
- **`/welcome`** - Alpha welcome/landing page

**Persistent UI (All Pages):**
- **Header** - Navigation + shopping cart (top)
- **Crate** - Content collection bar (bottom, context-aware)
- **Search** - Global search persisting across navigation

## User Flows

**Globe Discovery → Quick Mix Flow:**
```
Hover globe node → Card appears →
  → Drag loop to Tiny Mixer deck →
  → Sync & adjust loop length →
  → Quick mix (no recording)
```

**Globe → Full Production Flow:**
```
Hover globe node → Card appears →
  → Click info icon → Track metadata modal →
  → Drag to Crate (staging) →
  → Navigate to /mixer →
  → Drag from Crate to Big Mixer decks →
  → Mix with FX + keyboard shortcuts →
  → Record remix with IP attribution
```

**Search → Mix/Cart Flow:**
```
Search for content →
  → Click result → Add to cart
  OR
  → Drag result → Mixer deck / Crate
```

**Loop Pack/EP Unpacking:**
```
Globe card (loop pack/EP) →
  → Chevron to unfold individual tracks →
  → Drag individual track to mixer/crate

Crate: Loop packs/EPs unpack horizontally
Playlist: Loop packs/EPs auto-unpack on drop
```

## Key Components & Behaviors

**Tiny Mixer (Globe Page):**
- Location: Floating on globe page, open on load
- Features: Dual decks, sync, loop length controls
- Limitations: No FX, no recording (quick mixing only)
- Content Filter: **8-bar loops only** (rejects songs, packs, EPs)

**Big Mixer (/mixer Page):**
- Features: Full FX, recording, keyboard commands
- Content Filter: **8-bar loops only**
- Workflow: Professional production environment

**Widget System:**
- Tiny Mixer: Open on page load
- Playlist Widget: Hidden until launched
- Radio Widget: Hidden until launched
- Widget Launcher: Right-side buttons control visibility

**Crate (Persistent Bottom Bar):**
- Context-aware behavior per page
- Loop packs/EPs: Unpack horizontally (chevron button)
- Individual tracks: 64px thumbnails, draggable
- Cart integration: Add to cart from hover overlay

**Globe Track Cards (and All Content Cards):**
- Trigger: Hover over globe nodes
- Draggable to: Mixer decks, Crate, Playlist
- Shopping cart icon: Click to add to cart (all cards)
- Track name link: Click → Navigate to Creator store where track lives
- Artist name link: Click → Navigate to artist profile page
- Info icon: Opens TrackDetailsModal with full metadata
- Loop packs/EPs: Chevron unfolds individual tracks
- Individual tracks: Draggable from unfolded view

**Playlist Widget:**
- Auto-unpacks: Loop packs/EPs automatically expand
- Draggable out: To Crate or Mixer decks
- Reorderable: Internal drag-to-reorder

**Search (Global):**
- Persists across all pages
- Results clickable: Add to cart
- Results draggable: To mixer decks or Crate

**User Profiles & Creator Stores:**
- View mode: Public browsing
- Edit mode: When user authenticated and viewing own profile/store
- Full CRUD: Content management when authenticated

**Artist Profile Page (Extensive Features):**
- Auto-created: When alpha user uploads with invite code
  - Placeholder profile: Uses uploaded content image + artist name
  - Editable later by user
- Profile sections (show/hide controls):
  - **Shop Section**: ShopCards (one hardwired to Creator store link)
  - **Gallery**: Image-focused display
  - **Spotlighting**: Link cards to anywhere
  - **Media Embeds**: Embedded content support
  - **Rotating Sticker**: User-chosen animated sticker at bottom

**Creator Store (Auto-Setup):**
- Auto-created: When user uploads content
- Store name: Pulled from artist profile
- Content: Automatically displays all uploaded tracks
- Edit mode: Full content management when authenticated

## Content Type Handling

**8-Bar Loops (Primary Content):**
- Accepted by: Both mixers, Crate, Playlist
- Display: Purple border (#9772F4)
- Behavior: Direct drag to mixer decks

**Loop Packs (Collections of Loops):**
- Display: Thick purple border (4px)
- Unfold: Chevron reveals individual 8-bar loops
- Crate: Horizontal unpacking
- Playlist: Auto-unpack on drop
- Individual loops: Draggable to mixers

**Songs (Full Tracks):**
- Display: Gold border (#FFE4B5)
- Mixers: **Rejected** (loops only)
- Crate: Accepted for staging
- Preview: 20-second limit

**EPs (Song Collections):**
- Display: Thick gold border (4px)
- Unfold: Chevron reveals individual songs
- Crate: Horizontal unpacking
- Playlist: Auto-unpack on drop
- Individual songs: 20-second previews

**Recent Major Features:**
- ✅ Playlist drag & drop (bidirectional, fully functional)
- ✅ Null Island clustering for locationless tracks
- ✅ Mixer stability overhaul (Oct 23, 2025)
- ✅ Gen 1 remix IP splits (Oct 15, 2025)
- ✅ Mainnet payment splitter live (Oct 7, 2025)

## Architecture Principles

**Multi-Context System:**
- Each page has different behavior (globe vs mixer vs store)
- Components are context-aware (Crate changes per page)
- State management via React Context (MixerContext, CartContext, AuthContext)

**Drag & Drop Ecosystem:**
- Type system: `'COLLECTION_TRACK'`, `'TRACK_CARD'`, `'DECK_TRACK'`
- Universal accept/drop patterns across components
- Smart content filtering (loops to mixer, all to crate)

**Persistence Strategy:**
- localStorage for UI state (widget visibility, collapsed states)
- Supabase for content and user data
- Hybrid approach for performance + reliability

**Audio Architecture:**
- Multiple audio sources coordinate via events
- Cleanup on unmount prevents memory leaks
- Preview system (20 seconds for songs, full for loops)

## Development Guidelines

When working on this codebase:
1. **Always check context** - Components behave differently per page
2. **Maintain drag types** - Use established drag/drop patterns
3. **Preserve persistence** - Include localStorage for UI state
4. **Clean up audio** - Prevent memory leaks in audio components
5. **Test cross-page** - Features should work across navigation

## Blockchain Context

**Smart Contracts (Stacks/Clarity):**
- Payment splitter: `music-payment-splitter-v3` (live on mainnet)
- IP attribution with composition/production splits
- Gen 1 remix formula: Each loop contributes 50% to remix
- Remixer gets 20% commission on downstream sales

**Planned Migration:**
- Current: Stacks blockchain
- Future: Considering other blockchain options
- Need to maintain: IP attribution, payment splitting, remix genealogy

## Quick Reference Commands

Use these for specific contexts:
- `/plan` - Strategic planning mode (blockchain, features, architecture)
- `/quick` - Quick context loading (basics only)

**You now have full architecture context. Ask clarifying questions before starting work.**
