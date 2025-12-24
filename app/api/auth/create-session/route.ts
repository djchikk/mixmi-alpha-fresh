import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { createHash } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Convert wallet address to UUID format for Supabase compatibility
 * Uses SHA-256 hash of wallet address to create deterministic UUID
 */
function walletToUUID(walletAddress: string): string {
  const hash = createHash('sha256').update(walletAddress).digest('hex');
  // Format as UUID: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32)
  ].join('-');
}

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, suiAddress, signature } = await request.json();

    // Accept either wallet address (Stacks) or SUI address (zkLogin)
    const address = walletAddress || suiAddress;
    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address or SUI address is required' },
        { status: 400 }
      );
    }

    // Get JWT secret from environment (server-side only)
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT secret not configured');
      return NextResponse.json({ error: 'JWT secret not configured' }, { status: 500 });
    }

    // Convert address to UUID format for Supabase compatibility
    const userUUID = walletToUUID(address);

    // Note: We're using wallet-based authentication with JWTs only
    // The JWT is passed directly in the Authorization header, so we don't need
    // users to exist in Supabase's auth.users table

    // Create JWT token with appropriate claims based on auth type
    const secret = new TextEncoder().encode(jwtSecret);

    const claims: Record<string, unknown> = {
      sub: userUUID,
      role: 'authenticated',
      aud: 'authenticated',
      iss: 'supabase',
      iat: Math.floor(Date.now() / 1000),
    };

    // Add the appropriate address claim
    if (suiAddress) {
      claims.sui_address = suiAddress;
    }
    if (walletAddress) {
      claims.wallet_address = walletAddress;
    }

    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setExpirationTime('24h')
      .setIssuedAt()
      .sign(secret);

    return NextResponse.json({
      token,
      expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    });

  } catch (error) {
    console.error('JWT creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
