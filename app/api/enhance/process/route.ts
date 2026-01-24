import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic to prevent build-time evaluation
export const dynamic = 'force-dynamic';

// Extend timeout for audio processing
export const maxDuration = 60;

// Audio worker URL (Fly.io)
const AUDIO_WORKER_URL = process.env.AUDIO_WORKER_URL || 'https://mixmi-audio-worker.fly.dev';

// Initialize Supabase with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type EnhancementType = 'auto' | 'voice' | 'clean' | 'warm' | 'studio';

const VALID_TYPES: EnhancementType[] = ['auto', 'voice', 'clean', 'warm', 'studio'];

export async function POST(request: NextRequest) {
  console.log('🎛️ Enhancement process endpoint hit');

  try {
    const body = await request.json();
    const { trackId, enhancementType = 'auto' } = body;

    console.log('🎛️ Enhancement request:', { trackId, enhancementType });

    // Validate inputs
    if (!trackId) {
      return NextResponse.json({ error: 'trackId is required' }, { status: 400 });
    }

    if (!VALID_TYPES.includes(enhancementType)) {
      return NextResponse.json({ error: 'Invalid enhancement type' }, { status: 400 });
    }

    // Fetch track from database
    const { data: track, error: trackError } = await supabase
      .from('ip_tracks')
      .select('id, title, audio_url, primary_uploader_wallet')
      .eq('id', trackId)
      .single();

    if (trackError || !track) {
      console.error('🎛️ Track fetch error:', trackError);
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    if (!track.audio_url) {
      return NextResponse.json({ error: 'Track has no audio URL' }, { status: 400 });
    }

    console.log('🎛️ Processing track:', { id: track.id, title: track.title });
    console.log('🎛️ Calling audio worker at:', AUDIO_WORKER_URL);

    // Call the Fly.io audio worker
    const workerResponse = await fetch(`${AUDIO_WORKER_URL}/enhance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceUrl: track.audio_url,
        enhancementType,
      }),
    });

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text();
      console.error('🎛️ Worker error:', errorText);
      throw new Error(`Audio worker failed: ${workerResponse.status}`);
    }

    // Get the enhanced audio as a buffer
    const enhancedBuffer = Buffer.from(await workerResponse.arrayBuffer());
    console.log('🎛️ Received enhanced audio:', enhancedBuffer.length, 'bytes');

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const walletPrefix = track.primary_uploader_wallet?.substring(0, 10) || 'unknown';
    const enhancedFileName = `enhanced-${walletPrefix}-${trackId.substring(0, 8)}-${timestamp}.wav`;
    const enhancedFilePath = `audio/enhanced/${enhancedFileName}`;

    console.log('🎛️ Uploading to Supabase:', enhancedFilePath);

    const { error: uploadError } = await supabase.storage
      .from('user-content')
      .upload(enhancedFilePath, enhancedBuffer, {
        contentType: 'audio/wav',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('🎛️ Upload error:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('user-content')
      .getPublicUrl(enhancedFilePath);

    const enhancedAudioUrl = urlData.publicUrl;
    console.log('🎛️ Enhanced audio URL:', enhancedAudioUrl);

    // Update track record
    const { error: updateError } = await supabase
      .from('ip_tracks')
      .update({
        enhanced_audio_url: enhancedAudioUrl,
        enhancement_type: enhancementType,
        enhancement_applied_at: new Date().toISOString(),
      })
      .eq('id', trackId);

    if (updateError) {
      console.error('🎛️ Track update error:', updateError);
      // Don't fail - file is uploaded
    }

    console.log('🎛️ Enhancement complete!');

    return NextResponse.json({
      success: true,
      enhancedAudioUrl,
      enhancementType,
    });

  } catch (error) {
    console.error('🎛️ Enhancement error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Enhancement failed' },
      { status: 500 }
    );
  }
}
