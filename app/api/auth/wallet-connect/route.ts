import { NextRequest, NextResponse } from 'next/server';
import { AlphaAuth } from '@/lib/auth/alpha-auth';

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, walletType } = await request.json();
    
    if (!walletAddress) {
      return NextResponse.json({ 
        success: false, 
        error: 'Wallet address is required' 
      }, { status: 400 });
    }
    
    // Validate wallet address format (basic Stacks address validation)
    if (!walletAddress.startsWith('SP') && !walletAddress.startsWith('ST')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid Stacks wallet address format' 
      }, { status: 400 });
    }
    
    // Use the same alpha authentication logic as the paste method
    const result = await AlphaAuth.authenticateAlphaUser(walletAddress);
    
    // Add wallet-specific metadata if authentication succeeds
    if (result.success) {
      return NextResponse.json({
        ...result,
        authMethod: 'wallet_connect',
        walletType: walletType || 'unknown'
      });
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Wallet connect authentication error:', error);
    return NextResponse.json({
      success: false,
      error: 'System error during wallet authentication'
    }, { status: 500 });
  }
}