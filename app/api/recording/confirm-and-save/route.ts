/**
 * Recording Confirmation and Draft Save API
 *
 * After payment is confirmed on-chain:
 * 1. Updates the payment record status
 * 2. Uploads the audio file to Supabase Storage
 * 3. Creates a draft ip_tracks record with genealogy metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PRICING } from '@/config/pricing';
import { SourceTrackMetadata } from '@/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const paymentId = formData.get('paymentId') as string;
    const txHash = formData.get('txHash') as string;
    const audioFile = formData.get('audioFile') as File;
    const title = formData.get('title') as string || 'Untitled Recording';
    const bpm = parseInt(formData.get('bpm') as string) || 120;
    const bars = parseInt(formData.get('bars') as string) || 8;
    const creatorWallet = formData.get('creatorWallet') as string;
    const creatorSuiAddress = formData.get('creatorSuiAddress') as string;
    const sourceTracksMetadataJson = formData.get('sourceTracksMetadata') as string;

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

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file required' },
        { status: 400 }
      );
    }

    if (!creatorWallet && !creatorSuiAddress) {
      return NextResponse.json(
        { error: 'Creator wallet or SUI address required' },
        { status: 400 }
      );
    }

    // Parse source tracks metadata
    let sourceTracksMetadata: SourceTrackMetadata[] = [];
    if (sourceTracksMetadataJson) {
      try {
        sourceTracksMetadata = JSON.parse(sourceTracksMetadataJson);
      } catch (e) {
        console.warn('Failed to parse source tracks metadata:', e);
      }
    }

    // Verify payment record exists and is pending
    const { data: paymentRecord, error: fetchError } = await supabase
      .from('recording_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchError || !paymentRecord) {
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

    // Upload audio file to Supabase Storage
    const timestamp = Date.now();
    const walletPrefix = (creatorSuiAddress || creatorWallet).slice(0, 10);
    const fileName = `recording-${walletPrefix}-${timestamp}.wav`;
    const storagePath = `user-content/audio/recordings/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('user-content')
      .upload(`audio/recordings/${fileName}`, audioFile, {
        contentType: 'audio/wav',
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Failed to upload audio:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload audio file' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('user-content')
      .getPublicUrl(`audio/recordings/${fileName}`);

    const audioUrl = urlData.publicUrl;

    // Calculate remix depth (max of source tracks + 1)
    const maxSourceDepth = sourceTracksMetadata.reduce(
      (max, track) => Math.max(max, track.generation || 0),
      0
    );
    const remixDepth = maxSourceDepth + 1;

    // Extract source track IDs
    const sourceTrackIds = sourceTracksMetadata.map((t) => t.id);

    // Create draft track record
    const { data: draftTrack, error: trackError } = await supabase
      .from('ip_tracks')
      .insert({
        title,
        artist: 'Recording',
        content_type: 'loop',
        bpm,
        audio_url: audioUrl,
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
        composition_split_1_wallet: creatorWallet || creatorSuiAddress,
        composition_split_1_percentage: 100,
        composition_split_1_sui_address: creatorSuiAddress,
        production_split_1_wallet: creatorWallet || creatorSuiAddress,
        production_split_1_percentage: 100,
        production_split_1_sui_address: creatorSuiAddress,
        // Combine tags and locations from source tracks
        tags: combineTags(sourceTracksMetadata),
        primary_uploader_wallet: creatorWallet || creatorSuiAddress,
      })
      .select()
      .single();

    if (trackError) {
      console.error('Failed to create draft track:', trackError);
      return NextResponse.json(
        { error: 'Failed to create draft track' },
        { status: 500 }
      );
    }

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

/**
 * Combine tags from source tracks, deduplicating
 */
function combineTags(sourceTracksMetadata: SourceTrackMetadata[]): string[] {
  const tagsSet = new Set<string>();

  // Add "remix" tag
  tagsSet.add('remix');

  // Note: SourceTrackMetadata doesn't include tags in our current definition
  // This would need to be expanded if we want to inherit tags from source tracks

  return Array.from(tagsSet);
}
