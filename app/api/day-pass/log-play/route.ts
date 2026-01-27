/**
 * API Route: Log a Track Play
 *
 * POST /api/day-pass/log-play
 *
 * Records a track play during an active day pass session.
 * Called when a track finishes playing in the playlist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dayPassId, trackId, contentType, durationSeconds } = body;

    // Validate required fields
    if (!dayPassId || !trackId || !contentType) {
      return NextResponse.json(
        { error: 'Missing required fields: dayPassId, trackId, contentType' },
        { status: 400 }
      );
    }

    // Parse track ID and location (e.g., "uuid-loc-0" -> uuid + location 0)
    // The -loc-X suffix indicates which globe location the track was placed at
    let cleanTrackId = trackId;
    let globeLocation: number | null = null;

    if (trackId.includes('-loc-')) {
      const parts = trackId.split('-loc-');
      cleanTrackId = parts[0];
      globeLocation = parseInt(parts[1], 10);
      if (isNaN(globeLocation)) globeLocation = null;
    }

    // Verify the day pass is still active
    const { data: dayPass, error: passError } = await supabase
      .from('day_passes')
      .select('id, status, expires_at')
      .eq('id', dayPassId)
      .single();

    if (passError || !dayPass) {
      return NextResponse.json(
        { error: 'Day pass not found' },
        { status: 404 }
      );
    }

    // Check if pass is still valid
    const isExpired = new Date(dayPass.expires_at) < new Date();
    if (dayPass.status !== 'active' || isExpired) {
      return NextResponse.json(
        { error: 'Day pass has expired' },
        { status: 400 }
      );
    }

    // Insert the play record
    // Note: credits are calculated by database trigger
    console.log('🎵 [log-play] Inserting play record:', {
      day_pass_id: dayPassId,
      track_id: cleanTrackId,
      globe_location: globeLocation,
      content_type: contentType,
      duration_seconds: durationSeconds,
    });

    const { data: play, error: insertError } = await supabase
      .from('day_pass_plays')
      .insert({
        day_pass_id: dayPassId,
        track_id: cleanTrackId,
        globe_location: globeLocation,
        content_type: contentType,
        duration_seconds: durationSeconds || null,
      })
      .select('id, credits')
      .single();

    if (insertError) {
      console.error('Error logging play:', insertError);
      console.error('Insert error details:', JSON.stringify(insertError, null, 2));
      return NextResponse.json(
        { error: 'Failed to log play', details: insertError.message },
        { status: 500 }
      );
    }

    // Get updated play count
    const { count: totalPlays } = await supabase
      .from('day_pass_plays')
      .select('*', { count: 'exact', head: true })
      .eq('day_pass_id', dayPassId);

    console.log(`🎵 [DayPass] Logged play: track=${trackId}, type=${contentType}, credits=${play.credits}`);

    return NextResponse.json({
      success: true,
      playId: play.id,
      credits: play.credits,
      totalPlays: totalPlays || 0,
    });

  } catch (error) {
    console.error('Log play error:', error);
    return NextResponse.json(
      { error: 'Failed to log play' },
      { status: 500 }
    );
  }
}
