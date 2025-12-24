-- =================================================================
-- FIX MISSING BPM VALUES - URGENT
-- =================================================================
-- All tracks are missing BPM values, causing component rendering issues
-- This script adds default BPM values based on track types
-- =================================================================

-- Step 1: Add default BPM values for all tracks
-- =================================================================
-- Set default BPM to 120 for all tracks that don't have BPM
UPDATE ip_tracks 
SET bpm = 120 
WHERE bpm IS NULL;

-- Step 2: Set more appropriate BPM values based on content type
-- =================================================================
-- Update loops to have varied BPM values (more realistic for DJ use)
UPDATE ip_tracks 
SET bpm = CASE 
    WHEN sample_type = 'VOCALS' THEN 125
    WHEN sample_type = 'BEATS' THEN 140 
    WHEN sample_type = 'FULL BACKING TRACKS' THEN 128
    WHEN sample_type = 'LEADS AND TOPS' THEN 130
    WHEN sample_type = 'instrumentals' THEN 120
    ELSE 125
END
WHERE content_type = 'loop';

-- Step 3: Set BPM for full songs (typically slower)
-- =================================================================
UPDATE ip_tracks 
SET bpm = 110 
WHERE content_type = 'full_song' AND bpm IS NULL;

-- Step 4: Verify the fix
-- =================================================================
SELECT 
    COUNT(*) as total_tracks,
    COUNT(bpm) as tracks_with_bpm,
    COUNT(*) - COUNT(bpm) as still_missing_bpm,
    MIN(bpm) as min_bpm,
    MAX(bpm) as max_bpm,
    AVG(bpm) as avg_bpm
FROM ip_tracks;

-- Step 5: Check specific creator after fix
-- =================================================================
SELECT 
    COUNT(*) as djchikk_tracks,
    COUNT(bpm) as tracks_with_bpm
FROM ip_tracks 
WHERE primary_uploader_wallet = 'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE';

-- =================================================================
-- This should fix the BPM issue and allow tracks to render properly
-- ================================================================= 