-- =================================================================
-- VERIFY COLLABORATION SYSTEM IMPLEMENTATION
-- =================================================================
-- Run this after implementing the collaboration system to verify
-- that all columns were added correctly and data was migrated
-- =================================================================

-- Step 1: Check new columns exist
-- =================================================================
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ip_tracks' 
AND column_name IN (
    'primary_uploader_wallet', 
    'collaboration_preferences', 
    'store_display_policy', 
    'collaboration_type'
) 
ORDER BY column_name;

-- Step 2: Check that all tracks have primary_uploader_wallet set
-- =================================================================
SELECT 
    COUNT(*) as total_tracks,
    COUNT(primary_uploader_wallet) as tracks_with_primary_uploader,
    COUNT(*) - COUNT(primary_uploader_wallet) as tracks_missing_primary_uploader
FROM ip_tracks;

-- Step 3: Check default values were set correctly
-- =================================================================
SELECT 
    store_display_policy,
    COUNT(*) as track_count
FROM ip_tracks 
GROUP BY store_display_policy;

-- Step 4: Check collaboration_type distribution
-- =================================================================
SELECT 
    collaboration_type,
    COUNT(*) as track_count
FROM ip_tracks 
GROUP BY collaboration_type;

-- Step 5: Sample data verification
-- =================================================================
SELECT 
    id,
    title,
    artist,
    uploader_address,
    primary_uploader_wallet,
    store_display_policy,
    collaboration_type,
    collaboration_preferences
FROM ip_tracks 
LIMIT 5;

-- Step 6: Check specific creators
-- =================================================================
-- Lunar Drive tracks
SELECT 
    COUNT(*) as lunar_drive_tracks,
    primary_uploader_wallet,
    store_display_policy
FROM ip_tracks 
WHERE primary_uploader_wallet = 'SPZ02ESS4SMXVNZ9CXXQWGCTAWJ1APD6MAPWK9EQ' 
GROUP BY primary_uploader_wallet, store_display_policy;

-- DJ Chikk tracks
SELECT 
    COUNT(*) as djchikk_tracks,
    primary_uploader_wallet,
    store_display_policy
FROM ip_tracks 
WHERE primary_uploader_wallet = 'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE' 
GROUP BY primary_uploader_wallet, store_display_policy;

-- Step 7: Test helper function
-- =================================================================
-- Test the should_show_track_in_store function
-- (Replace with actual track ID and wallet address)
-- SELECT should_show_track_in_store(
--     (SELECT * FROM ip_tracks LIMIT 1),
--     'SPZ02ESS4SMXVNZ9CXXQWGCTAWJ1APD6MAPWK9EQ'
-- );

-- =================================================================
-- Expected Results:
-- - 4 new columns should exist
-- - All 59 tracks should have primary_uploader_wallet set
-- - All tracks should have store_display_policy = 'all_collaborations'
-- - All tracks should have collaboration_type = 'primary_artist'
-- - Lunar Drive should have 13 tracks
-- - DJ Chikk should have 16 tracks
-- ================================================================= 