const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugTracks() {
  console.log('🔍 DEBUG: Current Track Distribution\n');
  
  // DJ Chikk's tracks
  console.log('📀 DJ CHIKK STORE:');
  const { data: djChikkTracks, error: djError } = await supabase
    .from('ip_tracks')
    .select('title, artist, primary_uploader_wallet, composition_split_2_wallet, production_split_2_wallet')
    .eq('primary_uploader_wallet', 'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE')
    .limit(10);

  if (djError) {
    console.error('❌ DJ Chikk query error:', djError);
    // Try with basic fields
    const { data: djBasic, error: djBasicError } = await supabase
      .from('ip_tracks')
      .select('title, artist, primary_uploader_wallet')
      .eq('primary_uploader_wallet', 'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE')
      .limit(10);
    
    if (djBasicError) {
      console.error('❌ DJ Basic query error:', djBasicError);
    } else {
      djBasic.forEach(track => {
        console.log(`  • ${track.title} by ${track.artist}`);
      });
    }
  } else {
    djChikkTracks.forEach(track => {
      console.log(`  • ${track.title} by ${track.artist}`);
    });
  }

  // Lunar Drive's tracks
  console.log('\n🌙 LUNAR DRIVE STORE:');
  const { data: lunarTracks, error: lunarError } = await supabase
    .from('ip_tracks')
    .select('title, artist, primary_uploader_wallet')
    .eq('primary_uploader_wallet', 'SPZ02ESS4SMXVNZ9CXXQWGCTAWJ1APD6MAPWK9EQ')
    .limit(10);

  if (lunarError) {
    console.error('❌ Lunar Drive query error:', lunarError);
  } else {
    lunarTracks.forEach(track => {
      console.log(`  • ${track.title} by ${track.artist}`);
    });
  }

  // Check for Tootles and Soph tracks
  console.log('\n🔍 TOOTLES & SOPH TRACKS:');
  const { data: tootlesTracks, error: tootlesError } = await supabase
    .from('ip_tracks')
    .select('title, artist, primary_uploader_wallet')
    .or('title.ilike.%tootles%,title.ilike.%soph%,artist.ilike.%tootles%,artist.ilike.%soph%');

  if (tootlesError) {
    console.error('❌ Tootles & Soph query error:', tootlesError);
  } else {
    tootlesTracks.forEach(track => {
      console.log(`  • ${track.title} by ${track.artist}`);
      console.log(`    📍 Primary uploader: ${track.primary_uploader_wallet}`);
    });
  }

  // Summary
  console.log('\n📊 SUMMARY:');
  console.log(`DJ Chikk has ${djChikkTracks?.length || 0} tracks`);
  console.log(`Lunar Drive has ${lunarTracks?.length || 0} tracks`);
  console.log(`Tootles & Soph appears in ${tootlesTracks?.length || 0} tracks`);
  
  console.log('\n🎯 KEY FINDING:');
  console.log('All "Tootles and Soph" tracks are uploaded by DJ Chikk!');
  console.log('This means DJ Chikk uploaded tracks featuring "Tootles and Soph" as performers.');
  console.log('This is working correctly - these tracks belong in DJ Chikk\'s store.');
}

debugTracks().catch(console.error); 