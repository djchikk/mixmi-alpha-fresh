import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Force dynamic to prevent build-time evaluation
export const dynamic = 'force-dynamic';

// Initialize Supabase with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/drafts/package
 *
 * Packages multiple draft takes into a draft loop pack.
 *
 * Request body:
 * - packId: string - The pack_id shared by the takes (first track's ID)
 * - walletAddress: string - Owner's wallet address
 * - title: string - Optional pack title (defaults to "Draft Loop Pack")
 *
 * This creates a new loop_pack container and updates all child tracks
 * to point to it.
 */
export async function POST(request: NextRequest) {
  console.log('📦 Draft package endpoint hit');

  try {
    const { packId, walletAddress, title } = await request.json();

    console.log('📦 Package request:', { packId, walletAddress, title });

    // Validate required fields
    if (!packId || !walletAddress) {
      return NextResponse.json(
        { error: 'packId and walletAddress are required' },
        { status: 400 }
      );
    }

    // Get all draft tracks with this pack_id
    const { data: childTracks, error: fetchError } = await supabase
      .from('ip_tracks')
      .select('*')
      .eq('pack_id', packId)
      .eq('is_draft', true)
      .eq('primary_uploader_wallet', walletAddress)
      .order('pack_position', { ascending: true });

    if (fetchError) {
      console.error('📦 Error fetching child tracks:', fetchError);
      return NextResponse.json(
        { error: `Failed to fetch tracks: ${fetchError.message}` },
        { status: 500 }
      );
    }

    // Also check if the packId itself is a track (first take before it got pack_id set)
    const { data: firstTrack, error: firstTrackError } = await supabase
      .from('ip_tracks')
      .select('*')
      .eq('id', packId)
      .eq('is_draft', true)
      .eq('primary_uploader_wallet', walletAddress)
      .single();

    if (firstTrackError && firstTrackError.code !== 'PGRST116') {
      console.error('📦 Error fetching first track:', firstTrackError);
    }

    // Combine tracks - first track might not have pack_id set on itself
    let allTracks = childTracks || [];
    if (firstTrack && !allTracks.find(t => t.id === firstTrack.id)) {
      allTracks = [firstTrack, ...allTracks];
    }

    console.log(`📦 Found ${allTracks.length} draft tracks to package`);

    if (allTracks.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 takes to create a loop pack' },
        { status: 400 }
      );
    }

    if (allTracks.length > 5) {
      return NextResponse.json(
        { error: 'Loop packs can have maximum 5 loops' },
        { status: 400 }
      );
    }

    // Get artist name from first track
    const artist = allTracks[0]?.artist || walletAddress.substring(0, 10) + '...';
    const bpm = allTracks[0]?.bpm || 120;

    // Generate new UUID for the pack container
    const packContainerId = randomUUID();

    // Create the loop_pack container
    const packContainer = {
      id: packContainerId,
      title: title || 'Draft Loop Pack',
      artist: artist,
      content_type: 'loop_pack',
      bpm: bpm,
      is_draft: true,
      primary_uploader_wallet: walletAddress,

      // Use first track's audio as preview
      audio_url: allTracks[0]?.audio_url,

      // Default splits - 100% to uploader
      composition_split_1_wallet: walletAddress,
      composition_split_1_percentage: 100,
      production_split_1_wallet: walletAddress,
      production_split_1_percentage: 100,

      // Metadata
      loop_category: 'vocals',
      sample_type: 'vocals',
    };

    console.log('📦 Creating pack container:', packContainerId);

    const { data: insertedPack, error: insertError } = await supabase
      .from('ip_tracks')
      .insert(packContainer)
      .select()
      .single();

    if (insertError) {
      console.error('📦 Error creating pack container:', insertError);
      return NextResponse.json(
        { error: `Failed to create pack: ${insertError.message}` },
        { status: 500 }
      );
    }

    // Update all child tracks to point to new pack container
    const updatePromises = allTracks.map((track, index) => {
      return supabase
        .from('ip_tracks')
        .update({
          pack_id: packContainerId,
          pack_position: index + 1
        })
        .eq('id', track.id)
        .eq('primary_uploader_wallet', walletAddress);
    });

    const updateResults = await Promise.all(updatePromises);

    const updateErrors = updateResults.filter(r => r.error);
    if (updateErrors.length > 0) {
      console.error('📦 Some track updates failed:', updateErrors);
      // Continue anyway - pack is created
    }

    console.log(`✅ Draft loop pack created: ${packContainerId} with ${allTracks.length} tracks`);

    return NextResponse.json({
      success: true,
      pack: {
        id: insertedPack.id,
        title: insertedPack.title,
        artist: insertedPack.artist,
        content_type: insertedPack.content_type,
        bpm: insertedPack.bpm,
        is_draft: true,
        trackCount: allTracks.length
      },
      tracks: allTracks.map((t, i) => ({
        id: t.id,
        title: t.title,
        pack_position: i + 1
      }))
    });

  } catch (error: any) {
    console.error('📦 Package error:', error);
    return NextResponse.json(
      { error: 'Failed to package draft', details: error.message },
      { status: 500 }
    );
  }
}
