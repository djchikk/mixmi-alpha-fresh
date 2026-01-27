-- Day Pass System Tables
-- Enables $1/day unlimited streaming with play-based revenue distribution

-- Table: day_passes
-- Tracks purchased day passes and their status
CREATE TABLE IF NOT EXISTS day_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,              -- SUI address of buyer
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,         -- purchased_at + 24 hours
  amount_usdc DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  tx_hash TEXT,                            -- SUI transaction hash
  status TEXT NOT NULL DEFAULT 'active',   -- active, expired, distributed
  distributed_at TIMESTAMPTZ,              -- when revenue was distributed
  distribution_tx_hash TEXT,               -- SUI tx for revenue distribution
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for day_passes
CREATE INDEX IF NOT EXISTS idx_day_passes_user ON day_passes(user_address);
CREATE INDEX IF NOT EXISTS idx_day_passes_status ON day_passes(status);
CREATE INDEX IF NOT EXISTS idx_day_passes_expires ON day_passes(expires_at);

-- Table: day_pass_plays
-- Logs each track play during an active day pass
CREATE TABLE IF NOT EXISTS day_pass_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_pass_id UUID NOT NULL REFERENCES day_passes(id) ON DELETE CASCADE,
  track_id UUID NOT NULL,                  -- References ip_tracks(id)
  content_type TEXT NOT NULL,              -- full_song, loop, loop_pack
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER,                -- actual play duration
  credits INTEGER NOT NULL DEFAULT 1,      -- calculated credits for this play

  CONSTRAINT fk_day_pass FOREIGN KEY (day_pass_id) REFERENCES day_passes(id)
);

-- Indexes for day_pass_plays
CREATE INDEX IF NOT EXISTS idx_plays_day_pass ON day_pass_plays(day_pass_id);
CREATE INDEX IF NOT EXISTS idx_plays_track ON day_pass_plays(track_id);
CREATE INDEX IF NOT EXISTS idx_plays_played_at ON day_pass_plays(played_at);

-- Function to calculate credits based on content type
-- full_song/loop_pack: 5 credits, loop: 1 credit
CREATE OR REPLACE FUNCTION calculate_play_credits(content_type TEXT)
RETURNS INTEGER AS $$
BEGIN
  CASE content_type
    WHEN 'full_song' THEN RETURN 5;
    WHEN 'loop_pack' THEN RETURN 5;
    WHEN 'ep' THEN RETURN 5;
    ELSE RETURN 1;  -- loops get 1 credit
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate credits on insert
CREATE OR REPLACE FUNCTION set_play_credits()
RETURNS TRIGGER AS $$
BEGIN
  NEW.credits := calculate_play_credits(NEW.content_type);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_play_credits ON day_pass_plays;
CREATE TRIGGER trigger_set_play_credits
  BEFORE INSERT ON day_pass_plays
  FOR EACH ROW
  EXECUTE FUNCTION set_play_credits();

-- Function to check if user has active day pass
CREATE OR REPLACE FUNCTION has_active_day_pass(p_user_address TEXT)
RETURNS TABLE (
  has_pass BOOLEAN,
  day_pass_id UUID,
  expires_at TIMESTAMPTZ,
  remaining_seconds INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE as has_pass,
    dp.id as day_pass_id,
    dp.expires_at,
    EXTRACT(EPOCH FROM (dp.expires_at - NOW()))::INTEGER as remaining_seconds
  FROM day_passes dp
  WHERE dp.user_address = p_user_address
    AND dp.status = 'active'
    AND dp.expires_at > NOW()
  ORDER BY dp.expires_at DESC
  LIMIT 1;

  -- If no rows returned, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TIMESTAMPTZ, 0;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get play summary for a day pass (for distribution)
CREATE OR REPLACE FUNCTION get_day_pass_play_summary(p_day_pass_id UUID)
RETURNS TABLE (
  track_id UUID,
  total_credits BIGINT,
  play_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dpp.track_id,
    SUM(dpp.credits)::BIGINT as total_credits,
    COUNT(*)::BIGINT as play_count
  FROM day_pass_plays dpp
  WHERE dpp.day_pass_id = p_day_pass_id
  GROUP BY dpp.track_id
  ORDER BY total_credits DESC;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies
ALTER TABLE day_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_pass_plays ENABLE ROW LEVEL SECURITY;

-- Users can read their own day passes
CREATE POLICY day_passes_select_own ON day_passes
  FOR SELECT USING (true);  -- Allow reading all for now (needed for distribution)

-- Service role can insert/update
CREATE POLICY day_passes_insert ON day_passes
  FOR INSERT WITH CHECK (true);

CREATE POLICY day_passes_update ON day_passes
  FOR UPDATE USING (true);

-- Similar for plays
CREATE POLICY day_pass_plays_select ON day_pass_plays
  FOR SELECT USING (true);

CREATE POLICY day_pass_plays_insert ON day_pass_plays
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE day_passes IS 'Tracks purchased day passes ($1/24hr unlimited streaming)';
COMMENT ON TABLE day_pass_plays IS 'Logs each track play during active day pass for revenue distribution';
