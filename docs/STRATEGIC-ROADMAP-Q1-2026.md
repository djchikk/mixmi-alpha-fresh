# mixmi Strategic Roadmap - Q1 2026
**Date:** October 30, 2025
**Status:** Active Planning Document
**Context:** Post-Infrastructure Build, Pre-Alpha Re-Engagement

---

## Executive Summary

After completing core infrastructure (globe, mixer, payments, remix tracking), mixmi is ready for the next growth phase. This roadmap focuses on **network effects** and **alpha user value** through three parallel development streams:

1. **Radio Integration** - Make platform feel alive with 24/7 streaming
2. **Video System** - Diversify content beyond music
3. **Curation Economy** - Enable users to earn through taste-making

**Target:** Re-engage 50 alpha users by Q1 2026 with complete value proposition

---

## Current State Assessment

### ✅ What's Working (Production-Ready)

**Core Infrastructure:**
- 🌍 Globe browser with 17ms load time, smart clustering
- 🎛️ Professional mixer (tiny + big) with gate effects, recording
- 💰 STX payment splitting smart contract (LIVE on mainnet)
- 🔗 Gen 0 → Gen 1 remix tracking with IP attribution
- 🏪 Creator stores + artist profiles
- 🛒 Shopping cart with batch purchasing
- ⚙️ Account management with editable uploads

**Recent Achievements:**
- Gate effects system (6 rhythmic patterns)
- Recording polish (rehearsal, sample-accurate looping)
- Mixer stability overhaul (memory leaks eliminated)
- Welcome page updated

### 🎯 Strategic Opportunities (Partnerships Ready)

**Radio Partnerships:**
1. **NYC Electronic Dance Music** - Curated EDM stations, technical partner ready
2. **Radio Baha'i Chile** - Indigenous Mapuche region, cultural significance

**Video Partnership:**
- **Bhutan National Film Committee** - Head of committee ready to contribute films

**Alpha Users:**
- 50 users ready to re-engage
- High-quality contributors (need clear value proposition)
- Mix of professional creators + rural developing country artists
- Need: stability, economic gain, complete features

### 🚧 What Needs Building

**Immediate Gaps:**
- Radio integration (architecture designed, not implemented)
- Video content type (similar to existing patterns)
- Playlist/curation economy (database schema ready)
- SUI blockchain exploration (strategic decision pending)

---

## Strategic Framework

### Core Principle: Network Effects + Alpha Value

**Not Ready to Re-Engage Alpha Users When:**
- ❌ Features incomplete or breaking
- ❌ No clear economic incentive
- ❌ Platform feels empty or static
- ❌ Visual polish lacking

**Ready to Re-Engage Alpha Users When:**
- ✅ Platform feels ALIVE (radio playing 24/7)
- ✅ Content diversity (music + video + radio)
- ✅ Economic incentive clear (curation earnings)
- ✅ Prestigious partnerships visible (Bhutan, Radio Baha'i)
- ✅ Stable and polished experience

### Why This Sequence Matters

**Radio First:**
- Makes platform dynamic (not just static content)
- Low complexity (architecture already designed)
- Immediate partnership activation (NYC ready now)
- Cultural diversity story (Chile adds indigenous perspective)

**Video Second:**
- New content type = platform diversity
- Prestigious partnership (national film committee!)
- Similar technical patterns to existing content
- Expands beyond "just music" narrative

**Curation Third:**
- Requires radio + video for maximum impact
- Users can curate diverse content (not just loops)
- Economic incentive becomes clear
- Network effects amplify (curators discover curators)

---

## Development Streams (12-Week Plan)

### Stream 1: Radio Integration (Weeks 1-3) 🔴 PRIORITY

#### Week 1: NYC Electronic Dance Music
**Goal:** First live radio station streaming on globe

**Database Schema:**
```sql
CREATE TABLE radio_stations (
  id UUID PRIMARY KEY,
  creator_id UUID REFERENCES user_profiles(wallet_address),
  title VARCHAR(255),
  description TEXT,
  genre VARCHAR(100),

  -- Location
  location_lat DECIMAL(10,7),
  location_lng DECIMAL(10,7),
  primary_location VARCHAR(255),

  -- Streaming
  stream_url VARCHAR(500),  -- External stream endpoint
  is_live BOOLEAN DEFAULT true,

  -- Media
  cover_image_url VARCHAR(500),

  -- Metadata
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  content_type VARCHAR DEFAULT 'radio_station'
);
```

**UI Components:**
- Orange 160px card (4px border = collection)
- Drag target: Radio Widget
- Globe node placement (NYC coordinates)

**Radio Widget Updates:**
- Add "Station" mode (vs existing "Random DB" mode)
- Connect to external stream via `stream_url`
- Display: "🔴 LIVE: [Station Name]"
- Attribution tracking for future discovery commissions

**Technical Implementation:**
```typescript
// lib/radioService.ts
export const connectToStation = async (stationId: string) => {
  const { data } = await supabase
    .from('radio_stations')
    .select('stream_url, title, genre')
    .eq('id', stationId)
    .single();

  return {
    streamUrl: data.stream_url,
    metadata: { title: data.title, genre: data.genre }
  };
};
```

**Partnership Work:**
- Coordinate with NYC partner for stream URL
- Test stream reliability
- Get cover art and station metadata
- Launch announcement preparation

**Success Criteria:**
- ✅ NYC radio station appears on globe
- ✅ Clicking station opens radio widget
- ✅ Stream plays reliably for 24+ hours
- ✅ Attribution tracking works

#### Week 2: Radio Baha'i Chile
**Goal:** Second station live, cultural diversity story

**Implementation:**
- Same infrastructure as Week 1
- Geographic placement: Temuco, Chile
- Mapuche indigenous region context
- Cultural preservation narrative

**Partnership Work:**
- Coordinate with Radio Baha'i for stream access
- Gather station metadata and imagery
- Cultural context documentation
- Launch coordination

**Success Criteria:**
- ✅ Radio Baha'i station on globe (Chile)
- ✅ Streaming works reliably
- ✅ Cultural story documented
- ✅ Both stations coexist without conflicts

#### Week 3: Radio Widget Polish
**Goal:** Professional UX, discovery attribution

**Features:**
- Mode switcher: "Random DB" ↔ "Station Stream"
- Now Playing display with metadata
- Volume control independent of mixer
- Discovery attribution tracking (future revenue)

**Discovery Attribution:**
```typescript
// When user discovers track via radio context
interface RadioDiscovery {
  trackId: string;
  discoveredVia: 'radio_station';
  stationId: string;
  timestamp: Date;
}

// Future: 20% commission to station when track purchased
```

**Success Criteria:**
- ✅ Clean mode switching
- ✅ Metadata displays correctly
- ✅ Attribution tracking database schema
- ✅ Widget feels polished

---

### Stream 2: Video System (Weeks 2-5) 🎥 OVERLAPS WITH RADIO

#### Week 2: Database & Storage
**Goal:** Video infrastructure ready

**Database Schema:**
```sql
CREATE TABLE videos (
  id UUID PRIMARY KEY,
  creator_id UUID REFERENCES user_profiles(wallet_address),

  -- Content
  title VARCHAR(255),
  description TEXT,
  video_url VARCHAR(500),      -- Supabase storage or external (YouTube, Vimeo)
  thumbnail_url VARCHAR(500),
  duration INTEGER,             -- seconds

  -- Location
  location_lat DECIMAL(10,7),
  location_lng DECIMAL(10,7),
  primary_location VARCHAR(255),

  -- IP Attribution (same structure as ip_tracks)
  composition_split_1_wallet VARCHAR,
  composition_split_1_percentage INTEGER,
  composition_split_2_wallet VARCHAR,
  composition_split_2_percentage INTEGER,
  composition_split_3_wallet VARCHAR,
  composition_split_3_percentage INTEGER,
  production_split_1_wallet VARCHAR,
  production_split_1_percentage INTEGER,
  production_split_2_wallet VARCHAR,
  production_split_2_percentage INTEGER,
  production_split_3_wallet VARCHAR,
  production_split_3_percentage INTEGER,

  -- Pricing (future - not required for MVP)
  download_price_stx DECIMAL,
  streaming_enabled BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  content_type VARCHAR DEFAULT 'video'
);
```

**Storage Strategy:**
```
Option A: External hosting (YouTube, Vimeo)
- Pros: No storage costs, existing infrastructure
- Cons: Dependent on external platforms
- Best for: MVP with Bhutan partnership

Option B: Supabase storage
- Pros: Full control, attribution, remix potential
- Cons: Storage costs, bandwidth costs
- Best for: Long-term, revenue-generating content

RECOMMENDATION: Start with Option A (external), add Option B later
```

**Success Criteria:**
- ✅ Videos table created
- ✅ Storage strategy decided
- ✅ Upload flow planned

#### Week 3: Video Card Component
**Goal:** Video content appears on globe

**UI Design:**
- 160px card with **sky blue border** (#38BDF8, 2px)
- Thumbnail preview
- Duration display (e.g., "12:34")
- Hover: Play icon overlay
- Drag target: Crate → Video Widget

**Component Structure:**
```typescript
// components/cards/VideoCard.tsx
interface VideoCardProps {
  video: Video;
  onPlay: () => void;
  onAddToCrate: () => void;
  draggable: boolean;
}
```

**Globe Integration:**
- Video nodes on globe (sky blue markers)
- Click to preview/open modal
- Drag to crate (64px thumbnails)
- TrackDetailsModal equivalent (VideoDetailsModal)

**Success Criteria:**
- ✅ Video cards render on globe
- ✅ Thumbnail displays correctly
- ✅ Drag to crate works
- ✅ Visual consistency with track cards

#### Week 4: Video Widget
**Goal:** Playback experience

**Widget Design:**
```
┌────────────────────────────────────┐
│  🎬 Video Player                   │
├────────────────────────────────────┤
│  [Video iframe/player]             │
│                                    │
│  Title: "Bhutan Mountain Festival" │
│  Creator: National Film Committee  │
│                                    │
│  ⏯ ────●──────── 🔊               │
│  3:24 / 12:45                      │
│                                    │
│  Queue:                            │
│  • Video 2 title                   │
│  • Video 3 title                   │
└────────────────────────────────────┘
```

**Features:**
- Embedded player (YouTube API or native video element)
- Queue system (similar to playlist widget)
- Full-screen option
- Attribution display
- Next/previous controls

**Technical Implementation:**
```typescript
// For external videos (YouTube/Vimeo)
<iframe
  src={video.video_url}
  allow="fullscreen"
/>

// For Supabase-hosted videos (future)
<video src={video.video_url} controls />
```

**Success Criteria:**
- ✅ Video playback works
- ✅ Queue system functional
- ✅ Attribution displays
- ✅ Responsive design

#### Week 5: Bhutan Partnership Launch
**Goal:** Prestigious content live, marketing moment

**Partnership Coordination:**
- Work with Bhutan National Film Committee
- Upload initial video collection
- Geographic placement (Bhutan coordinates)
- Cultural context documentation
- Attribution setup (if multiple creators)

**Upload Flow:**
- Similar to track upload (IP attribution)
- External URL input (YouTube/Vimeo for MVP)
- Thumbnail auto-fetch or manual upload
- Location selection (Bhutan-specific autocomplete)

**Marketing Narrative:**
- "Cultural Preservation via Blockchain"
- "Bhutan National Film Committee Partnership"
- Geographic discovery of global culture
- Fair compensation for filmmakers

**Success Criteria:**
- ✅ 5-10 Bhutan videos live on globe
- ✅ Attribution working correctly
- ✅ Geographic placement accurate
- ✅ Partnership announcement ready

---

### Stream 3: SUI Exploration (Weeks 1-4) ⚡ PARALLEL, NON-BLOCKING

#### Week 1-2: Research & Proof of Concept
**Goal:** Understand SUI capabilities vs Stacks

**Research Questions:**
1. **zkLogin:** How does "no seed phrase" onboarding work?
2. **Gas Costs:** Real comparison vs Stacks (micro-payments viable?)
3. **Smart Contracts:** How hard is Clarity → Move migration?
4. **Ecosystem:** What DEXs, wallets, tools exist?
5. **Developer Experience:** Better/worse than Stacks?

**Hands-On Exploration:**
- [ ] Install SUI CLI and create test wallet
- [ ] Test zkLogin flow (Google/email authentication)
- [ ] Deploy "Hello World" smart contract in Move
- [ ] Execute test transaction, measure gas cost
- [ ] Test SUI wallet UX vs Stacks wallet UX

**Success Criteria:**
- ✅ Basic understanding of SUI ecosystem
- ✅ Gas cost comparison data
- ✅ zkLogin UX tested
- ✅ Initial impressions documented

#### Week 3-4: Decision Framework
**Goal:** Go/No-Go decision on SUI migration

**Comparison Matrix:**

| Factor | Stacks | SUI | Winner |
|--------|--------|-----|--------|
| **User Onboarding** | Seed phrases (friction) | zkLogin (email/Google) | ? |
| **Transaction Cost** | ~$0.03-0.10 | ~$0.001 (claimed) | ? |
| **Transaction Speed** | ~10 min (Bitcoin finality) | ~2 sec | ? |
| **Smart Contract Language** | Clarity (security-first) | Move (Rust-like) | ? |
| **Migration Effort** | Already deployed | Full rewrite needed | Stacks |
| **Ecosystem Maturity** | Established, Bitcoin-backed | Newer, fast-growing | ? |
| **User Education** | "Bitcoin security" story | "Fast & cheap" story | ? |
| **Alpha User Disruption** | None (already onboarded) | Full re-onboarding | Stacks |
| **Multi-Chain Readiness** | Possible (see below) | Possible (see below) | Tie |

**Decision Paths:**

**Path A: Migrate to SUI**
- If: zkLogin UX is 10x better AND gas costs are 100x cheaper AND migration effort is reasonable
- Timeline: After playlist/curation economy (Week 12+)
- Process: Rewrite smart contracts in Move, dual-chain transition period

**Path B: Stay on Stacks**
- If: Migration effort outweighs benefits OR Stacks ecosystem improves UX
- Timeline: Indefinite
- Process: Continue building on Stacks

**Path C: Multi-Chain (RECOMMENDED)**
- If: Both chains have unique value propositions
- Timeline: SUI addition after playlist economy (Week 12+)
- Process: Support both Stacks AND SUI simultaneously

**Success Criteria:**
- ✅ Decision matrix completed with real data
- ✅ Cost/benefit analysis documented
- ✅ Timeline for chosen path established
- ✅ Migration plan (if applicable) outlined

---

### Stream 4: Playlist/Curation Economy (Weeks 6-12) 🎨 AFTER RADIO + VIDEO

**Why After Radio + Video:**
- More content diversity = better playlists
- Curators can mix music + video + radio links
- Economic model more compelling with diverse content

#### Week 6-7: Database Schema & Playlists as Content Type

**Database Tables:**
```sql
-- Core playlist table
CREATE TABLE playlists (
  id UUID PRIMARY KEY,
  creator_id UUID REFERENCES user_profiles(wallet_address),

  -- Content
  title VARCHAR(255),
  description TEXT,
  cover_image_url VARCHAR(500),

  -- Pricing
  purchase_price_stx DECIMAL,  -- NULL = streaming only (via passes)

  -- Status
  is_published BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Playlist contents (flexible for any content type)
CREATE TABLE playlist_items (
  id UUID PRIMARY KEY,
  playlist_id UUID REFERENCES playlists(id),

  -- Flexible content reference
  item_id UUID,  -- References various tables based on item_type
  item_type VARCHAR,  -- 'loop', 'song', 'video', 'radio_station', 'event'

  -- Ordering
  position INTEGER,  -- 0-9 for 10-item limit

  -- Metadata
  added_at TIMESTAMP,

  CONSTRAINT unique_position UNIQUE (playlist_id, position)
);

-- Streaming pass tracking
CREATE TABLE streaming_passes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(wallet_address),

  -- Purchase
  purchased_at TIMESTAMP,
  expires_at TIMESTAMP,  -- purchased_at + 30 minutes
  price_stx DECIMAL DEFAULT 1.0,
  stacks_tx_id VARCHAR,

  -- Usage
  total_plays INTEGER DEFAULT 0,
  status VARCHAR,  -- 'active', 'expired', 'consumed'

  created_at TIMESTAMP
);

-- Stream play attribution
CREATE TABLE stream_plays (
  id UUID PRIMARY KEY,

  -- Content
  track_id UUID,  -- Currently only tracks, expand later for video
  user_id UUID,

  -- Attribution
  curator_id UUID,  -- NULL if not from curator context
  playlist_id UUID,  -- NULL if not from playlist
  pass_id UUID REFERENCES streaming_passes(id),

  -- Tracking
  played_at TIMESTAMP,
  completion_percentage INTEGER,  -- 0-100, needs ≥80% to count
  revenue_stx DECIMAL,  -- Calculated share from pass

  created_at TIMESTAMP
);
```

**Query Pattern:**
```sql
-- Get playlist with all items
SELECT
  pi.position,
  pi.item_type,
  CASE pi.item_type
    WHEN 'loop' THEN (SELECT row_to_json(t) FROM ip_tracks t WHERE t.id = pi.item_id)
    WHEN 'song' THEN (SELECT row_to_json(t) FROM ip_tracks t WHERE t.id = pi.item_id)
    WHEN 'video' THEN (SELECT row_to_json(v) FROM videos v WHERE v.id = pi.item_id)
    WHEN 'radio_station' THEN (SELECT row_to_json(r) FROM radio_stations r WHERE r.id = pi.item_id)
  END as item_data
FROM playlist_items pi
WHERE pi.playlist_id = $1
ORDER BY pi.position;
```

**Success Criteria:**
- ✅ Database tables created
- ✅ Query patterns tested
- ✅ RLS policies configured

#### Week 8-9: Playlist Widget Updates

**Current State:** Widget plays random content from DB

**New State:** Widget can load playlists as content type

**Features:**
- Load playlist by ID
- Display playlist metadata (title, curator, cover)
- Play items in sequence
- Show attribution: "Curated by [Name]"
- Track plays for revenue attribution

**UI Updates:**
```
┌────────────────────────────────────┐
│  📻 Playlist: "Late Night Vibes"   │
│  Curated by DJ Midnight            │
├────────────────────────────────────┤
│  🎵 Current: "Midnight Drive"      │
│  Artist: Alice                      │
│                                    │
│  ⏯ ────●──────── 🔊               │
│  1:24 / 3:45                       │
│                                    │
│  Queue:                            │
│  1. ✓ Intro Loop (played)          │
│  2. ▶ Midnight Drive (playing)     │
│  3. • City Lights                  │
│  4. • Ambient Pad                  │
└────────────────────────────────────┘
```

**Playlist Cube Behavior:**
- 160px card with **indigo border** (#6366F1, 4px)
- Hover: "10 items • Curated by [Name]"
- Drag to Playlist Widget → loads entire playlist
- Chevron expand: Show individual items (like loop packs)

**Success Criteria:**
- ✅ Playlist cubes render on globe
- ✅ Drag to widget loads playlist
- ✅ Playback sequence works
- ✅ Attribution displays correctly

#### Week 10-11: Curation Earnings (20% Commission)

**Revenue Model:**

**Playlist Purchase:**
```
Sale Price: 5 STX
├─ Curator: 1 STX (20%)
└─ Artists: 4 STX (80%, split per track)
```

**Streaming from Curator Store:**
```
30-min Pass: 1 STX
├─ Platform: 0.2 STX (20%)
└─ Available: 0.8 STX (80%)
    ├─ Curator: 0.16 STX (20% of 0.8)
    └─ Artists: 0.64 STX (80% of 0.8, split per play)
```

**Smart Contract Updates:**
```clarity
;; New function: split-playlist-payment
(define-public (split-playlist-payment
  (total-price uint)
  (curator-wallet principal)
  (artist-splits (list 10 {wallet: principal, percentage: uint}))
)
  ;; 20% to curator
  ;; 80% to artists (proportional by track count)
)
```

**Attribution Tracking:**
- When track plays from curator's store → `curator_id` logged
- When purchase happens from curator context → curator commission
- Analytics: Show curators their discovery impact

**Success Criteria:**
- ✅ Smart contract deployed
- ✅ Curator commission calculates correctly
- ✅ Attribution tracking works
- ✅ Analytics dashboard shows curator earnings

#### Week 12: Alpha User Re-Engagement

**Value Proposition:**
- ✅ Platform feels ALIVE (radio stations 24/7)
- ✅ Content diversity (music + video + radio)
- ✅ Economic incentive (curation earnings = 20%)
- ✅ Prestigious partnerships (Bhutan, Radio Baha'i)
- ✅ Stable, polished experience

**Re-Engagement Plan:**

**Phase 1: Personal Outreach (Week 12)**
- Email to 50 alpha users
- Highlight: Radio (NYC + Chile), Video (Bhutan), Curation earnings
- Invitation: "Create your first playlist, earn 20%"
- Incentive: Early curator bonus (first 10 curators get featured placement)

**Phase 2: Onboarding Support (Weeks 12-13)**
- 1-on-1 calls with interested users
- Help upload new content (if needed)
- Walk through playlist creation
- Answer questions about earnings

**Phase 3: First Earnings (Week 14+)**
- Monitor curator activity
- Celebrate first earnings publicly
- Case study: "DJ Midnight earned 2 STX from playlist curation"
- Build momentum through success stories

**Success Criteria:**
- ✅ 20+ alpha users re-engaged
- ✅ 10+ playlists created
- ✅ First curation earnings paid out
- ✅ Feedback collected for iteration

---

## Multi-Chain Architecture (Future)

### Strategic Question: Stacks vs SUI vs Both?

**Single-Chain Approach:**
- Simpler to maintain
- No cross-chain complexity
- But: Limited to one ecosystem's UX and costs

**Multi-Chain Approach (RECOMMENDED):**
- Best of both worlds
- Stacks: Bitcoin security, existing users
- SUI: Fast, cheap, zkLogin UX
- Users choose their chain preference

### Multi-Chain Value Flow (How It Works)

**Option A: Separate Economies (SIMPLEST)**
```
Stacks Users:
- Pay in STX
- Earn in STX
- Smart contracts on Stacks
- No cross-chain interaction

SUI Users:
- Pay in SUI
- Earn in SUI
- Smart contracts on SUI
- No cross-chain interaction

Content:
- Lives on Supabase (chain-agnostic)
- Attribution metadata (chain-agnostic)
- Payment splits reference wallet addresses (chain-specific)
```

**Implementation:**
```typescript
interface PaymentContext {
  chain: 'stacks' | 'sui';
  currency: 'STX' | 'SUI';
  walletAddress: string;  // Chain-specific format
  smartContractAddress: string;  // Chain-specific
}

// When purchasing
if (paymentContext.chain === 'stacks') {
  await executeStacksPayment(trackId, paymentContext);
} else if (paymentContext.chain === 'sui') {
  await executeSUIPayment(trackId, paymentContext);
}
```

**Pros:**
- ✅ No DEX integration needed
- ✅ No cross-chain bridges
- ✅ Simpler architecture
- ✅ Users stay in their ecosystem

**Cons:**
- ❌ Curator on Stacks can't earn from SUI user
- ❌ Fragmented economies
- ❌ Liquidity split between chains

**Option B: Cross-Chain with DEX (COMPLEX)**
```
SUI Ecosystem DEX Options:
- Cetus DEX (largest on SUI)
- Turbos Finance
- Aftermath Finance

Implementation:
1. User pays in SUI
2. Smart contract routes to DEX
3. DEX swaps SUI → STX (if artist wants STX)
4. Artist receives STX payment
```

**Pros:**
- ✅ Unified economy (SUI user can pay STX artist)
- ✅ Full liquidity
- ✅ More flexible for users

**Cons:**
- ❌ DEX integration complexity
- ❌ Slippage on swaps
- ❌ Additional transaction costs
- ❌ Dependency on DEX liquidity

**Option C: Stablecoin Bridge (MIDDLE GROUND)**
```
Use USDC (exists on both chains) as bridge currency:

Stacks User pays:
1. STX → USDC (Stacks DEX)
2. USDC → Artist (on Stacks)

SUI User pays:
1. SUI → USDC (SUI DEX)
2. USDC → Artist (on SUI)

Artists receive USDC (stable value):
- Can convert to STX/SUI anytime
- Protects from volatility
- Universal currency
```

**Pros:**
- ✅ Stable value for artists
- ✅ Simpler than full cross-chain
- ✅ Reduces currency risk

**Cons:**
- ❌ Still requires DEX integration
- ❌ Extra conversion step
- ❌ Not pure crypto-native

### Recommendation: Start with Option A (Separate Economies)

**Why:**
1. **Simplest to implement** - No DEX integration needed
2. **Lowest risk** - No cross-chain failure points
3. **Clear MVP** - Prove value on each chain independently
4. **Future-proof** - Can add cross-chain later if demand exists

**Transition Path:**
```
Phase 1 (Now): Stacks only
Phase 2 (Q2 2026): Add SUI as separate economy
Phase 3 (Q3 2026): Evaluate cross-chain demand
Phase 4 (Q4 2026): Add DEX bridge if needed
```

**User Experience:**
```
Sign Up:
- Choose your chain: [Stacks] or [SUI]
- Wallet setup (seed phrase vs zkLogin)
- Profile creation (chain-specific wallet)

Discovery:
- Browse all content (chain-agnostic)
- See prices in your currency (STX or SUI)
- Filter by chain if desired

Purchase:
- Pay in your chain's currency
- Smart contract on your chain
- Artist receives in their chain's currency
- If chain mismatch: "This artist accepts STX only. Switch to Stacks?"

Earnings:
- Receive in your chain's currency
- Withdraw anytime (no cross-chain needed)
- Analytics show earnings in your currency
```

**Database Schema for Multi-Chain:**
```sql
ALTER TABLE user_profiles ADD COLUMN blockchain_preference VARCHAR DEFAULT 'stacks';
-- Values: 'stacks', 'sui'

ALTER TABLE ip_tracks ADD COLUMN payment_blockchain VARCHAR DEFAULT 'stacks';
-- Track which chain the artist wants payment on

-- Wallet mapping table
CREATE TABLE user_wallets (
  user_id UUID REFERENCES user_profiles(id),
  blockchain VARCHAR,  -- 'stacks', 'sui'
  wallet_address VARCHAR,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP,

  PRIMARY KEY (user_id, blockchain)
);
```

**This allows:**
- Users to have wallets on multiple chains
- Content to specify preferred payment chain
- Future flexibility for cross-chain features

---

## Success Metrics

### Week 3 (After Radio)
- [ ] 2 radio stations live and streaming 24/7
- [ ] 100+ hours of cumulative listening
- [ ] 0 streaming errors or dropouts
- [ ] Partnership announcements published

### Week 5 (After Video)
- [ ] 5-10 Bhutan videos live on globe
- [ ] Video playback working smoothly
- [ ] 50+ video views
- [ ] Bhutan partnership announcement published

### Week 12 (After Curation Economy)
- [ ] 20+ alpha users re-engaged
- [ ] 10+ playlists created
- [ ] First curation earnings paid (≥0.1 STX)
- [ ] 5+ curators earning consistently

### Q1 2026 End (Full Roadmap Complete)
- [ ] 50 alpha users active monthly
- [ ] 25+ playlists available
- [ ] Radio + Video content live
- [ ] SUI decision made (migrate/stay/multi-chain)
- [ ] Curation economy generating real earnings

---

## Risk Mitigation

### Technical Risks

**Radio Streaming Reliability:**
- Risk: External streams go down
- Mitigation: Fallback to "Random DB" mode, monitor uptime
- Partner SLA: Discuss with NYC and Chile partners

**Video Bandwidth Costs:**
- Risk: Supabase bandwidth expensive if hosting videos
- Mitigation: Start with external hosting (YouTube/Vimeo)
- Future: Revenue-share model for hosted videos

**SUI Migration Complexity:**
- Risk: Full migration takes months, disrupts users
- Mitigation: Multi-chain approach, no forced migration

### Partnership Risks

**NYC Radio Partner Delays:**
- Risk: Technical integration takes longer than expected
- Mitigation: Start with simple embed, iterate from there
- Backup: Have Chile radio ready as alternative

**Bhutan Content Availability:**
- Risk: Videos not ready or require extensive processing
- Mitigation: Accept any format, use external hosting
- Backup: Have other video creators lined up

### User Engagement Risks

**Alpha Users Don't Return:**
- Risk: Platform still not compelling enough
- Mitigation: Personal outreach, 1-on-1 onboarding
- Backup: Focus on quality (10 engaged users > 50 passive)

**Curation Earnings Too Low:**
- Risk: 20% commission doesn't motivate curators
- Mitigation: Early curator bonuses, featured placement
- Backup: Adjust commission % based on feedback

---

## Next Steps (Pre-Development)

### Before Starting Radio Integration

**1. Database Cleanup (BLOCKING)**
- [ ] Understand current database state
- [ ] Document cleanup requirements
- [ ] Execute cleanup plan
- [ ] Verify data integrity

**2. Documentation Updates**
- [ ] Audit existing docs for accuracy
- [ ] Update outdated information
- [ ] Archive obsolete docs
- [ ] Create this strategic roadmap document

**3. Partnership Coordination**
- [ ] NYC Radio: Get stream URL, metadata, launch timeline
- [ ] Radio Baha'i Chile: Initial contact, stream access
- [ ] Bhutan: Video upload timeline, technical requirements

**4. SUI Research Setup**
- [ ] Install SUI CLI
- [ ] Create test wallet
- [ ] Join SUI developer community
- [ ] Schedule research time (1-2 hrs/week)

---

## Open Questions

### Technical
- [ ] Radio: What's the latency for external streams?
- [ ] Video: Max file size for Supabase storage (if we host)?
- [ ] Playlists: Should there be playlist size tiers (5/10/20 items)?
- [ ] SUI: Is zkLogin production-ready or still experimental?

### Business
- [ ] Curation commission: Is 20% the right number? Test with users?
- [ ] Streaming passes: Is 1 STX / 30 min optimal pricing?
- [ ] Multi-chain: Do users care, or is it developer complexity?
- [ ] Video monetization: Same model as music, or different?

### Partnerships
- [ ] NYC Radio: What's their business model? Revenue share needed?
- [ ] Radio Baha'i: Do they need financial support? Grant opportunity?
- [ ] Bhutan: Can we help with film preservation beyond hosting?

---

## Appendix: Why This Roadmap Works

### Network Effects Logic

**Stage 1: Infrastructure (Complete)**
- Platform works, payments work, content works
- But: Feels static, no ongoing activity

**Stage 2: Always-On Content (Radio)**
- Platform feels ALIVE
- Discovery happens passively (radio playing)
- Cultural diversity (NYC + Chile)
- Users visit more often (check what's playing)

**Stage 3: Content Diversity (Video)**
- Beyond music (broader appeal)
- Prestigious partnerships (credibility)
- New use cases (film preservation)
- Different creator types attracted

**Stage 4: User Participation (Curation)**
- Users become creators (curators)
- Economic incentive (earn 20%)
- Network effects (curators promote platform)
- Viral growth (everyone can curate)

**Result:** Platform transitions from "cool tech demo" → "living music ecosystem"

### Alpha User Psychology

**What High-Quality Contributors Need:**
1. ✅ **Stability** - No broken features, no data loss
2. ✅ **Respect for Time** - Clear value, fast onboarding
3. ✅ **Economic Incentive** - Real earnings potential
4. ✅ **Prestige** - Association with quality platform
5. ✅ **Control** - Can edit, delete, manage content

**This Roadmap Delivers:**
- Stability: Post-infrastructure polish
- Time Respect: Wait until platform is ready
- Economic: Curation earnings, fair payment splits
- Prestige: Bhutan, Radio Baha'i partnerships
- Control: Already implemented

### Why Sequence Matters

**Wrong Sequence:**
```
Curation → Radio → Video
❌ Problem: Nothing to curate beyond loops
❌ Playlists feel limited
❌ Economic model less compelling
```

**Right Sequence:**
```
Radio → Video → Curation
✅ Diverse content to curate
✅ Playlists are rich (music + video + radio)
✅ Economic model more valuable
✅ Platform feels complete
```

---

## Document History

**Version 1.0** - October 30, 2025
- Initial strategic roadmap
- 12-week development plan (Oct 2025 - Jan 2026)
- Multi-chain architecture analysis
- Partnership coordination timeline

**Author:** Sandy Hoover + Claude Code
**Status:** Active Planning Document
**Next Review:** Week 4 (after radio integration complete)
