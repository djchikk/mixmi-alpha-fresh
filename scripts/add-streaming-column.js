const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addStreamingColumn() {
  console.log('Adding allow_streaming column to ip_tracks table...\n');

  // Use raw SQL to add the column
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS allow_streaming BOOLEAN DEFAULT true;`
  });

  if (error) {
    // If the RPC doesn't exist, we need to use Supabase dashboard
    if (error.message.includes('function') || error.message.includes('does not exist')) {
      console.log('⚠️  Cannot run raw SQL via Supabase client.');
      console.log('');
      console.log('Please run this SQL in the Supabase dashboard SQL Editor:');
      console.log('');
      console.log('  ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS allow_streaming BOOLEAN DEFAULT true;');
      console.log('');
      console.log('Steps:');
      console.log('1. Go to your Supabase project dashboard');
      console.log('2. Click "SQL Editor" in the left sidebar');
      console.log('3. Paste the SQL above and click "Run"');
      console.log('');
      return;
    }
    console.error('Error:', error.message);
    return;
  }

  console.log('✅ Column added successfully!\n');

  // Verify by checking a track
  const { data: sample, error: sampleErr } = await supabase
    .from('ip_tracks')
    .select('id, title, allow_streaming')
    .limit(3);

  if (sample) {
    console.log('Sample tracks with new column:');
    sample.forEach(t => {
      console.log(`  - ${t.title}: allow_streaming = ${t.allow_streaming}`);
    });
  }
}

addStreamingColumn();
