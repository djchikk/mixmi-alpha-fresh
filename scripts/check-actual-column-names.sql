-- =================================================================
-- CHECK ACTUAL COLUMN NAMES IN ip_tracks TABLE
-- =================================================================

-- Get all column names for ip_tracks table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'ip_tracks' 
AND column_name LIKE '%split%' OR column_name LIKE '%address%' OR column_name LIKE '%shares%' OR column_name LIKE '%composition%' OR column_name LIKE '%production%'
ORDER BY column_name;

-- Also check for any functions that might be causing issues
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name LIKE '%track%' 
AND routine_schema = 'public';

-- =================================================================
-- This will show us the exact field names so we can fix the function
-- ================================================================= 