import { NextRequest, NextResponse } from 'next/server';
import { getTingBalance, getTingCoins, isTingConfigured } from '@/lib/sui/ting';

/**
 * GET /api/ting/balance?address=0x...
 *
 * Get TING balance for an address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    if (!isTingConfigured()) {
      return NextResponse.json(
        { error: 'TING is not configured' },
        { status: 503 }
      );
    }

    const balance = await getTingBalance(address);
    const coins = await getTingCoins(address);

    return NextResponse.json({
      address,
      balance,
      balanceFormatted: `${balance} TING`,
      coins,
    });
  } catch (error) {
    console.error('Error getting TING balance:', error);
    return NextResponse.json(
      { error: 'Failed to get balance' },
      { status: 500 }
    );
  }
}
