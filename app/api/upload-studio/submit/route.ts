import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { getWalletFromAuthIdentity } from '@/lib/auth/wallet-mapping';
import { parseLocationsAndGetCoordinates } from '@/lib/locationLookup';

// Helper to check if two locations are duplicates (by coordinates or name)
function isLocationDuplicate(
  existing: Array<{ lat: number; lng: number; name: string }>,
  newLoc: { lat: number; lng: number; name: string }
): boolean {
  const COORD_TOLERANCE = 0.01; // ~1km tolerance for coordinate matching

  return existing.some(loc => {
    // Check by coordinates (within tolerance)
    const coordMatch = Math.abs(loc.lat - newLoc.lat) < COORD_TOLERANCE &&
                       Math.abs(loc.lng - newLoc.lng) < COORD_TOLERANCE;
    // Also check by name (case insensitive, trimmed)
    const nameMatch = loc.name.toLowerCase().trim() === newLoc.name.toLowerCase().trim();
    return coordMatch || nameMatch;
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trackData, walletAddress, conversationId } = body;

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
        conversationId
      );
    }

    // Process splits - handle pending collaborators
    const compositionSplits = processSplits(trackData.composition_splits, effectiveWallet);
    const productionSplits = processSplits(trackData.production_splits, effectiveWallet);

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

    // Add ALL locations as tags (primary + additional)
    if (allLocations && allLocations.length > 0) {
      // Add each location as a tag
      for (const loc of allLocations) {
        const locationTag = `🌍 ${loc.name}`;
        if (!tags.some((t: string) => t === locationTag)) {
          tags = [...tags, locationTag];
        }
      }
      console.log('📍 Added location tags:', allLocations.map(l => l.name).join(', '));
    } else if (primaryLocation) {
      // Fallback to just primary location if allLocations not set
      const locationTag = `🌍 ${primaryLocation}`;
      if (!tags.some((t: string) => t.startsWith('🌍'))) {
        tags = [...tags, locationTag];
      }
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
      notes: trackData.notes || trackData.tell_us_more || '',
      content_type: contentType,
      loop_category: contentType === 'loop' ? (trackData.loop_category || 'instrumental') : null,
      sample_type: contentType === 'loop' ? 'instrumentals' : 'FULL SONGS',

      // BPM handling
      bpm: contentType === 'full_song' || contentType === 'ep' ? null : (trackData.bpm || null),
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
      // Default to 2 STX if they're open to collaboration/commercial but didn't set a fee
      commercial_contact: trackData.contact_email || trackData.commercial_contact || null,
      commercial_contact_fee: trackData.contact_fee_stx ?? ((trackData.open_to_commercial || trackData.open_to_collaboration) ? 2 : null),
      collab_contact: trackData.contact_email || trackData.collab_contact || null,
      collab_contact_fee: trackData.contact_fee_stx ?? ((trackData.open_to_commercial || trackData.open_to_collaboration) ? 2 : null),

      // Pricing
      remix_price_stx: contentType === 'full_song' ? 0 : 1.0,
      download_price_stx: trackData.allow_downloads ? (trackData.download_price_stx || (contentType === 'full_song' ? 2 : 1)) : null,
      price_stx: trackData.allow_downloads ? (trackData.download_price_stx || (contentType === 'full_song' ? 2 : 1)) : 1.0,

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
  conversationId: string
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

  // Add ALL locations as tags (primary + additional)
  if (allLocations && allLocations.length > 0) {
    // Add each location as a tag
    for (const loc of allLocations) {
      const locationTag = `🌍 ${loc.name}`;
      if (!tags.some((t: string) => t === locationTag)) {
        tags = [...tags, locationTag];
      }
    }
    console.log('📍 Added location tags:', allLocations.map(l => l.name).join(', '));
  } else if (primaryLocation) {
    // Fallback to just primary location if allLocations not set
    const locationTag = `🌍 ${primaryLocation}`;
    if (!tags.some((t: string) => t.startsWith('🌍'))) {
      tags = [...tags, locationTag];
    }
  }

  // 1. Create the container record (the pack/EP itself)
  const containerRecord = {
    id: packId,
    title: containerTitle,
    version: '',
    artist: trackData.artist,
    description: trackData.description || '',
    tags: tags,
    notes: trackData.notes || trackData.tell_us_more || '',
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
    // Default to 2 STX if they're open to collaboration/commercial but didn't set a fee
    commercial_contact: trackData.contact_email || trackData.commercial_contact || null,
    commercial_contact_fee: trackData.contact_fee_stx ?? ((trackData.open_to_commercial || trackData.open_to_collaboration) ? 2 : null),
    collab_contact: trackData.contact_email || trackData.collab_contact || null,
    collab_contact_fee: trackData.contact_fee_stx ?? ((trackData.open_to_commercial || trackData.open_to_collaboration) ? 2 : null),

    // Pricing
    // download_price_stx = per-item price (per loop or per song)
    // price_stx = total pack/EP price (per-item × count)
    remix_price_stx: contentType === 'ep' ? 0 : 1.0,
    download_price_stx: trackData.allow_downloads
      ? (trackData.download_price_stx || (contentType === 'ep' ? 2 : 1))
      : null,
    price_stx: trackData.allow_downloads
      ? (trackData.download_price_stx || (contentType === 'ep' ? 2 : 1)) * files.length
      : 1.0 * files.length,

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

      // Pricing
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

  return NextResponse.json({
    success: true,
    packId,
    trackCount: files.length,
    tracks: data,
    pendingCollaborators: 0
  });
}
