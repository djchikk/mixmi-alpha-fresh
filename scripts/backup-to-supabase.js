/**
 * Database Backup Script - Creates backup tables in Supabase
 * Run with: node scripts/backup-to-supabase.js
 *
 * Creates backup tables with date suffix (e.g., ip_tracks_backup_2026_01_04)
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Tables to backup
const TABLES = [
  'ip_tracks',
  'user_profiles',
  'personas',
  'accounts',
  'alpha_users'
];

async function createBackupTable(tableName, dateSuffix) {
  const backupTableName = `${tableName}_backup_${dateSuffix}`;

  console.log(`Creating backup: ${backupTableName}...`);

  // Use raw SQL to create backup table with all data
  const { error } = await supabase.rpc('exec_sql', {
    sql: `CREATE TABLE IF NOT EXISTS ${backupTableName} AS SELECT * FROM ${tableName};`
  });

  if (error) {
    // If exec_sql doesn't exist, try alternative approach
    if (error.message.includes('function') || error.message.includes('does not exist')) {
      console.log(`  Using alternative method for ${tableName}...`);
      return await createBackupTableManual(tableName, backupTableName);
    }
    console.error(`  Error: ${error.message}`);
    return false;
  }

  console.log(`  Created ${backupTableName}`);
  return true;
}

async function createBackupTableManual(tableName, backupTableName) {
  // Fetch all data from original table
  const { data, error: fetchError } = await supabase
    .from(tableName)
    .select('*');

  if (fetchError) {
    console.error(`  Error fetching ${tableName}: ${fetchError.message}`);
    return false;
  }

  if (!data || data.length === 0) {
    console.log(`  No data in ${tableName}, skipping`);
    return true;
  }

  // Try to insert into backup table (table must already exist or we create via SQL editor)
  const { error: insertError } = await supabase
    .from(backupTableName)
    .insert(data);

  if (insertError) {
    if (insertError.message.includes('does not exist')) {
      console.log(`  Table ${backupTableName} doesn't exist.`);
      console.log(`  Run this SQL in Supabase SQL Editor:`);
      console.log(`  CREATE TABLE ${backupTableName} AS SELECT * FROM ${tableName};`);
      return false;
    }
    console.error(`  Error: ${insertError.message}`);
    return false;
  }

  console.log(`  Backed up ${data.length} rows to ${backupTableName}`);
  return true;
}

async function main() {
  // Format: 2026_01_04
  const dateSuffix = new Date().toISOString().split('T')[0].replace(/-/g, '_');

  console.log(`\nCreating Supabase backup tables with suffix: _backup_${dateSuffix}\n`);
  console.log('Note: You may need to run the SQL commands manually in Supabase SQL Editor\n');

  // Generate SQL for manual execution
  console.log('=== SQL Commands (copy to Supabase SQL Editor) ===\n');

  for (const table of TABLES) {
    const backupName = `${table}_backup_${dateSuffix}`;
    console.log(`-- Backup ${table}`);
    console.log(`DROP TABLE IF EXISTS ${backupName};`);
    console.log(`CREATE TABLE ${backupName} AS SELECT * FROM ${table};`);
    console.log('');
  }

  console.log('=== End SQL Commands ===\n');

  // Try automatic creation (may not work without exec_sql function)
  let successCount = 0;
  for (const table of TABLES) {
    const success = await createBackupTable(table, dateSuffix);
    if (success) successCount++;
  }

  console.log(`\nBackup complete! ${successCount}/${TABLES.length} tables backed up automatically.`);
  console.log('If any failed, use the SQL commands above in the Supabase SQL Editor.');
}

main().catch(console.error);
