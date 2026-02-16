import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getWalletFromAuthIdentity } from '@/lib/auth/wallet-mapping';

// Initialize Supabase with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Sensitivity keywords to detect - for traditional/sacred content communities
const SENSITIVITY_KEYWORDS = [
  'god', 'prayer', 'sacred', 'ceremony', 'ancestor', 'blessing',
  'spiritual', 'elder', 'tradition', 'secret', 'family only', 'not for everyone'
];

/**
 * Check for sensitivity keywords in text
 * Returns array of matched keywords
 */
function detectSensitivityKeywords(text: string): string[] {
  if (!text) return [];
  const lowerText = text.toLowerCase();
  return SENSITIVITY_KEYWORDS.filter(keyword => lowerText.includes(keyword));
}

/**
 * Extract context around matched keywords (50 chars before/after)
 */
function extractKeywordContext(text: string, keywords: string[]): string {
  if (!keywords.length) return '';

  const lowerText = text.toLowerCase();
  const firstKeyword = keywords[0];
  const index = lowerText.indexOf(firstKeyword);

  if (index === -1) return text.slice(0, 150);

  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + firstKeyword.length + 50);

  let context = text.slice(start, end);
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return context;
}

interface SessionLogRequest {
  conversationId: string;
  walletAddress: string;
  personaId?: string;

  // Layer 1: Raw transcript
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    attachments?: Array<{ type: string; url?: string; name: string }>;
    inputMode?: 'text' | 'voice'; // How the user sent this message
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
  promptVersion?: string;
  modelName?: string;
}

/**
 * POST /api/upload-studio/log-session
 *
 * Logs a conversation session for analysis and improvement.
 * Creates both session summary and individual events.
 */
export async function POST(request: NextRequest) {
  try {
    const body: SessionLogRequest = await request.json();

    const {
      conversationId,
      walletAddress,
      personaId,
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
      sessionStartTime,
      promptVersion,
      modelName
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
    const fileCount = [
      inferredData?.audio_url,
      inferredData?.video_url,
      inferredData?.cover_image_url,
      ...(inferredData?.loop_files || []),
      ...(inferredData?.ep_files || [])
    ].filter(Boolean).length;
    const isMultiFile = (inferredData?.loop_files?.length > 1) ||
                        (inferredData?.ep_files?.length > 1) ||
                        detectedContentType === 'loop_pack' ||
                        detectedContentType === 'ep';

    // Build the session record
    const sessionRecord = {
      conversation_id: conversationId,
      wallet_address: effectiveWallet || walletAddress,
      persona_id: personaId || null,

      // Layer 1: Transcript (keep as summary/cache)
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
      is_multi_file: isMultiFile,

      // Version tracking
      prompt_version: promptVersion || null,
      model_name: modelName || null
    };

    // Upsert the session (update if exists, insert if new)
    const { data: sessionData, error: sessionError } = await supabase
      .from('upload_sessions')
      .upsert(sessionRecord, {
        onConflict: 'conversation_id',
        ignoreDuplicates: false
      })
      .select('id, conversation_id, outcome');

    if (sessionError) {
      console.error('❌ Session log error:', sessionError);
      return NextResponse.json({
        success: false,
        error: sessionError.message
      }, { status: 500 });
    }

    const sessionId = sessionData?.[0]?.id;

    // Now create individual events for each message
    if (sessionId && messages && messages.length > 0) {
      const events: Array<{
        session_id: string;
        event_index: number;
        event_type: string;
        role: string | null;
        content: string | null;
        payload: Record<string, any>;
      }> = [];

      let eventIndex = 0;

      for (const message of messages) {
        const eventType = message.role === 'user' ? 'user_message' :
                          message.role === 'assistant' ? 'assistant_message' :
                          'system_message';

        const payload: Record<string, any> = {};

        // Add attachments to payload if present
        if (message.attachments && message.attachments.length > 0) {
          payload.attachments = message.attachments;
        }

        // Track input mode (voice vs text) for user messages
        if (message.inputMode) {
          payload.input_mode = message.inputMode;
        }

        // Check for sensitivity keywords in user messages
        if (message.role === 'user') {
          const detectedKeywords = detectSensitivityKeywords(message.content);
          if (detectedKeywords.length > 0) {
            payload.sensitivity_keywords_detected = detectedKeywords;
          }
        }

        events.push({
          session_id: sessionId,
          event_index: eventIndex++,
          event_type: eventType,
          role: message.role,
          content: message.content,
          payload
        });

        // Fire separate sensitivity_signal event if keywords detected
        if (message.role === 'user') {
          const detectedKeywords = detectSensitivityKeywords(message.content);
          if (detectedKeywords.length > 0) {
            const context = extractKeywordContext(message.content, detectedKeywords);
            events.push({
              session_id: sessionId,
              event_index: eventIndex++,
              event_type: 'sensitivity_signal',
              role: null,
              content: null,
              payload: {
                keywords: detectedKeywords,
                context: context,
                source_message_index: eventIndex - 2 // Reference the message that triggered this
              }
            });
            console.log('🔔 Sensitivity signal detected:', detectedKeywords);
          }
        }
      }

      // Insert all events
      if (events.length > 0) {
        const { error: eventsError } = await supabase
          .from('upload_session_events')
          .upsert(events, {
            onConflict: 'session_id,event_index',
            ignoreDuplicates: false
          });

        if (eventsError) {
          console.warn('⚠️ Events log error (non-fatal):', eventsError);
          // Don't fail - events are supplementary
        } else {
          console.log('📝 Events logged:', events.length);
        }
      }
    }

    console.log('📝 Session logged:', {
      conversationId,
      outcome,
      messageCount: messages?.length,
      contentType: detectedContentType,
      promptVersion
    });

    return NextResponse.json({
      success: true,
      sessionId
    });

  } catch (error: any) {
    console.error('Session logging error:', error);
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
