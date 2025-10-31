-- Check Current Table Status
-- Date: October 30, 2025
-- Purpose: Verify which tables exist after rollback

-- List all ip_tracks related tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%ip_tracks%'
ORDER BY table_name;

-- Count rows in ip_tracks (should be your actual data)
SELECT COUNT(*) as total_tracks
FROM ip_tracks;

-- Show most recent tracks to verify data
SELECT
    id,
    title,
    artist,
    content_type,
    created_at
FROM ip_tracks
ORDER BY created_at DESC
LIMIT 5;
