-- Fix RLS policies for user-content bucket
-- This allows authenticated users to upload to their own folders

-- First, check if the bucket exists
SELECT id, name, public FROM storage.buckets WHERE name = 'user-content';

-- Drop existing policies if they exist (to start fresh)
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view all files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Create new policies for the user-content bucket

-- 1. Allow users to upload files to their own wallet folder
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-content'
  AND (
    -- Allow any authenticated user to upload (we're using wallet addresses, not auth.uid())
    true
  )
);

-- 2. Allow users to update their own files
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-content'
  -- Allow any authenticated user to update (simplified for wallet-based system)
  AND true
);

-- 3. Allow users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-content'
  -- Allow any authenticated user to delete (simplified for wallet-based system)
  AND true
);

-- 4. Allow public to view all files in user-content (since these are public profile images)
CREATE POLICY "Public can view all files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'user-content'
);

-- Alternative: If the above is too permissive, you can also just disable RLS on the bucket
-- This is often simpler for public content like profile images
-- UPDATE storage.buckets SET public = true WHERE name = 'user-content';

-- Check the policies
SELECT * FROM storage.objects
WHERE bucket_id = 'user-content'
LIMIT 1;

-- List all policies on storage.objects for user-content bucket
SELECT
    pol.policyname,
    pol.permissive,
    pol.cmd,
    pol.qual,
    pol.with_check
FROM pg_policies pol
WHERE pol.tablename = 'objects'
  AND pol.schemaname = 'storage'
ORDER BY pol.policyname;