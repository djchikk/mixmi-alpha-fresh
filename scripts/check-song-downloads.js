const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRecentSongs() {
  const { data: songs, error } = await supabase
    .from('ip_tracks')
    .select('id, title, content_type, allow_downloads, download_price_stx, price_stx, created_at')
    .eq('content_type', 'full_song')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== RECENT SONGS ===\n');
  songs.forEach(song => {
    console.log(`Title: ${song.title}`);
    console.log(`  allow_downloads: ${song.allow_downloads}`);
    console.log(`  download_price_stx: ${song.download_price_stx}`);
    console.log(`  price_stx: ${song.price_stx}`);
    console.log(`  created_at: ${song.created_at}`);
    console.log('');
  });
}

checkRecentSongs();
