const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkConstraints() {
  console.log('\n========================================');
  console.log('CHECKING TABLE CONSTRAINTS');
  console.log('========================================\n');

  // Check user_profiles constraints
  console.log('1. USER_PROFILES TABLE CONSTRAINTS');
  console.log('-------------------------------------------');

  const { data: profileConstraints, error: profileError } = await supabase
    .rpc('check_constraints', {
      query: `
        SELECT
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'user_profiles'
        ORDER BY tc.constraint_type, kcu.ordinal_position
      `
    });

  if (profileError) {
    console.log('Cannot use RPC, trying direct query...\n');

    // Let's try a workaround - check if wallet_address is unique by looking at the schema
    const { data: profiles, error: err } = await supabase
      .from('user_profiles')
      .select('wallet_address')
      .limit(0);

    if (!err) {
      console.log('Table exists, but need to run SQL query in Supabase Dashboard to see constraints');
    }
  } else {
    console.log('Constraints found:');
    console.log(JSON.stringify(profileConstraints, null, 2));
  }

  // Check user_profile_sections constraints
  console.log('\n2. USER_PROFILE_SECTIONS TABLE CONSTRAINTS');
  console.log('-------------------------------------------');

  const { data: sectionsConstraints, error: sectionsError } = await supabase
    .rpc('check_constraints', {
      query: `
        SELECT
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'user_profile_sections'
        ORDER BY tc.constraint_type, kcu.ordinal_position
      `
    });

  if (sectionsError) {
    console.log('Cannot use RPC method\n');
  } else {
    console.log('Constraints found:');
    console.log(JSON.stringify(sectionsConstraints, null, 2));
  }

  // Test approach: Try to insert duplicate data to see what fails
  console.log('\n3. TESTING CONSTRAINT BEHAVIOR');
  console.log('-------------------------------------------');
  console.log('Attempting to insert duplicate wallet_address to user_profiles...');

  const testWallet = 'SP3C6XJRJM6RT0A1JMWSJ31B50N785Q8NA4HAW2GK'; // From our sample data

  const { data: insertData, error: insertError } = await supabase
    .from('user_profiles')
    .insert({
      wallet_address: testWallet,
      display_name: 'Test Duplicate',
      username: 'testdupe'
    });

  if (insertError) {
    if (insertError.code === '23505') {
      console.log('✅ UNIQUE constraint EXISTS on wallet_address');
      console.log('   Error:', insertError.message);
    } else {
      console.log('Different error:', insertError);
    }
  } else {
    console.log('⚠️  No unique constraint - insert succeeded (this is bad!)');
  }

  // Test sections table constraint
  console.log('\n4. TESTING user_profile_sections CONSTRAINT');
  console.log('-------------------------------------------');
  console.log('Attempting to insert duplicate (wallet_address, section_type)...');

  const { data: sectionInsert, error: sectionError } = await supabase
    .from('user_profile_sections')
    .insert({
      wallet_address: testWallet,
      section_type: 'spotlight',
      title: 'Test',
      display_order: 1,
      is_visible: true,
      config: []
    });

  if (sectionError) {
    if (sectionError.code === '23505') {
      console.log('✅ UNIQUE constraint EXISTS on (wallet_address, section_type)');
      console.log('   Error:', sectionError.message);
    } else {
      console.log('Different error:', sectionError);
    }
  } else {
    console.log('⚠️  No unique constraint - insert succeeded (this is bad!)');
    console.log('   Inserted row ID:', sectionInsert);
  }

  console.log('\n========================================');
  console.log('DIAGNOSIS BASED ON initialize_user_profile FUNCTION');
  console.log('========================================\n');

  console.log('The function uses:');
  console.log('1. ON CONFLICT (wallet_address) - requires UNIQUE constraint on wallet_address');
  console.log('2. ON CONFLICT (wallet_address, section_type) - requires composite UNIQUE constraint');
  console.log('');
  console.log('If the test inserts above succeeded without errors, the constraints are MISSING.');
  console.log('This likely happened during the Oct 30 database cleanup.');
  console.log('');
}

checkConstraints().catch(console.error);
