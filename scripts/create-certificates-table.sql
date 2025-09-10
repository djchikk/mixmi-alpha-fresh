-- Create certificates table for storing registration certificates
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number VARCHAR(20) UNIQUE NOT NULL, -- Format: MX-YYYY-MMDD-XXXXX
  track_id UUID REFERENCES ip_tracks(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  stacks_tx_id TEXT,
  block_height INTEGER,
  verification_hash TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create indexes for better query performance
CREATE INDEX idx_certificates_wallet ON certificates(wallet_address);
CREATE INDEX idx_certificates_track ON certificates(track_id);
CREATE INDEX idx_certificates_created ON certificates(created_at DESC);

-- Enable Row Level Security
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own certificates
CREATE POLICY "Users can view own certificates" ON certificates
  FOR SELECT
  USING (wallet_address = auth.uid()::text);

-- Create policy for system to insert certificates
CREATE POLICY "System can insert certificates" ON certificates
  FOR INSERT
  WITH CHECK (true);

-- Create storage bucket for certificates if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policy for certificates bucket
CREATE POLICY "Users can view certificate files" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'certificates');

CREATE POLICY "System can upload certificate files" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'certificates');

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_certificates_updated_at
  BEFORE UPDATE ON certificates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();