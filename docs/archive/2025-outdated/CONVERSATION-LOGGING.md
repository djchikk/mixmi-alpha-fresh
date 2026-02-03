# Upload Studio Conversation Logging

A three-layer logging system for analyzing and improving the Upload Studio chatbot.

## Overview

Every conversation in the Upload Studio is logged for analysis, enabling:
- Understanding where users get confused
- Measuring prompt effectiveness
- Detecting sensitive content early
- Tracking outcomes (submitted vs abandoned)
- Replaying sessions for debugging

## Architecture

### Database Tables

#### `upload_sessions` (Summary)
One row per conversation session. Contains rolled-up metrics and final state.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `conversation_id` | TEXT | Unique session identifier |
| `wallet_address` | TEXT | User's wallet |
| `messages` | JSONB | Full transcript (cached) |
| `inferred_data` | JSONB | What chatbot extracted |
| `confidence_scores` | JSONB | Per-field confidence (0-1) |
| `flags` | JSONB | Observations/signals |
| `outcome` | TEXT | submitted/abandoned/error/in_progress |
| `final_track_id` | UUID | Link to created track |
| `session_duration_ms` | INT | Total session time |
| `prompt_version` | TEXT | System prompt version |
| `model_name` | TEXT | AI model used |

#### `upload_session_events` (Append-Only Log)
Individual events within a session. Never modified after creation.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `session_id` | UUID | FK to upload_sessions |
| `event_index` | INT | Order within session |
| `event_type` | TEXT | Type of event |
| `role` | TEXT | user/assistant/system |
| `content` | TEXT | Message content |
| `payload` | JSONB | Event-specific data |

### Event Types

| Type | Description | Payload |
|------|-------------|---------|
| `user_message` | User sent a message | `{ attachments?, sensitivity_keywords_detected? }` |
| `assistant_message` | Chatbot response | `{ attachments? }` |
| `sensitivity_signal` | Sensitive keyword detected | `{ keywords, context, source_message_index }` |
| `file_upload` | File uploaded | `{ type, url, name }` |
| `extraction` | Data extracted | `{ field, value, confidence }` |
| `nudge` | UI nudge shown | `{ nudge_type, shown, accepted }` |
| `edit` | User edited inferred value | `{ field, from, to }` |
| `state_change` | State transition | `{ from_state, to_state }` |
| `error` | Error occurred | `{ error_type, message }` |

## Sensitivity Detection

Keywords are scanned in user messages to detect potentially sacred/traditional content:

```javascript
const SENSITIVITY_KEYWORDS = [
  'god', 'prayer', 'sacred', 'ceremony', 'ancestor', 'blessing',
  'spiritual', 'elder', 'tradition', 'secret', 'family only', 'not for everyone'
];
```

When detected:
1. Keywords added to message event payload: `sensitivity_keywords_detected`
2. Separate `sensitivity_signal` event created with context

This enables the chatbot to handle traditional/sacred content with appropriate care.

## API Endpoints

### POST `/api/upload-studio/log-session`

Logs or updates a session with all events.

```typescript
{
  conversationId: string,
  walletAddress: string,
  messages: Array<{ role, content, timestamp, attachments? }>,
  inferredData: Record<string, any>,
  outcome: 'submitted' | 'abandoned' | 'error' | 'in_progress',
  finalTrackId?: string,
  promptVersion?: string,
  modelName?: string
}
```

### PATCH `/api/upload-studio/log-session`

Updates session outcome (e.g., marking as abandoned).

```typescript
{
  conversationId: string,
  outcome: 'abandoned' | 'error',
  errorMessage?: string
}
```

## Client Integration

The `ConversationalUploader` component automatically:

1. **On successful submit**: Logs session with `outcome: 'submitted'`
2. **On error**: Logs session with `outcome: 'error'`
3. **On unmount** (page leave): Logs session with `outcome: 'abandoned'` via `sendBeacon`

```typescript
// Logged after successful submission
await logSession('submitted', trackId, packId);

// Logged on error
await logSession('error', undefined, undefined, error.message);

// Logged on page leave (via sendBeacon for reliability)
navigator.sendBeacon('/api/upload-studio/log-session', data);
```

## Querying the Data

### Find sessions with sensitivity signals
```sql
SELECT s.*, e.payload
FROM upload_sessions s
JOIN upload_session_events e ON e.session_id = s.id
WHERE e.event_type = 'sensitivity_signal';
```

### Find abandoned sessions that reached ready state
```sql
SELECT * FROM upload_sessions
WHERE outcome = 'abandoned' AND reached_ready_state = true;
```

### Find sessions where content type changed
```sql
SELECT * FROM upload_sessions
WHERE content_type_changed = true;
```

### Get full event timeline for a session
```sql
SELECT * FROM upload_session_events
WHERE session_id = 'uuid-here'
ORDER BY event_index;
```

## Version Tracking

Track prompt and model versions for A/B analysis:

```sql
-- Compare outcomes by prompt version
SELECT prompt_version, outcome, COUNT(*)
FROM upload_sessions
GROUP BY prompt_version, outcome;
```

## Future Improvements

1. **Confidence Scores**: Track per-field confidence from AI extraction
2. **Nudge Tracking**: Log when split nudges are shown/accepted
3. **Edit Diffs**: Structured diffs when users change inferred values
4. **Persona Detection**: Log detected user persona (professional vs community)
5. **Replay System**: UI to replay sessions for debugging

## Files

| File | Purpose |
|------|---------|
| `app/api/upload-studio/log-session/route.ts` | Logging API endpoint |
| `components/upload-studio/ConversationalUploader.tsx` | Client integration |
| `scripts/migrations/create-upload-sessions-table.sql` | Sessions table schema |
| `scripts/migrations/add-upload-session-events.sql` | Events table schema |
