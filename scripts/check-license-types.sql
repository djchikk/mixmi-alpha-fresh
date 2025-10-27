-- Check what license_type values are currently in use
-- This helps us understand if we need to migrate existing data

SELECT
    content_type,
    license_type,
    allow_downloads,
    COUNT(*) as count
FROM ip_tracks
WHERE deleted_at IS NULL
GROUP BY content_type, license_type, allow_downloads
ORDER BY content_type, license_type;

-- Also check for any NULL values
SELECT
    content_type,
    COUNT(*) as count_with_null_license
FROM ip_tracks
WHERE license_type IS NULL
  AND deleted_at IS NULL
GROUP BY content_type;
