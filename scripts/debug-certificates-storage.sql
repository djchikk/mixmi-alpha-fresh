-- =====================================================
-- DEBUG CERTIFICATES STORAGE ISSUE
-- =====================================================
-- Run these queries to check what's happening
-- =====================================================

-- 1. Check if storage bucket exists and is configured correctly
SELECT 
    id,
    name, 
    public,
    allowed_mime_types,
    file_size_limit
FROM storage.buckets
WHERE id = 'certificates';

-- 2. Check any objects in certificates bucket
SELECT 
    id,
    name,
    bucket_id,
    created_at,
    updated_at,
    metadata
FROM storage.objects
WHERE bucket_id = 'certificates'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check RLS on certificates table
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'certificates';

-- 4. Try to see ALL certificates without RLS (as service role)
-- This will show if data exists but RLS is blocking it
SELECT 
    id,
    certificate_number,
    track_id,
    wallet_address,
    pdf_url,
    created_at
FROM certificates
ORDER BY created_at DESC;

-- 5. Check if the problem is with the INSERT permissions
-- Get the current user's role
SELECT current_user, session_user;

-- 6. Check table constraints that might be preventing inserts
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'certificates'::regclass;