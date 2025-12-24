#!/usr/bin/env node

/**
 * Add Eritrea Radio Test User
 * Adds SP12JDDJANWSZCMCXGG88ABFF9PB7MVNRFXYE9SV2 with artist_name "Eritrea Radio Test"
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function addEritreaRadio() {
  const wallet = 'SP12JDDJANWSZCMCXGG88ABFF9PB7MVNRFXYE9SV2';
  const artistName = 'Eritrea Radio Test';

  console.log('🎵 Adding Eritrea Radio Test wallet to alpha_users...');
  console.log(`   Wallet: ${wallet}`);
  console.log(`   Artist: ${artistName}\n`);

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
    // Check if user already exists
    const { data: existing } = await supabase
      .from('alpha_users')
      .select('wallet_address')
      .eq('wallet_address', wallet)
      .maybeSingle();

    if (existing) {
      console.log('⚠️  User already exists, updating artist_name...');

      const { error: updateError } = await supabase
        .from('alpha_users')
        .update({
          artist_name: artistName,
          approved: true,
          notes: `Eritrea Radio Test station - Updated ${new Date().toISOString()}`
        })
        .eq('wallet_address', wallet);

      if (updateError) {
        console.log('❌ Update error:', updateError);
        process.exit(1);
      }

      console.log('✅ Successfully updated Eritrea Radio Test user!');
    } else {
      // Insert new user
      const { error: insertError } = await supabase
        .from('alpha_users')
        .insert({
          wallet_address: wallet,
          artist_name: artistName,
          approved: true,
          notes: `Eritrea Radio Test station - Added ${new Date().toISOString()}`
        });

      if (insertError) {
        console.log('❌ Insert error:', insertError);
        process.exit(1);
      }

      console.log('✅ Successfully added Eritrea Radio Test user!');
    }

    // Verify the user was added
    const { data: user, error: checkError } = await supabase
      .from('alpha_users')
      .select('wallet_address, artist_name, approved, created_at')
      .eq('wallet_address', wallet)
      .single();

    if (!checkError && user) {
      console.log('\n📋 User details:');
      console.log(`   Wallet: ${user.wallet_address}`);
      console.log(`   Artist: ${user.artist_name}`);
      console.log(`   Approved: ${user.approved ? '✅' : '❌'}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
    }

    console.log('\n🎉 Ready to test Eritrea radio stations! 🇪🇷');

  } catch (err) {
    console.log('❌ Script error:', err);
    process.exit(1);
  }
}

addEritreaRadio();
