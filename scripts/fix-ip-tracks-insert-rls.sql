-- =================================================================
-- FIX: Add INSERT policy for ip_tracks to allow video clip uploads
-- =================================================================
-- This adds the missing INSERT RLS policy so users can upload tracks
-- =================================================================

-- Enable RLS if not already enabled
ALTER TABLE ip_tracks ENABLE ROW LEVEL SECURITY;

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Users can insert own tracks" ON ip_tracks;
DROP POLICY IF EXISTS "Allow authenticated inserts" ON ip_tracks;
DROP POLICY IF EXISTS "insert_own_tracks" ON ip_tracks;

-- Create INSERT policy that allows authenticated users to insert tracks
-- This is permissive for now - anyone can insert a track
CREATE POLICY "Users can insert own tracks" ON ip_tracks
FOR INSERT
WITH CHECK (true);

-- Verify the policy was created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'ip_tracks'
ORDER BY cmd, policyname;
