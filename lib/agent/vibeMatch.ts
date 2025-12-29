import { supabase } from '@/lib/supabase';
import { Track } from '@/components/mixer/types';

// Cache synonyms to avoid repeated DB calls (refreshes every 5 minutes)
let synonymCache: Map<string, { term: string; weight: number }[]> | null = null;
let synonymCacheTime = 0;
const SYNONYM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load all synonyms from database into a lookup map
 */
async function loadSynonyms(): Promise<Map<string, { term: string; weight: number }[]>> {
  const now = Date.now();
  if (synonymCache && (now - synonymCacheTime) < SYNONYM_CACHE_TTL) {
    return synonymCache;
  }

  const { data, error } = await supabase
    .from('search_synonyms')
    .select('search_term, matches_term, weight');

  if (error || !data) {
    console.error('[VibeMatch] Failed to load synonyms:', error?.message);
    return new Map();
  }

  const map = new Map<string, { term: string; weight: number }[]>();
  for (const row of data) {
    const key = row.search_term.toLowerCase();
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push({ term: row.matches_term.toLowerCase(), weight: row.weight });
  }

  synonymCache = map;
  synonymCacheTime = now;
  console.log(`[VibeMatch] Loaded ${data.length} synonyms`);
  return map;
}

/**
 * Expand keywords with their synonyms
 * Returns array of { keyword, weight } where weight affects scoring
 */
async function expandKeywordsWithSynonyms(
  keywords: string[]
): Promise<{ keyword: string; weight: number }[]> {
  const synonyms = await loadSynonyms();
  const expanded: { keyword: string; weight: number }[] = [];

  for (const kw of keywords) {
    // Original keyword gets full weight
    expanded.push({ keyword: kw, weight: 1.0 });

    // Add synonyms with their weights
    const matches = synonyms.get(kw.toLowerCase());
    if (matches) {
      for (const match of matches) {
        // Avoid duplicates
        if (!expanded.some(e => e.keyword === match.term)) {
          expanded.push({ keyword: match.term, weight: match.weight });
        }
      }
    }
  }

  return expanded;
}

/**
 * Detect if text contains non-Latin scripts (Japanese, Chinese, Korean, etc.)
 * Returns detected scripts for context inference
 */
function detectScripts(text: string): { hasJapanese: boolean; hasChinese: boolean; hasKorean: boolean; hasArabic: boolean } {
  return {
    // Hiragana, Katakana, or common Kanji
    hasJapanese: /[\u3040-\u30FF\u4E00-\u9FAF]/.test(text),
    // Chinese characters (broader range)
    hasChinese: /[\u4E00-\u9FFF]/.test(text),
    // Korean Hangul
    hasKorean: /[\uAC00-\uD7AF\u1100-\u11FF]/.test(text),
    // Arabic script
    hasArabic: /[\u0600-\u06FF]/.test(text),
  };
}

/**
 * Infer additional search terms from detected scripts
 */
function inferTermsFromScripts(text: string): string[] {
  const scripts = detectScripts(text);
  const inferred: string[] = [];

  if (scripts.hasJapanese) {
    inferred.push('japanese', 'japan', 'tokyo');
  }
  if (scripts.hasKorean) {
    inferred.push('korean', 'korea', 'seoul');
  }
  if (scripts.hasChinese && !scripts.hasJapanese) {
    // Chinese but not Japanese (since they share some characters)
    inferred.push('chinese', 'china');
  }
  if (scripts.hasArabic) {
    inferred.push('arabic', 'middle east');
  }

  return inferred;
}

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
  if (lowerDesc.includes('loop')) {
    types.push('loop');
    types.push('loop_pack'); // Include loop packs when searching for loops
  }
  if (lowerDesc.includes('song') || lowerDesc.includes('track')) {
    types.push('full_song');
    types.push('ep'); // Include EPs when searching for songs
  }
  if (lowerDesc.includes('video')) types.push('video_clip');
  if (lowerDesc.includes('radio') || lowerDesc.includes('station')) {
    types.push('radio_station');
    types.push('station_pack'); // Include station packs when searching for radio
  }
  if (types.length > 0) criteria.contentTypes = types;

  return criteria;
}

/**
 * Extract search keywords from description (excluding BPM patterns and common words)
 */
function extractSearchKeywords(description: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'bpm', 'loop', 'loops', 'song', 'songs', 'track', 'tracks', 'video', 'radio',
    'find', 'get', 'want', 'like', 'something', 'stuff', 'vibes', 'vibe', 'feel', 'feeling',
    'i', 'me', 'my', 'some', 'any', 'that', 'this', 'from', 'about'
  ]);

  // Remove BPM patterns first
  const cleanedDesc = description.toLowerCase()
    .replace(/\d{2,3}\s*[-–to]+\s*\d{2,3}\s*bpm/gi, '')
    .replace(/\d{2,3}\s*bpm/gi, '');

  // Extract words, filter out stop words and short words
  const words = cleanedDesc
    .split(/[\s,.-]+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !stopWords.has(w));

  return [...new Set(words)]; // Remove duplicates
}

/**
 * Search for tracks matching the vibe criteria
 * Searches across: tags, notes, description, tell_us_more, locations, title, artist
 */
export async function searchVibeMatch(criteria: VibeMatchCriteria): Promise<VibeMatchResult> {
  const maxResults = criteria.maxResults || 5;

  // Extract search keywords from the description
  let keywords = criteria.description ? extractSearchKeywords(criteria.description) : [];

  // Infer additional terms from non-Latin scripts in the search
  if (criteria.description) {
    const inferredTerms = inferTermsFromScripts(criteria.description);
    if (inferredTerms.length > 0) {
      console.log('[VibeMatch] Inferred from script:', inferredTerms);
      keywords = [...keywords, ...inferredTerms];
    }
  }

  // Expand keywords with synonyms (includes weights)
  const expandedKeywords = await expandKeywordsWithSynonyms(keywords);
  console.log('[VibeMatch] Search keywords:', keywords);
  console.log('[VibeMatch] Expanded with synonyms:', expandedKeywords.map(e => `${e.keyword}(${e.weight})`).join(', '));

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

  // Get more results for text filtering (we'll filter client-side for flexibility)
  query = query.limit(100);

  const { data, error } = await query;

  if (error) {
    console.error('[VibeMatch] Query error:', error);
    return { tracks: [], criteria, matchCount: 0 };
  }

  if (!data || data.length === 0) {
    console.log('[VibeMatch] No matches found');
    return { tracks: [], criteria, matchCount: 0 };
  }

  // Check if we have an explicit content type filter (meaning user asked for specific type)
  const hasContentTypeFilter = (criteria.contentTypes && criteria.contentTypes.length > 0) || !!criteria.referenceContentType;

  // Score and filter tracks based on keyword matches
  let scoredTracks = data.map(track => {
    // If content type was explicitly requested, give baseline score of 1
    // This ensures radio searches return radio stations even without keyword matches
    let score = hasContentTypeFilter ? 1 : 0;

    // Build searchable text from track metadata
    const rawText = [
      track.title || '',
      track.artist || '',
      track.notes || '',
      track.description || '',
      track.tell_us_more || '',
      // Convert tags array to string for searching
      Array.isArray(track.tags) ? track.tags.join(' ') : '',
      // Convert locations array to searchable text
      Array.isArray(track.locations) ? track.locations.map((loc: any) =>
        typeof loc === 'string' ? loc : `${loc.city || ''} ${loc.country || ''} ${loc.name || ''}`
      ).join(' ') : '',
    ].join(' ');

    // Infer language terms from track metadata scripts
    // (e.g., if title has Japanese characters, add "japanese" to searchable text)
    const trackScriptTerms = inferTermsFromScripts(rawText);
    const searchableText = (rawText + ' ' + trackScriptTerms.join(' ')).toLowerCase();

    // Score each keyword match (bonus points on top of baseline)
    // Use expanded keywords with their weights
    for (const { keyword, weight } of expandedKeywords) {
      if (searchableText.includes(keyword)) {
        score += weight; // Weighted score based on synonym relationship
        // Bonus for tag matches (more intentional metadata)
        if (Array.isArray(track.tags) && track.tags.some((t: string) =>
          t.toLowerCase().includes(keyword)
        )) {
          score += 2 * weight;
        }
        // Bonus for title/artist matches
        if ((track.title || '').toLowerCase().includes(keyword)) {
          score += weight;
        }
      }
    }

    return { track, score };
  });

  // Filtering logic depends on whether we have content type filter or just keywords
  if (hasContentTypeFilter) {
    // Content type was specified (e.g., "radio", "loops", "songs")
    // All tracks already match via DB query, keywords are bonus
    // Sort by score (highest first for keyword matches), then shuffle within same score
    scoredTracks.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Math.random() - 0.5;
    });
    console.log(`[VibeMatch] ${scoredTracks.length} tracks matched content type filter`);
  } else if (expandedKeywords.length > 0) {
    // No content type filter, only keywords - require actual keyword matches
    const matchedTracks = scoredTracks.filter(t => t.score > 0);

    if (matchedTracks.length === 0) {
      console.log(`[VibeMatch] Keywords ${expandedKeywords.map(e => e.keyword).join(', ')} matched 0 tracks - returning empty`);
      return { tracks: [], criteria, matchCount: 0 };
    }

    // Sort by score (highest first), then shuffle within same score
    matchedTracks.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Math.random() - 0.5;
    });

    console.log(`[VibeMatch] ${matchedTracks.length} tracks matched keywords (including synonyms)`);
    scoredTracks = matchedTracks;
  } else {
    // No content type filter and no keywords - just shuffle
    scoredTracks = scoredTracks.sort(() => Math.random() - 0.5);
  }

  // Take top results
  const selectedTracks = scoredTracks.slice(0, maxResults);

  // Convert to Track format
  const tracks: Track[] = selectedTracks.map(({ track: ipTrack }) => ({
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
    foundByAgent: true,
  }));

  console.log(`[VibeMatch] Returning ${tracks.length} tracks`);

  return {
    tracks,
    criteria,
    matchCount: scoredTracks.filter(t => t.score > 0).length || data.length,
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
