import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/upload-studio/voice/speak
 *
 * Receives text, sends to ElevenLabs Text-to-Speech API,
 * returns audio stream.
 *
 * Request: { text: string, walletAddress: string }
 * Response: audio/mpeg stream
 */

// Default voice ID — can be overridden via ELEVENLABS_VOICE_ID env var
// "Rachel" is a clear, warm voice good for conversational UI
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      console.error('ELEVENLABS_API_KEY not configured');
      return NextResponse.json(
        { error: 'Voice synthesis not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { text, walletAddress } = body;

    // Auth check: require wallet address
    if (!walletAddress || walletAddress.length < 10) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    // ElevenLabs has a 5000 character limit per request
    if (text.length > 5000) {
      return NextResponse.json(
        { error: 'Text too long. Maximum 5000 characters.' },
        { status: 400 }
      );
    }

    const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

    console.log('🔊 Generating speech via ElevenLabs:', {
      textLength: text.length,
      voiceId,
      preview: text.substring(0, 50) + (text.length > 50 ? '...' : '')
    });

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        output_format: 'mp3_44100_128',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('ElevenLabs TTS error:', response.status, errorData);

      return NextResponse.json(
        { error: errorData.detail?.message || errorData.detail || 'Speech synthesis failed' },
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
