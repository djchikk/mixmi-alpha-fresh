import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { randomBytes } from 'crypto';
import { jwtToAddress } from '@mysten/sui/zklogin';

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
