import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSuiClient, getUsdcBalance, getSuiBalance } from '@/lib/sui/client';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/personas/balances?accountId=xxx
 *
 * Fetches on-chain USDC and SUI balances for all personas under an account.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      );
    }

    // Fetch all personas for this account that have wallets
    const { data: personas, error: personasError } = await supabaseAdmin
      .from('personas')
      .select('id, username, display_name, sui_address')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .not('sui_address', 'is', null);

    if (personasError) {
      console.error('[Balances] Error fetching personas:', personasError);
      return NextResponse.json(
        { error: 'Failed to fetch personas' },
        { status: 500 }
      );
    }

    if (!personas || personas.length === 0) {
      return NextResponse.json({
        success: true,
        balances: []
      });
    }

    // Fetch balances for each persona in parallel
    const balancePromises = personas.map(async (persona) => {
      try {
        const [usdcBalance, suiBalance] = await Promise.all([
          getUsdcBalance(persona.sui_address!),
          getSuiBalance(persona.sui_address!),
        ]);

        return {
          personaId: persona.id,
          username: persona.username,
          displayName: persona.display_name,
          suiAddress: persona.sui_address,
          balances: {
            usdc: usdcBalance,
            sui: suiBalance,
          }
        };
      } catch (error) {
        console.error(`[Balances] Error fetching balance for ${persona.username}:`, error);
        return {
          personaId: persona.id,
          username: persona.username,
          displayName: persona.display_name,
          suiAddress: persona.sui_address,
          balances: {
            usdc: 0,
            sui: 0,
          },
          error: 'Failed to fetch balance'
        };
      }
    });

    const balances = await Promise.all(balancePromises);

    return NextResponse.json({
      success: true,
      balances
    });

  } catch (error) {
    console.error('[Balances] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
