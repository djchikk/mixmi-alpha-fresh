# Database Cleanup Analysis

**Date:** October 26, 2025
**Purpose:** Identify and remove duplicate, deprecated, and unused fields from production schema

---

## CRITICAL DUPLICATES (Must Fix)

### 1. Uploader Wallet Fields (BOTH NOT NULL!)

```sql
-- DUPLICATE:
primary_uploader_wallet TEXT NOT NULL
uploader_address TEXT NOT NULL
```

**Issue:** Both fields are required and likely contain the same data
**Impact:** Wastes storage, confusing which to use
**Recommendation:** Keep `primary_uploader_wallet`, drop `uploader_address`
**Reason:** `primary_uploader_wallet` is more descriptive and matches documentation

---

### 2. Remix Generation Tracking

```sql
-- DUPLICATE:
remix_depth INTEGER DEFAULT 0
generation INTEGER DEFAULT 0
```

**Issue:** Same purpose (track remix generation depth)
**Impact:** Could have inconsistent values
**Recommendation:** Keep `remix_depth`, drop `generation`
**Reason:** `remix_depth` matches documentation and is more descriptive

---

### 3. Parent Track References

```sql
-- DUPLICATE:
source_track_ids TEXT[] DEFAULT '{}'  -- Array of UUIDs
parent_track_1_id UUID
parent_track_2_id UUID
```

**Issue:** `source_track_ids` array can hold both parent IDs, making the individual fields redundant
**Impact:** Data could be out of sync
**Recommendation:** Keep `source_track_ids` (array), drop `parent_track_1_id` and `parent_track_2_id`
**Reason:** Array is more flexible for future Gen 2+ remixes with more parents

---

### 4. Pricing Fields (OLD vs NEW)

```sql
-- OLD PRICING MODEL (DEPRECATED):
price_stx NUMERIC DEFAULT 0
remix_price NUMERIC DEFAULT 0.5
combined_price NUMERIC DEFAULT 2.5
download_price NUMERIC DEFAULT 2.5

-- NEW PRICING MODEL (CURRENT):
remix_price_stx NUMERIC DEFAULT 1.0
download_price_stx NUMERIC DEFAULT NULL
```

**Issue:** Old and new pricing models coexist
**Impact:** Confusing which to use, potential for inconsistent data
**Recommendation:**
- Keep `remix_price_stx` and `download_price_stx` (new model)
- Drop `price_stx`, `remix_price`, `combined_price`, `download_price` (old model)
**Migration:** Copy data if needed before dropping

---

### 5. License Fields

```sql
-- POSSIBLY DUPLICATE:
license_type TEXT DEFAULT 'remix_only'
license_selection TEXT DEFAULT 'platform_remix'
```

**Issue:** Both relate to licensing, likely overlapping
**Need to verify:** Check code usage to see if both are needed
**Recommendation:** Likely can consolidate to one field

---

## UNUSED FIELDS (Verify Before Dropping)

### High Confidence - Probably Unused

```sql
-- Unclear purpose:
account_name TEXT
main_wallet_name TEXT

-- Commercial licensing (no UI for this):
open_to_commercial BOOLEAN DEFAULT false
commercial_contact TEXT
commercial_contact_fee NUMERIC DEFAULT 10

-- Collaboration contact (no UI for this):
collab_contact TEXT
collab_contact_fee NUMERIC DEFAULT 1

-- Transaction tracking (not seen in code):
stacks_tx_id TEXT
payment_status TEXT DEFAULT 'pending'
payment_checked_at TIMESTAMP WITH TIME ZONE
```

### Need Code Verification

```sql
-- Check if these are actually written/read:
duration INTEGER
is_live BOOLEAN DEFAULT true
notes TEXT  -- (appears in both alpha_users and ip_tracks!)
```

---

## EXTENDED SPLITS (Documentation Mismatch!)

### Current Schema: 7 Splits Per Category

```sql
-- COMPOSITION (7 possible):
composition_split_1_wallet TEXT NOT NULL
composition_split_1_percentage INTEGER NOT NULL DEFAULT 100
composition_split_2_wallet TEXT
composition_split_2_percentage INTEGER DEFAULT 0
composition_split_3_wallet TEXT
composition_split_3_percentage INTEGER DEFAULT 0
composition_split_4_wallet TEXT      -- ⚠️ Not in docs!
composition_split_4_percentage INTEGER
composition_split_5_wallet TEXT      -- ⚠️ Not in docs!
composition_split_5_percentage INTEGER
composition_split_6_wallet TEXT      -- ⚠️ Not in docs!
composition_split_6_percentage INTEGER
composition_split_7_wallet TEXT      -- ⚠️ Not in docs!
composition_split_7_percentage INTEGER

-- PRODUCTION (same pattern for 7)
```

**Documentation Said:** 3 max per category
**Actual Schema:** 7 max per category

**Questions:**
1. Is the UI capped at 3 but DB supports 7?
2. Are splits 4-7 ever used?
3. Smart contract supports 50 - why stop at 7?

**Recommendation:**
- **If splits 4-7 are unused:** Drop them (keep 3 max)
- **If they're used:** Update documentation to reflect 7 max
- **Either way:** Be consistent between code, docs, and DB

---

## ALPHA_USERS TABLE ISSUES

### Schema Mismatch

**Documentation Said:**
```sql
wallet_address TEXT PRIMARY KEY
alpha_code TEXT UNIQUE NOT NULL
approved_at TIMESTAMP
is_active BOOLEAN DEFAULT true
```

**Actual Schema:**
```sql
wallet_address TEXT PRIMARY KEY
invite_code VARCHAR(12)           -- ⚠️ Not 'alpha_code'
artist_name TEXT NOT NULL          -- ⚠️ Not documented
email TEXT                         -- ⚠️ Not documented
notes TEXT                         -- ⚠️ Not documented
approved BOOLEAN DEFAULT true      -- ⚠️ Not 'is_active'
created_at TIMESTAMP
updated_at TIMESTAMP
```

**Issues:**
1. Field names don't match (`invite_code` vs `alpha_code`)
2. Extra fields: `artist_name`, `email`, `notes`
3. Missing `is_active` (has `approved` instead)
4. Missing `approved_at` timestamp

**Questions:**
- Is `artist_name` used? (Could be redundant with `ip_tracks.artist`)
- Is `email` collected during alpha signup?
- What are `notes` for?

**Recommendation:**
- Rename `invite_code` → `alpha_code` (matches docs/code)
- Rename `approved` → `is_active` (more descriptive)
- Add `approved_at TIMESTAMP` (useful for analytics)
- Verify if `artist_name`, `email`, `notes` are needed

---

## USER_PROFILES EXTRA FIELD

```sql
-- Not documented:
bns_name TEXT
```

**Question:** Is BNS (Bitcoin Name System) integration planned?
**If no:** Drop the field
**If yes:** Document it

---

## FIELD NAMING INCONSISTENCIES

### ISRC Code

```sql
-- In schema:
isrc_number TEXT

-- In TypeScript:
isrc?: string
```

**Recommendation:** Rename `isrc_number` → `isrc` (matches TypeScript)

---

## COMPLETE CLEANUP CHECKLIST

### Phase 1: Verify Usage (Code Grep)

Run these searches to verify field usage:

```bash
# Check for uploader_address
grep -r "uploader_address" --include="*.ts" --include="*.tsx"

# Check for generation field
grep -r "generation" --include="*.ts" --include="*.tsx"

# Check for parent_track fields
grep -r "parent_track" --include="*.ts" --include="*.tsx"

# Check for old pricing fields
grep -r "price_stx\|remix_price\|combined_price\|download_price[^_]" --include="*.ts" --include="*.tsx"

# Check for commercial/collab fields
grep -r "commercial_contact\|collab_contact" --include="*.ts" --include="*.tsx"

# Check splits 4-7
grep -r "split_[4567]" --include="*.ts" --include="*.tsx"

# Check account_name, main_wallet_name
grep -r "account_name\|main_wallet_name" --include="*.ts" --include="*.tsx"

# Check stacks_tx_id, payment_status
grep -r "stacks_tx_id\|payment_status\|payment_checked_at" --include="*.ts" --include="*.tsx"

# Check duration, is_live, notes
grep -r "duration\|is_live\|\.notes" --include="*.ts" --include="*.tsx"
```

---

### Phase 2: Backup Strategy

**Before ANY schema changes:**

```sql
-- 1. Create archive tables
CREATE TABLE ip_tracks_backup_2025_10_26 AS
SELECT * FROM ip_tracks;

CREATE TABLE alpha_users_backup_2025_10_26 AS
SELECT * FROM alpha_users;

CREATE TABLE user_profiles_backup_2025_10_26 AS
SELECT * FROM user_profiles;

-- 2. Verify backups
SELECT COUNT(*) FROM ip_tracks;
SELECT COUNT(*) FROM ip_tracks_backup_2025_10_26;
-- Counts should match

-- 3. Export to CSV (via Supabase Dashboard)
-- Download each table as CSV for extra safety
```

---

### Phase 3: Proposed Migration SQL

**⚠️ DO NOT RUN YET - Need to verify field usage first**

```sql
-- ============================================
-- MIGRATION: Database Cleanup
-- Date: 2025-10-26
-- Purpose: Remove duplicates and deprecated fields
-- ============================================

BEGIN;

-- ============================================
-- BACKUP CHECK
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ip_tracks_backup_2025_10_26') THEN
    RAISE EXCEPTION 'Backup table not found! Create backups before running this migration.';
  END IF;
END $$;

-- ============================================
-- IP_TRACKS CLEANUP
-- ============================================

-- 1. Drop duplicate uploader field
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS uploader_address;

-- 2. Drop duplicate generation field
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS generation;

-- 3. Drop duplicate parent track fields (use source_track_ids array instead)
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS parent_track_1_id;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS parent_track_2_id;

-- 4. Drop old pricing fields (use remix_price_stx and download_price_stx)
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS price_stx;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS remix_price;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS combined_price;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS download_price;

-- 5. Drop unused commercial/collab fields (verify first!)
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS open_to_commercial;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS commercial_contact;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS commercial_contact_fee;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS collab_contact;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS collab_contact_fee;

-- 6. Drop unused tracking fields (verify first!)
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS stacks_tx_id;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS payment_status;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS payment_checked_at;

-- 7. Drop unclear fields (verify first!)
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS account_name;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS main_wallet_name;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS notes;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS is_live;

-- 8. Drop extended splits 4-7 (verify not used first!)
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS composition_split_4_wallet;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS composition_split_4_percentage;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS composition_split_5_wallet;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS composition_split_5_percentage;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS composition_split_6_wallet;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS composition_split_6_percentage;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS composition_split_7_wallet;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS composition_split_7_percentage;

ALTER TABLE ip_tracks DROP COLUMN IF EXISTS production_split_4_wallet;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS production_split_4_percentage;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS production_split_5_wallet;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS production_split_5_percentage;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS production_split_6_wallet;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS production_split_6_percentage;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS production_split_7_wallet;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS production_split_7_percentage;

-- 9. Rename for consistency
ALTER TABLE ip_tracks RENAME COLUMN isrc_number TO isrc;

-- 10. Drop duplicate license field (verify first!)
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS license_selection;

-- ============================================
-- ALPHA_USERS CLEANUP
-- ============================================

-- 1. Rename for consistency with docs/code
ALTER TABLE alpha_users RENAME COLUMN invite_code TO alpha_code;
ALTER TABLE alpha_users RENAME COLUMN approved TO is_active;

-- 2. Add missing approved_at timestamp
ALTER TABLE alpha_users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Drop potentially unused fields (verify first!)
ALTER TABLE alpha_users DROP COLUMN IF EXISTS artist_name;
ALTER TABLE alpha_users DROP COLUMN IF EXISTS email;
ALTER TABLE alpha_users DROP COLUMN IF EXISTS notes;

-- ============================================
-- USER_PROFILES CLEANUP
-- ============================================

-- Drop BNS field if not being used (verify first!)
ALTER TABLE user_profiles DROP COLUMN IF EXISTS bns_name;

COMMIT;
```

---

## ESTIMATED IMPACT

### Storage Savings

**Current unnecessary columns in ip_tracks:**
- ~25 deprecated/duplicate fields
- Average alpha user has ~2 tracks
- ~30 alpha users = ~60 rows

**Not huge savings now, but:**
- Prevents confusion
- Improves query performance
- Makes schema maintainable
- Prevents bugs from using wrong fields

---

## NEXT STEPS

1. **I'll grep the codebase** for all questionable fields
2. **You review my findings** - decide what's safe to drop
3. **Create backups** (I'll generate exact SQL)
4. **Run migration** in stages (test on backup DB first if possible)
5. **Update TypeScript types** to match cleaned schema
6. **Update documentation** to reflect reality

---

## QUESTIONS FOR YOU

1. **Splits 4-7:** Are these actually used anywhere? UI only shows 3, but DB has 7
2. **Alpha users fields:** Do you collect `artist_name` and `email` during signup?
3. **Commercial licensing:** Are those fields planned or can we drop them?
4. **BNS integration:** Is `bns_name` in user_profiles being used?
5. **License fields:** Do we need both `license_type` AND `license_selection`?

Let me grep the code now to answer these!
