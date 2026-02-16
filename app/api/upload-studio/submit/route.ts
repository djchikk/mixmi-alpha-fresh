import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { getWalletFromAuthIdentity } from '@/lib/auth/wallet-mapping';
import { parseLocationsAndGetCoordinates } from '@/lib/locationLookup';
import { PRICING } from '@/config/pricing';
import { generateKeypair, getAddressFromKeypair } from '@/lib/sui/keypair-manager';

// Helper to check if two locations are duplicates (by coordinates, name, or containment)
// Common country abbreviations and their full names
const COUNTRY_ABBREVIATIONS: Record<string, string[]> = {
  'uk': ['united kingdom', 'england', 'scotland', 'wales', 'northern ireland', 'great britain', 'britain'],
  'usa': ['united states', 'america', 'u.s.a.', 'u.s.'],
  'uae': ['united arab emirates', 'emirates'],
};

function isLocationDuplicate(
  existing: Array<{ lat: number; lng: number; name: string }>,
  newLoc: { lat: number; lng: number; name: string }
): boolean {
  const COORD_TOLERANCE = 0.5; // ~50km tolerance - country-level locations can be far from cities

  return existing.some(loc => {
    // Check by coordinates (within tolerance)
    const coordMatch = Math.abs(loc.lat - newLoc.lat) < COORD_TOLERANCE &&
                       Math.abs(loc.lng - newLoc.lng) < COORD_TOLERANCE;
    // Check by name (case insensitive, trimmed)
    const existingName = loc.name.toLowerCase().trim();
    const newName = newLoc.name.toLowerCase().trim();
    const nameMatch = existingName === newName;
    // Check if one name contains the other (e.g., "New York" vs "New York, New York, United States")
    const containmentMatch = existingName.includes(newName) || newName.includes(existingName);

    // Check for country abbreviation matches (e.g., "UK" when location contains "United Kingdom")
    let abbreviationMatch = false;
    for (const [abbrev, fullNames] of Object.entries(COUNTRY_ABBREVIATIONS)) {
      // If new location is an abbreviation, check if existing contains a full name
      if (newName === abbrev || newName === abbrev.toUpperCase().toLowerCase()) {
        abbreviationMatch = fullNames.some(fullName => existingName.includes(fullName));
      }
      // If existing location is an abbreviation, check if new contains a full name
      if (existingName === abbrev) {
        abbreviationMatch = abbreviationMatch || fullNames.some(fullName => newName.includes(fullName));
      }
    }

    return coordMatch || nameMatch || containmentMatch || abbreviationMatch;
  });
}

// Initialize Supabase with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TrackSubmission {
  // Core required
  content_type: string;
  title: string;
  artist: string;

  // Optional metadata
  description?: string;
  notes?: string;
  credits?: string;
  tags?: string[];
  bpm?: number;
  key?: string;
  duration?: number;
  loop_category?: string;
  tell_us_more?: string;

  // Video crop data
  video_crop_x?: number;
  video_crop_y?: number;
  video_crop_width?: number;
  video_crop_height?: number;
  video_crop_zoom?: number;
  video_natural_width?: number;
  video_natural_height?: number;

  // Location
  primary_location?: string;
  location_lat?: number;
  location_lng?: number;

  // AI tracking
  ai_assisted_idea?: boolean;
  ai_assisted_implementation?: boolean;

  // Licensing
  allow_downloads?: boolean;
  allow_streaming?: boolean;
  allow_remixing?: boolean;
  download_price_stx?: number;
  open_to_collaboration?: boolean;
  open_to_commercial?: boolean;
  commercial_contact?: string;
  collab_contact?: string;
  // Contact access
  contact_email?: string;
  contact_fee_stx?: number;
  // Sacred/devotional content protection
  remix_protected?: boolean;

  // Media URLs
  audio_url?: string;
  video_url?: string;
  cover_image_url?: string;

  // Pre-generated thumbnail URLs (from upload-file endpoint)
  thumb_64_url?: string;
  thumb_160_url?: string;
  thumb_256_url?: string;

  // Splits (may include names without wallets for pending collaborators)
  composition_splits?: Array<{
    wallet?: string;
    name?: string;
    percentage: number;
  }>;
  production_splits?: Array<{
    wallet?: string;
    name?: string;
    percentage: number;
  }>;

  // Pack/EP specific
  pack_title?: string;
  ep_title?: string;
  loop_files?: string[];
  ep_files?: string[];
}

/**
 * Sanitize a name into a valid username
 */
function sanitizeUsername(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
}

/**
 * Create managed personas for collaborators with create_persona flag
 * Modifies the splits array in place, adding wallet addresses for created personas
 */
async function createManagedPersonasForSplits(
  splits: Array<{ wallet?: string; name?: string; percentage: number; create_persona?: boolean; username?: string }> | undefined,
  uploaderWallet: string,
  supabaseClient: SupabaseClient
): Promise<void> {
  if (!splits || splits.length === 0) return;

  // Find the uploader's account ID
  const { data: uploaderPersona } = await supabaseClient
    .from('personas')
    .select('account_id')
    .or(`wallet_address.eq.${uploaderWallet},sui_address.eq.${uploaderWallet}`)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!uploaderPersona?.account_id) {
    console.log('⚠️ Could not find uploader account - skipping persona creation');
    return;
  }

  const accountId = uploaderPersona.account_id;

  for (const split of splits) {
    // Skip if doesn't need persona creation
    if (!split.create_persona || !split.name) continue;
    // Skip if already has a wallet
    if (split.wallet) continue;

    console.log(`🆕 Creating managed persona for collaborator: "${split.name}"`);

    // Generate unique username
    let baseUsername = sanitizeUsername(split.name);
    if (baseUsername.length < 3) {
      baseUsername = `collab-${baseUsername || 'user'}`;
    }

    let username = baseUsername;
    let suffix = 1;
    let usernameAvailable = false;

    while (!usernameAvailable && suffix < 100) {
      const { data: existing } = await supabaseClient
        .from('personas')
        .select('username')
        .eq('username', username)
        .limit(1)
        .maybeSingle();

      if (!existing) {
        usernameAvailable = true;
      } else {
        username = `${baseUsername}-${suffix}`;
        suffix++;
      }
    }

    if (!usernameAvailable) {
      console.error(`❌ Could not generate unique username for "${split.name}"`);
      continue;
    }

    // Generate SUI wallet
    const keypair = generateKeypair();
    const suiAddress = getAddressFromKeypair(keypair);

    // Create the persona
    const { data: newPersona, error: createError } = await supabaseClient
      .from('personas')
      .insert({
        account_id: accountId,
        username: username,
        display_name: split.name,
        wallet_address: suiAddress,
        sui_address: suiAddress,
        is_default: false,
        is_active: true,
        balance_usdc: 0
      })
      .select('id, username, sui_address')
      .single();

    if (createError) {
      console.error(`❌ Failed to create persona for "${split.name}":`, createError);
      continue;
    }

    console.log(`✅ Created managed persona @${username} with wallet ${suiAddress}`);

    // Update the split with the new wallet address
    split.wallet = newPersona.sui_address;
    split.username = newPersona.username;
    delete split.create_persona; // Clean up the flag
  }
}

/**
 * Update agent_preferences after a successful upload.
 * Simple frequency tracking — learns defaults from what the creator actually does.
 * Fire-and-forget: errors here should never block the upload response.
 */
async function updateAgentPreferences(
  personaId: string | undefined,
  walletAddress: string,
  trackData: TrackSubmission,
  contentType: string
): Promise<void> {
  if (!personaId) return;

  try {
    // Load existing preferences
    const { data: prefs, error: prefsError } = await supabase
      .from('agent_preferences')
      .select('*')
      .eq('persona_id', personaId)
      .maybeSingle();

    if (prefsError) {
      console.warn('⚠️ Could not load preferences for learning:', prefsError);
      return;
    }

    // If no preferences row exists, create one (lazy creation for non-default personas)
    if (!prefs) {
      const { error: insertError } = await supabase
        .from('agent_preferences')
        .insert({ persona_id: personaId })
        .select('*')
        .single();

      if (insertError) {
        console.warn('⚠️ Could not create preferences for learning:', insertError);
        return;
      }
      // Re-fetch after creation
      const { data: newPrefs } = await supabase
        .from('agent_preferences')
        .select('*')
        .eq('persona_id', personaId)
        .maybeSingle();

      if (!newPrefs) return;
      return updateAgentPreferences(personaId, walletAddress, trackData, contentType);
    }

    const updates: Record<string, any> = {
      upload_count: (prefs.upload_count || 0) + 1,
      updated_at: new Date().toISOString()
    };

    // Content type: set on first upload, keep most recent
    updates.typical_content_type = contentType;

    // BPM range: expand range based on this upload
    if (trackData.bpm && trackData.bpm > 0) {
      const currentRange = prefs.typical_bpm_range || {};
      const currentMin = currentRange.min || trackData.bpm;
      const currentMax = currentRange.max || trackData.bpm;
      updates.typical_bpm_range = {
        min: Math.min(currentMin, trackData.bpm),
        max: Math.max(currentMax, trackData.bpm)
      };
    }

    // Tags: merge non-location tags (keep top 10 most recent unique)
    const nonLocationTags = (trackData.tags || []).filter(t => !t.startsWith('🌍'));
    if (nonLocationTags.length > 0) {
      const existingTags: string[] = prefs.default_tags || [];
      // New tags first (most recent), then existing, deduplicated
      const merged = [...new Set([...nonLocationTags, ...existingTags])].slice(0, 10);
      updates.default_tags = merged;
    }

    // Cultural tags: merge location tags (keep top 5)
    const locationTags = (trackData.tags || [])
      .filter(t => t.startsWith('🌍'))
      .map(t => t.replace('🌍 ', ''));
    if (locationTags.length > 0) {
      const existingCultural: string[] = prefs.default_cultural_tags || [];
      const merged = [...new Set([...locationTags, ...existingCultural])].slice(0, 5);
      updates.default_cultural_tags = merged;
    }

    // Licensing defaults: use most recent values
    if (trackData.allow_remixing !== undefined) {
      updates.default_allow_remixing = trackData.allow_remixing;
    }
    if (trackData.allow_downloads !== undefined) {
      updates.default_allow_downloads = trackData.allow_downloads;
    }
    if (trackData.download_price_stx && trackData.allow_downloads) {
      updates.default_download_price_usdc = trackData.download_price_stx;
    }

    // Splits template: store if there are named collaborators
    const namedSplits: Array<{ name: string; percentage: number; role: string }> = [];
    for (const split of (trackData.composition_splits || [])) {
      if (split.name && split.name !== trackData.artist) {
        namedSplits.push({ name: split.name, percentage: split.percentage, role: 'composition' });
      }
    }
    for (const split of (trackData.production_splits || [])) {
      if (split.name && split.name !== trackData.artist) {
        namedSplits.push({ name: split.name, percentage: split.percentage, role: 'production' });
      }
    }
    if (namedSplits.length > 0) {
      updates.default_splits_template = namedSplits;
    }

    // Save
    const { error: updateError } = await supabase
      .from('agent_preferences')
      .update(updates)
      .eq('persona_id', personaId);

    if (updateError) {
      console.warn('⚠️ Preference learning failed:', updateError);
    } else {
      console.log('🧠 Agent preferences updated:', {
        personaId: personaId.substring(0, 8) + '...',
        uploadCount: updates.upload_count,
        contentType: updates.typical_content_type,
        tagsLearned: nonLocationTags.length,
        culturalTagsLearned: locationTags.length
      });
    }
  } catch (error) {
    console.warn('⚠️ Preference learning error (non-fatal):', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackData, walletAddress, personaId, conversationId } = body;

    // Debug logging
    console.log('📥 Submit request received:', {
      hasTrackData: !!trackData,
      walletAddress: walletAddress?.substring(0, 15) + '...',
      conversationId,
      contentType: trackData?.content_type,
      title: trackData?.title,
      artist: trackData?.artist,
      hasAudioUrl: !!trackData?.audio_url,
      loopFilesCount: trackData?.loop_files?.length || 0,
      epFilesCount: trackData?.ep_files?.length || 0,
      bpm: trackData?.bpm
    });

    // Validate required fields
    if (!walletAddress) {
      console.log('❌ Validation failed: No wallet address');
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // For packs/EPs, title comes from pack_title or ep_title
    const effectiveTitle = trackData?.title || trackData?.pack_title || trackData?.ep_title;

    if (!trackData || !effectiveTitle || !trackData.artist) {
      console.log('❌ Validation failed: Missing title or artist', {
        title: trackData?.title,
        pack_title: trackData?.pack_title,
        ep_title: trackData?.ep_title,
        artist: trackData?.artist
      });
      return NextResponse.json(
        { error: 'Track title and artist required' },
        { status: 400 }
      );
    }

    // Normalize title for downstream use
    trackData.title = effectiveTitle;

    // Resolve wallet address (handle alpha codes)
    const effectiveWallet = await getWalletFromAuthIdentity(walletAddress);
    if (!effectiveWallet) {
      console.log('❌ Validation failed: Could not resolve wallet', { walletAddress });
      return NextResponse.json(
        { error: 'Could not resolve wallet address' },
        { status: 400 }
      );
    }

    // Determine content type
    // Auto-detect loop_pack if multiple loop files are provided (chatbot may say "loop" but mean "loop_pack")
    let contentType = trackData.content_type || 'loop';

    // Normalize content type names (chatbot uses friendly names, database uses technical names)
    if (contentType === 'song') {
      contentType = 'full_song';
      console.log('📋 Normalized content_type: song → full_song');
    }

    if (contentType === 'loop' && trackData.loop_files && trackData.loop_files.length > 1) {
      console.log('📦 Auto-upgrading content_type to loop_pack (detected multiple loop_files)');
      contentType = 'loop_pack';
    }
    console.log('📋 Content type determined:', contentType);

    // Validate content type specific requirements
    if (contentType === 'loop' && !trackData.bpm) {
      console.log('❌ Validation failed: Loop missing BPM');
      return NextResponse.json(
        { error: 'BPM is required for loops' },
        { status: 400 }
      );
    }

    // For multi-file content types, audio is in loop_files or ep_files arrays
    const hasMultiFileAudio = (trackData.loop_files?.length > 0) || (trackData.ep_files?.length > 0);
    console.log('📋 Multi-file check:', { hasMultiFileAudio, loopFiles: trackData.loop_files?.length, epFiles: trackData.ep_files?.length });

    if (!trackData.audio_url && contentType !== 'video_clip' && contentType !== 'loop_pack' && contentType !== 'ep' && !hasMultiFileAudio) {
      console.log('❌ Validation failed: No audio file');
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      );
    }

    if (contentType === 'video_clip' && !trackData.video_url) {
      console.log('❌ Validation failed: Video clip missing video');
      return NextResponse.json(
        { error: 'Video file is required for video clips' },
        { status: 400 }
      );
    }

    // Handle multi-file uploads (loop packs and EPs)
    if ((contentType === 'loop_pack' || contentType === 'ep') &&
        (trackData.loop_files?.length > 0 || trackData.ep_files?.length > 0)) {
      return await handleMultiFileSubmission(
        trackData,
        contentType,
        effectiveWallet,
        conversationId,
        personaId
      );
    }

    // Create managed personas for collaborators with create_persona flag
    await createManagedPersonasForSplits(trackData.composition_splits, effectiveWallet, supabase);
    await createManagedPersonasForSplits(trackData.production_splits, effectiveWallet, supabase);

    // Process splits - handle pending collaborators
    const compositionSplits = processSplits(trackData.composition_splits, effectiveWallet);
    let productionSplits = processSplits(trackData.production_splits, effectiveWallet);

    // Handle AI involvement in implementation splits
    // ai_assisted_idea=true means AI-Generated (100% AI implementation)
    // ai_assisted_idea=false + ai_assisted_implementation=true means AI-Assisted (50/50)
    if (trackData.ai_assisted_implementation) {
      if (trackData.ai_assisted_idea) {
        // AI-Generated: 100% AI for implementation
        productionSplits = [{ wallet: 'AI', percentage: 100, name: 'AI' }];
        console.log('🤖 AI-Generated: Setting implementation to 100% AI');
      } else {
        // AI-Assisted: 50% human, 50% AI
        // Halve the human percentages and add 50% AI
        const totalHumanPercent = productionSplits.reduce((sum, s) => sum + s.percentage, 0);
        productionSplits = productionSplits.map(s => ({
          ...s,
          percentage: Math.round(s.percentage * 0.5) // Halve human percentages
        }));
        productionSplits.push({ wallet: 'AI', percentage: 50, name: 'AI' });
        console.log('✨ AI-Assisted: Setting implementation to 50% human / 50% AI');
      }
    }

    // Check for pending collaborators (those with names but no wallets)
    const pendingCollaborators = [
      ...extractPendingCollaborators(trackData.composition_splits, 'composition'),
      ...extractPendingCollaborators(trackData.production_splits, 'production')
    ];

    // Handle "derived from" relationship (loop from a song) - NOT the same as remix!
    // This is provenance/lineage tracking, stored in notes and a separate field
    // remix_depth and source_track_ids are ONLY for mixer-created remixes
    let derivedFromTrackId: string | null = null;

    if (trackData.source_track_title) {
      console.log('🔗 Looking up derived-from track:', trackData.source_track_title);

      // Search for tracks by this user with matching title
      const { data: matchingTracks, error: searchError } = await supabase
        .from('ip_tracks')
        .select('id, title')
        .eq('primary_uploader_wallet', effectiveWallet)
        .ilike('title', `%${trackData.source_track_title}%`)
        .limit(5);

      if (searchError) {
        console.warn('⚠️ Derived-from track search error:', searchError);
      } else if (matchingTracks && matchingTracks.length > 0) {
        derivedFromTrackId = matchingTracks[0].id;
        console.log('✅ Found derived-from track:', matchingTracks[0].title, matchingTracks[0].id);
        // ID is stored in derived_from_track_id field - no need to duplicate in notes
      } else {
        console.log('⚠️ No matching track found for:', trackData.source_track_title);
        // Couldn't find the track by ID, store the title in notes as fallback
        trackData.notes = (trackData.notes || '') + `\n\nDerived from: ${trackData.source_track_title}`;
      }
    }

    // Geocode location if provided as text but without coordinates
    let locationLat = trackData.location_lat;
    let locationLng = trackData.location_lng;
    let primaryLocation = trackData.primary_location;
    let locationCountry: string | null = null;
    let locationRegion: string | null = null;
    let allLocations: Array<{ lat: number; lng: number; name: string; country?: string; region?: string }> | null = null;

    // The chatbot stores location as "location" (text), we need to geocode it
    const locationText = (trackData as any).location || trackData.primary_location;
    if (locationText && (!locationLat || !locationLng)) {
      console.log('📍 Geocoding location:', locationText);
      const locationResult = await parseLocationsAndGetCoordinates(locationText);
      if (locationResult.primary && locationResult.primary.lat !== 0 && locationResult.primary.lng !== 0) {
        locationLat = locationResult.primary.lat;
        locationLng = locationResult.primary.lng;
        primaryLocation = locationResult.primary.name;
        locationCountry = locationResult.primary.country || null;
        locationRegion = locationResult.primary.region || null;
        console.log('✅ Geocoded to:', primaryLocation, `(${locationLat}, ${locationLng})`, `[${locationRegion}, ${locationCountry}]`);

        // Store all locations if there are multiple
        if (locationResult.all.length > 0) {
          allLocations = locationResult.all.filter(loc => loc.lat !== 0 && loc.lng !== 0);
          if (allLocations.length > 1) {
            console.log('📍 Multiple locations found:', allLocations.map(l => l.name).join(', '));
          }
        }
      } else {
        // Store the text even if we couldn't geocode
        primaryLocation = locationText;
        console.log('⚠️ Could not geocode location, storing text only:', locationText);
      }
    }

    // Handle additional_locations from chatbot (separate from primary location)
    const additionalLocations: string[] = (trackData as any).additional_locations || [];
    if (additionalLocations.length > 0) {
      console.log('📍 Processing additional locations:', additionalLocations);

      // Initialize allLocations with primary if not already set
      if (!allLocations && locationLat && locationLng && primaryLocation) {
        allLocations = [{
          lat: locationLat,
          lng: locationLng,
          name: primaryLocation,
          country: locationCountry || undefined,
          region: locationRegion || undefined
        }];
      }

      // Geocode each additional location and add to allLocations
      for (const additionalLoc of additionalLocations) {
        console.log('📍 Geocoding additional location:', additionalLoc);
        const additionalResult = await parseLocationsAndGetCoordinates(additionalLoc);
        if (additionalResult.primary && additionalResult.primary.lat !== 0 && additionalResult.primary.lng !== 0) {
          const newLoc = {
            lat: additionalResult.primary.lat,
            lng: additionalResult.primary.lng,
            name: additionalResult.primary.name,
            country: additionalResult.primary.country || undefined,
            region: additionalResult.primary.region || undefined
          };

          // Add to allLocations if not already present (check by coordinates AND name)
          if (!allLocations) {
            allLocations = [newLoc];
            console.log('✅ Added additional location:', newLoc.name);
          } else if (!isLocationDuplicate(allLocations, newLoc)) {
            allLocations.push(newLoc);
            console.log('✅ Added additional location:', newLoc.name);
          } else {
            console.log('⏭️ Skipping duplicate location:', newLoc.name);
          }
        } else {
          console.log('⚠️ Could not geocode additional location:', additionalLoc);
        }
      }

      if (allLocations && allLocations.length > 1) {
        console.log('🌐 Total locations for globe arcs:', allLocations.map(l => l.name).join(' ↔ '));
      }
    }

    // Build tags array with location tags (🌍 prefix like the form does)
    let tags = trackData.tags || [];

    // Remove any existing location tags first (chatbot might have added duplicates)
    tags = tags.filter((t: string) => !t.startsWith('🌍'));

    // Add ALL locations as tags (primary + additional)
    if (allLocations && allLocations.length > 0) {
      // Add each location as a tag, checking for containment to avoid partial duplicates
      for (const loc of allLocations) {
        const locationTag = `🌍 ${loc.name}`;
        const locNameLower = loc.name.toLowerCase();
        // Check if this location is already represented (exact or containment)
        const isDuplicate = tags.some((t: string) => {
          if (!t.startsWith('🌍')) return false;
          const existingName = t.replace('🌍 ', '').toLowerCase();
          return existingName === locNameLower ||
                 existingName.includes(locNameLower) ||
                 locNameLower.includes(existingName);
        });
        if (!isDuplicate) {
          tags = [...tags, locationTag];
        }
      }
      console.log('📍 Added location tags:', tags.filter((t: string) => t.startsWith('🌍')).join(', '));
    } else if (primaryLocation) {
      // Fallback to just primary location if allLocations not set
      const locationTag = `🌍 ${primaryLocation}`;
      tags = [...tags, locationTag];
    }

    // Build the track record
    const trackId = uuidv4();
    const now = new Date().toISOString();

    const trackRecord = {
      id: trackId,
      title: trackData.pack_title || trackData.ep_title || trackData.title,
      version: '',
      artist: trackData.artist,
      description: trackData.description || '',
      tags: tags,
      notes: [
        trackData.notes || trackData.tell_us_more || '',
        trackData.credits ? `Credits: ${trackData.credits}` : ''
      ].filter(Boolean).join('\n\n').trim() || '',
      content_type: contentType,
      loop_category: contentType === 'loop' ? (trackData.loop_category || 'instrumental') : null,
      sample_type: contentType === 'loop' ? 'instrumentals' : 'FULL SONGS',

      // BPM handling - all content types can have BPM (everything is remixable)
      bpm: trackData.bpm || null,
      key: trackData.key || null,
      duration: trackData.duration || null,

      // Media URLs
      audio_url: trackData.audio_url || null,
      video_url: trackData.video_url || null,
      cover_image_url: trackData.cover_image_url || null,

      // Pre-generated thumbnail URLs
      thumb_64_url: trackData.thumb_64_url || null,
      thumb_160_url: trackData.thumb_160_url || null,
      thumb_256_url: trackData.thumb_256_url || null,

      // Video crop data (for video clips)
      video_crop_x: trackData.video_crop_x ?? null,
      video_crop_y: trackData.video_crop_y ?? null,
      video_crop_width: trackData.video_crop_width ?? null,
      video_crop_height: trackData.video_crop_height ?? null,
      video_crop_zoom: trackData.video_crop_zoom ?? null,
      video_natural_width: trackData.video_natural_width ?? null,
      video_natural_height: trackData.video_natural_height ?? null,

      // Location (geocoded)
      primary_location: primaryLocation || null,
      location_lat: locationLat || null,
      location_lng: locationLng || null,
      // Note: location_country and location_region columns don't exist yet - storing in locations array
      locations: allLocations && allLocations.length > 0 ? allLocations : null,

      // Composition splits
      composition_split_1_wallet: compositionSplits[0]?.wallet || effectiveWallet,
      composition_split_1_percentage: compositionSplits[0]?.percentage || 100,
      composition_split_2_wallet: compositionSplits[1]?.wallet || null,
      composition_split_2_percentage: compositionSplits[1]?.percentage || 0,
      composition_split_3_wallet: compositionSplits[2]?.wallet || null,
      composition_split_3_percentage: compositionSplits[2]?.percentage || 0,

      // Production splits
      production_split_1_wallet: productionSplits[0]?.wallet || effectiveWallet,
      production_split_1_percentage: productionSplits[0]?.percentage || 100,
      production_split_2_wallet: productionSplits[1]?.wallet || null,
      production_split_2_percentage: productionSplits[1]?.percentage || 0,
      production_split_3_wallet: productionSplits[2]?.wallet || null,
      production_split_3_percentage: productionSplits[2]?.percentage || 0,

      // AI tracking
      ai_assisted_idea: trackData.ai_assisted_idea || false,
      ai_assisted_implementation: trackData.ai_assisted_implementation || false,

      // Licensing
      license_type: trackData.allow_downloads ? 'remix_external' : 'remix_only',
      license_selection: contentType === 'full_song' ? 'platform_download' : 'platform_remix',
      allow_remixing: contentType !== 'full_song' ? (trackData.allow_remixing ?? true) : false,
      allow_downloads: trackData.allow_downloads ?? false,
      allow_streaming: trackData.allow_streaming ?? true,
      remix_protected: trackData.remix_protected ?? false, // Sacred/devotional content protection
      open_to_collaboration: trackData.open_to_collaboration ?? false,
      open_to_commercial: trackData.open_to_commercial ?? false,
      // Contact access - use same email/fee for both commercial and collab
      // Default to $1 USDC if they're open to collaboration/commercial but didn't set a fee
      commercial_contact: trackData.contact_email || trackData.commercial_contact || null,
      commercial_contact_fee: trackData.contact_fee_stx ?? ((trackData.open_to_commercial || trackData.open_to_collaboration) ? PRICING.contact.inquiryFee : null),
      collab_contact: trackData.contact_email || trackData.collab_contact || null,
      collab_contact_fee: trackData.contact_fee_stx ?? ((trackData.open_to_commercial || trackData.open_to_collaboration) ? PRICING.contact.inquiryFee : null),
      contact_fee_usdc: trackData.contact_fee_stx ?? ((trackData.open_to_commercial || trackData.open_to_collaboration) ? PRICING.contact.inquiryFee : null),

      // USDC Pricing (primary)
      remix_price_usdc: contentType === 'full_song' ? 0 : PRICING.mixer.loopRecording,
      download_price_usdc: trackData.allow_downloads
        ? (trackData.download_price_stx || (contentType === 'full_song' ? PRICING.download.song : PRICING.download.loop))
        : null,
      // Legacy STX columns (same values for backwards compat)
      remix_price_stx: contentType === 'full_song' ? 0 : PRICING.mixer.loopRecording,
      download_price_stx: trackData.allow_downloads
        ? (trackData.download_price_stx || (contentType === 'full_song' ? PRICING.download.song : PRICING.download.loop))
        : null,
      price_stx: trackData.allow_downloads
        ? (trackData.download_price_stx || (contentType === 'full_song' ? PRICING.download.song : PRICING.download.loop))
        : PRICING.mixer.loopRecording,

      // Metadata
      created_at: now,
      updated_at: now,
      is_live: true,
      uploader_address: effectiveWallet,
      primary_uploader_wallet: effectiveWallet,
      account_name: effectiveWallet,
      main_wallet_name: effectiveWallet,

      // Remix tracking (ONLY for mixer-created remixes, not for "derived from" relationships)
      remix_depth: contentType === 'loop' ? 0 : null,
      source_track_ids: [],

      // External release linkage
      isrc: trackData.isrc || null,

      // Provenance tracking (where this content came from)
      derived_from_track_id: derivedFromTrackId,

      // Collaboration
      collaboration_preferences: {},
      store_display_policy: 'primary_only',
      collaboration_type: 'primary_artist',

      // Source metadata
      upload_source: 'conversational',
      conversation_id: conversationId
    };

    console.log('📝 Submitting track via Upload Studio:', {
      id: trackId,
      title: trackRecord.title,
      contentType,
      wallet: effectiveWallet.substring(0, 10) + '...'
    });

    // Insert into database
    const { data, error } = await supabase
      .from('ip_tracks')
      .insert([trackRecord])
      .select('id, title, artist, content_type, created_at');

    if (error) {
      console.error('❌ Track insert error:', error);
      return NextResponse.json(
        { error: `Failed to save track: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('✅ Track saved:', data[0]);

    // If there are pending collaborators, save them for later resolution
    if (pendingCollaborators.length > 0) {
      await savePendingCollaborators(trackId, pendingCollaborators, effectiveWallet);
    }

    // Learn preferences from this upload (fire-and-forget)
    updateAgentPreferences(personaId, effectiveWallet, trackData, contentType).catch(() => {});

    // Clean up draft if one exists for this conversation (fire-and-forget)
    if (conversationId) {
      supabase
        .from('ip_tracks')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('is_draft', true)
        .then(() => console.log('🗑️ Draft cleaned up'))
        .catch(() => {});
    }

    return NextResponse.json({
      success: true,
      trackId,
      track: data[0],
      pendingCollaborators: pendingCollaborators.length
    });

  } catch (error: any) {
    console.error('Submit error:', error);
    return NextResponse.json(
      { error: 'Submission failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Process splits array, using default wallet for entries without wallets
 * Name-only collaborators get a placeholder wallet that indicates pending status
 */
function processSplits(
  splits: Array<{ wallet?: string; name?: string; percentage: number }> | undefined,
  defaultWallet: string
): Array<{ wallet: string; percentage: number; name?: string }> {
  if (!splits || splits.length === 0) {
    return [{ wallet: defaultWallet, percentage: 100 }];
  }

  return splits.map((split, index) => {
    let wallet = split.wallet || '';

    // If no wallet but has a name, use "pending:name" format
    // This allows us to display the name and later resolve to a wallet
    if (!wallet && split.name) {
      wallet = `pending:${split.name}`;
    }
    // Only default to uploader wallet if NEITHER wallet nor name is specified
    else if (!wallet && !split.name && index === 0) {
      wallet = defaultWallet;
    }

    return {
      wallet,
      percentage: Math.round(split.percentage), // Round to integer for database compatibility
      name: split.name
    };
  }).filter(s => s.percentage > 0);
}

/**
 * Extract collaborators that have names but no wallet addresses
 */
function extractPendingCollaborators(
  splits: Array<{ wallet?: string; name?: string; percentage: number }> | undefined,
  type: 'composition' | 'production'
): Array<{ name: string; percentage: number; type: string; position: number }> {
  if (!splits) return [];

  return splits
    .map((s, index) => ({ ...s, position: index + 1 }))
    .filter(s => s.name && !s.wallet && s.percentage > 0)
    .map(s => ({
      name: s.name!,
      percentage: s.percentage,
      type,
      position: s.position
    }));
}

/**
 * Save pending collaborators for later wallet resolution
 * Inserts into pending_collaborators table
 */
async function savePendingCollaborators(
  trackId: string,
  collaborators: Array<{ name: string; percentage: number; type: string; position: number }>,
  createdBy: string
) {
  if (collaborators.length === 0) return;

  console.log('📋 Saving pending collaborators for track', trackId, ':', collaborators);

  const records = collaborators.map(c => ({
    track_id: trackId,
    collaborator_name: c.name,
    split_percentage: c.percentage,
    split_type: c.type,
    split_position: c.position,
    status: 'pending',
    created_by: createdBy
  }));

  const { error } = await supabase
    .from('pending_collaborators')
    .insert(records);

  if (error) {
    console.error('❌ Error saving pending collaborators:', error);
    // Don't throw - the track is already saved, this is supplementary
  } else {
    console.log('✅ Saved', records.length, 'pending collaborators');
  }
}

/**
 * Handle multi-file submissions for loop packs and EPs
 * Creates a parent container record + individual track records
 */
async function handleMultiFileSubmission(
  trackData: TrackSubmission,
  contentType: string,
  effectiveWallet: string,
  conversationId: string,
  personaId?: string
) {
  const now = new Date().toISOString();
  const packId = uuidv4();

  // Get the files array based on content type
  const files = contentType === 'loop_pack'
    ? trackData.loop_files || []
    : trackData.ep_files || [];

  // Get original filenames array (parallel to files array)
  // These are the actual filenames users uploaded, preserved for track titles
  const originalFilenames: string[] = trackData.original_filenames || [];
  console.log('📎 Original filenames received:', originalFilenames.length > 0 ? originalFilenames : 'none');

  if (files.length === 0) {
    return NextResponse.json(
      { error: 'No files provided for pack/EP' },
      { status: 400 }
    );
  }

  // Determine child content type
  const childContentType = contentType === 'loop_pack' ? 'loop' : 'full_song';

  // Get the pack/EP title
  const containerTitle = contentType === 'loop_pack'
    ? trackData.pack_title || trackData.title
    : trackData.ep_title || trackData.title;

  console.log(`📦 Creating ${contentType} with ${files.length} tracks:`, containerTitle);

  // Process splits - same for all tracks in the pack
  const compositionSplits = processSplits(trackData.composition_splits, effectiveWallet);
  const productionSplits = processSplits(trackData.production_splits, effectiveWallet);

  // Geocode location if provided as text but without coordinates
  let locationLat = trackData.location_lat;
  let locationLng = trackData.location_lng;
  let primaryLocation = trackData.primary_location;
  let locationCountry: string | null = null;
  let locationRegion: string | null = null;
  let allLocations: Array<{ lat: number; lng: number; name: string; country?: string; region?: string }> | null = null;

  const locationText = (trackData as any).location || trackData.primary_location;
  if (locationText && (!locationLat || !locationLng)) {
    console.log('📍 Geocoding location for pack:', locationText);
    const locationResult = await parseLocationsAndGetCoordinates(locationText);
    if (locationResult.primary && locationResult.primary.lat !== 0 && locationResult.primary.lng !== 0) {
      locationLat = locationResult.primary.lat;
      locationLng = locationResult.primary.lng;
      primaryLocation = locationResult.primary.name;
      locationCountry = locationResult.primary.country || null;
      locationRegion = locationResult.primary.region || null;
      console.log('✅ Geocoded to:', primaryLocation, `(${locationLat}, ${locationLng})`, `[${locationRegion}, ${locationCountry}]`);

      // Store all locations if there are multiple
      if (locationResult.all.length > 0) {
        allLocations = locationResult.all.filter(loc => loc.lat !== 0 && loc.lng !== 0);
        if (allLocations.length > 1) {
          console.log('📍 Multiple locations found:', allLocations.map(l => l.name).join(', '));
        }
      }
    } else {
      primaryLocation = locationText;
      console.log('⚠️ Could not geocode location, storing text only:', locationText);
    }
  }

  // Handle additional_locations from chatbot (separate from primary location)
  const additionalLocations: string[] = (trackData as any).additional_locations || [];
  if (additionalLocations.length > 0) {
    console.log('📍 Processing additional locations for pack:', additionalLocations);

    // Initialize allLocations with primary if not already set
    if (!allLocations && locationLat && locationLng && primaryLocation) {
      allLocations = [{
        lat: locationLat,
        lng: locationLng,
        name: primaryLocation,
        country: locationCountry || undefined,
        region: locationRegion || undefined
      }];
    }

    // Geocode each additional location and add to allLocations
    for (const additionalLoc of additionalLocations) {
      console.log('📍 Geocoding additional location:', additionalLoc);
      const additionalResult = await parseLocationsAndGetCoordinates(additionalLoc);
      if (additionalResult.primary && additionalResult.primary.lat !== 0 && additionalResult.primary.lng !== 0) {
        const newLoc = {
          lat: additionalResult.primary.lat,
          lng: additionalResult.primary.lng,
          name: additionalResult.primary.name,
          country: additionalResult.primary.country || undefined,
          region: additionalResult.primary.region || undefined
        };

        // Add to allLocations if not already present (check by coordinates AND name)
        if (!allLocations) {
          allLocations = [newLoc];
          console.log('✅ Added additional location:', newLoc.name);
        } else if (!isLocationDuplicate(allLocations, newLoc)) {
          allLocations.push(newLoc);
          console.log('✅ Added additional location:', newLoc.name);
        } else {
          console.log('⏭️ Skipping duplicate location:', newLoc.name);
        }
      } else {
        console.log('⚠️ Could not geocode additional location:', additionalLoc);
      }
    }

    if (allLocations && allLocations.length > 1) {
      console.log('🌐 Total locations for globe arcs:', allLocations.map(l => l.name).join(' ↔ '));
    }
  }

  // Build tags array with location tags (🌍 prefix like the form does)
  let tags = trackData.tags || [];

  // Remove any existing location tags first (chatbot might have added duplicates)
  tags = tags.filter((t: string) => !t.startsWith('🌍'));

  // Add ALL locations as tags (primary + additional)
  if (allLocations && allLocations.length > 0) {
    // Add each location as a tag, checking for containment to avoid partial duplicates
    for (const loc of allLocations) {
      const locationTag = `🌍 ${loc.name}`;
      const locNameLower = loc.name.toLowerCase();
      // Check if this location is already represented (exact or containment)
      const isDuplicate = tags.some((t: string) => {
        if (!t.startsWith('🌍')) return false;
        const existingName = t.replace('🌍 ', '').toLowerCase();
        return existingName === locNameLower ||
               existingName.includes(locNameLower) ||
               locNameLower.includes(existingName);
      });
      if (!isDuplicate) {
        tags = [...tags, locationTag];
      }
    }
    console.log('📍 Added location tags:', tags.filter((t: string) => t.startsWith('🌍')).join(', '));
  } else if (primaryLocation) {
    // Fallback to just primary location if allLocations not set
    const locationTag = `🌍 ${primaryLocation}`;
    tags = [...tags, locationTag];
  }

  // 1. Create the container record (the pack/EP itself)
  const containerRecord = {
    id: packId,
    title: containerTitle,
    version: '',
    artist: trackData.artist,
    description: trackData.description || '',
    tags: tags,
    notes: [
      trackData.notes || trackData.tell_us_more || '',
      trackData.credits ? `Credits: ${trackData.credits}` : ''
    ].filter(Boolean).join('\n\n').trim() || '',
    content_type: contentType,
    loop_category: contentType === 'loop_pack' ? (trackData.loop_category || 'instrumental') : null,
    sample_type: contentType === 'loop_pack' ? 'instrumentals' : 'FULL SONGS',

    // BPM (for loop packs and optionally for EPs)
    bpm: (contentType === 'loop_pack' || contentType === 'ep') ? (trackData.bpm || null) : null,
    key: trackData.key || null,
    duration: trackData.duration || null,

    // Container doesn't have its own audio - first child's audio is preview
    audio_url: files[0] || null,
    video_url: null,
    cover_image_url: trackData.cover_image_url || null,

    // Pre-generated thumbnail URLs
    thumb_64_url: trackData.thumb_64_url || null,
    thumb_160_url: trackData.thumb_160_url || null,
    thumb_256_url: trackData.thumb_256_url || null,

    // Location (geocoded)
    primary_location: primaryLocation || null,
    location_lat: locationLat || null,
    location_lng: locationLng || null,
    // Note: location_country and location_region columns don't exist yet
    locations: allLocations && allLocations.length > 0 ? allLocations : null,

    // Splits
    composition_split_1_wallet: compositionSplits[0]?.wallet || effectiveWallet,
    composition_split_1_percentage: compositionSplits[0]?.percentage || 100,
    composition_split_2_wallet: compositionSplits[1]?.wallet || null,
    composition_split_2_percentage: compositionSplits[1]?.percentage || 0,
    composition_split_3_wallet: compositionSplits[2]?.wallet || null,
    composition_split_3_percentage: compositionSplits[2]?.percentage || 0,
    production_split_1_wallet: productionSplits[0]?.wallet || effectiveWallet,
    production_split_1_percentage: productionSplits[0]?.percentage || 100,
    production_split_2_wallet: productionSplits[1]?.wallet || null,
    production_split_2_percentage: productionSplits[1]?.percentage || 0,
    production_split_3_wallet: productionSplits[2]?.wallet || null,
    production_split_3_percentage: productionSplits[2]?.percentage || 0,

    // AI tracking
    ai_assisted_idea: trackData.ai_assisted_idea || false,
    ai_assisted_implementation: trackData.ai_assisted_implementation || false,

    // Licensing
    license_type: trackData.allow_downloads ? 'remix_external' : 'remix_only',
    license_selection: contentType === 'ep' ? 'platform_download' : 'platform_remix',
    allow_remixing: contentType !== 'ep' ? (trackData.allow_remixing ?? true) : false,
    allow_downloads: trackData.allow_downloads ?? false,
    remix_protected: trackData.remix_protected ?? false, // Sacred/devotional content protection
    open_to_collaboration: trackData.open_to_collaboration ?? false,
    open_to_commercial: trackData.open_to_commercial ?? false,
    // Contact access - use same email/fee for both commercial and collab
    // Default to $1 USDC if they're open to collaboration/commercial but didn't set a fee
    commercial_contact: trackData.contact_email || trackData.commercial_contact || null,
    commercial_contact_fee: trackData.contact_fee_stx ?? ((trackData.open_to_commercial || trackData.open_to_collaboration) ? PRICING.contact.inquiryFee : null),
    collab_contact: trackData.contact_email || trackData.collab_contact || null,
    collab_contact_fee: trackData.contact_fee_stx ?? ((trackData.open_to_commercial || trackData.open_to_collaboration) ? PRICING.contact.inquiryFee : null),
    contact_fee_usdc: trackData.contact_fee_stx ?? ((trackData.open_to_commercial || trackData.open_to_collaboration) ? PRICING.contact.inquiryFee : null),

    // USDC Pricing for packs/EPs
    // download_price_usdc = per-item price (per loop or per song)
    // price_stx = total pack/EP price (per-item × count) - legacy
    remix_price_usdc: contentType === 'ep' ? 0 : PRICING.mixer.loopRecording,
    download_price_usdc: trackData.allow_downloads
      ? (trackData.download_price_stx || (contentType === 'ep' ? PRICING.download.song : PRICING.download.loop))
      : null,
    // Legacy STX columns (same values for backwards compat)
    remix_price_stx: contentType === 'ep' ? 0 : PRICING.mixer.loopRecording,
    download_price_stx: trackData.allow_downloads
      ? (trackData.download_price_stx || (contentType === 'ep' ? PRICING.download.song : PRICING.download.loop))
      : null,
    price_stx: trackData.allow_downloads
      ? (trackData.download_price_stx || (contentType === 'ep' ? PRICING.download.song : PRICING.download.loop)) * files.length
      : PRICING.mixer.loopRecording * files.length,

    // Metadata
    created_at: now,
    updated_at: now,
    is_live: true,
    uploader_address: effectiveWallet,
    primary_uploader_wallet: effectiveWallet,
    account_name: effectiveWallet,
    main_wallet_name: effectiveWallet,

    // Pack metadata
    pack_id: packId, // Self-referential for container
    pack_position: 0,

    // Remix tracking
    remix_depth: contentType === 'loop_pack' ? 0 : null,
    source_track_ids: [],

    // Collaboration
    collaboration_preferences: {},
    store_display_policy: 'primary_only',
    collaboration_type: 'primary_artist',

    // Source metadata
    upload_source: 'conversational',
    conversation_id: conversationId
  };

  // Get track metadata for custom titles and BPM
  // Metadata is sent from the form with per-track title/bpm, indexed by position
  const trackMetadata: Array<{ title: string; bpm: number | null; position: number }> = (trackData as any).track_metadata || [];
  console.log('📋 Track metadata received:', trackMetadata.length > 0 ? trackMetadata : 'none (using defaults)');

  // 2. Create individual track records for each file
  const childRecords = files.map((fileUrl, index) => {
    const trackId = uuidv4();

    // Find matching metadata by position (1-indexed in metadata, 0-indexed in files array)
    const meta = trackMetadata.find(m => m.position === index + 1);

    // Use metadata title if available, then original filename, fallback to generic name
    // Priority: 1) explicit metadata 2) original filename 3) generic name
    let trackTitle = meta?.title;
    if (!trackTitle) {
      // Try to use original filename (preserved from upload) - this is the user's actual filename
      const originalFilename = originalFilenames[index];
      if (originalFilename) {
        // Remove file extension and use as title
        const nameWithoutExt = originalFilename.replace(/\.(mp3|wav|m4a|aac|flac|ogg|webm)$/i, '');
        if (nameWithoutExt && nameWithoutExt.length > 0) {
          trackTitle = nameWithoutExt;
          console.log(`📎 Using original filename for track ${index + 1}: "${trackTitle}"`);
        }
      }
      // Final fallback to generic name
      if (!trackTitle) {
        trackTitle = `${containerTitle} - Track ${index + 1}`;
        console.log(`⚠️ No original filename for track ${index + 1}, using generic name: "${trackTitle}"`);
      }
    }

    // For BPM: loops inherit pack BPM, EPs use per-track BPM from metadata
    const trackBpm = contentType === 'loop_pack'
      ? (trackData.bpm || null)  // Loops inherit pack BPM
      : (meta?.bpm || null);     // EPs use per-track BPM

    return {
      id: trackId,
      title: trackTitle,
      version: '',
      artist: trackData.artist,
      description: '',
      tags: tags, // Use the same tags with location as the container
      notes: '',
      content_type: childContentType,
      loop_category: contentType === 'loop_pack' ? (trackData.loop_category || 'instrumental') : null,
      sample_type: contentType === 'loop_pack' ? 'instrumentals' : 'FULL SONGS',

      // BPM (loops inherit pack BPM, EPs use per-track BPM)
      bpm: trackBpm,
      key: trackData.key || null,
      duration: null,

      // Audio
      audio_url: fileUrl,
      video_url: null,
      cover_image_url: trackData.cover_image_url || null,

      // Pre-generated thumbnail URLs (inherit from container)
      thumb_64_url: trackData.thumb_64_url || null,
      thumb_160_url: trackData.thumb_160_url || null,
      thumb_256_url: trackData.thumb_256_url || null,

      // Location (inherit from container - geocoded)
      primary_location: primaryLocation || null,
      location_lat: locationLat || null,
      location_lng: locationLng || null,
      // Note: location_country and location_region columns don't exist yet
      locations: allLocations && allLocations.length > 0 ? allLocations : null,

      // Splits (same as container)
      composition_split_1_wallet: compositionSplits[0]?.wallet || effectiveWallet,
      composition_split_1_percentage: compositionSplits[0]?.percentage || 100,
      composition_split_2_wallet: compositionSplits[1]?.wallet || null,
      composition_split_2_percentage: compositionSplits[1]?.percentage || 0,
      composition_split_3_wallet: compositionSplits[2]?.wallet || null,
      composition_split_3_percentage: compositionSplits[2]?.percentage || 0,
      production_split_1_wallet: productionSplits[0]?.wallet || effectiveWallet,
      production_split_1_percentage: productionSplits[0]?.percentage || 100,
      production_split_2_wallet: productionSplits[1]?.wallet || null,
      production_split_2_percentage: productionSplits[1]?.percentage || 0,
      production_split_3_wallet: productionSplits[2]?.wallet || null,
      production_split_3_percentage: productionSplits[2]?.percentage || 0,

      // AI tracking
      ai_assisted_idea: trackData.ai_assisted_idea || false,
      ai_assisted_implementation: trackData.ai_assisted_implementation || false,

      // Licensing (inherit from container)
      license_type: containerRecord.license_type,
      license_selection: containerRecord.license_selection,
      allow_remixing: containerRecord.allow_remixing,
      allow_downloads: containerRecord.allow_downloads,
      remix_protected: containerRecord.remix_protected, // Inherit protection from container
      open_to_collaboration: containerRecord.open_to_collaboration,
      open_to_commercial: containerRecord.open_to_commercial,
      commercial_contact: containerRecord.commercial_contact,
      collab_contact: containerRecord.collab_contact,

      // USDC Pricing
      remix_price_usdc: containerRecord.remix_price_usdc,
      download_price_usdc: containerRecord.download_price_usdc,
      // Legacy STX columns
      remix_price_stx: containerRecord.remix_price_stx,
      download_price_stx: containerRecord.download_price_stx,
      price_stx: containerRecord.price_stx,

      // Metadata
      created_at: now,
      updated_at: now,
      is_live: true,
      uploader_address: effectiveWallet,
      primary_uploader_wallet: effectiveWallet,
      account_name: effectiveWallet,
      main_wallet_name: effectiveWallet,

      // Pack relationship
      pack_id: packId,
      pack_position: index + 1, // 1-indexed for children

      // Remix tracking
      remix_depth: childContentType === 'loop' ? 0 : null,
      source_track_ids: [],

      // Collaboration
      collaboration_preferences: {},
      store_display_policy: 'primary_only',
      collaboration_type: 'primary_artist',

      // Source metadata
      upload_source: 'conversational',
      conversation_id: conversationId
    };
  });

  // 3. Insert all records
  const allRecords = [containerRecord, ...childRecords];

  const { data, error } = await supabase
    .from('ip_tracks')
    .insert(allRecords)
    .select('id, title, artist, content_type, pack_id, pack_position, created_at');

  if (error) {
    console.error('❌ Multi-file insert error:', error);
    return NextResponse.json(
      { error: `Failed to save ${contentType}: ${error.message}` },
      { status: 500 }
    );
  }

  console.log(`✅ ${contentType} saved with ${files.length} tracks:`, data[0]);

  // Learn preferences from this upload (fire-and-forget)
  updateAgentPreferences(personaId, effectiveWallet, trackData, contentType).catch(() => {});

  // Clean up draft if one exists for this conversation (fire-and-forget)
  if (conversationId) {
    supabase
      .from('ip_tracks')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('is_draft', true)
      .then(() => console.log('🗑️ Draft cleaned up'))
      .catch(() => {});
  }

  return NextResponse.json({
    success: true,
    packId,
    trackCount: files.length,
    tracks: data,
    pendingCollaborators: 0
  });
}
