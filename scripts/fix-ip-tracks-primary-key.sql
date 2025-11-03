-- ========================================
-- Add PRIMARY KEY to ip_tracks table
-- ========================================
-- This allows Supabase UI to delete/update rows

-- First, check current constraints
SELECT
    conname AS constraint_name,
    contype AS constraint_type
FROM pg_constraint
WHERE conrelid = 'ip_tracks'::regclass;

-- Check for any duplicate IDs before adding PRIMARY KEY
SELECT id, COUNT(*)
FROM ip_tracks
GROUP BY id
HAVING COUNT(*) > 1;

-- If there are duplicates, you'll need to handle them first
-- For now, let's add the PRIMARY KEY (this will fail if duplicates exist)

ALTER TABLE ip_tracks
ADD PRIMARY KEY (id);

-- Verify the constraint was added
SELECT
    conname AS constraint_name,
    contype AS constraint_type
FROM pg_constraint
WHERE conrelid = 'ip_tracks'::regclass;
