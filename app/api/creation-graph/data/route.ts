import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Step 1: Find all remixes (tracks with source_track_ids)
    const { data: remixes, error: remixError } = await supabase
      .from('ip_tracks')
      .select(`
        id, title, artist, generation, remix_depth, content_type,
        primary_location, location_lat, location_lng,
        cover_image_url, source_track_ids, bpm,
        composition_split_1_wallet, composition_split_1_percentage,
        composition_split_2_wallet, composition_split_2_percentage,
        composition_split_3_wallet, composition_split_3_percentage,
        production_split_1_wallet, production_split_1_percentage,
        production_split_2_wallet, production_split_2_percentage,
        production_split_3_wallet, production_split_3_percentage
      `)
      .not('source_track_ids', 'eq', '{}')
      .is('deleted_at', null);

    if (remixError) {
      console.error('Error fetching remixes:', remixError);
      return NextResponse.json({ error: 'Failed to fetch remixes' }, { status: 500 });
    }

    if (!remixes || remixes.length === 0) {
      return NextResponse.json({ nodes: [], links: [] });
    }

    // Step 2: Collect all unique source track IDs
    const sourceIds = new Set<string>();
    for (const remix of remixes) {
      if (remix.source_track_ids) {
        for (const id of remix.source_track_ids) {
          sourceIds.add(id);
        }
      }
    }

    // Step 3: Fetch source tracks
    const { data: sources, error: sourceError } = await supabase
      .from('ip_tracks')
      .select(`
        id, title, artist, generation, remix_depth, content_type,
        primary_location, location_lat, location_lng,
        cover_image_url, bpm,
        composition_split_1_wallet, composition_split_1_percentage,
        composition_split_2_wallet, composition_split_2_percentage,
        composition_split_3_wallet, composition_split_3_percentage,
        production_split_1_wallet, production_split_1_percentage,
        production_split_2_wallet, production_split_2_percentage,
        production_split_3_wallet, production_split_3_percentage
      `)
      .in('id', Array.from(sourceIds));

    if (sourceError) {
      console.error('Error fetching sources:', sourceError);
      return NextResponse.json({ error: 'Failed to fetch source tracks' }, { status: 500 });
    }

    // Step 4: Build graph nodes
    const nodes = [];
    const seenIds = new Set<string>();

    // Add source tracks as seed nodes
    for (const track of sources || []) {
      if (seenIds.has(track.id)) continue;
      seenIds.add(track.id);
      nodes.push({
        id: track.id,
        title: track.title,
        artist: track.artist || 'Unknown',
        type: 'seed',
        generation: track.generation ?? track.remix_depth ?? 0,
        location: track.primary_location || 'Unknown',
        stems: extractStems(track),
        parentId: null,
        downloads: 0,
        remixCount: remixes.filter(r =>
          r.source_track_ids?.includes(track.id)
        ).length,
        splitPercent: 0,
        coverImageUrl: track.cover_image_url,
      });
    }

    // Add remixes as remix nodes
    for (const remix of remixes) {
      if (seenIds.has(remix.id)) continue;
      seenIds.add(remix.id);
      nodes.push({
        id: remix.id,
        title: remix.title,
        artist: remix.artist || 'Unknown',
        type: 'remix',
        generation: remix.generation ?? remix.remix_depth ?? 1,
        location: remix.primary_location || 'Unknown',
        stems: extractStems(remix),
        parentId: remix.source_track_ids?.[0] || null,
        downloads: 0,
        remixCount: 0,
        splitPercent: 0,
        coverImageUrl: remix.cover_image_url,
      });
    }

    // Step 5: Build edges from source_track_ids
    const links = [];
    for (const remix of remixes) {
      if (!remix.source_track_ids) continue;
      for (const sourceId of remix.source_track_ids) {
        // Attribution edge: remix → source
        links.push({
          source: remix.id,
          target: sourceId,
          type: 'sampled_from',
        });
        // Payment flow edge: remix → source
        links.push({
          source: remix.id,
          target: sourceId,
          type: 'payment',
        });
      }
    }

    // Step 6: Detect collaborations (remixes sharing sources = siblings)
    for (let i = 0; i < remixes.length; i++) {
      for (let j = i + 1; j < remixes.length; j++) {
        const a = remixes[i].source_track_ids || [];
        const b = remixes[j].source_track_ids || [];
        const shared = a.filter((id: string) => b.includes(id));
        if (shared.length > 0) {
          links.push({
            source: remixes[i].id,
            target: remixes[j].id,
            type: 'collaborated',
          });
        }
      }
    }

    return NextResponse.json({ nodes, links });
  } catch (err) {
    console.error('Creation graph error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Extract a rough "stems" list from content type
function extractStems(track: { content_type?: string; title?: string }): string[] {
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
