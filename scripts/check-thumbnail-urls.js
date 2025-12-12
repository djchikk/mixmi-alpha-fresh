const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('ip_tracks')
    .select('id, title, cover_image_url')
    .is('thumb_64_url', null)
    .not('cover_image_url', 'is', null)
    .limit(10);

  console.log('=== Cover image URLs for tracks WITHOUT thumbnails ===');
  data?.forEach(t => {
    const url = t.cover_image_url || '';
    let bucket = 'OTHER';
    if (url.includes('user-content')) bucket = 'user-content';
    else if (url.includes('track-covers')) bucket = 'track-covers';
    else if (url.startsWith('http') && url.indexOf('supabase') === -1) bucket = 'EXTERNAL';
    console.log('  [' + bucket + '] ' + t.title);
    console.log('    ' + url.substring(0, 120));
  });
}

check();
