-- Create profile-images bucket for user profile pictures
-- This bucket will be public since profile images should be viewable by everyone

-- Check existing buckets
SELECT id, name, public FROM storage.buckets;

-- Create the profile-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images',
  'profile-images',
  true,  -- Make it public so anyone can view profile images
  false, -- No AVIF auto-detection
  5242880, -- 5MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create simple RLS policies for the profile-images bucket
-- Since it's a public bucket, we just need basic upload/manage permissions

-- Allow anyone to view profile images (public bucket)
CREATE POLICY "Anyone can view profile images"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-images');

-- Allow anyone to upload profile images (simplified for development)
-- In production, you'd want to restrict this to authenticated users
CREATE POLICY "Anyone can upload profile images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'profile-images');

-- Allow anyone to update their uploads
CREATE POLICY "Anyone can update profile images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'profile-images');

-- Allow anyone to delete their uploads
CREATE POLICY "Anyone can delete profile images"
ON storage.objects FOR DELETE
USING (bucket_id = 'profile-images');

-- Verify the bucket was created
SELECT * FROM storage.buckets WHERE name = 'profile-images';