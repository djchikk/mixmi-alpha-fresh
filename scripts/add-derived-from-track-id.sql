-- Migration: Add derived_from_track_id column to ip_tracks
-- Purpose: Track provenance - "this loop came from this song"
--
-- This is DIFFERENT from:
--   - pack_id: structural relationship (loop is PART OF a pack)
--   - source_track_ids: remix system (mixer-created combinations of multiple tracks)
--   - derived_from_track_id: provenance (this content was EXTRACTED FROM that content)
--
-- Use cases:
--   - Loop extracted from a song on mixmi → links to the song's UUID
--   - Sample cut from a full track → links to the original
--   - Enables "View source track" in TrackDetailsModal
--   - Future: show all derived content on a track's detail page
--
-- Run this in your Supabase SQL Editor

-- Add the column (nullable UUID referencing ip_tracks)
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS derived_from_track_id UUID REFERENCES ip_tracks(id) ON DELETE SET NULL;

-- Add an index for efficient lookups (find all loops derived from a song)
CREATE INDEX IF NOT EXISTS idx_ip_tracks_derived_from
ON ip_tracks(derived_from_track_id)
WHERE derived_from_track_id IS NOT NULL;

-- Add a comment explaining the field
COMMENT ON COLUMN ip_tracks.derived_from_track_id IS
'UUID of the track this content was derived/extracted from. For provenance tracking (e.g., loop extracted from a song). Not for remix relationships.';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ip_tracks' AND column_name = 'derived_from_track_id';
