import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic to prevent build-time evaluation
export const dynamic = 'force-dynamic';

// Initialize Supabase with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  console.log('🎛️ Enhancement remove endpoint hit');

  try {
    const body = await request.json();
    const { trackId } = body;

    console.log('🎛️ Remove enhancement request:', { trackId });

    // Validate inputs
    if (!trackId) {
      return NextResponse.json({ error: 'trackId is required' }, { status: 400 });
    }

    // Get current track to find the enhanced audio URL
    const { data: track, error: trackError } = await supabase
      .from('ip_tracks')
      .select('id, enhanced_audio_url')
      .eq('id', trackId)
      .single();

    if (trackError || !track) {
      console.error('🎛️ Track fetch error:', trackError);
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Delete the enhanced audio file from storage if it exists
    if (track.enhanced_audio_url) {
      try {
        // Extract file path from URL
        // URL format: https://xxx.supabase.co/storage/v1/object/public/user-content/audio/enhanced/filename.wav
        const urlParts = track.enhanced_audio_url.split('/user-content/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          console.log('🎛️ Deleting file from storage:', filePath);

          const { error: deleteError } = await supabase.storage
            .from('user-content')
            .remove([filePath]);

          if (deleteError) {
            console.error('🎛️ Storage delete error (non-fatal):', deleteError);
            // Don't fail - continue to clear database fields
          }
        }
      } catch (storageError) {
        console.error('🎛️ Storage delete error (non-fatal):', storageError);
        // Don't fail - continue to clear database fields
      }
    }

    // Clear enhancement fields from track record
    const { error: updateError } = await supabase
      .from('ip_tracks')
      .update({
        enhanced_audio_url: null,
        enhancement_type: null,
        enhancement_applied_at: null,
      })
      .eq('id', trackId);

    if (updateError) {
      console.error('🎛️ Track update error:', updateError);
      return NextResponse.json({ error: 'Failed to update track' }, { status: 500 });
    }

    console.log('🎛️ Enhancement removed successfully');

    return NextResponse.json({
      success: true,
      message: 'Enhancement removed',
    });

  } catch (error) {
    console.error('🎛️ Remove enhancement error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Remove failed' },
      { status: 500 }
    );
  }
}
