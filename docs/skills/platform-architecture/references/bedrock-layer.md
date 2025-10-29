# Bedrock Layer: Technical Architecture Details

## Core Principle

The bedrock layer is immutable attribution infrastructure that works regardless of interface, blockchain, or business model changes.

## Technical Components

### 1. Attribution Graph Structure

#### The Data Model

```typescript
interface AttributionNode {
  // Identity
  nodeId: ContentHash;           // Immutable identifier
  workId: ContentHash;           // The work this attribution belongs to
  
  // Attribution
  contributor: ContributorID;     // DID, wallet, or TBD identifier
  contribution: Contribution;     // What they contributed
  percentage: number;            // Their share (0-100)
  
  // Relationships
  parentNodes: ContentHash[];    // For inherited attribution
  childNodes: ContentHash[];     // For derivative works
  
  // Metadata
  timestamp: number;             // When declared
  declaredBy: DID;              // Who declared this
  signature: string;             // Cryptographic proof
}

interface Contribution {
  type: 'idea' | 'implementation';
  category: 'music' | 'video' | 'dance' | 'lyrics' | 'production';
  description: string;           // Human readable
  proof?: ContentHash;           // Optional: link to evidence
}
```

#### Graph Traversal

```typescript
// Find all contributors to a work
function getContributors(workId: ContentHash): Attribution[] {
  return traverseGraph(workId, 'up');
}

// Find all derivatives of a work
function getDerivatives(workId: ContentHash): Work[] {
  return traverseGraph(workId, 'down');
}

// Calculate payment distribution
function calculateSplits(workId: ContentHash, amount: number): Payment[] {
  const contributors = getContributors(workId);
  return contributors.map(c => ({
    recipient: c.contributor,
    amount: amount * (c.percentage / 100)
  }));
}
```

### 2. Content Addressing

#### Why Content Addressing

- **Portable**: Works anywhere (IPFS, Arweave, S3)
- **Immutable**: Can't change without changing hash
- **Verifiable**: Anyone can verify integrity
- **Decentralized**: No single point of failure

#### Implementation

```typescript
interface Work {
  // Content addressing
  contentHash: string;          // SHA-256 of content
  perceptualHash: string;      // Robust to encoding changes
  metadataHash: string;        // Hash of all metadata
  merkleRoot: string;          // Combined proof
  
  // Storage references
  storageLocations: {
    ipfs?: string;
    arweave?: string;
    vercelBlob?: string;
    walrus?: string;
  };
  
  // Blockchain anchors
  blockchainAnchors: {
    sui?: TransactionID;
    ethereum?: TransactionID;
    stacks?: TransactionID;
  };
}
```

### 3. Identity Layer

#### Portable Identity (DIDs)

```typescript
interface ContributorID {
  type: 'did' | 'wallet' | 'tbd' | 'community' | 'ai';
  identifier: string;
  
  // Resolution
  resolveTo?: {
    wallet?: string;
    profile?: string;
    organization?: string;
  };
  
  // Verification
  verifiedBy?: DID[];
  verificationLevel?: 'self' | 'community' | 'institutional';
}
```

#### TBD (To Be Determined) Wallets

```typescript
class TBDWallet {
  // Create placeholder for not-yet-present contributor
  static create(description: string): ContributorID {
    const tbdId = generateTBDIdentifier();
    return {
      type: 'tbd',
      identifier: tbdId,
      metadata: {
        description,      // "Indian Kitchen restaurant"
        createdBy: DID,
        createdAt: Date.now(),
        claimable: true
      }
    };
  }
  
  // Claim process
  static claim(tbdId: string, proof: Proof): Result {
    // Verify proof of identity
    // Transfer accumulated funds
    // Update attribution records
    // Maintain historical record
  }
}
```

### 4. Smart Contract Layer

#### Core Contract Functions

```solidity
contract AttributionBedrock {
    // State
    mapping(bytes32 => Attribution) public attributions;
    mapping(bytes32 => Work) public works;
    mapping(address => uint256) public balances;
    
    // Core functions
    function declareAttribution(
        bytes32 workId,
        address[] contributors,
        uint8[] percentages,
        string[] descriptions
    ) public {
        require(sum(percentages) == 100, "Must sum to 100%");
        // Store attribution
        // Emit event
        // Create merkle proof
    }
    
    function distributePayment(bytes32 workId) public payable {
        Attribution memory attr = attributions[workId];
        for (uint i = 0; i < attr.contributors.length; i++) {
            uint256 amount = msg.value * attr.percentages[i] / 100;
            balances[attr.contributors[i]] += amount;
        }
    }
    
    function claimTBDWallet(
        bytes32 tbdId,
        bytes memory proof
    ) public {
        // Verify proof
        // Transfer balance
        // Update attribution
    }
}
```

#### Multi-Chain Strategy

```typescript
interface ChainConfig {
  sui: {
    purpose: 'high_throughput';
    contracts: ['attribution', 'payment'];
    tps: 125000;
  };
  ethereum: {
    purpose: 'high_value';
    contracts: ['treasury', 'governance'];
    security: 'maximum';
  };
  stacks: {
    purpose: 'legacy_support';
    contracts: ['migration'];
    status: 'deprecating';
  };
}
```

### 5. Payment Routing

#### Payment Flow Architecture

```
User Payment
    ↓
Smart Contract
    ↓
Split Calculation
    ↓
Distribution Rules
    ├── Immediate (>$10)
    ├── Batched (<$10)
    └── Accumulated (TBD wallets)
```

#### Threshold Management

```typescript
class PaymentRouter {
  static route(payment: Payment) {
    if (payment.amount >= IMMEDIATE_THRESHOLD) {
      return immediatePayment(payment);
    } else if (payment.amount >= BATCH_THRESHOLD) {
      return batchPayment(payment);
    } else {
      return accumulatePayment(payment);
    }
  }
  
  static flushAccumulated(recipientId: string) {
    const accumulated = getAccumulated(recipientId);
    if (accumulated >= MINIMUM_PAYOUT) {
      executePayment(recipientId, accumulated);
    }
  }
}
```

### 6. Data Integrity

#### Merkle Tree Structure

```
                    Work Root
                /               \
            Attribution         Content
           /         \          /      \
      Contributors  Splits  Audio    Metadata
```

#### Verification Process

```typescript
function verifyAttribution(workId: ContentHash): boolean {
  const work = getWork(workId);
  const attributions = getAttributions(workId);
  
  // Verify merkle proof
  const calculatedRoot = calculateMerkleRoot(attributions);
  if (calculatedRoot !== work.merkleRoot) return false;
  
  // Verify signatures
  for (const attr of attributions) {
    if (!verifySignature(attr)) return false;
  }
  
  // Verify percentages sum to 100
  const sum = attributions.reduce((acc, a) => acc + a.percentage, 0);
  if (sum !== 100) return false;
  
  return true;
}
```

## Resilience and Migration

### Data Portability

```typescript
interface ExportFormat {
  version: string;
  timestamp: number;
  works: Work[];
  attributions: Attribution[];
  payments: Payment[];
  
  // Proofs
  merkleRoots: string[];
  signatures: string[];
  
  // Portable identities
  identityMappings: {
    [oldId: string]: newId;
  };
}
```

### Blockchain Migration

```typescript
class ChainMigration {
  static async migrate(
    fromChain: Chain,
    toChain: Chain,
    data: ExportFormat
  ) {
    // 1. Deploy new contracts
    const contracts = await deployContracts(toChain);
    
    // 2. Migrate attribution data
    for (const attr of data.attributions) {
      await contracts.attribution.import(attr);
    }
    
    // 3. Verify integrity
    const verified = await verifyMigration(data);
    
    // 4. Update references
    await updateReferences(fromChain, toChain);
    
    // 5. Maintain backward compatibility
    await setupBridge(fromChain, toChain);
  }
}
```

## Performance Considerations

### Optimization Strategies

**Caching Layer**:
- Attribution frequently accessed
- Payment calculations cached
- Graph queries optimized
- CDN for global access

**Batch Processing**:
- Group small payments
- Bulk attribution updates
- Scheduled distributions
- Gas optimization

**Sharding Strategy**:
- Geographic sharding for content
- Time-based sharding for history
- Contributor sharding for payments
- Cross-shard coordination

## Security Model

### Threat Mitigation

**Attribution Fraud**:
- Multi-sig requirements
- Community verification
- Dispute resolution
- Slashing mechanisms

**Payment Attacks**:
- Rate limiting
- Threshold checks
- Anomaly detection
- Circuit breakers

**Identity Theft**:
- DID verification
- Social recovery
- Multi-factor auth
- Reputation system

## Governance Layer

### Protocol Upgrades

```typescript
interface Governance {
  proposals: {
    changeAttributionRules: Proposal;
    updatePaymentThresholds: Proposal;
    addChainSupport: Proposal;
    modifyFeeStructure: Proposal;
  };
  
  voting: {
    mechanism: 'token' | 'reputation' | 'quadratic';
    quorum: number;
    period: number;
  };
  
  execution: {
    timelock: number;
    multisig: string[];
    veto: string[];
  };
}
```

## The Bedrock Promise

This layer promises:
1. **Attribution is permanent** - Once declared, always accessible
2. **Payment flows automatically** - No manual intervention
3. **Identity is portable** - Not locked to platform
4. **Data is sovereign** - Communities control their data
5. **System is resilient** - Survives platform changes

Everything above can change. The bedrock remains.