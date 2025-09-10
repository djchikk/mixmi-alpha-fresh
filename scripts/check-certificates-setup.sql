-- =====================================================
-- CHECK IF CERTIFICATES SYSTEM IS ALREADY SET UP
-- =====================================================
-- Run this in your Supabase SQL Editor to verify setup
-- =====================================================

-- 1. Check if certificates table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'certificates'
) AS certificates_table_exists;

-- 2. Get certificates table structure if it exists
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'certificates'
ORDER BY ordinal_position;

-- 3. Check if certificates storage bucket exists
SELECT 
    id,
    name,
    public,
    created_at
FROM storage.buckets
WHERE id = 'certificates' OR name = 'certificates';

-- 4. Check RLS policies on certificates table
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
WHERE tablename = 'certificates';

-- 5. Count existing certificates (if table exists)
SELECT 
    COUNT(*) as total_certificates,
    COUNT(DISTINCT wallet_address) as unique_wallets,
    MIN(created_at) as first_certificate,
    MAX(created_at) as latest_certificate
FROM certificates
WHERE EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'certificates'
);

-- 6. Show sample of existing certificates (if any)
SELECT 
    certificate_number,
    track_id,
    wallet_address,
    created_at,
    pdf_url
FROM certificates
ORDER BY created_at DESC
LIMIT 5;