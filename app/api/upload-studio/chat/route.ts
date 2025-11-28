import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  UPLOAD_STUDIO_SYSTEM_PROMPT,
  formatMessagesForAPI,
  parseExtractedData
} from '@/lib/upload-studio/system-prompt';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      conversationId,
      message,
      attachments,
      currentData,
      walletAddress,
      messageHistory
    } = body;

    // Validate required fields
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Build attachment info string
    let attachmentInfo = '';
    if (attachments && attachments.length > 0) {
      attachmentInfo = attachments
        .map((a: any) => `${a.type}: "${a.name}"${a.url ? ' (uploaded)' : ''}`)
        .join(', ');
    }

    // Format messages for the API
    const messages = formatMessagesForAPI(
      UPLOAD_STUDIO_SYSTEM_PROMPT,
      messageHistory || [],
      message,
      currentData || {},
      attachmentInfo
    );

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: UPLOAD_STUDIO_SYSTEM_PROMPT,
      messages: messages.slice(1).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    });

    // Extract the response text
    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Parse the response for extracted data
    const parsed = parseExtractedData(responseText);

    // Log for debugging
    console.log('📝 Upload Studio Chat:', {
      conversationId,
      userMessage: message.substring(0, 100),
      extractedData: parsed.extractedData,
      readyToSubmit: parsed.readyToSubmit
    });

    return NextResponse.json({
      message: parsed.message,
      extractedData: parsed.extractedData,
      readyToSubmit: parsed.readyToSubmit,
      conversationId
    });

  } catch (error: any) {
    console.error('Upload Studio Chat Error:', error);

    // Handle specific errors
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'API key not configured. Please add ANTHROPIC_API_KEY to your environment.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process message', details: error.message },
      { status: 500 }
    );
  }
}
