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
  tags?: string[];
  bpm?: number;
  key?: string;
  duration?: number;
  loop_category?: string;
  tell_us_more?: string;

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

    // Validate required fields
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    if (!trackData || !trackData.title || !trackData.artist) {
      return NextResponse.json(
        { error: 'Track title and artist required' },
        { status: 400 }
      );
    }

    // Resolve wallet address (handle alpha codes)
    const effectiveWallet = await getWalletFromAuthIdentity(walletAddress);
    if (!effectiveWallet) {
      return NextResponse.json(
        { error: 'Could not resolve wallet address' },
        { status: 400 }
      );
    }

    // Determine content type
    const contentType = trackData.content_type || 'loop';

    // Validate content type specific requirements
    if (contentType === 'loop' && !trackData.bpm) {
      return NextResponse.json(
        { error: 'BPM is required for loops' },
        { status: 400 }
      );
    }

    if (!trackData.audio_url && contentType !== 'video_clip') {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      );
    }

    if (contentType === 'video_clip' && !trackData.video_url) {
      return NextResponse.json(
        { error: 'Video file is required for video clips' },
        { status: 400 }
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
      notes: trackData.tell_us_more || '',
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
      commercial_contact: trackData.commercial_contact || null,
      collab_contact: trackData.collab_contact || null,

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
