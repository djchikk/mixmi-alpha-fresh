-- =================================================================
-- BACKUP ip_tracks table - November 19, 2025
-- =================================================================
-- Creates a complete backup of ip_tracks before RLS policy changes
-- =================================================================

-- Step 1: Create backup table with exact same structure
CREATE TABLE IF NOT EXISTS ip_tracks_backup_2025_11_19 (LIKE ip_tracks INCLUDING ALL);

-- Step 2: Copy ALL data from ip_tracks to backup
INSERT INTO ip_tracks_backup_2025_11_19
SELECT * FROM ip_tracks;

-- Step 3: Add metadata comment to backup table
COMMENT ON TABLE ip_tracks_backup_2025_11_19 IS 'Backup of ip_tracks table created on 2025-11-19 before adding INSERT RLS policy for video clips';

-- =================================================================
-- VERIFICATION QUERIES - Run these to confirm backup succeeded
-- =================================================================

-- Check row counts match
SELECT
  'Original' as table_name,
  COUNT(*) as row_count
FROM ip_tracks
UNION ALL
SELECT
  'Backup' as table_name,
  COUNT(*) as row_count
FROM ip_tracks_backup_2025_11_19;

-- Check content types distribution matches
SELECT
  'Original' as source,
  content_type,
  COUNT(*) as count
FROM ip_tracks
GROUP BY content_type
UNION ALL
SELECT
  'Backup' as source,
  content_type,
  COUNT(*) as count
FROM ip_tracks_backup_2025_11_19
GROUP BY content_type
ORDER BY content_type, source;

-- Verify backup table exists and show sample
SELECT
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE tablename = 'ip_tracks_backup_2025_11_19';

-- Show a few sample records from backup
SELECT
  id,
  title,
  artist,
  content_type,
  created_at
FROM ip_tracks_backup_2025_11_19
ORDER BY created_at DESC
LIMIT 5;

-- =================================================================
-- SUCCESS MESSAGE
-- =================================================================
-- If you see matching row counts above, the backup was successful!
-- You can now safely proceed with the RLS policy changes.
-- =================================================================
