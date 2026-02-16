import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for storage operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Supported file types
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp4', 'audio/ogg', 'audio/x-m4a'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Max file sizes
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const { fileName, fileType, fileSize, walletAddress } = await request.json();

    if (!fileName || !fileType || !fileSize || !walletAddress) {
      return NextResponse.json(
        { error: 'fileName, fileType, fileSize, and walletAddress required' },
        { status: 400 }
      );
    }

    // Determine file category and validate
    let fileCategory: 'audio' | 'video' | 'image';
    let maxSize: number;
    let storagePath: string;

    if (AUDIO_TYPES.includes(fileType) || fileName.match(/\.(mp3|wav|flac|m4a|ogg)$/i)) {
      fileCategory = 'audio';
      maxSize = MAX_AUDIO_SIZE;
      storagePath = 'audio';
    } else if (VIDEO_TYPES.includes(fileType) || fileName.match(/\.(mp4|mov|avi|webm)$/i)) {
      fileCategory = 'video';
      maxSize = MAX_VIDEO_SIZE;
      storagePath = 'video-clips';
    } else if (IMAGE_TYPES.includes(fileType) || fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      fileCategory = 'image';
      maxSize = MAX_IMAGE_SIZE;
      storagePath = 'cover-images';
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${fileType}` },
        { status: 400 }
      );
    }

    // Check file size
    if (fileSize > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      return NextResponse.json(
        { error: `File too large. Maximum ${maxMB}MB for ${fileCategory} files.` },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const ext = fileName.split('.').pop()?.toLowerCase() || 'bin';
    const uniqueName = `${walletAddress.substring(0, 10)}-${timestamp}.${ext}`;
    const filePath = `${storagePath}/${uniqueName}`;

    // Create signed upload URL (valid for 5 minutes)
    const { data, error } = await supabase.storage
      .from('user-content')
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error('❌ Signed URL error:', error);
      return NextResponse.json(
        { error: `Failed to create upload URL: ${error.message}` },
        { status: 500 }
      );
    }

    // Build the public URL
    const { data: urlData } = supabase.storage
      .from('user-content')
      .getPublicUrl(filePath);

    console.log(`📤 Signed upload URL created: ${filePath} (${fileCategory}, ${(fileSize / 1024 / 1024).toFixed(1)}MB)`);

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: filePath,
      publicUrl: urlData.publicUrl,
      fileCategory,
      fileName: uniqueName
    });

  } catch (error: any) {
    console.error('Signed URL error:', error);
    return NextResponse.json(
      { error: 'Failed to create upload URL', details: error.message },
      { status: 500 }
    );
  }
}
