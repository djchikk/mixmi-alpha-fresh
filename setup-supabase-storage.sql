-- =====================================================
-- Mixmi Profile: Secure Storage Setup with Wallet Auth
-- =====================================================
-- This script sets up Supabase storage with proper RLS policies
-- that work with Stacks wallet authentication via custom JWT tokens
-- 
-- Run this script in your Supabase SQL Editor
-- =====================================================

-- 1. Create the storage bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-content', 'user-content', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Helper function to extract wallet address from file path
-- File paths will be: {wallet_address}/gifs/{filename}
CREATE OR REPLACE FUNCTION get_wallet_from_path(path text)
RETURNS text AS $$
BEGIN
  -- Extract the first part of the path (wallet address)
  RETURN split_part(path, '/', 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Helper function to get wallet address from JWT claims
CREATE OR REPLACE FUNCTION get_wallet_from_jwt()
RETURNS text AS $$
BEGIN
  -- Extract wallet_address from custom JWT token
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->>'wallet_address',
    current_setting('request.jwt.claims', true)::json->>'sub'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Drop existing policies (if any)
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous uploads" ON storage.objects;
DROP POLICY IF EXISTS "Wallet owners can upload" ON storage.objects;
DROP POLICY IF EXISTS "Wallet owners can update" ON storage.objects;
DROP POLICY IF EXISTS "Wallet owners can delete" ON storage.objects;

-- 5. Enable RLS on storage.objects (should already be enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 6. Public read access for all files in user-content bucket
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-content');

-- 7. Wallet owners can upload to their own folder
-- Files must be uploaded to: {wallet_address}/gifs/ or {wallet_address}/images/
CREATE POLICY "Wallet owners can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-content' 
  AND get_wallet_from_path(name) = get_wallet_from_jwt()
  AND (
    name LIKE '%/gifs/%' 
    OR name LIKE '%/images/%'
  )
);

-- 8. Wallet owners can update their own files
CREATE POLICY "Wallet owners can update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-content' 
  AND get_wallet_from_path(name) = get_wallet_from_jwt()
)
WITH CHECK (
  bucket_id = 'user-content' 
  AND get_wallet_from_path(name) = get_wallet_from_jwt()
);

-- 9. Wallet owners can delete their own files
CREATE POLICY "Wallet owners can delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-content' 
  AND get_wallet_from_path(name) = get_wallet_from_jwt()
);

-- 10. Create profiles table to store wallet metadata (optional)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address text UNIQUE NOT NULL,
  display_name text,
  bio text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. RLS policies for profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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

-- 12. Set up updated_at trigger for profiles
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
-- Setup Complete!
-- =====================================================
-- 
-- Your storage is now configured with:
-- ✅ Secure wallet-based authentication
-- ✅ Folder isolation per wallet address  
-- ✅ Public read access for all content
-- ✅ Proper RLS policies
-- 
-- Next steps:
-- 1. Update your app to use SupabaseAuthBridge
-- 2. Test file uploads with wallet authentication
-- 3. Monitor the logs for any auth issues
-- 
-- File structure will be:
-- user-content/
--   ├── {wallet1}/gifs/file1.gif
--   ├── {wallet1}/images/avatar.jpg
--   ├── {wallet2}/gifs/file2.gif
--   └── {wallet2}/images/banner.png
-- ===================================================== 