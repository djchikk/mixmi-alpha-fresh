-- Add BNS (Bitcoin Name Service) field to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS bns_name TEXT;

-- Create index for BNS lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_bns
ON user_profiles(LOWER(bns_name));

-- Update the get_profile_by_identifier function to handle BNS names
CREATE OR REPLACE FUNCTION get_profile_by_identifier(p_identifier TEXT)
RETURNS TABLE (
  wallet_address TEXT,
  username TEXT,
  bns_name TEXT,
  display_name TEXT,
  tagline TEXT,
  bio TEXT,
  avatar_url TEXT,
  sticker_id TEXT,
  sticker_visible BOOLEAN,
  show_wallet_address BOOLEAN,
  show_btc_address BOOLEAN
) AS $$
BEGIN
  -- Check if identifier is a BNS name (ends with .btc)
  IF p_identifier ILIKE '%.btc' THEN
    -- Lookup by BNS name (case-insensitive)
    RETURN QUERY
    SELECT
      p.wallet_address,
      p.username,
      p.bns_name,
      p.display_name,
      p.tagline,
      p.bio,
      p.avatar_url,
      p.sticker_id,
      p.sticker_visible,
      p.show_wallet_address,
      p.show_btc_address
    FROM user_profiles p
    WHERE LOWER(p.bns_name) = LOWER(p_identifier);
  -- Check if identifier looks like a wallet address
  ELSIF p_identifier ~ '^(SP|ST|SN|SM)[A-Z0-9]+$' THEN
    -- Lookup by wallet address
    RETURN QUERY
    SELECT
      p.wallet_address,
      p.username,
      p.bns_name,
      p.display_name,
      p.tagline,
      p.bio,
      p.avatar_url,
      p.sticker_id,
      p.sticker_visible,
      p.show_wallet_address,
      p.show_btc_address
    FROM user_profiles p
    WHERE p.wallet_address = p_identifier;
  ELSE
    -- Lookup by username (case-insensitive)
    RETURN QUERY
    SELECT
      p.wallet_address,
      p.username,
      p.bns_name,
      p.display_name,
      p.tagline,
      p.bio,
      p.avatar_url,
      p.sticker_id,
      p.sticker_visible,
      p.show_wallet_address,
      p.show_btc_address
    FROM user_profiles p
    WHERE LOWER(p.username) = LOWER(p_identifier);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to validate BNS name isn't already taken by another user
CREATE OR REPLACE FUNCTION validate_bns_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if BNS name already exists for a different user
  IF NEW.bns_name IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM user_profiles
      WHERE LOWER(bns_name) = LOWER(NEW.bns_name)
      AND wallet_address != NEW.wallet_address
    ) THEN
      RAISE EXCEPTION 'BNS name already registered to another user';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for BNS name validation
DROP TRIGGER IF EXISTS validate_bns_name_trigger ON user_profiles;
CREATE TRIGGER validate_bns_name_trigger
BEFORE INSERT OR UPDATE OF bns_name ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION validate_bns_name();