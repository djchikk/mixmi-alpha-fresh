# Mixmi App Architecture Context

You are working on **Mixmi**, a professional music creation platform with blockchain-based IP attribution. Load full context from these key files:

## Core Architecture Documents
Read these files to understand the complete system:
- `/docs/CLAUDE.md` - Complete project overview with October 2025 achievements
- `/docs/INFINITE-REMIX-ARCHITECTURE-PROMPT.md` - Remix economics and smart contract architecture

## Current System Status (Auto-Updated)

**Branch**: `main` (auto-deploys to production on push)

**Key Components:**
1. **🎛️ Tiny Mixer** - Professional DJ interface (SimplifiedMixerCompact.tsx)
2. **📦 Crate** - Persistent content transport (components/shared/Crate.tsx)
3. **🎵 Playlist Widget** - Expandable playlist player (components/PlaylistWidget.tsx)
4. **🌍 Globe** - 3D content visualization with Null Island
5. **🛒 Cart** - Shopping cart in Header (contexts/CartContext.tsx)

**Recent Major Features:**
- ✅ Playlist drag & drop (bidirectional, fully functional)
- ✅ Null Island clustering for locationless tracks
- ✅ Mixer stability overhaul (Oct 23, 2025)
- ✅ Gen 1 remix IP splits (Oct 15, 2025)
- ✅ Mainnet payment splitter live (Oct 7, 2025)

## Architecture Principles

**Multi-Context System:**
- Each page has different behavior (globe vs mixer vs store)
- Components are context-aware (Crate changes per page)
- State management via React Context (MixerContext, CartContext, AuthContext)

**Drag & Drop Ecosystem:**
- Type system: `'COLLECTION_TRACK'`, `'TRACK_CARD'`, `'DECK_TRACK'`
- Universal accept/drop patterns across components
- Smart content filtering (loops to mixer, all to crate)

**Persistence Strategy:**
- localStorage for UI state (widget visibility, collapsed states)
- Supabase for content and user data
- Hybrid approach for performance + reliability

**Audio Architecture:**
- Multiple audio sources coordinate via events
- Cleanup on unmount prevents memory leaks
- Preview system (20 seconds for songs, full for loops)

## Development Guidelines

When working on this codebase:
1. **Always check context** - Components behave differently per page
2. **Maintain drag types** - Use established drag/drop patterns
3. **Preserve persistence** - Include localStorage for UI state
4. **Clean up audio** - Prevent memory leaks in audio components
5. **Test cross-page** - Features should work across navigation

## Blockchain Context

**Smart Contracts (Stacks/Clarity):**
- Payment splitter: `music-payment-splitter-v3` (live on mainnet)
- IP attribution with composition/production splits
- Gen 1 remix formula: Each loop contributes 50% to remix
- Remixer gets 20% commission on downstream sales

**Planned Migration:**
- Current: Stacks blockchain
- Future: Considering other blockchain options
- Need to maintain: IP attribution, payment splitting, remix genealogy

## Quick Reference Commands

Use these for specific contexts:
- `/plan` - Strategic planning mode (blockchain, features, architecture)
- `/quick` - Quick context loading (basics only)

**You now have full architecture context. Ask clarifying questions before starting work.**
