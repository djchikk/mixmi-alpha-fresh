import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/personas/claim-tbd?token=xxx
 *
 * Get info about a claim token (what's being claimed)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Find the token
    const { data: claimToken, error: tokenError } = await supabase
      .from('tbd_claim_tokens')
      .select(`
        id,
        token,
        tbd_persona_id,
        created_at,
        expires_at,
        claimed_at,
        claimed_by_persona_id,
        recipient_name
      `)
      .eq('token', token)
      .single();

    if (tokenError || !claimToken) {
      return NextResponse.json(
        { error: 'Invalid or expired claim link' },
        { status: 404 }
      );
    }

    // Check if already claimed
    if (claimToken.claimed_at) {
      return NextResponse.json({
        error: 'This claim link has already been used',
        alreadyClaimed: true,
      }, { status: 400 });
    }

    // Check if expired
    if (new Date(claimToken.expires_at) < new Date()) {
      return NextResponse.json({
        error: 'This claim link has expired',
        expired: true,
      }, { status: 400 });
    }

    // Get TBD persona details
    const { data: tbdPersona, error: personaError } = await supabase
      .from('personas')
      .select('id, username, display_name, sui_address, balance_usdc')
      .eq('id', claimToken.tbd_persona_id)
      .single();

    if (personaError || !tbdPersona) {
      return NextResponse.json(
        { error: 'TBD persona not found' },
        { status: 404 }
      );
    }

    // Count tracks where this wallet appears
    const { count: trackCount } = await supabase
      .from('ip_tracks')
      .select('id', { count: 'exact', head: true })
      .or(`composition_split_1_wallet.eq.${tbdPersona.sui_address},composition_split_2_wallet.eq.${tbdPersona.sui_address},composition_split_3_wallet.eq.${tbdPersona.sui_address},production_split_1_wallet.eq.${tbdPersona.sui_address},production_split_2_wallet.eq.${tbdPersona.sui_address},production_split_3_wallet.eq.${tbdPersona.sui_address}`);

    return NextResponse.json({
      success: true,
      claimInfo: {
        displayName: tbdPersona.display_name,
        username: tbdPersona.username,
        balance: tbdPersona.balance_usdc || 0,
        trackCount: trackCount || 0,
        expiresAt: claimToken.expires_at,
        recipientName: claimToken.recipient_name,
      },
    });

  } catch (error) {
    console.error('Error in claim-tbd GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/personas/claim-tbd
 *
 * Claim a TBD persona's earnings
 * - Updates all track splits to use the claimer's wallet
 * - Transfers balance (marks for transfer)
 * - Archives the TBD persona
 */
export async function POST(request: NextRequest) {
  try {
    const { token, claimingPersonaId, claimingAccountId } = await request.json();

    if (!token || !claimingPersonaId || !claimingAccountId) {
      return NextResponse.json(
        { error: 'token, claimingPersonaId, and claimingAccountId are required' },
        { status: 400 }
      );
    }

    // Find and validate the token
    const { data: claimToken, error: tokenError } = await supabase
      .from('tbd_claim_tokens')
      .select('id, tbd_persona_id, expires_at, claimed_at, created_by_account_id')
      .eq('token', token)
      .single();

    if (tokenError || !claimToken) {
      return NextResponse.json(
        { error: 'Invalid claim token' },
        { status: 404 }
      );
    }

    if (claimToken.claimed_at) {
      return NextResponse.json(
        { error: 'This claim link has already been used' },
        { status: 400 }
      );
    }

    if (new Date(claimToken.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This claim link has expired' },
        { status: 400 }
      );
    }

    // Get TBD persona
    const { data: tbdPersona, error: tbdError } = await supabase
      .from('personas')
      .select('id, username, display_name, sui_address, balance_usdc, account_id')
      .eq('id', claimToken.tbd_persona_id)
      .single();

    if (tbdError || !tbdPersona) {
      return NextResponse.json(
        { error: 'TBD persona not found' },
        { status: 404 }
      );
    }

    // Prevent claiming your own TBD (use "This is Me" instead)
    if (tbdPersona.account_id === claimingAccountId) {
      return NextResponse.json(
        { error: 'You cannot claim your own TBD persona. Use "This is Me" to merge instead.' },
        { status: 400 }
      );
    }

    // Get claiming persona
    const { data: claimingPersona, error: claimingError } = await supabase
      .from('personas')
      .select('id, username, sui_address, account_id')
      .eq('id', claimingPersonaId)
      .eq('account_id', claimingAccountId)
      .eq('is_active', true)
      .single();

    if (claimingError || !claimingPersona) {
      return NextResponse.json(
        { error: 'Claiming persona not found or does not belong to your account' },
        { status: 404 }
      );
    }

    if (!claimingPersona.sui_address) {
      return NextResponse.json(
        { error: 'Your persona does not have a wallet address' },
        { status: 400 }
      );
    }

    const tbdWallet = tbdPersona.sui_address;
    const newWallet = claimingPersona.sui_address;

    // Update all track splits
    // We need to update each split field separately
    const splitFields = [
      'composition_split_1_wallet',
      'composition_split_2_wallet',
      'composition_split_3_wallet',
      'production_split_1_wallet',
      'production_split_2_wallet',
      'production_split_3_wallet',
    ];

    let totalUpdated = 0;

    for (const field of splitFields) {
      const { count } = await supabase
        .from('ip_tracks')
        .update({ [field]: newWallet })
        .eq(field, tbdWallet)
        .select('id', { count: 'exact', head: true });

      totalUpdated += count || 0;
    }

    // Transfer balance record (actual on-chain transfer would be separate)
    const balanceToTransfer = tbdPersona.balance_usdc || 0;

    if (balanceToTransfer > 0) {
      // Add balance to claiming persona
      await supabase
        .from('personas')
        .update({
          balance_usdc: (claimingPersona as any).balance_usdc + balanceToTransfer
        })
        .eq('id', claimingPersonaId);

      // Zero out TBD persona balance
      await supabase
        .from('personas')
        .update({ balance_usdc: 0 })
        .eq('id', tbdPersona.id);

      // Create earnings record for audit trail
      await supabase
        .from('earnings')
        .insert({
          persona_id: claimingPersonaId,
          amount_usdc: balanceToTransfer,
          source_type: 'tbd_claim',
          status: 'paid',
          notes: `Claimed from @${tbdPersona.username}`,
        });
    }

    // Mark token as claimed
    await supabase
      .from('tbd_claim_tokens')
      .update({
        claimed_at: new Date().toISOString(),
        claimed_by_persona_id: claimingPersonaId,
      })
      .eq('id', claimToken.id);

    // Archive (deactivate) the TBD persona
    await supabase
      .from('personas')
      .update({
        is_active: false,
        // Append note to bio
        bio: `[CLAIMED by @${claimingPersona.username} on ${new Date().toLocaleDateString()}]`,
      })
      .eq('id', tbdPersona.id);

    console.log(`Claim successful: @${tbdPersona.username} -> @${claimingPersona.username}`);
    console.log(`Updated ${totalUpdated} track split entries, transferred $${balanceToTransfer}`);

    return NextResponse.json({
      success: true,
      message: `Successfully claimed earnings from @${tbdPersona.username}`,
      details: {
        tbdUsername: tbdPersona.username,
        claimingUsername: claimingPersona.username,
        tracksUpdated: totalUpdated,
        balanceTransferred: balanceToTransfer,
      },
    });

  } catch (error) {
    console.error('Error in claim-tbd POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
