import { supabase } from '@/lib/supabase';
import { Track } from '@/components/mixer/types';

export interface VibeMatchCriteria {
  // From dropped track
  referenceBpm?: number;
  referenceContentType?: string;
  referenceTrackId?: string;

  // From text description
  description?: string;

  // Parsed from description or explicitly set
  bpmRange?: { min: number; max: number };
  contentTypes?: string[];
  energy?: 'chill' | 'steady' | 'driving' | 'chaotic';
  texture?: 'drums-forward' | 'melodic' | 'atmospheric' | 'vocal-chops' | 'experimental';

  // Limits
  maxResults?: number;
}

export interface VibeMatchResult {
  tracks: Track[];
  criteria: VibeMatchCriteria;
  matchCount: number;
}

/**
 * Parse a text description into search criteria
 */
export function parseDescription(description: string): Partial<VibeMatchCriteria> {
  const criteria: Partial<VibeMatchCriteria> = {};
  const lowerDesc = description.toLowerCase();

  // Extract BPM range
  const bpmMatch = lowerDesc.match(/(\d{2,3})\s*[-–to]+\s*(\d{2,3})\s*bpm/i);
  if (bpmMatch) {
    criteria.bpmRange = {
      min: parseInt(bpmMatch[1]),
      max: parseInt(bpmMatch[2])
    };
  } else {
    const singleBpmMatch = lowerDesc.match(/(\d{2,3})\s*bpm/i);
    if (singleBpmMatch) {
      const bpm = parseInt(singleBpmMatch[1]);
      criteria.bpmRange = { min: bpm - 10, max: bpm + 10 };
    }
  }

  // Detect energy levels
  if (lowerDesc.includes('chill') || lowerDesc.includes('relaxed') || lowerDesc.includes('calm')) {
    criteria.energy = 'chill';
  } else if (lowerDesc.includes('driving') || lowerDesc.includes('energetic') || lowerDesc.includes('high energy')) {
    criteria.energy = 'driving';
  } else if (lowerDesc.includes('chaotic') || lowerDesc.includes('intense') || lowerDesc.includes('wild')) {
    criteria.energy = 'chaotic';
  } else if (lowerDesc.includes('steady') || lowerDesc.includes('groove')) {
    criteria.energy = 'steady';
  }

  // Detect texture
  if (lowerDesc.includes('drums') || lowerDesc.includes('percussion') || lowerDesc.includes('beat')) {
    criteria.texture = 'drums-forward';
  } else if (lowerDesc.includes('melodic') || lowerDesc.includes('melody') || lowerDesc.includes('keys') || lowerDesc.includes('piano')) {
    criteria.texture = 'melodic';
  } else if (lowerDesc.includes('atmospheric') || lowerDesc.includes('ambient') || lowerDesc.includes('pad')) {
    criteria.texture = 'atmospheric';
  } else if (lowerDesc.includes('vocal') || lowerDesc.includes('voice') || lowerDesc.includes('chops')) {
    criteria.texture = 'vocal-chops';
  } else if (lowerDesc.includes('experimental') || lowerDesc.includes('weird') || lowerDesc.includes('glitch')) {
    criteria.texture = 'experimental';
  }

  // Detect content types
  const types: string[] = [];
  if (lowerDesc.includes('loop')) types.push('loop');
  if (lowerDesc.includes('song') || lowerDesc.includes('track')) types.push('full_song');
  if (lowerDesc.includes('video')) types.push('video_clip');
  if (types.length > 0) criteria.contentTypes = types;

  return criteria;
}

/**
 * Search for tracks matching the vibe criteria
 */
export async function searchVibeMatch(criteria: VibeMatchCriteria): Promise<VibeMatchResult> {
  const maxResults = criteria.maxResults || 5;

  // Start building the query
  let query = supabase
    .from('ip_tracks')
    .select('*')
    .eq('is_deleted', false)
    .is('pack_id', null); // Only standalone tracks, not pack children

  // Exclude the reference track if provided
  if (criteria.referenceTrackId) {
    query = query.neq('id', criteria.referenceTrackId);
  }

  // BPM range filter
  if (criteria.bpmRange) {
    query = query
      .gte('bpm', criteria.bpmRange.min)
      .lte('bpm', criteria.bpmRange.max);
  } else if (criteria.referenceBpm) {
    // Match within ±15 BPM of reference
    query = query
      .gte('bpm', criteria.referenceBpm - 15)
      .lte('bpm', criteria.referenceBpm + 15);
  }

  // Content type filter
  if (criteria.contentTypes && criteria.contentTypes.length > 0) {
    query = query.in('content_type', criteria.contentTypes);
  } else if (criteria.referenceContentType) {
    // Prefer same content type as reference
    query = query.eq('content_type', criteria.referenceContentType);
  }

  // Limit results
  query = query.limit(maxResults * 2); // Get more than needed for randomization

  const { data, error } = await query;

  if (error) {
    console.error('[VibeMatch] Query error:', error);
    return { tracks: [], criteria, matchCount: 0 };
  }

  if (!data || data.length === 0) {
    console.log('[VibeMatch] No matches found');
    return { tracks: [], criteria, matchCount: 0 };
  }

  // Convert to Track format and mark as found by agent
  const tracks: Track[] = data
    .sort(() => Math.random() - 0.5) // Shuffle results
    .slice(0, maxResults)
    .map(ipTrack => ({
      id: ipTrack.id,
      title: ipTrack.title || 'Untitled',
      artist: ipTrack.artist || 'Unknown',
      imageUrl: ipTrack.cover_image_url || '',
      cover_image_url: ipTrack.cover_image_url || '',
      bpm: ipTrack.bpm || 120,
      audioUrl: ipTrack.audio_url || undefined,
      content_type: ipTrack.content_type || 'loop',
      stream_url: ipTrack.stream_url || undefined,
      video_url: ipTrack.video_url || undefined,
      notes: ipTrack.notes || undefined,
      price_stx: ipTrack.price_stx || undefined,
      download_price_stx: ipTrack.download_price_stx || undefined,
      allow_downloads: ipTrack.allow_downloads ?? true,
      primary_uploader_wallet: ipTrack.primary_uploader_wallet,
      created_at: ipTrack.created_at,
      updated_at: ipTrack.updated_at,
      foundByAgent: true, // Mark as found by agent
    }));

  console.log(`[VibeMatch] Found ${tracks.length} matching tracks`);

  return {
    tracks,
    criteria,
    matchCount: data.length, // Total matches before limit
  };
}

/**
 * Main entry point for agent vibe matching
 */
export async function findVibeMatches(
  mode: 'vibe' | 'hunt',
  input: Track | string
): Promise<VibeMatchResult> {
  let criteria: VibeMatchCriteria;

  if (mode === 'vibe' && typeof input !== 'string') {
    // Vibe mode: match based on dropped track
    criteria = {
      referenceBpm: input.bpm,
      referenceContentType: input.content_type,
      referenceTrackId: input.id,
      maxResults: 5,
    };
    console.log('[VibeMatch] Matching vibe of:', input.title, 'BPM:', input.bpm);
  } else if (mode === 'hunt' && typeof input === 'string') {
    // Hunt mode: parse text description
    const parsed = parseDescription(input);
    criteria = {
      ...parsed,
      description: input,
      maxResults: 5,
    };
    console.log('[VibeMatch] Hunting based on:', input);
    console.log('[VibeMatch] Parsed criteria:', parsed);
  } else {
    throw new Error('Invalid mode/input combination');
  }

  return searchVibeMatch(criteria);
}
