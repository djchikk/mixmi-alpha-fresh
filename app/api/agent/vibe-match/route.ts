import { NextRequest, NextResponse } from 'next/server';
import { findVibeMatches } from '@/lib/agent/vibeMatch';
import { Track } from '@/components/mixer/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, input } = body;

    if (!mode || !input) {
      return NextResponse.json(
        { error: 'Missing required fields: mode and input' },
        { status: 400 }
      );
    }

    if (mode !== 'vibe' && mode !== 'hunt') {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "vibe" or "hunt"' },
        { status: 400 }
      );
    }

    console.log('[API] Agent vibe match request:', { mode, input: typeof input === 'string' ? input : input.title });

    const result = await findVibeMatches(mode, input as Track | string);

    return NextResponse.json({
      success: true,
      tracks: result.tracks,
      matchCount: result.matchCount,
      criteria: result.criteria,
    });
  } catch (error) {
    console.error('[API] Agent vibe match error:', error);
    return NextResponse.json(
      { error: 'Failed to search for matches' },
      { status: 500 }
    );
  }
}
