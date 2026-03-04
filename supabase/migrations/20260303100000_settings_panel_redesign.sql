-- Settings panel redesign: add known_locations and default_remix_opt_out
-- known_locations: array of location strings for chip-based selection during upload
-- default_remix_opt_out: whether creator opts out of remix by default

ALTER TABLE agent_preferences
  ADD COLUMN IF NOT EXISTS known_locations JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS default_remix_opt_out BOOLEAN DEFAULT FALSE;
