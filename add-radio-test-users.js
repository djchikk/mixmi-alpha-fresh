const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addRadioTestUsers() {
  console.log('🎙️ Adding radio test users to alpha_users table...\n');

  const users = [
    {
      wallet_address: 'SPKQMCRPHYAA50JXGR0QECY7AV09ZABGBAFASYHC',
      artist_name: 'Radio Pack Test',
      approved: true,
      notes: 'Test user for radio station pack uploads'
    },
    {
      wallet_address: 'SP3XPBQ0D5VBRDX40RWTG2ABCN54D94W6DPHS7B8Y',
      artist_name: 'Radio Paradise Test',
      approved: true,
      notes: 'Test user for radio station uploads'
    }
  ];

  console.log('Adding users:');
  users.forEach((user, i) => {
    console.log(`  ${i + 1}. ${user.artist_name} (${user.wallet_address})`);
  });
  console.log('');

  try {
    // Try to insert each user individually to handle duplicates gracefully
    for (const user of users) {
      const { data, error } = await supabase
        .from('alpha_users')
        .insert([user])
        .select();

      if (error) {
        // Check if it's a duplicate key error
        if (error.code === '23505') {
          console.log(`⚠️  User already exists: ${user.artist_name} (${user.wallet_address})`);

          // Update the existing record instead
          const { error: updateError } = await supabase
            .from('alpha_users')
            .update({
              artist_name: user.artist_name,
              notes: user.notes,
              approved: user.approved
            })
            .eq('wallet_address', user.wallet_address);

          if (updateError) {
            console.error(`❌ Error updating ${user.artist_name}:`, updateError);
          } else {
            console.log(`✅ Updated existing user: ${user.artist_name}`);
          }
        } else {
          console.error(`❌ Error adding ${user.artist_name}:`, error);
        }
      } else {
        console.log(`✅ Added new user: ${user.artist_name}`);
      }
    }

    console.log('\n🎉 Ready to test radio station uploads!');

  } catch (err) {
    console.error('❌ Script error:', err);
    process.exit(1);
  }
}

addRadioTestUsers();
