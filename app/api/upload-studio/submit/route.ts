import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { getWalletFromAuthIdentity } from '@/lib/auth/wallet-mapping';

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
  allow_remixing?: boolean;
  download_price_stx?: number;
  open_to_collaboration?: boolean;
  open_to_commercial?: boolean;
  commercial_contact?: string;
  collab_contact?: string;
  // Contact access (new)
  contact_email?: string;
  contact_fee_stx?: number;

  // Media URLs
  audio_url?: string;
  video_url?: string;
  cover_image_url?: string;

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
    const contentType = trackData.content_type || 'loop';
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

    // Build the track record
    const trackId = uuidv4();
    const now = new Date().toISOString();

    const trackRecord = {
      id: trackId,
      title: trackData.pack_title || trackData.ep_title || trackData.title,
      version: '',
      artist: trackData.artist,
      description: trackData.description || '',
      tags: trackData.tags || [],
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

      // Video crop data (for video clips)
      video_crop_x: trackData.video_crop_x ?? null,
      video_crop_y: trackData.video_crop_y ?? null,
      video_crop_width: trackData.video_crop_width ?? null,
      video_crop_height: trackData.video_crop_height ?? null,
      video_crop_zoom: trackData.video_crop_zoom ?? null,
      video_natural_width: trackData.video_natural_width ?? null,
      video_natural_height: trackData.video_natural_height ?? null,

      // Location
      primary_location: trackData.primary_location || null,
      location_lat: trackData.location_lat || null,
      location_lng: trackData.location_lng || null,

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
      allow_downloads: trackData.allow_downloads || false,
      open_to_collaboration: trackData.open_to_collaboration || false,
      open_to_commercial: trackData.open_to_commercial || false,
      // Contact access - use same email/fee for both commercial and collab
      commercial_contact: trackData.contact_email || trackData.commercial_contact || null,
      commercial_contact_fee: trackData.contact_fee_stx || null,
      collab_contact: trackData.contact_email || trackData.collab_contact || null,
      collab_contact_fee: trackData.contact_fee_stx || null,

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

      // Remix tracking
      remix_depth: contentType === 'loop' ? 0 : null,
      source_track_ids: [],

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
      await savePendingCollaborators(trackId, pendingCollaborators);
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
 */
function processSplits(
  splits: Array<{ wallet?: string; name?: string; percentage: number }> | undefined,
  defaultWallet: string
): Array<{ wallet: string; percentage: number }> {
  if (!splits || splits.length === 0) {
    return [{ wallet: defaultWallet, percentage: 100 }];
  }

  return splits.map((split, index) => ({
    wallet: split.wallet || (index === 0 ? defaultWallet : ''), // First split defaults to uploader
    percentage: split.percentage
  })).filter(s => s.percentage > 0);
}

/**
 * Extract collaborators that have names but no wallet addresses
 */
function extractPendingCollaborators(
  splits: Array<{ wallet?: string; name?: string; percentage: number }> | undefined,
  type: 'composition' | 'production'
): Array<{ name: string; percentage: number; type: string }> {
  if (!splits) return [];

  return splits
    .filter(s => s.name && !s.wallet && s.percentage > 0)
    .map(s => ({
      name: s.name!,
      percentage: s.percentage,
      type
    }));
}

/**
 * Save pending collaborators for later wallet resolution
 * This would go into a pending_collaborators table
 */
async function savePendingCollaborators(
  trackId: string,
  collaborators: Array<{ name: string; percentage: number; type: string }>
) {
  // For now, just log - we'll create the table when needed
  console.log('📋 Pending collaborators for track', trackId, ':', collaborators);

  // TODO: Insert into pending_collaborators table when created
  // const { error } = await supabase
  //   .from('pending_collaborators')
  //   .insert(collaborators.map(c => ({
  //     track_id: trackId,
  //     collaborator_name: c.name,
  //     split_percentage: c.percentage,
  //     split_type: c.type,
  //     status: 'pending'
  //   })));
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

  // 1. Create the container record (the pack/EP itself)
  const containerRecord = {
    id: packId,
    title: containerTitle,
    version: '',
    artist: trackData.artist,
    description: trackData.description || '',
    tags: trackData.tags || [],
    notes: trackData.notes || trackData.tell_us_more || '',
    content_type: contentType,
    loop_category: contentType === 'loop_pack' ? (trackData.loop_category || 'instrumental') : null,
    sample_type: contentType === 'loop_pack' ? 'instrumentals' : 'FULL SONGS',

    // BPM (only for loop packs)
    bpm: contentType === 'loop_pack' ? (trackData.bpm || null) : null,
    key: trackData.key || null,
    duration: trackData.duration || null,

    // Container doesn't have its own audio - first child's audio is preview
    audio_url: files[0] || null,
    video_url: null,
    cover_image_url: trackData.cover_image_url || null,

    // Location
    primary_location: trackData.primary_location || null,
    location_lat: trackData.location_lat || null,
    location_lng: trackData.location_lng || null,

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
    allow_downloads: trackData.allow_downloads || false,
    open_to_collaboration: trackData.open_to_collaboration || false,
    open_to_commercial: trackData.open_to_commercial || false,
    // Contact access - use same email/fee for both commercial and collab
    commercial_contact: trackData.contact_email || trackData.commercial_contact || null,
    commercial_contact_fee: trackData.contact_fee_stx || null,
    collab_contact: trackData.contact_email || trackData.collab_contact || null,
    collab_contact_fee: trackData.contact_fee_stx || null,

    // Pricing
    remix_price_stx: contentType === 'ep' ? 0 : 1.0,
    download_price_stx: trackData.allow_downloads
      ? (trackData.download_price_stx || (contentType === 'ep' ? 2 : 1))
      : null,
    price_stx: trackData.allow_downloads
      ? (trackData.download_price_stx || (contentType === 'ep' ? 2 : 1))
      : 1.0,

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

  // 2. Create individual track records for each file
  const childRecords = files.map((fileUrl, index) => {
    const trackId = uuidv4();
    return {
      id: trackId,
      title: `${containerTitle} - Track ${index + 1}`,
      version: '',
      artist: trackData.artist,
      description: '',
      tags: trackData.tags || [],
      notes: '',
      content_type: childContentType,
      loop_category: contentType === 'loop_pack' ? (trackData.loop_category || 'instrumental') : null,
      sample_type: contentType === 'loop_pack' ? 'instrumentals' : 'FULL SONGS',

      // BPM (inherit from pack for loops)
      bpm: contentType === 'loop_pack' ? (trackData.bpm || null) : null,
      key: trackData.key || null,
      duration: null,

      // Audio
      audio_url: fileUrl,
      video_url: null,
      cover_image_url: trackData.cover_image_url || null,

      // Location (inherit from container)
      primary_location: trackData.primary_location || null,
      location_lat: trackData.location_lat || null,
      location_lng: trackData.location_lng || null,

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
