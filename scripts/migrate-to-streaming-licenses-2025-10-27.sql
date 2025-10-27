-- Migration to add streaming license types
-- Created: 2025-10-27
-- Purpose: Add 'streaming_only' and 'streaming_download' to license_type enum
--          and migrate existing songs/EPs to use streaming licenses

BEGIN;

-- Step 1: Drop the existing constraint
ALTER TABLE ip_tracks
DROP CONSTRAINT IF EXISTS ip_tracks_license_type_check;

-- Step 2: Add the new constraint with streaming license types
ALTER TABLE ip_tracks
ADD CONSTRAINT ip_tracks_license_type_check
CHECK (
  license_type = ANY (
    ARRAY[
      'remix_only'::text,
      'remix_external'::text,
      'custom'::text,
      'streaming_only'::text,
      'streaming_download'::text
    ]
  )
);

-- Step 3: Migrate existing songs and EPs to streaming licenses
-- All existing songs/EPs have allow_downloads=true, so they become 'streaming_download'
UPDATE ip_tracks
SET
  license_type = CASE
    WHEN content_type IN ('full_song', 'ep') AND allow_downloads = true
      THEN 'streaming_download'
    WHEN content_type IN ('full_song', 'ep') AND allow_downloads = false
      THEN 'streaming_only'
    ELSE license_type  -- Keep loops/loop_packs unchanged
  END,
  updated_at = NOW()
WHERE content_type IN ('full_song', 'ep')
  AND license_type NOT IN ('streaming_only', 'streaming_download');

-- Step 4: Verify the migration
DO $$
DECLARE
    song_count INTEGER;
    ep_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO song_count
    FROM ip_tracks
    WHERE content_type = 'full_song'
      AND license_type IN ('streaming_only', 'streaming_download');

    SELECT COUNT(*) INTO ep_count
    FROM ip_tracks
    WHERE content_type = 'ep'
      AND license_type IN ('streaming_only', 'streaming_download');

    RAISE NOTICE 'Migrated songs: %', song_count;
    RAISE NOTICE 'Migrated EPs: %', ep_count;
    RAISE NOTICE 'Expected: 12 songs, 2 EPs';

    IF song_count = 12 AND ep_count = 2 THEN
        RAISE NOTICE 'Migration successful!';
    ELSE
        RAISE WARNING 'Migration counts do not match expected values!';
    END IF;
END $$;

COMMIT;

-- To rollback this migration, run:
-- BEGIN;
-- ALTER TABLE ip_tracks DROP CONSTRAINT ip_tracks_license_type_check;
-- ALTER TABLE ip_tracks ADD CONSTRAINT ip_tracks_license_type_check
--   CHECK (license_type = ANY (ARRAY['remix_only'::text, 'remix_external'::text, 'custom'::text]));
-- UPDATE ip_tracks SET license_type = 'remix_only' WHERE content_type IN ('full_song', 'ep');
-- COMMIT;
