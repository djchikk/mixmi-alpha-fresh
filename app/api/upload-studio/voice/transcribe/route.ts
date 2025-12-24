import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/upload-studio/voice/transcribe
 *
 * Receives audio blob from browser, sends to OpenAI Whisper API,
 * returns transcribed text.
 *
 * Request: FormData with 'audio' file and 'walletAddress'
 * Response: { text: string } or { error: string }
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured');
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

    // Validate file size (max 25MB for Whisper)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Audio file too large. Maximum size is 25MB.' },
        { status: 400 }
      );
    }

    console.log('🎤 Transcribing audio:', {
      name: audioFile.name,
      type: audioFile.type,
      size: `${(audioFile.size / 1024).toFixed(1)}KB`
    });

    // Prepare request to OpenAI Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile, audioFile.name || 'audio.webm');
    whisperFormData.append('model', 'whisper-1');
    // Let Whisper auto-detect language for international users

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: whisperFormData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Whisper API error:', response.status, errorData);

      return NextResponse.json(
        { error: errorData.error?.message || 'Transcription failed' },
        { status: response.status }
      );
    }

    const result = await response.json();

    console.log('✅ Transcription complete:', {
      textLength: result.text?.length || 0,
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
