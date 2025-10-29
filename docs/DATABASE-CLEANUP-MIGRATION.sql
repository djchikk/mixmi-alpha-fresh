-- ============================================
-- MIXMI ALPHA DATABASE CLEANUP MIGRATION
-- ============================================
-- Date: 2025-10-26
-- Purpose: Remove duplicate, deprecated, and unused fields
-- Tables: ip_tracks, alpha_users
--
-- PREREQUISITES:
-- 1. ✅ Run DATABASE-BACKUP-STRATEGY.sql first
-- 2. ✅ Verify backups exist and counts match
-- 3. ✅ Export backup tables to CSV
-- 4. ✅ Review this migration script with team
--
-- WHAT THIS MIGRATION DOES:
-- - Drops 7 duplicate/unused fields from ip_tracks
-- - Updates 2 code files to remove references (manual step)
-- - Renames 2 alpha_users fields for consistency
-- - Adds 1 new field to alpha_users (approved_at)
--
-- WHAT THIS MIGRATION DOES NOT DO:
-- - Does NOT drop splits 4-7 (actively used for Gen 1 remixes!)
-- - Does NOT drop payment fields (actively used!)
-- - Does NOT drop commercial/collab fields (actively used!)
-- - Does NOT drop old pricing fields (requires separate migration)
-- ============================================

-- ============================================
-- SAFETY CHECK: Ensure backups exist
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'ip_tracks_backup_2025_10_26'
  ) THEN
    RAISE EXCEPTION '❌ BACKUP NOT FOUND! Run DATABASE-BACKUP-STRATEGY.sql first!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'alpha_users_backup_2025_10_26'
  ) THEN
    RAISE EXCEPTION '❌ BACKUP NOT FOUND! Run DATABASE-BACKUP-STRATEGY.sql first!';
  END IF;

  RAISE NOTICE '✅ Backups verified. Proceeding with migration...';
END $$;

BEGIN;

-- ============================================
-- PART 1: IP_TRACKS - Drop Duplicate Fields
-- ============================================

RAISE NOTICE '';
RAISE NOTICE '============================================';
RAISE NOTICE '📝 PART 1: Dropping duplicate fields from ip_tracks';
RAISE NOTICE '============================================';

-- 1. Drop uploader_address (duplicate of primary_uploader_wallet)
-- Verified by grep: Only used as fallback, "Legacy field - required by database" comment
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS uploader_address;
RAISE NOTICE '✅ Dropped uploader_address (keeping primary_uploader_wallet)';

-- 2. Drop generation (duplicate of remix_depth)
-- Verified by grep: Only used in 2 files with OR fallback logic
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS generation;
RAISE NOTICE '✅ Dropped generation (keeping remix_depth)';

-- 3. Drop parent_track_1_id and parent_track_2_id (duplicate of source_track_ids array)
-- Verified by grep: source_track_ids array is more flexible
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS parent_track_1_id;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS parent_track_2_id;
RAISE NOTICE '✅ Dropped parent_track_1_id and parent_track_2_id (keeping source_track_ids)';

-- ============================================
-- PART 2: IP_TRACKS - Drop Unused Fields
-- ============================================

RAISE NOTICE '';
RAISE NOTICE '============================================';
RAISE NOTICE '🗑️  PART 2: Dropping unused fields from ip_tracks';
RAISE NOTICE '============================================';

-- 4. Drop account_name and main_wallet_name
-- Verified by grep: Only written (set to wallet address), never read
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS account_name;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS main_wallet_name;
RAISE NOTICE '✅ Dropped account_name and main_wallet_name (populated but never used)';

-- 5. Drop is_live
-- Verified by grep: Hardcoded to true, no conditional logic
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS is_live;
RAISE NOTICE '✅ Dropped is_live (always hardcoded to true)';

-- ============================================
-- PART 3: ALPHA_USERS - Rename for Consistency
-- ============================================

RAISE NOTICE '';
RAISE NOTICE '============================================';
RAISE NOTICE '🔄 PART 3: Renaming alpha_users fields for consistency';
RAISE NOTICE '============================================';

-- 6. Rename invite_code → alpha_code (matches documentation)
ALTER TABLE alpha_users RENAME COLUMN invite_code TO alpha_code;
RAISE NOTICE '✅ Renamed invite_code → alpha_code';

-- 7. Rename approved → is_active (more descriptive)
ALTER TABLE alpha_users RENAME COLUMN approved TO is_active;
RAISE NOTICE '✅ Renamed approved → is_active';

-- 8. Add approved_at timestamp
ALTER TABLE alpha_users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
RAISE NOTICE '✅ Added approved_at timestamp field';

-- Update approved_at for existing active users (set to their created_at date)
UPDATE alpha_users
SET approved_at = created_at
WHERE is_active = true AND approved_at IS NULL;
RAISE NOTICE '✅ Initialized approved_at for existing active users';

-- ============================================
-- PART 4: Optional - Drop email from alpha_users
-- ============================================
-- COMMENTED OUT - User should confirm email is unused before running

/*
-- Drop email field (verified unused in code)
-- Verified by grep: Selected from DB but no code references to alpha.email
ALTER TABLE alpha_users DROP COLUMN IF EXISTS email;
RAISE NOTICE '✅ Dropped email (unused in codebase)';
*/

RAISE NOTICE '';
RAISE NOTICE '⚠️  SKIPPED: email field (uncomment if confirmed unused)';

-- ============================================
-- PART 5: Verification
-- ============================================

RAISE NOTICE '';
RAISE NOTICE '============================================';
RAISE NOTICE '🔍 VERIFICATION: Checking remaining fields';
RAISE NOTICE '============================================';

-- Verify critical fields still exist
DO $$
DECLARE
  has_primary_uploader BOOLEAN;
  has_remix_depth BOOLEAN;
  has_source_track_ids BOOLEAN;
  has_alpha_code BOOLEAN;
  has_is_active BOOLEAN;
BEGIN
  -- Check ip_tracks
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ip_tracks' AND column_name = 'primary_uploader_wallet'
  ) INTO has_primary_uploader;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ip_tracks' AND column_name = 'remix_depth'
  ) INTO has_remix_depth;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ip_tracks' AND column_name = 'source_track_ids'
  ) INTO has_source_track_ids;

  -- Check alpha_users
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alpha_users' AND column_name = 'alpha_code'
  ) INTO has_alpha_code;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alpha_users' AND column_name = 'is_active'
  ) INTO has_is_active;

  -- Report
  IF has_primary_uploader THEN
    RAISE NOTICE '✅ primary_uploader_wallet exists';
  ELSE
    RAISE EXCEPTION '❌ primary_uploader_wallet missing!';
  END IF;

  IF has_remix_depth THEN
    RAISE NOTICE '✅ remix_depth exists';
  ELSE
    RAISE EXCEPTION '❌ remix_depth missing!';
  END IF;

  IF has_source_track_ids THEN
    RAISE NOTICE '✅ source_track_ids exists';
  ELSE
    RAISE EXCEPTION '❌ source_track_ids missing!';
  END IF;

  IF has_alpha_code THEN
    RAISE NOTICE '✅ alpha_code exists (renamed from invite_code)';
  ELSE
    RAISE EXCEPTION '❌ alpha_code missing!';
  END IF;

  IF has_is_active THEN
    RAISE NOTICE '✅ is_active exists (renamed from approved)';
  ELSE
    RAISE EXCEPTION '❌ is_active missing!';
  END IF;
END $$;

-- ============================================
-- PART 6: Row Count Verification
-- ============================================

RAISE NOTICE '';
RAISE NOTICE '============================================';
RAISE NOTICE '📊 ROW COUNT VERIFICATION';
RAISE NOTICE '============================================';

DO $$
DECLARE
  ip_tracks_count INTEGER;
  alpha_users_count INTEGER;
  backup_ip_tracks_count INTEGER;
  backup_alpha_users_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO ip_tracks_count FROM ip_tracks;
  SELECT COUNT(*) INTO alpha_users_count FROM alpha_users;
  SELECT COUNT(*) INTO backup_ip_tracks_count FROM ip_tracks_backup_2025_10_26;
  SELECT COUNT(*) INTO backup_alpha_users_count FROM alpha_users_backup_2025_10_26;

  RAISE NOTICE 'ip_tracks: % rows (backup: %)', ip_tracks_count, backup_ip_tracks_count;
  RAISE NOTICE 'alpha_users: % rows (backup: %)', alpha_users_count, backup_alpha_users_count;

  IF ip_tracks_count != backup_ip_tracks_count THEN
    RAISE EXCEPTION '❌ ip_tracks row count mismatch! Migration may have deleted rows!';
  END IF;

  IF alpha_users_count != backup_alpha_users_count THEN
    RAISE EXCEPTION '❌ alpha_users row count mismatch! Migration may have deleted rows!';
  END IF;

  RAISE NOTICE '✅ All row counts match - no data lost';
END $$;

COMMIT;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

RAISE NOTICE '';
RAISE NOTICE '============================================';
RAISE NOTICE '✅ DATABASE CLEANUP MIGRATION COMPLETE!';
RAISE NOTICE '============================================';
RAISE NOTICE '';
RAISE NOTICE '📝 FIELDS DROPPED:';
RAISE NOTICE '  - ip_tracks.uploader_address';
RAISE NOTICE '  - ip_tracks.generation';
RAISE NOTICE '  - ip_tracks.parent_track_1_id';
RAISE NOTICE '  - ip_tracks.parent_track_2_id';
RAISE NOTICE '  - ip_tracks.account_name';
RAISE NOTICE '  - ip_tracks.main_wallet_name';
RAISE NOTICE '  - ip_tracks.is_live';
RAISE NOTICE '';
RAISE NOTICE '🔄 FIELDS RENAMED:';
RAISE NOTICE '  - alpha_users.invite_code → alpha_code';
RAISE NOTICE '  - alpha_users.approved → is_active';
RAISE NOTICE '';
RAISE NOTICE '➕ FIELDS ADDED:';
RAISE NOTICE '  - alpha_users.approved_at';
RAISE NOTICE '';
RAISE NOTICE '⚠️  MANUAL STEPS REQUIRED:';
RAISE NOTICE '1. Update code to remove references to dropped fields:';
RAISE NOTICE '   - lib/globeDataSupabase.ts:42 (remove uploader_address fallback)';
RAISE NOTICE '   - components/cards/CompactTrackCardWithFlip.tsx:634-647 (remove generation fallback)';
RAISE NOTICE '   - components/modals/TrackDetailsModal.tsx:222-234 (remove parent_track fallback)';
RAISE NOTICE '   - hooks/useIPTrackSubmit.ts (remove account_name, main_wallet_name, is_live)';
RAISE NOTICE '';
RAISE NOTICE '2. Update code to use renamed alpha_users fields:';
RAISE NOTICE '   - Search for "invite_code" → replace with "alpha_code"';
RAISE NOTICE '   - Search for ".approved" → replace with ".is_active"';
RAISE NOTICE '';
RAISE NOTICE '3. Consider adding splits 4-7 to TypeScript types (currently missing):';
RAISE NOTICE '   - types/index.ts - add composition_split_4-7 fields';
RAISE NOTICE '   - types/index.ts - add production_split_4-7 fields';
RAISE NOTICE '';
RAISE NOTICE '4. Test thoroughly before deploying to production!';
RAISE NOTICE '';

-- ============================================
-- ROLLBACK PLAN (if needed)
-- ============================================

/*

If migration causes issues, restore from backup:

BEGIN;

-- Restore ip_tracks
DROP TABLE IF EXISTS ip_tracks CASCADE;
ALTER TABLE ip_tracks_backup_2025_10_26 RENAME TO ip_tracks;

-- Restore alpha_users
DROP TABLE IF EXISTS alpha_users CASCADE;
ALTER TABLE alpha_users_backup_2025_10_26 RENAME TO alpha_users;

-- Recreate RLS policies (if needed)
-- Add your specific RLS policies here

COMMIT;

RAISE NOTICE '🔄 Database restored from backup!';

*/

-- ============================================
-- FIELDS INTENTIONALLY NOT DROPPED
-- ============================================

/*

The following fields were analyzed but KEPT because they are actively used:

✅ KEPT - Actively Used:
- composition_split_4-7_wallet/percentage (Gen 1 remix attribution)
- production_split_4-7_wallet/percentage (Gen 1 remix attribution)
- stacks_tx_id (blockchain transaction tracking)
- payment_status (payment verification)
- payment_checked_at (payment verification)
- open_to_commercial (licensing UI)
- commercial_contact, commercial_contact_fee (licensing UI)
- collab_contact, collab_contact_fee (collaboration UI)
- notes (forms, certificates, track details)
- license_type, license_selection (both actively used)
- alpha_users.artist_name (authentication, fallback for track.artist)

⚠️  REQUIRES USER DECISION:
- Old pricing fields (price_stx, remix_price, download_price, combined_price)
  → Needs dedicated pricing migration sprint
- license_type vs license_selection consolidation
  → User needs to decide which field is source of truth
- duration field
  → User needs to confirm if storing track duration or calculating on-the-fly

📋 FUTURE MIGRATIONS:
1. Pricing field consolidation (old → new with _stx suffix)
2. License field consolidation (type vs selection)
3. Consider splitting alpha_users into auth + profile tables
4. Potentially rename stacks_tx_id → blockchain_tx_id if moving to different chain

*/

-- ============================================
-- END OF MIGRATION SCRIPT
-- ============================================
