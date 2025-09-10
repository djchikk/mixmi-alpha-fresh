# Fix for Track Not Saving Issue

## Problem
Tracks are not saving because the `duration` column is missing from the database.

## Solution
Run the following SQL in your Supabase SQL Editor:

```sql
-- Add duration column to ip_tracks table
ALTER TABLE ip_tracks 
ADD COLUMN IF NOT EXISTS duration REAL;

-- Add comment for documentation
COMMENT ON COLUMN ip_tracks.duration IS 'Duration of the audio track in seconds';
```

## Steps:
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Paste the above SQL
4. Click "Run"
5. Test saving a track again

The duration field will now be saved properly and appear on certificates for full songs.