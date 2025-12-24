const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyBackups() {
  console.log('\n========================================');
  console.log('VERIFYING BACKUP TABLES EXIST');
  console.log('========================================\n');

  const backupTables = [
    'user_profiles_backup_2025_11_03',
    'user_profile_sections_backup_2025_11_03',
    'ip_tracks_backup_2025_11_03'
  ];

  for (const tableName of backupTables) {
    console.log(`Checking: ${tableName}`);

    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`   ❌ DOES NOT EXIST: ${error.message}\n`);
    } else {
      console.log(`   ✅ EXISTS with ${count} rows\n`);
    }
  }

  console.log('========================================\n');
}

verifyBackups().catch(console.error);
