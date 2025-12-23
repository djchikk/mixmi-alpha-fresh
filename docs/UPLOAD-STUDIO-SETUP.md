# Upload Studio Setup Guide

The Upload Studio is a conversational AI interface for uploading content to mixmi. This guide covers setup and configuration.

## Prerequisites

1. Supabase project with existing `ip_tracks` table
2. Anthropic API key
3. Existing auth system (wallet or alpha codes)

## Setup Steps

### 1. Environment Variables

Add the following to your `.env.local`:

```bash
# Anthropic API Key for conversational upload
ANTHROPIC_API_KEY=sk-ant-api03-...your-key-here...
```

**Getting an Anthropic API Key:**
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new key
5. Copy and add to `.env.local`

### 2. Database Migrations

Run the SQL migrations in Supabase SQL Editor:

**File:** `scripts/upload-studio-migrations.sql`

This creates:
- `upload_source` column on `ip_tracks` (tracks where upload came from)
- `conversation_id` column on `ip_tracks` (links to conversation)
- `pending_collaborators` table (for collaborators without wallets)
- `conversation_logs` table (optional, for debugging)
- `claim_pending_collaborator` function (for invite redemption)

### 3. Verify Installation

After setup, test the flow:

1. Navigate to `/upload-studio`
2. Sign in with wallet or alpha code
3. Start a conversation
4. Upload a file
5. Complete the registration

## Architecture

### Files Created

```
app/
  upload-studio/
    page.tsx                 # Main page route
  api/
    upload-studio/
      chat/
        route.ts             # AI conversation endpoint
      upload-file/
        route.ts             # File upload endpoint
      submit/
        route.ts             # Track submission endpoint

components/
  upload-studio/
    ConversationalUploader.tsx  # Main chat UI

lib/
  upload-studio/
    system-prompt.ts         # AI system prompt and helpers

scripts/
  upload-studio-migrations.sql  # Database changes
```

### Data Flow

```
User Message
    ↓
/api/upload-studio/chat
    ↓
Claude API (with system prompt)
    ↓
Parse response for extracted data
    ↓
Update UI with structured data
    ↓
[When ready]
    ↓
/api/upload-studio/submit
    ↓
Insert into ip_tracks table
```

### Content Types Supported

| Type | Required Fields | Optional |
|------|----------------|----------|
| loop | title, artist, bpm, audio | key, tags, description |
| loop_pack | pack_title, artist, 2-5 audio files | bpm |
| full_song | title, artist, audio | bpm, description |
| ep | ep_title, artist, 2-5 audio files | description |
| video_clip | title, artist, video | description |

## Handling Collaborators Without Wallets

When a user mentions collaborators by name but doesn't have their wallet addresses:

1. Track is created with percentage allocated but wallet field empty
2. Entry added to `pending_collaborators` table
3. Invite system can notify collaborators
4. Collaborators claim their spot by connecting wallet

### Claiming a Pending Split

```sql
SELECT * FROM claim_pending_collaborator('INVITE_CODE', 'SP1WALLET...');
```

## Troubleshooting

### "API key not configured"
- Check `ANTHROPIC_API_KEY` is set in `.env.local`
- Restart the dev server after adding

### File upload fails
- Check Supabase storage bucket exists (`user-content`)
- Verify service role key has upload permissions
- Check file size limits (50MB audio, 10MB video, 5MB images)

### Track not appearing on globe
- Verify `is_live` is `true` in the record
- Check `location_lat`/`location_lng` if using location filtering
- Ensure `content_type` is a valid type

## API Reference

### POST /api/upload-studio/chat

Request:
```json
{
  "conversationId": "uuid",
  "message": "user message",
  "attachments": [{ "type": "audio", "url": "...", "name": "track.mp3" }],
  "currentData": { "title": "...", "artist": "..." },
  "walletAddress": "SP1...",
  "messageHistory": [{ "role": "user", "content": "..." }]
}
```

Response:
```json
{
  "message": "Assistant response",
  "extractedData": { "title": "...", "bpm": 128 },
  "readyToSubmit": false,
  "conversationId": "uuid"
}
```

### POST /api/upload-studio/upload-file

Request: FormData with `file`, `type`, `walletAddress`

Response:
```json
{
  "success": true,
  "url": "https://...",
  "type": "audio",
  "filename": "...",
  "size": 1234567
}
```

### POST /api/upload-studio/submit

Request:
```json
{
  "trackData": { "title": "...", "artist": "...", ... },
  "walletAddress": "SP1...",
  "conversationId": "uuid"
}
```

Response:
```json
{
  "success": true,
  "trackId": "uuid",
  "track": { "id": "...", "title": "...", "artist": "..." },
  "pendingCollaborators": 0
}
```
