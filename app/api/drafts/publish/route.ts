import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic to prevent build-time evaluation
export const dynamic = 'force-dynamic';

// Initialize Supabase with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/drafts/publish
 *
 * Publishes a draft track by setting is_draft to false.
 * Also publishes any child tracks if this is a pack.
 *
 * Request body:
 * - trackId: string - The track ID to publish
 * - walletAddress: string - Owner's wallet address (for verification)
 */
export async function POST(request: NextRequest) {
  console.log('📤 Draft publish endpoint hit');

  try {
    const { trackId, walletAddress } = await request.json();

    console.log('📤 Publish request:', { trackId, walletAddress });

    // Validate required fields
    if (!trackId || !walletAddress) {
      return NextResponse.json(
        { error: 'trackId and walletAddress are required' },
        { status: 400 }
      );
    }

    // Get the track to verify ownership and check if it's a pack
    const { data: track, error: fetchError } = await supabase
      .from('ip_tracks')
      .select('*')
      .eq('id', trackId)
      .eq('is_draft', true)
      .single();

    if (fetchError) {
      console.error('📤 Error fetching track:', fetchError);
      return NextResponse.json(
        { error: `Track not found or not a draft: ${fetchError.message}` },
        { status: 404 }
      );
    }

    // Verify ownership
    if (track.primary_uploader_wallet !== walletAddress) {
      return NextResponse.json(
        { error: 'Not authorized to publish this track' },
        { status: 403 }
      );
    }

    // Publish the main track
    const { error: updateError } = await supabase
      .from('ip_tracks')
      .update({ is_draft: false })
      .eq('id', trackId);

    if (updateError) {
      console.error('📤 Error publishing track:', updateError);
      return NextResponse.json(
        { error: `Failed to publish: ${updateError.message}` },
        { status: 500 }
      );
    }

    // If this is a pack, also publish all child tracks
    if (track.content_type === 'loop_pack' || track.content_type === 'ep' || track.content_type === 'station_pack') {
      const { error: childUpdateError } = await supabase
        .from('ip_tracks')
        .update({ is_draft: false })
        .eq('pack_id', trackId)
        .eq('is_draft', true);

      if (childUpdateError) {
        console.error('📤 Error publishing child tracks:', childUpdateError);
        // Continue anyway - main track is published
      } else {
        console.log('📤 Child tracks published');
      }
    }

    console.log(`✅ Draft published: ${trackId}`);

    return NextResponse.json({
      success: true,
      track: {
        id: track.id,
        title: track.title,
        content_type: track.content_type,
        is_draft: false
      }
    });

  } catch (error: any) {
    console.error('📤 Publish error:', error);
    return NextResponse.json(
      { error: 'Failed to publish draft', details: error.message },
      { status: 500 }
    );
  }
}
