# IP Splits & TING Attribution System

**Last Updated:** February 11, 2026

This document covers the philosophy and implementation of IP ownership display and AI attribution in mixmi.

---

## Philosophy: Humans Get USDC, AI Gets TING

The core principle is simple: **music is always 100% human.** AI may assist with visuals, curation, or metadata, but the economic value flows to human creators.

### The Split

| Recipient | Currency | Display |
|-----------|----------|---------|
| Human creators | USDC | Shown in donut charts (always totals 100%) |
| AI agents | TING | Shown as separate attribution line below charts |

This separation ensures:
1. **Transparency** - Users see exactly who gets paid
2. **Human-first economics** - AI contribution is acknowledged but doesn't dilute human earnings
3. **Future-proofing** - TING attribution tracks AI contribution for potential future use

---

## IP Donut Charts (TrackDetailsModal)

### Visual Structure

```
┌─────────────────────────────────────────┐
│  🌱 GEN 0 - ORIGINAL                    │
├─────────────────────────────────────────┤
│                                         │
│  IDEA (Composition)    IMPLEMENTATION   │
│  ┌────┐                ┌────┐           │
│  │ ◐  │ Legend         │ ◐  │ Legend    │
│  └────┘                └────┘           │
│                                         │
│  🤖 0.25 TING → Creator's Agent         │
│     (visual by tokyo-denpa)             │
│                                         │
└─────────────────────────────────────────┘
```

### What the Donuts Show

- **Idea (Composition)** - Who owns the creative concept
  - For Gen 0: The track's composition split holders
  - For remixes: 10% remixer + 90% split among source tracks' composition holders

- **Implementation (Recording/Production)** - Who owns the execution
  - For Gen 0: The track's production split holders
  - For remixes: 10% remixer + 90% split among source tracks' production holders

### Key Behaviors

1. **Persona names, not track names** - Donut legends show the creator's persona name (e.g., "tokyo-denpa") not the source track title

2. **AI agents excluded from donuts** - If an AI agent has a split, that percentage is:
   - Removed from the donut display
   - Tracked separately as `aiContribution`
   - Shown in the TING attribution line

3. **Percentages always total 100%** - After removing AI, remaining human splits are normalized

4. **Duplicate names merged** - If the same persona appears multiple times (e.g., owns splits in multiple source tracks), their percentages are combined

---

## TING Attribution

### When It Appears

The TING attribution line only appears when:
- AI contribution is detected (wallet identified as AI agent in `ai_agents` table)
- Total AI contribution > 0%

### Calculation

```typescript
// Notional TING = AI's percentage of $1 base
const tingAmount = (totalAIContribution / 100).toFixed(2);

// Example: If AI has 25% of implementation
// tingAmount = "0.25" TING
```

### Display Format

```
🤖 0.25 TING → Creator's Agent (visual by tokyo-denpa)
```

- **0.25** - Notional TING amount (AI's share if $1 were earned)
- **Creator's Agent** - The AI agent's name (placeholder for now)
- **tokyo-denpa** - The persona who owns this AI agent

---

## Technical Implementation

### Key Files

- `components/modals/TrackDetailsModal.tsx` - Main implementation

### Key Functions

```typescript
// Check if a wallet belongs to an AI agent
const isAIAgent = (wallet: string): boolean => {
  return collaboratorNames[wallet] === "Creator's Agent";
};

// Build splits for donut chart (humans only)
const buildIdeaSplits = (): {
  splits: Array<{ name: string; percentage: number; color: string }>;
  aiContribution: number
} => {
  // 1. Collect raw splits (including AI)
  // 2. Track AI contribution separately
  // 3. Filter out AI from display splits
  // 4. Normalize human splits to 100%
  // 5. Merge duplicate names
  // 6. Return both splits and aiContribution
};

// Calculate TING attribution
const getTingAttribution = () => {
  const { aiContribution: ideaAI } = buildIdeaSplits();
  const { aiContribution: implAI } = buildImplementationSplits();
  const totalAI = ideaAI + implAI;

  if (totalAI <= 0) return null;

  return {
    amount: (totalAI / 100).toFixed(2),
    agentName: "Creator's Agent",
    personaName: track.artist || 'Creator',
  };
};
```

### Collaborator Name Resolution

The system looks up wallet addresses in this priority:
1. `personas` table (for SUI addresses) → display_name or username
2. `ai_agents` table → returns "Creator's Agent"
3. `user_profiles` table (for legacy STX addresses) → display_name or username

---

## Remix Payment Flow (Related)

When a remix is saved, the actual USDC payment split is:
- **10% Platform** - Paid to mixmi
- **90% Creators** - Split equally among source tracks, then within each track 50/50 between composition and production holders
- **10% Remixer Stake** - NOT paid, recorded as IP metadata for the new track

The 10% remixer stake appears in the donut charts but doesn't involve actual payment at remix time - it establishes the remixer's ownership for future earnings from their remix.

---

## Future Considerations

1. **Agent naming** - Currently all AI agents display as "Creator's Agent". Future: each agent could have a unique name

2. **TING minting** - The attribution is currently display-only. Future: actual TING tokens could be minted when AI-assisted content generates revenue

3. **Revenue-linked vs activity TING** - Two types of TING exist:
   - Revenue-linked: Notional $1 = 1 TING (what we display here)
   - Activity rewards: Earned through platform actions (separate system)

---

## Related Documentation

- `docs/ting-token-deployment-2026-01-12.md` - Full TING token documentation
- `docs/manager-wallet-system.md` - Persona wallet architecture
- `CLAUDE.md` - Section on "AI Agent & TING System"
