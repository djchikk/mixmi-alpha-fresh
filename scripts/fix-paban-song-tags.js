const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixPabanSongTags() {
  // Find Paban's Song
  const { data: tracks, error: findError } = await supabase
    .from('ip_tracks')
    .select('id, title, tags')
    .ilike('title', '%Paban%')
    .limit(5);

  if (findError) {
    console.error('Error finding track:', findError);
    return;
  }

  if (!tracks || tracks.length === 0) {
    console.log('No tracks found with "Paban" in title');
    return;
  }

  console.log('\n=== FOUND TRACKS ===\n');
  tracks.forEach(t => {
    console.log(`ID: ${t.id}`);
    console.log(`Title: ${t.title}`);
    console.log(`Current tags:`, t.tags);
    console.log('');
  });

  // Fix each track
  for (const track of tracks) {
    if (!track.tags || !Array.isArray(track.tags)) continue;

    // Keep only non-location tags and one correct location tag
    const nonLocationTags = track.tags.filter(tag => !tag.startsWith('🌍'));

    // Only keep the India location (remove Louisiana)
    const correctLocation = '🌍 Murshidabad Jiaganj, West Bengal, India';

    const newTags = [...nonLocationTags, correctLocation];

    console.log(`Updating ${track.title}...`);
    console.log('  Old tags:', track.tags);
    console.log('  New tags:', newTags);

    const { error: updateError } = await supabase
      .from('ip_tracks')
      .update({ tags: newTags })
      .eq('id', track.id);

    if (updateError) {
      console.error('  Error:', updateError);
    } else {
      console.log('  ✅ Updated successfully!');
    }
    console.log('');
  }
}

fixPabanSongTags();
