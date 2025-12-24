-- =================================================================
-- EXTRACT BPM DATA FROM TRACK TITLES
-- =================================================================
-- This script extracts BPM data embedded in track titles
-- Run: Copy and paste into Supabase SQL Editor after the field mapping
-- =================================================================

-- Extract BPM from titles with "_XXX_BPM" pattern
UPDATE ip_tracks 
SET bpm = CAST(
  SUBSTRING(title FROM '(\d+)_BPM') AS INTEGER
)
WHERE title ~ '_\d+_BPM' AND bpm IS NULL;

-- Extract BPM from titles ending with "_XXX" (like "_178")
UPDATE ip_tracks 
SET bpm = CAST(
  SUBSTRING(title FROM '_(\d{2,3})$') AS INTEGER
)
WHERE title ~ '_\d{2,3}$' 
  AND bpm IS NULL 
  AND CAST(SUBSTRING(title FROM '_(\d{2,3})$') AS INTEGER) BETWEEN 60 AND 200;

-- Extract BPM from titles with "XXX BPM" pattern (spaces)
UPDATE ip_tracks 
SET bpm = CAST(
  SUBSTRING(title FROM '(\d+)\s+BPM') AS INTEGER
)
WHERE title ~ '\d+\s+BPM' AND bpm IS NULL;

-- Verify BPM extraction
SELECT 
  title,
  bpm,
  bns_name,
  CASE WHEN bpm IS NOT NULL THEN '✅ BPM Found' ELSE '❌ No BPM' END as bpm_status
FROM ip_tracks 
WHERE bns_name IS NOT NULL AND bns_name != ''
ORDER BY bns_name, bpm DESC
LIMIT 20;

-- =================================================================
-- 🎉 BPM EXTRACTION COMPLETE!
-- =================================================================
-- After running this script:
-- 1. ✅ BPM badges will show on TrackCards
-- 2. ✅ DJ-friendly BPM display for mixing
-- 3. ✅ Proper tempo information for all loops
-- ================================================================= 