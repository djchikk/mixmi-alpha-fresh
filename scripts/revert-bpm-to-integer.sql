-- CRITICAL ROLLBACK: Revert BPM column back to INTEGER
-- This restores the original behavior that was working correctly with the mixer
-- Run this IMMEDIATELY in Supabase SQL Editor to fix the mixer
-- Date: 2025-08-11

-- Change BPM column back to INTEGER, rounding any decimal values
ALTER TABLE ip_tracks 
ALTER COLUMN bpm TYPE INTEGER
USING ROUND(bpm)::INTEGER;

-- Update comment to reflect the rollback
COMMENT ON COLUMN ip_tracks.bpm IS 'Beats per minute (integer value for mixer compatibility)';

-- Verify the change
SELECT 
  column_name, 
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_name = 'ip_tracks'
  AND column_name = 'bpm';

-- Check if any tracks have decimal BPM values that got rounded
SELECT id, title, bpm 
FROM ip_tracks 
WHERE bpm IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- This should show BPM as 'integer' type after running the ALTER TABLE command