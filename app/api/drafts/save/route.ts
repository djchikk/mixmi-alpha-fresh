import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic to prevent build-time evaluation
export const dynamic = 'force-dynamic';

// Initialize Supabase with service role for uploads
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Supported audio types for mic recordings
const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg'];
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  console.log('🎤 Draft save endpoint hit');

  try {
    const formData = await request.formData();

    const file = formData.get('file') as File;
    const walletAddress = formData.get('walletAddress') as string;
    const title = formData.get('title') as string || 'Mic Recording';
    const cycleCount = parseInt(formData.get('cycleCount') as string || '1');
    const bpm = parseFloat(formData.get('bpm') as string || '120');
    const existingPackId = formData.get('packId') as string | null; // For multi-take bundling

    console.log('🎤 Draft save request:', {
      hasFile: !!file,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      walletAddress: walletAddress?.substring(0, 15) + '...',
      title,
      cycleCount,
      bpm,
      existingPackId
    });

    // Validate required fields
    if (!file || !walletAddress) {
      return NextResponse.json(
        { error: 'File and wallet address required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!AUDIO_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported audio type: ${file.type}` },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum 50MB for audio files.' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const ext = file.type === 'audio/webm' ? 'webm' : 'wav';
    const fileName = `draft-${walletAddress.substring(0, 10)}-${timestamp}.${ext}`;
    const filePath = `audio/drafts/${fileName}`;

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-content')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('🎤 Upload error:', uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('user-content')
      .getPublicUrl(filePath);

    const audioUrl = urlData.publicUrl;

    // Determine if this should be added to an existing pack or create new
    let packId = existingPackId;
    let packPosition = 1;
    let contentType: 'loop' | 'loop_pack' = 'loop';

    if (existingPackId) {
      // Adding to existing draft pack - get next position
      const { data: existingTracks, error: countError } = await supabase
        .from('ip_tracks')
        .select('pack_position')
        .eq('pack_id', existingPackId)
        .eq('is_draft', true)
        .order('pack_position', { ascending: false })
        .limit(1);

      if (!countError && existingTracks && existingTracks.length > 0) {
        packPosition = (existingTracks[0].pack_position || 0) + 1;
      }
      contentType = 'loop'; // Individual track in pack
    }

    // Create ip_tracks record
    const trackData = {
      title: existingPackId ? `${title} - Take ${packPosition}` : title,
      artist: walletAddress.substring(0, 10) + '...', // Placeholder, can be updated
      content_type: contentType,
      bpm: bpm,
      audio_url: audioUrl,
      is_draft: true,
      primary_uploader_wallet: walletAddress,
      pack_id: packId,
      pack_position: existingPackId ? packPosition : null,
      // Default splits - 100% to uploader
      composition_split_1_wallet: walletAddress,
      composition_split_1_percentage: 100,
      production_split_1_wallet: walletAddress,
      production_split_1_percentage: 100,
    };

    const { data: track, error: insertError } = await supabase
      .from('ip_tracks')
      .insert(trackData)
      .select()
      .single();

    if (insertError) {
      console.error('🎤 Database insert error:', insertError);
      return NextResponse.json(
        { error: `Failed to save draft: ${insertError.message}` },
        { status: 500 }
      );
    }

    // If this is a new draft (not adding to pack), and user continues recording,
    // we'll use this track's ID as the pack_id for subsequent takes
    // The first take becomes part of the pack when the second take is added

    console.log(`✅ Draft saved: ${track.id} (${contentType})`);

    return NextResponse.json({
      success: true,
      track: {
        id: track.id,
        title: track.title,
        artist: track.artist,
        audioUrl: track.audio_url,
        bpm: track.bpm,
        content_type: track.content_type,
        is_draft: true,
        pack_id: track.pack_id,
        pack_position: track.pack_position,
        primary_uploader_wallet: track.primary_uploader_wallet
      },
      // Return the pack_id for multi-take bundling
      // If this was the first take, return the track's own ID to use as pack_id for next takes
      packId: packId || track.id
    });

  } catch (error: any) {
    console.error('🎤 Draft save error:', error);
    return NextResponse.json(
      { error: 'Failed to save draft', details: error.message },
      { status: 500 }
    );
  }
}

// Convert first draft to a pack when second take is added
export async function PATCH(request: NextRequest) {
  console.log('🎤 Converting draft to pack');

  try {
    const { firstTrackId, walletAddress } = await request.json();

    if (!firstTrackId || !walletAddress) {
      return NextResponse.json(
        { error: 'firstTrackId and walletAddress required' },
        { status: 400 }
      );
    }

    // Update the first track to be part of a pack
    const { data: track, error: updateError } = await supabase
      .from('ip_tracks')
      .update({
        pack_id: firstTrackId, // Use its own ID as pack_id
        pack_position: 1
      })
      .eq('id', firstTrackId)
      .eq('primary_uploader_wallet', walletAddress)
      .eq('is_draft', true)
      .select()
      .single();

    if (updateError) {
      console.error('🎤 Pack conversion error:', updateError);
      return NextResponse.json(
        { error: `Failed to convert to pack: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log(`✅ Draft converted to pack: ${track.id}`);

    return NextResponse.json({
      success: true,
      packId: track.id
    });

  } catch (error: any) {
    console.error('🎤 Pack conversion error:', error);
    return NextResponse.json(
      { error: 'Failed to convert to pack', details: error.message },
      { status: 500 }
    );
  }
}
