-- Search Synonyms Table
-- Maps search terms to related terms for smarter matching
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS search_synonyms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- The term users might search for
  search_term TEXT NOT NULL,

  -- What it should also match (in track metadata)
  matches_term TEXT NOT NULL,

  -- Category helps organize and potentially weight matches
  -- location: geographic terms (japanese → tokyo)
  -- genre: music style terms (electronic → techno)
  -- mood: vibe/energy terms (chill → relaxed)
  -- language: script-based (日本 → japanese)
  category TEXT NOT NULL CHECK (category IN ('location', 'genre', 'mood', 'language', 'content_type')),

  -- Weight for ranking (higher = stronger association)
  -- 1.0 = equivalent, 0.5 = related, 0.25 = loosely related
  weight DECIMAL(3,2) DEFAULT 1.0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups during search
CREATE INDEX idx_search_synonyms_term ON search_synonyms(search_term);
CREATE INDEX idx_search_synonyms_category ON search_synonyms(category);

-- Unique constraint to prevent duplicates
CREATE UNIQUE INDEX idx_search_synonyms_unique ON search_synonyms(search_term, matches_term);

-- Enable RLS
ALTER TABLE search_synonyms ENABLE ROW LEVEL SECURITY;

-- Allow read access (synonyms are public knowledge)
CREATE POLICY "Allow public read" ON search_synonyms
  FOR SELECT USING (true);

-- Only service role can insert/update
CREATE POLICY "Allow service role write" ON search_synonyms
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- INITIAL SYNONYM DATA
-- ============================================

-- LOCATION SYNONYMS
-- Japanese
INSERT INTO search_synonyms (search_term, matches_term, category, weight) VALUES
  ('japanese', 'tokyo', 'location', 1.0),
  ('japanese', 'japan', 'location', 1.0),
  ('japanese', 'osaka', 'location', 0.8),
  ('japanese', 'kyoto', 'location', 0.8),
  ('japanese', '日本', 'location', 1.0),
  ('japanese', '東京', 'location', 1.0),
  ('japan', 'tokyo', 'location', 1.0),
  ('japan', 'japanese', 'location', 1.0),
  ('tokyo', 'japanese', 'location', 0.8),
  ('tokyo', 'japan', 'location', 0.8),

-- Australian
  ('australian', 'australia', 'location', 1.0),
  ('australian', 'sydney', 'location', 0.8),
  ('australian', 'melbourne', 'location', 0.8),
  ('australian', 'brisbane', 'location', 0.7),
  ('australia', 'australian', 'location', 1.0),
  ('aussie', 'australian', 'location', 1.0),
  ('aussie', 'australia', 'location', 1.0),

-- European
  ('european', 'europe', 'location', 1.0),
  ('british', 'uk', 'location', 1.0),
  ('british', 'london', 'location', 0.8),
  ('british', 'england', 'location', 0.9),
  ('uk', 'british', 'location', 1.0),
  ('uk', 'london', 'location', 0.8),
  ('french', 'france', 'location', 1.0),
  ('french', 'paris', 'location', 0.8),
  ('german', 'germany', 'location', 1.0),
  ('german', 'berlin', 'location', 0.8),

-- American
  ('american', 'usa', 'location', 1.0),
  ('american', 'us', 'location', 1.0),
  ('american', 'united states', 'location', 1.0),

-- Latin American
  ('latin', 'latino', 'location', 1.0),
  ('latin', 'spanish', 'location', 0.7),
  ('brazilian', 'brazil', 'location', 1.0),
  ('mexican', 'mexico', 'location', 1.0);

-- GENRE SYNONYMS
INSERT INTO search_synonyms (search_term, matches_term, category, weight) VALUES
  ('electronic', 'edm', 'genre', 0.9),
  ('electronic', 'synth', 'genre', 0.8),
  ('electronic', 'techno', 'genre', 0.7),
  ('electronic', 'house', 'genre', 0.7),
  ('electronic', 'electro', 'genre', 0.9),
  ('techno', 'electronic', 'genre', 0.7),
  ('house', 'electronic', 'genre', 0.7),
  ('edm', 'electronic', 'genre', 0.9),

  ('hiphop', 'hip-hop', 'genre', 1.0),
  ('hiphop', 'hip hop', 'genre', 1.0),
  ('hiphop', 'rap', 'genre', 0.8),
  ('hip-hop', 'hiphop', 'genre', 1.0),
  ('hip-hop', 'rap', 'genre', 0.8),
  ('rap', 'hiphop', 'genre', 0.8),

  ('lofi', 'lo-fi', 'genre', 1.0),
  ('lofi', 'lo fi', 'genre', 1.0),
  ('lo-fi', 'lofi', 'genre', 1.0),
  ('lofi', 'chill', 'genre', 0.6),

  ('ambient', 'atmospheric', 'genre', 0.8),
  ('ambient', 'soundscape', 'genre', 0.7),

  ('jazz', 'jazzy', 'genre', 0.9),
  ('funk', 'funky', 'genre', 0.9),
  ('soul', 'soulful', 'genre', 0.9),

  ('rock', 'guitar', 'genre', 0.5),
  ('metal', 'heavy', 'genre', 0.6),

  ('classical', 'orchestral', 'genre', 0.8),
  ('classical', 'piano', 'genre', 0.5),

  ('reggae', 'dub', 'genre', 0.7),
  ('dancehall', 'reggae', 'genre', 0.6);

-- MOOD SYNONYMS
INSERT INTO search_synonyms (search_term, matches_term, category, weight) VALUES
  ('chill', 'relaxed', 'mood', 0.9),
  ('chill', 'calm', 'mood', 0.8),
  ('chill', 'mellow', 'mood', 0.9),
  ('chill', 'laid back', 'mood', 0.8),
  ('chill', 'smooth', 'mood', 0.7),
  ('relaxed', 'chill', 'mood', 0.9),
  ('calm', 'chill', 'mood', 0.8),

  ('energetic', 'upbeat', 'mood', 0.9),
  ('energetic', 'high energy', 'mood', 1.0),
  ('energetic', 'driving', 'mood', 0.8),
  ('energetic', 'pumping', 'mood', 0.8),
  ('upbeat', 'energetic', 'mood', 0.9),
  ('hype', 'energetic', 'mood', 0.8),

  ('dark', 'moody', 'mood', 0.8),
  ('dark', 'brooding', 'mood', 0.7),
  ('moody', 'dark', 'mood', 0.8),

  ('happy', 'uplifting', 'mood', 0.8),
  ('happy', 'joyful', 'mood', 0.9),
  ('uplifting', 'happy', 'mood', 0.8),

  ('sad', 'melancholy', 'mood', 0.8),
  ('sad', 'emotional', 'mood', 0.7),

  ('dreamy', 'ethereal', 'mood', 0.8),
  ('dreamy', 'floating', 'mood', 0.7),

  ('intense', 'powerful', 'mood', 0.8),
  ('intense', 'aggressive', 'mood', 0.7),
  ('aggressive', 'intense', 'mood', 0.7),

  ('groovy', 'groove', 'mood', 1.0),
  ('groovy', 'funky', 'mood', 0.7);

-- LANGUAGE/SCRIPT SYNONYMS (for non-Latin character searches)
INSERT INTO search_synonyms (search_term, matches_term, category, weight) VALUES
  ('日本', 'japanese', 'language', 1.0),
  ('日本', 'japan', 'language', 1.0),
  ('東京', 'tokyo', 'language', 1.0),
  ('ラジオ', 'radio', 'language', 1.0),
  ('音楽', 'music', 'language', 0.8);

COMMENT ON TABLE search_synonyms IS 'Maps search terms to related terms for smarter agent matching';
