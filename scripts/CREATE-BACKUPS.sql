-- ========================================
-- CREATE DATABASE BACKUPS - 2025-11-03
-- ========================================
-- Run this in Supabase SQL Editor
-- Then verify tables appear in Dashboard → Database → Tables

BEGIN;

-- Backup user_profiles
CREATE TABLE IF NOT EXISTS user_profiles_backup_2025_11_03 AS
SELECT * FROM user_profiles;

-- Backup user_profile_sections
CREATE TABLE IF NOT EXISTS user_profile_sections_backup_2025_11_03 AS
SELECT * FROM user_profile_sections;

-- Backup ip_tracks
CREATE TABLE IF NOT EXISTS ip_tracks_backup_2025_11_03 AS
SELECT * FROM ip_tracks;

-- Backup alpha_users
CREATE TABLE IF NOT EXISTS alpha_users_backup_2025_11_03 AS
SELECT * FROM alpha_users;

COMMIT;

-- ========================================
-- VERIFY BACKUPS
-- ========================================
-- Run this after to verify row counts:

SELECT
  'user_profiles' as table_name,
  (SELECT COUNT(*) FROM user_profiles) as current_rows,
  (SELECT COUNT(*) FROM user_profiles_backup_2025_11_03) as backup_rows
UNION ALL
SELECT
  'user_profile_sections',
  (SELECT COUNT(*) FROM user_profile_sections),
  (SELECT COUNT(*) FROM user_profile_sections_backup_2025_11_03)
UNION ALL
SELECT
  'ip_tracks',
  (SELECT COUNT(*) FROM ip_tracks),
  (SELECT COUNT(*) FROM ip_tracks_backup_2025_11_03)
UNION ALL
SELECT
  'alpha_users',
  (SELECT COUNT(*) FROM alpha_users),
  (SELECT COUNT(*) FROM alpha_users_backup_2025_11_03);
