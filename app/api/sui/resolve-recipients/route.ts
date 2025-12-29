/**
 * API Route: Resolve SUI Addresses for Payment Recipients
 *
 * POST /api/sui/resolve-recipients
 *
 * Takes track IDs and returns payment split information with SUI addresses
 * where available. Recipients without SUI addresses will be marked for
 * treasury holding.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Split {
  wallet: string | null;
  name: string | null;
  percentage: number;
  suiAddress: string | null;
  personaId: string | null;
  status: 'direct' | 'treasury';
}

interface TrackSplits {
  trackId: string;
  title: string;
  uploaderAccountId: string | null;
  uploaderSuiAddress: string | null;
  compositionSplits: Split[];
  productionSplits: Split[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackIds } = body as { trackIds: string[] };

    if (!trackIds || trackIds.length === 0) {
      return NextResponse.json(
        { error: 'No track IDs provided' },
        { status: 400 }
      );
    }

    const results: TrackSplits[] = [];

    for (const trackId of trackIds) {
      // Get track details with all splits (including new SUI address columns)
      const { data: track, error: trackError } = await supabase
        .from('ip_tracks')
        .select(`
          id,
          title,
          primary_uploader_wallet,
          persona_id,
          composition_split_1_wallet, composition_split_1_sui_address, composition_split_1_percentage,
          composition_split_2_wallet, composition_split_2_sui_address, composition_split_2_percentage,
          composition_split_3_wallet, composition_split_3_sui_address, composition_split_3_percentage,
          composition_split_4_wallet, composition_split_4_sui_address, composition_split_4_percentage,
          composition_split_5_wallet, composition_split_5_sui_address, composition_split_5_percentage,
          composition_split_6_wallet, composition_split_6_sui_address, composition_split_6_percentage,
          composition_split_7_wallet, composition_split_7_sui_address, composition_split_7_percentage,
          production_split_1_wallet, production_split_1_sui_address, production_split_1_percentage,
          production_split_2_wallet, production_split_2_sui_address, production_split_2_percentage,
          production_split_3_wallet, production_split_3_sui_address, production_split_3_percentage,
          production_split_4_wallet, production_split_4_sui_address, production_split_4_percentage,
          production_split_5_wallet, production_split_5_sui_address, production_split_5_percentage,
          production_split_6_wallet, production_split_6_sui_address, production_split_6_percentage,
          production_split_7_wallet, production_split_7_sui_address, production_split_7_percentage
        `)
        .eq('id', trackId)
        .single();

      if (trackError || !track) {
        console.error(`Track not found: ${trackId}`, trackError);
        continue;
      }

      // Get uploader's account and SUI address
      let uploaderAccountId: string | null = null;
      let uploaderSuiAddress: string | null = null;

      if (track.persona_id) {
        const { data: persona } = await supabase
          .from('personas')
          .select('account_id')
          .eq('id', track.persona_id)
          .single();

        if (persona) {
          uploaderAccountId = persona.account_id;

          const { data: account } = await supabase
            .from('accounts')
            .select('sui_address')
            .eq('id', persona.account_id)
            .single();

          uploaderSuiAddress = account?.sui_address || null;
        }
      } else if (track.primary_uploader_wallet) {
        // Try to find account via user_profiles
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('account_id')
          .eq('wallet_address', track.primary_uploader_wallet)
          .single();

        if (profile?.account_id) {
          uploaderAccountId = profile.account_id;

          const { data: account } = await supabase
            .from('accounts')
            .select('sui_address')
            .eq('id', profile.account_id)
            .single();

          uploaderSuiAddress = account?.sui_address || null;
        }
      }

      // Process composition splits
      const compositionSplits: Split[] = [];
      for (let i = 1; i <= 7; i++) {
        const wallet = track[`composition_split_${i}_wallet` as keyof typeof track] as string | null;
        const suiAddressColumn = track[`composition_split_${i}_sui_address` as keyof typeof track] as string | null;
        const percentage = track[`composition_split_${i}_percentage` as keyof typeof track] as number | null;

        if (percentage && percentage > 0) {
          // Extract name from "pending:Name" format if applicable
          const isPending = wallet?.startsWith('pending:');
          const name = isPending ? wallet.substring(8) : null;
          const actualWallet = isPending ? null : wallet;

          // Check for SUI address: column first, then lookup from wallet
          const resolved = suiAddressColumn
            ? { suiAddress: suiAddressColumn, personaId: null }
            : await resolveSuiAddress(actualWallet);

          compositionSplits.push({
            wallet: actualWallet,
            name,
            percentage,
            suiAddress: resolved.suiAddress,
            personaId: resolved.personaId,
            status: resolved.suiAddress ? 'direct' : 'treasury',
          });
        }
      }

      // Process production splits
      const productionSplits: Split[] = [];
      for (let i = 1; i <= 7; i++) {
        const wallet = track[`production_split_${i}_wallet` as keyof typeof track] as string | null;
        const suiAddressColumn = track[`production_split_${i}_sui_address` as keyof typeof track] as string | null;
        const percentage = track[`production_split_${i}_percentage` as keyof typeof track] as number | null;

        if (percentage && percentage > 0) {
          // Extract name from "pending:Name" format if applicable
          const isPending = wallet?.startsWith('pending:');
          const name = isPending ? wallet.substring(8) : null;
          const actualWallet = isPending ? null : wallet;

          // Check for SUI address: column first, then lookup from wallet
          const resolved = suiAddressColumn
            ? { suiAddress: suiAddressColumn, personaId: null }
            : await resolveSuiAddress(actualWallet);

          productionSplits.push({
            wallet: actualWallet,
            name,
            percentage,
            suiAddress: resolved.suiAddress,
            personaId: resolved.personaId,
            status: resolved.suiAddress ? 'direct' : 'treasury',
          });
        }
      }

      results.push({
        trackId: track.id,
        title: track.title,
        uploaderAccountId,
        uploaderSuiAddress,
        compositionSplits,
        productionSplits,
      });
    }

    return NextResponse.json({ tracks: results });

  } catch (error) {
    console.error('Resolve recipients error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Resolution failed' },
      { status: 500 }
    );
  }
}

/**
 * Look up SUI address for a wallet address
 */
async function resolveSuiAddress(wallet: string | null): Promise<{
  suiAddress: string | null;
  personaId: string | null;
}> {
  if (!wallet) {
    return { suiAddress: null, personaId: null };
  }

  // If it's already a SUI address, use it directly
  if (wallet.startsWith('0x') && wallet.length === 66) {
    return { suiAddress: wallet, personaId: null };
  }

  // Try to find persona with this wallet address
  const { data: persona } = await supabase
    .from('personas')
    .select('id, account_id, payout_address')
    .eq('wallet_address', wallet)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (persona) {
    // Check if persona has a payout address (SUI)
    if (persona.payout_address?.startsWith('0x')) {
      return { suiAddress: persona.payout_address, personaId: persona.id };
    }

    // Try to get SUI address from account
    const { data: account } = await supabase
      .from('accounts')
      .select('sui_address')
      .eq('id', persona.account_id)
      .single();

    if (account?.sui_address) {
      return { suiAddress: account.sui_address, personaId: persona.id };
    }
  }

  // Try user_profiles -> accounts path
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('account_id')
    .eq('wallet_address', wallet)
    .single();

  if (profile?.account_id) {
    const { data: account } = await supabase
      .from('accounts')
      .select('sui_address')
      .eq('id', profile.account_id)
      .single();

    if (account?.sui_address) {
      return { suiAddress: account.sui_address, personaId: null };
    }
  }

  // No SUI address found
  return { suiAddress: null, personaId: null };
}
