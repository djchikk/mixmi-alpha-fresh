/**
 * Check if pending_collaborators table exists and create if needed
 * Run with: node scripts/check-pending-collaborators-table.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAndCreateTable() {
  console.log('Checking for pending_collaborators table...\n');

  // Try to query the table
  const { data, error } = await supabase
    .from('pending_collaborators')
    .select('id')
    .limit(1);

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') {
      console.log('❌ Table does not exist. You need to create it.\n');
      console.log('Run this SQL in your Supabase SQL Editor:\n');
      console.log('=' .repeat(60));
      console.log(CREATE_TABLE_SQL);
      console.log('=' .repeat(60));
      return false;
    } else {
      console.error('Error checking table:', error);
      return false;
    }
  }

  console.log('✅ pending_collaborators table exists!');
  console.log(`   Found ${data?.length || 0} records (limited to 1)\n`);
  return true;
}

const CREATE_TABLE_SQL = `
-- Create pending_collaborators table for collaborators without wallets
CREATE TABLE IF NOT EXISTS pending_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Link to track
  track_id UUID NOT NULL REFERENCES ip_tracks(id) ON DELETE CASCADE,

  -- Collaborator info
  collaborator_name TEXT NOT NULL,
  collaborator_email TEXT,

  -- Split details
  split_percentage DECIMAL(5,2) NOT NULL CHECK (split_percentage > 0 AND split_percentage <= 100),
  split_type TEXT NOT NULL CHECK (split_type IN ('composition', 'production')),
  split_position INTEGER NOT NULL DEFAULT 1 CHECK (split_position BETWEEN 1 AND 3),

  -- Resolution status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'claimed', 'rejected', 'expired')),
  resolved_wallet TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,

  -- Notification tracking
  invite_code TEXT UNIQUE,
  invite_sent_at TIMESTAMP WITH TIME ZONE,
  invite_expires_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pending_collaborators_track_id ON pending_collaborators(track_id);
CREATE INDEX IF NOT EXISTS idx_pending_collaborators_status ON pending_collaborators(status);

-- Enable RLS but allow service role full access
ALTER TABLE pending_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on pending_collaborators"
  ON pending_collaborators
  FOR ALL
  USING (true)
  WITH CHECK (true);
`;

checkAndCreateTable()
  .then(exists => {
    process.exit(exists ? 0 : 1);
  })
  .catch(err => {
    console.error('Script error:', err);
    process.exit(1);
  });
