-- Migration: Add show_sui_address column to user_profiles
-- This enables users to toggle showing their SUI wallet address on their profile

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS show_sui_address BOOLEAN DEFAULT false;

COMMENT ON COLUMN user_profiles.show_sui_address IS 'Whether to display SUI wallet address on profile';
