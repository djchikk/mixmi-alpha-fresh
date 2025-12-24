-- User Profiles System
-- Simplified to use wallet_address as primary key instead of Supabase Auth

-- Main profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  wallet_address TEXT PRIMARY KEY,
  display_name TEXT,
  tagline TEXT,
  bio TEXT,
  avatar_url TEXT,
  sticker_id TEXT DEFAULT 'daisy-blue',
  sticker_visible BOOLEAN DEFAULT true,
  show_wallet_address BOOLEAN DEFAULT true,
  show_btc_address BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social links table
CREATE TABLE IF NOT EXISTS user_profile_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT REFERENCES user_profiles(wallet_address) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profile sections (spotlight, media, shop, gallery)
CREATE TABLE IF NOT EXISTS user_profile_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT REFERENCES user_profiles(wallet_address) ON DELETE CASCADE,
  section_type TEXT NOT NULL, -- 'spotlight', 'media', 'shop', 'gallery'
  title TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  config JSONB DEFAULT '[]'::jsonb, -- Stores section items as JSON
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_address, section_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profile_links_wallet ON user_profile_links(wallet_address);
CREATE INDEX IF NOT EXISTS idx_profile_sections_wallet ON user_profile_sections(wallet_address);
CREATE INDEX IF NOT EXISTS idx_profile_sections_type ON user_profile_sections(section_type);

-- RLS Policies (Row Level Security)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile_sections ENABLE ROW LEVEL SECURITY;

-- Public read access for all profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON user_profiles FOR SELECT
  USING (true);

CREATE POLICY "Public profile links are viewable by everyone"
  ON user_profile_links FOR SELECT
  USING (true);

CREATE POLICY "Public profile sections are viewable by everyone"
  ON user_profile_sections FOR SELECT
  USING (true);

-- Users can insert/update/delete their own profile data
-- Note: In production, you'd want proper auth checks here
-- For now, we'll rely on application-level checks

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete their own profile"
  ON user_profiles FOR DELETE
  USING (true);

CREATE POLICY "Users can manage their own links"
  ON user_profile_links FOR ALL
  USING (true);

CREATE POLICY "Users can manage their own sections"
  ON user_profile_sections FOR ALL
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profile_sections_updated_at
  BEFORE UPDATE ON user_profile_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function to initialize profile with default sections
CREATE OR REPLACE FUNCTION initialize_user_profile(p_wallet_address TEXT)
RETURNS void AS $$
BEGIN
  -- Insert profile if it doesn't exist
  INSERT INTO user_profiles (wallet_address, display_name)
  VALUES (p_wallet_address, 'New User')
  ON CONFLICT (wallet_address) DO NOTHING;

  -- Insert default sections if they don't exist
  INSERT INTO user_profile_sections (wallet_address, section_type, title, display_order, is_visible)
  VALUES
    (p_wallet_address, 'spotlight', 'Spotlight', 1, true),
    (p_wallet_address, 'media', 'Media', 2, true),
    (p_wallet_address, 'shop', 'Shop', 3, true),
    (p_wallet_address, 'gallery', 'Gallery', 4, true)
  ON CONFLICT (wallet_address, section_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;