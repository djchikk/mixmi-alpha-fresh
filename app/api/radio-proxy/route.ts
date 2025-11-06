import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const streamUrl = searchParams.get('url');

  if (!streamUrl) {
    return NextResponse.json({ error: 'Missing stream URL' }, { status: 400 });
  }

  try {
    console.log('📻 Proxying radio stream:', streamUrl);

    // Fetch the radio stream
    const response = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MixMi/1.0)',
      },
    });

    if (!response.ok) {
      console.error('❌ Radio stream fetch failed:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Stream fetch failed: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get the content type from the upstream response
    const contentType = response.headers.get('content-type') || 'audio/mpeg';

    // Create response with proper headers for streaming
    const headers = new Headers({
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    // If range request, pass it through
    const range = request.headers.get('range');
    if (range) {
      headers.set('Accept-Ranges', 'bytes');
    }

    // Stream the response body
    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error('❌ Radio proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy radio stream' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
    },
  });
}
