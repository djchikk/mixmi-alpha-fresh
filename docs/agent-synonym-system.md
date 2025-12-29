# Agent Synonym System

Documentation for Bestie's intelligent search system, including synonym expansion, script detection, and search analytics.

---

## Overview

The agent ("Bestie") helps users find content by describing vibes rather than exact metadata. The synonym system makes searches smarter by:

1. **Expanding search terms** - "japanese" also searches for "tokyo", "japan", "日本"
2. **Detecting scripts** - Japanese/Korean/Chinese/Arabic characters infer location
3. **Weighted scoring** - Direct matches score higher than related terms
4. **Learning from searches** - All queries logged for improving upload prompts

---

## Architecture

```
User Input: "chill japanese loops"
        ↓
┌─────────────────────────────────────────┐
│ parseDescription()                       │
│ → contentTypes: ['loop', 'loop_pack']   │
│ → energy: 'chill'                        │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ extractSearchKeywords()                  │
│ → ['chill', 'japanese']                  │
│ (filters: loop, loops, bpm, etc.)        │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ expandKeywordsWithSynonyms()             │
│ → chill(1.0), relaxed(0.9), mellow(0.9) │
│ → japanese(1.0), tokyo(1.0), japan(1.0) │
│ → osaka(0.8), kyoto(0.8), 日本(1.0)      │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Database Query                           │
│ → content_type IN ('loop', 'loop_pack') │
│ → is_deleted = false OR NULL            │
│ → pack_id IS NULL                        │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Scoring (per track)                      │
│ + baseline (1 if content type matched)   │
│ + weight for each keyword in metadata    │
│ + 2× weight for tag matches              │
│ + weight for title matches               │
└─────────────────────────────────────────┘
        ↓
Top 5 results → User's Crate
```

---

## Database Tables

### search_synonyms

Maps search terms to related terms for smarter matching.

```sql
CREATE TABLE search_synonyms (
  id UUID PRIMARY KEY,
  search_term TEXT NOT NULL,      -- What user might search
  matches_term TEXT NOT NULL,     -- What it should also match
  category TEXT NOT NULL,         -- location, genre, mood, language, content_type
  weight DECIMAL(3,2) DEFAULT 1.0, -- Match strength
  created_at TIMESTAMPTZ
);
```

**Categories:**
- `location` - Geographic terms (japanese → tokyo, australian → sydney)
- `genre` - Music styles (electronic → techno, hiphop → rap)
- `mood` - Vibe/energy (chill → relaxed, energetic → upbeat)
- `language` - Script mappings (日本 → japanese, ラジオ → radio)
- `content_type` - Type aliases (future use)

**Weights:**
- `1.0` - Equivalent/exact (japanese ↔ japan)
- `0.8-0.9` - Very related (chill → relaxed)
- `0.5-0.7` - Loosely related (electronic → house)

### agent_search_logs

Captures all agent searches for analytics and improving the upload chatbot.

```sql
CREATE TABLE agent_search_logs (
  id UUID PRIMARY KEY,
  query TEXT NOT NULL,            -- Raw search input
  mode TEXT NOT NULL,             -- 'hunt' or 'vibe'
  parsed_criteria JSONB,          -- Extracted criteria
  results_count INTEGER,          -- Tracks returned
  had_results BOOLEAN GENERATED,  -- results_count > 0
  created_at TIMESTAMPTZ
);
```

---

## Initial Synonym Data

The system ships with ~100 synonyms across categories:

### Location Synonyms
| Search Term | Matches | Weight |
|-------------|---------|--------|
| japanese | tokyo, japan, osaka, kyoto, 日本, 東京 | 0.8-1.0 |
| australian | australia, sydney, melbourne, brisbane | 0.7-1.0 |
| british | uk, london, england | 0.8-1.0 |
| french | france, paris | 0.8-1.0 |
| german | germany, berlin | 0.8-1.0 |
| latin | latino, spanish | 0.7-1.0 |
| brazilian | brazil | 1.0 |

### Genre Synonyms
| Search Term | Matches | Weight |
|-------------|---------|--------|
| electronic | edm, synth, techno, house, electro | 0.7-0.9 |
| hiphop | hip-hop, hip hop, rap | 0.8-1.0 |
| lofi | lo-fi, lo fi, chill | 0.6-1.0 |
| ambient | atmospheric, soundscape | 0.7-0.8 |
| jazz | jazzy | 0.9 |
| funk | funky | 0.9 |
| reggae | dub | 0.7 |

### Mood Synonyms
| Search Term | Matches | Weight |
|-------------|---------|--------|
| chill | relaxed, calm, mellow, laid back, smooth | 0.7-0.9 |
| energetic | upbeat, high energy, driving, pumping, hype | 0.8-1.0 |
| dark | moody, brooding | 0.7-0.8 |
| happy | uplifting, joyful | 0.8-0.9 |
| dreamy | ethereal, floating | 0.7-0.8 |
| groovy | groove, funky | 0.7-1.0 |

### Language/Script Synonyms
| Search Term | Matches | Weight |
|-------------|---------|--------|
| 日本 | japanese, japan | 1.0 |
| 東京 | tokyo | 1.0 |
| ラジオ | radio | 1.0 |
| 音楽 | music | 0.8 |

---

## Script Detection

The system automatically detects non-Latin scripts and infers context.

### Supported Scripts

```typescript
function detectScripts(text: string) {
  return {
    hasJapanese: /[\u3040-\u30FF\u4E00-\u9FAF]/.test(text), // Hiragana, Katakana, Kanji
    hasChinese: /[\u4E00-\u9FFF]/.test(text),               // CJK Unified
    hasKorean: /[\uAC00-\uD7AF\u1100-\u11FF]/.test(text),   // Hangul
    hasArabic: /[\u0600-\u06FF]/.test(text),                // Arabic
  };
}
```

### Inferred Terms

| Script Detected | Terms Added |
|-----------------|-------------|
| Japanese | japanese, japan, tokyo |
| Korean | korean, korea, seoul |
| Chinese (not Japanese) | chinese, china |
| Arabic | arabic, middle east |

### Bidirectional Matching

Script detection works both ways:

1. **Search → Tracks**: User searches "ラジオ" → matches tracks tagged "japanese"
2. **Tracks → Search**: Track titled "東京電波" → matches search for "japanese radio"

---

## Adding New Synonyms

### Via SQL

```sql
-- Single synonym
INSERT INTO search_synonyms (search_term, matches_term, category, weight)
VALUES ('trap', 'hiphop', 'genre', 0.6);

-- Bidirectional pair
INSERT INTO search_synonyms (search_term, matches_term, category, weight)
VALUES
  ('dnb', 'drum and bass', 'genre', 1.0),
  ('drum and bass', 'dnb', 'genre', 1.0);

-- Location with multiple cities
INSERT INTO search_synonyms (search_term, matches_term, category, weight)
VALUES
  ('spanish', 'spain', 'location', 1.0),
  ('spanish', 'madrid', 'location', 0.8),
  ('spanish', 'barcelona', 'location', 0.8);
```

### Weight Guidelines

- **1.0** - Terms are interchangeable (uk ↔ british)
- **0.9** - Very strong association (chill → relaxed)
- **0.8** - Strong association (japanese → osaka)
- **0.7** - Moderate association (electronic → house)
- **0.5-0.6** - Loose association (rock → guitar)

---

## Analytics & Intelligence Layer

### Querying Search Logs

```sql
-- Most common searches
SELECT query, COUNT(*) as count
FROM agent_search_logs
GROUP BY query
ORDER BY count DESC
LIMIT 20;

-- Failed searches (opportunities for better metadata)
SELECT query, parsed_criteria
FROM agent_search_logs
WHERE had_results = false
ORDER BY created_at DESC
LIMIT 50;

-- Search patterns by content type
SELECT
  parsed_criteria->>'contentTypes' as content_types,
  COUNT(*) as count
FROM agent_search_logs
WHERE parsed_criteria->>'contentTypes' IS NOT NULL
GROUP BY content_types
ORDER BY count DESC;
```

### Future: Feedback Loop

The search logs can inform the upload chatbot:

1. Analyze common search terms that return no results
2. Identify metadata gaps (e.g., lots of "ambient" searches, few tagged tracks)
3. Prompt uploaders: "Many users search for 'ambient' - would that describe your track?"
4. Auto-suggest tags based on popular search patterns

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/agent/vibeMatch.ts` | Core search logic, synonym expansion, scoring |
| `components/AgentWidget.tsx` | Pop-out widget UI on globe page |
| `components/agent/AgentVibeMatcher.tsx` | Search input component |
| `app/api/agent/vibe-match/route.ts` | API endpoint, logs searches |
| `scripts/create-search-synonyms-table.sql` | Table creation + initial data |
| `scripts/create-agent-search-logs-table.sql` | Logging table creation |

---

## Caching

Synonyms are cached in memory for 5 minutes to reduce database calls:

```typescript
let synonymCache: Map<string, { term: string; weight: number }[]> | null = null;
let synonymCacheTime = 0;
const SYNONYM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
```

After adding new synonyms, searches will pick them up within 5 minutes, or restart the server for immediate effect.

---

## Troubleshooting

### Searches returning no results

1. Check content exists with expected `content_type`:
   ```sql
   SELECT content_type, COUNT(*) FROM ip_tracks
   WHERE is_deleted IS NOT TRUE GROUP BY content_type;
   ```

2. Check `is_deleted` and `pack_id` filters:
   ```sql
   SELECT * FROM ip_tracks
   WHERE content_type = 'radio_station'
   AND (is_deleted = false OR is_deleted IS NULL)
   AND pack_id IS NULL;
   ```

3. Check synonym expansion in server logs:
   ```
   [VibeMatch] Search keywords: ['chill']
   [VibeMatch] Expanded with synonyms: chill(1), relaxed(0.9), mellow(0.9)...
   ```

### Synonyms not working

1. Verify table has data:
   ```sql
   SELECT COUNT(*) FROM search_synonyms;
   ```

2. Check specific synonym exists:
   ```sql
   SELECT * FROM search_synonyms WHERE search_term = 'japanese';
   ```

3. Clear cache by restarting server or waiting 5 minutes.
