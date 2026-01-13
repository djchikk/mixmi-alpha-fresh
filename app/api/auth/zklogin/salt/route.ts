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
    const { googleSub, email, inviteCode, chosenUsername, jwt } = await request.json();

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

    // Create account and persona for zkLogin user
    // NOTE: We always create a fresh account for zkLogin users, even if alpha_users has a wallet_address.
    // The wallet_address in alpha_users is legacy data from Stacks wallet registrations and should not
    // be used to link zkLogin users to existing accounts (that was causing cross-account contamination bugs).
    console.log('🔧 Creating account/persona for zkLogin user...');

      // 1. Create the account
      const { data: newAccount, error: accountError } = await supabase
        .from('accounts')
        .insert({
          sui_address: suiAddress,
          zklogin_salt: salt,
          account_type: 'human'
        })
        .select('id')
        .single();

      if (accountError || !newAccount) {
        console.error('Failed to create account for zkLogin user:', accountError);
      } else {
        console.log('✅ Created account for zkLogin user:', newAccount.id);

        // 2. Create default persona - use chosen username if provided, otherwise generate from email
        let finalUsername: string;

        if (chosenUsername && chosenUsername.length >= 3) {
          // User chose their username during signup - use it directly
          // (availability was already checked in SignInModal)
          finalUsername = chosenUsername.toLowerCase();
          console.log('✅ Using user-chosen username:', finalUsername);
        } else {
          // Fallback: generate from email
          const emailUsername = (email || 'user').split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
          const personaUsername = emailUsername || 'user_' + suiAddress.slice(2, 10).toLowerCase();

          // Check if username already exists
          const { data: existingPersona } = await supabase
            .from('personas')
            .select('username')
            .eq('username', personaUsername)
            .maybeSingle();

          finalUsername = existingPersona
            ? personaUsername + '_' + Math.random().toString(36).slice(2, 6)
            : personaUsername;
        }

        const { data: newPersona, error: personaError } = await supabase
          .from('personas')
          .insert({
            account_id: newAccount.id,
            username: finalUsername,
            display_name: alphaUser.artist_name || email?.split('@')[0] || finalUsername,
            wallet_address: suiAddress, // Use login SUI address as wallet_address for lookups
            is_default: true,
            is_active: true
          })
          .select('id')
          .single();

        if (personaError) {
          console.error('Failed to create persona for zkLogin user:', personaError);
        } else {
          console.log('✅ Created persona for zkLogin user:', finalUsername);

          // Generate wallet for the new persona
          try {
            const encryptedKeypair = generateEncryptedKeypair(salt);
            await supabase
              .from('personas')
              .update({
                sui_address: encryptedKeypair.suiAddress,
                sui_keypair_encrypted: encryptedKeypair.encryptedKey,
                sui_keypair_nonce: encryptedKeypair.nonce,
              })
              .eq('id', newPersona.id);
            console.log('✅ Generated wallet for zkLogin persona:', encryptedKeypair.suiAddress);
          } catch (e) {
            console.error('Failed to generate zkLogin persona wallet:', e);
          }
        }

        // 3. Create user_profiles entry for zkLogin user
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            wallet_address: suiAddress, // Use SUI address as the "wallet" identifier
            sui_address: suiAddress,
            account_id: newAccount.id,
            username: finalUsername,
            display_name: alphaUser.artist_name || email?.split('@')[0] || finalUsername
          });

        if (profileError) {
          // Might already exist, try update instead
          await supabase
            .from('user_profiles')
            .update({
              account_id: newAccount.id,
              sui_address: suiAddress
            })
            .eq('sui_address', suiAddress);
        }
        console.log('✅ Created/updated user_profiles for zkLogin user');
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
