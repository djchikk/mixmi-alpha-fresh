import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateEncryptedKeypair } from '@/lib/sui/keypair-manager';

// Use service role for updating personas
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/personas/generate-wallets
 *
 * Generates SUI wallets for all personas under an account that don't have one yet.
 * Called after user logs in via zkLogin to ensure all personas have wallets.
 *
 * Request body:
 * - accountId: UUID of the account
 * - salt: The user's zkLogin salt (from session)
 */
export async function POST(request: NextRequest) {
  try {
    const { accountId, salt } = await request.json();

    if (!accountId || !salt) {
      return NextResponse.json(
        { error: 'Missing accountId or salt' },
        { status: 400 }
      );
    }

    console.log('[Generate Wallets] Processing account:', accountId);

    // Get all personas for this account that don't have wallets yet
    const { data: personas, error: fetchError } = await supabaseAdmin
      .from('personas')
      .select('id, username, sui_address')
      .eq('account_id', accountId)
      .eq('is_active', true);

    if (fetchError) {
      console.error('[Generate Wallets] Error fetching personas:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch personas' },
        { status: 500 }
      );
    }

    if (!personas || personas.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No personas found',
        generated: 0
      });
    }

    // Generate wallets for personas without them
    const personasNeedingWallets = personas.filter(p => !p.sui_address);
    let generatedCount = 0;

    for (const persona of personasNeedingWallets) {
      try {
        const encryptedKeypair = generateEncryptedKeypair(salt);

        const { error: updateError } = await supabaseAdmin
          .from('personas')
          .update({
            sui_address: encryptedKeypair.suiAddress,
            sui_keypair_encrypted: encryptedKeypair.encryptedKey,
            sui_keypair_nonce: encryptedKeypair.nonce,
          })
          .eq('id', persona.id);

        if (updateError) {
          console.error(`[Generate Wallets] Failed to update persona ${persona.username}:`, updateError);
        } else {
          console.log(`[Generate Wallets] Generated wallet for ${persona.username}:`, encryptedKeypair.suiAddress);
          generatedCount++;
        }
      } catch (genError) {
        console.error(`[Generate Wallets] Failed to generate keypair for ${persona.username}:`, genError);
      }
    }

    // Also ensure the account has the salt stored
    await supabaseAdmin
      .from('accounts')
      .update({ zklogin_salt: salt })
      .eq('id', accountId);

    return NextResponse.json({
      success: true,
      message: `Generated ${generatedCount} wallet(s)`,
      generated: generatedCount,
      total: personas.length
    });

  } catch (error) {
    console.error('[Generate Wallets] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
