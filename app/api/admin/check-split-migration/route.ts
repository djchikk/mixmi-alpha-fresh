import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/check-split-migration
 *
 * Analyzes track splits to see which STX addresses can be mapped to SUI addresses.
 * Returns a report of:
 * - Unique wallet addresses used in splits
 * - Which ones have corresponding personas with SUI addresses
 * - Which tracks would benefit from migration
 */
export async function GET(request: NextRequest) {
  try {
    // Get all tracks with splits
    const { data: tracks, error: tracksError } = await supabaseAdmin
      .from('ip_tracks')
      .select(`
        id,
        title,
        artist,
        composition_split_1_wallet,
        composition_split_2_wallet,
        composition_split_3_wallet,
        production_split_1_wallet,
        production_split_2_wallet,
        production_split_3_wallet
      `)
      .or('composition_split_2_wallet.neq.,production_split_2_wallet.neq.')
      .eq('is_deleted', false);

    if (tracksError) {
      console.error('Error fetching tracks:', tracksError);
      return NextResponse.json({ error: 'Failed to fetch tracks' }, { status: 500 });
    }

    // Collect all unique wallet addresses from splits
    const walletAddresses = new Set<string>();

    for (const track of tracks || []) {
      const wallets = [
        track.composition_split_1_wallet,
        track.composition_split_2_wallet,
        track.composition_split_3_wallet,
        track.production_split_1_wallet,
        track.production_split_2_wallet,
        track.production_split_3_wallet,
      ].filter(w => w && w.trim() !== '');

      wallets.forEach(w => walletAddresses.add(w));
    }

    // Get all personas with their wallet_address and sui_address
    const { data: personas, error: personasError } = await supabaseAdmin
      .from('personas')
      .select('id, username, display_name, wallet_address, sui_address')
      .eq('is_active', true);

    if (personasError) {
      console.error('Error fetching personas:', personasError);
      return NextResponse.json({ error: 'Failed to fetch personas' }, { status: 500 });
    }

    // Create mapping of STX wallet -> persona info
    const walletToPersona = new Map<string, {
      personaId: string;
      username: string;
      displayName: string | null;
      suiAddress: string | null;
    }>();

    for (const persona of personas || []) {
      if (persona.wallet_address) {
        walletToPersona.set(persona.wallet_address, {
          personaId: persona.id,
          username: persona.username,
          displayName: persona.display_name,
          suiAddress: persona.sui_address,
        });
      }
    }

    // Analyze each wallet address
    const walletAnalysis = Array.from(walletAddresses).map(wallet => {
      const persona = walletToPersona.get(wallet);
      return {
        stxAddress: wallet,
        hasPersona: !!persona,
        persona: persona || null,
        hasSuiAddress: !!persona?.suiAddress,
        canMigrate: !!persona?.suiAddress,
      };
    });

    // Analyze tracks
    const trackAnalysis = (tracks || []).map(track => {
      const splitWallets = [
        track.composition_split_2_wallet,
        track.composition_split_3_wallet,
        track.production_split_2_wallet,
        track.production_split_3_wallet,
      ].filter(w => w && w.trim() !== '');

      const mappableCount = splitWallets.filter(w => walletToPersona.get(w)?.suiAddress).length;

      return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        collaboratorCount: splitWallets.length,
        mappableToSui: mappableCount,
        fullyMappable: mappableCount === splitWallets.length && splitWallets.length > 0,
      };
    });

    // Summary stats
    const summary = {
      totalUniqueWallets: walletAddresses.size,
      walletsWithPersonas: walletAnalysis.filter(w => w.hasPersona).length,
      walletsWithSuiAddresses: walletAnalysis.filter(w => w.hasSuiAddress).length,
      tracksWithCollaborators: trackAnalysis.filter(t => t.collaboratorCount > 0).length,
      tracksFullyMappable: trackAnalysis.filter(t => t.fullyMappable).length,
    };

    return NextResponse.json({
      success: true,
      summary,
      wallets: walletAnalysis,
      tracks: trackAnalysis.filter(t => t.collaboratorCount > 0),
    });

  } catch (error) {
    console.error('Error in split migration check:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
