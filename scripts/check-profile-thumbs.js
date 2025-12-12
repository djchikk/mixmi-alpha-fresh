const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data } = await supabase
    .from('user_profiles')
    .select('wallet_address, avatar_url')
    .not('avatar_url', 'is', null)
    .is('avatar_thumb_48_url', null)
    .limit(10);

  console.log('=== Profiles Missing Thumbnails ===');
  data.forEach(p => {
    const wallet = p.wallet_address.substring(0, 12) + '...';
    let urlType = 'unknown';
    if (p.avatar_url.includes('.mp4') || p.avatar_url.includes('.webm')) {
      urlType = 'VIDEO (skipped)';
    } else if (p.avatar_url.includes('supabase')) {
      urlType = 'Supabase - should have thumbnail!';
    } else {
      urlType = 'External';
    }
    console.log(wallet + ' | ' + urlType);
    console.log('  ' + p.avatar_url.substring(0, 90));
  });

  // Count totals
  const { count: withThumbs } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .not('avatar_thumb_48_url', 'is', null);

  const { count: withoutThumbs } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .not('avatar_url', 'is', null)
    .is('avatar_thumb_48_url', null);

  console.log('\n=== Summary ===');
  console.log('Profiles WITH thumbnails:', withThumbs);
  console.log('Profiles WITHOUT thumbnails:', withoutThumbs);
}

check();
