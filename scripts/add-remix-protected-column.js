const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addRemixProtectedColumn() {
  console.log('🔒 Adding remix_protected column to ip_tracks table...\n');

  // First, check if the column already exists by trying to select it
  const { data: testData, error: testError } = await supabase
    .from('ip_tracks')
    .select('remix_protected')
    .limit(1);

  if (!testError) {
    console.log('✅ Column remix_protected already exists!');
    return;
  }

  // Column doesn't exist, need to add it via SQL
  // Since we can't run ALTER TABLE directly, we'll need to do this in Supabase dashboard
  // But we can document what needs to be done

  console.log('⚠️  The remix_protected column needs to be added via Supabase SQL Editor.');
  console.log('\nRun this SQL in the Supabase dashboard:\n');
  console.log('='.repeat(60));
  console.log(`
-- Add remix_protected column to ip_tracks
-- This protects sacred/devotional content from being mixed
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS remix_protected BOOLEAN DEFAULT FALSE;

-- Add comment explaining the field
COMMENT ON COLUMN ip_tracks.remix_protected IS
'When TRUE, this content is protected from remixing (sacred/devotional content). Still available for streaming and download.';
  `);
  console.log('='.repeat(60));
  console.log('\nAfter running the SQL, this script will verify the column exists.');
}

addRemixProtectedColumn();
