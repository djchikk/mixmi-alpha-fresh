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
    const { walletAddress, signature } = await request.json();
    
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }
    
    // Get JWT secret from environment (server-side only)
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT secret not configured');
      return NextResponse.json({ error: 'JWT secret not configured' }, { status: 500 });
    }
    
    // Convert wallet address to UUID format for Supabase compatibility
    const userUUID = walletToUUID(walletAddress);

    // Note: We're using wallet-based authentication with JWTs only
    // The JWT is passed directly in the Authorization header, so we don't need
    // users to exist in Supabase's auth.users table
    
    // Create JWT token
    const secret = new TextEncoder().encode(jwtSecret);
    
    const token = await new SignJWT({
      sub: userUUID,
      role: 'authenticated',
      wallet_address: walletAddress,
      aud: 'authenticated',
      iss: 'supabase',
      iat: Math.floor(Date.now() / 1000),
    })
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