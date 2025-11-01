const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRadioParadise() {
  const { data, error } = await supabase
    .from('ip_tracks')
    .select('id, title, content_type, stream_url')
    .ilike('title', '%radio paradise%');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Radio Paradise records:');
  console.log(JSON.stringify(data, null, 2));
}

checkRadioParadise();
