import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/earnings?personaIds=id1,id2,id3
 *
 * Fetches earnings for the specified persona IDs.
 * Uses service role to bypass RLS.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const personaIdsParam = searchParams.get('personaIds');

  if (!personaIdsParam) {
    return NextResponse.json(
      { error: 'personaIds parameter required' },
      { status: 400 }
    );
  }

  const personaIds = personaIdsParam.split(',').filter(id => id.trim());

  if (personaIds.length === 0) {
    return NextResponse.json({ earnings: [] });
  }

  try {
    // Fetch earnings for these personas
    const { data: earningsData, error: earningsError } = await supabaseAdmin
      .from('earnings')
      .select(`
        id,
        persona_id,
        amount_usdc,
        source_type,
        status,
        created_at,
        tx_hash,
        source_id
      `)
      .in('persona_id', personaIds)
      .order('created_at', { ascending: false })
      .limit(50);

    if (earningsError) {
      console.error('[Earnings API] Error:', earningsError);
      return NextResponse.json(
        { error: 'Failed to fetch earnings' },
        { status: 500 }
      );
    }

    // Fetch track titles for earnings that have source_id
    const trackIds = (earningsData || [])
      .filter(e => e.source_id)
      .map(e => e.source_id);

    let trackTitles: Record<string, string> = {};
    if (trackIds.length > 0) {
      const { data: tracks } = await supabaseAdmin
        .from('ip_tracks')
        .select('id, title')
        .in('id', trackIds);

      if (tracks) {
        trackTitles = Object.fromEntries(tracks.map(t => [t.id, t.title]));
      }
    }

    // Add track titles to earnings
    const earningsWithTitles = (earningsData || []).map(e => ({
      ...e,
      track_title: e.source_id ? trackTitles[e.source_id] : undefined,
      track_id: e.source_id,
    }));

    return NextResponse.json({
      earnings: earningsWithTitles,
      count: earningsWithTitles.length,
    });

  } catch (error) {
    console.error('[Earnings API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
