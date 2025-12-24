-- =================================================================
-- FIX MISSING PRIMARY_UPLOADER_WALLET
-- =================================================================
-- This script fixes any tracks that might not have primary_uploader_wallet set
-- Run this if the debug script shows tracks missing primary_uploader_wallet
-- =================================================================

-- Step 1: Set primary_uploader_wallet for any tracks that are missing it
-- =================================================================
UPDATE ip_tracks 
SET primary_uploader_wallet = uploader_address 
WHERE primary_uploader_wallet IS NULL 
AND uploader_address IS NOT NULL;

-- Step 2: Set default values for other collaboration fields if missing
-- =================================================================
UPDATE ip_tracks 
SET collaboration_preferences = '{}'::jsonb 
WHERE collaboration_preferences IS NULL;

UPDATE ip_tracks 
SET store_display_policy = 'all_collaborations'
WHERE store_display_policy IS NULL;

UPDATE ip_tracks 
SET collaboration_type = 'primary_artist'
WHERE collaboration_type IS NULL;

-- Step 3: Verify the fix worked
-- =================================================================
SELECT 
    COUNT(*) as total_tracks,
    COUNT(primary_uploader_wallet) as tracks_with_primary_uploader,
    COUNT(*) - COUNT(primary_uploader_wallet) as still_missing_primary_uploader
FROM ip_tracks;

-- Show sample of fixed tracks
SELECT 
    title,
    artist,
    uploader_address,
    primary_uploader_wallet,
    store_display_policy
FROM ip_tracks 
LIMIT 5;

-- =================================================================
-- This should fix any tracks that were missing primary_uploader_wallet
-- ================================================================= 