/**
 * Fix profiles missing SUI addresses
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const usernames = ['selectapinkbunny', 'fluffytoys4evah', 'fluffy-chick'];

async function checkAndFix() {
  console.log('\n=== CHECKING PROFILES FOR SUI ADDRESS ===\n');

  for (const username of usernames) {
    console.log(`\n--- @${username} ---`);

    // Get persona
    const { data: persona } = await supabase
      .from('personas')
      .select('wallet_address, sui_address')
      .eq('username', username)
      .single();

    if (!persona) {
      console.log('  Persona NOT FOUND');
      continue;
    }

    console.log('  Persona STX:', persona.wallet_address || 'null');
    console.log('  Persona SUI:', persona.sui_address || 'null');

    // Get profile by username
    const { data: profileByName } = await supabase
      .from('user_profiles')
      .select('wallet_address, sui_address, show_wallet_address, show_sui_address')
      .eq('username', username)
      .single();

    // Get profile by wallet
    let profileByWallet = null;
    if (persona.wallet_address) {
      const { data } = await supabase
        .from('user_profiles')
        .select('username, wallet_address, sui_address, show_wallet_address, show_sui_address')
        .eq('wallet_address', persona.wallet_address)
        .single();
      profileByWallet = data;
    }

    const profile = profileByName || profileByWallet;

    if (!profile) {
      console.log('  Profile NOT FOUND');
      continue;
    }

    console.log('  Profile username:', profile.username);
    console.log('  Profile wallet:', profile.wallet_address);
    console.log('  Profile SUI:', profile.sui_address || 'null');
    console.log('  show_wallet_address:', profile.show_wallet_address);
    console.log('  show_sui_address:', profile.show_sui_address);

    // Fix if needed
    const needsFix = !profile.sui_address || profile.username !== username;

    if (needsFix) {
      console.log('\n  FIXING...');
      const { error } = await supabase
        .from('user_profiles')
        .update({
          sui_address: persona.sui_address,
          username: username,
          show_sui_address: true
        })
        .eq('wallet_address', profile.wallet_address);

      if (error) {
        console.log('  Error:', error.message);
      } else {
        console.log('  ✅ Updated profile with SUI address');
      }
    } else {
      console.log('\n  ✓ Already correct');
    }
  }

  console.log('\n\n=== DONE ===\n');
}

checkAndFix().catch(console.error);
