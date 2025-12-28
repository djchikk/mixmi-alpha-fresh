/**
 * Database Backup Script
 * Run with: node scripts/backup-tables.js
 *
 * Creates JSON backups of key tables in /backups folder
 * Uses service role key to bypass RLS
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function backupTable(tableName) {
  console.log(`Backing up ${tableName}...`);

  const { data, error } = await supabase
    .from(tableName)
    .select('*');

  if (error) {
    console.error(`Error backing up ${tableName}:`, error.message);
    return null;
  }

  console.log(`  Found ${data.length} rows`);
  return data;
}

async function main() {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const backupDir = path.join(__dirname, '..', 'backups', timestamp);

  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`\nCreating backups in: ${backupDir}\n`);

  for (const table of TABLES) {
    const data = await backupTable(table);

    if (data) {
      const filePath = path.join(backupDir, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`  Saved to ${table}.json\n`);
    }
  }

  console.log('Backup complete!');
}

main().catch(console.error);
