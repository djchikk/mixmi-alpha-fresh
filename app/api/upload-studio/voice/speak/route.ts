import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/upload-studio/voice/speak
 *
 * Receives text, sends to OpenAI TTS API,
 * returns audio stream.
 *
 * Request: { text: string, voice?: string }
 * Response: audio/mpeg stream
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'Voice synthesis not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { text, voice = 'nova' } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    // OpenAI TTS has a 4096 character limit
    if (text.length > 4096) {
      return NextResponse.json(
        { error: 'Text too long. Maximum 4096 characters.' },
        { status: 400 }
      );
    }

    // Validate voice option
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const selectedVoice = validVoices.includes(voice) ? voice : 'nova';

    console.log('🔊 Generating speech:', {
      textLength: text.length,
      voice: selectedVoice,
      preview: text.substring(0, 50) + (text.length > 50 ? '...' : '')
    });

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1', // Use tts-1-hd for higher quality (slower, more expensive)
        input: text,
        voice: selectedVoice,
        response_format: 'mp3', // mp3 is widely supported
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('TTS API error:', response.status, errorData);

      return NextResponse.json(
        { error: errorData.error?.message || 'Speech synthesis failed' },
        { status: response.status }
      );
    }

    // Get the audio data as ArrayBuffer
    const audioData = await response.arrayBuffer();

    console.log('✅ Speech generated:', {
      size: `${(audioData.byteLength / 1024).toFixed(1)}KB`
    });

    // Return audio as a stream
    return new NextResponse(audioData, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioData.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('Speech synthesis error:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
}
