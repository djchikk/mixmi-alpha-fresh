import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { getWalletFromAuthIdentity } from '@/lib/auth/wallet-mapping';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/upload-studio/save-draft
 *
 * Auto-saves conversational upload progress as a draft.
 * Creates on first call, updates on subsequent calls (upsert by conversation_id).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, walletAddress, personaId, extractedData } = body;

    if (!conversationId || !walletAddress) {
      return NextResponse.json(
        { error: 'conversationId and walletAddress required' },
        { status: 400 }
      );
    }

    // Need at least one file uploaded to save a draft
    const hasFile = extractedData?.audio_url ||
                    extractedData?.video_url ||
                    (extractedData?.loop_files?.length > 0) ||
                    (extractedData?.ep_files?.length > 0);

    if (!hasFile) {
      return NextResponse.json({
        success: false,
        reason: 'No files uploaded yet — nothing to draft'
      });
    }

    const effectiveWallet = await getWalletFromAuthIdentity(walletAddress);
    if (!effectiveWallet) {
      return NextResponse.json(
        { error: 'Could not resolve wallet address' },
        { status: 400 }
      );
    }

    // Check if a draft already exists for this conversation
    const { data: existing } = await supabase
      .from('ip_tracks')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('is_draft', true)
      .maybeSingle();

    const trackId = existing?.id || uuidv4();
    const now = new Date().toISOString();

    // Determine content type
    let contentType = extractedData.content_type || 'loop';
    if (contentType === 'song') contentType = 'full_song';
    if (contentType === 'loop' && extractedData.loop_files?.length > 1) {
      contentType = 'loop_pack';
    }

    // Build minimal draft record with whatever data we have so far
    const draftRecord: Record<string, any> = {
      id: trackId,
      title: extractedData.title || 'Untitled Draft',
      artist: extractedData.artist || 'Unknown',
      content_type: contentType,
      is_draft: true,
      is_live: false, // Drafts aren't visible on the globe

      // Media
      audio_url: extractedData.audio_url || (extractedData.loop_files?.[0]) || null,
      video_url: extractedData.video_url || null,
      cover_image_url: extractedData.cover_image_url || null,

      // Metadata (save whatever we have)
      bpm: extractedData.bpm || null,
      key: extractedData.key || null,
      tags: extractedData.tags || [],
      description: extractedData.description || '',
      notes: extractedData.notes || '',

      // Ownership
      primary_uploader_wallet: effectiveWallet,
      uploader_address: effectiveWallet,

      // Licensing defaults
      allow_downloads: extractedData.allow_downloads ?? false,
      allow_remixing: extractedData.allow_remixing ?? true,
      remix_protected: extractedData.remix_protected ?? false,

      // Splits (basic — 100% to uploader for drafts)
      composition_split_1_wallet: effectiveWallet,
      composition_split_1_percentage: 100,
      production_split_1_wallet: effectiveWallet,
      production_split_1_percentage: 100,

      // Source tracking
      upload_source: 'conversational',
      conversation_id: conversationId,

      updated_at: now
    };

    if (!existing) {
      // First save — create
      draftRecord.created_at = now;
      draftRecord.account_name = effectiveWallet;
      draftRecord.main_wallet_name = effectiveWallet;

      const { error } = await supabase
        .from('ip_tracks')
        .insert(draftRecord);

      if (error) {
        console.error('❌ Draft create error:', error);
        return NextResponse.json(
          { error: `Failed to create draft: ${error.message}` },
          { status: 500 }
        );
      }

      console.log('📝 Draft created:', { trackId, conversationId, contentType });
    } else {
      // Subsequent save — update
      delete draftRecord.id; // Don't update the ID
      delete draftRecord.created_at;

      const { error } = await supabase
        .from('ip_tracks')
        .update(draftRecord)
        .eq('id', trackId);

      if (error) {
        console.error('❌ Draft update error:', error);
        return NextResponse.json(
          { error: `Failed to update draft: ${error.message}` },
          { status: 500 }
        );
      }

      console.log('📝 Draft updated:', { trackId, conversationId });
    }

    return NextResponse.json({
      success: true,
      draftId: trackId
    });

  } catch (error: any) {
    console.error('Draft save error:', error);
    return NextResponse.json(
      { error: 'Failed to save draft', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/upload-studio/save-draft
 *
 * Removes a draft after successful submission.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('ip_tracks')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('is_draft', true);

    if (error) {
      console.warn('⚠️ Draft cleanup error (non-fatal):', error);
    } else {
      console.log('🗑️ Draft cleaned up for conversation:', conversationId);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Draft delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete draft', details: error.message },
      { status: 500 }
    );
  }
}
