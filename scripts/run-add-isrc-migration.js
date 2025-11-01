const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🔧 Adding ISRC field back to ip_tracks table...\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'add-isrc-field.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by semicolons and filter out comments and empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      if (!statement) continue;

      console.log('Executing:', statement.substring(0, 100) + '...');

      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement
      });

      if (error) {
        console.error('❌ Error:', error);
        // Try alternative method
        console.log('Trying direct query...');
        const { error: directError } = await supabase
          .from('ip_tracks')
          .select('isrc')
          .limit(0);

        if (directError && directError.message.includes('does not exist')) {
          console.log('\n⚠️  Need to run migration via Supabase SQL Editor');
          console.log('\n📋 Please run this SQL in Supabase Dashboard → SQL Editor:');
          console.log('\n' + sql);
          return;
        }
      } else {
        console.log('✅ Success');
      }
    }

    // Verify the field was added
    console.log('\n🔍 Verifying ISRC field...');
    const { data, error } = await supabase
      .from('ip_tracks')
      .select('id, isrc')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('\n⚠️  ISRC field still missing. Please run the SQL manually in Supabase Dashboard.');
        console.log('\n📋 SQL to run:');
        console.log('\nALTER TABLE public.ip_tracks ADD COLUMN IF NOT EXISTS isrc text NULL;');
      } else {
        console.error('❌ Verification error:', error);
      }
    } else {
      console.log('✅ ISRC field successfully added!');
      console.log('Sample query result:', data);
    }

  } catch (err) {
    console.error('❌ Migration error:', err);
  }
}

runMigration();
