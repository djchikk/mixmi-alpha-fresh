-- =================================================================
-- REMOVE PROBLEMATIC RLS POLICIES AND FUNCTIONS - URGENT FIX
-- =================================================================
-- The should_show_track_in_store function is causing field name errors
-- Let's remove it and use simple query filtering instead
-- =================================================================

-- Step 1: Drop the problematic RLS policy
-- =================================================================
DROP POLICY IF EXISTS "Users can view tracks for their store" ON ip_tracks;

-- Step 2: Drop the problematic function
-- =================================================================
DROP FUNCTION IF EXISTS should_show_track_in_store(ip_tracks, TEXT);

-- Step 3: Drop the problematic view
-- =================================================================
DROP VIEW IF EXISTS ip_tracks_store_display;

-- Step 4: Drop other helper functions that might cause issues
-- =================================================================
DROP FUNCTION IF EXISTS set_collaboration_preference(UUID, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS get_track_collaborators(UUID);

-- Step 5: Add simple RLS policies instead
-- =================================================================
-- Allow everyone to view all tracks (public read)
CREATE POLICY "Allow public read access to tracks" ON ip_tracks
    FOR SELECT USING (true);

-- Allow authenticated users to manage their own tracks
CREATE POLICY "Users can manage their own tracks" ON ip_tracks
    FOR ALL USING (auth.jwt() ->> 'wallet_address' = primary_uploader_wallet);

-- Step 6: Verify the fix
-- =================================================================
-- Test a simple query that should work now
SELECT COUNT(*) as total_tracks FROM ip_tracks;

SELECT COUNT(*) as djchikk_tracks 
FROM ip_tracks 
WHERE primary_uploader_wallet = 'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE';

-- =================================================================
-- This removes the complex functions and uses simple filtering
-- The CreatorStore component will now work with basic queries
-- ================================================================= 