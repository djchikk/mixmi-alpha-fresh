import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Generate a short, URL-safe claim token
 */
function generateToken(): string {
  // 8 bytes = 16 hex chars, but we'll use base62 for shorter URLs
  const bytes = randomBytes(6);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; // No ambiguous chars
  let token = '';
  for (const byte of bytes) {
    token += chars[byte % chars.length];
  }
  return token;
}

/**
 * POST /api/personas/generate-claim-token
 *
 * Generate an invite link for a TBD collaborator to claim their earnings
 */
export async function POST(request: NextRequest) {
  try {
    const { tbdPersonaId, accountId, recipientName, recipientContact } = await request.json();

    if (!tbdPersonaId || !accountId) {
      return NextResponse.json(
        { error: 'tbdPersonaId and accountId are required' },
        { status: 400 }
      );
    }

    // Verify the TBD persona exists and belongs to this account
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('id, username, display_name, sui_address, balance_usdc, account_id')
      .eq('id', tbdPersonaId)
      .eq('is_active', true)
      .single();

    if (personaError || !persona) {
      return NextResponse.json(
        { error: 'TBD persona not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (persona.account_id !== accountId) {
      return NextResponse.json(
        { error: 'You do not own this persona' },
        { status: 403 }
      );
    }

    // Verify it's actually a TBD persona
    if (!persona.username.includes('-tbd')) {
      return NextResponse.json(
        { error: 'This is not a TBD persona' },
        { status: 400 }
      );
    }

    // Check if there's already an active (unclaimed, unexpired) token for this persona
    const { data: existingToken } = await supabase
      .from('tbd_claim_tokens')
      .select('token, created_at, expires_at')
      .eq('tbd_persona_id', tbdPersonaId)
      .is('claimed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingToken) {
      // Return the existing token
      const claimUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://mixmi.app'}/claim/${existingToken.token}`;
      return NextResponse.json({
        success: true,
        token: existingToken.token,
        claimUrl,
        isExisting: true,
        expiresAt: existingToken.expires_at,
      });
    }

    // Generate a new unique token
    let token = generateToken();
    let attempts = 0;

    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('tbd_claim_tokens')
        .select('token')
        .eq('token', token)
        .maybeSingle();

      if (!existing) break;
      token = generateToken();
      attempts++;
    }

    if (attempts >= 10) {
      return NextResponse.json(
        { error: 'Failed to generate unique token' },
        { status: 500 }
      );
    }

    // Create the token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90); // 90 days

    const { data: newToken, error: createError } = await supabase
      .from('tbd_claim_tokens')
      .insert({
        token,
        tbd_persona_id: tbdPersonaId,
        created_by_account_id: accountId,
        expires_at: expiresAt.toISOString(),
        recipient_name: recipientName || persona.display_name,
        recipient_contact: recipientContact,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating claim token:', createError);
      return NextResponse.json(
        { error: 'Failed to create claim token' },
        { status: 500 }
      );
    }

    const claimUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://mixmi.app'}/claim/${token}`;

    console.log(`Generated claim token for @${persona.username}: ${claimUrl}`);

    return NextResponse.json({
      success: true,
      token,
      claimUrl,
      isExisting: false,
      expiresAt: expiresAt.toISOString(),
      persona: {
        username: persona.username,
        displayName: persona.display_name,
        balance: persona.balance_usdc || 0,
      },
    });

  } catch (error) {
    console.error('Error in generate-claim-token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
