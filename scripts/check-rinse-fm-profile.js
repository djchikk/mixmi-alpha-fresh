const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProfile() {
  const walletAddress = 'SPKQMCRPHYAA50JXGR0QECY7AV09ZABGBAFASYHC';
  console.log('🔍 Checking profile for:', walletAddress, '\n');

  // Check user_profiles
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();

  if (profileError) {
    console.error('❌ Profile error:', profileError);
  } else {
    console.log('✅ User profile:');
    console.log(JSON.stringify(profile, null, 2));
  }

  console.log('\n');

  // Check alpha_users
  const { data: alphaUser, error: alphaError } = await supabase
    .from('alpha_users')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();

  if (alphaError) {
    console.error('❌ Alpha user error:', alphaError);
  } else {
    console.log('✅ Alpha user:');
    console.log(JSON.stringify(alphaUser, null, 2));
  }
}

checkProfile();
