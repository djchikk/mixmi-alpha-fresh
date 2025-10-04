# Audio Widgets Implementation Guide

This document details the implementation of the Radio Widget and Playlist Widget for the Mixmi application.

---

## 1. Radio Widget Implementation

### Overview
A draggable, collapsible radio player that fetches random tracks from Supabase and plays them continuously with visual feedback.

### File Created
- `/components/RadioWidget.tsx`

### Key Features
1. **Draggable widget** - Can be repositioned anywhere on screen
2. **Collapsible UI** - Expands/collapses between 240px (collapsed) and 320px (expanded) width
3. **Continuous playback** - Auto-fetches and plays next track when current ends
4. **VU Meters** - 5-bar audio level visualization in header
5. **Audio coordination** - Auto-pauses when Mixer plays (via global events)
6. **Glassmorphic styling** - `bg-slate-900/30 backdrop-blur-sm`
7. **Brand color accents** - `#81E4F2` for active states
8. **Drag-to-crate/cart** - Tracks can be dragged to Mixer crates or shopping cart

### Implementation Details

#### Positioning (Globe Page)
```tsx
// In /app/page.tsx (line ~775)
<div className="fixed bottom-20 right-6 z-30">
  <RadioWidget />
</div>
```

#### Audio Coordination
```tsx
// Radio dispatches event when playing starts
if (typeof window !== 'undefined') {
  window.dispatchEvent(new CustomEvent('audioSourcePlaying', {
    detail: { source: 'radio' }
  }));
}

// Radio listens for other audio sources
useEffect(() => {
  const handleOtherAudioPlaying = (e: CustomEvent) => {
    if (e.detail.source !== 'radio' && isPlaying) {
      setIsPlaying(false);
      audioRef.current?.pause();
    }
  };
  window.addEventListener('audioSourcePlaying' as any, handleOtherAudioPlaying);
  return () => window.removeEventListener('audioSourcePlaying' as any, handleOtherAudioPlaying);
}, [isPlaying]);
```

#### VU Meters (Simulated)
```tsx
// Lines 203-224 in RadioWidget.tsx
const updateAudioLevel = () => {
  if (!isPlaying) {
    setAudioLevel(0);
    return;
  }
  setAudioLevel(0.3 + Math.random() * 0.4);
  animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
};
```

#### Continuous Playback
```tsx
// Line 160-164
const handleTrackEnd = () => {
  console.log('🎵 Radio: Track ended, fetching next track...');
  shouldAutoPlayRef.current = true; // Key: auto-play next track
  fetchRandomTrack();
};
```

#### Drag-and-Drop Support
```tsx
const [{ isDragging }, drag] = useDrag({
  type: 'RADIO_TRACK',
  item: () => ({ ...currentTrack }),
  collect: (monitor) => ({ isDragging: !!monitor.isDragging() })
});
```

### Styling Notes
- Header: `mb-0` (no margin to maximize space)
- VU meters: `bg-gray-300` when active, `bg-gray-700/50` when inactive
- Play button (inactive): `border-2 border-slate-600 text-slate-400 hover:border-[#81E4F2]`
- Play button (active/paused): `bg-[#81E4F2]/20 hover:bg-[#81E4F2]/30` with cyan pause icon
- Ticker text: `text-gray-200`
- Volume slider thumb: `bg-gray-300`
- Collapsed width: `240px` (increased from 200px to prevent chevron overlap)

### Cart Integration
```tsx
// Uses global window.addToCart function
onClick={() => {
  if (typeof window !== 'undefined' && (window as any).addToCart) {
    (window as any).addToCart(currentTrack);
  }
}}
```

---

## 2. Playlist Widget Implementation

### Overview
A draggable, collapsible playlist player that accepts tracks from multiple sources and plays them sequentially with smart preview logic.

### File Created
- `/components/PlaylistWidget.tsx`

### Key Features
1. **Multi-source drag acceptance** - Accepts tracks from Globe cards, Mixer, Crate, Radio, and Search results
2. **Smart playback** - Full length for loops, 20-second preview for full songs
3. **Track reordering** - Drag tracks within playlist to reposition
4. **localStorage persistence** - Playlist survives page refreshes
5. **Auto-pause coordination** - Pauses when Radio or Mixer plays
6. **Same styling as Radio** - Glassmorphic design, VU meters, brand colors
7. **Empty state UI** - Shows "Drag tracks here" when empty

### Implementation Details

#### Positioning (Globe Page)
```tsx
// In /app/page.tsx (line ~780)
<PlaylistWidget />
// Widget positions itself in lower-left via internal state:
// { x: 20, y: window.innerHeight - 220 }
```

#### Drag-Drop Acceptance
```tsx
const [{ isOver }, drop] = useDrop({
  accept: ['TRACK', 'GLOBE_CARD', 'CRATE_TRACK', 'RADIO_TRACK'],
  drop: (item: any) => {
    const track: PlaylistTrack = {
      id: item.id || item.track?.id,
      title: item.title || item.track?.title,
      artist: item.artist || item.artist_name || item.track?.artist,
      imageUrl: item.imageUrl || item.cover_image_url || item.track?.imageUrl,
      audioUrl: item.audioUrl || item.audio_url || item.track?.audioUrl,
      bpm: item.bpm || item.track?.bpm,
      content_type: item.content_type || item.track?.content_type || 'loop',
      // ... other fields
    };

    // Add to TOP of playlist
    setPlaylist(prev => {
      if (prev.some(t => t.id === track.id)) return prev; // Avoid duplicates
      return [track, ...prev];
    });
  },
  collect: (monitor) => ({ isOver: !!monitor.isOver() })
});
```

#### Smart Playback Logic
```tsx
// For full songs, limit to 20 seconds
useEffect(() => {
  const audio = audioRef.current;
  if (!audio || !isPlaying || currentIndex < 0) return;

  const track = playlist[currentIndex];

  if (track.content_type === 'full_song') {
    const timeUpdateHandler = () => {
      if (audio.currentTime >= 20) {
        console.log('🎵 Playlist: 20-second preview complete, moving to next');
        playNext();
      }
    };
    audio.addEventListener('timeupdate', timeUpdateHandler);
    return () => audio.removeEventListener('timeupdate', timeUpdateHandler);
  }
  // Loops play to completion (onEnded event)
}, [isPlaying, currentIndex, playlist]);
```

#### Track Reordering
```tsx
// Individual playlist items are draggable
const [{ isDragging }, drag] = useDrag({
  type: 'PLAYLIST_ITEM',
  item: { index },
  collect: (monitor) => ({ isDragging: !!monitor.isDragging() })
});

// Items accept other playlist items for reordering
const [, drop] = useDrop({
  accept: 'PLAYLIST_ITEM',
  hover: (item: { index: number }) => {
    if (item.index !== index) {
      moveTrack(item.index, index);
      item.index = index; // Update dragged item's index
    }
  }
});

// Combine drag and drop refs
<div ref={(node) => drag(drop(node))}>
```

#### localStorage Persistence
```tsx
// Load on mount
useEffect(() => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('playlist-widget');
    if (saved) {
      const data = JSON.parse(saved);
      setPlaylist(data.playlist || []);
      setCurrentIndex(data.currentIndex ?? -1);
    }
  }
}, []);

// Save on change
useEffect(() => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('playlist-widget', JSON.stringify({
      playlist,
      currentIndex
    }));
  }
}, [playlist, currentIndex]);
```

#### Audio Coordination
```tsx
// Same pattern as Radio Widget
useEffect(() => {
  const handleOtherAudioPlaying = (e: CustomEvent) => {
    if (e.detail.source !== 'playlist' && isPlaying) {
      setIsPlaying(false);
      audioRef.current?.pause();
    }
  };
  window.addEventListener('audioSourcePlaying' as any, handleOtherAudioPlaying);
  return () => window.removeEventListener('audioSourcePlaying' as any, handleOtherAudioPlaying);
}, [isPlaying]);

// Dispatch when playing
if (typeof window !== 'undefined') {
  window.dispatchEvent(new CustomEvent('audioSourcePlaying', {
    detail: { source: 'playlist' }
  }));
}
```

### Styling Notes
- Positioned lower-left: `x: 20, y: window.innerHeight - 220`
- Same dimensions as Radio: 240px collapsed, 320px expanded, 200px height
- Drop indicator: `border-[#81E4F2] shadow-[#81E4F2]/50` when `isOver`
- Play button matches Radio styling exactly
- Track items: `bg-slate-800/30 hover:bg-slate-800/50`
- Current track indicator: `ring-1 ring-[#81E4F2]`
- Shows "Full loop" or "20s preview" based on `content_type`

---

## 3. Mixer Integration (SimplifiedMixerCompact)

### Audio Coordination Added
The Tiny Mixer needed to dispatch audio events to coordinate with Radio and Playlist.

**File Modified:** `/components/mixer/compact/SimplifiedMixerCompact.tsx`

#### Changes Made

**Deck A Play (line ~362-365):**
```tsx
} else {
  // Notify other audio sources to pause
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('audioSourcePlaying', {
      detail: { source: 'mixer' }
    }));
  }
  await audioControls.play();
```

**Deck B Play (line ~386-389):**
```tsx
} else {
  // Notify other audio sources to pause
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('audioSourcePlaying', {
      detail: { source: 'mixer' }
    }));
  }
  await audioControls.play();
```

---

## 4. Master Transport Controls Styling

### File Modified
`/components/mixer/compact/MasterTransportControlsCompact.tsx`

### Changes Made
Updated pause button to have subtle styling matching Radio Widget:

**Line 133-134:**
```tsx
className={`master-play-btn w-10 h-10 rounded-full flex items-center justify-center text-base font-bold transition-all ${
  anyPlaying
    ? 'bg-[#81E4F2]/20 hover:bg-[#81E4F2]/30'  // Subtle pause state
    : countingIn
```

**Line 152:**
```tsx
<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="text-[#81E4F2]">
  {/* Cyan pause icon */}
</svg>
```

---

## 5. Brand Color Updates

### Global Color Scheme
- Brand accent: `#81E4F2` (cyan)
- Replaced all `cyan-400` with `#81E4F2`
- Non-interactive elements: Gray scale (gray-200, gray-300, gray-400, etc.)

### Elements Updated
- Radio icon (active state)
- Play/pause buttons (hover and active states)
- VU meters (active bars)
- Volume slider thumb
- SYNC button background
- Border highlights on hover

---

## 6. Git Branches & Commits

### Radio Widget
- **Branch:** `feature/radio-widget-enhancements` (merged to main)
- **Commit:** "feat: Polish Radio Widget styling and functionality"
- Includes: VU meter colors, continuous play, collapsed spacing, ticker text, cart tooltip

### Playlist Widget
- **Branch:** `feature/playlist-widget` (pushed, not merged yet)
- **Commit:** "feat: Add Playlist Widget with advanced playback features"
- Includes: Full playlist implementation with all features

---

## 7. Testing Checklist

### Radio Widget
- [ ] Widget appears in lower-right corner
- [ ] Draggable to reposition
- [ ] Collapses/expands on chevron click
- [ ] Fetches random tracks on play
- [ ] Auto-plays next track when current ends
- [ ] VU meters animate during playback
- [ ] Pauses when Mixer plays
- [ ] Can drag track to crate (shows A/B buttons)
- [ ] Can click cart icon to add to cart
- [ ] Volume slider works
- [ ] Collapsed state shows play button without overlap

### Playlist Widget
- [ ] Widget appears in lower-left corner
- [ ] Draggable to reposition
- [ ] Accepts drops from Globe cards
- [ ] Accepts drops from Mixer decks
- [ ] Accepts drops from Crate
- [ ] Accepts drops from Radio
- [ ] Accepts drops from Search results
- [ ] Tracks can be reordered by dragging
- [ ] Loops play full length
- [ ] Songs preview for 20 seconds then advance
- [ ] Playlist persists after page refresh
- [ ] Pauses when Radio or Mixer plays
- [ ] Empty state shows "Drag tracks here"
- [ ] VU meters work
- [ ] Volume slider works
- [ ] Shows "Full loop" or "20s preview" for each track

### Audio Coordination
- [ ] Playing Radio pauses Mixer
- [ ] Playing Mixer pauses Radio
- [ ] Playing Playlist pauses Radio and Mixer
- [ ] Only one audio source plays at a time

---

## 8. Known Issues & Future Enhancements

### Current Limitations
1. **Web Audio API VU Meters** - Currently disabled (using simulated VU meters)
   - Issue: `createMediaElementSource` can only be called once per audio element
   - Fix needed: Proper audio routing architecture
   - TODO marker in RadioWidget.tsx line 203

2. **Day Pass Feature** - Not yet implemented for Playlist
   - Full songs limited to 20s preview
   - Future: Purchase day pass to unlock full playback

### Future Enhancements
1. Re-enable Web Audio API VU meters with proper routing
2. Add day pass purchase modal for playlist
3. Add playlist export/share functionality
4. Add track removal by clicking X button
5. Add clear playlist button
6. Add shuffle/repeat modes

---

## 9. Dependencies

### React DnD (Drag and Drop)
```tsx
import { useDrag, useDrop } from 'react-dnd';
```

Both widgets use react-dnd for drag-and-drop functionality. Ensure DnD provider is wrapped around the app (already configured).

### Icons
```tsx
import { Radio, ChevronDown, ChevronUp, X, GripVertical, ListMusic } from 'lucide-react';
```

### Next.js Image
```tsx
import Image from 'next/image';
```

---

## 10. File Structure Summary

```
/components
  ├── RadioWidget.tsx                    [NEW - Radio player widget]
  ├── PlaylistWidget.tsx                 [NEW - Playlist player widget]
  └── mixer/
      └── compact/
          ├── SimplifiedMixerCompact.tsx [MODIFIED - Added audio events]
          └── MasterTransportControlsCompact.tsx [MODIFIED - Styling update]

/app
  └── page.tsx                           [MODIFIED - Added Radio & Playlist widgets]
```

---

## 11. Quick Start (Fresh Environment)

```bash
# 1. Clone from GitHub
git clone <repo-url>
cd mixmi-alpha-fresh-7

# 2. Install dependencies
npm install

# 3. Checkout playlist feature branch
git checkout feature/playlist-widget

# 4. Start dev server
npm run dev

# 5. Open http://localhost:3001
```

Both widgets should appear automatically on the Globe page.

---

## 12. Troubleshooting

### Widget Not Appearing
- Check console for errors
- Ensure DnD provider is active
- Verify widget is imported in page.tsx

### Audio Not Playing
- Check browser console for CORS errors
- Verify audio URLs are valid
- Check browser autoplay policy

### Drag-Drop Not Working
- Verify item types match accept types
- Check DnDProvider wrapper
- Ensure drag/drop refs are properly attached

### Build Errors
- Clear `.next` cache: `rm -rf .next`
- Clear node_modules: `rm -rf node_modules && npm install`
- Check for TypeScript errors

---

## Contact & Support

- **GitHub Repository:** Check feature branches for latest code
- **Radio Widget Branch:** `feature/radio-widget-enhancements` (merged to main)
- **Playlist Widget Branch:** `feature/playlist-widget` (active development)

All code is committed and pushed to GitHub for safe recovery.
