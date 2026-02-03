/**
 * Get a signed upload URL for recording audio
 *
 * This allows the client to upload directly to Supabase Storage,
 * bypassing Vercel's body size limit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { paymentId, walletAddress } = await request.json();

    if (!paymentId || !walletAddress) {
      return NextResponse.json(
        { error: 'Payment ID and wallet address required' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const walletPrefix = walletAddress.slice(0, 10);
    const fileName = `recording-${walletPrefix}-${paymentId.slice(0, 8)}-${timestamp}.wav`;
    const storagePath = `audio/recordings/${fileName}`;

    // Create signed upload URL (valid for 5 minutes)
    const { data, error } = await supabase.storage
      .from('user-content')
      .createSignedUploadUrl(storagePath);

    if (error) {
      console.error('Failed to create signed URL:', error);
      return NextResponse.json(
        { error: 'Failed to create upload URL' },
        { status: 500 }
      );
    }

    // Get the public URL for the file
    const { data: urlData } = supabase.storage
      .from('user-content')
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      uploadUrl: data.signedUrl,
      token: data.token,
      publicUrl: urlData.publicUrl,
      storagePath,
    });
  } catch (error) {
    console.error('Failed to get upload URL:', error);
    return NextResponse.json(
      { error: 'Failed to get upload URL' },
      { status: 500 }
    );
  }
}
