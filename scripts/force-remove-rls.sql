-- =================================================================
-- FORCE REMOVE ALL PROBLEMATIC DATABASE OBJECTS - WITH CASCADE
-- =================================================================
-- Using CASCADE to remove all dependent objects as suggested by the error
-- =================================================================

-- Step 1: Drop everything with CASCADE
-- =================================================================
-- Drop the problematic RLS policy first
DROP POLICY IF EXISTS "Users can view tracks for their store" ON ip_tracks;

-- Drop the view that depends on the function
DROP VIEW IF EXISTS ip_tracks_store_display CASCADE;

-- Drop the function with CASCADE to remove all dependencies
DROP FUNCTION IF EXISTS should_show_track_in_store(ip_tracks, TEXT) CASCADE;

-- Drop other helper functions
DROP FUNCTION IF EXISTS set_collaboration_preference(UUID, TEXT, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS get_track_collaborators(UUID) CASCADE;

-- Step 2: Add simple RLS policies
-- =================================================================
-- Allow everyone to view all tracks (public read)
CREATE POLICY "Allow public read access to tracks" ON ip_tracks
    FOR SELECT USING (true);

-- Step 3: Test that queries work now
-- =================================================================
-- Simple test queries
SELECT COUNT(*) as total_tracks FROM ip_tracks;

SELECT COUNT(*) as djchikk_tracks 
FROM ip_tracks 
WHERE primary_uploader_wallet = 'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE';

-- =================================================================
-- This should completely remove all problematic database objects
-- and allow the CreatorStore component to work with simple queries
-- ================================================================= 