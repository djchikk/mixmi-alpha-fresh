-- Backup ip_tracks table before USDC migration
-- Run this FIRST in Supabase SQL Editor
-- Created: 2025-12-26

-- Create backup table with all data
CREATE TABLE ip_tracks_backup_20251226 AS
SELECT * FROM ip_tracks;

-- Verify row count matches
DO $$
DECLARE
  original_count INTEGER;
  backup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO original_count FROM ip_tracks;
  SELECT COUNT(*) INTO backup_count FROM ip_tracks_backup_20251226;

  IF original_count = backup_count THEN
    RAISE NOTICE 'Backup successful: % rows copied to ip_tracks_backup_20251226', backup_count;
  ELSE
    RAISE EXCEPTION 'Backup verification failed! Original: %, Backup: %', original_count, backup_count;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE ip_tracks_backup_20251226 IS 'Backup of ip_tracks before USDC pricing migration - 2025-12-26';
