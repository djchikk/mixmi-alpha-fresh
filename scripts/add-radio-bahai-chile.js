#!/usr/bin/env node

/**
 * Add Radio Baha'i Chile Account
 * Sets up account for Radio Baha'i in Temuco, Chile
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function addRadioBahaiChile() {
  console.log('🇨🇱 Adding Radio Baha\'i Chile account...\n');

  const account = {
    wallet: 'SP2SVA4V7V1KY2S7BQZQDG3G09Q3K6444FDEX0S8Q',
    artistName: 'Radio Baha\'i Chile',
    inviteCode: 'MIXMI-CHILE1',
    flag: '🇨🇱'
  };

  // Create Supabase client with service role key
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.log('❌ Missing environment variables:');
    console.log('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
    console.log('   SUPABASE_SERVICE_ROLE_KEY:', !!serviceRoleKey);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    console.log(`${account.flag} Adding ${account.artistName}...`);
    console.log(`   Wallet: ${account.wallet}`);
    console.log(`   Invite Code: ${account.inviteCode}\n`);

    // Check if user already exists
    const { data: existing } = await supabase
      .from('alpha_users')
      .select('wallet_address')
      .eq('wallet_address', account.wallet)
      .maybeSingle();

    if (existing) {
      console.log(`⚠️  ${account.artistName} already exists, updating...\n`);

      const { error: updateError } = await supabase
        .from('alpha_users')
        .update({
          artist_name: account.artistName,
          invite_code: account.inviteCode,
          approved: true,
          notes: `Radio Baha'i in Temuco, Chile - Updated ${new Date().toISOString()}`
        })
        .eq('wallet_address', account.wallet);

      if (updateError) {
        console.log('❌ Update error:', updateError);
        process.exit(1);
      }

      console.log(`✅ ${account.artistName} updated!\n`);
    } else {
      // Insert new user
      const { error: insertError } = await supabase
        .from('alpha_users')
        .insert({
          wallet_address: account.wallet,
          artist_name: account.artistName,
          invite_code: account.inviteCode,
          approved: true,
          notes: `Radio Baha'i in Temuco, Chile - Added ${new Date().toISOString()}`
        });

      if (insertError) {
        console.log('❌ Insert error:', insertError);
        process.exit(1);
      }

      console.log(`✅ ${account.artistName} added!\n`);
    }

    // Verify account
    console.log('📋 Verifying account...\n');

    const { data: user, error: checkError } = await supabase
      .from('alpha_users')
      .select('wallet_address, artist_name, invite_code, approved, created_at')
      .eq('wallet_address', account.wallet)
      .single();

    if (!checkError && user) {
      console.log(`${account.flag} ${user.artist_name}`);
      console.log(`   Wallet: ${user.wallet_address}`);
      console.log(`   Invite Code: ${user.invite_code}`);
      console.log(`   Approved: ${user.approved ? '✅' : '❌'}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}\n`);
    }

    console.log('🎉 Radio Baha\'i Chile account ready!');
    console.log('\n📻 Next steps:');
    console.log('   1. Upload radio station with streaming URL: http://49.12.9.173:8030/listen.pls?sid=1');
    console.log('   2. Add station description and metadata');
    console.log('   3. Test playback in Radio Widget\n');

  } catch (err) {
    console.log('❌ Script error:', err);
    process.exit(1);
  }
}

addRadioBahaiChile();
