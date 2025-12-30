import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { randomBytes } from 'crypto';
import { jwtToAddress } from '@mysten/sui/zklogin';
import { generateEncryptedKeypair } from '@/lib/sui/keypair-manager';

/**
 * Generate wallets for personas that don't have them yet
 */
async function generateWalletsForPersonas(supabase: any, accountId: string, salt: string) {
  try {
    // Get all personas without wallets
    const { data: personas } = await supabase
      .from('personas')
      .select('id, username, sui_address')
      .eq('account_id', accountId)
      .eq('is_active', true);

    if (!personas) return;

    const needWallets = personas.filter((p: any) => !p.sui_address);
    for (const persona of needWallets) {
      try {
        const encryptedKeypair = generateEncryptedKeypair(salt);
        await supabase
          .from('personas')
          .update({
            sui_address: encryptedKeypair.suiAddress,
            sui_keypair_encrypted: encryptedKeypair.encryptedKey,
            sui_keypair_nonce: encryptedKeypair.nonce,
          })
          .eq('id', persona.id);
        console.log(`✅ Generated wallet for persona ${persona.username}:`, encryptedKeypair.suiAddress);
      } catch (e) {
        console.error(`Failed to generate wallet for persona ${persona.username}:`, e);
      }
    }
  } catch (e) {
    console.error('Error generating persona wallets:', e);
  }
}

/**
 * Salt Management API for zkLogin
 *
 * POST - Get or create salt for a Google user
 * - For returning users: retrieves existing salt
 * - For new users: generates random salt, stores with invite code link
 *
 * Request body:
 * - googleSub: Google's unique user ID (from JWT sub claim)
 * - email: User's Google email
 * - inviteCode: Alpha invite code (required for new users)
 * - jwt: Google JWT (for deriving SUI address on first registration)
 */
export async function POST(request: NextRequest) {
  try {
    const { googleSub, email, inviteCode, jwt } = await request.json();

    if (!googleSub) {
      return NextResponse.json(
        { error: 'Google sub (user ID) is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Check if user already exists (returning user)
    const { data: existingUser, error: lookupError } = await supabase
      .from('zklogin_users')
      .select('salt, sui_address, invite_code')
      .eq('google_sub', googleSub)
      .single();

    if (lookupError && lookupError.code !== 'PGRST116') {
      // PGRST116 = not found, which is expected for new users
      console.error('Salt lookup error:', lookupError);
      return NextResponse.json(
        { error: 'Failed to look up user' },
        { status: 500 }
      );
    }

    // Returning user - return existing salt
    if (existingUser) {
      console.log('✅ Returning user found:', email);

      // Ensure account has zklogin_salt (may not if they logged in before this update)
      if (existingUser.invite_code) {
        const { data: alphaData } = await supabase
          .from('alpha_users')
          .select('wallet_address')
          .eq('invite_code', existingUser.invite_code)
          .single();

        if (alphaData?.wallet_address) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('account_id')
            .eq('wallet_address', alphaData.wallet_address)
            .single();

          if (profile?.account_id) {
            // Check if account already has salt
            const { data: account } = await supabase
              .from('accounts')
              .select('zklogin_salt')
              .eq('id', profile.account_id)
              .single();

            if (!account?.zklogin_salt) {
              // Backfill the salt
              await supabase
                .from('accounts')
                .update({
                  zklogin_salt: existingUser.salt,
                  sui_address: existingUser.sui_address
                })
                .eq('id', profile.account_id);
              console.log('✅ Backfilled zklogin_salt for returning user');

              // Also generate wallets for personas that don't have them
              await generateWalletsForPersonas(supabase, profile.account_id, existingUser.salt);
            }
          }
        }
      }

      return NextResponse.json({
        salt: existingUser.salt,
        suiAddress: existingUser.sui_address,
        inviteCode: existingUser.invite_code,
        isNewUser: false,
      });
    }

    // New user - validate invite code
    if (!inviteCode) {
      return NextResponse.json(
        { error: 'Invite code required for new users' },
        { status: 400 }
      );
    }

    if (!jwt) {
      return NextResponse.json(
        { error: 'JWT required for new user registration' },
        { status: 400 }
      );
    }

    // Validate invite code exists and is approved
    const { data: alphaUser, error: alphaError } = await supabase
      .from('alpha_users')
      .select('wallet_address, artist_name, approved')
      .eq('invite_code', inviteCode.toUpperCase())
      .single();

    if (alphaError || !alphaUser) {
      return NextResponse.json(
        { error: 'Invalid invite code' },
        { status: 400 }
      );
    }

    if (!alphaUser.approved) {
      return NextResponse.json(
        { error: 'Invite code not yet approved' },
        { status: 400 }
      );
    }

    // Check if invite code is already used by another zkLogin user
    const { data: existingInvite } = await supabase
      .from('zklogin_users')
      .select('id')
      .eq('invite_code', inviteCode.toUpperCase())
      .single();

    if (existingInvite) {
      return NextResponse.json(
        { error: 'This invite code has already been used for Google sign-in' },
        { status: 400 }
      );
    }

    // Generate new salt (256 bits = 32 bytes)
    // SUI zklogin expects salt as a decimal BigInt string
    const saltBytes = randomBytes(16); // 128 bits is sufficient and safer for BigInt
    const saltBigInt = BigInt('0x' + saltBytes.toString('hex'));
    const salt = saltBigInt.toString(); // Decimal string for storage and jwtToAddress

    // Derive SUI address from JWT and salt
    const suiAddress = jwtToAddress(jwt, salt);
    console.log('🔐 Generated salt (first 20 chars):', salt.substring(0, 20) + '...');
    console.log('🔐 Derived SUI address:', suiAddress);

    // Store new zkLogin user
    const { error: insertError } = await supabase
      .from('zklogin_users')
      .insert({
        google_sub: googleSub,
        email: email || null,
        salt,
        sui_address: suiAddress,
        invite_code: inviteCode.toUpperCase(),
      });

    if (insertError) {
      console.error('Failed to create zklogin user:', insertError);
      return NextResponse.json(
        { error: 'Failed to register user' },
        { status: 500 }
      );
    }

    console.log('✅ New zkLogin user registered:', email, 'SUI:', suiAddress.substring(0, 10) + '...');

    // Also store salt in accounts table for persona wallet encryption
    // Find the account via: invite_code → alpha_users → user_profiles → account_id
    if (alphaUser.wallet_address) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('account_id')
        .eq('wallet_address', alphaUser.wallet_address)
        .single();

      if (profile?.account_id) {
        const { error: updateError } = await supabase
          .from('accounts')
          .update({
            zklogin_salt: salt,
            sui_address: suiAddress  // Also store the SUI address for reference
          })
          .eq('id', profile.account_id);

        if (updateError) {
          console.error('Failed to update account with zklogin_salt:', updateError);
          // Non-fatal - persona wallets can still be generated later
        } else {
          console.log('✅ Stored zklogin_salt in account:', profile.account_id);

          // Also generate wallets for personas that don't have them
          await generateWalletsForPersonas(supabase, profile.account_id, salt);
        }
      }
    }

    return NextResponse.json({
      salt,
      suiAddress,
      inviteCode: inviteCode.toUpperCase(),
      isNewUser: true,
    });

  } catch (error) {
    console.error('Salt API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
