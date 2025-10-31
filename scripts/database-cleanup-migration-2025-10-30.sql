-- Database Cleanup Migration
-- Date: October 30, 2025
-- Purpose: Remove duplicate, obsolete, and unused columns
-- Backups: alpha_users_backup_2025_10_30, ip_tracks_backup_2025_10_30, user_profiles_backup_2025_10_30
-- Removes: 18 columns total (17 from ip_tracks, 1 from user_profiles)

-- =====================================================
-- SAFETY CHECKS - Run these first to verify backups exist
-- =====================================================

-- Verify backups exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'alpha_users_backup_2025_10_30') THEN
        RAISE EXCEPTION 'Backup table alpha_users_backup_2025_10_30 not found! Run backup script first.';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'ip_tracks_backup_2025_10_30') THEN
        RAISE EXCEPTION 'Backup table ip_tracks_backup_2025_10_30 not found! Run backup script first.';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_profiles_backup_2025_10_30') THEN
        RAISE EXCEPTION 'Backup table user_profiles_backup_2025_10_30 not found! Run backup script first.';
    END IF;
    RAISE NOTICE 'All backup tables verified ✅';
END $$;

-- =====================================================
-- STEP 1: DATA MIGRATIONS (Copy data from old → new fields)
-- =====================================================

-- Migration 1: uploader_address → primary_uploader_wallet
UPDATE ip_tracks
SET primary_uploader_wallet = uploader_address
WHERE primary_uploader_wallet IS NULL
  AND uploader_address IS NOT NULL;

-- Verify migration 1
SELECT
    COUNT(*) as total_tracks,
    COUNT(primary_uploader_wallet) as has_primary_uploader,
    COUNT(uploader_address) as has_uploader_address,
    COUNT(*) FILTER (WHERE primary_uploader_wallet IS NULL AND uploader_address IS NOT NULL) as needs_migration
FROM ip_tracks;
-- Expected: needs_migration = 0

-- Migration 2: remix_depth → generation
UPDATE ip_tracks
SET generation = remix_depth
WHERE generation IS NULL
  AND remix_depth IS NOT NULL;

-- Also ensure generation defaults to 0 for null values (original uploads)
UPDATE ip_tracks
SET generation = 0
WHERE generation IS NULL;

-- Verify migration 2
SELECT
    COUNT(*) as total_tracks,
    COUNT(generation) as has_generation,
    COUNT(remix_depth) as has_remix_depth,
    COUNT(*) FILTER (WHERE generation IS NULL) as null_generation
FROM ip_tracks;
-- Expected: null_generation = 0

-- Migration 3: Verify is_deleted matches deleted_at logic
-- Check for any mismatches before dropping is_deleted
SELECT
    COUNT(*) FILTER (WHERE is_deleted = true AND deleted_at IS NULL) as deleted_flag_no_timestamp,
    COUNT(*) FILTER (WHERE is_deleted = false AND deleted_at IS NOT NULL) as not_deleted_but_has_timestamp
FROM ip_tracks;
-- Expected: both should be 0 (no mismatches)

-- Fix any mismatches (if they exist)
UPDATE ip_tracks
SET deleted_at = updated_at
WHERE is_deleted = true
  AND deleted_at IS NULL;

-- =====================================================
-- STEP 2: VERIFICATION QUERIES (Ensure no data loss)
-- =====================================================

-- Verify all critical data is preserved
SELECT
    'ip_tracks' as table_name,
    COUNT(*) as total_rows,
    COUNT(id) as has_id,
    COUNT(title) as has_title,
    COUNT(artist) as has_artist,
    COUNT(primary_uploader_wallet) as has_wallet,
    COUNT(generation) as has_generation
FROM ip_tracks;

-- Check for any NULL primary_uploader_wallet (should be none)
SELECT COUNT(*) as tracks_without_uploader
FROM ip_tracks
WHERE primary_uploader_wallet IS NULL;
-- Expected: 0

-- =====================================================
-- STEP 3: COLUMN REMOVALS (Only after verification passes)
-- =====================================================

-- Remove duplicate columns from ip_tracks
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS uploader_address;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS remix_depth;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS is_deleted;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS license_selection;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS locations; -- JSONB field

-- Remove old pricing columns
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS price_stx;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS remix_price;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS combined_price;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS download_price;

-- Remove unimplemented commercial/collaboration features
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS commercial_contact;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS commercial_contact_fee;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS collab_contact;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS collab_contact_fee;

-- Remove old multi-account system
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS account_name;
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS main_wallet_name;

-- Remove deprecated content classification
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS sample_type;

-- Remove redundant field
ALTER TABLE ip_tracks DROP COLUMN IF EXISTS tell_us_more;

-- Remove BNS field from user_profiles
ALTER TABLE user_profiles DROP COLUMN IF EXISTS bns_name;

-- =====================================================
-- STEP 4: POST-CLEANUP VERIFICATION
-- =====================================================

-- Count remaining columns in ip_tracks
SELECT COUNT(*) as ip_tracks_columns
FROM information_schema.columns
WHERE table_name = 'ip_tracks';
-- Expected: ~76 columns (down from 93)

-- Count remaining columns in user_profiles
SELECT COUNT(*) as user_profiles_columns
FROM information_schema.columns
WHERE table_name = 'user_profiles';
-- Expected: 14 columns (down from 15)

-- Verify critical columns still exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'ip_tracks'
  AND column_name IN (
    'id', 'title', 'artist', 'content_type', 'loop_category',
    'primary_uploader_wallet', 'generation',
    'remix_price_stx', 'download_price_stx',
    'composition_split_1_wallet', 'production_split_1_wallet',
    'composition_split_7_wallet', 'production_split_7_wallet' -- Extended splits for Gen 1 remixes
  )
ORDER BY column_name;
-- Expected: All 12+ columns present

-- =====================================================
-- STEP 5: SUMMARY REPORT
-- =====================================================

SELECT
    'CLEANUP COMPLETE' as status,
    (SELECT COUNT(*) FROM ip_tracks) as total_tracks,
    (SELECT COUNT(*) FROM user_profiles) as total_profiles,
    (SELECT COUNT(*) FROM alpha_users) as total_alpha_users;

-- List all columns removed
SELECT 'Columns Removed:' as summary
UNION ALL
SELECT '- uploader_address (duplicate of primary_uploader_wallet)'
UNION ALL
SELECT '- remix_depth (duplicate of generation)'
UNION ALL
SELECT '- is_deleted (duplicate of deleted_at logic)'
UNION ALL
SELECT '- license_selection (duplicate of license_type)'
UNION ALL
SELECT '- locations (jsonb - duplicate of location_lat/lng)'
UNION ALL
SELECT '- price_stx, remix_price, combined_price, download_price (old pricing)'
UNION ALL
SELECT '- commercial_contact, commercial_contact_fee (unimplemented)'
UNION ALL
SELECT '- collab_contact, collab_contact_fee (unimplemented)'
UNION ALL
SELECT '- account_name, main_wallet_name (old multi-account system)'
UNION ALL
SELECT '- sample_type (deprecated - replaced by loop_category)'
UNION ALL
SELECT '- tell_us_more (redundant with notes)'
UNION ALL
SELECT '- bns_name from user_profiles (BNS not ready)';

-- =====================================================
-- ROLLBACK PROCEDURE (If something goes wrong)
-- =====================================================

-- IMPORTANT: Only run this if you need to undo the migration!
-- This will restore from backups and lose any data created after backup

/*
-- WARNING: This will REPLACE current tables with backups!
-- Any changes made after backup will be LOST!

BEGIN;

-- Drop current tables
DROP TABLE ip_tracks;
DROP TABLE user_profiles;
DROP TABLE alpha_users;

-- Restore from backups
ALTER TABLE ip_tracks_backup_2025_10_30 RENAME TO ip_tracks;
ALTER TABLE user_profiles_backup_2025_10_30 RENAME TO user_profiles;
ALTER TABLE alpha_users_backup_2025_10_30 RENAME TO alpha_users;

-- Recreate indexes and RLS policies (from schema dump)
-- ... (would need to restore from schema-dump-oct-2025.sql)

COMMIT;

-- Then notify Sandy that rollback was performed
*/

-- =====================================================
-- NOTES FOR FUTURE REFERENCE
-- =====================================================

-- ✅ KEPT: All composition/production_split_1 through 7 columns
--    Reason: Needed for Gen 1 remix IP attribution (2 loops × 3 contributors = up to 6 per category)
--
-- ✅ KEPT: version, isrc_number
--    Reason: Valid metadata fields for future use
--
-- ✅ KEPT: open_to_collaboration, allow_remixing
--    Reason: Active permission system
--
-- ✅ REMOVED: 17 columns from ip_tracks, 1 from user_profiles
--    Result: 18% reduction in ip_tracks size (93 → 76 columns)
--
-- ✅ Data Migrations: uploader_address → primary_uploader_wallet, remix_depth → generation
--    Status: Completed in Step 1
--
-- ✅ Backups: All three main tables backed up with date stamp 2025_10_30
--    Location: Same database, separate tables
--
-- =====================================================
-- NEXT STEPS AFTER MIGRATION
-- =====================================================

-- 1. Update TypeScript interface (types/index.ts)
--    - Remove: sample_type, tell_us_more, remix_depth
--    - Keep: All other fields match database
--
-- 2. Update any queries that reference removed columns
--    - Search codebase for removed column names
--    - Update to use new equivalents
--
-- 3. Test critical paths:
--    - Upload new track
--    - Edit track metadata
--    - Create remix (Gen 1)
--    - View certificate
--    - Purchase track
--    - Load track to mixer
--
-- 4. Monitor for errors in production
--    - Check Supabase logs
--    - Watch for missing column errors
--
-- 5. After 1 week of stability, can drop backup tables:
--    DROP TABLE alpha_users_backup_2025_10_30;
--    DROP TABLE ip_tracks_backup_2025_10_30;
--    DROP TABLE user_profiles_backup_2025_10_30;
--
-- =====================================================

-- END OF MIGRATION SCRIPT
