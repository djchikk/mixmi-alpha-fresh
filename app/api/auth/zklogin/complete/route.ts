import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { createHash } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import { jwtToAddress } from '@mysten/sui/zklogin';

/**
 * Convert SUI address to UUID format for Supabase compatibility
 * Uses SHA-256 hash of address to create deterministic UUID
 */
function addressToUUID(address: string): string {
  const hash = createHash('sha256').update(address).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32)
  ].join('-');
}

/**
 * Complete zkLogin Authentication
 *
 * POST - Complete the zkLogin flow and issue a Supabase JWT
 *
 * Request body:
 * - suiAddress: The user's derived SUI address
 * - googleEmail: User's Google email (for display)
 * - inviteCode: The alpha invite code used
 *
 * Returns:
 * - token: Supabase JWT with sui_address claim
 * - expires_at: Token expiration timestamp
 */
export async function POST(request: NextRequest) {
  try {
    const { suiAddress, googleEmail, inviteCode } = await request.json();

    if (!suiAddress) {
      return NextResponse.json(
        { error: 'SUI address is required' },
        { status: 400 }
      );
    }

    if (!inviteCode) {
      return NextResponse.json(
        { error: 'Invite code is required' },
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

    // Verify the zkLogin user exists with this SUI address
    const { data: zkUser, error: zkError } = await supabase
      .from('zklogin_users')
      .select('id, sui_address, invite_code, email')
      .eq('sui_address', suiAddress)
      .single();

    if (zkError || !zkUser) {
      console.error('zkLogin user not found:', zkError);
      return NextResponse.json(
        { error: 'User not found. Please complete the sign-in flow.' },
        { status: 400 }
      );
    }

    // Get the alpha user's wallet address (for profile linking)
    const { data: alphaUser } = await supabase
      .from('alpha_users')
      .select('wallet_address, artist_name')
      .eq('invite_code', inviteCode.toUpperCase())
      .single();

    // Ensure user_profiles has sui_address
    if (alphaUser?.wallet_address) {
      // Update existing profile with sui_address
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ sui_address: suiAddress })
        .eq('wallet_address', alphaUser.wallet_address);

      if (updateError) {
        console.log('Profile update note:', updateError.message);
        // Not critical - profile might not exist yet
      }
    }

    // Get JWT secret
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT secret not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Generate UUID from SUI address
    const userUUID = addressToUUID(suiAddress);

    // Create JWT token with sui_address claim
    const secret = new TextEncoder().encode(jwtSecret);

    const token = await new SignJWT({
      sub: userUUID,
      role: 'authenticated',
      sui_address: suiAddress,
      // Also include wallet_address if linked (for backward compatibility)
      wallet_address: alphaUser?.wallet_address || null,
      email: googleEmail || zkUser.email,
      aud: 'authenticated',
      iss: 'supabase',
      iat: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setExpirationTime('24h')
      .setIssuedAt()
      .sign(secret);

    console.log('✅ zkLogin session created for:', suiAddress.substring(0, 10) + '...');

    return NextResponse.json({
      token,
      expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
      suiAddress,
      walletAddress: alphaUser?.wallet_address || null,
      displayName: alphaUser?.artist_name || googleEmail?.split('@')[0] || 'User',
    });

  } catch (error) {
    console.error('zkLogin complete error:', error);
    return NextResponse.json(
      { error: 'Failed to complete authentication' },
      { status: 500 }
    );
  }
}
