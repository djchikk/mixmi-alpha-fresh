-- =================================================================
-- CHECK ACTUAL DATABASE SCHEMA: ip_tracks table
-- =================================================================
-- Run this in your Supabase SQL Editor to see what columns really exist
-- =================================================================

-- Get all column information for ip_tracks table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ip_tracks' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Also check if there are multiple tables with similar names
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name LIKE '%track%'
ORDER BY table_name; 