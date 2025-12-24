-- =================================================================
-- DEBUG EMPTY STORES: Find out why no tracks are showing
-- =================================================================

-- Step 1: Check total tracks and primary_uploader_wallet status
-- =================================================================
SELECT 
    COUNT(*) as total_tracks,
    COUNT(primary_uploader_wallet) as tracks_with_primary_uploader,
    COUNT(*) - COUNT(primary_uploader_wallet) as tracks_missing_primary_uploader
FROM ip_tracks;

-- Step 2: Check specific creator wallets we're testing
-- =================================================================
-- Lunar Drive tracks
SELECT 
    'Lunar Drive' as creator,
    COUNT(*) as track_count,
    primary_uploader_wallet
FROM ip_tracks 
WHERE primary_uploader_wallet = 'SPZ02ESS4SMXVNZ9CXXQWGCTAWJ1APD6MAPWK9EQ'
GROUP BY primary_uploader_wallet;

-- DJ Chikk tracks  
SELECT 
    'DJ Chikk' as creator,
    COUNT(*) as track_count,
    primary_uploader_wallet
FROM ip_tracks 
WHERE primary_uploader_wallet = 'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE'
GROUP BY primary_uploader_wallet;

-- Step 3: Show all unique primary_uploader_wallet values
-- =================================================================
SELECT 
    primary_uploader_wallet,
    COUNT(*) as track_count
FROM ip_tracks 
WHERE primary_uploader_wallet IS NOT NULL
GROUP BY primary_uploader_wallet
ORDER BY track_count DESC;

-- Step 4: Sample data - show what the tracks actually look like
-- =================================================================
SELECT 
    id,
    title,
    artist,
    uploader_address,
    primary_uploader_wallet,
    store_display_policy,
    collaboration_type
FROM ip_tracks 
WHERE primary_uploader_wallet IS NOT NULL
LIMIT 10;

-- Step 5: Check if tracks still have uploader_address but no primary_uploader_wallet
-- =================================================================
SELECT 
    'Missing primary_uploader_wallet' as issue,
    COUNT(*) as count,
    uploader_address
FROM ip_tracks 
WHERE uploader_address IS NOT NULL AND primary_uploader_wallet IS NULL
GROUP BY uploader_address;

-- Step 6: Check field mappings - do tracks have the required fields?
-- =================================================================
SELECT 
    COUNT(*) as total_tracks,
    COUNT(cover_image_url) as has_cover_image,
    COUNT(price_stx) as has_price,
    COUNT(content_type) as has_content_type,
    COUNT(bpm) as has_bpm
FROM ip_tracks;

-- =================================================================
-- This should help us identify:
-- 1. Are tracks missing primary_uploader_wallet?
-- 2. Are the wallet addresses correct?
-- 3. Are there field mapping issues?
-- 4. What does the actual data look like?
-- ================================================================= 