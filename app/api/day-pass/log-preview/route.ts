/**
 * API Route: Log a Preview Play (Analytics)
 *
 * POST /api/day-pass/log-preview
 *
 * Records 20-second preview plays for analytics purposes.
 * Unlike full plays, these don't count toward revenue distribution.
 * Useful for tracking engagement from non-paying listeners.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackId, contentType, userAddress } = body;

    if (!trackId || !contentType) {
      return NextResponse.json(
        { error: 'Missing required fields: trackId, contentType' },
        { status: 400 }
      );
    }

    // Parse track ID and location (e.g., "uuid-loc-0" -> uuid + location 0)
    let cleanTrackId = trackId;
    let globeLocation: number | null = null;

    if (trackId.includes('-loc-')) {
      const parts = trackId.split('-loc-');
      cleanTrackId = parts[0];
      globeLocation = parseInt(parts[1], 10);
      if (isNaN(globeLocation)) globeLocation = null;
    }

    // Insert the preview play record
    const { error: insertError } = await supabase
      .from('preview_plays')
      .insert({
        track_id: cleanTrackId,
        content_type: contentType,
        user_address: userAddress || null,
        globe_location: globeLocation,
      });

    if (insertError) {
      // If table doesn't exist, log but don't fail
      if (insertError.code === '42P01') {
        console.log('🎵 [Preview] preview_plays table not created yet');
        return NextResponse.json({ success: true, note: 'table not ready' });
      }
      console.error('Error logging preview:', insertError);
      return NextResponse.json(
        { error: 'Failed to log preview' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Log preview error:', error);
    return NextResponse.json(
      { error: 'Failed to log preview' },
      { status: 500 }
    );
  }
}
