import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Fetch a single track's remix tree (ancestors + descendants)
export async function GET(request: NextRequest) {
  const trackId = request.nextUrl.searchParams.get('id');
  if (!trackId) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  // Strip -loc-X suffix if present (globe tracks)
  const cleanId = trackId.includes('-loc-') ? trackId.split('-loc-')[0] : trackId;

  try {
    const trackFields = `
      id, title, artist, generation, remix_depth, content_type,
      primary_location, location_lat, location_lng,
      cover_image_url, source_track_ids, bpm
    `;

    // Fetch the dropped track
    const { data: track, error: trackError } = await supabase
      .from('ip_tracks')
      .select(trackFields)
      .eq('id', cleanId)
      .single();

    if (trackError || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    const allNodes = new Map<string, typeof track>();
    allNodes.set(track.id, track);

    // Walk UP: fetch parents via source_track_ids
    const fetchParents = async (sourceIds: string[]) => {
      if (!sourceIds || sourceIds.length === 0) return;
      const idsToFetch = sourceIds.filter(id => !allNodes.has(id));
      if (idsToFetch.length === 0) return;

      const { data: parents } = await supabase
        .from('ip_tracks')
        .select(trackFields)
        .in('id', idsToFetch);

      if (parents) {
        for (const p of parents) {
          allNodes.set(p.id, p);
          // Recurse up
          if (p.source_track_ids && p.source_track_ids.length > 0) {
            await fetchParents(p.source_track_ids);
          }
        }
      }
    };

    // Walk DOWN: find tracks that reference this track as a source
    const fetchChildren = async (parentId: string) => {
      const { data: children } = await supabase
        .from('ip_tracks')
        .select(trackFields)
        .contains('source_track_ids', [parentId])
        .is('deleted_at', null);

      if (children) {
        for (const child of children) {
          if (allNodes.has(child.id)) continue;
          allNodes.set(child.id, child);
          // Recurse down
          await fetchChildren(child.id);
        }
      }
    };

    // Walk up from the dropped track
    if (track.source_track_ids && track.source_track_ids.length > 0) {
      await fetchParents(track.source_track_ids);
    }

    // Walk down from the dropped track
    await fetchChildren(cleanId);

    // Also walk down from any parents we found (to find siblings)
    if (track.source_track_ids) {
      for (const parentId of track.source_track_ids) {
        await fetchChildren(parentId);
      }
    }

    // Build graph
    const nodes = [];
    const links = [];

    for (const [, t] of allNodes) {
      const isRemix = t.source_track_ids && t.source_track_ids.length > 0;
      nodes.push({
        id: t.id,
        title: t.title,
        artist: t.artist || 'Unknown',
        type: isRemix ? 'remix' : 'seed',
        generation: t.generation ?? t.remix_depth ?? (isRemix ? 1 : 0),
        location: t.primary_location || 'Unknown',
        stems: extractStems(t),
        parentId: t.source_track_ids?.[0] || null,
        downloads: 0,
        remixCount: 0,
        splitPercent: 0,
        coverImageUrl: t.cover_image_url,
      });

      // Build edges
      if (t.source_track_ids) {
        for (const sourceId of t.source_track_ids) {
          if (allNodes.has(sourceId)) {
            links.push({ source: t.id, target: sourceId, type: 'sampled_from' });
            links.push({ source: t.id, target: sourceId, type: 'payment' });
          }
        }
      }
    }

    // Detect sibling collaborations
    const remixes = Array.from(allNodes.values()).filter(
      t => t.source_track_ids && t.source_track_ids.length > 0
    );
    for (let i = 0; i < remixes.length; i++) {
      for (let j = i + 1; j < remixes.length; j++) {
        const a = remixes[i].source_track_ids || [];
        const b = remixes[j].source_track_ids || [];
        if (a.some((id: string) => b.includes(id))) {
          links.push({ source: remixes[i].id, target: remixes[j].id, type: 'collaborated' });
        }
      }
    }

    return NextResponse.json({ nodes, links, seedTrackId: cleanId });
  } catch (err) {
    console.error('Creation graph track error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function extractStems(track: { title?: string }): string[] {
  const title = (track.title || '').toLowerCase();
  const stems: string[] = [];
  if (title.includes('vocal') || title.includes('vox') || title.includes('accap')) stems.push('vocal');
  if (title.includes('guitar') || title.includes('gtr')) stems.push('guitar');
  if (title.includes('drum') || title.includes('beat')) stems.push('drums');
  if (title.includes('bass')) stems.push('bass');
  if (title.includes('keys') || title.includes('piano')) stems.push('keys');
  if (title.includes('instru')) stems.push('instrumental');
  if (title.includes('loop')) stems.push('loop');
  if (stems.length === 0) stems.push('audio');
  return stems;
}
