import { NextRequest, NextResponse } from 'next/server';
import {
  buildMintTransaction,
  executeAsAdmin,
  isTingConfigured,
} from '@/lib/sui/ting';

/**
 * POST /api/ting/mint
 *
 * Mint TING tokens to an address
 * Requires admin authorization
 *
 * Body: { recipient: string, amount: number, adminKey?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipient, amount, adminKey } = body;

    // Validate inputs
    if (!recipient || typeof recipient !== 'string') {
      return NextResponse.json(
        { error: 'Recipient address is required' },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    if (!isTingConfigured()) {
      return NextResponse.json(
        { error: 'TING is not configured' },
        { status: 503 }
      );
    }

    // Simple admin key check (in production, use proper auth)
    const expectedAdminKey = process.env.TING_API_ADMIN_KEY;
    if (expectedAdminKey && adminKey !== expectedAdminKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Build and execute mint transaction
    const tx = buildMintTransaction(recipient, amount);
    const result = await executeAsAdmin(tx);

    return NextResponse.json({
      success: true,
      recipient,
      amount,
      amountFormatted: `${amount} TING`,
      transactionDigest: result.digest,
    });
  } catch (error) {
    console.error('Error minting TING:', error);
    return NextResponse.json(
      { error: 'Failed to mint TING', details: String(error) },
      { status: 500 }
    );
  }
}
