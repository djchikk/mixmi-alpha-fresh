const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('🔍 CHECKING DATABASE SCHEMA\n');
  
  // Get one track and see all its fields
  const { data: sampleTrack, error } = await supabase
    .from('ip_tracks')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (sampleTrack && sampleTrack.length > 0) {
    console.log('📋 AVAILABLE FIELDS:');
    Object.keys(sampleTrack[0]).forEach(field => {
      console.log(`  • ${field}`);
    });
    
    console.log('\n🎯 COLLABORATION FIELDS:');
    Object.keys(sampleTrack[0]).forEach(field => {
      if (field.includes('split') || field.includes('wallet') || field.includes('composition') || field.includes('production')) {
        console.log(`  🤝 ${field}: ${sampleTrack[0][field]}`);
      }
    });
    
    console.log('\n⚖️ LICENSING FIELDS:');
    Object.keys(sampleTrack[0]).forEach(field => {
      if (field.includes('license') || field.includes('remix') || field.includes('collaboration') || field.includes('commercial')) {
        console.log(`  📜 ${field}: ${sampleTrack[0][field]}`);
      }
    });
    
    console.log('\n🎵 SAMPLE TRACK DATA:');
    console.log('Title:', sampleTrack[0].title);
    console.log('Artist:', sampleTrack[0].artist);
    console.log('Primary Uploader:', sampleTrack[0].primary_uploader_wallet);
  }
}

checkSchema().catch(console.error); 