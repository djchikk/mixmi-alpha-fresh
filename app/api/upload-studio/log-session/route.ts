import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getWalletFromAuthIdentity } from '@/lib/auth/wallet-mapping';

// Initialize Supabase with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SessionLogRequest {
  conversationId: string;
  walletAddress: string;

  // Layer 1: Raw transcript
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    attachments?: Array<{ type: string; url?: string; name: string }>;
  }>;
  uploadedFiles?: Array<{
    type: string;
    url: string;
    name: string;
    uploadedAt: string;
  }>;

  // Layer 2: AI inferences
  inferredData: Record<string, any>;
  confidenceScores?: Record<string, number>;
  flags?: Record<string, any>;
  detectedContentType?: string;
  detectedPersona?: string;

  // Layer 3: Outcome
  outcome: 'submitted' | 'abandoned' | 'error' | 'in_progress';
  finalTrackId?: string;
  finalPackId?: string;
  userEdits?: Record<string, { inferred: any; final: any }>;
  reachedReadyState?: boolean;
  errorMessage?: string;
  errorDetails?: any;

  // Metadata
  sessionStartTime?: string;
}

/**
 * POST /api/upload-studio/log-session
 *
 * Logs a conversation session for analysis and improvement.
 * Called after submission or on abandonment.
 */
export async function POST(request: NextRequest) {
  try {
    const body: SessionLogRequest = await request.json();

    const {
      conversationId,
      walletAddress,
      messages,
      uploadedFiles,
      inferredData,
      confidenceScores,
      flags,
      detectedContentType,
      detectedPersona,
      outcome,
      finalTrackId,
      finalPackId,
      userEdits,
      reachedReadyState,
      errorMessage,
      errorDetails,
      sessionStartTime
    } = body;

    // Validate required fields
    if (!conversationId || !walletAddress) {
      return NextResponse.json(
        { error: 'conversationId and walletAddress required' },
        { status: 400 }
      );
    }

    // Resolve wallet address (handle alpha codes)
    const effectiveWallet = await getWalletFromAuthIdentity(walletAddress);
    if (!effectiveWallet) {
      console.warn('⚠️ Could not resolve wallet for session logging:', walletAddress);
      // Don't fail - just use the original address
    }

    // Calculate session duration
    let sessionDurationMs: number | null = null;
    if (sessionStartTime) {
      const startTime = new Date(sessionStartTime).getTime();
      const endTime = Date.now();
      sessionDurationMs = endTime - startTime;
    }

    // Analyze uploaded files - ensure boolean values
    const hasAudio = Boolean(
      uploadedFiles?.some(f => f.type === 'audio') ||
      inferredData?.audio_url ||
      (inferredData?.loop_files?.length > 0)
    );
    const hasVideo = Boolean(
      uploadedFiles?.some(f => f.type === 'video') ||
      inferredData?.video_url
    );
    const hasCoverImage = Boolean(
      uploadedFiles?.some(f => f.type === 'image') ||
      inferredData?.cover_image_url
    );
    const fileCount = uploadedFiles?.length || 0;
    const isMultiFile = (inferredData?.loop_files?.length > 1) ||
                        (inferredData?.ep_files?.length > 1) ||
                        detectedContentType === 'loop_pack' ||
                        detectedContentType === 'ep';

    // Build the session record
    const sessionRecord = {
      conversation_id: conversationId,
      wallet_address: effectiveWallet || walletAddress,

      // Layer 1: Transcript
      messages: messages || [],
      uploaded_files: uploadedFiles || [],

      // Layer 2: AI inferences
      inferred_data: inferredData || {},
      confidence_scores: confidenceScores || {},
      flags: flags || {},
      detected_content_type: detectedContentType || null,
      detected_persona: detectedPersona || null,

      // Layer 3: Outcome
      outcome: outcome || 'in_progress',
      final_track_id: finalTrackId || null,
      final_pack_id: finalPackId || null,
      user_edits: userEdits || {},
      reached_ready_state: reachedReadyState || false,
      error_message: errorMessage || null,
      error_details: errorDetails || null,

      // Set completed_at for terminal outcomes
      completed_at: ['submitted', 'abandoned', 'error'].includes(outcome) ? new Date().toISOString() : null,

      // Analytics
      session_duration_ms: sessionDurationMs,
      message_count: messages?.length || 0,
      has_audio: hasAudio,
      has_video: hasVideo,
      has_cover_image: hasCoverImage,
      file_count: fileCount,
      is_multi_file: isMultiFile
    };

    // Upsert the session (update if exists, insert if new)
    const { data, error } = await supabase
      .from('upload_sessions')
      .upsert(sessionRecord, {
        onConflict: 'conversation_id',
        ignoreDuplicates: false
      })
      .select('id, conversation_id, outcome');

    if (error) {
      console.error('❌ Session log error:', error);
      // Don't throw - this is supplementary logging, shouldn't break the main flow
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    console.log('📝 Session logged:', {
      conversationId,
      outcome,
      messageCount: messages?.length,
      contentType: detectedContentType
    });

    return NextResponse.json({
      success: true,
      sessionId: data?.[0]?.id
    });

  } catch (error: any) {
    console.error('Session logging error:', error);
    // Return success anyway - don't let logging failures break the app
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * PATCH /api/upload-studio/log-session
 *
 * Updates an existing session (e.g., marking as abandoned).
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, outcome, errorMessage, errorDetails } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {
      outcome,
      updated_at: new Date().toISOString()
    };

    if (['submitted', 'abandoned', 'error'].includes(outcome)) {
      updateData.completed_at = new Date().toISOString();
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    if (errorDetails) {
      updateData.error_details = errorDetails;
    }

    const { data, error } = await supabase
      .from('upload_sessions')
      .update(updateData)
      .eq('conversation_id', conversationId)
      .select('id, outcome');

    if (error) {
      console.error('❌ Session update error:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    console.log('📝 Session updated:', { conversationId, outcome });

    return NextResponse.json({
      success: true,
      sessionId: data?.[0]?.id
    });

  } catch (error: any) {
    console.error('Session update error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
