# Interactive Tutorial Plan

## Overview
Quick interactive tutorial to demonstrate mixmi's core features. Duration: ~25-30 seconds.

## Tutorial Flow

### Phase 1: Widget Discovery (3-4 seconds)
- Animated cursor points to widget launcher buttons
- Click Mixer → mixer slides up (starts collapsed)
- Briefly point to other buttons (Playlist, Radio) but don't open them

### Phase 2: Globe Interaction (4-5 seconds)
- **Solution for spinning globe**: Pause the rotation temporarily during tutorial
- Pre-position a specific node (let's use a high-quality loop) in view
- Cursor hovers → card launches at center
- Show the card briefly with all its info visible

### Phase 3: Loading Decks (5-6 seconds)
- Drag card → left deck (deck A)
- Card animates into deck, shows waveform
- Click another pre-positioned node nearby
- Drag that card → right deck (deck B)
- **No audio plays** - just visual feedback

### Phase 4: Mixing Demo (3-4 seconds)
- Click SYNC button (visual highlight)
- Click PLAY on both decks (waveforms animate)
- Crossfader moves left → center → right (smooth animation)
- Maybe show the volume faders moving slightly?

### Phase 5: Crate Workflow (4-5 seconds)
- Drag loop from deck A → Crate
- Crate highlights and accepts it
- Brief pause to show it's saved

### Phase 6: Advanced Features (5-6 seconds)
- Click new node (pre-positioned loop pack)
- Card launches
- Cursor points to "ℹ️ Info" button → click
- Modal expands showing loop pack with 4-6 loops
- Drag one loop from modal → Crate

### Phase 7: Shopping & Pro Mixer (2-3 seconds)
- Quick point at shopping cart icon (no click, just tooltip: "Purchase tracks")
- Point at "PRO MIX" button with tooltip: "Advanced mixer controls"

### End State
- Everything closes/resets
- "Take a Tour" button fades in (or "Replay Tour")

## Technical Implementation Notes

### Globe Control
- Temporarily set `enableZoom={false}` and pause auto-rotation during tutorial
- Pre-position nodes at exact lat/lng coordinates for 3 specific tracks

### Audio Handling
- Set a `isTutorialMode` flag that prevents audio playback
- Show visual feedback only (waveforms, buttons, animations)

### Animation Timing
- Use 300-400ms transitions between steps
- Total runtime: ~25-30 seconds
- Fast enough to hold attention, slow enough to comprehend

### Cursor Animation
- Custom SVG cursor that follows a predefined path
- Smooth transitions between UI elements

## Content Requirements

### Pre-positioned Nodes Needed
1. **Node 1**: High-quality loop (Phase 2 & 3)
   - Should be visually appealing
   - Clean metadata
   - Compatible BPM with Node 2

2. **Node 2**: Compatible loop (Phase 3)
   - Must be positioned near Node 1 on globe
   - Same or compatible BPM for SYNC demo
   - Different enough to show mixing

3. **Node 3**: Loop pack (Phase 6)
   - Should contain 4-6 loops
   - Good metadata and descriptions
   - Position near Nodes 1 & 2 for smooth tutorial flow

### Geographic Positioning Strategy
To keep nodes close together for smooth tutorial flow, consider:
- Uploading content from same/nearby locations
- Or: Using metadata to cluster content geographically
- Ideal: All three nodes within same hemisphere/region

## Open Questions

1. **Pacing**: Does 25-30 seconds feel right, or faster (20s) or slower (40s)?
2. **Skip button**: Should users be able to skip at any time, or let it play through?
3. **Replay**: After it finishes, show "Replay Tour" button or just hide it?
4. **First-time only**: Should this auto-play on first visit, or always require clicking "Take a Tour"?
5. **Search feature**: Should we actually type something and show a result, or just point to it?

## Related Tasks

- [ ] Upload strategic content with proper geographic positioning
- [ ] Create tutorial video for welcome page
- [ ] Implement tutorial mode with cursor animations
- [ ] Add "Take a Tour" button that appears after tagline animation
- [ ] Build tutorial state management (pause globe, prevent audio, etc.)

## Branch
Work will be done on `feature/interactive-tutorial` branch.

## Timeline
Implementation planned for a couple days from now, after content preparation is complete.
