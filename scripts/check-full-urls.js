const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('ip_tracks')
    .select('id, title, cover_image_url, thumb_64_url, thumb_160_url, thumb_256_url')
    .not('thumb_64_url', 'is', null)
    .limit(3);

  console.log('=== FULL URLs for tracks WITH thumbnails ===\n');
  data?.forEach(t => {
    console.log('Track: ' + t.title);
    console.log('  cover_image_url: ' + t.cover_image_url);
    console.log('  thumb_64_url:    ' + t.thumb_64_url);
    console.log('  thumb_160_url:   ' + t.thumb_160_url);
    console.log('  thumb_256_url:   ' + t.thumb_256_url);
    console.log('');
  });
}

check();
