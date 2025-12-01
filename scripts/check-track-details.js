const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTrack() {
  const { data, error } = await supabase
    .from('ip_tracks')
    .select('*')
    .eq('title', 'When I Spit - V1')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📀 TRACK DETAILS: "When I Spit - V1"\n');
  console.log('='.repeat(60));

  // Group fields by category for readability
  const categories = {
    'BASIC INFO': ['id', 'title', 'version', 'artist', 'description', 'content_type', 'sample_type', 'loop_category'],
    'AUDIO': ['audio_url', 'bpm', 'key', 'duration'],
    'LOCATION (Globe)': ['primary_location', 'location_lat', 'location_lng', 'locations'],
    'COMPOSITION SPLITS': ['composition_split_1_wallet', 'composition_split_1_percentage', 'composition_split_2_wallet', 'composition_split_2_percentage', 'composition_split_3_wallet', 'composition_split_3_percentage'],
    'PRODUCTION SPLITS': ['production_split_1_wallet', 'production_split_1_percentage', 'production_split_2_wallet', 'production_split_2_percentage', 'production_split_3_wallet', 'production_split_3_percentage'],
    'LICENSING': ['license_type', 'license_selection', 'allow_remixing', 'allow_downloads', 'open_to_collaboration', 'open_to_commercial'],
    'CONTACT': ['commercial_contact', 'commercial_contact_fee', 'collab_contact', 'collab_contact_fee'],
    'PRICING': ['price_stx', 'remix_price_stx', 'download_price_stx'],
    'AI TRACKING': ['ai_assisted_idea', 'ai_assisted_implementation'],
    'METADATA': ['tags', 'notes', 'isrc', 'created_at', 'updated_at'],
    'OWNERSHIP': ['primary_uploader_wallet', 'uploader_address', 'account_name'],
    'VISIBILITY': ['is_live', 'deleted_at'],
    'COVER IMAGE': ['cover_image_url'],
  };

  for (const [category, fields] of Object.entries(categories)) {
    console.log(`\n${category}:`);
    console.log('-'.repeat(40));
    for (const field of fields) {
      const value = data[field];
      if (value !== null && value !== undefined && value !== '') {
        if (typeof value === 'object') {
          console.log(`  ${field}: ${JSON.stringify(value, null, 2)}`);
        } else if (typeof value === 'string' && value.length > 60) {
          console.log(`  ${field}: ${value.substring(0, 60)}...`);
        } else {
          console.log(`  ${field}: ${value}`);
        }
      } else {
        console.log(`  ${field}: NULL`);
      }
    }
  }

  // Highlight potential globe issues
  console.log('\n' + '='.repeat(60));
  console.log('🌍 GLOBE DISPLAY CHECK:');
  console.log('-'.repeat(40));

  const hasCoords = data.location_lat && data.location_lng;
  const hasLocation = data.primary_location;
  const isLive = data.is_live;
  const notDeleted = !data.deleted_at;

  console.log(`  ✓ Has coordinates: ${hasCoords ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  ✓ Has location name: ${hasLocation ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  ✓ is_live: ${isLive ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  ✓ Not deleted: ${notDeleted ? 'YES ✅' : 'NO ❌'}`);

  if (!hasCoords) {
    console.log('\n⚠️  ISSUE: Track has no coordinates - will NOT show on globe!');
    console.log('   The geocoding may have failed. Location text was:', data.primary_location || 'NULL');
  }
}

checkTrack();
