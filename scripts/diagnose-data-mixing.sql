-- =================================================================
-- DIAGNOSE DATA MIXING ISSUE
-- =================================================================
-- This script checks for data mixing between creators
-- Run: Copy and paste into Supabase SQL Editor
-- =================================================================

-- Check Lunar Drive tracks and their current addresses
SELECT 
  'LUNAR DRIVE TRACKS' as section,
  title,
  artist,
  uploader_address,
  bns_name,
  CASE 
    WHEN uploader_address = 'SPZ02ESS4SMXVNZ9CXXQWGCTAWJ1APD6MAPWK9EQ' THEN '✅ Main Address'
    WHEN uploader_address = 'SP2Z05ZXG8ZRD48XMSEGCTT7Q1PNZJPY88X7C4SM9' THEN '✅ Collab Address'
    ELSE '❌ Wrong Address'
  END as address_status
FROM ip_tracks 
WHERE artist ILIKE '%lunar%' 
ORDER BY uploader_address, title
LIMIT 10;

-- Check djchikk/Tootles and Soph tracks
SELECT 
  'DJCHIKK TRACKS' as section,
  title,
  artist,
  uploader_address,
  bns_name,
  CASE 
    WHEN uploader_address = 'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE' THEN '✅ Correct Address'
    ELSE '❌ Wrong Address'
  END as address_status
FROM ip_tracks 
WHERE artist ILIKE '%tootles%' OR artist ILIKE '%soph%' OR bns_name ILIKE '%djchikk%'
ORDER BY uploader_address, title
LIMIT 10;

-- Check for any tracks incorrectly assigned to Lunar Drive addresses
SELECT 
  'MISASSIGNED TO LUNAR DRIVE' as section,
  title,
  artist,
  uploader_address,
  bns_name
FROM ip_tracks 
WHERE (uploader_address = 'SPZ02ESS4SMXVNZ9CXXQWGCTAWJ1APD6MAPWK9EQ' 
       OR uploader_address = 'SP2Z05ZXG8ZRD48XMSEGCTT7Q1PNZJPY88X7C4SM9')
  AND artist NOT ILIKE '%lunar%'
ORDER BY artist, title
LIMIT 10;

-- Check for any tracks incorrectly assigned to djchikk address  
SELECT 
  'MISASSIGNED TO DJCHIKK' as section,
  title,
  artist,
  uploader_address,
  bns_name
FROM ip_tracks 
WHERE uploader_address = 'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE'
  AND artist NOT ILIKE '%tootles%' 
  AND artist NOT ILIKE '%soph%'
  AND artist NOT ILIKE '%djchikk%'
ORDER BY artist, title
LIMIT 10;

-- =================================================================
-- 🔍 DIAGNOSIS COMPLETE!
-- =================================================================
-- This will show:
-- 1. ✅ Which Lunar Drive tracks are correctly assigned
-- 2. ✅ Which djchikk tracks are correctly assigned  
-- 3. ❌ Any misassigned tracks (wrong creator/wrong address)
-- 4. 🎯 The exact cause of the mixing issue
-- ================================================================= 