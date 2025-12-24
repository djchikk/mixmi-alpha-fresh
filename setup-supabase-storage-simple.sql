-- =====================================================
-- Mixmi Profile: Simple Storage Setup (No Extension Required)
-- =====================================================
-- This version works without requiring storage extension installation
-- =====================================================

-- 1. Create helper functions for wallet authentication
CREATE OR REPLACE FUNCTION get_wallet_from_path(path text)
RETURNS text AS $$
BEGIN
  -- Extract the first part of the path (wallet address)
  RETURN split_part(path, '/', 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_wallet_from_jwt()
RETURNS text AS $$
BEGIN
  -- Extract wallet_address from custom JWT token
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->>'wallet_address',
    current_setting('request.jwt.claims', true)::json->>'sub'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the storage bucket (safe if exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-content', 'user-content', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address text UNIQUE NOT NULL,
  display_name text,
  bio text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Create profiles policies
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
DROP POLICY IF EXISTS "Wallet owners can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Wallet owners can insert own profile" ON public.profiles;

CREATE POLICY "Public profiles are viewable"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Wallet owners can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (wallet_address = get_wallet_from_jwt());

CREATE POLICY "Wallet owners can update own profile"
ON public.profiles FOR UPDATE
USING (wallet_address = get_wallet_from_jwt())
WITH CHECK (wallet_address = get_wallet_from_jwt());

-- 6. Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- Success Message
-- =====================================================

SELECT 
  'Basic Setup Complete!' as status,
  'Storage policies will be managed through Supabase dashboard' as note,
  'Your app can now proceed with file uploads' as next_step; 