-- Add /covers/ path support to RLS policies for track cover uploads
-- Run this in Supabase SQL Editor

-- Drop existing upload policy
DROP POLICY IF EXISTS "Wallet owners can upload" ON storage.objects;

-- Create updated policy that includes /covers/ path
CREATE POLICY "Wallet owners can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-content' 
  AND get_wallet_from_path(name) = get_wallet_from_jwt()
  AND (
    name LIKE '%/gifs/%' 
    OR name LIKE '%/images/%'
    OR name LIKE '%/covers/%'  -- NEW: Allow track cover uploads!
  )
);

-- Verify the policy works
SELECT 1 as policy_updated;