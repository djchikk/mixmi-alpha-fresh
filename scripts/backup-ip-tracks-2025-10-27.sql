-- Backup of ip_tracks table created on 2025-10-27
-- Before adding streaming license types

-- Create backup table
CREATE TABLE IF NOT EXISTS ip_tracks_backup_2025_10_27 AS
SELECT * FROM ip_tracks;

-- Add comment to backup table
COMMENT ON TABLE ip_tracks_backup_2025_10_27 IS 'Backup of ip_tracks table created on 2025-10-27 before adding streaming license types to license_type enum';

-- Verify backup row count
DO $$
DECLARE
    original_count INTEGER;
    backup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO original_count FROM ip_tracks;
    SELECT COUNT(*) INTO backup_count FROM ip_tracks_backup_2025_10_27;

    RAISE NOTICE 'Original ip_tracks count: %', original_count;
    RAISE NOTICE 'Backup table count: %', backup_count;

    IF original_count = backup_count THEN
        RAISE NOTICE 'Backup successful! Counts match.';
    ELSE
        RAISE WARNING 'Backup counts do not match!';
    END IF;
END $$;
