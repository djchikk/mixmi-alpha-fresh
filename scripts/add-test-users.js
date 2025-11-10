const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addTestUsers() {
  console.log('\n========================================');
  console.log('ADDING TEST USERS TO alpha_users');
  console.log('========================================\n');

  const testUsers = [
    {
      wallet_address: 'SP2WQCFWRBMCZTF2EEM6P79NVH6B857CF6K7H29R4',
      artist_name: 's_h_'
    },
    {
      wallet_address: 'SP3WZZNRWQ5414341W7ZNP3DB13B91YX0CFKMP6ET',
      artist_name: 'Demos Never Done'
    }
  ];

  for (const user of testUsers) {
    console.log(`\n📝 Adding user: ${user.artist_name}`);
    console.log(`   Wallet: ${user.wallet_address}`);

    try {
      // Check if user already exists
      const { data: existing, error: checkError } = await supabase
        .from('alpha_users')
        .select('*')
        .eq('wallet_address', user.wallet_address)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 is "not found" - that's okay
        throw checkError;
      }

      if (existing) {
        console.log(`   ⚠️  User already exists with ID: ${existing.id}`);
        console.log(`   Current artist_name: ${existing.artist_name}`);

        // Update artist_name if different
        if (existing.artist_name !== user.artist_name) {
          const { error: updateError } = await supabase
            .from('alpha_users')
            .update({ artist_name: user.artist_name })
            .eq('wallet_address', user.wallet_address);

          if (updateError) throw updateError;
          console.log(`   ✅ Updated artist_name to: ${user.artist_name}`);
        } else {
          console.log(`   ℹ️  Artist name already matches, no update needed`);
        }
        continue;
      }

      // Insert new user
      const { data: newUser, error: insertError } = await supabase
        .from('alpha_users')
        .insert({
          wallet_address: user.wallet_address,
          artist_name: user.artist_name,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log(`   ✅ Successfully added user!`);
      console.log(`   User ID: ${newUser.id}`);
      console.log(`   Created at: ${newUser.created_at}`);

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      console.error(error);
    }
  }

  console.log('\n========================================');
  console.log('VERIFICATION');
  console.log('========================================\n');

  // Verify users were added
  for (const user of testUsers) {
    const { data, error } = await supabase
      .from('alpha_users')
      .select('*')
      .eq('wallet_address', user.wallet_address)
      .single();

    if (error) {
      console.log(`❌ ${user.artist_name}: NOT FOUND`);
    } else {
      console.log(`✅ ${user.artist_name}: ${data.wallet_address}`);
      console.log(`   ID: ${data.id}`);
      console.log(`   Created: ${data.created_at}\n`);
    }
  }

  console.log('========================================');
  console.log('DONE');
  console.log('========================================\n');
}

addTestUsers().catch(console.error);
