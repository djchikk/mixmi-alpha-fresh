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

    // Filter out empty messages and prepare for API
    const filteredMessages = messages
      .slice(1) // Remove system message (it's passed separately)
      .filter(m => m.content && m.content.trim() !== '') // Remove empty messages
      .filter(m => m.role === 'user' || m.role === 'assistant'); // Only user/assistant roles

    // Ensure messages alternate properly (Anthropic requires this)
    const apiMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    let lastRole: 'user' | 'assistant' | null = null;

    for (const m of filteredMessages) {
      const role = m.role as 'user' | 'assistant';
      // Skip if same role as previous (shouldn't happen, but safety check)
      if (role === lastRole) {
        console.warn('⚠️ Skipping duplicate role message:', { role, content: m.content.substring(0, 50) });
        continue;
      }
      apiMessages.push({ role, content: m.content });
      lastRole = role;
    }

    // Debug: Log the final message structure
    console.log('📨 API Messages:', apiMessages.map(m => ({ role: m.role, contentLength: m.content.length })));

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929', // Claude Sonnet 4.5
      max_tokens: 1024,
      system: UPLOAD_STUDIO_SYSTEM_PROMPT,
      messages: apiMessages
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
