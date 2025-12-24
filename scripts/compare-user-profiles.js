const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function compare() {
  console.log('🔍 Comparing user_profiles tables...\n');

  // Get current table
  console.log('1️⃣ Fetching current user_profiles...');
  const { data: current, error: currentError, count: currentCount } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact' });

  if (currentError) {
    console.error('❌ Current error:', currentError);
  } else {
    console.log('✅ Current user_profiles:', current.length, 'records');
  }

  // Check if backup table exists
  console.log('\n2️⃣ Checking backup table...');
  const { data: tables, error: tablesError } = await supabase
    .rpc('exec_sql', {
      sql_query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%backup%'"
    });

  if (tablesError) {
    console.error('❌ Cannot query tables:', tablesError);
  } else {
    console.log('📋 Found backup tables:', tables);
  }

  // Try to get row counts
  console.log('\n3️⃣ Comparing counts...');
  const { data: counts, error: countsError } = await supabase
    .rpc('exec_sql', {
      sql_query: `
        SELECT
          'current' as source,
          COUNT(*) as count
        FROM user_profiles
        UNION ALL
        SELECT
          'backup' as source,
          COUNT(*) as count
        FROM user_profiles_backup_2025_10_30
      `
    });

  if (countsError) {
    console.error('❌ Counts error:', countsError);
  } else {
    console.log('📊 Counts:', counts);
  }

  // Show current profiles
  if (current && current.length > 0) {
    console.log('\n✅ Current profiles:');
    current.forEach(p => {
      const name = p.display_name || p.username || 'No name';
      console.log('  -', p.wallet_address.substring(0, 20) + '...:', name);
    });
  }
}

compare();
