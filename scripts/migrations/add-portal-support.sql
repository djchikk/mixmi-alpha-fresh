-- Portal Support Migration
-- Run this in Supabase SQL Editor

-- Add portal_username column to ip_tracks
-- This stores the username of the profile the portal links to
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS portal_username TEXT;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ip_tracks'
AND column_name = 'portal_username';
