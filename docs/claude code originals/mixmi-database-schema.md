---
name: mixmi-database-schema
description: Complete Supabase database schema including tables, fields, relationships, and constraints
---

# mixmi Database Schema

Complete reference for all database tables, fields, relationships, and constraints in the mixmi Alpha platform.

**Database:** Supabase (PostgreSQL)
**Security:** Row Level Security (RLS) enabled
**Location:** `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-8/supabase/`

---

## Table of Contents

1. [ip_tracks (Primary Content Table)](#ip_tracks-primary-content-table)
2. [alpha_users (Whitelist)](#alpha_users-whitelist)
3. [user_profiles (Creator Profiles)](#user_profiles-creator-profiles)
4. [Storage Buckets](#storage-buckets)
5. [Relationships & Foreign Keys](#relationships--foreign-keys)
6. [Indexes](#indexes)
7. [Migrations](#migrations)

---

## ip_tracks (Primary Content Table)

**Purpose:** Stores all music content including songs, loops, loop packs, remixes, and EPs

**Table Name:** `ip_tracks`
**Primary Key:** `id` (UUID)
**Row Level Security:** Enabled (wallet-based policies)

### Complete Field List

```sql
CREATE TABLE ip_tracks (
  -- ============================================
  -- IDENTITY FIELDS
  -- ============================================
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  version VARCHAR(100),
    -- Example: "Radio Edit", "Extended Mix", "Instrumental"
  artist VARCHAR(100) NOT NULL,
  description TEXT,
    -- Main track description
  tell_us_more TEXT,
    -- Additional context/story

  -- ============================================
  -- CONTENT CLASSIFICATION
  -- ============================================
  content_type VARCHAR(50) NOT NULL,
    -- Values: 'full_song' | 'loop' | 'loop_pack' | 'ep' | 'mix'
  loop_category VARCHAR(50),
    -- Only for loops: 'instrumental' | 'vocal' | 'beats' | 'stem' | 'other'
  tags TEXT[],
    -- Array of tag strings, e.g., ['trap', '808', 'dark']
  sample_type VARCHAR(50),
    -- DEPRECATED: Legacy field, use content_type + loop_category instead

  -- ============================================
  -- MUSICAL METADATA
  -- ============================================
  bpm INTEGER,
    -- Beats per minute (REQUIRED for loops, optional for songs)
    -- Range: 60-200
    -- Must be whole number (no decimals)
  key VARCHAR(10),
    -- Musical key signature (optional)
    -- Examples: 'C major', 'D# minor', 'Am'
  isrc VARCHAR(20),
    -- International Standard Recording Code
    -- Format: XX-XXX-YY-NNNNN

  -- ============================================
  -- PRICING (SEPARATE REMIX & DOWNLOAD)
  -- ============================================
  remix_price_stx DECIMAL(10,2) DEFAULT 1.0,
    -- Price to use this loop in a remix (per loop)
    -- Default: 1 STX for loops, 0 for songs
    -- Can be 0 for free remixing
  download_price_stx DECIMAL(10,2) DEFAULT NULL,
    -- Price to download the audio file
    -- NULL = downloads not available
  allow_downloads BOOLEAN DEFAULT false,
    -- Whether this track can be downloaded
    -- Separate from remix rights
  price_stx DECIMAL(10,2),
    -- DEPRECATED: Legacy combined price field
    -- Kept for backward compatibility

  -- ============================================
  -- IP ATTRIBUTION - COMPOSITION RIGHTS
  -- (Up to 3 contributors, must total 100%)
  -- ============================================
  composition_split_1_wallet VARCHAR(42) NOT NULL,
    -- Stacks wallet address (SP... format)
  composition_split_1_percentage INTEGER NOT NULL,
    -- Percentage of composition rights (0-100)

  composition_split_2_wallet VARCHAR(42),
  composition_split_2_percentage INTEGER DEFAULT 0,

  composition_split_3_wallet VARCHAR(42),
  composition_split_3_percentage INTEGER DEFAULT 0,

  -- ============================================
  -- IP ATTRIBUTION - PRODUCTION RIGHTS
  -- (Up to 3 contributors, must total 100%)
  -- ============================================
  production_split_1_wallet VARCHAR(42) NOT NULL,
    -- Stacks wallet address (SP... format)
  production_split_1_percentage INTEGER NOT NULL,
    -- Percentage of production rights (0-100)

  production_split_2_wallet VARCHAR(42),
  production_split_2_percentage INTEGER DEFAULT 0,

  production_split_3_wallet VARCHAR(42),
  production_split_3_percentage INTEGER DEFAULT 0,

  -- ============================================
  -- MEDIA ASSETS
  -- ============================================
  cover_image_url TEXT,
    -- Supabase Storage URL (~100 characters)
    -- Bucket: 'track-covers'
    -- Format: https://apvdneaduthfbieywwjv.supabase.co/storage/v1/object/public/track-covers/{wallet}/cover-{timestamp}.png
  audio_url TEXT,
    -- Supabase Storage URL
    -- Bucket: 'user-content'
    -- Format: https://apvdneaduthfbieywwjv.supabase.co/storage/v1/object/public/user-content/{wallet}/audio-{timestamp}.wav

  -- ============================================
  -- LOCATION DATA
  -- ============================================
  location_lat DECIMAL(10,7),
    -- Latitude coordinate (7 decimal places for precision)
    -- Range: -90.0000000 to 90.0000000
  location_lng DECIMAL(10,7),
    -- Longitude coordinate (7 decimal places)
    -- Range: -180.0000000 to 180.0000000
  primary_location VARCHAR(200),
    -- Human-readable location name
    -- Example: "Los Angeles, CA, USA"
  locations JSONB,
    -- Array of multiple locations (if applicable)
    -- Format: [{"lat": 34.05, "lng": -118.24, "name": "Los Angeles"}]

  -- ============================================
  -- LOOP PACK SYSTEM
  -- ============================================
  pack_id VARCHAR(50),
    -- Links individual loops to their parent loop pack
    -- NULL for standalone tracks
    -- UUID of master pack record for children
  pack_position INTEGER,
    -- Position within the loop pack (1, 2, 3...)
    -- NULL for standalone tracks or master records
  total_loops INTEGER,
    -- For loop pack MASTER records only
    -- Number of loops in the pack
    -- NULL for children and standalone tracks

  -- ============================================
  -- REMIX TRACKING (GEN 1+)
  -- ============================================
  remix_depth INTEGER,
    -- Generation depth:
    --   0 = Original loop
    --   1 = Gen 1 remix (remix of 2 original loops)
    --   2+ = Gen 2+ remix (remix of remixes) [planned]
    --   NULL = Full song (not part of remix system)
  source_track_ids UUID[],
    -- Array of parent track IDs this was remixed from
    -- Length 2 for Gen 1 remixes
    -- NULL for original content

  -- ============================================
  -- LICENSING & PERMISSIONS
  -- ============================================
  license_type VARCHAR(50),
    -- Values: 'remix_only' | 'remix_external' | 'custom'
  allow_remixing BOOLEAN DEFAULT true,
    -- Whether this content can be used in remixes
  open_to_collaboration BOOLEAN DEFAULT false,
    -- Whether creator is open to collaboration invitations
  agreed_to_terms BOOLEAN DEFAULT false,
    -- Whether uploader accepted terms of service

  -- ============================================
  -- COLLABORATION SYSTEM
  -- ============================================
  primary_uploader_wallet VARCHAR(42),
    -- Creator who "owns" this track in their store
    -- Used for store filtering and permissions
  collaboration_preferences JSONB,
    -- JSONB field for collaboration control
    -- Example: {"accept_invites": true, "genres": ["trap", "hiphop"]}
  store_display_policy VARCHAR(50),
    -- How track appears in stores
    -- Values: 'primary_only' | 'all_collaborations' | 'curated_collaborations'
  collaboration_type VARCHAR(50),
    -- Role in collaboration
    -- Values: 'primary_artist' | 'featured_artist' | 'producer' | 'remixer' | 'composer' | 'vocalist'

  -- ============================================
  -- SOCIAL & CONTACT
  -- ============================================
  social_urls JSONB,
    -- Social media links
    -- Example: {"instagram": "https://...", "twitter": "https://..."}
  contact_info JSONB,
    -- Contact information
    -- Example: {"email": "artist@example.com", "phone": "+1..."}

  -- ============================================
  -- TIMESTAMPS
  -- ============================================
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- When record was created
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- When record was last modified
  deleted_at TIMESTAMP WITH TIME ZONE,
    -- Soft delete timestamp (NULL = not deleted)
  created_by VARCHAR(42)
    -- Wallet address of creator (may differ from primary_uploader_wallet in collaborations)
);
```

---

### Constraints

```sql
-- Ensure remix price is non-negative
ALTER TABLE ip_tracks
  ADD CONSTRAINT check_remix_price CHECK (remix_price_stx >= 0);

-- Ensure download price is non-negative (if set)
ALTER TABLE ip_tracks
  ADD CONSTRAINT check_download_price CHECK (download_price_stx IS NULL OR download_price_stx >= 0);

-- Ensure download consistency
-- (If allow_downloads is false, download_price_stx must be NULL)
ALTER TABLE ip_tracks
  ADD CONSTRAINT check_download_consistency CHECK (
    (allow_downloads = false AND download_price_stx IS NULL) OR
    (allow_downloads = true)
  );

-- Composition splits must total 100% (application-level validation)
-- Production splits must total 100% (application-level validation)
-- (Not enforced at database level to allow partial saves during editing)
```

---

### Field Purpose Guide

#### When to Use Each Field

**Required for ALL tracks:**
- `title`, `artist` - Basic identification
- `content_type` - Classification
- `audio_url` - The actual content
- `location_lat`, `location_lng`, `primary_location` - Geographic positioning
- `composition_split_1_wallet`, `composition_split_1_percentage` - At least one composer
- `production_split_1_wallet`, `production_split_1_percentage` - At least one producer
- `primary_uploader_wallet` - Store ownership

**Required for LOOPS:**
- `bpm` - Mixer compatibility, sync
- `loop_category` - Filtering in UI

**Required for LOOP PACKS:**
- `pack_id` - Links children to master
- `pack_position` - Order within pack
- `total_loops` - (Master record only) Count

**Required for REMIXES:**
- `remix_depth` - Generation tracking
- `source_track_ids` - Parent lineage

**Optional but recommended:**
- `cover_image_url` - Visual appeal (defaults to placeholder)
- `description` - Context for buyers
- `tags` - Discoverability

**Advanced/Optional:**
- `version`, `tell_us_more` - Additional context
- `key`, `isrc` - Professional metadata
- `social_urls`, `contact_info` - Creator promotion
- `collaboration_preferences` - Future features

---

## alpha_users (Whitelist)

**Purpose:** Whitelist of approved alpha content creators

**Table Name:** `alpha_users`
**Primary Key:** `wallet_address`

### Schema

```sql
CREATE TABLE alpha_users (
  -- ============================================
  -- PRIMARY IDENTIFICATION
  -- ============================================
  wallet_address VARCHAR(42) PRIMARY KEY,
    -- Stacks mainnet wallet address (SP... format)
    -- 41-42 characters
    -- Example: SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN

  -- ============================================
  -- ALPHA INVITE CODE
  -- ============================================
  alpha_code VARCHAR(20) UNIQUE NOT NULL,
    -- Unique invite code for alpha access
    -- Format: 'mixmi-ABC123'
    -- User-friendly for authentication
    -- Converted to wallet_address by backend

  -- ============================================
  -- STATUS
  -- ============================================
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- When user was approved for alpha

  is_active BOOLEAN DEFAULT true
    -- Whether this alpha user is currently active
    -- Can be set to false to revoke access
);
```

### Purpose & Usage

**Authentication Flow:**
1. User enters alpha code (e.g., `mixmi-ABC123`)
2. Backend queries: `SELECT wallet_address FROM alpha_users WHERE alpha_code = 'mixmi-ABC123'`
3. If found and `is_active = true`, user is authenticated
4. Wallet address used for all blockchain operations

**Why Alpha Codes?**
- User-friendly (easier than long wallet addresses)
- Prevents security scanner warnings (no "wallet" terminology in UI)
- Backend converts alpha code → wallet address transparently
- See `lib/auth/wallet-mapping.ts` and `/api/auth/resolve-wallet`

---

## user_profiles (Creator Profiles)

**Purpose:** Customizable creator profile pages

**Table Name:** `user_profiles`
**Primary Key:** `wallet_address`

### Schema

```sql
CREATE TABLE user_profiles (
  -- ============================================
  -- PRIMARY IDENTIFICATION
  -- ============================================
  wallet_address VARCHAR(42) PRIMARY KEY,
    -- Stacks wallet address (links to alpha_users)
    -- Also used in ip_tracks.primary_uploader_wallet

  -- ============================================
  -- DISPLAY INFORMATION
  -- ============================================
  username VARCHAR(50) UNIQUE,
    -- Custom username for routing
    -- Example: 'djchikk'
    -- Used in URLs: /store/djchikk, /profile/djchikk
    -- NULL = use wallet address in URLs

  display_name VARCHAR(100),
    -- Artist/creator name
    -- Defaults to 'New User' on first profile creation
    -- Falls back to first track's artist name if not customized

  tagline VARCHAR(200),
    -- Short tagline/bio
    -- Example: "Lo-fi beats & chill vibes"

  bio TEXT,
    -- Full biography
    -- Supports markdown (planned)

  avatar_url TEXT,
    -- Profile image URL (Supabase Storage)
    -- Falls back to first track's cover image if not set

  -- ============================================
  -- CUSTOMIZATION
  -- ============================================
  sticker_id VARCHAR(50),
    -- Decorative badge/sticker ID
    -- Values: 'daisy-purple', 'daisy-pink', 'daisy-yellow', etc.
    -- Or 'custom' for user-uploaded stickers

  social_links JSONB,
    -- Array of social media links
    -- Format: [{"platform": "instagram", "url": "https://..."}]

  -- ============================================
  -- SECTION VISIBILITY (PLANNED)
  -- ============================================
  section_visibility JSONB,
    -- Toggle visibility of profile sections
    -- Example: {"spotlight": true, "media": false, "shop": true}
    -- Sections: spotlight, media, shop, gallery, sticker

  -- ============================================
  -- TIMESTAMPS
  -- ============================================
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Auto-Initialization

**When:** User visits their profile page for the first time
**Logic:**
```sql
-- Check if profile exists
SELECT * FROM user_profiles WHERE wallet_address = 'SP...';

-- If not found, create with defaults
INSERT INTO user_profiles (
  wallet_address,
  display_name,
  tagline,
  bio,
  sticker_id
) VALUES (
  'SP...',
  'New User',    -- Default name
  '',
  '',
  'daisy-blue'   -- Default sticker
);
```

**Fallback to First Track:**
```typescript
// If display_name still = 'New User', fetch from first track
const { data: tracks } = await supabase
  .from('ip_tracks')
  .select('artist, cover_image_url')
  .eq('primary_uploader_wallet', walletAddress)
  .order('created_at', { ascending: true })
  .limit(1);

if (tracks.length > 0 && profile.display_name === 'New User') {
  // Use track artist as display name
  profile.display_name = tracks[0].artist;

  // Use track cover as avatar if no avatar set
  if (!profile.avatar_url) {
    profile.avatar_url = tracks[0].cover_image_url;
  }
}
```

---

## Storage Buckets

### user-content Bucket

**Name:** `user-content`
**Purpose:** Audio files and user-specific content
**Access:** Private with Row Level Security
**File Types:** Audio (WAV, MP3, FLAC, etc.)
**Max Size:** 10MB per file

**Organization:**
```
user-content/
├── SP1ABC.../
│   ├── audio-1729876543210.wav
│   ├── audio-1729876654321.mp3
│   └── ...
├── SP2DEF.../
│   └── audio-1729876765432.wav
└── ...
```

**URL Format:**
```
https://apvdneaduthfbieywwjv.supabase.co/storage/v1/object/public/user-content/{walletAddress}/audio-{timestamp}.{ext}
```

**Row Level Security:**
```sql
-- Users can only upload to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'user-content' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read access (for playback)
CREATE POLICY "Public read access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'user-content');
```

---

### track-covers Bucket

**Name:** `track-covers`
**Purpose:** Album artwork and cover images
**Access:** Public read, authenticated write
**File Types:** PNG, JPG, WebP, GIF
**Max Size:** 5MB per file

**Organization:**
```
track-covers/
├── SP1ABC.../
│   ├── cover-1729876543210.png
│   ├── cover-1729876654321.jpg
│   └── ...
├── SP2DEF.../
│   └── cover-1729876765432.png
└── ...
```

**URL Format:**
```
https://apvdneaduthfbieywwjv.supabase.co/storage/v1/object/public/track-covers/{walletAddress}/cover-{timestamp}.{ext}
```

**Why Separate Bucket?**
- **Performance:** Dedicated bucket for images
- **Optimization:** Can apply image transformations
- **Security:** Public read without exposing other user content
- **Organization:** Clean separation of concerns

**Critical Achievement (Sept 2025):**
- **Before:** Base64 images stored in database (500KB+ strings)
- **After:** Clean Supabase Storage URLs (~100 characters)
- **Result:** 1,882x globe loading speed improvement (32s → 17ms)

---

## Relationships & Foreign Keys

### Primary Relationships

```sql
-- 1. ip_tracks.primary_uploader_wallet → alpha_users.wallet_address
--    (Enforces that uploader is approved alpha user)
ALTER TABLE ip_tracks
  ADD CONSTRAINT fk_primary_uploader
  FOREIGN KEY (primary_uploader_wallet)
  REFERENCES alpha_users(wallet_address);

-- 2. ip_tracks.pack_id → ip_tracks.id
--    (Links loop pack children to master record)
ALTER TABLE ip_tracks
  ADD CONSTRAINT fk_pack_id
  FOREIGN KEY (pack_id)
  REFERENCES ip_tracks(id);

-- 3. user_profiles.wallet_address → alpha_users.wallet_address
--    (Enforces that profile owner is approved alpha user)
ALTER TABLE user_profiles
  ADD CONSTRAINT fk_wallet_address
  FOREIGN KEY (wallet_address)
  REFERENCES alpha_users(wallet_address);
```

### Relationship Diagram

```
alpha_users
├── wallet_address (PK)
└── alpha_code (UNIQUE)
     ↓
     ├─→ ip_tracks.primary_uploader_wallet (FK)
     └─→ user_profiles.wallet_address (FK)

ip_tracks
├── id (PK)
└── pack_id (FK) ──→ ip_tracks.id (self-reference)
```

---

## Indexes

### Existing Indexes

```sql
-- Primary keys (automatic indexes)
CREATE UNIQUE INDEX idx_ip_tracks_pk ON ip_tracks(id);
CREATE UNIQUE INDEX idx_alpha_users_pk ON alpha_users(wallet_address);
CREATE UNIQUE INDEX idx_user_profiles_pk ON user_profiles(wallet_address);

-- Unique constraints (automatic indexes)
CREATE UNIQUE INDEX idx_alpha_users_code ON alpha_users(alpha_code);
CREATE UNIQUE INDEX idx_user_profiles_username ON user_profiles(username);
```

### Recommended Performance Indexes

```sql
-- For store queries (frequently used)
CREATE INDEX idx_ip_tracks_uploader ON ip_tracks(primary_uploader_wallet)
  WHERE deleted_at IS NULL;

-- For content type filtering
CREATE INDEX idx_ip_tracks_content_type ON ip_tracks(content_type)
  WHERE deleted_at IS NULL;

-- For loop pack queries
CREATE INDEX idx_ip_tracks_pack_id ON ip_tracks(pack_id)
  WHERE pack_id IS NOT NULL;

-- For remix queries
CREATE INDEX idx_ip_tracks_remix_depth ON ip_tracks(remix_depth)
  WHERE remix_depth IS NOT NULL;

-- For location-based queries (planned)
CREATE INDEX idx_ip_tracks_location ON ip_tracks(location_lat, location_lng)
  WHERE deleted_at IS NULL;

-- For created_at sorting
CREATE INDEX idx_ip_tracks_created_at ON ip_tracks(created_at DESC)
  WHERE deleted_at IS NULL;
```

---

## Migrations

**Location:** `supabase/migrations/`

### 1. add_gen1_remix_support.sql

**Date:** September 2025
**Purpose:** Add Gen 1 remix IP split system

**Changes:**
```sql
-- Add remix tracking fields
ALTER TABLE ip_tracks
  ADD COLUMN remix_depth INTEGER,
  ADD COLUMN source_track_ids UUID[];

-- Add comments
COMMENT ON COLUMN ip_tracks.remix_depth IS 'Generation depth: 0=original, 1+=remix generation, null=full song';
COMMENT ON COLUMN ip_tracks.source_track_ids IS 'Array of parent track IDs this was remixed from';
```

---

### 2. add_payment_status.sql

**Date:** October 2025
**Purpose:** Track payment/transaction status

**Changes:**
```sql
-- Add payment tracking fields (planned)
ALTER TABLE ip_tracks
  ADD COLUMN payment_status VARCHAR(50),
  ADD COLUMN transaction_id VARCHAR(100),
  ADD COLUMN payment_confirmed_at TIMESTAMP WITH TIME ZONE;

-- Values: 'pending' | 'confirmed' | 'failed'
```

---

### 3. separate_remix_download_pricing.sql

**Date:** September 2025
**Purpose:** Separate remix licensing fee from download price

**Changes:**
```sql
-- Add new pricing fields
ALTER TABLE ip_tracks
  ADD COLUMN remix_price_stx DECIMAL(10,2) DEFAULT 1.0,
  ADD COLUMN download_price_stx DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN allow_downloads BOOLEAN DEFAULT false;

-- Migrate existing data
UPDATE ip_tracks
SET
  remix_price_stx = CASE WHEN content_type = 'loop' THEN 1.0 ELSE 0 END,
  download_price_stx = CASE WHEN allow_downloads = true THEN price_stx ELSE NULL END,
  allow_downloads = COALESCE(allow_downloads, false)
WHERE content_type IN ('full_song', 'loop', 'loop_pack', 'ep');

-- Add constraints
ALTER TABLE ip_tracks
  ADD CONSTRAINT check_remix_price CHECK (remix_price_stx >= 0),
  ADD CONSTRAINT check_download_price CHECK (download_price_stx IS NULL OR download_price_stx >= 0),
  ADD CONSTRAINT check_download_consistency CHECK (
    (allow_downloads = false AND download_price_stx IS NULL) OR
    (allow_downloads = true)
  );
```

**Why This Migration?**
- Clarifies pricing model (1 STX per loop to remix vs. separate download price)
- Enables loops to be remix-only (no downloads)
- Supports free remixing (remix_price_stx = 0)
- Maintains backward compatibility with legacy price_stx field

---

## Query Examples

### Fetch All Tracks for a Store

```sql
SELECT *
FROM ip_tracks
WHERE primary_uploader_wallet = 'SP1ABC...'
  AND deleted_at IS NULL
  AND (content_type = 'loop' OR content_type = 'full_song' OR content_type = 'loop_pack' OR content_type = 'ep')
ORDER BY created_at DESC
LIMIT 24 OFFSET 0;
```

---

### Fetch Loops from a Loop Pack

```sql
SELECT *
FROM ip_tracks
WHERE pack_id = 'pack-uuid'
  AND content_type = 'loop'
ORDER BY pack_position ASC;
```

---

### Fetch All Content for Globe

```sql
SELECT
  id,
  title,
  artist,
  content_type,
  bpm,
  location_lat,
  location_lng,
  primary_location,
  cover_image_url,
  audio_url,
  download_price_stx,
  remix_price_stx,
  primary_uploader_wallet
FROM ip_tracks
WHERE deleted_at IS NULL
  AND location_lat IS NOT NULL
  AND location_lng IS NOT NULL
  AND pack_id IS NULL  -- Exclude loop pack children
ORDER BY created_at DESC;
```

---

### Fetch Remix with Source Loops

```sql
-- Get the remix
SELECT * FROM ip_tracks WHERE id = 'remix-uuid';

-- Get source loops (2 for Gen 1)
SELECT *
FROM ip_tracks
WHERE id = ANY(
  (SELECT source_track_ids FROM ip_tracks WHERE id = 'remix-uuid')
);
```

---

### Check if Username Available

```sql
SELECT COUNT(*) as count
FROM user_profiles
WHERE LOWER(username) = LOWER('desired-username');

-- Returns 0 if available, 1+ if taken
```

---

## Data Integrity Rules

### Composition Splits Must Total 100%

```typescript
const validateCompositionSplits = (track: IPTrack): boolean => {
  const total =
    (track.composition_split_1_percentage || 0) +
    (track.composition_split_2_percentage || 0) +
    (track.composition_split_3_percentage || 0);

  return total === 100;
};
```

**Enforcement:** Application-level (not database constraint)
**Why:** Allows partial saves during editing, but validates before finalizing

---

### Production Splits Must Total 100%

```typescript
const validateProductionSplits = (track: IPTrack): boolean => {
  const total =
    (track.production_split_1_percentage || 0) +
    (track.production_split_2_percentage || 0) +
    (track.production_split_3_percentage || 0);

  return total === 100;
};
```

---

### BPM Required for Loops

```typescript
if (track.content_type === 'loop' && !track.bpm) {
  throw new Error('BPM is required for loops');
}

if (track.content_type === 'loop' && track.bpm % 1 !== 0) {
  throw new Error('BPM must be a whole number');
}
```

**Why Whole Numbers:**
- Mixer compatibility
- Prevents decimal precision issues
- User must verify auto-detected BPM

---

### Pack Position Sequential

```typescript
// For loop packs, pack_position must be 1, 2, 3, ..., total_loops
const loops = await fetchLoopsInPack(packId);
const positions = loops.map(l => l.pack_position).sort();

for (let i = 0; i < positions.length; i++) {
  if (positions[i] !== i + 1) {
    throw new Error('Pack positions must be sequential starting from 1');
  }
}
```

---

## Known Limitations

### Maximum Limits

- **Contributors:** 3 per category (composition/production) = 6 total
- **Loop Pack Size:** 2-5 loops
- **Tags:** No enforced limit (reasonable: ~10)
- **Social Links:** No enforced limit (reasonable: ~10)
- **Multiple Locations:** No enforced limit (reasonable: ~5)

### Not Enforced at Database Level

These are enforced in application code:
- Split percentages totaling 100%
- BPM being whole number
- Pack positions being sequential
- File size limits (10MB audio, 5MB images)

**Why Application-Level:**
- Allows partial saves during editing
- Better error messages
- Flexibility for future changes

---

## Code Locations

**Database Client:**
- `lib/supabase.ts` - Main client
- `lib/supabase-storage.ts` - Storage operations

**Type Definitions:**
- `types/index.ts` - TypeScript interfaces for all tables

**Migrations:**
- `supabase/migrations/` - SQL migration files

**Services:**
- `lib/userProfileService.ts` - Profile CRUD operations
- `lib/auth/alpha-auth.ts` - Alpha user verification

**API Routes:**
- `app/api/auth/resolve-wallet/route.ts` - Alpha code conversion
- `app/api/calculate-payment-splits/route.ts` - Payment split queries
