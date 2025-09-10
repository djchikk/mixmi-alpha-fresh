-- =====================================================
-- DEBUG CERTIFICATES - Check what's in the table
-- =====================================================
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Check if any certificates exist at all
SELECT COUNT(*) as total_certificates
FROM certificates;

-- 2. Show all certificates with their details
SELECT 
    id,
    certificate_number,
    track_id,
    wallet_address,
    pdf_url,
    created_at,
    metadata
FROM certificates
ORDER BY created_at DESC;

-- 3. Check for any certificates for a specific wallet (replace with your wallet)
-- SELECT * FROM certificates WHERE wallet_address = 'YOUR_WALLET_ADDRESS';

-- 4. Check if the pdf_url values are properly formatted
SELECT 
    certificate_number,
    pdf_url,
    CASE 
        WHEN pdf_url IS NULL THEN 'NULL'
        WHEN pdf_url = '' THEN 'EMPTY'
        WHEN pdf_url LIKE 'http%' THEN 'VALID URL'
        ELSE 'INVALID FORMAT'
    END as url_status
FROM certificates;

-- 5. Check the storage bucket for certificates
SELECT 
    name,
    id,
    public
FROM storage.buckets
WHERE id = 'certificates';

-- 6. Check if there are any files in the certificates bucket
SELECT 
    COUNT(*) as total_files
FROM storage.objects
WHERE bucket_id = 'certificates';