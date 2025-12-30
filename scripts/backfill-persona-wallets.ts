/**
 * One-time script to backfill SUI wallets for existing personas
 *
 * Run with: npx ts-node scripts/backfill-persona-wallets.ts
 *
 * This script:
 * 1. Finds all accounts that have zklogin_users entries
 * 2. Copies the salt to the accounts table
 * 3. Generates wallets for personas without them
 */

import { createClient } from '@supabase/supabase-js';
import { generateEncryptedKeypair } from '../lib/sui/keypair-manager';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillPersonaWallets() {
  console.log('🔄 Starting persona wallet backfill...\n');

  // Step 1: Get all zklogin_users with their salts
  const { data: zkUsers, error: zkError } = await supabase
    .from('zklogin_users')
    .select('sui_address, salt, invite_code');

  if (zkError) {
    console.error('Failed to fetch zklogin_users:', zkError);
    return;
  }

  console.log(`Found ${zkUsers?.length || 0} zkLogin users\n`);

  for (const zkUser of zkUsers || []) {
    console.log(`\n📧 Processing zkLogin user with invite code: ${zkUser.invite_code}`);

    // Find the account via invite_code -> alpha_users -> user_profiles
    const { data: alphaUser } = await supabase
      .from('alpha_users')
      .select('wallet_address')
      .eq('invite_code', zkUser.invite_code)
      .single();

    if (!alphaUser?.wallet_address) {
      console.log('  ⚠️ No alpha_user found for this invite code');
      continue;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('account_id')
      .eq('wallet_address', alphaUser.wallet_address)
      .single();

    if (!profile?.account_id) {
      console.log('  ⚠️ No user_profile found for wallet:', alphaUser.wallet_address);
      continue;
    }

    console.log(`  ✅ Found account: ${profile.account_id}`);

    // Update account with salt and sui_address
    const { error: updateError } = await supabase
      .from('accounts')
      .update({
        zklogin_salt: zkUser.salt,
        sui_address: zkUser.sui_address
      })
      .eq('id', profile.account_id);

    if (updateError) {
      console.log('  ⚠️ Failed to update account:', updateError.message);
    } else {
      console.log('  ✅ Updated account with zklogin_salt');
    }

    // Get all personas for this account that need wallets
    const { data: personas } = await supabase
      .from('personas')
      .select('id, username, sui_address')
      .eq('account_id', profile.account_id)
      .eq('is_active', true);

    if (!personas || personas.length === 0) {
      console.log('  ℹ️ No personas found for this account');
      continue;
    }

    const needWallets = personas.filter(p => !p.sui_address);
    console.log(`  📦 Found ${personas.length} personas, ${needWallets.length} need wallets`);

    for (const persona of needWallets) {
      try {
        const encryptedKeypair = generateEncryptedKeypair(zkUser.salt);

        const { error: personaError } = await supabase
          .from('personas')
          .update({
            sui_address: encryptedKeypair.suiAddress,
            sui_keypair_encrypted: encryptedKeypair.encryptedKey,
            sui_keypair_nonce: encryptedKeypair.nonce,
          })
          .eq('id', persona.id);

        if (personaError) {
          console.log(`    ❌ Failed to update persona ${persona.username}:`, personaError.message);
        } else {
          console.log(`    ✅ Generated wallet for ${persona.username}: ${encryptedKeypair.suiAddress.substring(0, 20)}...`);
        }
      } catch (e) {
        console.log(`    ❌ Error generating wallet for ${persona.username}:`, e);
      }
    }
  }

  console.log('\n✅ Backfill complete!');
}

backfillPersonaWallets().catch(console.error);
