-- Migration: Add avatar_effect to get_profile_by_identifier function
-- Required for profile avatar effects feature

DROP FUNCTION IF EXISTS get_profile_by_identifier(text);

CREATE OR REPLACE FUNCTION get_profile_by_identifier(p_identifier TEXT)
RETURNS TABLE (
  wallet_address TEXT,
  account_id UUID,
  username TEXT,
  bns_name TEXT,
  display_name TEXT,
  tagline TEXT,
  bio TEXT,
  avatar_url TEXT,
  avatar_thumb_48_url TEXT,
  avatar_thumb_96_url TEXT,
  avatar_effect JSONB,  -- NEW: Avatar effect settings
  sticker_id TEXT,
  sticker_visible BOOLEAN,
  custom_sticker TEXT,
  show_wallet_address BOOLEAN,
  show_btc_address BOOLEAN,
  show_sui_address BOOLEAN,
  sui_address TEXT,
  store_label TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.wallet_address,
    up.account_id,
    up.username,
    up.bns_name,
    up.display_name,
    up.tagline,
    up.bio,
    up.avatar_url,
    up.avatar_thumb_48_url,
    up.avatar_thumb_96_url,
    up.avatar_effect,  -- NEW
    up.sticker_id,
    up.sticker_visible,
    up.custom_sticker,
    up.show_wallet_address,
    up.show_btc_address,
    up.show_sui_address,
    up.sui_address,
    up.store_label,
    up.created_at,
    up.updated_at
  FROM user_profiles up
  WHERE
    up.username = p_identifier
    OR up.wallet_address = p_identifier
    OR up.sui_address = p_identifier
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
