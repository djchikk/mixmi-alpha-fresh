# Investigation: Widgets on Creator Store Pages

## 🎯 Objective

Investigate the feasibility of making the **Playlist Widget**, **Tiny Mixer**, and **Radio Widget** available on Creator Store pages, with content persistence between the globe and creator stores.

---

## 📋 Context

### Current Architecture

**Widget Locations (Current):**
- **Globe page** (`app/page.tsx`) - Has all three widgets (Playlist, Tiny Mixer, Radio)
- **Creator Store pages** (`app/store/[walletAddress]/page.tsx`) - Currently NO widgets

**Current Constraints:**
1. **Single-page restriction**: Only one creator store can be open at a time
2. **Multiple stores exist**: Each wallet address has its own creator store
3. **Audio conflict prevention**: Multi-tab restriction was implemented to avoid audio playback conflicts
4. **Content isolation**: Currently, widget content doesn't persist between pages

### Current Widget Implementations

**Files to Review:**
- `components/PlaylistWidget.tsx` - Playlist with 8 slots
- `components/RadioWidget.tsx` - Radio player with drag-drop functionality
- `components/mixer/TinyMixer.tsx` - Mini mixer for quick remixing

**Current Widget State Management:**
- Widgets use local React state (useState)
- No global state management for widget content
- Audio elements are page-specific
- No persistence layer currently exists

---

## 🔍 Investigation Questions

### 1. Widget Placement on Creator Store

**Question:** Where should the widgets be positioned on the Creator Store page?

**Consider:**
- Current layout has header, thumbnail, creator info, and track grid
- Desktop vs mobile considerations
- Should widgets be:
  - Fixed position (like on globe)?
  - Collapsible/expandable?
  - Hidden by default with toggle?
  - In a sidebar?

**Files to Review:**
- `app/store/[walletAddress]/page.tsx` - Current store layout
- Layout patterns from globe page

---

### 2. Content Persistence Between Pages

**Question:** How can widget content persist when navigating between globe and creator stores?

**Possible Approaches:**

**A. Global State Management**
- Implement Zustand, Redux, or React Context for widget state
- Store playlist tracks, radio station, mixer content globally
- Persist across page navigation

**B. LocalStorage/SessionStorage**
- Save widget state to browser storage
- Restore on page load
- Pros: Simple, works across tabs
- Cons: Not reactive across tabs

**C. URL State**
- Encode widget state in URL params
- Pros: Shareable, bookmarkable
- Cons: URL length limits, complexity

**D. Database/Supabase**
- Store user's widget state in database
- Associate with wallet address
- Pros: Persists across devices, sessions
- Cons: Requires authentication, more complex

**Recommendation Needed:** Which approach fits best with current architecture?

---

### 3. Audio Management Across Pages

**Question:** How to handle audio playback when switching between globe and creator stores?

**Current Audio Architecture:**
- Globe page: Has audio preview system with 20-second timeout
- Creator Store: Has audio preview system with 20-second timeout
- Radio Widget: Plays indefinitely
- Mixer: Has its own audio context

**Challenges:**
1. **Audio Context Continuity**: How to maintain audio playback when navigating?
2. **Single Audio Source Rule**: Only one audio should play at a time
3. **Radio Widget Persistence**: If listening to radio, should it continue playing when switching pages?

**Possible Solutions:**

**A. Global Audio Manager**
- Create singleton audio manager service
- Manages all audio playback across pages
- Survives page navigation

**B. Audio Element Persistence**
- Use Web Audio API with global context
- Attach to window object or service worker
- Continue playing across navigation

**C. Hybrid Approach**
- Radio Widget audio persists
- Preview audio stops on navigation
- Mixer audio stops on navigation

**Investigation Needed:** Test if audio can survive Next.js page navigation

---

### 4. Multi-Tab Constraint

**Question:** Why was the multi-tab restriction implemented, and can we work around it?

**Current Implementation:**
- Mentioned that multiple creator store tabs were made difficult to open
- Reason: Audio conflicts

**Questions to Answer:**
1. How is the multi-tab restriction currently implemented?
2. Can we use BroadcastChannel API to sync audio state across tabs?
3. Should we maintain this restriction or remove it with better audio management?
4. Can we detect tab switching and pause/resume audio accordingly?

**Files to Search:**
- Look for tab detection code
- Check for window focus/blur handlers
- Search for localStorage locks or tab ID generation

---

### 5. State Hydration on Page Load

**Question:** When loading a Creator Store page, how should widgets be hydrated?

**Scenarios:**
1. **User comes from Globe**: Widgets should restore their content
2. **User refreshes Creator Store**: Widgets should restore from persistence layer
3. **User opens Creator Store in new tab**: What should happen?
4. **User shares Creator Store URL**: Should widgets be empty or pre-populated?

**Data Flow to Design:**
```
[Globe with widgets]
    ↓ (navigation)
[Creator Store]
    ↓ (load widgets)
[Hydrate from ??] ← What's the source?
```

---

## 🛠️ Technical Investigation Tasks

### Task 1: Widget Component Analysis
- [ ] Review widget component architecture
- [ ] Identify all state variables in each widget
- [ ] List all props and dependencies
- [ ] Document audio element usage

### Task 2: State Management Options
- [ ] Evaluate Zustand vs Redux vs Context API
- [ ] Prototype widget state persistence
- [ ] Test state restoration across navigation
- [ ] Measure performance impact

### Task 3: Audio Continuity Testing
- [ ] Test if audio survives Next.js navigation
- [ ] Experiment with Web Audio API global context
- [ ] Test BroadcastChannel for multi-tab sync
- [ ] Prototype audio manager service

### Task 4: Layout Design
- [ ] Mock up widget placement options for Creator Store
- [ ] Consider responsive design
- [ ] Plan collapsed/expanded states
- [ ] Design toggle mechanism

### Task 5: Multi-Tab Investigation
- [ ] Find current multi-tab restriction code
- [ ] Document why it was added
- [ ] Test removing restriction with audio manager
- [ ] Design tab-aware audio control

---

## 📊 Success Criteria

### Must Have
- [ ] Widgets appear on Creator Store pages
- [ ] Widget content persists when navigating from Globe to Store
- [ ] Only one audio source plays at a time
- [ ] No audio conflicts or overlapping playback
- [ ] Widgets are responsive (work on mobile)

### Nice to Have
- [ ] Widget state persists across page refreshes
- [ ] Widget state syncs across multiple tabs
- [ ] Smooth audio transitions when navigating
- [ ] Widgets are collapsible to save space
- [ ] Widget state can be saved/restored per user

### Must NOT Break
- [ ] Current Globe page functionality
- [ ] Current Creator Store track playback
- [ ] Radio Widget indefinite playback
- [ ] Drag-and-drop functionality
- [ ] Mobile responsiveness

---

## 🚨 Known Constraints & Considerations

### Performance
- Creator Store loads many track cards (24 per page)
- Adding widgets shouldn't impact load time
- Audio context creation can be expensive
- State management overhead should be minimal

### UX Concerns
- Widgets shouldn't obstruct main content
- Should be discoverable but not intrusive
- Mobile layout is challenging (limited space)
- Audio persistence might confuse users if unexpected

### Technical Debt
- Current widgets use local state
- No global audio management exists
- Next.js page navigation kills component state
- No persistence layer currently implemented

### Browser Limitations
- Audio autoplay policies vary by browser
- Web Audio API has limitations
- LocalStorage has size limits
- BroadcastChannel not supported in all browsers

---

## 📁 Key Files to Review

### Widget Components
- `components/PlaylistWidget.tsx`
- `components/RadioWidget.tsx`
- `components/mixer/TinyMixer.tsx`
- `components/AudioWidgetControls.tsx`

### Page Components
- `app/page.tsx` (Globe - has widgets)
- `app/store/[walletAddress]/page.tsx` (Creator Store - no widgets)

### Layout
- `components/layout/Header.tsx`
- `app/layout.tsx`

### Context/State
- `contexts/MixerContext.tsx`
- Check if other context providers exist

### Audio Systems
- Search for `HTMLAudioElement` usage
- Search for `new Audio()` instances
- Look for audio preview systems

---

## 🎯 Recommended Investigation Order

1. **Start Simple**: Try adding widgets to Creator Store page without persistence
2. **Test Audio**: Verify audio behavior when navigating between pages
3. **Prototype Persistence**: Try simplest approach (localStorage) first
4. **Design State Management**: If simple approach works, scale up
5. **Polish UX**: Add transitions, loading states, error handling
6. **Document**: Create implementation plan based on findings

---

## 📝 Deliverable

Please provide:
1. **Feasibility Report**: Is this possible? What are the challenges?
2. **Architecture Recommendation**: What's the best approach for state persistence?
3. **Audio Strategy**: How should audio be managed across pages?
4. **Implementation Plan**: Step-by-step guide with file changes
5. **Effort Estimate**: How long would this take to implement?
6. **Risk Assessment**: What could go wrong? What are the gotchas?

---

## 💡 Additional Context

### Recent Session Highlights (Nov 3, 2025)

**What We Just Built:**
- Profile and gallery video support
- Radio Pack edge case handling
- 20-second radio preview auto-stop (everywhere except Radio Widget)
- International radio expansion (Eritrea, Brasil, Bhutan, India)

**Current Audio Architecture:**
- Radio Widget: Plays indefinitely
- All preview contexts: 20-second auto-stop
- No global audio manager currently exists
- Each page manages its own audio elements

### Why This Matters

Creator Stores are becoming content-rich hubs. Having widgets available would:
- Improve UX by allowing users to build playlists while browsing stores
- Enable listening to radio while shopping
- Allow quick remixing of store content
- Reduce friction in user workflow

But it needs to be done right to avoid:
- Audio chaos
- Performance issues
- Confusing UX
- State management complexity

---

**Investigation Date:** Nov 4, 2025
**Requested By:** Sandy
**Session Context:** End of video/radio/sticker session, ready for next feature exploration

Good luck! 🚀
