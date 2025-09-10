-- Migration: Add new licensing and pricing columns to ip_tracks table
-- Run this in Supabase SQL Editor

-- Add licensing selection column
ALTER TABLE ip_tracks 
ADD COLUMN IF NOT EXISTS license_selection VARCHAR(50) DEFAULT 'platform_remix';

-- Add new licensing boolean columns
ALTER TABLE ip_tracks 
ADD COLUMN IF NOT EXISTS allow_downloads BOOLEAN DEFAULT false;

ALTER TABLE ip_tracks 
ADD COLUMN IF NOT EXISTS open_to_commercial BOOLEAN DEFAULT false;

-- Add new pricing columns
ALTER TABLE ip_tracks 
ADD COLUMN IF NOT EXISTS remix_price DECIMAL(10,2) DEFAULT 0.5;

ALTER TABLE ip_tracks 
ADD COLUMN IF NOT EXISTS combined_price DECIMAL(10,2) DEFAULT 2.5;

-- Add contact info columns
ALTER TABLE ip_tracks 
ADD COLUMN IF NOT EXISTS commercial_contact TEXT;

ALTER TABLE ip_tracks 
ADD COLUMN IF NOT EXISTS commercial_contact_fee DECIMAL(10,2) DEFAULT 10;

ALTER TABLE ip_tracks 
ADD COLUMN IF NOT EXISTS collab_contact TEXT;

ALTER TABLE ip_tracks 
ADD COLUMN IF NOT EXISTS collab_contact_fee DECIMAL(10,2) DEFAULT 1;

-- Update any existing rows to have sensible defaults based on current data
UPDATE ip_tracks
SET 
  license_selection = CASE 
    WHEN allow_remixing = true THEN 'platform_remix'
    ELSE 'platform_remix'
  END,
  remix_price = CASE
    WHEN price_stx > 0 THEN price_stx
    ELSE 0.5
  END,
  combined_price = CASE
    WHEN price_stx > 0 THEN price_stx * 5
    ELSE 2.5
  END
WHERE license_selection IS NULL;

-- Add comment to document the schema change
COMMENT ON COLUMN ip_tracks.license_selection IS 'License type selection: platform_remix or platform_download';
COMMENT ON COLUMN ip_tracks.allow_downloads IS 'Whether track can be downloaded for external use';
COMMENT ON COLUMN ip_tracks.open_to_commercial IS 'Whether creator is open to commercial/sync licensing';
COMMENT ON COLUMN ip_tracks.remix_price IS 'Price for platform remix only license';
COMMENT ON COLUMN ip_tracks.combined_price IS 'Price for platform + download license';
COMMENT ON COLUMN ip_tracks.commercial_contact IS 'Contact info for commercial inquiries';
COMMENT ON COLUMN ip_tracks.commercial_contact_fee IS 'Fee to unlock commercial contact info';
COMMENT ON COLUMN ip_tracks.collab_contact IS 'Contact info for collaboration requests';
COMMENT ON COLUMN ip_tracks.collab_contact_fee IS 'Fee to unlock collaboration contact info';

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns
WHERE table_name = 'ip_tracks'
  AND column_name IN (
    'license_selection', 
    'allow_downloads', 
    'open_to_commercial',
    'remix_price',
    'combined_price',
    'commercial_contact',
    'commercial_contact_fee',
    'collab_contact', 
    'collab_contact_fee'
  )
ORDER BY column_name;