const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugLocations() {
  console.log('🌍 DEBUG: Track Location Data\n');
  
  // Get all tracks with location data
  const { data: tracksWithLocation, error: locError } = await supabase
    .from('ip_tracks')
    .select('id, title, artist, location_lat, location_lng, primary_location, locations')
    .or('location_lat.not.is.null,locations.not.is.null')
    .limit(20);

  if (locError) {
    console.error('❌ Location query error:', locError);
    return;
  }

  console.log(`Found ${tracksWithLocation.length} tracks with location data:\n`);

  tracksWithLocation.forEach(track => {
    console.log(`📍 "${track.title}" by ${track.artist}`);
    console.log(`   ID: ${track.id}`);
    
    if (track.locations && Array.isArray(track.locations)) {
      console.log(`   Multiple locations (${track.locations.length}):`);
      track.locations.forEach((loc, i) => {
        console.log(`     ${i + 1}. ${loc.name} (${loc.lat}, ${loc.lng})`);
      });
    } else if (track.location_lat && track.location_lng) {
      console.log(`   Single location: ${track.primary_location || 'Unknown'}`);
      console.log(`   Coordinates: (${track.location_lat}, ${track.location_lng})`);
    }
    console.log('');
  });

  // Check specifically for London tracks
  console.log('\n🇬🇧 Checking for London tracks:');
  const { data: londonTracks, error: londonError } = await supabase
    .from('ip_tracks')
    .select('title, artist, locations, primary_location')
    .or(`primary_location.ilike.%london%,locations@>.${JSON.stringify([{name: 'London'}])}`)
    .limit(10);

  if (!londonError && londonTracks.length > 0) {
    console.log(`Found ${londonTracks.length} tracks mentioning London:`);
    londonTracks.forEach(track => {
      console.log(`  • "${track.title}" by ${track.artist}`);
    });
  } else {
    console.log('No tracks found with London location');
  }
}

debugLocations().catch(console.error);