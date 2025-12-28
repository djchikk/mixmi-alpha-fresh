/**
 * Copy Profile Data to Persona
 *
 * This script copies profile data from an existing wallet-based profile
 * to a persona record.
 *
 * Usage:
 *   npx ts-node scripts/copy-profile-to-persona.ts <source_wallet> <target_persona_username>
 *
 * Example:
 *   npx ts-node scripts/copy-profile-to-persona.ts SP2ABC123... djcoolname
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function copyProfileToPersona(sourceWallet: string, targetPersonaUsername: string) {
  console.log('\n📋 Copy Profile to Persona Script');
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
  console.log(`      - Bio: ${sourceProfile.bio ? sourceProfile.bio.substring(0, 50) + '...' : '(not set)'}`);
  console.log(`      - Avatar: ${sourceProfile.avatar_url ? '✓ Set' : '(not set)'}`);
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
  console.log(`      - Current display name: ${targetPersona.display_name || '(not set)'}`);
  console.log('');

  // 3. Show what will be copied
  console.log('3️⃣ Will copy the following:');
  console.log(`      - display_name: "${sourceProfile.display_name}" → persona`);
  console.log(`      - avatar_url: ${sourceProfile.avatar_url ? '(image URL)' : 'null'} → persona`);
  console.log(`      - bio: "${sourceProfile.bio?.substring(0, 30) || ''}..." → persona`);
  console.log('');

  // 4. Confirm (in non-interactive mode, just proceed)
  console.log('4️⃣ Updating persona...');

  const { data: updated, error: updateError } = await supabase
    .from('personas')
    .update({
      display_name: sourceProfile.display_name,
      avatar_url: sourceProfile.avatar_url,
      bio: sourceProfile.bio,
    })
    .eq('id', targetPersona.id)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Failed to update persona:', updateError.message);
    return;
  }

  console.log('   ✅ Persona updated successfully!');
  console.log('');
  console.log('📊 Result:');
  console.log(`   - Display name: ${updated.display_name}`);
  console.log(`   - Avatar: ${updated.avatar_url ? '✓ Set' : '(not set)'}`);
  console.log(`   - Bio: ${updated.bio ? '✓ Set' : '(not set)'}`);
  console.log('');
  console.log('='.repeat(50));
  console.log('✅ Done! The persona now has the profile data.');
  console.log('');
  console.log('⚠️  Note: Tracks and store items are still tied to the original wallet.');
  console.log('   If you need to transfer track ownership, run a separate script.');
}

// Main
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: npx ts-node scripts/copy-profile-to-persona.ts <source_wallet> <target_persona_username>');
  console.log('');
  console.log('Example:');
  console.log('  npx ts-node scripts/copy-profile-to-persona.ts SP2ABC123XYZ djcoolname');
  process.exit(1);
}

const [sourceWallet, targetPersonaUsername] = args;

copyProfileToPersona(sourceWallet, targetPersonaUsername)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script error:', err);
    process.exit(1);
  });
