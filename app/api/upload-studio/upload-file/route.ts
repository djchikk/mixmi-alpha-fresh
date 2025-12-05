import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for uploads
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
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB (videos can be large)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  console.log('📤 Upload endpoint hit');

  try {
    let formData;
    try {
      formData = await request.formData();
      console.log('📤 FormData parsed, keys:', Array.from(formData.keys()));
    } catch (formError) {
      console.error('❌ FormData parsing failed:', formError);
      return NextResponse.json(
        { error: 'Failed to parse form data' },
        { status: 400 }
      );
    }

    const file = formData.get('file') as File;
    const type = formData.get('type') as string;
    const walletAddress = formData.get('walletAddress') as string;

    // Debug logging
    console.log('📤 Upload request received:', {
      hasFile: !!file,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      walletAddress: walletAddress?.substring(0, 15) + '...',
      type
    });

    // Validate required fields
    if (!file || !walletAddress) {
      console.log('❌ Missing required fields:', { hasFile: !!file, hasWallet: !!walletAddress });
      return NextResponse.json(
        { error: 'File and wallet address required' },
        { status: 400 }
      );
    }

    // Determine file type and validate
    let fileCategory: 'audio' | 'video' | 'image';
    let maxSize: number;
    let storagePath: string;

    if (AUDIO_TYPES.includes(file.type) || file.name.match(/\.(mp3|wav|flac|m4a|ogg)$/i)) {
      fileCategory = 'audio';
      maxSize = MAX_AUDIO_SIZE;
      storagePath = 'audio';
    } else if (VIDEO_TYPES.includes(file.type) || file.name.match(/\.(mp4|mov|avi|webm)$/i)) {
      fileCategory = 'video';
      maxSize = MAX_VIDEO_SIZE;
      storagePath = 'video-clips';
    } else if (IMAGE_TYPES.includes(file.type) || file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      fileCategory = 'image';
      maxSize = MAX_IMAGE_SIZE;
      storagePath = 'cover-images';
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      return NextResponse.json(
        { error: `File too large. Maximum ${maxMB}MB for ${fileCategory} files.` },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const fileName = `${walletAddress.substring(0, 10)}-${timestamp}.${ext}`;
    const filePath = `${storagePath}/${fileName}`;

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
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('user-content')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    // Response with file info
    const response: any = {
      success: true,
      url: publicUrl,
      type: fileCategory,
      filename: fileName,
      originalFilename: file.name, // Preserve original filename for track titles
      size: file.size
    };

    // For audio files, we could add BPM detection here
    // For now, we'll return null and let the user provide it
    if (fileCategory === 'audio') {
      response.bpm = null; // Could integrate with BPM detection service
      response.duration = null; // Could calculate from audio
    }

    // For video files, we could generate a thumbnail
    if (fileCategory === 'video') {
      response.thumbnailUrl = null; // Could generate thumbnail
    }

    console.log(`✅ File uploaded: ${filePath} (${fileCategory})`);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed', details: error.message },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
