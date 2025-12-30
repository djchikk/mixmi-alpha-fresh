import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateEncryptedKeypair } from '@/lib/sui/keypair-manager';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/admin/generate-persona-wallet
 *
 * Generates a SUI wallet for a specific persona.
 * Requires the account to have a zklogin_salt stored.
 *
 * Body: { personaUsername, adminCode }
 */
export async function POST(request: NextRequest) {
  try {
    const { personaUsername, adminCode } = await request.json();

    // Verify admin access
    if (adminCode !== 'mixmi-admin-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!personaUsername) {
      return NextResponse.json(
        { error: 'Persona username is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the persona
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('id, username, account_id, sui_address')
      .eq('username', personaUsername.toLowerCase())
      .eq('is_active', true)
      .single();

    if (personaError || !persona) {
      return NextResponse.json(
        { error: `Persona @${personaUsername} not found` },
        { status: 404 }
      );
    }

    if (persona.sui_address) {
      return NextResponse.json(
        { error: `Persona @${personaUsername} already has a wallet: ${persona.sui_address}` },
        { status: 400 }
      );
    }

    // Get the account's zklogin_salt
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('zklogin_salt')
      .eq('id', persona.account_id)
      .single();

    let zkloginSalt = account?.zklogin_salt;

    // If no salt in account, try to find it via zklogin_users
    if (!zkloginSalt) {
      // Find the SUI address for this account via user_profiles
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('sui_address')
        .eq('account_id', persona.account_id)
        .not('sui_address', 'is', null)
        .single();

      if (profile?.sui_address) {
        const { data: zkUser } = await supabase
          .from('zklogin_users')
          .select('salt')
          .eq('sui_address', profile.sui_address)
          .single();

        if (zkUser?.salt) {
          zkloginSalt = zkUser.salt;

          // Also store it in the account for future use
          await supabase
            .from('accounts')
            .update({ zklogin_salt: zkUser.salt })
            .eq('id', persona.account_id);
        }
      }
    }

    if (!zkloginSalt) {
      return NextResponse.json(
        { error: `No zkLogin salt found for this account. User must log in via zkLogin first.` },
        { status: 400 }
      );
    }

    // Generate the encrypted keypair
    const encryptedKeypair = generateEncryptedKeypair(zkloginSalt);

    // Update the persona with the wallet
    const { error: updateError } = await supabase
      .from('personas')
      .update({
        sui_address: encryptedKeypair.suiAddress,
        sui_keypair_encrypted: encryptedKeypair.encryptedKey,
        sui_keypair_nonce: encryptedKeypair.nonce,
      })
      .eq('id', persona.id);

    if (updateError) {
      console.error('Error updating persona:', updateError);
      return NextResponse.json(
        { error: 'Failed to update persona with wallet' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Generated wallet for @${personaUsername}`,
      data: {
        personaId: persona.id,
        username: persona.username,
        suiAddress: encryptedKeypair.suiAddress,
      }
    });

  } catch (error) {
    console.error('Error in generate-persona-wallet:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
