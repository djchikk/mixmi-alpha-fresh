-- Create alpha_users table for whitelisted wallet addresses
-- This replaces complex user authentication with simple whitelist checking

DROP TABLE IF EXISTS public.alpha_users CASCADE;

CREATE TABLE public.alpha_users (
    wallet_address text PRIMARY KEY,
    artist_name text NOT NULL,
    email text NULL,
    notes text NULL,
    approved boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alpha_users_approved 
ON public.alpha_users USING btree (approved) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_alpha_users_created_at 
ON public.alpha_users USING btree (created_at DESC) TABLESPACE pg_default;

-- Insert development/testing wallet
INSERT INTO public.alpha_users (wallet_address, artist_name, notes) VALUES 
('SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7', 'Dev/Test Wallet', 'Development and testing wallet address');

-- Example alpha users (you can add real ones manually in Supabase)
-- INSERT INTO public.alpha_users (wallet_address, artist_name, email, notes) VALUES 
-- ('SP3ABC123EXAMPLE456DEF789GHI012JKL345MNO678', 'Alpha User 1', 'user1@example.com', 'First alpha tester'),
-- ('SP2XYZ789EXAMPLE123ABC456DEF012GHI345JKL678', 'Alpha Producer', 'producer@example.com', 'Beat producer from Discord'),
-- ('SP1DEF456EXAMPLE789GHI012JKL345MNO678PQR901', 'Beta Musician', 'musician@example.com', 'Musician from waitlist');

-- Set up Row Level Security (optional, but good practice)
ALTER TABLE public.alpha_users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access for approved users (needed for authentication checks)
CREATE POLICY "Public read access for approved alpha users" 
ON public.alpha_users FOR SELECT 
USING (approved = true);

-- RLS Policy: Only service role can modify 
CREATE POLICY "Service role can manage alpha users" 
ON public.alpha_users FOR ALL 
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.alpha_users TO anon;
GRANT SELECT ON public.alpha_users TO authenticated;
GRANT ALL ON public.alpha_users TO service_role;

-- Add comment
COMMENT ON TABLE public.alpha_users IS 'Whitelisted alpha users who can upload content without individual authentication';

-- Verify the table works
SELECT wallet_address, artist_name, approved, created_at 
FROM public.alpha_users 
WHERE approved = true;