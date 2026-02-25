import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SPLIT_FIELDS = [
  'composition_split_1_wallet',
  'composition_split_2_wallet',
  'composition_split_3_wallet',
  'production_split_1_wallet',
  'production_split_2_wallet',
  'production_split_3_wallet',
] as const;

export async function POST(request: NextRequest) {
  try {
    const { pendingName, resolvedWallet, trackIds, uploaderWallet, uploaderWallets } = await request.json();

    // Support both single wallet (legacy) and array of wallets
    const validWallets: string[] = uploaderWallets?.length
      ? uploaderWallets
      : uploaderWallet ? [uploaderWallet] : [];

    if (!pendingName || !resolvedWallet || !trackIds?.length || validWallets.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: pendingName, resolvedWallet, trackIds, uploaderWallet(s)' },
        { status: 400 }
      );
    }

    const pendingValue = `pending:${pendingName}`;
    let totalUpdated = 0;

    for (const trackId of trackIds) {
      // Fetch the track and verify ownership
      const { data: trackData, error: fetchError } = await supabase
        .from('ip_tracks')
        .select('id, primary_uploader_wallet, composition_split_1_wallet, composition_split_2_wallet, composition_split_3_wallet, production_split_1_wallet, production_split_2_wallet, production_split_3_wallet')
        .eq('id', trackId)
        .single();

      if (fetchError || !trackData) {
        console.error(`Track ${trackId} not found:`, fetchError);
        continue;
      }

      const track = trackData as Record<string, any>;

      // Security: verify the requesting user owns this track (check all account wallets)
      if (!validWallets.includes(track.primary_uploader_wallet)) {
        console.error(`Ownership mismatch for track ${trackId}`);
        continue;
      }

      // Build update payload for matching fields
      const updates: Record<string, string> = {};
      for (const field of SPLIT_FIELDS) {
        const value = track[field] as string | null;
        if (value && value.toLowerCase() === pendingValue.toLowerCase()) {
          updates[field] = resolvedWallet;
        }
      }

      if (Object.keys(updates).length === 0) continue;

      const { error: updateError } = await supabase
        .from('ip_tracks')
        .update(updates)
        .eq('id', trackId);

      if (updateError) {
        console.error(`Failed to update track ${trackId}:`, updateError);
        continue;
      }

      totalUpdated += Object.keys(updates).length;
    }

    return NextResponse.json({
      success: true,
      updatedFields: totalUpdated,
      tracksProcessed: trackIds.length,
    });
  } catch (error) {
    console.error('Error resolving pending splits:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
