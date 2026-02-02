/**
 * Recording Payment Preparation API
 *
 * Prepares a payment transaction for a recording by:
 * 1. Calculating the total cost
 * 2. Resolving SUI addresses for all IP split recipients
 * 3. Creating a pending payment record
 *
 * Returns the payment details needed for the client to execute the transaction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PRICING } from '@/config/pricing';
import {
  calculateBlockCount,
  calculateRecordingCost,
  calculatePaymentSplit,
  calculateRecipientPayments,
  extractIPSplits,
  buildSourceTrackMetadata,
} from '@/lib/recording/paymentCalculation';
import { IPTrack, SourceTrackMetadata } from '@/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Platform treasury address (to receive 5% cut)
const PLATFORM_TREASURY_ADDRESS = process.env.PLATFORM_TREASURY_SUI_ADDRESS || '0x...';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bars,
      sourceTrackIds,
      payerSuiAddress,
      payerPersonaId,
    } = body;

    // Validate inputs
    if (!bars || bars <= 0) {
      return NextResponse.json(
        { error: 'Invalid bars count' },
        { status: 400 }
      );
    }

    if (!sourceTrackIds || !Array.isArray(sourceTrackIds) || sourceTrackIds.length === 0) {
      return NextResponse.json(
        { error: 'Source track IDs required' },
        { status: 400 }
      );
    }

    if (!payerSuiAddress) {
      return NextResponse.json(
        { error: 'Payer SUI address required' },
        { status: 400 }
      );
    }

    // Fetch source tracks with IP split info
    const { data: sourceTracks, error: fetchError } = await supabase
      .from('ip_tracks')
      .select(`
        id, title, bpm, remix_depth, remixer_stake_percentage,
        composition_split_1_wallet, composition_split_1_percentage, composition_split_1_sui_address,
        composition_split_2_wallet, composition_split_2_percentage, composition_split_2_sui_address,
        composition_split_3_wallet, composition_split_3_percentage, composition_split_3_sui_address,
        production_split_1_wallet, production_split_1_percentage, production_split_1_sui_address,
        production_split_2_wallet, production_split_2_percentage, production_split_2_sui_address,
        production_split_3_wallet, production_split_3_percentage, production_split_3_sui_address
      `)
      .in('id', sourceTrackIds);

    if (fetchError) {
      console.error('Failed to fetch source tracks:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch source tracks' },
        { status: 500 }
      );
    }

    if (!sourceTracks || sourceTracks.length === 0) {
      return NextResponse.json(
        { error: 'No source tracks found' },
        { status: 404 }
      );
    }

    // Calculate costs
    const trackCount = sourceTracks.length;
    const blocks = calculateBlockCount(bars);
    const totalCost = calculateRecordingCost(bars, trackCount);
    const split = calculatePaymentSplit(totalCost);

    // Calculate recipient payments (80% creators cut)
    const recipientPayments = calculateRecipientPayments(
      sourceTracks as IPTrack[],
      split.creators,
      PLATFORM_TREASURY_ADDRESS
    );

    // Add platform payment (5%)
    recipientPayments.unshift({
      sui_address: PLATFORM_TREASURY_ADDRESS,
      amount: split.platform,
      payment_type: 'platform' as const,
      percentage: PRICING.remix.platformCutPercent,
      display_name: 'mixmi Platform',
    });

    // Build source track metadata for genealogy
    const sourceTracksMetadata: SourceTrackMetadata[] = sourceTracks.map(
      (track) => buildSourceTrackMetadata(track as IPTrack)
    );

    // Create pending payment record
    const { data: paymentRecord, error: insertError } = await supabase
      .from('recording_payments')
      .insert({
        payer_persona_id: payerPersonaId || null,
        payer_sui_address: payerSuiAddress,
        total_usdc: totalCost,
        platform_cut_usdc: split.platform,
        gen0_creators_cut_usdc: split.creators,
        remixer_stake_usdc: split.remixerStake,
        chunks: blocks,
        bars_recorded: bars,
        tracks_used: trackCount,
        cost_per_chunk: PRICING.remix.pricePerBlock,
        source_track_ids: sourceTrackIds,
        tx_status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create payment record:', insertError);
      return NextResponse.json(
        { error: 'Failed to create payment record' },
        { status: 500 }
      );
    }

    // Insert recipient records
    const recipientRecords = recipientPayments.map((r) => ({
      recording_payment_id: paymentRecord.id,
      recipient_sui_address: r.sui_address,
      recipient_name: r.display_name || null,
      payment_type: r.payment_type,
      amount_usdc: r.amount,
      source_track_id: r.source_track_id || null,
      percentage_of_source: r.percentage || null,
    }));

    const { error: recipientError } = await supabase
      .from('recording_payment_recipients')
      .insert(recipientRecords);

    if (recipientError) {
      console.error('Failed to create recipient records:', recipientError);
      // Don't fail the whole request - payment record is created
    }

    return NextResponse.json({
      success: true,
      payment: {
        id: paymentRecord.id,
        totalCost,
        blocks,
        bars,
        trackCount,
        split: {
          platform: split.platform,
          creators: split.creators,
          remixerStake: split.remixerStake,
        },
        recipients: recipientPayments,
        sourceTracksMetadata,
      },
    });
  } catch (error) {
    console.error('Failed to prepare payment:', error);
    return NextResponse.json(
      { error: 'Failed to prepare payment' },
      { status: 500 }
    );
  }
}
