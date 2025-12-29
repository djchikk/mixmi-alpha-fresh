# Intelligence Layer Strategy

*December 29, 2025*

A living document capturing our approach to building a data-driven feedback system that gets smarter over time.

---

## The Flywheel Concept

The intelligence layer is a self-reinforcing cycle where user behavior improves the system, which attracts more users, generating more data:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│    Users search          Search logs capture               │
│    for content    ───►   what people actually want          │
│         ▲                        │                          │
│         │                        ▼                          │
│    Better search         Analysis reveals patterns          │
│    results               (gaps, popular terms, failures)    │
│         ▲                        │                          │
│         │                        ▼                          │
│    Synonym table         Upload chatbot prompts            │
│    expands         ◄───  for better metadata                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key insight:** The more people use the system, the smarter it gets. This creates a moat - competitors can copy features but not accumulated intelligence.

---

## Current Components (December 2025)

### 1. Search Logging (`agent_search_logs`)
Captures every agent search:
- Raw query text
- Parsed criteria (content types, BPM, mood)
- Results count (success/failure indicator)
- Timestamp

**Status:** Live and collecting data.

### 2. Synonym Table (`search_synonyms`)
Maps search terms to related terms:
- Location mappings (japanese → tokyo, japan, 日本)
- Genre mappings (electronic → techno, house, edm)
- Mood mappings (chill → relaxed, mellow)
- Weighted scoring (1.0 = exact, 0.5 = loosely related)

**Status:** Live with ~100 initial synonyms.

### 3. Script Detection
Automatic inference from non-Latin characters:
- Japanese/Chinese/Korean/Arabic detection
- Bidirectional matching (search → tracks, tracks → search)

**Status:** Live in code.

### 4. Upload Chatbot
Conversational interface that collects metadata:
- Tags, locations, descriptions
- Content type, BPM
- Sacred content protection

**Status:** Live, but not yet informed by search patterns.

---

## The Gap: Connecting Search to Upload

Currently, search logs collect data but nothing automatically feeds back to the upload chatbot. This is the next evolution.

### Manual Process (Now)
1. Periodically query search logs for patterns
2. Identify failed searches (metadata gaps)
3. Manually add synonyms
4. Manually update upload chatbot prompts

### Semi-Automated Process (Near Future)
1. Weekly/monthly analysis script
2. Claude (or similar) reviews logs, suggests:
   - New synonyms to add
   - Upload prompt improvements
   - Missing content types
3. Human reviews and approves changes

### Automated Process (Future)
1. System detects repeated failed searches
2. Suggests synonyms or flags content gaps
3. Upload chatbot dynamically asks about popular search terms
4. "Many users search for 'ambient' - does that describe your track?"

---

## Analysis Queries

### Most Common Searches
```sql
SELECT query, COUNT(*) as count
FROM agent_search_logs
GROUP BY query
ORDER BY count DESC
LIMIT 20;
```

### Failed Searches (Metadata Gaps)
```sql
SELECT query, parsed_criteria, COUNT(*) as failures
FROM agent_search_logs
WHERE results_count = 0
GROUP BY query, parsed_criteria
ORDER BY failures DESC
LIMIT 30;
```

### Search Terms Not in Synonyms
```sql
-- Find popular search keywords that aren't mapped
WITH search_words AS (
  SELECT DISTINCT unnest(string_to_array(lower(query), ' ')) as word
  FROM agent_search_logs
)
SELECT sw.word, COUNT(*) as occurrences
FROM search_words sw
LEFT JOIN search_synonyms ss ON sw.word = ss.search_term
WHERE ss.id IS NULL
  AND length(sw.word) > 3
GROUP BY sw.word
ORDER BY occurrences DESC
LIMIT 30;
```

### Content Type Demand
```sql
SELECT
  parsed_criteria->>'contentTypes' as requested_type,
  COUNT(*) as searches,
  SUM(CASE WHEN results_count > 0 THEN 1 ELSE 0 END) as successful
FROM agent_search_logs
WHERE parsed_criteria->>'contentTypes' IS NOT NULL
GROUP BY requested_type
ORDER BY searches DESC;
```

---

## Future Possibilities

### Investor/Scout Agents
Agents with their own wallets that autonomously:
- Search for content matching criteria
- Purchase/license on behalf of users
- Build collections based on learned preferences

*Concept documented: December 28, 2025*

### Personalized Synonyms
User-specific mappings based on their search history:
- "When Sandy searches 'chill', she usually picks lofi results"
- Personalized ranking without changing global synonyms

### Cross-Platform Intelligence
If search patterns from mixmi could inform other systems:
- What music terms are people using in 2025?
- Regional differences in how people describe vibes
- Emerging genre terminology

### Collaborative Filtering
"Users who searched for X also liked Y"
- Track co-occurrence in successful searches
- Suggest related content based on community patterns

---

## Open Questions

1. **How often should we analyze logs?** Weekly? Monthly? Real-time alerts for spikes?

2. **Who approves synonym additions?** Fully automated vs human-in-the-loop?

3. **How do we measure improvement?** Search success rate? User satisfaction? Crate additions?

4. **Should failed searches trigger content suggestions?** "No one has uploaded 'ambient Japanese' content - be the first?"

5. **Privacy considerations?** Search logs are anonymous now - keep it that way?

6. **How do we handle trend decay?** Terms popular today may be irrelevant in 6 months.

---

## Principles

1. **Start manual, automate gradually** - Understand patterns before building automation

2. **Human-in-the-loop for now** - AI suggests, humans approve

3. **Measure before optimizing** - Collect data before making assumptions

4. **Keep it simple** - Synonym table + search logs is enough to start

5. **Document learnings** - Update this doc as we discover what works

---

## Related Documents

- `docs/agent-synonym-system.md` - Technical implementation details
- `docs/2025-12-28-payment-system-summary.md` - Investor agent concept
- `CLAUDE.md` - Agent System section

---

## Changelog

**December 29, 2025** - Initial document created
- Defined flywheel concept
- Documented current components
- Outlined future possibilities
- Listed open questions
