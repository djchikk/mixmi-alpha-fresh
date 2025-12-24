const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🚀 RUNNING DATABASE MIGRATION TO NEW FIELD NAMES\n');
  
  try {
    // Step 1: Rename composition fields
    console.log('📝 Step 1: Renaming composition fields...');
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE ip_tracks RENAME COLUMN composition_address1 TO composition_split_1_wallet;'
    });
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE ip_tracks RENAME COLUMN composition_shares1 TO composition_split_1_percentage;'
    });
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE ip_tracks RENAME COLUMN composition_address2 TO composition_split_2_wallet;'
    });
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE ip_tracks RENAME COLUMN composition_shares2 TO composition_split_2_percentage;'
    });
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE ip_tracks RENAME COLUMN composition_address3 TO composition_split_3_wallet;'
    });
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE ip_tracks RENAME COLUMN composition_shares3 TO composition_split_3_percentage;'
    });
    console.log('✅ Composition fields renamed');

    // Step 2: Rename production fields
    console.log('\n📝 Step 2: Renaming production fields...');
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE ip_tracks RENAME COLUMN production_address1 TO production_split_1_wallet;'
    });
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE ip_tracks RENAME COLUMN production_shares1 TO production_split_1_percentage;'
    });
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE ip_tracks RENAME COLUMN production_address2 TO production_split_2_wallet;'
    });
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE ip_tracks RENAME COLUMN production_shares2 TO production_split_2_percentage;'
    });
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE ip_tracks RENAME COLUMN production_address3 TO production_split_3_wallet;'
    });
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE ip_tracks RENAME COLUMN production_shares3 TO production_split_3_percentage;'
    });
    console.log('✅ Production fields renamed');

    // Step 3: Add new licensing fields
    console.log('\n📝 Step 3: Adding new licensing fields...');
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS allow_remixing BOOLEAN DEFAULT true;'
    });
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS open_to_collaboration BOOLEAN DEFAULT true;'
    });
    await supabase.rpc('exec_sql', { 
      sql: 'ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS license_type VARCHAR(50) DEFAULT \'remix_only\';'
    });
    console.log('✅ Licensing fields added');

    // Step 4: Migrate existing licensing data
    console.log('\n📝 Step 4: Migrating existing licensing data...');
    await supabase.rpc('exec_sql', { 
      sql: 'UPDATE ip_tracks SET allow_remixing = agree_permissions WHERE agree_permissions IS NOT NULL;'
    });
    await supabase.rpc('exec_sql', { 
      sql: 'UPDATE ip_tracks SET open_to_collaboration = agree_collab WHERE agree_collab IS NOT NULL;'
    });
    await supabase.rpc('exec_sql', { 
      sql: 'UPDATE ip_tracks SET license_type = \'custom\' WHERE licensed_by IS NOT NULL;'
    });
    console.log('✅ Licensing data migrated');

    // Verification
    console.log('\n🔍 VERIFICATION: Checking new field names...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('ip_tracks')
      .select('title, composition_split_1_wallet, composition_split_1_percentage, production_split_1_wallet, production_split_1_percentage, allow_remixing, open_to_collaboration, license_type')
      .limit(3);

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
    } else {
      console.log('✅ MIGRATION SUCCESSFUL! Sample data:');
      verifyData.forEach(track => {
        console.log(`  • ${track.title}`);
        console.log(`    Composition: ${track.composition_split_1_wallet} (${track.composition_split_1_percentage}%)`);
        console.log(`    Production: ${track.production_split_1_wallet} (${track.production_split_1_percentage}%)`);
        console.log(`    Licensing: Remix=${track.allow_remixing}, Collab=${track.open_to_collaboration}, Type=${track.license_type}`);
      });
    }

    console.log('\n🎉 DATABASE MIGRATION COMPLETE!');
    console.log('Your TrackCards will now show proper attribution and licensing info!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Alternative: Direct SQL execution (if RPC doesn't work)
async function directMigration() {
  console.log('🔄 Trying direct SQL migration...');
  
  const migrationSQL = `
    -- Rename composition fields
    ALTER TABLE ip_tracks RENAME COLUMN composition_address1 TO composition_split_1_wallet;
    ALTER TABLE ip_tracks RENAME COLUMN composition_shares1 TO composition_split_1_percentage;
    ALTER TABLE ip_tracks RENAME COLUMN composition_address2 TO composition_split_2_wallet;
    ALTER TABLE ip_tracks RENAME COLUMN composition_shares2 TO composition_split_2_percentage;
    ALTER TABLE ip_tracks RENAME COLUMN composition_address3 TO composition_split_3_wallet;
    ALTER TABLE ip_tracks RENAME COLUMN composition_shares3 TO composition_split_3_percentage;
    
    -- Rename production fields
    ALTER TABLE ip_tracks RENAME COLUMN production_address1 TO production_split_1_wallet;
    ALTER TABLE ip_tracks RENAME COLUMN production_shares1 TO production_split_1_percentage;
    ALTER TABLE ip_tracks RENAME COLUMN production_address2 TO production_split_2_wallet;
    ALTER TABLE ip_tracks RENAME COLUMN production_shares2 TO production_split_2_percentage;
    ALTER TABLE ip_tracks RENAME COLUMN production_address3 TO production_split_3_wallet;
    ALTER TABLE ip_tracks RENAME COLUMN production_shares3 TO production_split_3_percentage;
    
    -- Add new licensing fields
    ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS allow_remixing BOOLEAN DEFAULT true;
    ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS open_to_collaboration BOOLEAN DEFAULT true;
    ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS license_type VARCHAR(50) DEFAULT 'remix_only';
    
    -- Migrate existing licensing data
    UPDATE ip_tracks SET allow_remixing = agree_permissions WHERE agree_permissions IS NOT NULL;
    UPDATE ip_tracks SET open_to_collaboration = agree_collab WHERE agree_collab IS NOT NULL;
    UPDATE ip_tracks SET license_type = 'custom' WHERE licensed_by IS NOT NULL;
  `;
  
  console.log('📋 SQL Migration Commands:');
  console.log(migrationSQL);
  console.log('\n💡 Copy the above SQL and run it in your Supabase SQL editor!');
}

runMigration().catch(() => directMigration()).catch(console.error); 