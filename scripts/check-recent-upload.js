const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findRecentUpload() {
  // Search for the track by description keywords
  const { data, error } = await supabase
    .from('ip_tracks')
    .select('*')
    .or('description.ilike.%prayer%,description.ilike.%presence%,description.ilike.%God%')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    // Try broader search - recent uploads
    console.log('No match on description, showing recent uploads...\n');
    const { data: recent, error: err2 } = await supabase
      .from('ip_tracks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recent) {
      console.log('=== 10 MOST RECENT UPLOADS ===\n');
      recent.forEach((t, i) => {
        console.log(`${i+1}. ${t.title}`);
        console.log(`   Content Type: ${t.content_type}`);
        console.log(`   Description: ${(t.description || 'none').substring(0, 80)}...`);
        console.log(`   Created: ${t.created_at}`);
        console.log('');
      });
    }
    return;
  }

  console.log('\n=== FOUND MATCHING TRACK(S) ===\n');
  data.forEach((t, i) => {
    console.log(`--- Track ${i+1} ---`);
    console.log('Title:', t.title);
    console.log('Artist:', t.artist_name);
    console.log('Content Type:', t.content_type);
    console.log('Description:', t.description);
    console.log('\n--- REMIX PROTECTION ---');
    console.log('remix_protected:', t.remix_protected);
    console.log('\n--- PRICING ---');
    console.log('download_price_stx:', t.download_price_stx);
    console.log('allow_downloads:', t.allow_downloads);
    console.log('\n--- LOCATION ---');
    console.log('location_country:', t.location_country);
    console.log('location_region:', t.location_region);
    console.log('location_lat:', t.location_lat);
    console.log('location_lng:', t.location_lng);
    console.log('\n--- TAGS ---');
    console.log('tags:', t.tags);
    console.log('\n--- AUDIO ---');
    console.log('bpm:', t.bpm);
    console.log('audio_url:', t.audio_url ? 'SET' : 'NOT SET');
    console.log('\n--- TIMESTAMPS ---');
    console.log('created_at:', t.created_at);
    console.log('\n=============================\n');
  });
}

findRecentUpload();
