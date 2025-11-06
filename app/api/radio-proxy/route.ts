import { NextRequest, NextResponse } from 'next/server';

// SSRF Protection: Validate URL is external and safe
function isUrlSafe(urlString: string): { safe: boolean; error?: string } {
  try {
    const url = new URL(urlString);

    // Only allow HTTP and HTTPS protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { safe: false, error: 'Only HTTP and HTTPS protocols are allowed' };
    }

    // Blocked internal/private IP ranges and localhost
    const hostname = url.hostname.toLowerCase();
    const blockedPatterns = [
      /^localhost$/i,
      /^127\./,           // 127.0.0.0/8 - Loopback
      /^10\./,            // 10.0.0.0/8 - Private network
      /^172\.(1[6-9]|2[0-9]|3[01])\./,  // 172.16.0.0/12 - Private network
      /^192\.168\./,      // 192.168.0.0/16 - Private network
      /^169\.254\./,      // 169.254.0.0/16 - Link-local (AWS metadata)
      /^0\./,             // 0.0.0.0/8
      /^::1$/,            // IPv6 localhost
      /^fe80:/i,          // IPv6 link-local
      /^fc00:/i,          // IPv6 unique local
      /^ff00:/i,          // IPv6 multicast
    ];

    for (const pattern of blockedPatterns) {
      if (pattern.test(hostname)) {
        return { safe: false, error: 'Access to internal/private networks is not allowed' };
      }
    }

    return { safe: true };
  } catch (error) {
    return { safe: false, error: 'Invalid URL format' };
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const streamUrl = searchParams.get('url');

  if (!streamUrl) {
    return NextResponse.json({ error: 'Missing stream URL' }, { status: 400 });
  }

  // Validate URL for SSRF protection
  const { safe, error } = isUrlSafe(streamUrl);
  if (!safe) {
    console.warn('⚠️ Blocked potentially unsafe URL:', streamUrl, error);
    return NextResponse.json({ error: error || 'Invalid URL' }, { status: 400 });
  }

  try {
    console.log('📻 Proxying radio stream:', streamUrl);

    // Fetch the radio stream with timeout (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MixMi/1.0)',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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

    // Handle specific error types
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Radio stream request timed out' },
        { status: 504 }
      );
    }

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
