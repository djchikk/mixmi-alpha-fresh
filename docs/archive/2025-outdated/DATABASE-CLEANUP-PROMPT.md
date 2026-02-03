# Database Cleanup Task - Handoff Prompt for New Claude Code Session

**Date:** October 26, 2025
**Project:** mixmi Alpha Platform
**Task:** Analyze and clean up Supabase database schema

---

## Context

You're working on **mixmi Alpha**, a Next.js 14 music platform with:
- **Database:** Supabase (PostgreSQL)
- **3 main tables:** `ip_tracks`, `alpha_users`, `user_profiles`
- **Problem:** Schema has evolved over time with duplicate, deprecated, and unused fields
- **Goal:** Clean up schema before it gets more complex (currently ~30 alpha users, ~60 tracks)

---

## What's Already Done

I've analyzed the actual Supabase schema and identified major issues. See the full analysis in:
`/Users/sandyhoover/Desktop/mixmi-alpha-fresh-8/docs/DATABASE-CLEANUP-ANALYSIS.md`

**Key findings:**
- **Duplicate uploader fields:** `primary_uploader_wallet` AND `uploader_address` (both NOT NULL!)
- **Duplicate generation tracking:** `remix_depth` AND `generation`
- **Duplicate parent references:** `source_track_ids` array AND `parent_track_1_id/parent_track_2_id`
- **Old pricing model still present:** `price_stx`, `remix_price`, `combined_price`, `download_price` (replaced by `remix_price_stx` and `download_price_stx`)
- **Extended splits:** Schema has 7 splits per category, but UI/docs only mention 3
- **Unclear fields:** `account_name`, `main_wallet_name`, `commercial_contact`, `stacks_tx_id`, etc.

---

## Your Task

### Phase 1: Verify Field Usage (Code Grep)

Run these searches to determine which fields are actually being used in the codebase:

#### 1. Check Duplicate Uploader Fields

```bash
cd /Users/sandyhoover/Desktop/mixmi-alpha-fresh-8

# How many times is each used?
echo "=== primary_uploader_wallet usage ==="
grep -r "primary_uploader_wallet" --include="*.ts" --include="*.tsx" --include="*.js" | wc -l

echo "=== uploader_address usage ==="
grep -r "uploader_address" --include="*.ts" --include="*.tsx" --include="*.js" | wc -l

# Show actual usage
grep -r "uploader_address" --include="*.ts" --include="*.tsx" --include="*.js"
```

**Expected:** `primary_uploader_wallet` used everywhere, `uploader_address` rarely/never used

---

#### 2. Check Duplicate Generation Fields

```bash
echo "=== remix_depth usage ==="
grep -r "remix_depth" --include="*.ts" --include="*.tsx" | wc -l

echo "=== generation field usage ==="
grep -r "\.generation\|generation:" --include="*.ts" --include="*.tsx" | grep -v "// " | wc -l

# Show actual usage
grep -r "\.generation[^a-zA-Z]" --include="*.ts" --include="*.tsx"
```

**Expected:** `remix_depth` used, `generation` unused

---

#### 3. Check Parent Track References

```bash
echo "=== source_track_ids usage ==="
grep -r "source_track_ids" --include="*.ts" --include="*.tsx" | wc -l

echo "=== parent_track fields usage ==="
grep -r "parent_track_[12]_id" --include="*.ts" --include="*.tsx" | wc -l

# Show actual usage
grep -r "parent_track" --include="*.ts" --include="*.tsx"
```

**Expected:** `source_track_ids` used, `parent_track_*` unused

---

#### 4. Check Old vs New Pricing Fields

```bash
echo "=== NEW pricing model (remix_price_stx, download_price_stx) ==="
grep -r "remix_price_stx\|download_price_stx" --include="*.ts" --include="*.tsx" | wc -l

echo "=== OLD pricing model (price_stx, remix_price, download_price) ==="
grep -r "\.price_stx\|\.remix_price[^_]\|\.download_price[^_]\|\.combined_price" --include="*.ts" --include="*.tsx" | wc -l

# Show actual usage of old fields
grep -r "\.price_stx" --include="*.ts" --include="*.tsx" | head -20
```

**Expected:** New pricing fields used extensively, old fields may have some legacy usage

---

#### 5. Check Splits 4-7 (Extended Splits)

```bash
echo "=== Splits 1-3 usage ==="
grep -r "split_[123]_wallet" --include="*.ts" --include="*.tsx" | wc -l

echo "=== Splits 4-7 usage ==="
grep -r "split_[4567]_wallet\|split_[4567]_percentage" --include="*.ts" --include="*.tsx" | wc -l

# Show actual usage
grep -r "split_[4567]" --include="*.ts" --include="*.tsx"
```

**User said:** "7 wallet addresses per track are there to accommodate remix generation 1. Assuming that we are only starting with 7 total for generation 0."

**Question to answer:** Are splits 4-7 actually implemented in the UI? Or just in the schema but not used yet?

---

#### 6. Check Commercial/Collaboration Fields

```bash
echo "=== Commercial licensing fields ==="
grep -r "open_to_commercial\|commercial_contact\|commercial_contact_fee" --include="*.ts" --include="*.tsx"

echo "=== Collaboration contact fields ==="
grep -r "collab_contact\|collab_contact_fee" --include="*.ts" --include="*.tsx"
```

**Expected:** Probably unused (no UI for these)

---

#### 7. Check Unclear/Mystery Fields

```bash
echo "=== account_name usage ==="
grep -r "account_name" --include="*.ts" --include="*.tsx"

echo "=== main_wallet_name usage ==="
grep -r "main_wallet_name" --include="*.ts" --include="*.tsx"

echo "=== stacks_tx_id usage ==="
grep -r "stacks_tx_id" --include="*.ts" --include="*.tsx"

echo "=== payment_status usage ==="
grep -r "payment_status\|payment_checked_at" --include="*.ts" --include="*.tsx"

echo "=== duration field usage ==="
grep -r "\.duration\|duration:" --include="*.ts" --include="*.tsx" | grep -v "transition-duration"

echo "=== is_live usage ==="
grep -r "\.is_live\|is_live:" --include="*.ts" --include="*.tsx"

echo "=== notes field usage (in ip_tracks) ==="
grep -r "track\.notes\|\.notes" --include="*.ts" --include="*.tsx" | grep -v "// "
```

---

#### 8. Check License Fields

```bash
echo "=== license_type usage ==="
grep -r "license_type" --include="*.ts" --include="*.tsx" | wc -l

echo "=== license_selection usage ==="
grep -r "license_selection" --include="*.ts" --include="*.tsx" | wc -l

# Show usage
grep -r "license_type\|license_selection" --include="*.ts" --include="*.tsx"
```

**Expected:** Probably only one is used

---

#### 9. Check Alpha Users Extra Fields

```bash
echo "=== alpha_users.artist_name usage ==="
grep -r "artist_name" --include="*.ts" --include="*.tsx" | grep -i alpha

echo "=== alpha_users.email usage ==="
grep -r "\.email" --include="*.ts" --include="*.tsx" | grep -i alpha

echo "=== alpha_users.notes usage ==="
grep -r "\.notes" --include="*.ts" --include="*.tsx" | grep -i alpha
```

---

#### 10. Check TypeScript Types

```bash
# See what fields are in the TypeScript interface
cat types/index.ts | grep -A 200 "export interface IPTrack"
```

**Important:** If a field is NOT in the TypeScript types but IS in the database, it's likely unused!

---

### Phase 2: Analyze Results

Create a report answering these questions:

1. **Which duplicate fields can be safely dropped?**
   - `uploader_address` → Keep `primary_uploader_wallet`?
   - `generation` → Keep `remix_depth`?
   - `parent_track_*` → Keep `source_track_ids` array?

2. **Which old pricing fields can be dropped?**
   - Are `price_stx`, `remix_price`, `combined_price`, `download_price` still needed?
   - Or fully replaced by `remix_price_stx` and `download_price_stx`?

3. **Are splits 4-7 being used?**
   - If not in TypeScript types → probably safe to drop
   - If not in UI code → probably safe to drop
   - Ask user before dropping (they mentioned Gen 1 remix needs this)

4. **Which mystery fields are unused?**
   - `account_name`, `main_wallet_name` → Drop?
   - `commercial_contact`, `collab_contact` → Drop?
   - `stacks_tx_id`, `payment_status` → Drop or keep for future?
   - `duration`, `is_live`, `notes` → Drop?

5. **Can we consolidate license fields?**
   - `license_type` vs `license_selection` → Keep one?

6. **Alpha users table cleanup?**
   - Rename `invite_code` → `alpha_code` (matches docs)
   - Rename `approved` → `is_active` (more descriptive)
   - Drop `artist_name`, `email`, `notes` if unused

---

### Phase 3: Create Backup Strategy

Generate SQL for creating backup tables:

```sql
-- BACKUP SCRIPT
-- Run this BEFORE any schema changes!
-- Date: 2025-10-26

BEGIN;

-- 1. Create backup tables with timestamp
CREATE TABLE ip_tracks_backup_2025_10_26 AS
SELECT * FROM ip_tracks;

CREATE TABLE alpha_users_backup_2025_10_26 AS
SELECT * FROM alpha_users;

CREATE TABLE user_profiles_backup_2025_10_26 AS
SELECT * FROM user_profiles;

-- 2. Verify backup counts match
DO $$
DECLARE
  orig_count INTEGER;
  backup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orig_count FROM ip_tracks;
  SELECT COUNT(*) INTO backup_count FROM ip_tracks_backup_2025_10_26;

  IF orig_count != backup_count THEN
    RAISE EXCEPTION 'ip_tracks backup count mismatch! Original: %, Backup: %', orig_count, backup_count;
  END IF;

  RAISE NOTICE 'ip_tracks backup verified: % rows', orig_count;
END $$;

COMMIT;

-- 3. Also recommend CSV export via Supabase Dashboard
-- Table Editor → Select table → "..." menu → Export as CSV
```

---

### Phase 4: Generate Migration SQL

Based on your grep results, create a migration SQL file that:

1. **Drops confirmed duplicates** (e.g., `uploader_address` if `primary_uploader_wallet` is used everywhere)
2. **Drops confirmed deprecated fields** (e.g., old pricing if new pricing is fully adopted)
3. **Renames for consistency** (e.g., `invite_code` → `alpha_code`)
4. **Adds missing fields** (e.g., `approved_at` timestamp to alpha_users)
5. **Has rollback plan** (comments showing how to restore from backup)

**Template:**

```sql
-- ============================================
-- mixmi DATABASE CLEANUP MIGRATION
-- Date: 2025-10-26
-- Purpose: Remove duplicate/deprecated fields
-- Backup: ip_tracks_backup_2025_10_26 (etc.)
-- ============================================

-- SAFETY CHECK: Ensure backups exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'ip_tracks_backup_2025_10_26'
  ) THEN
    RAISE EXCEPTION 'BACKUP NOT FOUND! Create backups before running migration.';
  END IF;
END $$;

BEGIN;

-- ============================================
-- IP_TRACKS: Drop Duplicates
-- ============================================

-- 1. Drop uploader_address (keeping primary_uploader_wallet)
-- Verified by grep: uploader_address has 0 usages
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS uploader_address;

-- 2. Drop generation (keeping remix_depth)
-- Verified by grep: generation has 0 usages
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS generation;

-- ... (continue based on grep results)

-- ============================================
-- IP_TRACKS: Rename for Consistency
-- ============================================

ALTER TABLE ip_tracks RENAME COLUMN isrc_number TO isrc;

-- ============================================
-- ALPHA_USERS: Cleanup
-- ============================================

ALTER TABLE alpha_users RENAME COLUMN invite_code TO alpha_code;
ALTER TABLE alpha_users RENAME COLUMN approved TO is_active;
ALTER TABLE alpha_users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================
-- ROLLBACK PLAN (if needed)
-- ============================================
-- If migration causes issues, restore from backup:
-- DROP TABLE ip_tracks;
-- ALTER TABLE ip_tracks_backup_2025_10_26 RENAME TO ip_tracks;

COMMIT;
```

---

### Phase 5: Update TypeScript Types

After migration, update `types/index.ts` to match the cleaned schema.

Generate a diff showing:
- Fields removed from interface
- Fields renamed
- Any new fields added

---

## Important Context from User

**From conversation:**
> "The 7 wallet addresses per track are there to accommodate remix generation 1. Assuming that we are only starting with 7 total for generation 0."

**Translation:** Splits 4-7 may be intentional for future Gen 1 remix attribution. Don't drop these without confirming with user!

**Also mentioned:**
> "We are in the middle of trying to decide if we are moving to a different blockchain and the implications of that."

**Translation:** Payment-related fields might be in flux. Be cautious about dropping payment_status, stacks_tx_id, etc. - ask user first.

---

## Deliverables

Create these files in `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-8/docs/`:

1. **`DATABASE-FIELD-USAGE-REPORT.md`**
   - Results of all grep commands
   - Field-by-field analysis (used/unused)
   - Recommendations (keep/drop/rename)

2. **`DATABASE-BACKUP-STRATEGY.sql`**
   - Complete backup SQL
   - Verification queries
   - Restoration instructions

3. **`DATABASE-CLEANUP-MIGRATION.sql`**
   - Production-ready migration
   - Well-commented
   - Includes rollback plan
   - Grouped by table and purpose

4. **`TYPESCRIPT-TYPES-UPDATE.md`**
   - Diff showing type changes needed
   - Updated IPTrack interface
   - Updated alpha_users/user_profiles types

---

## Schema Reference

The actual Supabase schema was exported and is in the conversation history. Key tables:

### alpha_users
- `wallet_address` TEXT PRIMARY KEY
- `invite_code` VARCHAR(12) ← Should rename to `alpha_code`
- `artist_name` TEXT ← Check if used
- `email` TEXT ← Check if used
- `notes` TEXT ← Check if used
- `approved` BOOLEAN ← Should rename to `is_active`
- `created_at`, `updated_at` TIMESTAMP

### ip_tracks (97 fields! Way too many!)
- Many duplicates and deprecated fields
- See DATABASE-CLEANUP-ANALYSIS.md for full details

### user_profiles
- `wallet_address` TEXT PRIMARY KEY
- `username` TEXT UNIQUE
- `display_name`, `tagline`, `bio`, `avatar_url`
- `sticker_id`, `bns_name` ← Check if bns_name is used

---

## Questions for User (After Analysis)

After your grep analysis, ask the user:

1. **Splits 4-7:** "I found that splits 4-7 are [used/not used] in the code. Given that you mentioned they're for Gen 1 remix attribution, should we keep them or drop them for now?"

2. **Old pricing fields:** "The old pricing fields (price_stx, remix_price, etc.) are [still used in X places / completely unused]. Can we drop them or do you need a data migration first?"

3. **Payment tracking fields:** "Fields like stacks_tx_id, payment_status are [used/unused]. Since you're considering a blockchain change, should we keep these for now?"

4. **Alpha users extra data:** "The alpha_users table has artist_name, email, notes fields that are [used/unused]. Were these from a signup form?"

5. **License fields:** "Both license_type and license_selection exist. Should we consolidate to one field?"

---

## Success Criteria

✅ Every questionable field verified (used or unused)
✅ Backup strategy documented and tested
✅ Migration SQL ready (but not executed yet - needs user approval)
✅ TypeScript types updated to match cleaned schema
✅ User has clear recommendations with evidence

---

## Notes

- **DO NOT execute the migration without user approval**
- **DO create backups first**
- **DO be conservative** - when in doubt, ask before dropping
- **DO provide evidence** - show grep results, not just opinions
- **DO consider future features** - some unused fields might be planned

Good luck! 🚀
