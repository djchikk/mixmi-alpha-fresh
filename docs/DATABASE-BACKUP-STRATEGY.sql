-- ============================================
-- MIXMI ALPHA DATABASE BACKUP STRATEGY
-- ============================================
-- Date: 2025-10-26
-- Purpose: Create complete backups before database cleanup migration
-- Tables: ip_tracks, alpha_users, user_profiles
--
-- IMPORTANT: RUN THIS SCRIPT BEFORE ANY SCHEMA CHANGES!
--
-- Instructions:
-- 1. Run this script in Supabase SQL Editor
-- 2. Verify backup row counts match original tables
-- 3. Export backup tables to CSV via Supabase Dashboard (optional but recommended)
-- 4. Only then run the cleanup migration script
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Create Backup Tables
-- ============================================

-- Backup ip_tracks table (contains ~60 tracks)
CREATE TABLE IF NOT EXISTS ip_tracks_backup_2025_10_26 AS
SELECT * FROM ip_tracks;

COMMENT ON TABLE ip_tracks_backup_2025_10_26 IS
'Complete backup of ip_tracks before database cleanup migration on 2025-10-26';

-- Backup alpha_users table (contains ~30 alpha users)
CREATE TABLE IF NOT EXISTS alpha_users_backup_2025_10_26 AS
SELECT * FROM alpha_users;

COMMENT ON TABLE alpha_users_backup_2025_10_26 IS
'Complete backup of alpha_users before database cleanup migration on 2025-10-26';

-- Backup user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles_backup_2025_10_26 AS
SELECT * FROM user_profiles;

COMMENT ON TABLE user_profiles_backup_2025_10_26 IS
'Complete backup of user_profiles before database cleanup migration on 2025-10-26';

-- ============================================
-- STEP 2: Verify Backup Integrity
-- ============================================

-- Verify ip_tracks backup count matches original
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

  RAISE NOTICE '✅ ip_tracks backup verified: % rows', orig_count;
END $$;

-- Verify alpha_users backup count matches original
DO $$
DECLARE
  orig_count INTEGER;
  backup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orig_count FROM alpha_users;
  SELECT COUNT(*) INTO backup_count FROM alpha_users_backup_2025_10_26;

  IF orig_count != backup_count THEN
    RAISE EXCEPTION 'alpha_users backup count mismatch! Original: %, Backup: %', orig_count, backup_count;
  END IF;

  RAISE NOTICE '✅ alpha_users backup verified: % rows', orig_count;
END $$;

-- Verify user_profiles backup count matches original
DO $$
DECLARE
  orig_count INTEGER;
  backup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orig_count FROM user_profiles;
  SELECT COUNT(*) INTO backup_count FROM user_profiles_backup_2025_10_26;

  IF orig_count != backup_count THEN
    RAISE EXCEPTION 'user_profiles backup count mismatch! Original: %, Backup: %', orig_count, backup_count;
  END IF;

  RAISE NOTICE '✅ user_profiles backup verified: % rows', orig_count;
END $$;

-- ============================================
-- STEP 3: Display Backup Summary
-- ============================================

-- Show summary of all backups
DO $$
DECLARE
  ip_tracks_count INTEGER;
  alpha_users_count INTEGER;
  user_profiles_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO ip_tracks_count FROM ip_tracks_backup_2025_10_26;
  SELECT COUNT(*) INTO alpha_users_count FROM alpha_users_backup_2025_10_26;
  SELECT COUNT(*) INTO user_profiles_count FROM user_profiles_backup_2025_10_26;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '📊 BACKUP SUMMARY';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'ip_tracks_backup_2025_10_26: % rows', ip_tracks_count;
  RAISE NOTICE 'alpha_users_backup_2025_10_26: % rows', alpha_users_count;
  RAISE NOTICE 'user_profiles_backup_2025_10_26: % rows', user_profiles_count;
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ All backups created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📝 RECOMMENDED NEXT STEPS:';
  RAISE NOTICE '1. Export backup tables to CSV via Supabase Dashboard';
  RAISE NOTICE '   - Table Editor → Select backup table → "..." menu → Export CSV';
  RAISE NOTICE '2. Store CSV files in safe location (e.g., /docs/backups/)';
  RAISE NOTICE '3. Review DATABASE-CLEANUP-MIGRATION.sql before running';
  RAISE NOTICE '4. Run migration only after verifying backups';
  RAISE NOTICE '';
END $$;

COMMIT;

-- ============================================
-- ROLLBACK INSTRUCTIONS (IF MIGRATION FAILS)
-- ============================================

/*

If the migration causes issues and you need to restore from backup:

-- WARNING: This will DELETE current data and restore from backup!
-- Only run this if you are certain you need to rollback!

BEGIN;

-- Restore ip_tracks
DROP TABLE IF EXISTS ip_tracks CASCADE;
ALTER TABLE ip_tracks_backup_2025_10_26 RENAME TO ip_tracks;

-- Restore alpha_users
DROP TABLE IF EXISTS alpha_users CASCADE;
ALTER TABLE alpha_users_backup_2025_10_26 RENAME TO alpha_users;

-- Restore user_profiles
DROP TABLE IF EXISTS user_profiles CASCADE;
ALTER TABLE user_profiles_backup_2025_10_26 RENAME TO user_profiles;

-- Recreate any foreign key constraints that were dropped
-- (Add specific FK constraints here if needed)

COMMIT;

RAISE NOTICE '🔄 Database restored from backup!';

*/

-- ============================================
-- CSV EXPORT INSTRUCTIONS
-- ============================================

/*

To export backup tables to CSV (recommended for extra safety):

1. Go to Supabase Dashboard
2. Navigate to Table Editor
3. Select "ip_tracks_backup_2025_10_26"
4. Click the "..." menu (top right)
5. Select "Export as CSV"
6. Save file as: ip_tracks_backup_2025_10_26.csv
7. Repeat for:
   - alpha_users_backup_2025_10_26.csv
   - user_profiles_backup_2025_10_26.csv

Store CSV files in: /docs/backups/ directory

*/

-- ============================================
-- CLEANUP OLD BACKUPS (After Successful Migration)
-- ============================================

/*

After confirming migration success (1-2 weeks of testing), you can drop backup tables:

BEGIN;

DROP TABLE IF EXISTS ip_tracks_backup_2025_10_26;
DROP TABLE IF EXISTS alpha_users_backup_2025_10_26;
DROP TABLE IF EXISTS user_profiles_backup_2025_10_26;

COMMIT;

RAISE NOTICE '🗑️ Old backup tables cleaned up';

-- Note: Keep CSV exports permanently for disaster recovery!

*/

-- ============================================
-- ADDITIONAL SAFETY CHECKS
-- ============================================

-- Check for NULL values in critical fields
SELECT 'ip_tracks - NULL primary_uploader_wallet' as check_name, COUNT(*) as count
FROM ip_tracks
WHERE primary_uploader_wallet IS NULL
UNION ALL
SELECT 'ip_tracks - NULL composition_split_1_wallet', COUNT(*)
FROM ip_tracks
WHERE composition_split_1_wallet IS NULL
UNION ALL
SELECT 'ip_tracks - NULL production_split_1_wallet', COUNT(*)
FROM ip_tracks
WHERE production_split_1_wallet IS NULL
UNION ALL
SELECT 'alpha_users - NULL wallet_address', COUNT(*)
FROM alpha_users
WHERE wallet_address IS NULL;

-- ============================================
-- END OF BACKUP SCRIPT
-- ============================================
