const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCurrentSchema() {
  console.log('🔍 CHECKING CURRENT DATABASE SCHEMA AFTER MIGRATION\n');
  
  // Get one track and see all its fields
  const { data: tracks, error } = await supabase
    .from('ip_tracks')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (tracks && tracks.length > 0) {
    const track = tracks[0];
    console.log('📋 ALL CURRENT FIELDS:');
    Object.keys(track).forEach(field => {
      console.log(`  • ${field}`);
    });
    
    console.log('\n🎯 COLLABORATION FIELDS STATUS:');
    const collaborationFields = [
      'composition_split_1_wallet',
      'composition_split_1_percentage', 
      'composition_split_2_wallet',
      'composition_split_2_percentage',
      'production_split_1_wallet',
      'production_split_1_percentage',
      'production_split_2_wallet',
      'production_split_2_percentage'
    ];
    
    collaborationFields.forEach(field => {
      const exists = field in track;
      console.log(`  ${exists ? '✅' : '❌'} ${field}: ${exists ? track[field] : 'NOT FOUND'}`);
    });
    
    console.log('\n⚖️ LICENSING FIELDS STATUS:');
    const licensingFields = [
      'allow_remixing',
      'open_to_collaboration',
      'license_type'
    ];
    
    licensingFields.forEach(field => {
      const exists = field in track;
      console.log(`  ${exists ? '✅' : '❌'} ${field}: ${exists ? track[field] : 'NOT FOUND'}`);
    });
    
    console.log('\n🗂️ OLD FIELDS STILL PRESENT:');
    const oldFields = [
      'composition_address1',
      'composition_shares1',
      'production_address1', 
      'production_shares1',
      'agree_permissions',
      'agree_collab'
    ];
    
    oldFields.forEach(field => {
      const exists = field in track;
      console.log(`  ${exists ? '⚠️' : '✅'} ${field}: ${exists ? 'STILL EXISTS' : 'REMOVED'}`);
    });
    
    console.log('\n🎵 SAMPLE TRACK:');
    console.log('Title:', track.title);
    console.log('Artist:', track.artist);
  }
}

checkCurrentSchema().catch(console.error); 