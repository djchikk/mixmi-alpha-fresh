import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_CODE = 'mixmi-admin-2024';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/link-stx-to-persona
 *
 * Links an STX wallet address to an existing persona for split matching.
 * ONLY updates the wallet_address field - does not touch anything else.
 *
 * This allows track splits (which reference old STX addresses) to be
 * mapped to personas that have SUI addresses for payments.
 */
export async function POST(request: NextRequest) {
  try {
    const { personaUsername, stxAddress, adminCode } = await request.json();

    // Verify admin code
    if (adminCode !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate inputs
    if (!personaUsername || !stxAddress) {
      return NextResponse.json(
        { error: 'Both personaUsername and stxAddress are required' },
        { status: 400 }
      );
    }

    // Validate STX address format
    if (!stxAddress.startsWith('SP') && !stxAddress.startsWith('SM') && !stxAddress.startsWith('ST')) {
      return NextResponse.json(
        { error: 'Invalid STX address format. Must start with SP, SM, or ST.' },
        { status: 400 }
      );
    }

    // Find the persona
    const { data: persona, error: findError } = await supabaseAdmin
      .from('personas')
      .select('id, username, display_name, wallet_address, sui_address')
      .eq('username', personaUsername)
      .eq('is_active', true)
      .single();

    if (findError || !persona) {
      return NextResponse.json(
        { error: `Persona "${personaUsername}" not found` },
        { status: 404 }
      );
    }

    // Check if this STX address is already linked to another persona
    const { data: existingLink } = await supabaseAdmin
      .from('personas')
      .select('username')
      .eq('wallet_address', stxAddress)
      .eq('is_active', true)
      .neq('id', persona.id)
      .single();

    if (existingLink) {
      return NextResponse.json(
        { error: `This STX address is already linked to persona "${existingLink.username}"` },
        { status: 400 }
      );
    }

    // Store the old value for the response
    const oldWalletAddress = persona.wallet_address;

    // Update ONLY the wallet_address field
    const { error: updateError } = await supabaseAdmin
      .from('personas')
      .update({ wallet_address: stxAddress })
      .eq('id', persona.id);

    if (updateError) {
      console.error('Error updating persona:', updateError);
      return NextResponse.json(
        { error: 'Failed to update persona' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully linked STX wallet to ${personaUsername}`,
      data: {
        personaId: persona.id,
        username: persona.username,
        displayName: persona.display_name,
        oldWalletAddress: oldWalletAddress,
        newWalletAddress: stxAddress,
        suiAddress: persona.sui_address, // Unchanged
      }
    });

  } catch (error) {
    console.error('Error in link-stx-to-persona:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
