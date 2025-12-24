#!/usr/bin/env node

/**
 * Apply Sticker Column Defaults
 * Ensures the user_profiles table has correct default values for sticker fields
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function applyDefaults() {
  console.log('🔧 Applying column defaults for sticker fields...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.log('❌ Missing environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    console.log('📋 To ensure new profiles have stickers visible by default,');
    console.log('   please run the following SQL in your Supabase SQL Editor:\n');
    console.log('-----------------------------------------------------------');
    console.log(`
-- Set default values for sticker fields
ALTER TABLE user_profiles
  ALTER COLUMN sticker_id SET DEFAULT 'daisy-blue',
  ALTER COLUMN sticker_visible SET DEFAULT true;
    `.trim());
    console.log('-----------------------------------------------------------\n');

    // Test by creating a test profile to verify defaults work
    console.log('🧪 Testing profile creation with defaults...\n');

    const testWallet = 'SPTEST' + Date.now();

    // Create a test profile
    const { data: insertData, error: insertError } = await supabase
      .from('user_profiles')
      .insert({
        wallet_address: testWallet,
        display_name: 'Test User'
      })
      .select()
      .single();

    if (insertError) {
      console.log('❌ Error creating test profile:', insertError);
      console.log('\n⚠️  The column defaults may not be set correctly.');
      console.log('   Please apply the SQL above in Supabase SQL Editor.\n');
    } else {
      console.log('✅ Test profile created:', {
        wallet: testWallet.substring(0, 15) + '...',
        sticker_id: insertData.sticker_id,
        sticker_visible: insertData.sticker_visible
      });

      if (insertData.sticker_id === 'daisy-blue' && insertData.sticker_visible === true) {
        console.log('\n🎉 SUCCESS! Column defaults are working correctly!');
        console.log('   New profiles will have stickers visible by default.\n');
      } else {
        console.log('\n⚠️  Column defaults may not be set correctly:');
        console.log(`   Expected: sticker_id='daisy-blue', sticker_visible=true`);
        console.log(`   Got: sticker_id='${insertData.sticker_id}', sticker_visible=${insertData.sticker_visible}`);
        console.log('\n   Please apply the SQL above in Supabase SQL Editor.\n');
      }

      // Clean up test profile
      await supabase
        .from('user_profiles')
        .delete()
        .eq('wallet_address', testWallet);

      console.log('🧹 Test profile cleaned up.');
    }

  } catch (err) {
    console.log('❌ Script error:', err);
  }
}

applyDefaults();
