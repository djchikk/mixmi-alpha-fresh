# Testing Checklist — Upload Overhaul (Feb 14, 2026)

## Summary of Changes
- Agent personalization (creative personality + learned preferences per persona)
- Content type intelligence (duration-based detection, smart proposals)
- Post-upload preference learning (system learns defaults from each upload)
- Drafts auto-save (periodic save during conversation, cleanup on submit)
- Radio stations moved to admin-only (`/admin/radio-stations`)
- Persona ID threaded through entire upload flow

---

## 1. Agent Profile & Personalization

**Setup:**
- [ ] Confirm `agent_preferences` table exists (migration from earlier today)
- [ ] Confirm at least one persona has a row in `agent_preferences` (trigger should have backfilled default personas)

**Chat behavior:**
- [ ] Open Upload Studio (`/upload-studio`) as a logged-in user
- [ ] Send a message — verify no errors in browser console or server logs
- [ ] Check server logs for agent profile loading (should see persona lookup)
- [ ] If persona has `agent_mission` set, verify the chatbot's tone reflects it
- [ ] If persona has no preferences yet (first upload), verify chatbot asks about everything

---

## 2. Content Type Intelligence

**Duration detection:**
- [ ] Drop a short audio file (~10-20s) — check browser console for duration detection log
- [ ] Drop a long audio file (~3+ min) — verify duration is detected
- [ ] Drop a video file — verify video duration is detected
- [ ] Drop multiple short files — verify chatbot proposes "loop pack" without asking

**Content type proposals:**
- [ ] Upload a file under 30s — chatbot should propose it as a loop
- [ ] Upload a file over 60s — chatbot should propose it as a song
- [ ] Upload multiple short files — chatbot should propose loop pack
- [ ] Verify user can override the proposed content type

---

## 3. Post-Upload Preference Learning

- [ ] Complete a full upload through the chatbot (any content type)
- [ ] Check server logs for `🧠 Agent preferences updated` message
- [ ] Query `agent_preferences` table — verify `upload_count` incremented
- [ ] Verify `typical_content_type` matches what was just uploaded
- [ ] If tags were added, verify they appear in `default_tags`
- [ ] If location was set, verify it appears in `default_cultural_tags`
- [ ] Complete a second upload — verify preferences are updated (not duplicated)
- [ ] On the second upload, verify chatbot suggests defaults from first upload

---

## 4. Drafts Auto-Save

**Migration:**
- [ ] Confirm `is_draft` column exists on `ip_tracks`:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'ip_tracks' AND column_name = 'is_draft';
  ```

**Auto-save behavior:**
- [ ] Open Upload Studio, drop a file, start chatting
- [ ] Wait ~30 seconds after file uploads
- [ ] Check server logs for `📝 Draft created` message
- [ ] Query `ip_tracks` for `is_draft = true` — verify draft record exists
- [ ] Continue chatting (add title, tags, etc.), wait another 30 seconds
- [ ] Verify `📝 Draft updated` in logs (same draft ID, updated data)
- [ ] Check that draft has `is_live = false` (not visible on globe)

**Draft cleanup on submit:**
- [ ] Complete the upload (click Submit)
- [ ] Verify `🗑️ Draft cleaned up` in server logs
- [ ] Query `ip_tracks` for the conversation_id — only the final track should exist, no draft

**Draft without enough data:**
- [ ] Open Upload Studio, type a message but don't upload any files
- [ ] Wait 30+ seconds — verify NO draft is saved (nothing to save without files)

---

## 5. Radio Removed from User-Facing Upload

- [ ] Click the upload button in Header
- [ ] Verify ContentTypeSelector shows: Chat Upload (hero), Music (manual), Video (manual)
- [ ] Verify NO radio option is visible
- [ ] Verify welcome hero in Upload Studio does NOT mention "radio stations"

---

## 6. Admin Radio Stations Page

**Access gate:**
- [ ] Navigate to `/admin/radio-stations`
- [ ] Verify access code prompt appears
- [ ] Enter wrong code — verify "Invalid code" error
- [ ] Enter `mixmi-radio-admin-2024` — verify page loads
- [ ] Refresh page — verify still authorized (sessionStorage)

**Station list:**
- [ ] Verify existing radio stations appear in the list
- [ ] Verify station packs show child count badge
- [ ] Verify pack children are shown in nested view
- [ ] Verify stream URL links open in new tab
- [ ] Verify locations and dates display correctly

**Create station:**
- [ ] Click "Add Station" — verify RadioStationModal opens
- [ ] Note: must be logged in with a wallet to create (modal uses `useAuth()`)
- [ ] Fill out form, submit — verify station appears in list after refresh
- [ ] Try creating a station pack with multiple streams

**Edit station:**
- [ ] Click edit (pencil icon) on a station — verify modal opens in edit mode
- [ ] Change title/description, save — verify changes appear in list
- [ ] Edit a station pack — verify metadata updates

**Hide/Show:**
- [ ] Click eye-off icon on a station — verify it gets "Hidden" badge and dimmed styling
- [ ] Verify hidden station doesn't appear on the globe (check `/` page)
- [ ] Click eye icon to show it again — verify badge removed

**Delete:**
- [ ] Click trash icon — verify "Confirm / Cancel" buttons appear
- [ ] Click Cancel — verify nothing happens
- [ ] Click Confirm — verify station removed from list
- [ ] For a station pack: verify children are also deleted

---

## 7. Persona ID Threading

- [ ] Upload via chatbot — check server logs for `personaId` in submit request
- [ ] Check `upload_sessions` table — verify `persona_id` is populated
- [ ] Switch personas (if multi-persona account) and upload again — verify different `persona_id`

---

## 8. Edge Cases

- [ ] Upload Studio with no persona (legacy wallet-only user) — should work without errors
- [ ] Auto-save with very rapid data changes — should not flood the server (30s throttle)
- [ ] Abandon an upload (navigate away) — verify `sendBeacon` still logs session
- [ ] Preference learning with no tags/no BPM — should update without errors

---

## Key Files Modified

| File | Changes |
|------|---------|
| `supabase/migrations/20260214000000_agent_preferences_upload_overhaul.sql` | Agent preferences table, persona limit 80, upload_sessions.persona_id |
| `supabase/migrations/20260214000001_add_is_draft_column.sql` | is_draft column on ip_tracks |
| `app/api/upload-studio/chat/route.ts` | Agent profile loading + injection, file metadata, personaId |
| `app/api/upload-studio/submit/route.ts` | Preference learner, draft cleanup, personaId |
| `app/api/upload-studio/save-draft/route.ts` | NEW — draft create/update/delete API |
| `app/api/upload-studio/log-session/route.ts` | persona_id in session records |
| `components/upload-studio/ConversationalUploader.tsx` | Duration detection, auto-save timer, personaId threading |
| `components/modals/ContentTypeSelector.tsx` | Radio removed from UI |
| `lib/upload-studio/system-prompt.ts` | Content type intelligence, file metadata param |
| `app/upload-studio/page.tsx` | Passes personaId to ConversationalUploader |
| `app/admin/radio-stations/page.tsx` | NEW — admin-only radio station management |
| `config/pricing.ts` | maxPersonas: 80 |
| `CLAUDE.md` | maxPersonas: 80 |

## Database Changes

```sql
-- New table
agent_preferences (persona_id, typical_content_type, typical_bpm_range, default_tags, etc.)

-- New columns
upload_sessions.persona_id (UUID, FK to personas)
ip_tracks.is_draft (BOOLEAN, DEFAULT FALSE)

-- Changed
personas limit trigger: 3 → 80
```
