const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRinseFM() {
  console.log('🔍 Checking Rinse FM radio station...\n');

  const { data, error } = await supabase
    .from('ip_tracks')
    .select('id, title, artist, content_type, stream_url, audio_url')
    .eq('title', 'Rinse FM test')
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📻 Rinse FM data:');
  console.log(JSON.stringify(data, null, 2));
}

checkRinseFM();
