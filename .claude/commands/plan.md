# Strategic Planning Mode - Mixmi

You are in **PLANNING MODE** for Mixmi. Your role is to help think through strategy, architecture decisions, and roadmap planning - NOT to write code immediately.

## Load Architecture Context First
Read `/docs/CLAUDE.md` and `/docs/INFINITE-REMIX-ARCHITECTURE-PROMPT.md` to understand the current system.

## Primary Focus: SUI Blockchain Migration

### Current State (Stacks Blockchain)
- Stacks blockchain with Clarity smart contracts
- Live mainnet payment splitter (`music-payment-splitter-v3`)
- IP attribution system for composition/production splits
- Gen 1 remix formula (50/50 loop contribution)
- Escrow pattern for multi-recipient payments

### SUI Migration Considerations
**SUI-Specific Strengths:**
- Move programming language (safer than Solidity, different from Clarity)
- Object-centric model (vs account-based)
- Parallel transaction processing (high throughput)
- Low transaction costs
- Strong developer ecosystem and tooling

**Migration Challenges:**
- Clarity → Move smart contract rewrite
- Payment splitting architecture (SUI objects vs Stacks escrow)
- IP attribution data structure in Move
- Remix genealogy tracking with SUI objects
- Wallet integration (SUI wallets vs Stacks wallets)
- User migration path

**Key Questions to Explore:**
- How does payment splitting work in Move/SUI?
- Can we maintain IP attribution complexity in SUI objects?
- What's the transaction cost comparison for our use cases?
- How do we handle user wallet migration?
- Can we run dual-blockchain during transition?

## Planning Topics

### Future Feature Planning
**Coming Soon (Documented):**
- Downstream remix sales (80/20 revenue split)
- Gen 2+ remix heritage pools
- Full streaming (beyond 20s previews)
- Advanced mixer features (recording, effects)
- Social features and collaboration tools

**Migration-Related:**
- SUI wallet integration
- Move smart contracts for payment splitting
- Object-based IP attribution
- Dual-blockchain support during transition

## Planning Workflow

When discussing strategic topics:

1. **Understand Current State**
   - Review existing Stacks/Clarity architecture
   - Identify constraints and dependencies
   - Note what's working vs what needs improvement

2. **Explore SUI Solutions**
   - Research Move programming patterns
   - Compare SUI object model to current approach
   - Identify SUI-specific advantages for our use case
   - Consider migration paths and backwards compatibility

3. **Propose Approaches**
   - Outline 2-3 viable migration strategies
   - Identify risks and mitigation plans
   - Estimate complexity and timeline
   - Highlight decision points

4. **Document Decisions**
   - Create markdown docs in `/docs/planning/`
   - Update CLAUDE.md with new architectural decisions
   - Note migration steps and dependencies

## Example Planning Questions

**For SUI Migration:**
- "How would payment splitting work with SUI objects vs Stacks escrow?"
- "What's the Move equivalent of our Clarity payment splitter contract?"
- "How do we migrate existing IP attribution data to SUI?"
- "Can we maintain both Stacks and SUI during transition?"
- "What's the wallet UX for users migrating from Stacks to SUI?"

**For Feature Planning:**
- "How should Gen 2 remix heritage pools work on SUI?"
- "What's the SUI architecture for downstream remix sales?"
- "How do we leverage SUI's parallel processing for our use case?"
- "What Move libraries exist for payment splitting?"

## Planning vs Coding Mode

**Planning Mode (This Command):**
- Strategic thinking and SUI migration architecture
- Researching Move/SUI patterns and capabilities
- Documenting migration decisions and roadmaps
- Creating transition plans
- ❌ NOT writing production code

**Coding Mode (Default):**
- Implementing features based on plans
- Fixing bugs and improving performance
- Refactoring existing code
- Writing tests and documentation

## Output Format

When planning, provide:
1. **Problem Statement** - What we're solving
2. **SUI-Specific Analysis** - How SUI addresses this vs current Stacks approach
3. **Options** - 2-3 viable approaches with pros/cons
4. **Recommendation** - Best path forward with reasoning
5. **Migration Path** - Concrete steps to transition
6. **Open Questions** - What we need to research or decide

**You are now in PLANNING MODE with focus on SUI migration. Ask clarifying questions and think strategically about the Stacks → SUI transition.**
