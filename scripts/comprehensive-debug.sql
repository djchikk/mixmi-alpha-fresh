-- =================================================================
-- COMPREHENSIVE DEBUG: Find all remaining issues
-- =================================================================

-- Step 1: Verify BPM fix worked
-- =================================================================
SELECT 
    'BPM Fix Status' as check_type,
    COUNT(*) as total_tracks,
    COUNT(bpm) as tracks_with_bpm,
    MIN(bpm) as min_bpm,
    MAX(bpm) as max_bpm
FROM ip_tracks;

-- Step 2: Check ALL required fields for DJ Chikk's tracks
-- =================================================================
SELECT 
    'DJ Chikk Field Check' as check_type,
    COUNT(*) as total_tracks,
    COUNT(cover_image_url) as has_cover_image,
    COUNT(price_stx) as has_price,
    COUNT(content_type) as has_content_type,
    COUNT(bpm) as has_bpm,
    COUNT(audio_url) as has_audio,
    COUNT(primary_uploader_wallet) as has_primary_uploader
FROM ip_tracks 
WHERE primary_uploader_wallet = 'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE';

-- Step 3: Show actual sample data for DJ Chikk
-- =================================================================
SELECT 
    title,
    artist,
    content_type,
    bpm,
    price_stx,
    cover_image_url,
    audio_url,
    primary_uploader_wallet
FROM ip_tracks 
WHERE primary_uploader_wallet = 'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE'
LIMIT 3;

-- Step 4: Check for any NULL values that might cause issues
-- =================================================================
SELECT 
    'NULL Check' as check_type,
    COUNT(CASE WHEN title IS NULL THEN 1 END) as null_titles,
    COUNT(CASE WHEN artist IS NULL THEN 1 END) as null_artists,
    COUNT(CASE WHEN content_type IS NULL THEN 1 END) as null_content_type,
    COUNT(CASE WHEN price_stx IS NULL THEN 1 END) as null_price,
    COUNT(CASE WHEN cover_image_url IS NULL OR cover_image_url = '' THEN 1 END) as null_cover_image
FROM ip_tracks 
WHERE primary_uploader_wallet = 'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE';

-- Step 5: Check if composition/production splits are complete
-- =================================================================
SELECT 
    'Split Check' as check_type,
    COUNT(*) as total_tracks,
    COUNT(CASE WHEN composition_split_1_wallet IS NULL THEN 1 END) as missing_comp_split,
    COUNT(CASE WHEN production_split_1_wallet IS NULL THEN 1 END) as missing_prod_split
FROM ip_tracks 
WHERE primary_uploader_wallet = 'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE';

-- =================================================================
-- This will show us exactly what's still missing or causing issues
-- ================================================================= 