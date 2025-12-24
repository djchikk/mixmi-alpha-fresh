const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createProfile() {
  const walletAddress = 'SPKQMCRPHYAA50JXGR0QECY7AV09ZABGBAFASYHC';
  console.log('🔧 Creating user profile for:', walletAddress, '\n');

  const profile = {
    wallet_address: walletAddress,
    username: 'radiotestpack',
    display_name: 'Radio Pack Test',
    bio: 'Test account for radio station packs',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('user_profiles')
    .insert([profile])
    .select();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Profile created:');
  console.log(JSON.stringify(data, null, 2));
}

createProfile();
