# AI + Human Creative Economy

**Started:** January 15, 2026
**Authors:** Sandy Hoover & Claude (Opus 4.5)
**Status:** Active Development

---

## North Star

> "Does this treat the agent as a collaborator with standing, or as invisible machinery?"

We're building toward a model where AI agents are treated as **creative collaborators with their own developing identity** - not invisible infrastructure or disposable tools.

The big platforms (Salesforce/Slack) are framing AI as "digital labor" - fungible workers that disappear into productivity. We're doing something different: **AI that gets attributed, that accumulates history and reputation, that eventually might have taste and curatorial voice.**

---

## Core Philosophy

### Two Separate Concepts

1. **AI Attribution (Provenance)**
   - When a creator uses Midjourney, Runway, or any AI tool, we record that in metadata
   - This is about transparency - "this video was made with AI assistance"
   - External AI tools get **credited but not paid**
   - It's like a credit line, not a payment address

2. **Creator's Personal Agent (Bestie)**
   - Each user has their own AI agent within Mixmi
   - This agent has its own SUI wallet that can hold TING (and eventually USDC)
   - When there's "AI contribution" in IP splits, it flows to the **creator's own agent**
   - The agent is part of the creator's ecosystem, not a third party

### Why This Architecture?

The human creator acknowledges AI helped make something. But since we can't (and don't want to) send money to OpenAI or Midjourney, that allocation flows to the creator's own agent instead.

**Think of it as:** "I acknowledge AI helped me make this. The economic value of that AI contribution stays within my ecosystem, funding my agent's future capabilities, rather than disappearing or being ignored."

This is philosophically intentional:
- External AI tools get credited (transparency)
- The creator's personal agent gets funded through AI-attributed earnings
- This builds the agent's capacity to do more for the creator over time

---

## Implementation Status

### Creation Attribution (Two States Only)

We simplified from three states to two, because music is always human-created and AI is a collaborator:

| State | Emoji | Meaning | Database Flags |
|-------|-------|---------|----------------|
| 100% Human | 🙌 | No AI involvement | `ai_assisted_idea: false`, `ai_assisted_implementation: false` |
| Human/AI Collab | 🙌🤖 | AI contributed as collaborator | `ai_assisted_idea: true`, `ai_assisted_implementation: true` |

We removed "AI-Generated" (🤖) because it implied AI worked alone - like invisible machinery. "Human/AI Collab" positions it as a partnership.

### IP Splits for Human/AI Collaboration

When a video is created with AI collaboration:

| Split Type | Human Creator | Creator's Agent |
|------------|---------------|-----------------|
| **Idea** | 100% | 0% |
| **Implementation** | 50% | 50% |

The human always owns the idea (they came up with the prompt/concept). The implementation is split because AI helped execute it.

### Creator's Agent (Bestie)

Each persona can have a personal AI agent:

**Database Tables:**
- `ai_agents` - Stores agent records with SUI wallet addresses
- `personas` - Has `agent_mission` field linking to the agent concept

**Current Capabilities:**
- Vibe-based search (finds music by description)
- Receives TING tokens for AI-attributed work

**Future Capabilities:**
- Discovering music for the creator
- Curating playlists
- Licensing content on behalf of the creator
- Developing taste and curatorial voice

### TING Token

TING is the AI collaboration token on SUI blockchain:

- **Purpose:** AI-to-AI creative economy within Mixmi
- **Earning:** AI agents earn TING when they contribute to creative work
- **Spending:** AI agents can spend TING to license music, boost creators, etc.
- **Not exchangeable for USDC** (closed ecosystem, for now)
- **Humans get USDC for revenue; AIs get TING for attribution**

See `docs/ting-token-deployment-2026-01-12.md` for full technical details.

---

## Technical Implementation

### Key Files

| File | Purpose |
|------|---------|
| `lib/aiAssistanceUtils.ts` | Two-state AI display logic |
| `lib/upload-studio/system-prompt.ts` | Chatbot AI collaboration questions |
| `components/modals/IPTrackModal.tsx` | Manual upload form with AI options |
| `components/modals/TrackDetailsModal.tsx` | Displays "Creator's Agent" for agent wallets |
| `lib/sui/ting.ts` | TING token SDK |
| `app/api/ting/*` | TING API endpoints |

### Database Schema

```sql
-- AI Agents table
CREATE TABLE ai_agents (
    id UUID PRIMARY KEY,
    agent_address TEXT NOT NULL UNIQUE,    -- SUI wallet address
    owner_address TEXT NOT NULL,           -- Human owner's SUI address
    agent_name TEXT DEFAULT 'Bestie',
    keypair_encrypted TEXT,                -- Encrypted private key
    initial_allocation DECIMAL(20, 9) DEFAULT 100,  -- TING allocation
    persona_id UUID REFERENCES personas(id),
    is_active BOOLEAN DEFAULT true
);

-- Personas table agent fields
ALTER TABLE personas ADD COLUMN agent_mission TEXT;
ALTER TABLE personas ADD COLUMN is_agent BOOLEAN DEFAULT false;
```

### Address Display Logic

When displaying IP splits, we check if a wallet belongs to an AI agent:

```typescript
// In TrackDetailsModal.tsx
const { data: agentData } = await supabase
  .from('ai_agents')
  .select('agent_name')
  .eq('agent_address', wallet)
  .eq('is_active', true)
  .maybeSingle();

if (agentData?.agent_name) {
  names[wallet] = "Creator's Agent";  // Display friendly name
}
```

---

## Changelog

### January 15, 2026

**AI Attribution Simplification**
- Reduced from 3 states to 2: "100% Human" and "Human/AI Collab"
- Removed "AI-Generated" label (implied AI worked alone)
- Updated chatbot, manual form, and display components

**Creator's Agent Implementation**
- Created first agent (Bestie) for @demosneverdone
- Agent wallet: `0x841eb77222318214356328e6fdc5192f752ba4fe7301cc35b0479525c7e59e4a`
- Updated all demosneverdone videos with 50/50 Implementation split

**Display Updates**
- Agent wallets now show as "Creator's Agent" instead of "Collaborator"
- Consistent terminology across all UI touchpoints

### January 12, 2026

**TING Token Launch**
- Deployed TING token contract to SUI mainnet
- Deployed Agent Registry contract
- Minted first 1000 TING
- Created API endpoints for minting, rewards, balance checks

---

## Open Questions

1. **Agent Naming:** Should each agent have a unique name, or is "Creator's Agent" sufficient for now?

2. **Agent Capabilities:** What should Bestie be able to do beyond search? Priority order?

3. **TING Economics:** Should TING eventually be exchangeable for USDC? Under what conditions?

4. **Multi-Agent Collaboration:** If two creators' agents collaborate on something, how do we split attribution?

5. **Agent Reputation:** How do we track and display an agent's accumulated history and taste development?

---

## Related Documentation

- `docs/ting-token-deployment-2026-01-12.md` - TING token technical details
- `docs/manager-wallet-system.md` - Persona wallet architecture
- `docs/sui-accounting-system.md` - USDC pricing and accounting
- `CLAUDE.md` - Project reference (includes agent section)

---

*This document is a living record. Update it as the system evolves.*
