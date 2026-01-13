-- Add avatar effect settings to user_profiles and personas
-- Stores effect type and parameters as JSONB for flexibility

-- Add to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS avatar_effect JSONB DEFAULT NULL;

-- Add to personas
ALTER TABLE personas
ADD COLUMN IF NOT EXISTS avatar_effect JSONB DEFAULT NULL;

-- Comment explaining the structure
COMMENT ON COLUMN user_profiles.avatar_effect IS 'Avatar effect settings: {type: "vhs"|"ascii"|"dither"|null, intensity: 0-1, granularity: 0-1, wetDry: 0-1, saturation: 0-2, ditherColor: "#RRGGBB"}';
COMMENT ON COLUMN personas.avatar_effect IS 'Avatar effect settings: {type: "vhs"|"ascii"|"dither"|null, intensity: 0-1, granularity: 0-1, wetDry: 0-1, saturation: 0-2, ditherColor: "#RRGGBB"}';
