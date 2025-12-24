const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAndPrepare() {
  console.log('\n========================================');
  console.log('PRIMARY KEY FIX - PRE-CHECK');
  console.log('========================================\n');

  // Step 1: Check for duplicate wallet addresses
  console.log('1️⃣  Checking for duplicate wallet addresses...\n');

  const { data: duplicates, error: dupError } = await supabase
    .rpc('run_sql', {
      query: `
        SELECT wallet_address, COUNT(*) as count
        FROM user_profiles
        GROUP BY wallet_address
        HAVING COUNT(*) > 1
      `
    });

  if (dupError) {
    // Try alternative approach if RPC doesn't work
    const { data: allProfiles, error: fetchError } = await supabase
      .from('user_profiles')
      .select('wallet_address');

    if (fetchError) {
      console.error('❌ Error fetching profiles:', fetchError);
      return;
    }

    // Check for duplicates in JS
    const counts = {};
    allProfiles.forEach(p => {
      counts[p.wallet_address] = (counts[p.wallet_address] || 0) + 1;
    });

    const dups = Object.entries(counts).filter(([_, count]) => count > 1);

    if (dups.length > 0) {
      console.log('❌ DUPLICATES FOUND:');
      dups.forEach(([wallet, count]) => {
        console.log(`   ${wallet}: ${count} occurrences`);
      });
      console.log('\n⚠️  Cannot add PRIMARY KEY with duplicates present!');
      console.log('   You must resolve duplicates first.\n');
      return;
    } else {
      console.log('✅ No duplicate wallet addresses found!\n');
    }
  } else if (duplicates && duplicates.length > 0) {
    console.log('❌ DUPLICATES FOUND:', duplicates);
    console.log('\n⚠️  Cannot add PRIMARY KEY with duplicates present!\n');
    return;
  } else {
    console.log('✅ No duplicate wallet addresses found!\n');
  }

  // Step 2: Count total profiles
  const { count: totalCount } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total user_profiles: ${totalCount} rows\n`);

  // Step 3: Provide SQL to run in Supabase
  console.log('========================================');
  console.log('✅ READY TO ADD PRIMARY KEY');
  console.log('========================================\n');
  console.log('Copy and paste this SQL into Supabase SQL Editor:\n');
  console.log('-------------------------------------------');
  console.log(`-- Add PRIMARY KEY constraint to user_profiles
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_pkey
PRIMARY KEY (wallet_address);`);
  console.log('-------------------------------------------\n');

  console.log('After running the SQL:');
  console.log('1. Test with: node scripts/test-initialize-profile.js');
  console.log('2. Verify new user signup works\n');
}

checkAndPrepare().catch(console.error);
