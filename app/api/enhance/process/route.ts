import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

// Set FFmpeg path
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

// Force dynamic to prevent build-time evaluation
export const dynamic = 'force-dynamic';

// Extend timeout for audio processing (Vercel Pro allows up to 300s)
export const maxDuration = 60;

// Initialize Supabase with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Enhancement type definitions
type EnhancementType = 'auto' | 'voice' | 'clean' | 'warm' | 'studio';

// FFmpeg filter chains for each enhancement type
const ENHANCEMENT_FILTERS: Record<EnhancementType, string> = {
  // Auto: Full chain - highpass + compression + loudnorm
  auto: 'highpass=f=80,compand=attacks=0.3:decays=0.8:points=-80/-80|-45/-45|-27/-25|0/-10,loudnorm=I=-14:TP=-1:LRA=11',

  // Voice: More compression for vocals, speech-optimized loudness
  voice: 'highpass=f=100,compand=attacks=0.2:decays=0.6:points=-80/-80|-45/-45|-27/-22|0/-8,loudnorm=I=-16:TP=-1:LRA=9',

  // Clean: Minimal processing - just highpass and loudnorm, no compression
  clean: 'highpass=f=80,loudnorm=I=-14:TP=-1:LRA=11',

  // Warm: Subtle saturation-like effect via softer compression + slight bass boost
  warm: 'highpass=f=60,equalizer=f=100:t=q:w=1:g=2,compand=attacks=0.4:decays=1.0:points=-80/-80|-45/-45|-27/-24|0/-8,loudnorm=I=-14:TP=-1:LRA=11',

  // Studio: Full mastering chain with multi-band feel
  studio: 'highpass=f=40,equalizer=f=60:t=q:w=1:g=1,equalizer=f=10000:t=q:w=1:g=1,compand=attacks=0.2:decays=0.6:points=-80/-80|-50/-50|-30/-26|-10/-10|0/-6,loudnorm=I=-14:TP=-1:LRA=9',
};

export async function POST(request: NextRequest) {
  console.log('🎛️ Enhancement process endpoint hit');

  const tempFiles: string[] = []; // Track temp files for cleanup

  try {
    const body = await request.json();
    const { trackId, enhancementType = 'auto' } = body;

    console.log('🎛️ Enhancement request:', { trackId, enhancementType });

    // Validate inputs
    if (!trackId) {
      return NextResponse.json({ error: 'trackId is required' }, { status: 400 });
    }

    if (!ENHANCEMENT_FILTERS[enhancementType as EnhancementType]) {
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

    // Download source audio
    console.log('🎛️ Downloading source audio...');
    const audioResponse = await fetch(track.audio_url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    console.log('🎛️ Downloaded audio:', audioBuffer.length, 'bytes');

    // Ensure temp directory exists
    const tempDir = '/tmp/enhance';
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Generate temp file paths
    const jobId = randomUUID();
    const inputExt = track.audio_url.includes('.wav') ? 'wav' :
                     track.audio_url.includes('.webm') ? 'webm' :
                     track.audio_url.includes('.mp3') ? 'mp3' : 'wav';
    const inputPath = path.join(tempDir, `input-${jobId}.${inputExt}`);
    const outputPath = path.join(tempDir, `output-${jobId}.wav`);

    tempFiles.push(inputPath, outputPath);

    // Write input file
    await writeFile(inputPath, audioBuffer);
    console.log('🎛️ Wrote input file:', inputPath);

    // Process with FFmpeg
    console.log('🎛️ Starting FFmpeg processing with filter:', enhancementType);
    const filterChain = ENHANCEMENT_FILTERS[enhancementType as EnhancementType];

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters(filterChain)
        .audioCodec('pcm_s16le') // 16-bit PCM WAV
        .audioFrequency(48000) // 48kHz sample rate
        .audioChannels(1) // Mono (matches mic recordings)
        .format('wav')
        .on('start', (cmd) => {
          console.log('🎛️ FFmpeg command:', cmd);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log('🎛️ FFmpeg progress:', Math.round(progress.percent), '%');
          }
        })
        .on('error', (err) => {
          console.error('🎛️ FFmpeg error:', err);
          reject(err);
        })
        .on('end', () => {
          console.log('🎛️ FFmpeg processing complete');
          resolve();
        })
        .save(outputPath);
    });

    // Read processed file
    const enhancedBuffer = await readFile(outputPath);
    console.log('🎛️ Enhanced audio size:', enhancedBuffer.length, 'bytes');

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const walletPrefix = track.primary_uploader_wallet?.substring(0, 10) || 'unknown';
    const enhancedFileName = `enhanced-${walletPrefix}-${trackId.substring(0, 8)}-${timestamp}.wav`;
    const enhancedFilePath = `audio/enhanced/${enhancedFileName}`;

    console.log('🎛️ Uploading enhanced audio to:', enhancedFilePath);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-content')
      .upload(enhancedFilePath, enhancedBuffer, {
        contentType: 'audio/wav',
        cacheControl: '3600',
        upsert: true // Allow overwrite for re-enhancement
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
      // Don't fail the request - the file is uploaded, just log the error
    }

    // Cleanup temp files
    for (const tempFile of tempFiles) {
      try {
        await unlink(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    console.log('🎛️ Enhancement complete!');

    return NextResponse.json({
      success: true,
      enhancedAudioUrl,
      enhancementType,
      processingStats: {
        inputSize: audioBuffer.length,
        outputSize: enhancedBuffer.length,
        filterChain,
      }
    });

  } catch (error) {
    console.error('🎛️ Enhancement error:', error);

    // Cleanup temp files on error
    for (const tempFile of tempFiles) {
      try {
        await unlink(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Enhancement failed' },
      { status: 500 }
    );
  }
}
