-- Database Backup Script
-- Date: October 30, 2025
-- Purpose: Backup main tables before schema cleanup
-- Tables: alpha_users, ip_tracks, user_profiles

-- =====================================================
-- STEP 1: Create Backup Tables
-- =====================================================

-- Backup alpha_users table
CREATE TABLE alpha_users_backup_2025_10_30 AS
SELECT * FROM alpha_users;

-- Backup ip_tracks table (this might take a moment - it's the big one)
CREATE TABLE ip_tracks_backup_2025_10_30 AS
SELECT * FROM ip_tracks;

-- Backup user_profiles table
CREATE TABLE user_profiles_backup_2025_10_30 AS
SELECT * FROM user_profiles;

-- =====================================================
-- STEP 2: Verify Backups Created Successfully
-- =====================================================

-- Check row counts match
SELECT
    'alpha_users' as table_name,
    (SELECT COUNT(*) FROM alpha_users) as original_count,
    (SELECT COUNT(*) FROM alpha_users_backup_2025_10_30) as backup_count,
    CASE
        WHEN (SELECT COUNT(*) FROM alpha_users) = (SELECT COUNT(*) FROM alpha_users_backup_2025_10_30)
        THEN '✅ MATCH'
        ELSE '❌ MISMATCH'
    END as status
UNION ALL
SELECT
    'ip_tracks' as table_name,
    (SELECT COUNT(*) FROM ip_tracks) as original_count,
    (SELECT COUNT(*) FROM ip_tracks_backup_2025_10_30) as backup_count,
    CASE
        WHEN (SELECT COUNT(*) FROM ip_tracks) = (SELECT COUNT(*) FROM ip_tracks_backup_2025_10_30)
        THEN '✅ MATCH'
        ELSE '❌ MISMATCH'
    END as status
UNION ALL
SELECT
    'user_profiles' as table_name,
    (SELECT COUNT(*) FROM user_profiles) as original_count,
    (SELECT COUNT(*) FROM user_profiles_backup_2025_10_30) as backup_count,
    CASE
        WHEN (SELECT COUNT(*) FROM user_profiles) = (SELECT COUNT(*) FROM user_profiles_backup_2025_10_30)
        THEN '✅ MATCH'
        ELSE '❌ MISMATCH'
    END as status;

-- =====================================================
-- STEP 3: Verify Backup Table Structures
-- =====================================================

-- List all columns in backup tables to ensure structure was copied
SELECT
    'alpha_users_backup_2025_10_30' as backup_table,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'alpha_users_backup_2025_10_30'
ORDER BY ordinal_position;

SELECT
    'ip_tracks_backup_2025_10_30' as backup_table,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'ip_tracks_backup_2025_10_30'
ORDER BY ordinal_position;

SELECT
    'user_profiles_backup_2025_10_30' as backup_table,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'user_profiles_backup_2025_10_30'
ORDER BY ordinal_position;

-- =====================================================
-- NOTES:
-- =====================================================
--
-- ✅ All three tables are now backed up with full data
-- ✅ Backup table names include date: 2025_10_30
-- ✅ These backups are independent tables (not views)
-- ✅ Original tables remain untouched
-- ✅ Backups include ALL columns and data
--
-- ROLLBACK PROCEDURE (if needed):
--
-- DROP TABLE alpha_users;
-- ALTER TABLE alpha_users_backup_2025_10_30 RENAME TO alpha_users;
--
-- DROP TABLE ip_tracks;
-- ALTER TABLE ip_tracks_backup_2025_10_30 RENAME TO ip_tracks;
--
-- DROP TABLE user_profiles;
-- ALTER TABLE user_profiles_backup_2025_10_30 RENAME TO user_profiles;
--
-- Then restore RLS policies and indexes from schema dump
-- =====================================================
