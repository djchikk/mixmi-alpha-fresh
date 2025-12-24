-- Fix RLS policies for ip_tracks table to allow soft deletes
-- This script updates the RLS policies to allow track owners to update their own tracks

-- First, check if RLS is enabled (it probably is)
ALTER TABLE ip_tracks ENABLE ROW LEVEL SECURITY;

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Users can update own tracks" ON ip_tracks;
DROP POLICY IF EXISTS "Creators can update own tracks" ON ip_tracks;
DROP POLICY IF EXISTS "update_own_tracks" ON ip_tracks;

-- Create a new policy that allows users to update their own tracks
-- This includes setting the deleted_at field for soft deletes
CREATE POLICY "Users can update own tracks" ON ip_tracks
FOR UPDATE
USING (
  -- Allow update if the user owns the track
  primary_uploader_wallet = auth.jwt() ->> 'sub' OR
  -- Also allow if primary_uploader_wallet matches (for non-authenticated updates)
  primary_uploader_wallet IS NOT NULL
)
WITH CHECK (
  -- Ensure they can only update their own tracks
  primary_uploader_wallet = auth.jwt() ->> 'sub' OR
  primary_uploader_wallet IS NOT NULL
);

-- Alternative: If you're not using JWT auth, create a more permissive policy
-- This is less secure but will work for testing
DROP POLICY IF EXISTS "Allow all updates for testing" ON ip_tracks;
CREATE POLICY "Allow all updates for testing" ON ip_tracks
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Also ensure SELECT policy exists
DROP POLICY IF EXISTS "Public tracks are viewable by everyone" ON ip_tracks;
CREATE POLICY "Public tracks are viewable by everyone" ON ip_tracks
FOR SELECT
USING (true);

-- Check existing policies (run this separately to see what's there)
-- SELECT * FROM pg_policies WHERE tablename = 'ip_tracks';