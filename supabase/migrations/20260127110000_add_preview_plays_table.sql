-- Preview Plays Table (Analytics)
-- Tracks 20-second preview plays from non-paying listeners
-- Useful for measuring engagement and conversion potential

CREATE TABLE IF NOT EXISTS preview_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL,                  -- References ip_tracks(id)
  content_type TEXT NOT NULL,              -- full_song, loop, etc.
  user_address TEXT,                       -- Optional - may be anonymous
  globe_location INTEGER,                  -- Which globe location (for geo analytics)
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_preview_plays_track ON preview_plays(track_id);
CREATE INDEX IF NOT EXISTS idx_preview_plays_date ON preview_plays(played_at);
CREATE INDEX IF NOT EXISTS idx_preview_plays_user ON preview_plays(user_address) WHERE user_address IS NOT NULL;

-- RLS policies
ALTER TABLE preview_plays ENABLE ROW LEVEL SECURITY;

CREATE POLICY preview_plays_insert ON preview_plays
  FOR INSERT WITH CHECK (true);

CREATE POLICY preview_plays_select ON preview_plays
  FOR SELECT USING (true);

COMMENT ON TABLE preview_plays IS 'Analytics table for 20-second preview plays (non-paying listeners)';
