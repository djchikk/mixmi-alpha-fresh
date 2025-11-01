const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function initialize() {
  const walletAddress = 'SPKQMCRPHYAA50JXGR0QECY7AV09ZABGBAFASYHC';
  console.log('🔧 Initializing profile for:', walletAddress, '\n');

  // Call the proper initialization function
  const { data, error } = await supabase.rpc('initialize_user_profile', {
    p_wallet_address: walletAddress
  });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Profile initialized successfully');
  
  // Now update with custom data
  console.log('\n📝 Updating profile with custom data...');
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
}

initialize();
