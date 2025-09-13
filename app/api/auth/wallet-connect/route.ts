import { NextRequest, NextResponse } from 'next/server';
import { AlphaAuth } from '@/lib/auth/alpha-auth';

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
    
    // Add auth method to distinguish from other auth routes
    return NextResponse.json({
      ...result,
      authMethod: 'wallet_connect'
    });
    
  } catch (error) {
    console.error('Wallet authentication error:', error);
    return NextResponse.json({
      success: false,
      error: 'System error during authentication',
      authMethod: 'wallet_connect'
    }, { status: 500 });
  }
}