# Radio Stations - Phase 1 Setup Guide
**Date:** October 30, 2025
**Branch:** `feature/radio-stations-integration`
**Status:** Ready to test!

---

## ✅ What's Been Done

1. **Feature branch created** - `feature/radio-stations-integration`
2. **TypeScript updated** - Added `radio_station` and `station_pack` to content types
3. **SQL scripts created** - Ready to run

---

## 🚀 Next Steps (Run These in Order)

### Step 1: Add Database Columns

Run this in Supabase SQL Editor:
```bash
scripts/add-radio-station-fields-2025-10-30.sql
```

**This adds:**
- `stream_url` column (for audio stream)
- `metadata_api_url` column (for now playing info)
- Updates content_type constraint to include `radio_station` and `station_pack`

---

### Step 2: Insert Test Radio Station

**FIRST:** Update the wallet address in the script!

Open `scripts/insert-test-radio-station-2025-10-30.sql` and replace:
```sql
'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JCY'
```

With YOUR actual wallet address (or one from alpha_users table).

**THEN:** Run the script in Supabase SQL Editor.

**This creates:**
- Test station: "House Vibes 24/7"
- Location: NYC (Times Square)
- Placeholder stream URL
- Orange theme (will be styled in UI)

---

## 🎨 What Happens Next

Once the test station is inserted, Claude Code will:

1. **Add orange border styling** - Cards with `content_type: 'radio_station'` get 2px orange border
2. **Test globe display** - Verify station appears on globe in NYC
3. **Enable drag to radio widget** - Make it playable!

---

## 🔧 If You Want to Use Real Stream URL

After testing with placeholder, update the stream URL:

```sql
UPDATE ip_tracks
SET stream_url = 'https://your-real-stream-url.com/stream'
WHERE title = 'House Vibes 24/7';
```

---

## 🎨 Color Reference

**Orange for Radio:** `#FB923C`

- 2px border: Individual station
- 4px border: Station pack
- Semantic: "Live/Broadcast/Energy"

---

## 📋 Phase 1 Checklist

- [x] Create feature branch
- [x] Update TypeScript types
- [x] Create SQL migration for columns
- [x] Create test data script
- [ ] **→ Run SQL scripts (YOU DO THIS!)**
- [ ] Add orange styling to cards
- [ ] Verify globe display
- [ ] Connect to radio widget

---

**Ready to run the SQL scripts?** Let me know once they're done and I'll add the orange styling to the cards!
