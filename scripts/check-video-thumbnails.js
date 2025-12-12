const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Count video clips WITH thumbnails
  const { count: withThumbs } = await supabase
    .from('ip_tracks')
    .select('*', { count: 'exact', head: true })
    .eq('content_type', 'video_clip')
    .not('thumb_64_url', 'is', null);

  // Count video clips WITHOUT thumbnails but WITH cover images
  const { count: withoutThumbs } = await supabase
    .from('ip_tracks')
    .select('*', { count: 'exact', head: true })
    .eq('content_type', 'video_clip')
    .is('thumb_64_url', null)
    .not('cover_image_url', 'is', null);

  // Count video clips with no cover image at all
  const { count: noCover } = await supabase
    .from('ip_tracks')
    .select('*', { count: 'exact', head: true })
    .eq('content_type', 'video_clip')
    .is('cover_image_url', null);

  console.log('=== Video Clip Thumbnail Status ===');
  console.log('Video clips WITH thumbnails:', withThumbs);
  console.log('Video clips WITHOUT thumbnails (but have cover):', withoutThumbs);
  console.log('Video clips with NO cover image:', noCover);
  console.log('');

  // Get sample of video clips missing thumbnails
  const { data: missing } = await supabase
    .from('ip_tracks')
    .select('id, title, cover_image_url')
    .eq('content_type', 'video_clip')
    .is('thumb_64_url', null)
    .not('cover_image_url', 'is', null)
    .limit(5);

  if (missing && missing.length > 0) {
    console.log('=== Sample video clips missing thumbnails ===');
    missing.forEach(t => {
      console.log(`  ${t.title}`);
      console.log(`    cover: ${(t.cover_image_url || '').substring(0, 80)}...`);
    });
  }
}

check();
