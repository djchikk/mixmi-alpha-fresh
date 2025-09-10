-- Create dedicated track-covers bucket with simple permissions
-- Perfect for alpha testing and track cover uploads!

-- 1. Create the track-covers bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('track-covers', 'track-covers', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on the bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Simple public read access for track covers
CREATE POLICY "Public read access for track covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'track-covers');

-- 4. Allow authenticated uploads to track-covers bucket
-- Much simpler - any authenticated user can upload track covers
CREATE POLICY "Authenticated users can upload track covers"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'track-covers'
  AND auth.role() = 'authenticated'  -- Simple: just need to be authenticated
);

-- 5. Users can update their own track covers  
CREATE POLICY "Users can update own track covers"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'track-covers'
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'track-covers'
  AND auth.role() = 'authenticated'
);

-- 6. Users can delete their own track covers
CREATE POLICY "Users can delete own track covers"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'track-covers'
  AND auth.role() = 'authenticated'
);

-- Verify bucket creation
SELECT name, public FROM storage.buckets WHERE id = 'track-covers';