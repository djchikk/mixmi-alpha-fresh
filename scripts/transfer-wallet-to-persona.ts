/**
 * Transfer Wallet Profile to Persona
 *
 * This script:
 * 1. Copies profile data (display_name, avatar_url, bio) to a persona
 * 2. Links the wallet to the persona's account (updates user_profiles.account_id)
 * 3. Adds wallet_address to the persona record for track association
 *
 * Usage:
 *   npx ts-node scripts/transfer-wallet-to-persona.ts <source_wallet> <target_persona_username>
 *
 * Example:
 *   npx ts-node scripts/transfer-wallet-to-persona.ts SP2ABC123... djcoolname
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function transferWalletToPersona(sourceWallet: string, targetPersonaUsername: string) {
  console.log('\n🔄 Transfer Wallet to Persona Script');
  console.log('='.repeat(50));
  console.log(`Source wallet: ${sourceWallet}`);
  console.log(`Target persona: @${targetPersonaUsername}`);
  console.log('');

  // 1. Fetch source profile
  console.log('1️⃣ Fetching source profile...');
  const { data: sourceProfile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('wallet_address', sourceWallet)
    .single();

  if (profileError || !sourceProfile) {
    console.error('❌ Could not find source profile:', profileError?.message || 'Not found');
    return;
  }

  console.log('   ✅ Found profile:');
  console.log(`      - Display name: ${sourceProfile.display_name || '(not set)'}`);
  console.log(`      - Username: ${sourceProfile.username || '(not set)'}`);
  console.log(`      - Avatar: ${sourceProfile.avatar_url ? '✓ Set' : '(not set)'}`);
  console.log(`      - Current account_id: ${sourceProfile.account_id || '(not linked)'}`);
  console.log('');

  // 2. Fetch target persona
  console.log('2️⃣ Fetching target persona...');
  const { data: targetPersona, error: personaError } = await supabase
    .from('personas')
    .select('*')
    .eq('username', targetPersonaUsername)
    .single();

  if (personaError || !targetPersona) {
    console.error('❌ Could not find target persona:', personaError?.message || 'Not found');
    return;
  }

  console.log('   ✅ Found persona:');
  console.log(`      - ID: ${targetPersona.id}`);
  console.log(`      - Account ID: ${targetPersona.account_id}`);
  console.log(`      - Current display name: ${targetPersona.display_name || '(not set)'}`);
  console.log('');

  // 3. Count tracks for this wallet
  console.log('3️⃣ Counting associated tracks...');
  const { count: trackCount, error: trackError } = await supabase
    .from('ip_tracks')
    .select('*', { count: 'exact', head: true })
    .eq('primary_uploader_wallet', sourceWallet)
    .eq('is_deleted', false);

  console.log(`   📦 Found ${trackCount || 0} tracks associated with this wallet`);
  console.log('');

  // 4. Copy profile data to persona
  console.log('4️⃣ Copying profile data to persona...');
  const { error: updatePersonaError } = await supabase
    .from('personas')
    .update({
      display_name: sourceProfile.display_name,
      avatar_url: sourceProfile.avatar_url,
      bio: sourceProfile.bio,
      // Store the wallet_address for track association
      // Note: This field may need to be added to the personas table
    })
    .eq('id', targetPersona.id);

  if (updatePersonaError) {
    console.error('   ❌ Failed to update persona:', updatePersonaError.message);
  } else {
    console.log('   ✅ Persona updated with profile data');
  }

  // 5. Link wallet to the persona's account
  console.log('5️⃣ Linking wallet to account...');
  const { error: linkError } = await supabase
    .from('user_profiles')
    .update({ account_id: targetPersona.account_id })
    .eq('wallet_address', sourceWallet);

  if (linkError) {
    console.error('   ❌ Failed to link wallet:', linkError.message);
  } else {
    console.log('   ✅ Wallet linked to account');
  }

  // 6. Set wallet_address on persona
  console.log('6️⃣ Associating wallet with persona...');
  const { error: walletLinkError } = await supabase
    .from('personas')
    .update({ wallet_address: sourceWallet })
    .eq('id', targetPersona.id);

  if (walletLinkError) {
    console.error('   ❌ Failed:', walletLinkError.message);
  } else {
    console.log('   ✅ Wallet associated with persona');
  }

  console.log('');
  console.log('='.repeat(50));
  console.log('✅ Transfer complete!');
  console.log('');
  console.log('📊 Summary:');
  console.log(`   - Profile data: Copied to @${targetPersonaUsername}`);
  console.log(`   - Wallet: Linked to account ${targetPersona.account_id}`);
  console.log(`   - Tracks: ${trackCount || 0} tracks remain with wallet ${sourceWallet.slice(0, 8)}...`);
  console.log('');
  console.log('💡 The tracks are still queryable via the wallet address.');
  console.log('   The app can now show them under this persona by looking up');
  console.log('   wallets linked to the account.');
}

// Main
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: npx ts-node scripts/transfer-wallet-to-persona.ts <source_wallet> <target_persona_username>');
  console.log('');
  console.log('Example:');
  console.log('  npx ts-node scripts/transfer-wallet-to-persona.ts SP2ABC123XYZ djcoolname');
  process.exit(1);
}

const [sourceWallet, targetPersonaUsername] = args;

transferWalletToPersona(sourceWallet, targetPersonaUsername)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script error:', err);
    process.exit(1);
  });
