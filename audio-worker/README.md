# mixmi Audio Worker

FFmpeg-based audio enhancement service for mixmi. Runs on Fly.io.

## Deployment

1. Install Fly CLI: https://fly.io/docs/hands-on/install-flyctl/

2. Login to Fly:
```bash
fly auth login
```

3. Create the app (first time only):
```bash
cd audio-worker
fly apps create mixmi-audio-worker
```

4. Deploy:
```bash
fly deploy
```

5. Get the URL:
```bash
fly status
# URL will be: https://mixmi-audio-worker.fly.dev
```

## API

### POST /enhance

Enhance audio with FFmpeg processing.

**Request:**
```json
{
  "sourceUrl": "https://example.com/audio.wav",
  "enhancementType": "auto"
}
```

**Enhancement Types:**
- `auto` - Balanced (highpass + compression + loudnorm)
- `voice` - Optimized for vocals/speech
- `clean` - Minimal processing (highpass + loudnorm only)
- `warm` - Adds low-end richness
- `studio` - Full mastering treatment

**Response:**
Returns the enhanced WAV file as binary data.

### GET /health

Health check endpoint.

## Local Development

```bash
cd audio-worker
npm install
npm run dev
```

Server runs at http://localhost:3001

## Environment Variables

- `PORT` - Server port (default: 3001)
- `HOST` - Server host (default: 0.0.0.0)
