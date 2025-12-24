const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTrackIds() {
  console.log('🔍 Checking track IDs...\n');

  // Get a few tracks of each type
  const { data, error } = await supabase
    .from('ip_tracks')
    .select('id, title, content_type')
    .limit(5);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📊 Sample tracks:');
  data.forEach(track => {
    console.log(`${track.content_type}: ${track.title}`);
    console.log(`  ID: ${track.id}\n`);
  });
}

checkTrackIds();
