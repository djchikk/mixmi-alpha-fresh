-- Agent Search Logs Table
-- Captures what users search for to improve metadata suggestions and understand user needs
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS agent_search_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- The raw search query as typed by user
  query TEXT NOT NULL,

  -- The mode used (hunt = text search, vibe = track-based matching)
  mode TEXT NOT NULL CHECK (mode IN ('hunt', 'vibe')),

  -- Parsed search criteria (JSON) - what we extracted from the query
  -- Includes: bpmRange, contentTypes, energy, texture, keywords
  parsed_criteria JSONB,

  -- How many results were returned
  results_count INTEGER NOT NULL DEFAULT 0,

  -- Whether the search was "successful" (found at least 1 result)
  had_results BOOLEAN GENERATED ALWAYS AS (results_count > 0) STORED,

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for analyzing search patterns over time
CREATE INDEX idx_agent_search_logs_created_at ON agent_search_logs(created_at DESC);

-- Index for finding failed searches (opportunities for better metadata)
CREATE INDEX idx_agent_search_logs_no_results ON agent_search_logs(had_results) WHERE had_results = false;

-- Enable RLS but allow insert from API (service role)
ALTER TABLE agent_search_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow inserts from authenticated service role (API)
CREATE POLICY "Allow service role insert" ON agent_search_logs
  FOR INSERT
  WITH CHECK (true);

-- Policy: Allow read for admin analysis (you can restrict this further)
CREATE POLICY "Allow service role read" ON agent_search_logs
  FOR SELECT
  USING (true);

-- Comments for documentation
COMMENT ON TABLE agent_search_logs IS 'Logs agent search queries to understand user needs and improve upload metadata suggestions';
COMMENT ON COLUMN agent_search_logs.query IS 'Raw search text entered by user';
COMMENT ON COLUMN agent_search_logs.parsed_criteria IS 'JSON of extracted criteria: bpmRange, contentTypes, energy, texture, keywords';
COMMENT ON COLUMN agent_search_logs.results_count IS 'Number of tracks returned for this search';
