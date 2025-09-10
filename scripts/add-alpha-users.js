#!/usr/bin/env node

/**
 * Bulk Add Alpha Users Script
 * Usage: node scripts/add-alpha-users.js "wallet1,wallet2,wallet3"
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function addAlphaUsers() {
  // Get wallet addresses from command line argument
  const walletsArg = process.argv[2];
  if (!walletsArg) {
    console.log(`
🎯 Usage: node scripts/add-alpha-users.js "wallet1,wallet2,wallet3"

Example:
node scripts/add-alpha-users.js "SP1ABC123,SP2DEF456,SP3GHI789"

Or paste multiple wallets separated by commas:
node scripts/add-alpha-users.js "SP1ABC123, SP2DEF456, SP3GHI789"
    `);
    process.exit(1);
  }

  // Parse wallet addresses (handle spaces and commas)
  const wallets = walletsArg
    .split(',')
    .map(w => w.trim())
    .filter(w => w.length > 0);

  if (wallets.length === 0) {
    console.log('❌ No valid wallet addresses found');
    process.exit(1);
  }

  console.log(`🔍 Adding ${wallets.length} wallet(s) to alpha_users table:`);
  wallets.forEach((wallet, i) => {
    console.log(`  ${i + 1}. ${wallet}`);
  });

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

  console.log('\n🚀 Starting bulk insert...');

  // Prepare user records
  const userRecords = wallets.map(wallet => ({
    wallet_address: wallet,
    artist_name: `Alpha User (${wallet.substring(0, 8)}...)`,
    approved: true,
    notes: `Added via bulk script on ${new Date().toISOString()}`
  }));

  try {
    // Insert users (upsert to handle duplicates)
    const { data, error } = await supabase
      .from('alpha_users')
      .upsert(userRecords, { 
        onConflict: 'wallet_address',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.log('❌ Database error:', error);
      process.exit(1);
    }

    console.log(`✅ Successfully added ${data?.length || userRecords.length} alpha users!`);
    
    // Verify by listing current users
    const { data: allUsers, error: listError } = await supabase
      .from('alpha_users')
      .select('wallet_address, artist_name, approved')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!listError && allUsers) {
      console.log('\n📋 Recent alpha users:');
      allUsers.forEach((user, i) => {
        const status = user.approved ? '✅' : '❌';
        console.log(`  ${i + 1}. ${status} ${user.wallet_address} (${user.artist_name})`);
      });
    }

    console.log('\n🎉 Ready to test uploads with these wallets!');

  } catch (err) {
    console.log('❌ Script error:', err);
    process.exit(1);
  }
}

addAlphaUsers();