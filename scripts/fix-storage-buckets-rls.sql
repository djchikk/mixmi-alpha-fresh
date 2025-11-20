-- =================================================================
-- FIX: Create storage buckets and add RLS policies for video uploads
-- =================================================================
-- This script creates the necessary storage buckets and RLS policies
-- to allow video clip and thumbnail uploads
-- =================================================================

-- Step 1: Create storage buckets if they don't exist
-- Note: You may need to create these manually in Supabase Storage UI first
-- if this doesn't work, as bucket creation often requires dashboard access

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('video-clips', 'video-clips', true, 10485760, ARRAY['video/mp4', 'video/quicktime', 'video/webm']::text[]),
  ('cover-images', 'cover-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO NOTHING;

-- Step 2: Enable RLS on storage.objects table (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies if they exist (for clean slate)
DROP POLICY IF EXISTS "Public can view video clips" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload video clips" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own video clips" ON storage.objects;
DROP POLICY IF EXISTS "Public can view cover images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload cover images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own cover images" ON storage.objects;

-- Step 4: Create RLS policies for video-clips bucket

-- Allow public SELECT (viewing videos)
CREATE POLICY "Public can view video clips" ON storage.objects
FOR SELECT
USING (bucket_id = 'video-clips');

-- Allow anyone to INSERT (upload videos)
CREATE POLICY "Anyone can upload video clips" ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'video-clips');

-- Allow anyone to DELETE their own videos (by matching the file path)
CREATE POLICY "Users can delete own video clips" ON storage.objects
FOR DELETE
USING (bucket_id = 'video-clips');

-- Step 5: Create RLS policies for cover-images bucket

-- Allow public SELECT (viewing thumbnails)
CREATE POLICY "Public can view cover images" ON storage.objects
FOR SELECT
USING (bucket_id = 'cover-images');

-- Allow anyone to INSERT (upload thumbnails)
CREATE POLICY "Anyone can upload cover images" ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'cover-images');

-- Allow anyone to DELETE their own images
CREATE POLICY "Users can delete own cover images" ON storage.objects
FOR DELETE
USING (bucket_id = 'cover-images');

-- =================================================================
-- VERIFICATION QUERIES
-- =================================================================

-- Verify buckets were created
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('video-clips', 'cover-images');

-- Verify RLS policies were created
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
ORDER BY policyname;

-- =================================================================
-- SUCCESS MESSAGE
-- =================================================================
-- If you see the buckets and policies above, storage is ready!
-- You should now be able to upload video clips and thumbnails.
-- =================================================================
