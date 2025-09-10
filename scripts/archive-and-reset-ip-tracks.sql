-- 🗄️ ARCHIVE AND RESET IP_TRACKS TABLE
-- This script safely archives the current messy alpha data and creates a fresh table
-- for clean content re-registration using the admin wallet override tool.

-- ⚠️  IMPORTANT: RUN THIS STEP-BY-STEP, NOT ALL AT ONCE
-- Copy each section into Supabase SQL editor individually

-- =============================================================================
-- STEP 1: SAFETY BACKUP (Create exact copy)
-- =============================================================================
-- Creates a complete backup copy of current data before any changes

DROP TABLE IF EXISTS ip_tracks_backup;
CREATE TABLE ip_tracks_backup AS 
SELECT * FROM ip_tracks;

-- Verify backup was created
SELECT 
  'BACKUP CREATED' as status,
  COUNT(*) as total_rows,
  COUNT(DISTINCT primary_uploader_wallet) as unique_wallets
FROM ip_tracks_backup;

-- =============================================================================
-- STEP 2: ARCHIVE CURRENT TABLE (Rename to archive)
-- =============================================================================
-- Renames the current messy table to preserve all alpha data

ALTER TABLE ip_tracks RENAME TO ip_tracks_alpha_archive;

-- Verify rename worked
SELECT 
  'ARCHIVE RENAMED' as status,
  COUNT(*) as archived_rows
FROM ip_tracks_alpha_archive;

-- =============================================================================
-- STEP 3: CREATE FRESH TABLE (Blank slate with current schema)
-- =============================================================================
-- Creates a brand new ip_tracks table with the current schema

CREATE TABLE ip_tracks (
  -- Core fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  version TEXT,
  artist TEXT NOT NULL,
  description TEXT,
  tell_us_more TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  
  -- Content classification
  content_type TEXT NOT NULL DEFAULT 'full_song' CHECK (content_type IN ('full_song', 'loop')),
  loop_category TEXT,
  sample_type TEXT,
  
  -- Audio metadata
  bpm DECIMAL(5,2),
  key TEXT,
  isrc_number TEXT,
  duration INTEGER,
  
  -- Location data (from Mapbox)
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  primary_location TEXT,
  locations JSONB,
  
  -- Attribution splits (composition)
  composition_split_1_wallet TEXT NOT NULL,
  composition_split_1_percentage INTEGER NOT NULL DEFAULT 100,
  composition_split_2_wallet TEXT,
  composition_split_2_percentage INTEGER DEFAULT 0,
  composition_split_3_wallet TEXT,
  composition_split_3_percentage INTEGER DEFAULT 0,
  
  -- Attribution splits (production)
  production_split_1_wallet TEXT NOT NULL,
  production_split_1_percentage INTEGER NOT NULL DEFAULT 100,
  production_split_2_wallet TEXT,
  production_split_2_percentage INTEGER DEFAULT 0,
  production_split_3_wallet TEXT,
  production_split_3_percentage INTEGER DEFAULT 0,
  
  -- Media files
  cover_image_url TEXT,
  audio_url TEXT,
  
  -- Licensing and permissions
  license_type TEXT DEFAULT 'remix_only' CHECK (license_type IN ('remix_only', 'remix_external', 'custom')),
  license_selection TEXT DEFAULT 'platform_remix' CHECK (license_selection IN ('platform_remix', 'platform_download')),
  allow_remixing BOOLEAN DEFAULT true,
  allow_downloads BOOLEAN DEFAULT false,
  open_to_commercial BOOLEAN DEFAULT false,
  open_to_collaboration BOOLEAN DEFAULT false,
  
  -- Pricing (in STX)
  price_stx DECIMAL(10,6) DEFAULT 0,
  remix_price DECIMAL(10,6) DEFAULT 0.5,
  combined_price DECIMAL(10,6) DEFAULT 2.5,
  download_price DECIMAL(10,6) DEFAULT 2.5,
  
  -- Contact information
  commercial_contact TEXT,
  commercial_contact_fee DECIMAL(10,6) DEFAULT 10,
  collab_contact TEXT,
  collab_contact_fee DECIMAL(10,6) DEFAULT 1,
  
  -- System fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Wallet and collaboration
  primary_uploader_wallet TEXT NOT NULL,
  uploader_address TEXT NOT NULL,
  collaboration_preferences JSONB DEFAULT '{}',
  store_display_policy TEXT DEFAULT 'primary_only',
  collaboration_type TEXT DEFAULT 'primary_artist',
  
  -- Additional system fields
  is_live BOOLEAN DEFAULT true,
  account_name TEXT,
  main_wallet_name TEXT,
  
  -- Remix tracking
  remix_depth INTEGER DEFAULT 0,
  source_track_ids TEXT[] DEFAULT '{}'
);

-- =============================================================================
-- STEP 4: SETUP ROW LEVEL SECURITY
-- =============================================================================
-- Enable RLS and create policies for the new table

ALTER TABLE ip_tracks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own tracks and public tracks
-- Note: Using wallet-based auth, not Supabase auth.uid()
CREATE POLICY "Users can view own tracks"
  ON ip_tracks FOR SELECT
  USING (is_live = true);

-- Policy: Allow inserts (wallet auth handled by application layer)
CREATE POLICY "Allow track inserts"
  ON ip_tracks FOR INSERT
  WITH CHECK (true);

-- Policy: Allow updates (wallet auth handled by application layer)  
CREATE POLICY "Allow track updates"
  ON ip_tracks FOR UPDATE
  USING (true);

-- Policy: Allow soft deletes (wallet auth handled by application layer)
CREATE POLICY "Allow track deletes"
  ON ip_tracks FOR DELETE
  USING (true);

-- =============================================================================
-- STEP 5: VERIFICATION
-- =============================================================================
-- Verify everything is set up correctly

SELECT 
  'FRESH TABLE CREATED' as status,
  COUNT(*) as rows_in_new_table
FROM ip_tracks;

SELECT 
  'ARCHIVE PRESERVED' as status,
  COUNT(*) as rows_in_archive
FROM ip_tracks_alpha_archive;

-- Show table structure (run this in a separate query if needed)
-- \d ip_tracks;  -- This is a psql command, not SQL
-- Alternative: Check table exists
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ip_tracks' 
ORDER BY ordinal_position;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS (IF NEEDED)
-- =============================================================================
-- If anything goes wrong, run these commands to restore original state:

/*
-- Emergency rollback commands:
DROP TABLE IF EXISTS ip_tracks;
ALTER TABLE ip_tracks_alpha_archive RENAME TO ip_tracks;
DROP TABLE IF EXISTS ip_tracks_backup;

-- This restores everything exactly as it was before
*/

-- =============================================================================
-- CLEANUP AFTER SUCCESSFUL MIGRATION
-- =============================================================================
-- Only run these AFTER successful re-registration is complete:

/*
-- Remove backup and archive tables (ONLY when satisfied with new data):
-- DROP TABLE ip_tracks_backup;
-- DROP TABLE ip_tracks_alpha_archive;
*/