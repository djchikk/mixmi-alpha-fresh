-- =====================================================
-- Mixmi Profile: Minimal Storage Setup (MVP)
-- =====================================================
-- This version just gets storage working without complex auth
-- =====================================================

-- 1. Create the storage bucket (safe if exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-content', 'user-content', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create profiles table (for future use)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address text UNIQUE,
  display_name text,
  bio text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create simple profile policies (allow all for MVP)
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can update profiles" ON public.profiles;

CREATE POLICY "Public profiles are viewable"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update profiles"
ON public.profiles FOR UPDATE
USING (true);

-- 5. Create simple updated_at trigger
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
  'Minimal Setup Complete!' as status,
  'Storage bucket created, ready for file uploads' as note,
  'Wallet authentication can be added later' as next_step; 