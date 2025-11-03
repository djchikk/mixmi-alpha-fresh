const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProfile() {
  const walletAddress = 'SP3XPBQ0D5VBRDX40RWTG2ABCN54D94W6DPHS7B8Y';
  console.log('🔍 Checking profile for Radio Paradise Test:', walletAddress, '\n');

  // Check user_profiles
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();

  if (profileError) {
    console.error('❌ No profile found');
    
    // Create one
    console.log('\n🔧 Creating profile...');
    const newProfile = {
      wallet_address: walletAddress,
      username: 'radioparadisetest',
      display_name: 'Radio Paradise Test',
      bio: 'Test account for radio stations',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('user_profiles')
      .insert([newProfile])
      .select();

    if (error) {
      console.error('❌ Error creating profile:', error);
    } else {
      console.log('✅ Profile created:', data);
    }
  } else {
    console.log('✅ Profile already exists:');
    console.log(JSON.stringify(profile, null, 2));
  }
}

checkProfile();
