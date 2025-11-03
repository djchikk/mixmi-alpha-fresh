const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFunction() {
  console.log('\n========================================');
  console.log('TESTING initialize_user_profile FUNCTION');
  console.log('========================================\n');

  const testWallet = 'TEST_WALLET_' + Date.now();

  console.log('1️⃣  Calling initialize_user_profile...');
  console.log(`   Wallet: ${testWallet}\n`);

  const { data, error } = await supabase
    .rpc('initialize_user_profile', { p_wallet_address: testWallet });

  if (error) {
    console.log('❌ FUNCTION FAILED:');
    console.log(JSON.stringify(error, null, 2));
    console.log('\n⚠️  The function still has issues!\n');
    return;
  }

  console.log('✅ Function executed successfully!');
  console.log('   Result:', data);

  // Verify the profile was created
  console.log('\n2️⃣  Verifying profile was created...\n');

  const { data: profile, error: fetchError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('wallet_address', testWallet)
    .single();

  if (fetchError || !profile) {
    console.log('❌ Profile not found:', fetchError);
  } else {
    console.log('✅ Profile created successfully:');
    console.log('   Wallet:', profile.wallet_address);
    console.log('   Display Name:', profile.display_name);
    console.log('   Username:', profile.username);
  }

  // Check sections were created
  console.log('\n3️⃣  Checking profile sections...\n');

  const { data: sections, error: sectionsError } = await supabase
    .from('user_profile_sections')
    .select('section_type, title, display_order')
    .eq('wallet_address', testWallet)
    .order('display_order');

  if (sectionsError || !sections || sections.length === 0) {
    console.log('❌ Sections not found:', sectionsError);
  } else {
    console.log(`✅ Found ${sections.length} sections:`);
    sections.forEach(s => {
      console.log(`   ${s.display_order}. ${s.section_type} - "${s.title}"`);
    });
  }

  // Clean up test data
  console.log('\n4️⃣  Cleaning up test data...\n');

  await supabase.from('user_profile_sections').delete().eq('wallet_address', testWallet);
  await supabase.from('user_profiles').delete().eq('wallet_address', testWallet);

  console.log('✅ Test data cleaned up');

  console.log('\n========================================');
  console.log('TEST COMPLETE');
  console.log('========================================\n');

  if (!error && profile && sections && sections.length > 0) {
    console.log('🎉 SUCCESS! The initialize_user_profile function is working!\n');
  } else {
    console.log('⚠️  There may still be issues to investigate.\n');
  }
}

testFunction().catch(console.error);
