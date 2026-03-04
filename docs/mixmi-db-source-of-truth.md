# Mixmi Database — Remix & Attribution Source of Truth
**Last updated: Feb 25, 2026**

---

## Core Tables for Remix Graph

### 1. `ip_tracks` — The Main Content Table
Every piece of content on Mixmi (seeds, remixes, loops, songs) is a row here.

**Identity & Metadata:**
- `id` (uuid) — primary key
- `title`, `artist`, `description`, `tags` (array)
- `content_type` — e.g. "loop" (will eventually distinguish audio vs video)
- `cover_image_url`, `audio_url`
- `is_live` (boolean), `is_deleted` (boolean)

**Remix Lineage (how content connects):**
- `generation` (integer) — 0 = original seed, 1 = first remix, 2 = remix of remix, etc.
- `parent_track_1_id` (uuid) — first source track this was remixed from
- `parent_track_2_id` (uuid) — second source track (from 2-channel mixer)
- `source_track_ids` (array) — same parents as an array (redundant but useful)
- `remix_depth` (integer) — currently matches `generation`

**Current state: 2 parent tracks per remix (2-channel mixer). Future: up to 4 (2 video + 2 audio).**

**Geographic:**
- `primary_location` (text) — human-readable location name
- `location_lat`, `location_lng` (numeric) — coordinates for globe view

**Payment Splits — Composition Rights (up to 7 people):**
- `composition_split_1_wallet` + `composition_split_1_percentage`
- `composition_split_2_wallet` + `composition_split_2_percentage`
- ... through `composition_split_7_wallet` + `composition_split_7_percentage`

**Payment Splits — Production/Recording Rights (up to 7 people):**
- `production_split_1_wallet` + `production_split_1_percentage`
- `production_split_2_wallet` + `production_split_2_percentage`
- ... through `production_split_7_wallet` + `production_split_7_percentage`

**This means up to 14 people can receive payment splits on a single track (7 composition + 7 production).**

**Pricing:**
- `remix_price` / `remix_price_stx` — cost to remix this track
- `download_price` / `download_price_stx` — cost to download
- `combined_price` — bundle price
- `payment_status` — tracks whether remix payment was completed

**Permissions:**
- `allow_remixing` (boolean)
- `allow_downloads` (boolean)
- `open_to_commercial` (boolean)
- `open_to_collaboration` (boolean)

---

### 2. `remix_relationships` — The Edge Table
One row per parent→child link. A remix with 2 parents creates 2 rows here.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `parent_track_id` | uuid | The source track |
| `child_track_id` | uuid | The remix that used it |
| `remix_depth` | integer | Generation of the child |
| `remixer_wallet` | text | Who made the remix |
| `session_id` | text | Upload session reference |
| `created_at` | timestamp | When the remix was created |

**This is the primary table for drawing graph edges.**

---

### 3. `track_lineage` — Pre-Computed Ancestry
Stores the full ancestor chain for every track, pre-calculated so you don't need recursive queries.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `track_id` | uuid | The track in question |
| `ancestor_track_id` | uuid | An ancestor (could be parent, grandparent, etc.) |
| `generation_distance` | integer | How many generations back (1 = parent, 2 = grandparent) |
| `contribution_weight` | numeric | How much this ancestor contributes (for payment calc) |
| `discovery_path` | array | The full chain of track IDs from ancestor to this track |
| `created_at` | timestamp | When computed |

**Use this for "click a node, light up everything back to origin" — it's already computed.**

---

### 4. `ip_remix_attribution` — Attribution Records
Links remixes back to originals with the remixer's identity and their percentage.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `original_track_id` | uuid | The source track |
| `remix_track_id` | uuid | The remix |
| `remixer_address` | text | Wallet of the remixer |
| `remix_percentage` | integer | What % the remixer gets |
| `created_at` | timestamp | When attribution was recorded |

---

### 5. `ip_track_collaborators` — Collaboration Records
Who worked on a track and in what role.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `track_id` | uuid | The track |
| `collaborator_address` | text | Wallet of collaborator |
| `role` | text | What they did (producer, vocalist, etc.) |
| `contribution_percentage` | integer | Their share |
| `notes` | text | Freeform notes |

---

### 6. Payment Tables

**`recording_payments`** — Records of payments made for remix licenses
**`recording_payment_recipients`** — Who received each payment and how much
**`earnings`** — Accumulated earnings per creator
**`transactions`** / **`ting_transactions`** — Transaction history

---

## How a Remix Gets Created (Data Flow)

1. User loads 2 source tracks into the mixer
2. User creates remix → new row in `ip_tracks` with:
   - `parent_track_1_id` = first source
   - `parent_track_2_id` = second source
   - `source_track_ids` = [both parents]
   - `generation` = max(parent generations) + 1
3. `remix_relationships` gets 2 new rows (one per parent→child link)
4. `ip_remix_attribution` gets a row recording the attribution
5. `track_lineage` gets populated with full ancestry chain
6. Payment splits are calculated and recorded

---

## Graph Visualization Queries

**All nodes (tracks):**
```sql
SELECT id, title, artist, generation, content_type,
       primary_location, location_lat, location_lng,
       cover_image_url, parent_track_1_id, parent_track_2_id
FROM ip_tracks 
WHERE is_deleted IS NOT TRUE AND is_live = TRUE;
```

**All edges (remix relationships):**
```sql
SELECT parent_track_id, child_track_id, remix_depth
FROM remix_relationships;
```

**Full ancestry for a specific track (click-to-trace):**
```sql
SELECT ancestor_track_id, generation_distance, 
       contribution_weight, discovery_path
FROM track_lineage 
WHERE track_id = '[clicked_node_id]'
ORDER BY generation_distance;
```

**All descendants of a seed:**
```sql
SELECT track_id, generation_distance, discovery_path
FROM track_lineage 
WHERE ancestor_track_id = '[seed_id]'
ORDER BY generation_distance;
```

---

## Known Legacy Items
- Some test records exist with titles like "testing payment failure" — filter with `is_live = TRUE`
- `remix_depth` on `ip_tracks` currently mirrors `generation` — may diverge later
- Multiple backup tables exist (e.g. `ip_tracks_backup_20260123`) — ignore these
- Some columns like `sample_type`, `loop_category` are from earlier iterations
