import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/upload-studio/voice/transcribe
 *
 * Receives audio blob from browser, sends to ElevenLabs Speech-to-Text API,
 * returns transcribed text.
 *
 * Request: FormData with 'audio' file and 'walletAddress'
 * Response: { text: string } or { error: string }
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      console.error('ELEVENLABS_API_KEY not configured');
      return NextResponse.json(
        { error: 'Voice transcription not configured' },
        { status: 500 }
      );
    }

    // Get the audio file from the request
    const formData = await request.formData();

    // Auth check: require wallet address
    const walletAddress = formData.get('walletAddress') as string;
    if (!walletAddress || walletAddress.length < 10) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Validate file size (max 3GB for ElevenLabs, but keep reasonable for voice messages)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Audio file too large. Maximum size is 25MB.' },
        { status: 400 }
      );
    }

    console.log('🎤 Transcribing audio via ElevenLabs:', {
      name: audioFile.name,
      type: audioFile.type,
      size: `${(audioFile.size / 1024).toFixed(1)}KB`
    });

    // Prepare request to ElevenLabs Speech-to-Text API
    // Hint English to keep transcription in Latin script — covers our alpha
    // languages (English, French, Spanish, Swahili, Danish) without Cyrillic confusion
    const sttFormData = new FormData();
    sttFormData.append('file', audioFile, audioFile.name || 'audio.webm');
    sttFormData.append('model_id', 'scribe_v1');
    sttFormData.append('language_code', 'eng');

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: sttFormData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('ElevenLabs STT error:', response.status, errorData);

      return NextResponse.json(
        { error: errorData.detail?.message || errorData.detail || 'Transcription failed' },
        { status: response.status }
      );
    }

    const result = await response.json();

    console.log('✅ Transcription complete:', {
      textLength: result.text?.length || 0,
      language: result.language_code || 'unknown',
      preview: result.text?.substring(0, 50) + '...'
    });

    return NextResponse.json({ text: result.text });

  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
