import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create admin client with service role key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackId, walletAddress } = body;

    if (!trackId || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing trackId or walletAddress' },
        { status: 400 }
      );
    }

    // First verify the track belongs to this wallet
    const { data: track, error: fetchError } = await supabaseAdmin
      .from('ip_tracks')
      .select('id, primary_uploader_wallet')
      .eq('id', trackId)
      .single();

    if (fetchError) {
      console.error('Error fetching track:', fetchError);
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (track.primary_uploader_wallet !== walletAddress) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete dependent records first to avoid foreign key constraint violations
    // 1. Delete recording payment recipients that reference this track
    const { error: recipientsError } = await supabaseAdmin
      .from('recording_payment_recipients')
      .delete()
      .eq('source_track_id', trackId);

    if (recipientsError) {
      console.error('Error deleting payment recipients:', recipientsError);
      // Continue - these may not exist
    }

    // 2. Delete recording payments that reference this track as draft
    const { error: paymentsError } = await supabaseAdmin
      .from('recording_payments')
      .delete()
      .eq('draft_track_id', trackId);

    if (paymentsError) {
      console.error('Error deleting recording payments:', paymentsError);
      // Continue - these may not exist
    }

    // 3. Now delete the track
    const { error: deleteError } = await supabaseAdmin
      .from('ip_tracks')
      .delete()
      .eq('id', trackId);

    if (deleteError) {
      console.error('Error deleting track:', deleteError);
      // Check if it's a foreign key constraint error
      const errorMessage = deleteError.message || deleteError.code || '';
      if (errorMessage.includes('foreign key') || errorMessage.includes('violates')) {
        return NextResponse.json(
          { error: 'Cannot delete track: it has associated records (payments, remixes, etc.)' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to delete track' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
