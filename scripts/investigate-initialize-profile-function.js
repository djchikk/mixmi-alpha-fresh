const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigate() {
  console.log('\n========================================');
  console.log('DATABASE INVESTIGATION');
  console.log('========================================\n');

  // 1. Note about function definition
  console.log('1. FUNCTION DEFINITION');
  console.log('-------------------------------------------');
  console.log('NOTE: The SQL function code needs to be retrieved from Supabase Dashboard');
  console.log('Location: Dashboard → Database → Functions → initialize_user_profile');
  console.log('');

  // 2. Sample existing data to understand current structure
  console.log('\n2. SAMPLING EXISTING user_profiles DATA');
  console.log('-------------------------------------------');
  const { data: sampleProfiles, error: sampleError } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(2);

  if (sampleError) {
    console.log('Error fetching sample:', sampleError);
  } else {
    console.log('Sample profiles:', JSON.stringify(sampleProfiles, null, 2));
  }

  // 3. Sample backup data to understand structure
  console.log('\n3. SAMPLING BACKUP user_profiles_backup_2025_10_30 DATA');
  console.log('-------------------------------------------');
  const { data: backupSample, error: backupSampleError } = await supabase
    .from('user_profiles_backup_2025_10_30')
    .select('*')
    .limit(2);

  if (backupSampleError) {
    console.log('Error fetching backup sample:', backupSampleError);
  } else {
    console.log('Backup sample:', JSON.stringify(backupSample, null, 2));
  }

  // 4. Check user_profile_sections data
  console.log('\n4. SAMPLING user_profile_sections DATA');
  console.log('-------------------------------------------');
  const { data: sectionsSample, error: sectionsSampleError } = await supabase
    .from('user_profile_sections')
    .select('*')
    .limit(5);

  if (sectionsSampleError) {
    console.log('Error:', sectionsSampleError);
  } else {
    console.log('Sections sample:', JSON.stringify(sectionsSample, null, 2));
  }

  // 5. Try to call the function to see the exact error
  console.log('\n5. TESTING initialize_user_profile FUNCTION CALL');
  console.log('-------------------------------------------');
  const testWallet = '0xTEST_WALLET_FOR_INVESTIGATION_' + Date.now();
  const { data: testData, error: testError } = await supabase
    .rpc('initialize_user_profile', { p_wallet_address: testWallet });

  if (testError) {
    console.log('Error calling function (EXPECTED):');
    console.log(JSON.stringify(testError, null, 2));
  } else {
    console.log('Function executed successfully (UNEXPECTED):', testData);
    // Clean up test data if it worked
    await supabase.from('user_profiles').delete().eq('wallet_address', testWallet);
  }

  console.log('\n========================================');
  console.log('INVESTIGATION COMPLETE');
  console.log('========================================\n');
}

investigate().catch(console.error);
