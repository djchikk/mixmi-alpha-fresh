#!/usr/bin/env node

/**
 * Add International Radio Test Accounts
 * Adds accounts for Brasil, Bhutan, and India radio stations
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function addInternationalRadioAccounts() {
  console.log('🌍 Adding international radio test accounts...\n');

  const accounts = [
    {
      wallet: 'SP2HRE24G3EKAY6GPWDK6MDCGANAB6NP2C4A25FKW',
      artistName: 'Radio Brasil',
      flag: '🇧🇷'
    },
    {
      wallet: 'SPN284X1CRPQJA44WG0E7Z8S2RXM7XGHDJHVAWCH',
      artistName: 'Bhutan Radio',
      flag: '🇧🇹'
    },
    {
      wallet: 'SP2WQCFWRBMCZTF2EEM6P79NVH6B857CF6K7H29R4',
      artistName: 'Radio India',
      flag: '🇮🇳'
    }
  ];

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
    for (const account of accounts) {
      console.log(`${account.flag} Adding ${account.artistName}...`);
      console.log(`   Wallet: ${account.wallet}\n`);

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
            approved: true,
            notes: `${account.artistName} test stations - Updated ${new Date().toISOString()}`
          })
          .eq('wallet_address', account.wallet);

        if (updateError) {
          console.log('❌ Update error:', updateError);
          continue;
        }

        console.log(`✅ ${account.artistName} updated!\n`);
      } else {
        // Insert new user
        const { error: insertError } = await supabase
          .from('alpha_users')
          .insert({
            wallet_address: account.wallet,
            artist_name: account.artistName,
            approved: true,
            notes: `${account.artistName} test stations - Added ${new Date().toISOString()}`
          });

        if (insertError) {
          console.log('❌ Insert error:', insertError);
          continue;
        }

        console.log(`✅ ${account.artistName} added!\n`);
      }
    }

    // Verify all accounts
    console.log('📋 Verifying accounts...\n');

    for (const account of accounts) {
      const { data: user, error: checkError } = await supabase
        .from('alpha_users')
        .select('wallet_address, artist_name, approved, created_at')
        .eq('wallet_address', account.wallet)
        .single();

      if (!checkError && user) {
        console.log(`${account.flag} ${user.artist_name}`);
        console.log(`   Wallet: ${user.wallet_address}`);
        console.log(`   Approved: ${user.approved ? '✅' : '❌'}`);
        console.log(`   Created: ${new Date(user.created_at).toLocaleString()}\n`);
      }
    }

    console.log('🎉 All international radio accounts ready!');
    console.log('\n🌍 Ready to add stations from:');
    console.log('   🇧🇷 Brasil - Salvador, Bahia');
    console.log('   🇧🇹 Bhutan - Thimphu');
    console.log('   🇮🇳 India - (searching next!)\n');

  } catch (err) {
    console.log('❌ Script error:', err);
    process.exit(1);
  }
}

addInternationalRadioAccounts();
