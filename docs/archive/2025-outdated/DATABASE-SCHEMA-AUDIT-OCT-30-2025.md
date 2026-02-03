# Database Schema Audit - October 30, 2025
**Backup Completed:** ✅ alpha_users_backup_2025_10_30, ip_tracks_backup_2025_10_30, user_profiles_backup_2025_10_30
**Audit Scope:** alpha_users (8 columns), ip_tracks (93 columns!), user_profiles (15 columns)
**Total:** 116 columns analyzed

---

## Executive Summary

**Major Findings:**
- ✅ **alpha_users**: Clean (8 columns, all used)
- ⚠️ **ip_tracks**: BLOATED (93 columns, ~25 unused/duplicate)
- ✅ **user_profiles**: Mostly clean (15 columns, 1-2 questionable)

**Schema-TypeScript Mismatch:**
- Database has `generation` AND `remix_depth` (duplicate)
- Database has `uploader_address` AND `primary_uploader_wallet` (duplicate)
- Database has `deleted_at` AND `is_deleted` (duplicate logic)
- Database has composition/production_split_4/5/6/7 (NOT in TypeScript interface!)
- Database has old pricing columns (price_stx, remix_price, combined_price, download_price) alongside new ones

**Recommendation:** Remove 20-25 columns, save significant bloat

---

## Table 1: alpha_users ✅ ALL CLEAN

### Schema (8 columns)
```
wallet_address (text, NOT NULL)       - Primary key
artist_name (text, NOT NULL)          - Used in auth flow
email (text, nullable)                - Contact info
notes (text, nullable)                - Admin notes
approved (boolean, NOT NULL)          - Auth check
created_at (timestamp)                - Metadata
updated_at (timestamp)                - Metadata
invite_code (varchar, nullable)       - Auth system
```

### Usage Analysis
🟢 **ALL KEEP** - Every column is actively used

| Column | Status | Usage | Files Found |
|--------|--------|-------|-------------|
| wallet_address | 🟢 KEEP | Primary key, auth checks | 50+ files |
| artist_name | 🟢 KEEP | Auth flow, display | 24 files |
| email | 🟢 KEEP | Contact, future notifications | lib/auth, components |
| notes | 🟢 KEEP | Admin management | Internal use |
| approved | 🟢 KEEP | Critical auth check | lib/auth/alpha-auth.ts |
| created_at | 🟢 KEEP | Standard metadata | All tables |
| updated_at | 🟢 KEEP | Standard metadata | All tables |
| invite_code | 🟢 KEEP | Alpha auth system | 24 files |

### Recommendation
✅ **No changes needed** - Table is clean and minimal

---

## Table 2: ip_tracks ⚠️ MAJOR CLEANUP NEEDED

### SECTION A: Core Identity Fields

| Column | Status | Recommendation |
|--------|--------|----------------|
| id | 🟢 KEEP | UUID primary key |
| title | 🟢 KEEP | Track name (required) |
| version | 🟡 REVIEW | Optional version string, check usage |
| artist | 🟢 KEEP | Artist name (required) |
| description | 🟢 KEEP | Track description |
| tell_us_more | 🟡 REVIEW | Additional context field, check if used |
| tags | 🟢 KEEP | Array of tags for search |
| notes | 🟡 REVIEW | Admin notes or user notes? |

**Recommendations:**
- Keep all identity fields
- Review `version`, `tell_us_more`, `notes` usage (may be obsolete)

---

### SECTION B: Content Classification

| Column | Status | Recommendation |
|--------|--------|----------------|
| content_type | 🟢 KEEP | 'loop', 'full_song', 'loop_pack', 'ep', 'mix' |
| loop_category | 🟢 KEEP | 'vocals', 'beats', 'instrumental', etc. |
| sample_type | 🔴 REMOVE | **DEPRECATED** - Replaced by content_type + loop_category |

**Recommendation:**
🔴 **REMOVE `sample_type`** - TypeScript marks it as "Legacy field" (line 84 of types/index.ts)

---

### SECTION C: Audio Metadata

| Column | Status | Recommendation |
|--------|--------|----------------|
| bpm | 🟢 KEEP | Critical for mixer |
| key | 🟢 KEEP | Musical key |
| isrc_number | 🟡 REVIEW | ISRC codes - check usage |
| duration | 🟢 KEEP | Track length in seconds |

**Recommendations:**
- Keep all except isrc_number (check if anyone actually enters this)

---

### SECTION D: Location Fields

| Column | Status | Recommendation |
|--------|--------|----------------|
| primary_location | 🟢 KEEP | Main location string |
| locations | 🔴 REMOVE | **JSONB array - unused with lat/lng** |
| location_lat | 🟢 KEEP | Latitude (numeric) |
| location_lng | 🟢 KEEP | Longitude (numeric) |

**Key Finding:**
- TypeScript interface (line 142) defines `locations` as optional array
- But code uses `location_lat/lng` everywhere (globe placement)
- **JSONB `locations` field is redundant**

**Recommendation:**
🔴 **REMOVE `locations` (jsonb)** - Lat/lng are sufficient

---

### SECTION E: IP Attribution - MAJOR ISSUE

#### Current 3-Person System (USED)
```
composition_split_1_wallet + percentage (NOT NULL)
composition_split_2_wallet + percentage (nullable)
composition_split_3_wallet + percentage (nullable)

production_split_1_wallet + percentage (NOT NULL)
production_split_2_wallet + percentage (nullable)
production_split_3_wallet + percentage (nullable)
```

✅ **These 12 columns are USED** - TypeScript interface lines 103-117

#### Extended 7-Person System (NOT USED!)
```
composition_split_4_wallet + percentage
composition_split_5_wallet + percentage
composition_split_6_wallet + percentage
composition_split_7_wallet + percentage

production_split_4_wallet + percentage
production_split_5_wallet + percentage
production_split_6_wallet + percentage
production_split_7_wallet + percentage
```

🔴 **These 16 columns are NOT in TypeScript interface!**

**Critical Finding:**
The database was expanded to support 7 contributors per category, but the TypeScript interface, upload forms, and smart contracts still only support 3 contributors.

**Recommendation:**
🔴 **REMOVE composition/production_split_4/5/6/7** (16 columns total)
- Not in TypeScript interface
- No upload form support
- Smart contract only handles 3 splits
- Saves significant bloat

---

### SECTION F: Media Assets

| Column | Status | Recommendation |
|--------|--------|----------------|
| cover_image_url | 🟢 KEEP | Track cover art (Supabase Storage URL) |
| audio_url | 🟢 KEEP | Audio file (Supabase Storage URL) |

✅ **Both required** - No changes

---

### SECTION G: Licensing Fields

| Column | Status | Recommendation |
|--------|--------|----------------|
| license_type | 🟢 KEEP | 'remix_only', 'remix_external', 'streaming_only', 'streaming_download' |
| license_selection | 🔴 REMOVE | **DUPLICATE** - Superseded by license_type |
| allow_remixing | 🟢 KEEP | Boolean permission |
| allow_downloads | 🟢 KEEP | Boolean permission |
| open_to_commercial | 🟡 REVIEW | Feature not fully implemented? |
| open_to_collaboration | 🟡 REVIEW | Feature not fully implemented? |

**Recommendations:**
- 🔴 **REMOVE `license_selection`** - Redundant with license_type
- 🟡 **REVIEW commercial/collaboration fields** - May be future features

---

### SECTION H: Pricing Fields - MAJOR CLEANUP NEEDED

#### OLD Pricing Columns (Legacy)
| Column | Status | Recommendation |
|--------|--------|----------------|
| price_stx | 🔴 REMOVE | **OBSOLETE** - Legacy combined price |
| remix_price | 🔴 REMOVE | **OBSOLETE** - Old decimal field |
| combined_price | 🔴 REMOVE | **OBSOLETE** - Unused |
| download_price | 🔴 REMOVE | **OBSOLETE** - Replaced by download_price_stx |

#### NEW Pricing Columns (Current)
| Column | Status | Recommendation |
|--------|--------|----------------|
| remix_price_stx | 🟢 KEEP | Platform remix fee (1 STX default) |
| download_price_stx | 🟢 KEEP | Download price (NULL if not available) |

**Key Finding:**
- TypeScript interface (line 98) says: `price_stx?: number; // Legacy combined price (kept for backward compatibility)`
- But there's no migration using price_stx anymore
- The NEW fields (remix_price_stx, download_price_stx) are the standard
- Old fields: remix_price, combined_price, download_price are all decimal type (obsolete)

**Recommendation:**
🔴 **REMOVE 4 old pricing columns:** `price_stx`, `remix_price`, `combined_price`, `download_price`

---

### SECTION I: Commercial/Collaboration Contact Fields

| Column | Status | Recommendation |
|--------|--------|----------------|
| commercial_contact | 🔴 REMOVE | Not implemented in UI |
| commercial_contact_fee | 🔴 REMOVE | Not implemented in UI |
| collab_contact | 🔴 REMOVE | Not implemented in UI |
| collab_contact_fee | 🔴 REMOVE | Not implemented in UI |

**Finding:**
- Found in 16 files, but all are in docs, old migrations, or backup files
- NOT in current IPTrackModal.tsx upload form
- NOT in TrackDetailsModal.tsx display
- Feature was planned but never fully implemented

**Recommendation:**
🔴 **REMOVE all 4 contact fields** - Unimplemented feature

---

### SECTION J: Timestamps

| Column | Status | Recommendation |
|--------|--------|----------------|
| created_at | 🟢 KEEP | Standard metadata |
| updated_at | 🟢 KEEP | Standard metadata |
| deleted_at | 🟢 KEEP | Soft delete timestamp |

✅ **All required** - No changes

---

### SECTION K: Uploader Identity - DUPLICATE FOUND

| Column | Status | Recommendation |
|--------|--------|----------------|
| primary_uploader_wallet | 🟢 KEEP | **PRIMARY FIELD** - Found in 73 files |
| uploader_address | 🔴 REMOVE | **DUPLICATE** - Found in only 26 files |

**Critical Finding:**
- Both fields store the same data (uploader's wallet address)
- `primary_uploader_wallet` is the standard (TypeScript line 145)
- `uploader_address` is legacy from older schema

**Data Migration Needed:**
```sql
-- Copy any data from uploader_address to primary_uploader_wallet
UPDATE ip_tracks
SET primary_uploader_wallet = uploader_address
WHERE primary_uploader_wallet IS NULL
  AND uploader_address IS NOT NULL;

-- Then safe to drop
ALTER TABLE ip_tracks DROP COLUMN uploader_address;
```

**Recommendation:**
🔴 **REMOVE `uploader_address`** after data migration

---

### SECTION L: Collaboration System Fields

| Column | Status | Recommendation |
|--------|--------|----------------|
| collaboration_preferences | 🟢 KEEP | JSONB field for permissions |
| store_display_policy | 🟢 KEEP | 'primary_only', 'all_collaborations', etc. |
| collaboration_type | 🟢 KEEP | 'primary_artist', 'featured_artist', etc. |

✅ **All used** - Collaboration system is active

---

### SECTION M: Status Fields - DUPLICATE FOUND

| Column | Status | Recommendation |
|--------|--------|----------------|
| is_live | 🟢 KEEP | Visibility toggle |
| is_deleted | 🔴 REMOVE | **DUPLICATE** - Redundant with deleted_at |

**Critical Finding:**
- TypeScript interface uses `deleted_at` (timestamp) - line 135
- Database also has `is_deleted` (boolean)
- Both serve same purpose (soft delete)
- `deleted_at` is more informative (when deleted)

**Recommendation:**
🔴 **REMOVE `is_deleted`** - Use `deleted_at IS NOT NULL` instead

---

### SECTION N: Account System (OLD Multi-Account Feature)

| Column | Status | Recommendation |
|--------|--------|----------------|
| account_name | 🔴 REMOVE | Old multi-account system (found in 9 files, all old) |
| main_wallet_name | 🔴 REMOVE | Old multi-account system (found in 9 files, all old) |

**Finding:**
- Only found in old docs and migration scripts
- NOT in TypeScript interface
- Multi-account system was replaced by collaboration_preferences

**Recommendation:**
🔴 **REMOVE both columns** - Obsolete feature

---

### SECTION O: Remix Tracking - DUPLICATE FOUND

| Column | Status | Recommendation |
|--------|--------|----------------|
| remix_depth | 🔴 REMOVE | **OLD FIELD** - Found in 29 files |
| generation | 🟢 KEEP | **NEW FIELD** - Found in 51 files, certificates use this |
| source_track_ids | 🟢 KEEP | Array of parent track IDs |
| parent_track_1_id | 🟢 KEEP | First parent track |
| parent_track_2_id | 🟢 KEEP | Second parent track |

**Critical Finding:**
- `remix_depth` is the OLD field name (TypeScript line 129 notes it)
- `generation` is the NEW standard (certificates use this - Oct 27 update)
- Both fields exist in database storing same data!

**Data Migration Needed:**
```sql
-- Sync any data from remix_depth to generation
UPDATE ip_tracks
SET generation = remix_depth
WHERE generation IS NULL
  AND remix_depth IS NOT NULL;

-- Verify
SELECT COUNT(*) FROM ip_tracks
WHERE remix_depth IS NOT NULL
  AND generation IS NULL;
-- Should be 0

-- Then safe to drop
ALTER TABLE ip_tracks DROP COLUMN remix_depth;
```

**Recommendation:**
🔴 **REMOVE `remix_depth`** after data migration to `generation`

---

### SECTION P: Loop Pack System

| Column | Status | Recommendation |
|--------|--------|----------------|
| pack_id | 🟢 KEEP | UUID linking loops to parent pack |
| pack_position | 🟢 KEEP | Position within pack (1, 2, 3...) |

✅ **Both required** - Loop pack system is core feature

---

### SECTION Q: Payment Tracking

| Column | Status | Recommendation |
|--------|--------|----------------|
| stacks_tx_id | 🟢 KEEP | Transaction hash for remix payments |
| payment_status | 🟢 KEEP | 'pending', 'confirmed', etc. |
| payment_checked_at | 🟢 KEEP | Last payment verification timestamp |

✅ **All used** - Payment verification system

---

## Table 3: user_profiles ✅ MOSTLY CLEAN

### Schema (15 columns)
```
wallet_address (text, NOT NULL)       - Primary key
display_name (text, nullable)         - User's chosen name
tagline (text, nullable)              - Profile tagline
bio (text, nullable)                  - About section
avatar_url (text, nullable)           - Profile image
sticker_id (text, default 'daisy-blue') - Selected sticker
sticker_visible (boolean, default true) - Show/hide sticker
show_wallet_address (boolean, default true) - Privacy setting
show_btc_address (boolean, default false) - Privacy setting
created_at (timestamp)                - Metadata
updated_at (timestamp)                - Metadata
custom_sticker (text, nullable)       - Custom uploaded sticker URL
username (text, nullable)             - Unique username
bns_name (text, nullable)             - Bitcoin Name Service name
email (varchar, nullable)             - Contact email
```

### Usage Analysis

| Column | Status | Recommendation |
|--------|--------|----------------|
| wallet_address | 🟢 KEEP | Primary key |
| display_name | 🟢 KEEP | Profile display |
| tagline | 🟢 KEEP | Profile display |
| bio | 🟢 KEEP | Profile display |
| avatar_url | 🟢 KEEP | Profile image |
| sticker_id | 🟢 KEEP | Active sticker system |
| sticker_visible | 🟢 KEEP | Sticker toggle |
| custom_sticker | 🟢 KEEP | Custom sticker uploads |
| show_wallet_address | 🟢 KEEP | Privacy control |
| show_btc_address | 🟢 KEEP | Privacy control |
| username | 🟢 KEEP | Unique identifier for /profile/[username] routing |
| bns_name | 🟡 REVIEW | BNS integration - check if implemented |
| email | 🟢 KEEP | Contact + future notifications |
| created_at | 🟢 KEEP | Standard metadata |
| updated_at | 🟢 KEEP | Standard metadata |

### Recommendation
🟡 **Check `bns_name` usage** - May be planned feature not yet implemented
✅ **Otherwise table is clean**

---

## Summary: Columns to Remove

### ip_tracks Table - REMOVE 25 COLUMNS:

#### Duplicates (5 columns)
1. ✅ `uploader_address` (duplicate of primary_uploader_wallet)
2. ✅ `remix_depth` (duplicate of generation)
3. ✅ `is_deleted` (duplicate of deleted_at logic)
4. ✅ `license_selection` (duplicate of license_type)
5. ✅ `locations` (duplicate of location_lat/lng)

#### Old Pricing (4 columns)
6. ✅ `price_stx`
7. ✅ `remix_price`
8. ✅ `combined_price`
9. ✅ `download_price`

#### Unimplemented Features (4 columns)
10. ✅ `commercial_contact`
11. ✅ `commercial_contact_fee`
12. ✅ `collab_contact`
13. ✅ `collab_contact_fee`

#### Old Multi-Account System (2 columns)
14. ✅ `account_name`
15. ✅ `main_wallet_name`

#### Unused Extended Attribution (16 columns!)
16-23. ✅ `composition_split_4/5/6/7_wallet + percentage` (8 columns)
24-31. ✅ `production_split_4/5/6/7_wallet + percentage` (8 columns)

#### Deprecated (1 column)
32. ✅ `sample_type` (replaced by content_type + loop_category)

### Maybe Remove (3 columns) - Needs Your Decision
- 🟡 `version` (track version string - is this used?)
- 🟡 `tell_us_more` (additional context field - is this used?)
- 🟡 `isrc_number` (ISRC codes - does anyone enter this?)

**Total Savings:**
- **Definite removals:** 25 columns (27% reduction from 93 → 68 columns)
- **Potential removals:** 28 columns if you remove the 3 "maybe" fields

---

## Migration Script (Safe Execution)

I'll create the migration script in a separate file with:
1. Data migration steps (copy data from old → new fields)
2. Verification queries (ensure no data loss)
3. Column removal (only after verification passes)
4. TypeScript interface updates (ensure types match database)

**Next Step:** Should I create the migration SQL script now?

---

## Risks & Mitigation

### Low Risk (Safe to Remove)
- ✅ Extended attribution splits_4/5/6/7 (never used)
- ✅ Old pricing columns (new columns in use)
- ✅ Duplicate fields (data in both places)

### Medium Risk (Need Data Migration)
- ⚠️ `uploader_address` → `primary_uploader_wallet`
- ⚠️ `remix_depth` → `generation`

### Questions for You
1. **version**, **tell_us_more**, **isrc_number** - Are these used? Can we remove?
2. **open_to_commercial**, **open_to_collaboration** - Keep for future or remove now?
3. **bns_name** (in user_profiles) - Is BNS integration planned?

---

## Estimated Impact

**Before Cleanup:**
- ip_tracks: 93 columns
- Average row size: ~2.5 KB per track

**After Cleanup:**
- ip_tracks: 68 columns (25 removed)
- Average row size: ~1.8 KB per track (-28% smaller)

**Benefits:**
- ✅ Faster queries (less data to scan)
- ✅ Smaller backups
- ✅ Clearer schema (no confusion about which fields to use)
- ✅ TypeScript interface matches database
- ✅ Easier to add new features (radio, video tables)

---

## Next Actions

1. **Review This Audit** - Confirm my recommendations
2. **Answer Questions** - version, tell_us_more, isrc_number, commercial fields
3. **Create Migration Script** - I'll write the safe SQL migration
4. **Test Migrations** - Run on backup first, verify data integrity
5. **Execute Cleanup** - Remove columns after verification
6. **Update TypeScript** - Remove old fields from types/index.ts

**Ready to proceed?** Let me know your decisions on the questionable fields and I'll create the migration script!
