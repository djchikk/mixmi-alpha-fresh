import { NextRequest, NextResponse } from 'next/server';
import BNSResolver from '@/lib/bnsResolver';

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Fetch the primary BNS name for this wallet
    const bnsName = await BNSResolver.getPrimaryBNSName(walletAddress);

    if (bnsName) {
      return NextResponse.json({
        found: true,
        bnsName,
        message: `Found BNS name: ${bnsName}`
      });
    } else {
      return NextResponse.json({
        found: false,
        message: 'No BNS name found for this wallet'
      });
    }
  } catch (error) {
    console.error('Error checking BNS:', error);
    return NextResponse.json(
      { error: 'Failed to check BNS name' },
      { status: 500 }
    );
  }
}