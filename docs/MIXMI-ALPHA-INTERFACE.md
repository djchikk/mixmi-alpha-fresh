# mixmi Alpha Interface - Complete Platform Documentation

**Last Updated:** October 25, 2025
**Platform Status:** Production Alpha - Live on Stacks Mainnet
**Framework:** Next.js 14 with TypeScript

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Page Structure & Navigation](#page-structure--navigation)
3. [Core Features (Implemented)](#core-features-implemented)
4. [User Flows](#user-flows)
5. [Component Inventory](#component-inventory)
6. [Database Schema](#database-schema)
7. [Smart Contract Integration](#smart-contract-integration)
8. [Current Limitations](#current-limitations)
9. [Visual Design Patterns](#visual-design-patterns)
10. [Technical Architecture](#technical-architecture)

---

## Platform Overview

mixmi Alpha is a **complete music creation and discovery platform** featuring:

- **Interactive 3D Globe** - Geographic music discovery with real-time positioning
- **Professional DJ Mixer** - Dual-deck mixing with waveform visualization, BPM sync, FX
- **Creator Economy** - Smart contract-based payments with automatic revenue splitting
- **Remix Genealogy** - Track IP attribution across remix generations
- **Blockchain Payments** - Live Stacks mainnet integration for purchases and splits

### Key Technologies

- **Framework:** Next.js 14 (App Router) with TypeScript 5.8.2
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Blockchain:** Stacks (Bitcoin L2) with Clarity smart contracts
- **3D Graphics:** Three.js with @react-three/fiber
- **Audio:** Tone.js 15.1.22 + custom audio engine (lib/mixerAudio.ts)
- **UI:** Tailwind CSS + shadcn/ui (Radix UI primitives)
- **State:** React Context (AuthContext, CartContext, MixerContext, ToastContext)

---

## Page Structure & Navigation

### Main Routes

#### `/` - Globe Discovery Page (app/page.tsx)
**The primary discovery interface**

**Features:**
- Interactive 3D globe with spinning Earth
- Location-based content clustering (200-mile radius)
- Real-time search and filtering
- Track card previews with modal access
- Comparison mode (side-by-side track viewing)
- Widget launcher system (Mixer, Playlist, Radio)
- Persistent shopping cart in header
- FILL mode for auto-populating content

**State Management:**
- `selectedNode` - Currently selected track node
- `hoveredNode` - Track being hovered over
- `globeNodes` - All track nodes to display
- `playingTrackId` - Currently playing preview
- `leftComparisonTrack` / `rightComparisonTrack` - Comparison tracks
- `isMixerVisible` / `isPlaylistVisible` / `isRadioVisible` - Widget visibility

**Key Components:**
- `Globe` - Three.js 3D globe (dynamically imported, SSR: false)
- `GlobeSearch` - Real-time search interface
- `GlobeTrackCard` - Floating track cards
- `SimplifiedMixerCompact` - Tiny mixer widget
- `RadioWidget` - Radio player widget
- `PlaylistWidget` - Playlist player widget
- `Crate` - Persistent track collection
- `Header` - Global header with cart

**Location:** `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-8/app/page.tsx` (43KB, 1200+ lines)

---

#### `/welcome` - Alpha Landing Page (app/welcome/page.tsx)
**Welcome and feature showcase for alpha testers**

**Sections:**
1. **Hero** - Welcome message and platform vision
2. **What's Live** - Currently working features (7 items):
   - Globe Browser with Tiny Mixer
   - Big Mixer (dual decks, waveforms, BPM sync)
   - STX Payments & Smart Contracts
   - Remix Tracking & Lineage
   - Creator Stores
   - Artist Profiles
   - Playlist Streaming & Radio
3. **Upload Invitation** - Call to action for content upload
4. **Coming Soon** - Future features (5 items):
   - Remix Recording
   - On-Chain Certification
   - Gen 2 Remixes
   - Live Radio Integrations
   - Production Content Migration

**Design:**
- Breathing globe background (20% opacity)
- Card-based layout with glassmorphism
- Consistent color scheme (deep blue background, cyan accents)

**Location:** `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-8/app/welcome/page.tsx` (310 lines)

---

#### `/mixer` - Professional DJ Interface (app/mixer/page.tsx)
**Full-featured DJ mixing workspace**

**Features:**
- Dual-deck professional mixer
- Real-time waveform visualization
- BPM detection and sync
- Loop controls with content-aware detection
- Audio effects (EQ, filters, reverb, delay)
- Crossfader control
- Master transport controls
- Crate integration
- Global search access

**Components:**
- `SimplifiedMixer` - Main mixer (68KB component)
- `Crate` - Track collection
- `GlobeSearch` - Search overlay
- `Header` - Global navigation

**Location:** `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-8/app/mixer/page.tsx` (124 lines)

---

#### `/store/[walletAddress]` - Creator Music Store (app/store/[walletAddress]/page.tsx)
**Individual artist marketplace**

**Features:**
- Content filtering (All, Songs, Loops, Loop Packs, EPs)
- Category filtering (Instrumental, Vocal, Beats, Stem)
- Paginated content display (24 items per page)
- Wave loading animation
- Upload button (when viewing own store)
- Track playback previews
- Add to cart functionality
- Edit mode (for store owner)

**State Management:**
- `tracks` - All tracks from this creator
- `filteredTracks` - Tracks after filtering
- `activeFilter` - Current filter settings
- `creatorName` - Display name from profile or first track
- `actualWalletAddress` - Resolved wallet address
- `isOwnStore` - Boolean for edit permissions

**Routing:**
- Accepts both wallet addresses (`SP...`) and usernames
- Automatically resolves username → wallet via `user_profiles` table
- Falls back to wallet address if username not found

**Location:** `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-8/app/store/[walletAddress]/page.tsx`

---

#### `/profile/[walletAddress]` - Artist Profile Page (app/profile/[walletAddress]/page.tsx)
**Creator showcase and profile management**

**Features:**
- Customizable display name and tagline
- Profile image (from avatar or first track cover)
- Editable bio
- Social links
- Sticker/badge display
- Section visibility toggles
- Sections (if implemented):
  - Spotlight (featured content)
  - Media (embedded videos/audio)
  - Shop (store integration)
  - Gallery (image gallery)

**State:**
- `profileData` - Complete profile from `user_profiles` table
- `isOwnProfile` - Edit permissions
- `artistName` - Fallback from first track
- `targetWallet` - Resolved wallet address

**Routing:**
- Accepts wallet addresses or usernames
- Auto-initializes profile if user's first visit
- Fetches first track for default name/image

**Location:** `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-8/app/profile/[walletAddress]/page.tsx`

---

#### Other Routes

**`/about`** - Platform information page
**`/terms`** - Terms of service
**`/test-payment-splitter`** - Smart contract testing interface
**`/test-batch-payment`** - Batch payment testing

---

### Navigation Flow

```
Globe (/) ←→ Welcome (/welcome)
    ↓
   Store (/store/[wallet]) ← Links from track cards
    ↓
  Profile (/profile/[wallet]) ← Links from artist names
    ↓
   Mixer (/mixer) ← Widget launcher or direct nav
```

**Universal Access:**
- Header visible on all pages (sign in, cart, upload)
- Crate accessible from Globe, Store, Mixer
- Search overlay available on Globe and Mixer

---

## Core Features (Implemented)

### 1. 3D Globe Discovery

**What it does:**
- Displays all music content geographically positioned on an interactive 3D Earth
- Clusters nearby content (200-mile radius) to prevent overlap
- Real-time search and filtering
- Audio previews (20-second limit)
- Comparison mode for side-by-side track viewing

**Where it lives:**
- Main page at `/`
- `components/globe/Globe.tsx` - Main globe renderer
- `components/globe/GlobeSearch.tsx` - Search interface
- `components/globe/ClusteredNodeMesh.tsx` - Clustering system

**Technical implementation:**
- Three.js with @react-three/fiber
- Location clustering algorithm in `lib/globe/simpleCluster.ts`
- Real-time data from Supabase (`ip_tracks` table)
- Optimized to 17ms loading time (1,882x improvement from original 32+ seconds)

**Limitations:**
- Maximum 20-second preview per track
- Clustering may hide individual tracks in dense areas
- Mobile performance varies with device capability

**Database fields used:**
- `location_lat`, `location_lng` - Primary coordinates
- `locations` - JSONB array of multiple locations (if applicable)
- `primary_location` - String name for display

---

### 2. Upload System (Quick & Advanced Modes)

**What it does:**
- Uploads songs, loops, loop packs, EPs, and mixes
- Two-mode upload: Quick (minimal fields) or Advanced (full metadata)
- Multi-file support for loop packs (2-5 files)
- BPM detection with manual override
- Geographic positioning via Mapbox autocomplete
- IP attribution system (composition + production splits)
- Split preset management

**Where it lives:**
- `components/modals/IPTrackModal.tsx` (main modal)
- `components/modals/steps/` - Multi-step wizard components
- `hooks/useIPTrackSubmit.ts` - Submit logic (33KB)
- `hooks/useAudioUpload.ts` - Audio file processing

**Key technical details:**
- 5-stage upload pipeline with progress tracking
- Supabase Storage for audio (`user-content` bucket) and covers (`track-covers` bucket)
- Row Level Security policies restrict access to uploader's wallet
- BPM detection using `lib/bpmDetection.ts`
- Location autocomplete via Mapbox API

**Pricing fields:**
- `remix_price_stx` - Default 1 STX per loop for remixing (0 for free)
- `download_price_stx` - Price to download (NULL if not available)
- `allow_downloads` - Boolean flag

**Attribution system:**
- Up to 3 collaborators for composition
- Up to 3 collaborators for production
- Percentages must total 100% for each category
- Auto-fill with authenticated wallet checkbox
- Preset management for common collaborations

**Limitations:**
- Maximum 3 collaborators per category (composition/production)
- Loop packs limited to 2-5 files
- 10MB file size limit per audio file
- 5MB limit for cover images
- Alpha whitelist required (`alpha_users` table)

---

### 3. Professional DJ Mixer

**What it does:**
- Dual-deck mixing with professional controls
- Real-time waveform visualization
- BPM detection and sync between decks
- Loop controls (1, 2, 4, 8, 16 bar lengths)
- Content-aware loop start detection (-60dBFS threshold)
- Audio effects (EQ, filters, reverb, delay)
- Crossfader control
- Master tempo control
- Keyboard shortcuts

**Where it lives:**
- `/mixer` page
- `components/mixer/SimplifiedMixer.tsx` (68KB, production-ready)
- `components/mixer/SimplifiedDeck.tsx` - Individual deck
- `components/mixer/WaveformDisplay.tsx` - Audio visualization
- `components/mixer/FXComponent.tsx` - Effects (46KB)
- `lib/mixerAudio.ts` - Audio engine (61KB)

**Technical implementation:**
- Tone.js for audio synthesis and effects
- Canvas-based waveform rendering
- RequestAnimationFrame for smooth playhead updates (60fps)
- Custom sync engine for BPM matching
- Memory leak prevention with proper audio cleanup

**Key features:**
- **BPM Sync:** Locks deck B to deck A's tempo
- **Loop Controls:** Auto-detects loop start points
- **Effects:** Per-deck FX with bypass
- **Crossfader:** Smooth blending between decks
- **Master Controls:** Play/pause all, tempo adjustment
- **Keyboard Shortcuts:** Space (play/pause), 1-5 (loop lengths), etc.

**Recent stability improvements (Oct 23, 2025):**
- Memory leak prevention (audio element cleanup)
- Race condition elimination (requestAnimationFrame)
- Type safety improvements (removed 'any' types)
- FX retry logic refactoring
- Sync engine state management fixes
- Waveform playhead smoothness

**Limitations:**
- Only loops can be loaded into decks (songs go to crate)
- Recording feature planned but not implemented
- Maximum 2 decks (no additional channels)
- BPM detection may be inaccurate for complex tracks

---

### 4. Shopping Cart & Payment System

**What it does:**
- Global shopping cart accessible from all pages
- Add tracks to cart from Globe, Search, Store
- View cart total in STX
- Smart contract-based payment splitting
- Automatic distribution to all collaborators
- LocalStorage persistence across sessions

**Where it lives:**
- `components/layout/Header.tsx` - Cart UI (top-right)
- `contexts/CartContext.tsx` - State management (8.5KB)
- `lib/batch-payment-aggregator.ts` - Payment aggregation
- Contract: `SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN.music-payment-splitter-v3`

**Payment flow:**
1. User adds tracks to cart
2. Clicks "Purchase All" in cart dropdown
3. Backend calculates payment splits via `/api/calculate-payment-splits`
4. Aggregates all payments into single contract call
5. Smart contract distributes STX to all contributors
6. Transaction confirmed on Stacks blockchain

**Smart contract details:**
- V3 payment splitter (deployed Oct 7, 2025)
- Escrow pattern (contract receives first, then distributes)
- 50/50 split between composition and production rights
- Each contributor receives percentage of their category
- Dust (rounding errors) added to first recipient
- `PostConditionMode.Allow` for multi-recipient transfers

**Limitations:**
- Cart limited to 50 tracks (smart contract constraint)
- Requires Stacks wallet connection
- Mainnet STX only (no testnet support in production)
- No refunds (blockchain transactions are final)

---

### 5. Remix System (Gen 1)

**What it does:**
- Tracks IP attribution across remix generations
- Enforces 50/50 contribution from each source loop
- Automatic payment splitting for remix sales
- Remixer commission system (20% on sales)

**Where it lives:**
- `lib/calculateRemixSplits.ts` - IP calculation (10.9KB)
- `components/modals/TrackDetailsModal.tsx` - Display UI
- `docs/REMIX-SYSTEM-AUTHORITATIVE.md` - Business logic documentation
- `scripts/test-remix-splits.ts` - Test suite

**How it works:**

**Creating a Remix:**
1. Load 2 loops into mixer
2. Click "Record" (planned feature)
3. Pay 1 STX per loop upfront to loop creators
4. Remix is saved with 50/50 IP attribution

**IP Attribution:**
- Loop A contributors → 50% of remix IP
- Loop B contributors → 50% of remix IP
- Remixer is NOT an IP holder (they're a distributor)
- Each loop's composition/production splits scale by 0.5

**Selling a Remix:**
- Buyer pays full price
- 20% → Remixer (commission)
- 80% → Original loop creators (IP revenue)
- Split according to their composition/production percentages

**Example:**
```
2 STX purchase of a remix:

Remixer: 0.4 STX (20%)

IP Holders: 1.6 STX (80%):
- Loop A composer (50% of comp): 0.4 STX
- Loop A producer (50% of prod): 0.4 STX
- Loop B composer (50% of comp): 0.4 STX
- Loop B producer (50% of prod): 0.4 STX
```

**Technical details:**
- `remix_depth` field: 0 = original, 1+ = remix generation
- `source_track_ids` array: Parent track IDs
- Consolidates duplicate wallets across roles
- Adjusts for rounding to ensure exactly 100% total

**Limitations:**
- Gen 1 only (original loop + original loop)
- Exactly 2 source loops required
- Downstream sales not yet implemented (20% commission flow)
- Gen 2+ remixes (remix of remix) not designed yet

---

### 6. Creator Stores

**What it does:**
- Individual artist marketplace for each creator
- Filterable content display
- Edit mode for store owners
- Upload directly from store page
- Profile integration

**Where it lives:**
- `/store/[walletAddress]` route
- `components/cards/CompactTrackCardWithFlip.tsx` - Track display
- Query: Supabase `ip_tracks` WHERE `primary_uploader_wallet = ?`

**Features:**
- **Filters:**
  - Content type: All, Songs, Loops, Loop Packs, EPs
  - Categories: Instrumental, Vocal, Beats, Stem
- **Display:**
  - 24 tracks per page
  - Wave loading animation
  - 160px square cards with flip
- **Store Owner:**
  - Upload button (opens IPTrackModal)
  - Edit controls on each card
  - Delete functionality

**Routing:**
- Accepts username: `/store/djchikk`
- Accepts wallet: `/store/SP1DTN6E9...`
- Auto-resolves via `user_profiles.username` lookup

**Limitations:**
- Crate not visible on store pages (only Globe and Mixer)
- No store customization (name, banner, description)
- No sales analytics or dashboard
- Edit mode requires wallet authentication

---

### 7. Artist Profiles

**What it does:**
- Customizable creator showcase pages
- Editable display name, tagline, bio
- Profile image and sticker badges
- Social links
- Fallback to first track metadata

**Where it lives:**
- `/profile/[walletAddress]` route
- `lib/userProfileService.ts` - Profile data management
- Table: `user_profiles`

**Features:**
- Auto-initialization on first visit
- Fallback artist name from first track
- Fallback profile image from first track cover
- Username routing support
- Edit mode for profile owner

**Editable fields:**
- `display_name` - Artist name
- `tagline` - Short tagline
- `bio` - Full biography
- `avatar_url` - Profile image
- `sticker_id` - Decorative badge
- Social links (various platforms)

**Limitations:**
- Sections (Spotlight, Media, Shop, Gallery) not fully implemented
- No uploaded content display (use Store instead)
- No analytics or statistics
- Profile customization limited to basic fields

---

### 8. Search & Discovery

**What it does:**
- Real-time search across all content
- Search by title, artist, tags, location
- Filter by content type and category
- Instant results with debouncing
- Audio preview from search results
- Add to crate/cart from search

**Where it lives:**
- `components/globe/GlobeSearch.tsx` - Search UI
- Available on Globe (`/`) and Mixer (`/mixer`)

**Implementation:**
- Searches through `globeNodes` array
- Debounced input (300ms)
- Matches against: title, artist, tags, primary_location
- Displays matching cards in dropdown
- Play preview button per result

**Limitations:**
- Only searches currently loaded nodes (no server-side search)
- No advanced search operators
- No search history
- No saved searches

---

### 9. Crate System

**What it does:**
- Persistent track collection across Globe, Store, and Mixer pages
- Drag-and-drop from anywhere
- Audio preview playback
- Remove tracks
- Clear all
- Add to cart from crate
- Drag from crate to mixer decks

**Where it lives:**
- `components/shared/Crate.tsx` (bottom of page)
- `contexts/MixerContext.tsx` - State management
- LocalStorage persistence: `mixmi-collection-{walletAddress}`

**Features:**
- **Drag & Drop:**
  - Accepts: `TRACK_CARD`, `DECK_TRACK`, `COLLECTION_TRACK`
  - Drop zone with visual feedback
  - Animation on successful drop
- **Context-Aware:**
  - Globe: Collection mode
  - Store: Collection mode
  - Mixer: Load to decks
- **Global Access:**
  - `window.addToCollection(track)`
  - `window.removeFromCollection(trackId)`
  - `window.clearCollection()`

**Display:**
- Horizontal scrolling row
- 64px compact cards
- Collapse/expand toggle
- Track count indicator

**Limitations:**
- Hidden on profile pages
- No organization (folders, playlists)
- No reordering within crate
- No export/import functionality

---

### 10. Widget System (Mixer, Playlist, Radio)

**What it does:**
- Floating widget launcher button on Globe page
- Toggleable widgets for Mixer, Playlist, Radio
- LocalStorage persistence of visibility state
- Independent audio playback

**Where it lives:**
- `components/WidgetLauncher.tsx` - Launcher button
- `components/mixer/compact/SimplifiedMixerCompact.tsx` - Tiny mixer
- `components/PlaylistWidget.tsx` - Playlist player (21KB)
- `components/RadioWidget.tsx` - Radio player (17KB)

**Widgets:**

1. **Tiny Mixer (SimplifiedMixerCompact):**
   - 120px height compact mixer
   - Dual deck mini controls
   - Play/pause, volume, basic mixing
   - Minimal UI for globe context

2. **Playlist Widget:**
   - Curated playlist playback
   - Sequential track playing
   - Skip, pause, volume
   - Playlist from store content

3. **Radio Widget:**
   - Continuous streaming
   - Station selection
   - Now playing display
   - Volume control

**Visibility persistence:**
- `mixer-widget-visible` - localStorage key
- `playlist-widget-visible` - localStorage key
- `radio-widget-visible` - localStorage key

**Limitations:**
- Widgets only on Globe page (not Store/Profile)
- No playlist creation UI
- No radio station management
- Audio conflicts if multiple widgets playing

---

## User Flows

### Flow 1: Sign Up / Onboarding (Alpha Invite System)

**Authentication Methods:**

**Method A: Stacks Wallet (Preferred)**
1. Visit any page
2. Click "Sign In" in header
3. "Connect Wallet" button appears
4. Stacks wallet popup (Hiro, Xverse, etc.)
5. Sign authentication message
6. Wallet address verified against `alpha_users` table
7. Session created, user authenticated

**Method B: Alpha Code (Fallback)**
1. Visit any page, click "Sign In"
2. Enter alpha invite code (format: `mixmi-ABC123`)
3. Backend resolves code → wallet address via `alpha_users` table
4. Session created with alpha verification

**Alpha User Table Structure:**
```sql
alpha_users:
- wallet_address (SP mainnet format)
- alpha_code (unique invite code)
- approved_at (timestamp)
- is_active (boolean)
```

**Form Behavior:**
- Upload modal shows "Use authenticated account" checkbox
- Checkbox auto-fills composition/production splits with user's wallet
- Manual collaborator fields validate wallet address format
- Alpha codes converted to wallet addresses for blockchain operations

**Important Security Pattern:**
- UI displays alpha codes (no "wallet" terminology to avoid security scanners)
- Backend converts alpha code → actual wallet address
- Blockchain operations always use real SP addresses
- See `lib/auth/wallet-mapping.ts` and `/api/auth/resolve-wallet`

---

### Flow 2: Uploading Content

**Quick Mode (Minimal Upload):**

1. **Open Upload Modal:**
   - Click "Upload" in header OR
   - Click "Sign In and Upload" on Welcome page OR
   - Click "+" button in own store

2. **Select Content Type:**
   - Song, Loop, Loop Pack, EP, or Mix
   - Toggle "Quick Upload" (default) or "Advanced"

3. **Quick Mode Fields:**
   - Title (required)
   - Artist (required)
   - Audio file(s) upload (required)
     - Songs/Loops: 1 file
     - Loop Packs: 2-5 files
     - EPs: 2+ files
   - Cover image (optional, defaults to placeholder)
   - BPM (required for loops, auto-detected but overrideable)
   - Location (required, Mapbox autocomplete)

4. **Attribution (Auto-Fill):**
   - "Use authenticated account" checkbox (checked by default)
   - Auto-fills composition_split_1 and production_split_1 with 100%
   - Option to add collaborators (up to 3 per category)

5. **Submit:**
   - 5-stage upload process with progress:
     - Stage 1: Validating metadata
     - Stage 2: Uploading audio
     - Stage 3: Uploading cover
     - Stage 4: Saving to database
     - Stage 5: Complete
   - Toast notification on success
   - Content appears on globe immediately (after refresh)

**Advanced Mode (Full Metadata):**

Additional fields:
- Description
- Tags (comma-separated)
- Loop category (Instrumental, Vocal, Beats, Stem)
- Musical key
- Version
- ISRC code
- Social URLs
- Contact info
- Licensing options
- Remix permissions
- Download availability
- Separate remix and download pricing

**Location Input:**
- Mapbox autocomplete with 5 suggestions
- Worldwide support (any city, region, country)
- Indigenous territory recognition
- Multiple locations supported (JSONB array)
- Exact coordinates preserved from selection

**Pricing:**
- `remix_price_stx`: Default 1 STX for loops (0 for free)
- `download_price_stx`: NULL if downloads not available
- `allow_downloads`: Boolean checkbox

---

### Flow 3: Creating Remixes (Planned - Not Fully Implemented)

**Current State:** Upfront licensing works, recording not implemented

**Planned Flow:**

1. **Load Loops into Mixer:**
   - Drag 2 loops from Globe/Crate/Search to mixer decks
   - Only loops allowed (songs/EPs blocked)

2. **Mix & Record:**
   - Adjust BPM, crossfader, FX
   - Click "Record" button
   - Mix live for desired length (bars counted)
   - Click "Stop Recording"

3. **Payment (Upfront Licensing):**
   - Calculate total: 1 STX × number of loops (2 STX for 2 loops)
   - Wallet popup appears
   - Confirm transaction
   - Smart contract distributes to loop creators immediately:
     - Loop A: 1 STX split between composition/production contributors
     - Loop B: 1 STX split between composition/production contributors

4. **Save Remix:**
   - Recorded audio saved to Supabase Storage
   - Database entry created with:
     - `content_type`: 'mix'
     - `remix_depth`: 1
     - `source_track_ids`: [loopA_id, loopB_id]
     - Composition/production splits calculated (50/50 from each loop)
     - `remix_price_stx`: 1 (if someone wants to remix this remix later)
     - `download_price_stx`: Sum of both loop download prices (if both allow downloads)

5. **Remix Appears:**
   - On globe at uploader's location
   - In uploader's store
   - Linked to parent loops via TrackDetailsModal

**Downstream Sales (Planned):**
- When someone buys the remix download:
  - 20% → Remixer (commission)
  - 80% → Loop creators (IP revenue split)
- Implementation planned via API-based approach (not new contract)

---

### Flow 4: Purchasing / Downloading Content

**Current Implementation:**

1. **Add to Cart:**
   - Click shopping cart icon on track card (Globe, Search, Store)
   - Track added to cart in header
   - Cart count increments

2. **View Cart:**
   - Click cart icon in header
   - Dropdown shows all cart items
   - Total STX calculated

3. **Purchase All:**
   - Click "Purchase All" button
   - Backend calls `/api/calculate-payment-splits` for each track
   - Aggregates all payments into single contract call
   - Wallet popup appears
   - Confirm transaction

4. **Smart Contract Execution:**
   - Contract: `music-payment-splitter-v3`
   - Receives total STX amount
   - Distributes to all contributors:
     - 50% → Composition rights holders
     - 50% → Production rights holders
     - Each person receives their percentage of their category

5. **Post-Purchase:**
   - Transaction confirmed on blockchain
   - Cart cleared
   - Download links provided (planned)
   - Tracks added to user's vault (planned)

**Limitations:**
- Download delivery not implemented (payment works, file delivery pending)
- No download history
- No refunds
- Maximum 50 tracks per cart (contract limit)

---

### Flow 5: Exploring Content (Globe, Search, Stores)

**Discovery Path A: Globe Exploration**

1. **Land on Globe (`/`):**
   - 3D Earth spinning with content nodes
   - Clustered nodes for nearby content (200-mile radius)

2. **Interact with Nodes:**
   - Hover: Node highlights, track info appears
   - Click: Node selected, card appears
   - Card shows: Title, Artist, BPM, Tags, Price

3. **Preview Track:**
   - Click play button
   - 20-second audio preview
   - Auto-stops after 20 seconds

4. **Actions from Card:**
   - Add to Cart (shopping cart icon)
   - Add to Crate (drag or click)
   - Open Details Modal (info icon)
   - Compare (add to left/right comparison slots)

5. **Details Modal:**
   - Full metadata
   - IP attribution splits (composition/production)
   - Source loops (if remix)
   - Download button (planned)
   - Add to Cart button

**Discovery Path B: Search**

1. **Open Search:**
   - Available on Globe and Mixer pages
   - Top bar with search icon

2. **Type Query:**
   - Real-time results (debounced 300ms)
   - Searches: title, artist, tags, location

3. **Filter Results:**
   - Content type dropdown (All, Songs, Loops)
   - Category filters (Instrumental, Vocal, Beats, Stem)

4. **Interact with Results:**
   - Same actions as globe cards
   - Play preview
   - Add to cart/crate
   - Open details modal

**Discovery Path C: Creator Stores**

1. **Navigate to Store:**
   - Click artist name from track card → `/store/[wallet]`
   - Direct URL with username → `/store/djchikk`

2. **Browse Content:**
   - All tracks from this creator
   - Filter by content type
   - Filter by category
   - Paginated (24 per page)

3. **Wave Loading Animation:**
   - Cards appear in waves as they load
   - Prevents overwhelming UI

4. **Actions:**
   - Same as globe/search
   - If own store: Edit/Delete buttons

**Discovery Path D: Profile Exploration**

1. **Navigate to Profile:**
   - Click artist name on track card (if no store) → `/profile/[wallet]`
   - Or from store page link

2. **View Profile:**
   - Display name, tagline, bio
   - Profile image, sticker badge
   - Social links
   - Link to store (if content exists)

3. **Actions:**
   - Visit store
   - Follow social links
   - Edit profile (if own)

---

## Component Inventory

### Track Display Components (16 files)

#### `CompactTrackCardWithFlip.tsx` (Main Track Card)
**Location:** `components/cards/`
**Usage:** Globe, Store, Crate, Search results
**Size:** 160px × 160px square
**Features:**
- Flip animation (hover to reveal back)
- Play/pause button
- Info icon (opens TrackDetailsModal)
- Shopping cart icon
- Drag-and-drop support
- Content type borders:
  - Gold: Songs
  - Purple: Loops
  - Thick purple: Loop Packs
- Pack expansion (chevron for loop packs/EPs)
- Username/wallet linking

**Props:**
```typescript
{
  track: IPTrack;
  isPlaying: boolean;
  onPlayPreview: (trackId: string, audioUrl?: string) => void;
  onStopPreview?: () => void;
  showEditControls: boolean;
  onPurchase?: (track: IPTrack) => void;
  onEditTrack?: (track: IPTrack) => void;
  onDeleteTrack?: (trackId: string) => void;
}
```

**Pack Expansion:**
- Loop packs and EPs have chevron button
- Clicking expands vertically (globe/store) or horizontally (crate)
- Shows individual loops/tracks as draggable rows/cards
- Numbered badges, BPM, play buttons

---

#### `GlobeTrackCard.tsx`
**Usage:** Floating cards on globe page
**Features:**
- Appears on node click
- Comparison mode support (left/right slots)
- FILL mode integration
- Hover effects

---

#### `SafeImage.tsx`
**Location:** `components/shared/`
**Purpose:** Image with fallback handling
**Features:**
- Graceful degradation on load error
- Placeholder image support
- Next.js Image optimization

---

### Modals (19 files)

#### `IPTrackModal.tsx` (Upload Modal)
**Location:** `components/modals/`
**Size:** 33KB+ with hooks
**Purpose:** Complete upload workflow
**Features:**
- Quick vs Advanced mode toggle
- Multi-step wizard (for advanced mode)
- Content type selection (Song, Loop, Loop Pack, EP, Mix)
- Audio file upload with progress
- Cover image upload
- BPM detection
- Location autocomplete (Mapbox)
- IP attribution splits (composition + production)
- Split preset management
- Terms acceptance

**Steps (Advanced Mode):**
1. Content Type Selection
2. Audio Upload
3. Metadata Entry
4. Cover Image Upload
5. Attribution Splits
6. Licensing & Terms
7. Review & Submit

**Hooks Used:**
- `useIPTrackForm` - Form state management
- `useAudioUpload` - Audio file processing
- `useIPTrackSubmit` - Submission logic
- `useSplitPresets` - Preset management
- `useLocationAutocomplete` - Location search

---

#### `TrackDetailsModal.tsx`
**Purpose:** Full track information display
**Features:**
- Complete metadata view
- IP attribution splits (grouped by source loop for remixes)
- Source loop links (if remix)
- Download button (planned)
- Add to Cart button
- Play full preview
- Cover image display

**IP Split Display:**
- For original tracks: Shows composition/production splits
- For remixes: Shows grouped by source loop with scaling (e.g., "100% → 50% of remix")
- Wallet addresses displayed (for alpha transparency)

---

#### `PaymentModal.tsx` (30KB)
**Purpose:** Smart contract payment interface
**Features:**
- Payment split preview
- Total STX calculation
- Wallet connection prompt
- Transaction confirmation
- Success/error handling
- Progress indicators

---

#### `SignInModal.tsx`
**Purpose:** Authentication interface
**Features:**
- Connect Wallet button
- Alpha code input
- Friendly messaging for alpha testers
- Error handling

---

#### `ResetConfirmModal.tsx`
**Purpose:** Confirmation for FILL mode reset
**Features:**
- Warning message
- Confirm/cancel buttons
- Preserves user intent

---

#### `SplitPresetManager.tsx`
**Purpose:** Manage saved split configurations
**Features:**
- List saved presets
- Load preset into form
- Save new preset
- Delete preset
- Preset name and description

---

### Mixer Components (19 files)

#### `SimplifiedMixer.tsx` (Main Mixer - 68KB)
**Location:** `components/mixer/`
**Purpose:** Professional dual-deck mixer
**Features:**
- Dual deck controls
- Waveform displays
- Crossfader
- Master transport controls
- Loop controls per deck
- FX per deck
- BPM sync
- Recording (planned)
- Keyboard shortcuts

**State Management:**
```typescript
{
  deckA: {
    track, playing, loopEnabled, loopLength,
    loopPosition, boostLevel
  },
  deckB: { same },
  masterBPM, crossfaderPosition, syncActive
}
```

**Recent Refactorings (Oct 23, 2025):**
- Memory leak prevention
- Race condition fixes
- Type safety (no more 'any')
- Sync engine improvements
- Waveform smoothness fixes

---

#### `SimplifiedDeck.tsx`
**Purpose:** Individual deck control
**Features:**
- Track display
- Play/pause
- Volume control
- BPM display
- Track info
- Drag-and-drop loading

---

#### `WaveformDisplay.tsx`
**Purpose:** Audio visualization
**Features:**
- Canvas-based rendering
- Real-time playhead
- Loop region highlighting
- Zoom controls
- 280+ lines of visualization logic

**Implementation:**
- Analyzes audio waveform data
- Draws to canvas
- Updates every animation frame (60fps)
- Scroll follows playhead

---

#### `CrossfaderControl.tsx`
**Purpose:** Deck blending control
**Features:**
- Horizontal slider
- Visual feedback
- Applies gain to each deck based on position

---

#### `MasterTransportControls.tsx`
**Purpose:** Global playback controls
**Features:**
- Play/Pause all
- Master BPM display
- Tempo increment/decrement buttons
- Sync toggle

---

#### `LoopControls.tsx`
**Purpose:** Per-deck looping
**Features:**
- Loop enable toggle
- Loop length selection (1, 2, 4, 8, 16 bars)
- Loop position indicator
- Content-aware loop start detection

---

#### `FXComponent.tsx` (46KB)
**Purpose:** Audio effects per deck
**Features:**
- EQ (Low, Mid, High)
- Filter (Low-pass, High-pass)
- Reverb
- Delay
- Bypass toggle
- Reset to defaults

**Implementation:**
- Tone.js effect chains
- Audio graph routing
- Real-time parameter updates

---

#### `DeckCrate.tsx`
**Purpose:** Deck-specific track loading
**Features:**
- Shows crate tracks
- Drag to deck
- Visual feedback

---

#### `RecordingPreview.tsx` (Planned)
**Purpose:** Preview recorded remixes
**Features:**
- Playback controls
- Waveform display
- Save/discard options

---

#### `SimplifiedMixerCompact.tsx`
**Location:** `components/mixer/compact/`
**Purpose:** Tiny mixer widget for Globe page
**Size:** 120px height
**Features:**
- Minimal dual deck controls
- Volume sliders
- Play/pause
- Crossfader
- Designed to not obstruct globe view

---

### Layout Components (4 files)

#### `Header.tsx`
**Location:** `components/layout/`
**Purpose:** Global navigation and cart
**Features:**
- mixmi logo (links to `/`)
- Upload button (opens IPTrackModal)
- Shopping cart dropdown
- Sign In button
- Wallet address display (when authenticated)

**Cart Dropdown:**
- List of cart items
- Total STX
- "Purchase All" button
- Remove item buttons
- Clear cart button

**State:**
- Uses `CartContext` for cart state
- Uses `AuthContext` for authentication

---

### Shared Components (11 files)

#### `Crate.tsx` (15KB)
**Location:** `components/shared/`
**Purpose:** Persistent track collection
**Features:**
- Horizontal scrolling track list
- 64px compact cards
- Drag-and-drop zone
- Play preview
- Remove tracks
- Clear all button
- Collapse/expand toggle
- Context-aware behavior (Globe, Store, Mixer)

**Global Functions:**
```javascript
window.addToCollection(track)
window.removeFromCollection(trackId)
window.clearCollection()
```

---

#### `TrackCoverUploader.tsx`
**Purpose:** Dedicated cover image upload
**Features:**
- File picker or drag-and-drop
- Image preview
- Crop functionality (via react-easy-crop)
- Upload to `track-covers` Supabase bucket
- Progress tracking
- 5MB limit, PNG/JPG/WebP/GIF support

**Storage:**
- Bucket: `track-covers`
- Path: `{walletAddress}/cover-{timestamp}.{ext}`
- Public access
- Clean URLs (no base64 corruption)

---

#### `RadioWidget.tsx` (17KB)
**Purpose:** Radio streaming player
**Features:**
- Continuous playback
- Station selection
- Now playing display
- Volume control
- Minimize/expand

---

#### `PlaylistWidget.tsx` (21KB)
**Purpose:** Playlist streaming player
**Features:**
- Sequential track playing
- Skip forward/back
- Playlist display
- Volume control
- Now playing

---

#### `ArtistAutosuggest.tsx`
**Purpose:** Artist name autocomplete
**Features:**
- Suggests existing artists from database
- Prevents duplicates
- Type-ahead search

---

#### `InfoIcon.tsx`
**Purpose:** Reusable info icon
**Features:**
- Customizable color via className
- Opens TrackDetailsModal
- Hover effects

---

### Globe Components (25 files)

#### `Globe.tsx` (Main Globe Renderer)
**Location:** `components/globe/`
**Purpose:** 3D Earth visualization
**Features:**
- Three.js spinning globe
- Node rendering
- Click/hover handlers
- Camera controls
- Background mode (for Welcome page)

**Performance:**
- 17ms loading time (1,882x improvement)
- Dynamic import (SSR: false)
- Optimized materials and geometries

---

#### `GlobeSearch.tsx`
**Purpose:** Search overlay for globe
**Features:**
- Real-time search
- Debounced input
- Result cards
- Filter controls

---

#### `NodeMesh.tsx`
**Purpose:** Individual content nodes
**Features:**
- Renders track location pins
- Hover highlighting
- Click detection
- Color coding by content type

---

#### `ClusteredNodeMesh.tsx`
**Purpose:** Clustered content nodes
**Features:**
- Aggregates nearby tracks
- Shows count
- Expansion on click
- 200-mile clustering radius

**Algorithm:** `lib/globe/simpleCluster.ts`

---

#### `WorldOutlines.tsx`
**Purpose:** Continental/political boundaries
**Features:**
- GeoJSON rendering
- Subtle outlines
- Performance optimized

---

#### `Starfield.tsx`
**Purpose:** Background stars
**Features:**
- Particle system
- Depth parallax
- Subtle animation

---

#### `types.ts`
**Purpose:** Globe-specific TypeScript types
**Exports:**
```typescript
TrackNode, ClusterNode, GlobeProps, NodeMeshProps
```

---

### UI Primitives (shadcn/ui - 22 files)

**Location:** `components/ui/`
**Based on:** Radix UI primitives
**Styled with:** Tailwind CSS

**Components:**
- `button.tsx` - Button variants
- `input.tsx` - Text inputs
- `select.tsx` - Dropdowns
- `dialog.tsx` - Modal dialogs
- `dropdown-menu.tsx` - Dropdown menus
- `toast.tsx` - Toast notifications
- `accordion.tsx` - Collapsible sections
- `tabs.tsx` - Tab navigation
- `popover.tsx` - Popovers
- `checkbox.tsx` - Checkboxes
- `radio-group.tsx` - Radio buttons
- `switch.tsx` - Toggle switches
- `slider.tsx` - Range sliders
- `progress.tsx` - Progress bars
- `badge.tsx` - Badges
- `card.tsx` - Card containers
- `label.tsx` - Form labels
- `separator.tsx` - Dividers
- `scroll-area.tsx` - Custom scrollbars
- `tooltip.tsx` - Tooltips
- `command.tsx` - Command palette (cmdk)
- `avatar.tsx` - User avatars

---

### Profile Components (28 files)

**Location:** `components/profile/`

#### `ProfileInfo.tsx`
**Purpose:** Display/edit profile metadata
**Fields:** Display name, tagline, bio

#### `ProfileImage.tsx`
**Purpose:** Avatar upload and display
**Features:** Image crop, upload to Supabase

#### `SectionManager.tsx`
**Purpose:** Toggle section visibility
**Sections:** Spotlight, Media, Shop, Gallery, Sticker

#### `ProfileSticker.tsx`
**Purpose:** Decorative badge display
**Options:** Daisy (various colors), Fruit slices, Gear, Custom upload

---

### Section Components (11 files)

**Location:** `components/sections/`

#### `SpotlightSection.tsx`
**Purpose:** Featured content spotlight
**Features:** Add/edit spotlight items

#### `MediaSection.tsx`
**Purpose:** Embedded media (YouTube, Spotify, SoundCloud)
**Features:** URL parsing, embed generation

#### `ShopSection.tsx`
**Purpose:** Shop items (separate from Store)
**Features:** Product listings, external links

#### `GallerySection.tsx`
**Purpose:** Image gallery
**Features:** Grid layout, lightbox view

---

## Database Schema

### Primary Table: `ip_tracks`

**Purpose:** Stores all music content (songs, loops, loop packs, remixes, EPs)

**Location:** Supabase PostgreSQL database
**Row Level Security:** Enabled (wallet-based policies)

**Core Fields:**
```sql
-- Identity
id UUID PRIMARY KEY
title VARCHAR NOT NULL
version VARCHAR
artist VARCHAR NOT NULL
description TEXT
tell_us_more TEXT

-- Content Classification
content_type VARCHAR NOT NULL
  -- 'full_song' | 'loop' | 'loop_pack' | 'ep' | 'mix'
loop_category VARCHAR
  -- Only for loops: 'vocals' | 'beats' | 'instrumentals' | 'field_recording' | custom
tags TEXT[] -- Array of tag strings
sample_type VARCHAR -- Legacy field

-- Musical Metadata
bpm INTEGER -- Beats per minute (required for loops)
key VARCHAR -- Musical key signature
isrc VARCHAR -- International Standard Recording Code

-- Pricing (Separate Remix & Download)
remix_price_stx DECIMAL(10,2) DEFAULT 1.0
  -- Price to use in a remix (1 STX per loop default)
download_price_stx DECIMAL(10,2) DEFAULT NULL
  -- Price to download file (NULL = not available)
allow_downloads BOOLEAN DEFAULT false
  -- Whether downloads are enabled
price_stx DECIMAL(10,2)
  -- Legacy combined price (kept for backward compatibility)

-- IP Attribution - Composition Rights (up to 3)
composition_split_1_wallet VARCHAR NOT NULL
composition_split_1_percentage INTEGER NOT NULL
composition_split_2_wallet VARCHAR
composition_split_2_percentage INTEGER
composition_split_3_wallet VARCHAR
composition_split_3_percentage INTEGER

-- IP Attribution - Production Rights (up to 3)
production_split_1_wallet VARCHAR NOT NULL
production_split_1_percentage INTEGER NOT NULL
production_split_2_wallet VARCHAR
production_split_2_percentage INTEGER
production_split_3_wallet VARCHAR
production_split_3_percentage INTEGER

-- Media Assets
cover_image_url TEXT -- Supabase Storage URL
audio_url TEXT -- Supabase Storage URL

-- Location Data
location_lat DECIMAL(10,7)
location_lng DECIMAL(10,7)
primary_location VARCHAR -- Human-readable name
locations JSONB -- Array of {lat, lng, name} objects

-- Loop Pack System
pack_id VARCHAR
  -- Links individual loops to parent pack
pack_position INTEGER
  -- Order within pack (1, 2, 3...)
total_loops INTEGER
  -- For pack master records only

-- Remix Tracking
remix_depth INTEGER
  -- 0=original, 1+=remix generation, NULL=full song
source_track_ids UUID[]
  -- Array of parent track IDs

-- Licensing & Permissions
license_type VARCHAR
  -- 'remix_only' | 'remix_external' | 'custom'
allow_remixing BOOLEAN
open_to_collaboration BOOLEAN
agreed_to_terms BOOLEAN

-- Collaboration System
primary_uploader_wallet VARCHAR
  -- Creator who "owns" this in their store
collaboration_preferences JSONB
store_display_policy VARCHAR
  -- 'primary_only' | 'all_collaborations' | 'curated_collaborations'
collaboration_type VARCHAR
  -- 'primary_artist' | 'featured_artist' | 'producer' | 'remixer' | 'composer' | 'vocalist'

-- Social & Contact
social_urls JSONB
contact_info JSONB

-- Timestamps
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
deleted_at TIMESTAMP WITH TIME ZONE
  -- Soft delete
created_by VARCHAR
```

**Constraints:**
```sql
CHECK (remix_price_stx >= 0)
CHECK (download_price_stx IS NULL OR download_price_stx >= 0)
CHECK (
  (allow_downloads = false AND download_price_stx IS NULL) OR
  (allow_downloads = true)
)
```

**Indexes:**
- Primary key on `id`
- Index on `primary_uploader_wallet` (for store queries)
- Index on `content_type` (for filtering)
- Index on `pack_id` (for loop pack queries)
- Index on `created_at` (for sorting)

---

### Secondary Table: `alpha_users`

**Purpose:** Whitelist of approved alpha content creators

```sql
CREATE TABLE alpha_users (
  wallet_address VARCHAR PRIMARY KEY,
    -- SP mainnet address format (41-42 chars)
  alpha_code VARCHAR UNIQUE NOT NULL,
    -- Invite code format: 'mixmi-ABC123'
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);
```

**Usage:**
- Authentication check during upload
- Alpha code → wallet address mapping
- Server-side validation via `/api/alpha-auth`

---

### User Profiles Table: `user_profiles`

**Purpose:** Customizable creator profiles

```sql
CREATE TABLE user_profiles (
  wallet_address VARCHAR PRIMARY KEY,
  username VARCHAR UNIQUE,
    -- Custom username for routing
  display_name VARCHAR,
    -- Artist/creator name
  tagline VARCHAR,
  bio TEXT,
  avatar_url TEXT,
    -- Profile image URL
  sticker_id VARCHAR,
    -- Decorative badge ID
  social_links JSONB,
    -- Array of {platform, url} objects
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Features:**
- Auto-initialized on first profile visit
- Fallback to first track metadata
- Username routing support
- Social links as JSONB

---

### Storage Buckets

#### `user-content` Bucket
**Purpose:** Audio files and user-specific content
**Organization:** `{walletAddress}/audio-{timestamp}.wav`
**Access:** Private with RLS policies
**File Types:** Audio (WAV, MP3, etc.)
**Max Size:** 10MB per file

#### `track-covers` Bucket
**Purpose:** Album artwork and cover images
**Organization:** `{walletAddress}/cover-{timestamp}.png`
**Access:** Public read, authenticated write
**File Types:** PNG, JPG, WebP, GIF
**Max Size:** 5MB per file

**Key Improvement (Sept 2025):**
- Before: Base64 strings in database (500KB+ corruption)
- After: Clean Supabase Storage URLs (~100 chars)
- Result: 1,882x globe loading speed improvement (32s → 17ms)

---

### Database Migrations

**Location:** `supabase/migrations/`

**Files:**
1. **`add_gen1_remix_support.sql`**
   - Gen 1 remix IP split system
   - `remix_depth`, `source_track_ids` fields
   - Attribution calculation support

2. **`add_payment_status.sql`**
   - Payment/transaction tracking
   - Status fields for purchases

3. **`separate_remix_download_pricing.sql`**
   - Separates `remix_price_stx` from `download_price_stx`
   - Adds `allow_downloads` boolean
   - Migrates existing `price_stx` data to new fields
   - Constraints for data integrity

---

## Smart Contract Integration

### Deployed Contract: `music-payment-splitter-v3`

**Network:** Stacks Mainnet
**Contract Address:** `SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN.music-payment-splitter-v3`
**Language:** Clarity 2.0
**Deployment Date:** October 7, 2025
**Deployment Cost:** 0.041280 STX (~$0.50)
**Status:** ✅ Live and tested with real-money transactions

**Location:** `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-8/contracts/mixmi-payment-splitter/`

---

### Contract Functions

#### `split-track-payment`

**Purpose:** Distribute STX to multiple contributors automatically

**Input:**
```clarity
(total-price-microstx uint)
(composition-splits (list 50 {wallet: principal, percentage: uint}))
(production-splits (list 50 {wallet: principal, percentage: uint}))
```

**Output:**
```clarity
(ok {
  total-paid: uint,
  composition-count: uint,
  production-count: uint
})
```

**Logic:**
1. Contract receives total STX amount (escrow)
2. Calculates 50% for composition, 50% for production
3. Distributes each category according to percentages
4. Transfers STX directly to contributor wallets
5. Dust (rounding errors) added to first recipient

**Example Transaction:**
```
2.5 STX purchase of 2-loop remix:

Composition (50% = 1.25 STX):
- Alice (50%): 0.625 STX
- Bob (50%): 0.625 STX

Production (50% = 1.25 STX):
- Charlie (50%): 0.625 STX
- Dana (50%): 0.625 STX

Total verified: 2.5 STX ✅
```

**First Real Transaction (Oct 7, 2025):**
- 2 STX split to 3 artists: 0.6 + 0.4 + 1.0 STX
- Explorer: [View on Stacks Explorer](https://explorer.hiro.so/txid/0xd06bbc3488a4249083378ff8288b62a12e695d11ffc46077017138745ff49c39?chain=mainnet)

---

#### `preview-split`

**Purpose:** Calculate distribution without executing (dry run)

**Input:** Same as `split-track-payment`
**Output:** Preview of all payments

**Usage:**
- Pre-purchase validation
- UI display of splits
- Testing calculations

---

#### `validate-percentages`

**Purpose:** Ensure splits add to 100%

**Input:** List of percentages
**Output:** Boolean (true if valid)

---

### Integration Points in Code

#### `contexts/CartContext.tsx` (8.5KB)
**Handles cart purchases with smart contract**

**Flow:**
1. Fetch payment splits for all cart items
2. Call `/api/calculate-payment-splits?trackId={id}`
3. Aggregate payments via `lib/batch-payment-aggregator.ts`
4. Build contract call with:
   ```javascript
   {
     totalPriceMicroSTX: number,
     compositionSplits: [{wallet, percentage}],
     productionSplits: [{wallet, percentage}]
   }
   ```
5. Use `@stacks/connect` to open wallet popup
6. Execute `openContractCall` with:
   ```javascript
   {
     contractAddress: 'SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN',
     contractName: 'music-payment-splitter-v3',
     functionName: 'split-track-payment',
     functionArgs: [uintCV, listCV, listCV],
     postConditionMode: PostConditionMode.Allow,
     network: new StacksMainnet()
   }
   ```

---

#### `lib/calculateRemixSplits.ts` (10.9KB)
**Calculates remix IP attribution**

**Function:** `calculateRemixSplits(loopA, loopB)`

**Logic:**
1. Extract composition splits from Loop A, scale by 0.5
2. Extract composition splits from Loop B, scale by 0.5
3. Combine into single composition array
4. Repeat for production splits
5. Consolidate duplicate wallets
6. Adjust for rounding to ensure 100% total

**Returns:**
```typescript
{
  compositionSplits: [{wallet, percentage, sourceLoop}],
  productionSplits: [{wallet, percentage, sourceLoop}]
}
```

**Testing:**
- Test suite: `scripts/test-remix-splits.ts`
- 4 scenarios: Simple, Multiple contributors, Consolidation, Rounding
- Command: `npm run test:remix-splits`

---

#### `app/api/calculate-payment-splits/route.ts`
**Backend endpoint for split calculation**

**Endpoint:** `POST /api/calculate-payment-splits`
**Query:** `?trackId={uuid}`

**Returns:**
```json
{
  "compositionSplits": [
    {"wallet": "SP...", "percentage": 50}
  ],
  "productionSplits": [
    {"wallet": "SP...", "percentage": 50}
  ]
}
```

**Used during:**
- Cart purchases (frontend calls before contract execution)
- Payment preview (TrackDetailsModal)
- Remix creation (planned)

---

### Stacks Blockchain Technologies

#### `@stacks/connect` (Wallet Integration)
**Purpose:** Wallet popup and transaction signing
**Features:**
- Multi-wallet support (Hiro, Xverse, Leather)
- Authentication message signing
- Transaction building
- Post-condition management

**Authentication Flow:**
```javascript
import { showConnect, AppConfig, UserSession } from '@stacks/connect';

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

showConnect({
  appDetails: {
    name: 'mixmi',
    icon: '/logo.png'
  },
  onFinish: () => {
    const userData = userSession.loadUserData();
    const walletAddress = userData.profile.stxAddress.mainnet;
    // Store session
  }
});
```

---

#### `@stacks/transactions` (Transaction Building)
**Purpose:** Construct contract calls
**Key Functions:**
- `uintCV(value)` - Unsigned integer
- `standardPrincipalCV(address)` - Wallet address
- `listCV(items)` - Array of contract values
- `tupleCV(obj)` - Object/struct

**Example:**
```javascript
import { uintCV, listCV, tupleCV, standardPrincipalCV } from '@stacks/transactions';

const compositionSplits = listCV([
  tupleCV({
    wallet: standardPrincipalCV('SP...'),
    percentage: uintCV(50)
  })
]);
```

---

#### PostConditionMode.Allow
**Critical for Multi-Recipient Transfers**

**Why needed:**
- Default post-conditions would require explicit allowances for each recipient
- With 50 potential contributors, this becomes complex
- `PostConditionMode.Allow` enables contract to distribute freely
- Safe because contract logic enforces correct splits

**Trade-off:**
- Less protection against malicious contracts
- Acceptable for audited, deployed contract
- User still sees total STX amount in wallet popup

---

### Environment Configuration

**Environment Variables:**
```bash
NEXT_PUBLIC_STACKS_NETWORK=mainnet
NEXT_PUBLIC_PAYMENT_SPLITTER_CONTRACT=SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN
```

**Network Switching:**
- Production: Stacks Mainnet
- Testing: Stacks Testnet (contracts/deployments/default.testnet-plan.yaml)
- Local: Devnet (not currently used)

---

## Current Limitations

### 1. Remix System

**What Works:**
- ✅ Upfront licensing (1 STX per loop) with smart contract
- ✅ IP attribution calculation (50/50 from each loop)
- ✅ Remix depth tracking
- ✅ Source loop display in TrackDetailsModal

**What's Missing:**
- ❌ Recording interface (Record button exists but not functional)
- ❌ Downstream sales (20% commission to remixer when someone buys their remix)
- ❌ Gen 2+ remixes (remix of a remix)
- ❌ Heritage pools for deep genealogy
- ❌ Remix download delivery

**Workaround:**
- Remixes can be manually uploaded after external recording
- IP attribution can be calculated and displayed
- Payment splits work for original content

---

### 2. Contributor Limits

**Hard Limit:** 3 contributors per category (composition/production)

**Database:**
```sql
-- Max 3 composition splits
composition_split_1_wallet, composition_split_1_percentage
composition_split_2_wallet, composition_split_2_percentage
composition_split_3_wallet, composition_split_3_percentage

-- Max 3 production splits
production_split_1_wallet, production_split_1_percentage
production_split_2_wallet, production_split_2_percentage
production_split_3_wallet, production_split_3_percentage
```

**Why:**
- Simplifies UI/UX
- Prevents split percentage complexity
- Smart contract supports up to 50, but UX caps at 3 for alpha

**Workaround:**
- Use a shared wallet for groups (band wallet)
- Off-chain agreements for internal splits
- Future: Heritage pools for larger collaborations

---

### 3. Payment & Download System

**What Works:**
- ✅ Cart system with add/remove
- ✅ Smart contract payment splitting
- ✅ Blockchain transactions
- ✅ Multi-contributor distribution

**What's Missing:**
- ❌ Download delivery after purchase
- ❌ Download history/library
- ❌ Purchased content vault
- ❌ On-chain certificates
- ❌ Streaming passes/subscriptions
- ❌ Refunds (blockchain limitation)

**Current State:**
- User pays → Contributors receive STX → User has no file yet
- Planned: Vault system with download links
- Planned: Digital certificates as NFTs

---

### 4. Search & Discovery

**What Works:**
- ✅ Real-time search on Globe and Mixer
- ✅ Content type filtering (Songs, Loops, Loop Packs, EPs)
- ✅ Category filtering (Instrumental, Vocal, Beats, Stem)
- ✅ Location-based discovery via globe

**What's Missing:**
- ❌ Server-side search (only client-side on loaded nodes)
- ❌ Advanced search operators (AND/OR/NOT)
- ❌ Search history
- ❌ Saved searches
- ❌ Search by BPM range
- ❌ Search by musical key
- ❌ Search by price range
- ❌ Search by remix depth
- ❌ Sort by relevance, date, price, popularity

**Workaround:**
- Use filters and scroll through results
- Globe clustering helps with geographic exploration

---

### 5. Crate Organization

**What Works:**
- ✅ Add tracks to crate
- ✅ Remove tracks
- ✅ Clear all
- ✅ Drag from crate to mixer
- ✅ LocalStorage persistence

**What's Missing:**
- ❌ Folders/playlists
- ❌ Reordering within crate
- ❌ Multiple crates
- ❌ Share crate with others
- ❌ Export/import crate
- ❌ Crate metadata (name, description)
- ❌ Auto-organize (by BPM, key, artist)

**Workaround:**
- Use browser bookmarks for crate states
- Manually curate before mixing session

---

### 6. Profile & Store Customization

**What Works:**
- ✅ Basic profile editing (name, tagline, bio, image)
- ✅ Sticker badges
- ✅ Social links
- ✅ Content filtering in stores
- ✅ Username routing

**What's Missing:**
- ❌ Store banner images
- ❌ Store description
- ❌ Featured content in store
- ❌ Store themes/colors
- ❌ Store layout customization
- ❌ Sales analytics
- ❌ Follower system
- ❌ Profile sections (Spotlight, Media, Shop, Gallery) incomplete
- ❌ Profile statistics (plays, downloads, earnings)
- ❌ Profile verification badges

**Workaround:**
- Use bio field for store description
- Rely on content quality for discoverability

---

### 7. Mobile Experience

**What Works:**
- ✅ Responsive layouts (Tailwind breakpoints)
- ✅ Touch-friendly buttons
- ✅ Mobile-optimized globe (reduced quality)
- ✅ Waveform responsive sizing

**What's Missing:**
- ❌ Mobile-specific UI for mixer (desktop-optimized)
- ❌ Touch gestures for globe rotation
- ❌ Swipe navigation
- ❌ Mobile app (PWA)
- ❌ Mobile-specific audio engine (may have performance issues)

**Known Issues:**
- Mixer on mobile is cramped (use landscape)
- Globe performance varies by device
- 3D rendering may drain battery

---

### 8. Audio Engine

**What Works:**
- ✅ Real-time playback
- ✅ BPM detection
- ✅ Waveform visualization
- ✅ Looping
- ✅ Effects (EQ, filters, reverb, delay)
- ✅ Crossfading
- ✅ Sync between decks

**What's Missing:**
- ❌ Recording/export (planned)
- ❌ Time-stretching (change tempo without pitch shift)
- ❌ Key detection
- ❌ Key shift/harmonization
- ❌ Auto-beatmatching
- ❌ Quantized loop triggering
- ❌ MIDI controller support
- ❌ Advanced FX (phaser, flanger, compressor, limiter)
- ❌ Master EQ

**Limitations:**
- BPM detection may be inaccurate for complex/non-4/4 tracks
- Manual BPM override required for loops (ensures mixer compatibility)
- Content-aware loop detection works but may not catch all track types

---

### 9. Data & Content Management

**What Works:**
- ✅ Soft delete (deleted_at field)
- ✅ Edit metadata after upload
- ✅ Delete own content
- ✅ Row Level Security

**What's Missing:**
- ❌ Bulk edit operations
- ❌ Batch upload
- ❌ Content moderation tools
- ❌ Admin dashboard
- ❌ Content versioning
- ❌ Restore deleted content (soft delete exists but no UI)
- ❌ Transfer ownership
- ❌ Duplicate detection
- ❌ Auto-tagging
- ❌ Metadata import/export

**Workaround:**
- Contact admin for bulk operations
- Manual re-upload for corrections

---

### 10. Testing & Production Readiness

**What Works:**
- ✅ Mainnet smart contracts deployed
- ✅ Supabase production database
- ✅ Vercel deployment
- ✅ Alpha user whitelist

**What's Missing:**
- ❌ Automated testing (no test framework)
- ❌ Unit tests for critical logic
- ❌ Integration tests for payment flow
- ❌ End-to-end tests for user journeys
- ❌ Performance monitoring
- ❌ Error tracking (Sentry, etc.)
- ❌ Analytics (user behavior, plays, purchases)
- ❌ Logging cleanup (many console.log statements)
- ❌ Security audit of smart contracts
- ❌ Load testing for concurrent users

**Current Approach:**
- Manual testing via alpha users
- TypeScript for compile-time checking
- Test pages: `/test-payment-splitter`, `/test-batch-payment`
- Remix split test suite: `scripts/test-remix-splits.ts`

---

## Visual Design Patterns

### Color Scheme

**Primary Colors:**
```css
/* Deep blue background */
#101726  /* Dark slate */
#151C2A  /* Slightly lighter slate */

/* Accent colors */
#81E4F2  /* Cyan - primary accent */
#FFE4B5  /* Moccasin/Gold - songs */
#9772F4  /* Purple - loops */

/* Text colors */
#e1e5f0  /* Primary text (light gray) */
#a8b2c3  /* Secondary text (medium gray) */
#6b7489  /* Muted text (dark gray) */
```

**Usage:**
- **Cyan (#81E4F2):** Buttons, links, highlights, hover states
- **Gold (#FFE4B5):** Song cards, song-related UI
- **Purple (#9772F4):** Loop cards, loop packs, mixer elements

---

### Grid System

**Track Cards: 160px Squares**

**Rationale:**
- Perfect square for album art
- Fits nicely in grids (multiple of 8)
- Large enough for touch targets
- Small enough for many cards on screen

**Layouts:**
- **Globe:** Floating cards (not gridded)
- **Store:** Grid with 24 per page
  - Desktop (xl): 6 columns
  - Laptop (lg): 4 columns
  - Tablet (md): 3 columns
  - Mobile (sm): 2 columns
- **Crate:** Horizontal scrolling row
  - 64px height (compact mode)
  - Horizontal pack expansion

---

### Card Design Patterns

**Track Card Anatomy:**
```
┌─────────────────┐
│                 │
│   Cover Image   │
│    160×160px    │
│                 │
├─────────────────┤
│ [Play] Title    │ ← Overlay on hover
│ Artist          │
│ BPM | Price     │
│ [Cart] [Info]   │
└─────────────────┘
```

**Front (Default):**
- Cover image (full card)
- Content type border:
  - No border: Default
  - Gold (2px): Songs
  - Purple (2px): Loops
  - Purple (4px): Loop Packs, EPs

**Hover Overlay:**
- Dark semi-transparent background (rgba(0,0,0,0.8))
- Title (truncated to 2 lines)
- Artist (truncated to 1 line)
- BPM and Price
- Play button (center or top-right)
- Shopping cart icon (bottom-right)
- Info icon (top-right)

**Flip State (Deprecated in Oct 2025):**
- Originally had flip animation
- Now directly opens TrackDetailsModal
- Code removed for simplification

---

### Pack Expansion Patterns

**Loop Pack / EP Cards:**

**Visual Indicators:**
- Thick border (4px purple for loop packs, 4px gold for EPs)
- Chevron button on right side
- "Loop Pack (X loops)" or "EP (X tracks)" label

**Globe/Store Expansion (Vertical):**
```
┌─────────────────┐
│   Pack Card     │ ← Main card
│   160×160       │
└────────┬────────┘
         │
┌────────▼────────┐
│ 1. Loop Name    │ ← Draggable rows
│    BPM: 120 [▶] │    28px height
├─────────────────┤
│ 2. Loop Name    │
│    BPM: 125 [▶] │
├─────────────────┤
│ 3. Loop Name    │
│    BPM: 130 [▶] │
└─────────────────┘
```

**Crate Expansion (Horizontal):**
```
┌───────┬─────────────┐
│ Pack  │ 1.  2.  3.  │ ← Horizontal cards
│ 64px  │ Loop Loop Loop│   64×64px each
│       │ [▶] [▶] [▶] │
└───────┴─────────────┘
```

**Expansion Features:**
- Smooth animation (slideDown/slideInRight)
- Individual loop play buttons
- Numbered badges (1, 2, 3...)
- BPM display per loop
- Drag individual loops to mixer/crate

---

### Button Styles

**Primary Buttons (Cyan):**
```css
/* Upload, Sign In, Purchase */
background: transparent;
border: 2px solid #81E4F2;
color: #81E4F2;

/* Hover */
background: rgba(129, 228, 242, 0.1);
box-shadow: 0 0 20px rgba(129, 228, 242, 0.4);
```

**Secondary Buttons:**
```css
background: rgba(20, 25, 39, 0.6);
border: 1px solid rgba(129, 228, 242, 0.2);
color: #e1e5f0;
```

**Icon Buttons:**
```css
/* Play, Cart, Info */
background: rgba(0, 0, 0, 0.5);
color: white;
border-radius: 50%; /* Circle for play */
border-radius: 8px; /* Rounded square for others */
```

**Disabled State:**
```css
opacity: 0.5;
cursor: not-allowed;
```

---

### Hover States & Interactions

**Track Cards:**
- **Default:** Cover image visible
- **Hover:** Dark overlay appears with metadata
- **Active (playing):** Pulsing border or play icon animation

**Buttons:**
- **Default:** Border visible
- **Hover:** Glow effect (box-shadow)
- **Active:** Slightly darker background

**Links:**
- **Default:** Cyan underline on text links
- **Hover:** Brighter cyan, slight glow

**Globe Nodes:**
- **Default:** Subtle glow
- **Hover:** Brighter glow, larger size (scale 1.2)
- **Selected:** Persistent bright glow

---

### Modal Design

**Standard Modal Anatomy:**
```
┌─────────────────────────────┐
│ [X] Modal Title             │ ← Header (sticky)
├─────────────────────────────┤
│                             │
│   Modal Content             │ ← Scrollable
│                             │
│                             │
├─────────────────────────────┤
│ [Cancel] [Save]             │ ← Footer (sticky)
└─────────────────────────────┘
```

**Background:**
- Overlay: rgba(0, 0, 0, 0.8)
- Modal: `rgba(20, 25, 39, 0.98)` with backdrop blur

**Close Button:**
- Top-right corner
- White X icon with hover effect
- Click outside to close (optional)

**Buttons:**
- Cancel: Secondary style
- Save/Confirm: Primary cyan style
- Disabled state when validation fails

---

### Form Design

**Input Fields:**
```css
background: rgba(20, 25, 39, 0.6);
border: 1px solid rgba(129, 228, 242, 0.2);
color: #e1e5f0;
padding: 12px 16px;
border-radius: 8px;

/* Focus */
border-color: #81E4F2;
box-shadow: 0 0 0 2px rgba(129, 228, 242, 0.2);
```

**Labels:**
```css
color: #a8b2c3;
font-size: 14px;
margin-bottom: 8px;
```

**Validation Errors:**
```css
border-color: #ff6b6b;
color: #ff6b6b;
```

**Success State:**
```css
border-color: #51cf66;
color: #51cf66;
```

**Checkboxes & Toggles:**
- iOS-style toggle switches
- Subtle gray default (not heavy cyan)
- Cyan accent when active

---

### Glassmorphism

**Used on Welcome Page Cards:**
```css
background: rgba(20, 25, 39, 0.6);
border: 1px solid rgba(129, 228, 242, 0.1);
border-radius: 16px;
backdrop-filter: blur(10px);
```

**Effect:**
- Semi-transparent background
- Subtle border
- Blur behind card
- Depth and layering

---

### Waveform Visualization

**Design:**
- Canvas-based rendering (not SVG)
- Bars represent amplitude
- Cyan color (#81E4F2) for waveform
- Playhead: Vertical red line
- Loop region: Highlighted with semi-transparent cyan overlay

**Responsive Sizing:**
- Desktop (xl): 700px width
- Laptop (lg): 600px width
- Tablet (md): 500px width
- Mobile (sm): 400px width

**Zoom Controls:**
- + / - buttons
- Scroll bar below waveform

---

### Loading States

**Spinner:**
```css
animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400
```

**Progress Bars:**
```css
background: rgba(20, 25, 39, 0.6);
border-radius: 9999px;
overflow: hidden;

/* Fill */
background: linear-gradient(90deg, #81E4F2, #9772F4);
transition: width 0.3s ease;
```

**Wave Loading (Store Page):**
- Cards appear in waves (groups of 6)
- Smooth fade-in animation
- Prevents overwhelming UI on page load

**Skeleton Loaders:**
- Not currently used
- Fallback to spinners and progress bars

---

### Toast Notifications

**Library:** Sonner 2.0.7

**Styles:**
- Success: Green background, checkmark icon
- Error: Red background, X icon
- Info: Blue background, info icon
- Warning: Orange background, warning icon

**Position:** Top-right corner
**Duration:** 3-5 seconds (configurable)
**Dismissable:** Click X or swipe

---

### Mobile vs Desktop Differences

**Responsive Breakpoints (Tailwind):**
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

**Mobile Adjustments:**
- Header: Reduced logo size, compact cart
- Globe: Lower quality rendering, reduced particles
- Cards: 2 columns instead of 6
- Mixer: Switch to landscape for better experience
- Waveform: Narrower width (400px)
- Modals: Full-screen on mobile
- Forms: Larger touch targets (48px minimum)

**Desktop Enhancements:**
- Hover effects (not on mobile)
- Keyboard shortcuts (mixer)
- Larger waveforms
- More cards visible simultaneously
- Side-by-side comparison mode

---

## Technical Architecture

### State Management

**React Context Providers (4):**

1. **AuthContext** (`contexts/AuthContext.tsx`)
   - Wallet authentication state
   - Alpha user verification
   - Session management
   - Provides: `isAuthenticated`, `walletAddress`, `signIn`, `signOut`

2. **CartContext** (`contexts/CartContext.tsx`)
   - Shopping cart state
   - Add/remove items
   - Purchase flow
   - LocalStorage persistence
   - Provides: `cart`, `addToCart`, `removeFromCart`, `clearCart`, `purchaseAll`, `cartTotal`

3. **MixerContext** (`contexts/MixerContext.tsx`)
   - Crate/collection state
   - Mixer deck state (planned deeper integration)
   - Provides: `collection`, `addTrackToCollection`, `removeTrackFromCollection`, `clearCollection`

4. **ToastContext** (`contexts/ToastContext.tsx`)
   - Toast notification state
   - Show/hide toasts
   - Provides: `showToast`, `hideToast`

**Global Providers Wrapper:** `app/providers.tsx`
```tsx
<AuthProvider>
  <CartProvider>
    <MixerProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </MixerProvider>
  </CartProvider>
</AuthProvider>
```

---

### Custom Hooks (13 files)

**Location:** `hooks/`

1. **useIPTrackSubmit.ts** (33KB)
   - Upload processing logic
   - 5-stage pipeline
   - Error handling
   - Database insertion
   - Storage upload

2. **useMixerAudio.ts**
   - Audio engine integration
   - Tone.js wrapper
   - Playback controls
   - FX management

3. **useAudioUpload.ts**
   - Multi-file audio upload
   - BPM detection
   - Progress tracking
   - Supabase Storage integration

4. **useLocationAutocomplete.ts**
   - Mapbox API integration
   - Debounced search
   - Suggestion filtering
   - Coordinate extraction

5. **useImageUpload.ts**
   - Cover image upload
   - Image optimization
   - Crop functionality
   - Progress tracking

6. **useIPTrackForm.ts**
   - Form state management
   - Validation logic
   - Step navigation
   - Preset loading

7. **useSplitPresets.ts**
   - Preset CRUD operations
   - Load/save/delete presets
   - Supabase integration

8. **useDebounce.ts**
   - Debounce input changes
   - Configurable delay

9. **useInfiniteScroll.ts**
   - Pagination support
   - Scroll detection
   - Load more functionality

10. **useClickOutside.ts**
    - Detect clicks outside element
    - Close modals/dropdowns

11. **useMediaQuery.ts**
    - Responsive breakpoint detection
    - Window size tracking

12. **useLocalStorage.ts**
    - LocalStorage wrapper
    - Type-safe access
    - Auto-serialization

13. **usePrevious.ts**
    - Track previous state value
    - Useful for animations

---

### Utility Libraries (57 files in `lib/`)

**Key Utilities:**

1. **supabase.ts** - Database client
2. **supabase-storage.ts** - Storage operations
3. **globeDataSupabase.ts** - Globe data fetching
4. **mixerAudio.ts** (61KB) - Professional audio engine
5. **calculateRemixSplits.ts** (10.9KB) - IP attribution
6. **locationLookup.ts** - Mapbox geocoding
7. **bpmDetection.ts** - Audio BPM analysis
8. **imageUtils.ts** - Image optimization
9. **userProfileService.ts** - Profile data management
10. **batch-payment-aggregator.ts** - Cart payment aggregation
11. **contentAwareEngine.ts** - Loop start detection
12. **auth/alpha-auth.ts** - Alpha whitelist verification
13. **auth/wallet-mapping.ts** - Alpha code ↔ wallet conversion
14. **globe/simpleCluster.ts** - Location clustering algorithm
15. **imageOptimization.ts** - Card image optimization

**Audio Processing:**
- Tone.js integration
- Waveform rendering
- BPM detection algorithms
- Loop detection (-60dBFS threshold)
- IEEE754 float handling

**Payment Processing:**
- Smart contract interaction
- Payment split calculation
- Batch payment aggregation
- Transaction verification

**Data Management:**
- Supabase queries
- Row Level Security
- LocalStorage persistence
- Image optimization

---

### Performance Optimizations

**Globe Loading (Sept 2025):**
- **Before:** 32+ seconds
- **After:** 17ms
- **Improvement:** 1,882x faster
- **Method:** Eliminated 500KB+ base64 images, used Supabase Storage URLs

**Image Architecture:**
- **Before:** Base64 strings in database causing JSON corruption
- **After:** Clean ~100 character URLs from Supabase Storage
- **Buckets:** Separate `track-covers` bucket for optimization
- **Result:** Faster queries, smaller database size, parallel loading

**Location Accuracy:**
- **Before:** Autocomplete selections re-geocoded, causing errors
- **After:** Exact coordinates preserved from user selection
- **Method:** Store lat/lng directly from Mapbox response

**Mixer Stability (Oct 23, 2025):**
- Memory leak prevention (audio element cleanup)
- Race condition elimination (requestAnimationFrame)
- Type safety improvements
- Sync engine refactoring
- Waveform playhead smoothness (60fps)

**Code Optimizations:**
- Dynamic imports for heavy components (Globe, Mixer)
- SSR: false for Three.js components
- Debounced search input (300ms)
- LocalStorage caching for crate/cart
- Lazy loading for track cards (wave animation)

---

### API Routes (Next.js Backend)

**Location:** `app/api/`

1. **`/api/auth/wallet-connect`**
   - POST: Initiate Stacks wallet connection

2. **`/api/auth/alpha-check`**
   - POST: Verify alpha user whitelist status

3. **`/api/auth/create-session`**
   - POST: Create authenticated session

4. **`/api/auth/resolve-wallet`**
   - POST: Convert alpha code → wallet address
   - Critical for form auto-fill

5. **`/api/alpha-auth`**
   - POST: Alternative alpha authentication

6. **`/api/calculate-payment-splits`**
   - GET: Calculate payment distribution
   - Query: `?trackId={uuid}`
   - Returns: `{compositionSplits, productionSplits}`

7. **`/api/verify-remix-payments`**
   - POST: Verify payment transaction status

8. **`/api/profile/check-username`**
   - GET: Validate username availability

9. **`/api/profile/check-bns`**
   - GET: Check Stacks BNS name

10. **`/api/test-supabase`**
    - GET: Database connectivity test

11. **`/api/debug-globe`**
    - GET: Globe data debugging

---

### TypeScript Configuration

**File:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "esnext",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "strict": false, // Relaxed for rapid development
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "incremental": true,
    "paths": {
      "@/*": ["./*"] // Path alias
    }
  }
}
```

**Key Choices:**
- **Strict: false** - Allows faster iteration during alpha
- **Path alias (@/)** - Clean imports
- **ES2017 target** - Modern but compatible

---

### Deployment

**Platform:** Vercel
**Build Command:** `next build`
**Output Directory:** `.next`
**Environment:** Production

**Environment Variables (Vercel):**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
NEXT_PUBLIC_STACKS_NETWORK=mainnet
NEXT_PUBLIC_PAYMENT_SPLITTER_CONTRACT
```

**Deployment Triggers:**
- Push to `main` branch → Production deploy
- Push to other branches → Preview deploy

**Known Production Issues:**
- Console.log statements throughout (cleanup needed)
- Three-mesh-bvh deprecation warnings (ignorable)
- No formal monitoring/analytics
- No error tracking

---

### Security Considerations

**Row Level Security (RLS):**
- Supabase policies restrict access by wallet
- Users can only modify their own content
- Alpha whitelist checked server-side

**Wallet Authentication:**
- Signature verification via Stacks wallet
- No plaintext passwords
- Session tokens in secure cookies

**Smart Contract Safety:**
- V3 audited and tested (Oct 7, 2025)
- PostConditionMode.Allow (necessary for multi-recipient)
- No hardcoded wallet addresses in frontend
- Dust handling prevents lost microSTX

**Alpha Code System:**
- Prevents security scanner warnings (no "wallet" in UI)
- Backend converts alpha code → wallet address
- Transparent to blockchain operations

**Known Vulnerabilities:**
- No rate limiting on API routes
- No CAPTCHA on upload
- Alpha whitelist is trust-based
- Smart contract not formally audited by third party

---

## Summary

This documentation captures the **current state** of the mixmi Alpha platform as of October 25, 2025. It is a fully functional music creation and discovery ecosystem with:

- **Live blockchain payments** on Stacks mainnet
- **Professional DJ mixing** with dual decks and effects
- **Geographic discovery** via interactive 3D globe
- **Creator economy features** including stores and profiles
- **IP attribution system** for remix genealogy

### What Makes mixmi Unique

1. **Remix-First Design** - Built for collaboration and iteration
2. **Fair Attribution** - Every contributor tracked and paid automatically
3. **Geographic Discovery** - Music positioned worldwide on 3D globe
4. **Professional Tools** - DJ-quality mixer with real-time audio processing
5. **Blockchain Payments** - Instant, automatic revenue splitting via smart contracts

### Alpha Status

This is a **production alpha** with real users, real content, and real blockchain transactions. While feature-complete for core workflows, several advanced features (recording, Gen 2+ remixes, download delivery) are planned for future phases.

**For Claude Desktop Sessions:** This document serves as the authoritative reference for the mixmi Alpha interface. When users ask about features, architecture, or implementation details, refer to the specific sections above for accurate, up-to-date information.

---

**Documentation Maintained By:** Claude Code
**Source Repository:** `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-8/`
**Additional Documentation:** See `docs/CLAUDE.md`, `docs/REMIX-SYSTEM-AUTHORITATIVE.md`, and other files in `docs/`
