-- Add username field to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Create index for fast username lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_username
ON user_profiles(LOWER(username));

-- Add check constraint for username format
ALTER TABLE user_profiles
ADD CONSTRAINT username_format CHECK (
  username IS NULL OR (
    LENGTH(username) >= 3 AND
    LENGTH(username) <= 30 AND
    username ~ '^[a-zA-Z0-9][a-zA-Z0-9_]*$'
  )
);

-- Create function to validate username (case-insensitive)
CREATE OR REPLACE FUNCTION validate_username()
RETURNS TRIGGER AS $$
BEGIN
  -- Convert username to lowercase for uniqueness check
  IF NEW.username IS NOT NULL THEN
    -- Check if username already exists (case-insensitive)
    IF EXISTS (
      SELECT 1 FROM user_profiles
      WHERE LOWER(username) = LOWER(NEW.username)
      AND wallet_address != NEW.wallet_address
    ) THEN
      RAISE EXCEPTION 'Username already exists';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for username validation
DROP TRIGGER IF EXISTS validate_username_trigger ON user_profiles;
CREATE TRIGGER validate_username_trigger
BEFORE INSERT OR UPDATE OF username ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION validate_username();

-- Create function to lookup profile by username or wallet
CREATE OR REPLACE FUNCTION get_profile_by_identifier(p_identifier TEXT)
RETURNS TABLE (
  wallet_address TEXT,
  username TEXT,
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
  -- Check if identifier looks like a wallet address
  IF p_identifier ~ '^(SP|ST|SN|SM)[A-Z0-9]+$' THEN
    -- Lookup by wallet address
    RETURN QUERY
    SELECT
      p.wallet_address,
      p.username,
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

-- Create API function to check username availability
CREATE OR REPLACE FUNCTION check_username_availability(p_username TEXT, p_current_wallet TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Check format first
  IF LENGTH(p_username) < 3 THEN
    RETURN json_build_object(
      'available', false,
      'error', 'Username must be at least 3 characters'
    );
  END IF;

  IF LENGTH(p_username) > 30 THEN
    RETURN json_build_object(
      'available', false,
      'error', 'Username must be 30 characters or less'
    );
  END IF;

  IF NOT (p_username ~ '^[a-zA-Z0-9][a-zA-Z0-9_]*$') THEN
    RETURN json_build_object(
      'available', false,
      'error', 'Username can only contain letters, numbers, and underscores (cannot start with underscore)'
    );
  END IF;

  -- Check if username is taken (excluding current user)
  IF EXISTS (
    SELECT 1 FROM user_profiles
    WHERE LOWER(username) = LOWER(p_username)
    AND (p_current_wallet IS NULL OR wallet_address != p_current_wallet)
  ) THEN
    RETURN json_build_object(
      'available', false,
      'error', 'Username is already taken'
    );
  END IF;

  -- Username is available
  RETURN json_build_object(
    'available', true,
    'message', 'Username is available!'
  );
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_profile_by_identifier TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_username_availability TO anon, authenticated;