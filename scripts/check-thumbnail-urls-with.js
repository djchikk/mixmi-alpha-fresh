const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('ip_tracks')
    .select('id, title, cover_image_url, thumb_64_url')
    .not('thumb_64_url', 'is', null)
    .limit(10);

  console.log('=== Cover image URLs for tracks WITH thumbnails ===');
  data?.forEach(t => {
    const url = t.cover_image_url || '';
    let bucket = 'OTHER';
    if (url.includes('user-content')) bucket = 'user-content';
    else if (url.includes('track-covers')) bucket = 'track-covers';
    console.log('  [' + bucket + '] ' + t.title);
    console.log('    cover: ' + url.substring(0, 100));
    console.log('    thumb: ' + (t.thumb_64_url || '').substring(0, 100));
  });
}

check();
