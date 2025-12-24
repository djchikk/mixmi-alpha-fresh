-- ========================================
-- Find and Delete Duplicate Rows in ip_tracks
-- ========================================

-- Step 1: Find all duplicate IDs
SELECT id, title, created_at, COUNT(*)
FROM ip_tracks
GROUP BY id, title, created_at
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- Step 2: See ALL rows with the duplicate ID mentioned in error
SELECT id, title, artist, created_at, content_type
FROM ip_tracks
WHERE id = '915699a5-31ba-4a06-ac62-136950398a36'
ORDER BY created_at;

-- Step 3: Delete duplicates, keeping only the oldest row for each ID
-- This uses a CTE to identify which rows to keep
WITH duplicates AS (
  SELECT id,
         ctid, -- Physical row ID in Postgres
         ROW_NUMBER() OVER (PARTITION BY id ORDER BY created_at ASC) as row_num
  FROM ip_tracks
)
DELETE FROM ip_tracks
WHERE ctid IN (
  SELECT ctid
  FROM duplicates
  WHERE row_num > 1  -- Delete all but the first (oldest) row
);

-- Step 4: Verify no more duplicates exist
SELECT id, COUNT(*)
FROM ip_tracks
GROUP BY id
HAVING COUNT(*) > 1;

-- Step 5: Now add the PRIMARY KEY
ALTER TABLE ip_tracks
ADD PRIMARY KEY (id);

-- Step 6: Verify success
SELECT
    conname AS constraint_name,
    contype AS constraint_type
FROM pg_constraint
WHERE conrelid = 'ip_tracks'::regclass;
