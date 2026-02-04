/**
 * Recording Confirmation and Draft Save API
 *
 * After payment is confirmed on-chain and audio uploaded directly to Supabase:
 * 1. Updates the payment record status
 * 2. Creates a draft ip_tracks record with genealogy metadata
 *
 * Now accepts JSON with audioUrl instead of FormData with file
 * (to bypass Vercel's body size limit)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { PRICING } from '@/config/pricing';
import { SourceTrackMetadata } from '@/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log('📁 [confirm-and-save] Starting request processing...');

    const body = await request.json();

    const {
      paymentId,
      txHash,
      audioUrl, // Now expecting URL instead of file
      videoUrl = null, // Optional video URL
      title = 'Untitled Recording',
      bpm = 120,
      bars = 8,
      creatorWallet,
      creatorSuiAddress,
      sourceTracksMetadata = [],
    } = body;

    console.log('📁 [confirm-and-save] Request:', {
      paymentId,
      txHash: txHash?.slice(0, 20) + '...',
      audioUrl: audioUrl?.slice(0, 50) + '...',
      bpm,
      bars,
    });

    // Validate required fields
    if (!paymentId) {
      return NextResponse.json(
        { error: 'Payment ID required' },
        { status: 400 }
      );
    }

    if (!txHash) {
      return NextResponse.json(
        { error: 'Transaction hash required' },
        { status: 400 }
      );
    }

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'Audio URL required' },
        { status: 400 }
      );
    }

    if (!creatorWallet && !creatorSuiAddress) {
      return NextResponse.json(
        { error: 'Creator wallet or SUI address required' },
        { status: 400 }
      );
    }

    // Verify payment record exists and is pending
    const { data: paymentRecord, error: fetchError } = await supabase
      .from('recording_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchError || !paymentRecord) {
      console.error('Payment record not found:', fetchError);
      return NextResponse.json(
        { error: 'Payment record not found' },
        { status: 404 }
      );
    }

    if (paymentRecord.tx_status !== 'pending') {
      return NextResponse.json(
        { error: `Payment already processed: ${paymentRecord.tx_status}` },
        { status: 400 }
      );
    }

    // Calculate remix depth (max of source tracks + 1)
    const maxSourceDepth = sourceTracksMetadata.reduce(
      (max: number, track: SourceTrackMetadata) => Math.max(max, track.generation || 0),
      0
    );
    const remixDepth = maxSourceDepth + 1;

    // Extract source track IDs
    const sourceTrackIds = sourceTracksMetadata.map((t: SourceTrackMetadata) => t.id);

    // Create draft track record
    // If video URL is present, this is a video recording
    const hasVideo = !!videoUrl;
    const trackId = randomUUID();
    const { data: draftTrack, error: trackError } = await supabase
      .from('ip_tracks')
      .insert({
        id: trackId,
        title,
        artist: 'Recording',
        content_type: hasVideo ? 'video_clip' : 'loop',
        bpm,
        audio_url: audioUrl,
        video_url: videoUrl, // Will be null if no video
        sample_type: 'recording',
        is_draft: true,
        remix_depth: remixDepth,
        source_track_ids: sourceTrackIds,
        source_tracks_metadata: sourceTracksMetadata,
        remixer_stake_percentage: PRICING.remix.remixerStakePercent,
        recording_cost_usdc: paymentRecord.total_usdc,
        recording_payment_tx: txHash,
        recording_payment_status: 'confirmed',
        recorded_bars: bars,
        // Set the creator as the composition/production owner
        // IMPORTANT: Use SUI address first to match dashboard query priority
        // Dashboard uses: activePersona?.sui_address || activePersona?.wallet_address || suiAddress
        composition_split_1_wallet: creatorSuiAddress || creatorWallet,
        composition_split_1_percentage: 100,
        composition_split_1_sui_address: creatorSuiAddress,
        production_split_1_wallet: creatorSuiAddress || creatorWallet,
        production_split_1_percentage: 100,
        production_split_1_sui_address: creatorSuiAddress,
        // Add remix tag
        tags: ['remix'],
        primary_uploader_wallet: creatorSuiAddress || creatorWallet,
      })
      .select()
      .single();

    if (trackError) {
      console.error('Failed to create draft track:', trackError);
      console.error('Track error details:', JSON.stringify(trackError, null, 2));
      return NextResponse.json(
        { error: `Failed to create draft track: ${trackError.message || trackError.code || 'Unknown error'}` },
        { status: 500 }
      );
    }

    console.log('📁 [confirm-and-save] Draft track created:', draftTrack.id);

    // Update payment record with confirmation
    const { error: updateError } = await supabase
      .from('recording_payments')
      .update({
        tx_hash: txHash,
        tx_status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        draft_track_id: draftTrack.id,
      })
      .eq('id', paymentId);

    if (updateError) {
      console.error('Failed to update payment record:', updateError);
      // Don't fail - draft is created
    }

    // Mark recipients as paid
    await supabase
      .from('recording_payment_recipients')
      .update({
        paid: true,
        paid_at: new Date().toISOString(),
      })
      .eq('recording_payment_id', paymentId);

    console.log('📁 [confirm-and-save] Success!');

    return NextResponse.json({
      success: true,
      draft: {
        id: draftTrack.id,
        title: draftTrack.title,
        audioUrl: draftTrack.audio_url,
        bpm: draftTrack.bpm,
        bars: draftTrack.recorded_bars,
        remixDepth: draftTrack.remix_depth,
        remixerStake: draftTrack.remixer_stake_percentage,
      },
      payment: {
        id: paymentId,
        txHash,
        status: 'confirmed',
      },
    });
  } catch (error) {
    console.error('Failed to confirm and save recording:', error);
    return NextResponse.json(
      { error: 'Failed to confirm and save recording' },
      { status: 500 }
    );
  }
}
