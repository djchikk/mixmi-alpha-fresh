-- Fix the BNS lookup function to support both .btc and .id names
DROP FUNCTION IF EXISTS get_profile_by_identifier(text);

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
  -- Check if identifier is a BNS name (ends with .btc or .id)
  IF p_identifier ILIKE '%.btc' OR p_identifier ILIKE '%.id' THEN
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