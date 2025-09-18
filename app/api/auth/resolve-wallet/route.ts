import { NextRequest, NextResponse } from 'next/server';
import { getWalletFromAuthIdentity } from '@/lib/auth/wallet-mapping';

export async function POST(request: NextRequest) {
  try {
    const { authIdentity } = await request.json();
    
    if (!authIdentity) {
      return NextResponse.json({ 
        success: false, 
        error: 'Auth identity is required' 
      }, { status: 400 });
    }
    
    const walletAddress = await getWalletFromAuthIdentity(authIdentity);
    
    if (!walletAddress) {
      return NextResponse.json({
        success: false,
        error: 'Could not resolve wallet address for this identity'
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      walletAddress
    });
    
  } catch (error) {
    console.error('Wallet resolution error:', error);
    return NextResponse.json({
      success: false,
      error: 'System error during wallet resolution'
    }, { status: 500 });
  }
}