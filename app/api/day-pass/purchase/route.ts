/**
 * API Route: Purchase Day Pass
 *
 * POST /api/day-pass/purchase
 *
 * Creates a pending day pass and returns transaction data for payment.
 * After payment confirmation, the pass is activated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DAY_PASS_PRICE_USDC, DAY_PASS_DURATION_HOURS } from '@/lib/dayPass';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Platform wallet receives day pass payments
// Falls back to deriving from sponsor key if not explicitly set
function getPlatformWallet(): string {
  // First try explicit env var
  if (process.env.NEXT_PUBLIC_PLATFORM_SUI_ADDRESS) {
    return process.env.NEXT_PUBLIC_PLATFORM_SUI_ADDRESS;
  }

  // Fall back to deriving from sponsor private key (hex encoded)
  const sponsorKey = process.env.SUI_SPONSOR_PRIVATE_KEY;
  if (sponsorKey) {
    try {
      const keypair = Ed25519Keypair.fromSecretKey(
        Buffer.from(sponsorKey, 'hex')
      );
      return keypair.toSuiAddress();
    } catch (e) {
      console.error('Failed to derive platform wallet from sponsor key:', e);
    }
  }

  throw new Error('Platform wallet not configured');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress } = body;

    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress is required' },
        { status: 400 }
      );
    }

    // Check if user already has an active pass
    const { data: existingPass } = await supabase
      .from('day_passes')
      .select('id, expires_at')
      .eq('user_address', userAddress)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingPass) {
      return NextResponse.json(
        {
          error: 'You already have an active day pass',
          expiresAt: existingPass.expires_at,
        },
        { status: 400 }
      );
    }

    // Calculate expiry time (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + DAY_PASS_DURATION_HOURS);

    // Create the day pass record (pending until payment confirmed)
    const { data: dayPass, error: createError } = await supabase
      .from('day_passes')
      .insert({
        user_address: userAddress,
        expires_at: expiresAt.toISOString(),
        amount_usdc: DAY_PASS_PRICE_USDC,
        status: 'pending', // Will be set to 'active' after payment
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating day pass:', createError);
      return NextResponse.json(
        { error: 'Failed to create day pass' },
        { status: 500 }
      );
    }

    console.log(`🎫 [DayPass] Created pending pass: ${dayPass.id} for ${userAddress}`);

    // Get platform wallet (day pass payments go to platform treasury)
    let platformWallet: string;
    try {
      platformWallet = getPlatformWallet();
      console.log(`🎫 [DayPass] Platform wallet: ${platformWallet}`);
    } catch (e) {
      console.error('Platform wallet error:', e);
      return NextResponse.json(
        { error: 'Payment system not configured' },
        { status: 500 }
      );
    }

    // Return the day pass info - client will handle payment flow
    // Payment goes to platform wallet, uses same SUI/USDC flow as track purchases
    return NextResponse.json({
      success: true,
      dayPassId: dayPass.id,
      expiresAt: dayPass.expires_at,
      amountUsdc: DAY_PASS_PRICE_USDC,
      recipientAddress: platformWallet,
      // Client should use CartContext's SUI payment flow with this info
    });

  } catch (error) {
    console.error('Purchase day pass error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate day pass purchase' },
      { status: 500 }
    );
  }
}

/**
 * Confirm day pass payment (called after successful SUI transaction)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { dayPassId, txHash } = body;

    if (!dayPassId || !txHash) {
      return NextResponse.json(
        { error: 'dayPassId and txHash are required' },
        { status: 400 }
      );
    }

    // Update the day pass to active
    const { data: dayPass, error: updateError } = await supabase
      .from('day_passes')
      .update({
        status: 'active',
        tx_hash: txHash,
      })
      .eq('id', dayPassId)
      .eq('status', 'pending')
      .select()
      .single();

    if (updateError || !dayPass) {
      console.error('Error activating day pass:', updateError);
      return NextResponse.json(
        { error: 'Failed to activate day pass' },
        { status: 500 }
      );
    }

    console.log(`🎫 [DayPass] Activated pass: ${dayPass.id}, tx: ${txHash}`);

    return NextResponse.json({
      success: true,
      dayPassId: dayPass.id,
      expiresAt: dayPass.expires_at,
      status: 'active',
    });

  } catch (error) {
    console.error('Confirm day pass error:', error);
    return NextResponse.json(
      { error: 'Failed to confirm day pass purchase' },
      { status: 500 }
    );
  }
}
