-- =================================================================
-- ADD REMIX & PAYMENT FIELDS TO ip_tracks TABLE
-- =================================================================
-- This adds all the fields needed for mixer recording and payment splitting
-- Run this in your Supabase SQL Editor
-- =================================================================

-- Add Stacks transaction tracking
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS stacks_tx_id TEXT;

-- Add remix depth tracking
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS remix_depth INTEGER DEFAULT 0;

-- Add source track IDs (for tracking which tracks were remixed)
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS source_track_ids TEXT[];

-- Add composition splits (for IP attribution)
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS composition_split_1_wallet TEXT,
ADD COLUMN IF NOT EXISTS composition_split_1_percentage INTEGER,
ADD COLUMN IF NOT EXISTS composition_split_2_wallet TEXT,
ADD COLUMN IF NOT EXISTS composition_split_2_percentage INTEGER,
ADD COLUMN IF NOT EXISTS composition_split_3_wallet TEXT,
ADD COLUMN IF NOT EXISTS composition_split_3_percentage INTEGER;

-- Add production splits (for IP attribution)
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS production_split_1_wallet TEXT,
ADD COLUMN IF NOT EXISTS production_split_1_percentage INTEGER,
ADD COLUMN IF NOT EXISTS production_split_2_wallet TEXT,
ADD COLUMN IF NOT EXISTS production_split_2_percentage INTEGER,
ADD COLUMN IF NOT EXISTS production_split_3_wallet TEXT,
ADD COLUMN IF NOT EXISTS production_split_3_percentage INTEGER;

-- Add licensing and metadata fields
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS license_type TEXT DEFAULT 'RMX',
ADD COLUMN IF NOT EXISTS allow_remixing BOOLEAN DEFAULT true;

-- Add price field if it doesn't exist
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS price_stx DECIMAL(10,2) DEFAULT 2.5;

-- Add comments for documentation
COMMENT ON COLUMN ip_tracks.stacks_tx_id IS 'Blockchain transaction ID for payment verification';
COMMENT ON COLUMN ip_tracks.remix_depth IS 'How many generations deep this remix is (0 = original)';
COMMENT ON COLUMN ip_tracks.source_track_ids IS 'Array of track IDs that were remixed to create this track';
COMMENT ON COLUMN ip_tracks.composition_split_1_wallet IS 'First composition contributor wallet address';
COMMENT ON COLUMN ip_tracks.composition_split_1_percentage IS 'First composition contributor percentage (0-100)';
COMMENT ON COLUMN ip_tracks.license_type IS 'License type: RMX (remix), OG (original), etc.';
COMMENT ON COLUMN ip_tracks.allow_remixing IS 'Whether this track can be used in remixes';
COMMENT ON COLUMN ip_tracks.price_stx IS 'Price in STX for purchasing this track';

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ip_tracks'
  AND column_name LIKE '%split%'
     OR column_name LIKE '%stacks%'
     OR column_name LIKE '%remix%'
ORDER BY column_name;
