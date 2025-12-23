import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API endpoint to calculate payment splits for music purchases
 *
 * Takes track IDs from cart and returns formatted splits for smart contract
 * Handles both composition (idea) and production (sound recording) rights
 *
 * GET /api/calculate-payment-splits?trackId=abc123
 */

interface PaymentSplit {
  wallet: string;
  percentage: number;
}

interface TrackPaymentData {
  trackId: string;
  title: string;
  artist: string;
  totalPriceMicroSTX: number;
  compositionSplits: PaymentSplit[];
  productionSplits: PaymentSplit[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('trackId');

    if (!trackId) {
      return NextResponse.json(
        { error: 'trackId parameter is required' },
        { status: 400 }
      );
    }

    // Remove location suffix if present (e.g., "abc123-loc-0" -> "abc123")
    const baseTrackId = trackId.split('-loc-')[0];

    // Fetch track data from database
    const { data: track, error } = await supabase
      .from('ip_tracks')
      .select(`
        id,
        title,
        artist,
        price_stx,
        composition_split_1_wallet,
        composition_split_1_percentage,
        composition_split_2_wallet,
        composition_split_2_percentage,
        composition_split_3_wallet,
        composition_split_3_percentage,
        production_split_1_wallet,
        production_split_1_percentage,
        production_split_2_wallet,
        production_split_2_percentage,
        production_split_3_wallet,
        production_split_3_percentage
      `)
      .eq('id', baseTrackId)
      .single();

    if (error || !track) {
      console.error('Error fetching track splits:', error);
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }

    // Build composition splits (up to 3 contributors)
    const compositionSplits: PaymentSplit[] = [];

    if (track.composition_split_1_wallet && track.composition_split_1_percentage) {
      compositionSplits.push({
        wallet: track.composition_split_1_wallet,
        percentage: track.composition_split_1_percentage
      });
    }

    if (track.composition_split_2_wallet && track.composition_split_2_percentage) {
      compositionSplits.push({
        wallet: track.composition_split_2_wallet,
        percentage: track.composition_split_2_percentage
      });
    }

    if (track.composition_split_3_wallet && track.composition_split_3_percentage) {
      compositionSplits.push({
        wallet: track.composition_split_3_wallet,
        percentage: track.composition_split_3_percentage
      });
    }

    // Build production splits (up to 3 contributors)
    const productionSplits: PaymentSplit[] = [];

    if (track.production_split_1_wallet && track.production_split_1_percentage) {
      productionSplits.push({
        wallet: track.production_split_1_wallet,
        percentage: track.production_split_1_percentage
      });
    }

    if (track.production_split_2_wallet && track.production_split_2_percentage) {
      productionSplits.push({
        wallet: track.production_split_2_wallet,
        percentage: track.production_split_2_percentage
      });
    }

    if (track.production_split_3_wallet && track.production_split_3_percentage) {
      productionSplits.push({
        wallet: track.production_split_3_wallet,
        percentage: track.production_split_3_percentage
      });
    }

    // Validate splits
    if (compositionSplits.length === 0 || productionSplits.length === 0) {
      return NextResponse.json(
        { error: 'Track missing composition or production splits' },
        { status: 400 }
      );
    }

    // Validate percentages add up to 100
    const compositionTotal = compositionSplits.reduce((sum, split) => sum + split.percentage, 0);
    const productionTotal = productionSplits.reduce((sum, split) => sum + split.percentage, 0);

    if (compositionTotal !== 100 || productionTotal !== 100) {
      console.error('Invalid split percentages:', { compositionTotal, productionTotal });
      return NextResponse.json(
        {
          error: 'Split percentages must add up to 100%',
          details: { compositionTotal, productionTotal }
        },
        { status: 400 }
      );
    }

    // Convert STX price to microSTX (1 STX = 1,000,000 microSTX)
    const priceSTX = track.price_stx || 2.5; // Default to 2.5 if not set
    const totalPriceMicroSTX = Math.floor(priceSTX * 1000000);

    // Return formatted data for smart contract
    const paymentData: TrackPaymentData = {
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      totalPriceMicroSTX,
      compositionSplits,
      productionSplits
    };

    return NextResponse.json(paymentData);

  } catch (error) {
    console.error('Error calculating payment splits:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
