import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create admin client with service role key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    console.log('[toggle-visibility] API endpoint called');
    const body = await request.json();
    const { trackId, walletAddress } = body;

    console.log('[toggle-visibility] Request data:', { trackId, walletAddress });

    if (!trackId || !walletAddress) {
      console.log('[toggle-visibility] Missing parameters');
      return NextResponse.json(
        { error: 'Missing trackId or walletAddress' },
        { status: 400 }
      );
    }

    // First verify the track belongs to this wallet
    console.log('[toggle-visibility] Fetching track from database...');
    const { data: track, error: fetchError } = await supabaseAdmin
      .from('ip_tracks')
      .select('id, is_deleted, primary_uploader_wallet')
      .eq('id', trackId)
      .single();

    if (fetchError) {
      console.error('[toggle-visibility] Error fetching track:', fetchError);
      return NextResponse.json(
        { error: 'Track not found', details: fetchError.message },
        { status: 404 }
      );
    }

    console.log('[toggle-visibility] Track found:', track);

    // Verify ownership
    if (track.primary_uploader_wallet !== walletAddress) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Toggle the is_deleted status
    const newDeletedState = !track.is_deleted;

    const { error: updateError } = await supabaseAdmin
      .from('ip_tracks')
      .update({ is_deleted: newDeletedState })
      .eq('id', trackId);

    if (updateError) {
      console.error('Error updating track visibility:', updateError);
      return NextResponse.json(
        { error: 'Failed to update track visibility' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      is_deleted: newDeletedState
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
