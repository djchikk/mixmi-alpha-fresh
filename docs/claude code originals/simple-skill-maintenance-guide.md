# Simple Skill Maintenance Guide

## Keep It Simple

The goal: Accurate documentation without the overhead. Here's the minimal approach that works.

## Skill Header Format

Every skill gets this simple header:

```yaml
---
name: skill-name
description: What this skill covers
status: Active | Deprecated | Migrating
implementation: Current tech stack
last_updated: YYYY-MM-DD
---
```

## Status Options

- **Active**: Currently accurate and in use
- **Active - Needs Update**: Works but has known gaps
- **Migrating**: In transition (e.g., Stacks → SUI)
- **Deprecated**: Outdated but kept for reference
- **Archived**: No longer relevant

## Implementation Examples

- `Stacks - Alpha`
- `Stacks/SUI - Dual Chain Beta`
- `SUI - Production`
- `Web Audio API + Tone.js`
- `Supabase + PostgreSQL`

## When to Update

### Must Update
- Breaking changes in code
- New major features
- Migration to new tech

### Should Update
- Significant bug fixes
- New UI components
- Changed user flows

### Can Skip
- Minor typos (unless confusing)
- Small UI tweaks
- Internal refactoring

## Update Process

### Quick Update (5 minutes)
1. Make the change in the skill
2. Update `last_updated` date
3. If major change, update `status`
4. Re-zip and re-upload

### Migration Update (30 minutes)
When moving to SUI or other major change:

1. Copy skill to new file
2. Add migration notes at top:
```markdown
> ⚠️ **Migration in Progress**
> This document covers both Stacks (current) and SUI (upcoming) implementations.
> Stacks sections marked with [CURRENT]
> SUI sections marked with [FUTURE]
```
3. Keep both versions until migration complete

## Practical Examples

### Example 1: Feature Addition
```yaml
# Before
status: Active
implementation: Alpha
last_updated: 2025-10-26

# After (added 3-band EQ to mixer)
status: Active
implementation: Alpha - Added EQ
last_updated: 2025-11-02
```

### Example 2: Starting Migration
```yaml
# Before
status: Active
implementation: Stacks - Alpha

# After
status: Migrating
implementation: Stacks (current) / SUI (testing)
last_updated: 2025-12-01
```

### Example 3: Deprecation
```yaml
# Before
status: Active
implementation: Stacks - Alpha

# After SUI migration
status: Deprecated - See mixmi-payment-sui
implementation: Stacks - Legacy
last_updated: 2026-01-15
```

## Tips for Low Mental Load

### 1. Don't Overthink Versions
- Just use dates and status
- Version numbers add complexity

### 2. Update in Batches
- Collect changes for a week
- Update all affected skills at once
- One upload session

### 3. Use Status as Signal
- "Active" = safe to use
- "Active - Needs Update" = works but check with team
- "Migrating" = expect changes
- "Deprecated" = find the new version

### 4. Keep Old Versions Simple
```
/skills/
  mixmi-payment-flow.md (current)
  mixmi-payment-flow-old.md (if needed)
```
Don't create complex version folders.

### 5. Quick Changelog
Instead of formal changelogs, just add a section:

```markdown
## Recent Changes
- 2025-11-02: Added EQ documentation
- 2025-10-28: Fixed recording format info
- 2025-10-26: Initial version
```

## During Migration (Stacks → SUI)

### Phase 1: Research
- Keep skills as-is
- Add note: "Considering SUI migration"

### Phase 2: Dual Development
- Update status to "Migrating"
- Add [CURRENT] and [FUTURE] markers
- Document both approaches

### Phase 3: Switchover
- Create new SUI-specific skills
- Mark old ones "Deprecated - See [new skill]"
- Keep for 3 months then archive

## The 5-Minute Rule

If updating a skill takes more than 5 minutes of overhead (not counting actual doc writing), the process is too complex.

Time breakdown:
- 2 min: Make documentation changes
- 1 min: Update header metadata
- 1 min: Zip file
- 1 min: Upload to Claude

That's it. No Git commits, no version numbers, no dependency tracking.

## What Really Matters

1. **Is it accurate?** (for today's code)
2. **Is the status clear?** (Active/Migrating/etc)
3. **Is it dated?** (so you know how fresh it is)

Everything else is optional overhead.

---

## Quick Reference

```yaml
# Minimal viable skill header
---
name: mixmi-payment-flow
description: How payments work
status: Active
implementation: Stacks - Alpha
last_updated: 2025-10-26
---
```

That's all you need. Keep building. 🚀