-- ROLLBACK: Restore database from this morning's backups
-- Date: October 30, 2025
-- Purpose: Undo the column cleanup that broke the globe
-- Restores: alpha_users, ip_tracks, user_profiles to pre-cleanup state

-- =====================================================
-- SAFETY CHECK: Verify backups exist
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'alpha_users_backup_2025_10_30') THEN
        RAISE EXCEPTION 'Backup table alpha_users_backup_2025_10_30 not found!';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'ip_tracks_backup_2025_10_30') THEN
        RAISE EXCEPTION 'Backup table ip_tracks_backup_2025_10_30 not found!';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'user_profiles_backup_2025_10_30') THEN
        RAISE EXCEPTION 'Backup table user_profiles_backup_2025_10_30 not found!';
    END IF;
    RAISE NOTICE 'All backup tables verified ✅';
END $$;

-- =====================================================
-- STEP 1: Drop current (broken) tables
-- =====================================================

-- WARNING: This drops the current tables!
DROP TABLE IF EXISTS ip_tracks CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS alpha_users CASCADE;

-- =====================================================
-- STEP 2: Rename backups to restore them
-- =====================================================

ALTER TABLE alpha_users_backup_2025_10_30 RENAME TO alpha_users;
ALTER TABLE ip_tracks_backup_2025_10_30 RENAME TO ip_tracks;
ALTER TABLE user_profiles_backup_2025_10_30 RENAME TO user_profiles;

-- =====================================================
-- STEP 3: Verify restoration
-- =====================================================

SELECT 'ROLLBACK COMPLETE' as status;

SELECT
    'alpha_users' as table_name,
    COUNT(*) as total_rows,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'alpha_users') as column_count
FROM alpha_users
UNION ALL
SELECT
    'ip_tracks' as table_name,
    COUNT(*) as total_rows,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'ip_tracks') as column_count
FROM ip_tracks
UNION ALL
SELECT
    'user_profiles' as table_name,
    COUNT(*) as total_rows,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'user_profiles') as column_count
FROM user_profiles;

-- Show that all columns are back (including the removed ones)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'ip_tracks'
  AND column_name IN (
    'uploader_address',
    'remix_depth',
    'is_deleted',
    'price_stx',
    'sample_type',
    'tell_us_more',
    'locations'
  )
ORDER BY column_name;
-- Expected: All 7 columns present again

-- =====================================================
-- NOTES
-- =====================================================

-- ✅ Database restored to this morning's state (before cleanup)
-- ✅ All 93 columns back in ip_tracks
-- ✅ All removed columns restored
-- ✅ Globe should work again
--
-- NEXT: Conservative cleanup of only obviously useless columns
-- =====================================================
