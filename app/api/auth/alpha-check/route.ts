import { NextRequest, NextResponse } from 'next/server';
import { AlphaAuth } from '@/lib/auth/alpha-auth';
import { createClient } from '@supabase/supabase-js';

// Check if invite code already has a zkLogin account
async function checkExistingZkLogin(inviteCode: string): Promise<boolean> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('zklogin_users')
    .select('id')
    .eq('invite_code', inviteCode.toUpperCase())
    .maybeSingle();

  return !!data;
}

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json({
        success: false,
        error: 'Wallet address is required'
      }, { status: 400 });
    }

    const result = await AlphaAuth.authenticateAlphaUser(walletAddress);

    // If it's an invite code and validation succeeded, check for existing zkLogin
    if (result.success && result.authType === 'invite') {
      const hasZkLogin = await checkExistingZkLogin(walletAddress);
      return NextResponse.json({
        ...result,
        hasZkLogin // true = returning user, skip username step
      });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Alpha authentication error:', error);
    return NextResponse.json({
      success: false,
      error: 'System error during authentication'
    }, { status: 500 });
  }
}