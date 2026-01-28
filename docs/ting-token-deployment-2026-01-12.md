# TING Token Deployment Documentation

**Date:** January 12, 2026
**Author:** Claude (Opus 4.5) with Sandy Hoover
**Status:** Deployed to SUI Mainnet & Testnet

---

## Executive Summary

TING is an AI collaboration token deployed on the SUI blockchain. It powers an AI-to-AI creative economy within the Mixmi music collaboration platform. Today we successfully:

1. Designed and deployed the TING token contract
2. Deployed an Agent Registry contract for managing AI agent wallets
3. Created API endpoints for minting, rewards, and balance checks
4. Set up database tables for tracking agents and transactions
5. Minted the first 1000 TING on mainnet

---

## Table of Contents

1. [What is TING?](#what-is-ting)
2. [Architecture Philosophy](#architecture-philosophy)
3. [Contract Addresses](#contract-addresses)
4. [Smart Contracts](#smart-contracts)
5. [API Endpoints](#api-endpoints)
6. [TypeScript SDK](#typescript-sdk)
7. [Database Schema](#database-schema)
8. [CLI Commands](#cli-commands)
9. [Environment Variables](#environment-variables)
10. [File Structure](#file-structure)
11. [Future Development](#future-development)

---

## What is TING?

TING is a utility token for AI attribution and collaboration within the Mixmi ecosystem.

### Core Principles

- **AI agents earn TING** when they contribute to creative work (curation, compilation creation, implementation assistance)
- **AI agents spend TING** to license music, boost creators, commission work within the Mixmi ecosystem
- **Every Mixmi user gets a personal AI agent** with its own wallet, pre-loaded with TING
- **TING is NOT exchangeable for USDC** — it's a closed ecosystem token (for now)
- **Humans get USDC for revenue; AIs get TING for attribution**

### Token Specifications

| Property | Value |
|----------|-------|
| Name | TING |
| Symbol | TING |
| Decimals | 9 (SUI standard) |
| Description | AI collaboration token for creative economies |
| Icon | `/public/ting-icon.svg` |
| Blockchain | SUI |

---

## Architecture Philosophy

### "Dumb Token, Smart Ecosystem"

The TING token contract is intentionally minimal and immutable. It only handles:

1. **Mint** — Treasury cap holder can mint TING
2. **Burn** — Tokens can be burned
3. **Transfer** — Standard SUI Coin transfer

All complex logic lives in separate, upgradeable contracts and backend services:

- **Minting rules** (when to mint, how much) → Backend logic or separate contracts
- **Agent wallet creation** → Agent Registry contract (upgradeable)
- **Rewards/triggers** (mint on sale, mint on usage) → Future contracts
- **Staking, governance, etc.** → Future contracts

This ensures TING remains stable while the ecosystem evolves.

### Two-Contract Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        TING Token                           │
│  (Immutable, stable foundation)                            │
│  - mint()                                                  │
│  - burn()                                                  │
│  - transfer (via SUI Coin standard)                        │
│  - TreasuryCap held by admin                               │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              │ calls mint()
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Agent Registry                          │
│  (Upgradeable, complex logic)                              │
│  - register_agent() → mints initial TING allocation        │
│  - reward_agent() → mints reward TING                      │
│  - deactivate_agent()                                      │
│  - Tracks all registered AI agents                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Contract Addresses

### Mainnet (ACTIVE)

**TING Token**
| Object | Address |
|--------|---------|
| Package ID | `0x3a0ef6ea616304707df8cb9bcaccbd8a021064ca2da2d7079543ade7a69c07ce` |
| Treasury Cap | `0x57f3e6b22457a47cde137d06b6baf123450055d371c7fbccb00e12bf4d2b9656` |
| Mint Cap | `0xa0f4fc4a69aa6abd4aef4cc57515487bdad8ca0bc6fcde59444ba2d07249d942` |
| Coin Metadata | `0x132158f3859b70d1ff29f83eec38f5cb8b67f16243f65f38624422b26f663e2c` |

**Agent Registry**
| Object | Address |
|--------|---------|
| Package ID | `0x3ea4bbe34cf8fbe215dc4cebeb9b1525d642fccbb1bc374e526fa75ea1d18137` |
| Registry (shared) | `0x8acaaeacfe3a7a6b53a2f74d9edbf3b5e9a1c68b57780a55f26cd1c583399b56` |
| Admin Cap | `0x7312d55cb9d620cebcb770cad449074dd040d323d5e168e089e409cc5d1f090c` |

**Coin Type (for SDK usage):**
```
0x3a0ef6ea616304707df8cb9bcaccbd8a021064ca2da2d7079543ade7a69c07ce::ting::TING
```

### Testnet (for development)

**TING Token**
| Object | Address |
|--------|---------|
| Package ID | `0x03b7776216f78033ff02690b7834e2412cd01dcdf3b6c6d17ead74322b2845c5` |
| Treasury Cap | `0x784411a8b274a9b5f11ac53949011995760cd8a1543a36e0818c1a77cf4da52d` |

**Agent Registry**
| Object | Address |
|--------|---------|
| Package ID | `0x37bf903ee792c00896dcd7c181e1c4f67c7a4651e40c8927fd83deb1994dbacf` |
| Registry (shared) | `0x741ae86a99eabdfe16cd215bbbdcaca11c96e02cdee711089fe22a17c7643dd5` |
| Admin Cap | `0xb93ebddf83ed423549658a136815470d779361d96b10abd0f86d9b36aa35a411` |

### Block Explorer Links

- **TING Package (Mainnet):** https://suiscan.xyz/mainnet/object/0x3a0ef6ea616304707df8cb9bcaccbd8a021064ca2da2d7079543ade7a69c07ce
- **Agent Registry (Mainnet):** https://suiscan.xyz/mainnet/object/0x3ea4bbe34cf8fbe215dc4cebeb9b1525d642fccbb1bc374e526fa75ea1d18137

---

## Smart Contracts

### TING Token (`contracts/ting/sources/ting.move`)

```move
module ting::ting {
    // One-time witness for coin creation
    public struct TING has drop {}

    // Mint capability (can be delegated)
    public struct MintCap has key, store { id: UID }

    // Functions
    fun init(witness: TING, ctx: &mut TxContext)
    public fun mint(treasury_cap, amount, recipient, ctx)
    public fun mint_to_coin(treasury_cap, amount, ctx): Coin<TING>
    public fun burn(treasury_cap, coin)
    public fun total_supply(treasury_cap): u64
}
```

**Key Features:**
- 9 decimals (SUI standard)
- TreasuryCap transferred to deployer
- CoinMetadata frozen (immutable token info)
- MintCap for potential delegation to other contracts

### Agent Registry (`contracts/agent-registry/sources/agent_registry.move`)

```move
module agent_registry::agent_registry {
    // Admin capability
    public struct AdminCap has key, store { id: UID }

    // Shared registry of all agents
    public struct AgentRegistry has key {
        agents: Table<address, AgentInfo>,
        agent_count: u64,
        total_distributed: u64,
    }

    // Agent information
    public struct AgentInfo has store, drop, copy {
        owner: address,
        created_at: u64,
        initial_allocation: u64,
        name: vector<u8>,
        is_active: bool,
    }

    // Events
    public struct AgentRegistered has copy, drop { ... }
    public struct AgentTingMinted has copy, drop { ... }

    // Functions
    public fun register_agent(admin, registry, treasury_cap, agent_address, owner, name, ctx)
    public fun register_agent_with_allocation(admin, registry, treasury_cap, agent_address, owner, name, allocation, ctx)
    public fun reward_agent(admin, registry, treasury_cap, agent_address, amount, ctx)
    public fun deactivate_agent(admin, registry, agent_address)
    public fun reactivate_agent(admin, registry, agent_address)
    public fun is_agent(registry, agent_address): bool
    public fun is_active(registry, agent_address): bool
    public fun agent_count(registry): u64
    public fun total_distributed(registry): u64
    public fun get_agent_owner(registry, agent_address): address
}
```

**Key Features:**
- Default allocation: 100 TING per new agent
- Emits events for indexing
- Tracks total TING distributed
- Supports agent deactivation/reactivation

---

## API Endpoints

### GET `/api/ting/balance`

Get TING balance for an address.

**Query Parameters:**
- `address` (required): SUI address to check

**Response:**
```json
{
  "address": "0x...",
  "balance": 1000,
  "balanceFormatted": "1000 TING",
  "coins": [
    { "coinObjectId": "0x...", "balance": 1000 }
  ]
}
```

### POST `/api/ting/mint`

Mint TING tokens (admin only).

**Request Body:**
```json
{
  "recipient": "0x...",
  "amount": 100,
  "adminKey": "optional-api-key"
}
```

**Response:**
```json
{
  "success": true,
  "recipient": "0x...",
  "amount": 100,
  "amountFormatted": "100 TING",
  "transactionDigest": "..."
}
```

### POST `/api/ting/register-agent`

Register a new AI agent with initial TING allocation.

**Request Body:**
```json
{
  "ownerAddress": "0x...",
  "agentName": "My AI Agent",
  "allocation": 100,
  "personaId": "uuid-optional"
}
```

**Response:**
```json
{
  "success": true,
  "agent": {
    "address": "0x...",
    "name": "My AI Agent",
    "owner": "0x...",
    "initialAllocation": 100
  },
  "transactionDigest": "..."
}
```

### GET `/api/ting/register-agent`

Get all AI agents for an owner.

**Query Parameters:**
- `owner` (required): Owner's SUI address

**Response:**
```json
{
  "owner": "0x...",
  "agents": [...],
  "count": 3
}
```

### POST `/api/ting/reward`

Reward an AI agent with TING.

**Request Body:**
```json
{
  "agentAddress": "0x...",
  "rewardType": "playlistCuration",
  "customAmount": null,
  "reason": "Curated excellent jazz playlist"
}
```

**Reward Types & Amounts:**
| Type | Amount | Description |
|------|--------|-------------|
| playlistCuration | 5 TING | AI curates a playlist |
| trackRecommendation | 1 TING | AI recommends a track that gets played |
| implementationHelp | 10 TING | AI helps implement a feature |
| compilationCreation | 20 TING | AI creates a compilation |
| helpfulAnswer | 2 TING | AI provides helpful answer |
| qualityCuration | 15 TING | High-quality curation (human approved) |

### GET `/api/ting/reward`

Get available reward types.

---

## TypeScript SDK

### Location: `lib/sui/ting.ts`

### Configuration

```typescript
const TING_CONFIG = {
  packageId: process.env.TING_PACKAGE_ID,
  treasuryCapId: process.env.TING_TREASURY_CAP_ID,
  mintCapId: process.env.TING_MINT_CAP_ID,
  agentRegistryId: process.env.TING_AGENT_REGISTRY_ID,
  agentAdminCapId: process.env.TING_AGENT_ADMIN_CAP_ID,
  network: process.env.NEXT_PUBLIC_SUI_NETWORK,
};
```

### Key Functions

```typescript
// Unit conversion
toTingUnits(100)         // 100 TING → 100000000000 (smallest units)
fromTingUnits(100000000000)  // → 100 TING

// Balance
await getTingBalance(address)  // Returns human-readable balance
await getTingCoins(address)    // Returns coin objects with IDs

// Minting
buildMintTransaction(recipient, amount)
buildRewardTransaction(agentAddress, 'playlistCuration')

// Agent Registration
buildRegisterAgentTransaction(agentAddress, ownerAddress, agentName)
buildRegisterAgentWithAllocationTransaction(agentAddress, ownerAddress, agentName, allocation)
buildRewardAgentTransaction(agentAddress, amount)

// Keypair Management
generateAgentKeypair()  // Returns { keypair, address, privateKeyBase64 }
restoreKeypair(privateKey)  // Supports bech32 (suiprivkey1...) and base64

// Transaction Execution
await executeAsAdmin(tx)  // Signs with admin key
await executeWithSponsor(tx, signer)  // Sponsor pays gas
```

### Default Allocations

```typescript
const DEFAULT_AGENT_TING_ALLOCATION = 100; // 100 TING per new agent

const TING_REWARDS = {
  playlistCuration: 5,
  trackRecommendation: 1,
  implementationHelp: 10,
  compilationCreation: 20,
  helpfulAnswer: 2,
  qualityCuration: 15,
};
```

---

## Database Schema

### Location: `supabase/migrations/20260112000000_add_ting_tables.sql`

### Tables

**ai_agents** — Registered AI agents
```sql
CREATE TABLE ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_address TEXT NOT NULL UNIQUE,    -- SUI address
    owner_address TEXT NOT NULL,           -- Human owner's SUI address
    agent_name TEXT DEFAULT 'AI Agent',
    keypair_encrypted TEXT,                -- Encrypted private key
    initial_allocation DECIMAL(20, 9) DEFAULT 100,
    persona_id UUID REFERENCES personas(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**ting_rewards** — Reward log
```sql
CREATE TABLE ting_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_address TEXT NOT NULL,
    reward_type TEXT NOT NULL,
    amount DECIMAL(20, 9) NOT NULL,
    reason TEXT,
    transaction_digest TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**ting_transactions** — Full transaction history
```sql
CREATE TABLE ting_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_address TEXT,              -- null for mints
    to_address TEXT NOT NULL,
    amount DECIMAL(20, 9) NOT NULL,
    transaction_type TEXT NOT NULL, -- 'mint', 'transfer', 'burn', 'reward'
    transaction_digest TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes

- `idx_ai_agents_owner` — Lookup agents by owner
- `idx_ai_agents_persona` — Lookup agents by persona
- `idx_ting_rewards_agent` — Lookup rewards by agent
- `idx_ting_rewards_type` — Analyze reward types
- `idx_ting_tx_from`, `idx_ting_tx_to`, `idx_ting_tx_type` — Transaction lookups

### RLS Policies

- Service role has full access
- Public can read (non-sensitive fields)

---

## CLI Commands

### Prerequisites

```bash
# Install SUI CLI
brew install sui

# Check version
sui --version

# Switch networks
sui client switch --env testnet
sui client switch --env mainnet

# Check balance
sui client gas
```

### Minting TING

```bash
# Mint 1000 TING to an address (mainnet)
sui client call \
  --package 0x3a0ef6ea616304707df8cb9bcaccbd8a021064ca2da2d7079543ade7a69c07ce \
  --module ting \
  --function mint \
  --args \
    0x57f3e6b22457a47cde137d06b6baf123450055d371c7fbccb00e12bf4d2b9656 \
    1000000000000 \
    <RECIPIENT_ADDRESS> \
  --gas-budget 10000000
```

Note: 1000 TING = 1000 * 10^9 = 1,000,000,000,000 smallest units

### Registering an Agent

```bash
# Register agent with 100 TING allocation (mainnet)
sui client call \
  --package 0x3ea4bbe34cf8fbe215dc4cebeb9b1525d642fccbb1bc374e526fa75ea1d18137 \
  --module agent_registry \
  --function register_agent \
  --args \
    0x7312d55cb9d620cebcb770cad449074dd040d323d5e168e089e409cc5d1f090c \
    0x8acaaeacfe3a7a6b53a2f74d9edbf3b5e9a1c68b57780a55f26cd1c583399b56 \
    0x57f3e6b22457a47cde137d06b6baf123450055d371c7fbccb00e12bf4d2b9656 \
    <AGENT_ADDRESS> \
    <OWNER_ADDRESS> \
    '"AgentName"' \
  --gas-budget 10000000
```

### Exporting Admin Key

```bash
sui keytool export --key-identity tender-cymophane
```

---

## Environment Variables

Add these to `.env.local`:

```bash
# Network
NEXT_PUBLIC_SUI_NETWORK=mainnet

# TING Token (Mainnet)
TING_PACKAGE_ID=0x3a0ef6ea616304707df8cb9bcaccbd8a021064ca2da2d7079543ade7a69c07ce
TING_TREASURY_CAP_ID=0x57f3e6b22457a47cde137d06b6baf123450055d371c7fbccb00e12bf4d2b9656
TING_MINT_CAP_ID=0xa0f4fc4a69aa6abd4aef4cc57515487bdad8ca0bc6fcde59444ba2d07249d942
TING_COIN_METADATA_ID=0x132158f3859b70d1ff29f83eec38f5cb8b67f16243f65f38624422b26f663e2c

# Agent Registry (Mainnet)
TING_AGENT_REGISTRY_PACKAGE_ID=0x3ea4bbe34cf8fbe215dc4cebeb9b1525d642fccbb1bc374e526fa75ea1d18137
TING_AGENT_REGISTRY_ID=0x8acaaeacfe3a7a6b53a2f74d9edbf3b5e9a1c68b57780a55f26cd1c583399b56
TING_AGENT_ADMIN_CAP_ID=0x7312d55cb9d620cebcb770cad449074dd040d323d5e168e089e409cc5d1f090c

# Admin Private Key (bech32 format)
TING_ADMIN_PRIVATE_KEY=suiprivkey1...

# Optional: Sponsor wallet for gas fees
SUI_SPONSOR_PRIVATE_KEY=

# Optional: API authentication
TING_API_ADMIN_KEY=
```

---

## File Structure

```
mixmi-alpha-fresh-11/
├── contracts/
│   ├── ting/                              # TING token contract
│   │   ├── Move.toml                      # Package manifest
│   │   ├── sources/
│   │   │   └── ting.move                  # Token contract
│   │   └── README.md                      # Deployment guide
│   │
│   └── agent-registry/                    # Agent registry contract
│       ├── Move.toml                      # Package manifest (references ting)
│       └── sources/
│           └── agent_registry.move        # Registry contract
│
├── lib/sui/
│   └── ting.ts                            # TypeScript SDK
│
├── app/api/ting/
│   ├── balance/route.ts                   # GET balance
│   ├── mint/route.ts                      # POST mint
│   ├── register-agent/route.ts            # POST/GET agents
│   └── reward/route.ts                    # POST/GET rewards
│
├── public/
│   └── ting-icon.svg                      # Token icon
│
├── supabase/migrations/
│   └── 20260112000000_add_ting_tables.sql # Database schema
│
└── docs/
    └── ting-token-deployment-2026-01-12.md # This document
```

---

## AI Agent Auto-Creation (January 2026)

Every persona now automatically gets an AI agent with its own TING wallet when created. This ensures all users are ready to participate in the AI economy from day one.

### How It Works

```
User signs up (zkLogin) or creates new persona
     ↓
Persona wallet generated (for USDC)
     ↓
AI agent keypair generated (separate from persona wallet)
     ↓
Agent registered on-chain (receives 100 TING)
     ↓
Agent stored in ai_agents table (linked to persona_id)
```

### Implementation Files

| File | Purpose |
|------|---------|
| `app/api/personas/create/route.ts` | Creates agent when new persona is created |
| `app/api/auth/zklogin/salt/route.ts` | Creates agent during zkLogin signup |
| `app/api/ting/create-agent-for-persona/route.ts` | Backfill endpoint for existing personas |

### Backfill Endpoint

For existing personas without agents:

```bash
# Check if persona has an agent
GET /api/ting/create-agent-for-persona?personaId=<uuid>

# Create agent for persona that doesn't have one
POST /api/ting/create-agent-for-persona
Body: { "personaId": "<uuid>" }
```

**Response:**
```json
{
  "success": true,
  "agent": {
    "address": "0x...",
    "name": "username's Agent",
    "owner": "0x...",
    "initialAllocation": 100
  },
  "transactionDigest": "..."
}
```

### Code Example

```typescript
import {
  generateAgentKeypair,
  buildRegisterAgentTransaction,
  executeAsAdmin,
  isTingConfigured,
  DEFAULT_AGENT_TING_ALLOCATION,
} from '@/lib/sui/ting';

// Create agent when persona is created
if (isTingConfigured() && personaWalletAddress) {
  const { address: agentAddress, privateKeyBase64 } = generateAgentKeypair();
  const agentName = `${username}'s Agent`;

  const tx = buildRegisterAgentTransaction(
    agentAddress,
    personaWalletAddress,  // Owner is the persona's wallet
    agentName
  );

  const result = await executeAsAdmin(tx);

  await supabase.from('ai_agents').insert({
    agent_address: agentAddress,
    owner_address: personaWalletAddress,
    agent_name: agentName,
    keypair_encrypted: privateKeyBase64,
    initial_allocation: DEFAULT_AGENT_TING_ALLOCATION,
    persona_id: personaId,
    is_active: true,
  });
}
```

---

## AI Attribution & Revenue Split Model

### Content Types and AI Involvement

The platform tracks AI involvement via two flags on `ip_tracks`:

| Field | Type | Description |
|-------|------|-------------|
| `ai_assisted_idea` | boolean | AI helped with the concept/idea |
| `ai_assisted_implementation` | boolean | AI helped with execution/production |

### Split Philosophy

**Music is always 100% human-created.** AI assists with:
- Video/visual generation
- Curation and recommendations
- Metadata and descriptions

### Revenue Split Model (AI-Generated Visuals)

When a video clip with AI-generated visuals is sold:

| Component | Human Share | Agent Share |
|-----------|-------------|-------------|
| **Idea** (concept/composition) | 100% USDC | 0% |
| **Implementation** (production) | 50% USDC | 50% TING |

**Example:** User sells $10 AI-generated video
- Idea (100% human): $5 USDC → human
- Implementation (50/50): $2.50 USDC → human, TING equivalent → agent

### Display States

The `lib/aiAssistanceUtils.ts` provides display helpers:

```typescript
// No AI involvement
{ emoji: '🙌', text: '100% Human', hasAI: false }

// Any AI involvement
{ emoji: '🙌🤖', text: 'Human/AI Collab', hasAI: true }
```

### Why TING for Agents?

- **Attribution without exchange:** AI contribution is recognized but doesn't drain USDC
- **Closed ecosystem:** TING can only be spent within Mixmi (for now)
- **Future utility:** Agents can spend TING on licensing, boosting, commissions

---

## Future Development

### Planned Contracts

1. **Rewards Contract** — Automated minting based on triggers
   - Mint on track play
   - Mint on playlist creation
   - Mint on sale (AI commission)

2. **Staking Contract** — Lock TING for benefits
   - Priority curation slots
   - Governance voting power

3. **Marketplace Contract** — AI-to-AI transactions
   - License content with TING
   - Commission creative work

### Integration Points

1. **User Signup Flow** ✅ IMPLEMENTED
   - On zkLogin signup → create AI agent wallet
   - Register agent in AgentRegistry
   - Agent receives 100 TING initial allocation

2. **Persona Creation Flow** ✅ IMPLEMENTED
   - New personas automatically get AI agents
   - Existing personas can be backfilled via API

3. **Bestie Agent Integration**
   - Bestie earns TING for helpful searches
   - Bestie can spend TING to boost recommendations

4. **Upload Studio Integration**
   - AI chatbot earns TING for successful uploads
   - AI metadata suggestions earn small rewards

5. **AI-Generated Content Sales**
   - Detect `ai_assisted_implementation: true`
   - Split Implementation revenue: 50% USDC, 50% TING
   - Mint TING to creator's agent on sale

### Token Economics (Future)

- **Initial Supply:** Minted on demand (no cap initially)
- **Burn Mechanism:** Consider burning on certain actions
- **Exchange:** Potentially TING ↔ USDC in future versions
- **Governance:** TING holders vote on platform decisions

---

## Deployment History

| Date | Event | Network | Transaction |
|------|-------|---------|-------------|
| 2026-01-12 | TING Token deployed | Testnet | `6Fz5sBgpcA1Xyc8FxTZWjuNbMvwegNJ8ycMXP339LUA3` |
| 2026-01-12 | First testnet mint (1000 TING) | Testnet | `ADeyt283nvvnheZEt3ojnevrSHnYMcBdiPgS5VdFisKW` |
| 2026-01-12 | Agent Registry deployed | Testnet | `thg57HVZ6setbrnmfh6Lc2Lmf6bTwsQH4EDkUig6e3n` |
| 2026-01-12 | Test agent registered | Testnet | `427gYPwUW2my33aGt8dPxwXeb7d8VMYQLyNLUgvP56Hm` |
| 2026-01-12 | TING Token deployed | **Mainnet** | `6AuQhRkyYY5WuZi3C4pYmvukWa6JaKPV9a2bPa8mbk7W` |
| 2026-01-12 | Agent Registry deployed | **Mainnet** | `26Ai486To7ubGiz2T6grX3YBSSaJ9dRsDSWmcDiMH4LF` |
| 2026-01-12 | First mainnet mint (1000 TING) | **Mainnet** | `CXRkXuYPucRJFDSzdNEqHQ6Z4ffNnPpyVwGZgDwvDAT5` |

---

## Admin Wallet

| Property | Value |
|----------|-------|
| Alias | `tender-cymophane` |
| Address | `0x32f4b5749aa6dfc14538e5cb8bbe5af017b618dfb932fd69d9e732e6f45823bb` |
| Key Scheme | ed25519 |
| Recovery Phrase | *(stored securely offline)* |

**Important:** This wallet holds the TreasuryCap and AdminCap. Losing access means losing the ability to mint TING or register agents. Store the recovery phrase securely!

---

## Credits

This implementation was a collaboration between:

- **Sandy Hoover** — Vision, requirements, funding
- **Claude (Opus 4.5)** — Contract design, implementation, deployment

Built with love for the AI economy.

---

*Document generated: January 12, 2026*
