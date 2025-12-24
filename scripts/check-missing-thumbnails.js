const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Count tracks WITH thumbnails
  const { count: withThumbs } = await supabase
    .from('ip_tracks')
    .select('*', { count: 'exact', head: true })
    .not('thumb_64_url', 'is', null);

  // Count tracks WITHOUT thumbnails but WITH cover images
  const { count: withoutThumbs } = await supabase
    .from('ip_tracks')
    .select('*', { count: 'exact', head: true })
    .is('thumb_64_url', null)
    .not('cover_image_url', 'is', null);

  // Count tracks with no cover image at all
  const { count: noCover } = await supabase
    .from('ip_tracks')
    .select('*', { count: 'exact', head: true })
    .is('cover_image_url', null);

  console.log('=== Thumbnail Status ===');
  console.log('Tracks WITH thumbnails:', withThumbs);
  console.log('Tracks WITHOUT thumbnails (but have cover):', withoutThumbs);
  console.log('Tracks with NO cover image:', noCover);
  console.log('');

  // Get sample of tracks missing thumbnails
  const { data: missing } = await supabase
    .from('ip_tracks')
    .select('id, title, cover_image_url, content_type')
    .is('thumb_64_url', null)
    .not('cover_image_url', 'is', null)
    .limit(15);

  console.log('=== Sample tracks missing thumbnails ===');
  missing?.forEach(t => {
    const url = t.cover_image_url || '';
    let bucket = 'OTHER';
    if (url.includes('user-content')) bucket = 'user-content';
    else if (url.includes('track-covers')) bucket = 'track-covers';
    else if (url.startsWith('http') && url.indexOf('supabase') === -1) bucket = 'EXTERNAL';
    console.log(`[${bucket}] ${t.content_type}: ${t.title}`);
    console.log(`  URL: ${url.substring(0, 120)}...`);
  });
}

check();
