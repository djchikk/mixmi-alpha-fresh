/**
 * API Route: Sponsor a SUI Transaction
 *
 * POST /api/sui/sponsor
 *
 * Takes transaction kind bytes and adds gas sponsorship from the platform wallet.
 * Returns the full transaction bytes and sponsor signature.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sponsorTransaction, getCurrentNetwork } from '@/lib/sui';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kindBytes, senderAddress } = body;

    // Validate inputs
    if (!kindBytes) {
      return NextResponse.json(
        { error: 'Missing kindBytes' },
        { status: 400 }
      );
    }

    if (!senderAddress) {
      return NextResponse.json(
        { error: 'Missing senderAddress' },
        { status: 400 }
      );
    }

    // Get sponsor private key from environment
    const sponsorPrivateKey = process.env.SUI_SPONSOR_PRIVATE_KEY;
    if (!sponsorPrivateKey) {
      console.error('SUI_SPONSOR_PRIVATE_KEY not configured');
      return NextResponse.json(
        { error: 'Payment system not configured' },
        { status: 500 }
      );
    }

    const network = getCurrentNetwork();

    // Decode kindBytes from base64
    const kindBytesBuffer = Buffer.from(kindBytes, 'base64');

    // Add sponsorship
    const { txBytes, sponsorSignature } = await sponsorTransaction(
      new Uint8Array(kindBytesBuffer),
      senderAddress,
      sponsorPrivateKey,
      network
    );

    return NextResponse.json({
      txBytes: Buffer.from(txBytes).toString('base64'),
      sponsorSignature,
      network,
    });

  } catch (error) {
    console.error('Sponsor error:', error);

    const message = error instanceof Error ? error.message : 'Sponsorship failed';

    // Return user-friendly error
    if (message.includes('no SUI for gas')) {
      return NextResponse.json(
        { error: 'Payment system temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
