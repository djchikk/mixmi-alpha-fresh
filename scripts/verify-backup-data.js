const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyBackupData() {
  console.log('\n========================================');
  console.log('VERIFYING BACKUP DATA');
  console.log('========================================\n');

  // Check user_profiles backup
  const { data: profileBackup, error: profileError } = await supabase
    .from('user_profiles_backup_2025_11_03')
    .select('*')
    .limit(1);

  console.log('user_profiles_backup_2025_11_03:');
  if (profileError) {
    console.log(`   ❌ ERROR: ${profileError.message}`);
  } else {
    console.log(`   ✅ Has data: ${profileBackup?.length > 0 ? 'YES' : 'EMPTY TABLE'}`);
    if (profileBackup?.length > 0) {
      console.log(`   Sample:`, profileBackup[0]);
    }
  }
  console.log('');

  // Compare with current table
  const { data: currentProfiles } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(1);

  console.log('user_profiles (current):');
  console.log(`   Has data: ${currentProfiles?.length > 0 ? 'YES' : 'EMPTY'}`);
  console.log('');

  console.log('========================================\n');
}

verifyBackupData().catch(console.error);
