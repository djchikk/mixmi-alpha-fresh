const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Generate timestamp for backup table names
const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '_');

// Main tables to backup
const MAIN_TABLES = [
  'user_profiles',
  'user_profile_sections',
  'alpha_users',
  'tracks',
  'crates',
  'packs',
  'radio_stations',
  'radio_pack_associations',
  'ip_tracks'
];

async function createBackups() {
  console.log('\n========================================');
  console.log('CREATING DATABASE BACKUPS');
  console.log(`Timestamp: ${timestamp}`);
  console.log('========================================\n');

  const results = {
    success: [],
    failed: [],
    skipped: []
  };

  for (const tableName of MAIN_TABLES) {
    const backupTableName = `${tableName}_backup_${timestamp}`;

    console.log(`\n📋 Backing up: ${tableName}`);
    console.log(`   → ${backupTableName}`);
    console.log('   -------------------------------------------');

    try {
      // Step 1: Check if source table exists and has data
      const { data: checkData, error: checkError, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (checkError) {
        if (checkError.code === '42P01') {
          console.log(`   ⚠️  Table doesn't exist, skipping...`);
          results.skipped.push({ table: tableName, reason: 'Table not found' });
          continue;
        }
        throw checkError;
      }

      console.log(`   ℹ️  Source table has ${count || 0} rows`);

      if (count === 0) {
        console.log(`   ⚠️  Table is empty, skipping backup...`);
        results.skipped.push({ table: tableName, reason: 'Empty table' });
        continue;
      }

      // Step 2: Check if backup already exists
      const { error: backupCheckError } = await supabase
        .from(backupTableName)
        .select('*', { count: 'exact', head: true });

      if (!backupCheckError) {
        console.log(`   ⚠️  Backup table already exists: ${backupTableName}`);
        console.log(`   ℹ️  Skipping to avoid overwriting existing backup`);
        results.skipped.push({ table: tableName, reason: 'Backup already exists' });
        continue;
      }

      // Step 3: Fetch all data from source table
      console.log(`   📥 Fetching all data...`);
      const { data: allData, error: fetchError } = await supabase
        .from(tableName)
        .select('*');

      if (fetchError) {
        throw fetchError;
      }

      console.log(`   ✓ Fetched ${allData.length} rows`);

      // Step 4: We need to create the backup table using SQL
      // The Supabase client can't create tables, so we'll provide SQL
      console.log(`   ⚠️  MANUAL STEP REQUIRED:`);
      console.log(`   Run this SQL in Supabase Dashboard:\n`);
      console.log(`   CREATE TABLE ${backupTableName} AS TABLE ${tableName};\n`);

      results.success.push({
        table: tableName,
        backupName: backupTableName,
        rowCount: allData.length,
        needsManualCreation: true
      });

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      results.failed.push({ table: tableName, error: error.message });
    }
  }

  // Print summary
  console.log('\n========================================');
  console.log('BACKUP SUMMARY');
  console.log('========================================\n');

  if (results.success.length > 0) {
    console.log('✅ TABLES READY FOR BACKUP:');
    results.success.forEach(({ table, backupName, rowCount }) => {
      console.log(`   • ${table} → ${backupName} (${rowCount} rows)`);
    });
  }

  if (results.skipped.length > 0) {
    console.log('\n⚠️  SKIPPED TABLES:');
    results.skipped.forEach(({ table, reason }) => {
      console.log(`   • ${table}: ${reason}`);
    });
  }

  if (results.failed.length > 0) {
    console.log('\n❌ FAILED TABLES:');
    results.failed.forEach(({ table, error }) => {
      console.log(`   • ${table}: ${error}`);
    });
  }

  // Generate SQL script
  console.log('\n========================================');
  console.log('SQL SCRIPT TO RUN IN SUPABASE');
  console.log('========================================\n');
  console.log('-- Copy and paste this into Supabase SQL Editor:\n');
  console.log('BEGIN;\n');

  results.success.forEach(({ table, backupName }) => {
    console.log(`-- Backup ${table}`);
    console.log(`CREATE TABLE ${backupName} AS TABLE ${table};`);
    console.log(`COMMENT ON TABLE ${backupName} IS 'Backup created on ${new Date().toISOString()} before fixing initialize_user_profile function';\n`);
  });

  console.log('COMMIT;\n');

  console.log('========================================');
  console.log('VERIFICATION SCRIPT');
  console.log('========================================\n');
  console.log('-- After running the backup SQL, verify with:\n');

  results.success.forEach(({ table, backupName }) => {
    console.log(`SELECT '${backupName}' as backup_table, COUNT(*) as row_count FROM ${backupName}`);
    console.log('UNION ALL');
  });
  console.log(`SELECT 'verification' as backup_table, 0 as row_count;\n`);

  console.log('\n========================================');
  console.log('NEXT STEPS');
  console.log('========================================\n');
  console.log('1. Copy the SQL script above');
  console.log('2. Go to Supabase → SQL Editor');
  console.log('3. Paste and run the script');
  console.log('4. Run the verification script');
  console.log('5. Confirm all backups created successfully');
  console.log('6. Proceed with fixing initialize_user_profile function\n');
}

createBackups().catch(console.error);
