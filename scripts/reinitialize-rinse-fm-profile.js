const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function reinitialize() {
  const walletAddress = 'SPKQMCRPHYAA50JXGR0QECY7AV09ZABGBAFASYHC';
  console.log('🔧 Reinitializing profile for:', walletAddress, '\n');

  // Step 1: Delete existing user_profiles record
  console.log('1️⃣  Deleting existing profile...');
  const { error: deleteError } = await supabase
    .from('user_profiles')
    .delete()
    .eq('wallet_address', walletAddress);

  if (deleteError) {
    console.error('❌ Delete error:', deleteError);
    return;
  }
  console.log('✅ Existing profile deleted');

  // Step 2: Call the proper initialization function
  console.log('\n2️⃣  Initializing profile with sections...');
  const { error: initError } = await supabase.rpc('initialize_user_profile', {
    p_wallet_address: walletAddress
  });

  if (initError) {
    console.error('❌ Init error:', initError);
    return;
  }
  console.log('✅ Profile initialized with default sections');
  
  // Step 3: Update with custom data
  console.log('\n3️⃣  Updating with custom data...');
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      username: 'radiotestpack',
      display_name: 'Radio Pack Test',
      bio: 'Test account for radio station packs'
    })
    .eq('wallet_address', walletAddress);

  if (updateError) {
    console.error('❌ Update error:', updateError);
  } else {
    console.log('✅ Profile updated with custom data');
  }

  // Step 4: Verify sections were created
  console.log('\n4️⃣  Verifying sections...');
  const { data: sections, error: sectionsError } = await supabase
    .from('user_profile_sections')
    .select('*')
    .eq('wallet_address', walletAddress);

  if (sectionsError) {
    console.error('❌ Sections error:', sectionsError);
  } else {
    console.log('✅ Found', sections.length, 'sections:');
    sections.forEach(s => console.log('  -', s.section_type));
  }
}

reinitialize();
