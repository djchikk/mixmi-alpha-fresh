-- =================================================================
-- FIX FIELD MAPPINGS: CSV → TrackCard Component
-- =================================================================
-- This script fixes field mapping issues after the wallet migration
-- Run: Copy and paste into Supabase SQL Editor
-- =================================================================

-- Step 1: Add missing columns first
-- =================================================================
-- Add cover_image_url column (TrackCard expects this field name)
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Add content_type column (TrackCard expects this field name)  
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS content_type TEXT;

-- Add BPM column (mentioned that BPM data exists)
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS bpm INTEGER;

-- Add musical key column (optional but useful for loops)
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS key TEXT;

-- Add price column (migrating from NFT mixer to creator store pricing)
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS price_stx DECIMAL(10,2);

-- Step 2: Fix image URL field mapping
-- =================================================================
-- Copy image_url to cover_image_url
UPDATE ip_tracks 
SET cover_image_url = image_url 
WHERE image_url IS NOT NULL AND image_url != '';

-- Step 3: Add creator store pricing (migrating from NFT mixer)
-- =================================================================
-- All tracks from old NFT mixer system are loops at 1 STX
UPDATE ip_tracks 
SET price_stx = 1.0
WHERE price_stx IS NULL;

-- Step 4: Set content_type for NFT mixer migration
-- =================================================================
-- All tracks from old NFT mixer system are loops
UPDATE ip_tracks 
SET content_type = 'loop'
WHERE content_type IS NULL;

-- Step 5: Verify the fixes
-- =================================================================
-- Check that images and prices are now populated
SELECT 
  bns_name,
  title,
  CASE WHEN cover_image_url IS NOT NULL THEN '✅ Has Image' ELSE '❌ No Image' END as image_status,
  CASE WHEN audio_url IS NOT NULL THEN '✅ Has Audio' ELSE '❌ No Audio' END as audio_status,
  price_stx,
  content_type,
  uploader_address
FROM ip_tracks 
WHERE bns_name IS NOT NULL AND bns_name != ''
ORDER BY bns_name, title
LIMIT 20;

-- =================================================================
-- 🎉 NFT MIXER → CREATOR STORE MIGRATION COMPLETE!
-- =================================================================
-- After running this script:
-- 1. ✅ Images will display (cover_image_url populated from image_url)
-- 2. ✅ Prices will show (1 STX for all loops - your pricing structure)
-- 3. ✅ Content types set to 'loop' (all tracks from NFT mixer are loops)
-- 4. ✅ Purple borders on all cards (loop styling)
-- 5. ✅ Ready for new songs at 2 STX when users upload them
-- 6. ✅ BPM and key columns added for future enhancement
-- ================================================================= 