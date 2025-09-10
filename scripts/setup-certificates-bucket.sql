-- =====================================================
-- SETUP CERTIFICATES STORAGE BUCKET
-- =====================================================
-- Run this to create the certificates storage bucket
-- =====================================================

-- 1. Create the certificates storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'certificates',
    'certificates', 
    true, -- Make it public so PDFs can be accessed via URL
    10485760, -- 10MB limit
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf'];

-- 2. Set up storage policies for the certificates bucket
-- Allow authenticated users to upload their own certificates
CREATE POLICY "Users can upload their own certificates"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'certificates' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anyone to view certificates (since they have unique IDs)
CREATE POLICY "Anyone can view certificates"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'certificates');

-- 3. Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'certificates';