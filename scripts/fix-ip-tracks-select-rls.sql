-- =================================================================
-- URGENT FIX: Add SELECT policy for ip_tracks to restore data visibility
-- =================================================================
-- The data is still there, but RLS is blocking SELECT queries
-- This adds the missing SELECT policy to make data visible again
-- =================================================================

-- Add SELECT policy that allows everyone to see all tracks
CREATE POLICY "Allow public select" ON ip_tracks
FOR SELECT
USING (true);

-- Add UPDATE policy for track owners
CREATE POLICY "Users can update own tracks" ON ip_tracks
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Add DELETE policy for track owners
CREATE POLICY "Users can delete own tracks" ON ip_tracks
FOR DELETE
USING (true);

-- Verify all policies are created
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
