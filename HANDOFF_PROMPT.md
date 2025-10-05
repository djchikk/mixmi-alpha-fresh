# Handoff Prompt for New Claude Code Teammate

## Quick Context
You're joining a project where we've built Radio Widget and Playlist Widget for a music mixing app. The previous Claude Code instance hit environment issues, so we're starting fresh from a clean clone.

## What's Already Done ✅
1. **Radio Widget** - Fully working, merged to main
2. **Playlist Widget** - Fully coded, on branch `feature/playlist-widget`
3. **Implementation Guide** - Complete documentation in `AUDIO_WIDGETS_IMPLEMENTATION.md`
4. **All code pushed to GitHub** - Safe and ready to use

## Your First Tasks 🎯

### 1. Get the Environment Running
```bash
# You should already be in the fresh project folder
git checkout feature/playlist-widget
npm install
npm run dev
```

### 2. Verify Both Widgets Load
- Open http://localhost:3001
- Look for **Radio Widget** in lower-right corner
- Look for **Playlist Widget** in lower-left corner
- Both should be draggable and collapsible

### 3. Test Core Functionality
- **Radio**: Click play, should fetch and play random tracks continuously
- **Playlist**: Drag a track from Globe onto it, should add to queue
- **Audio Coordination**: Playing one should pause the other

## If Widgets Don't Appear

**Check 1:** Are they in page.tsx?
```tsx
// Around line 780
<PlaylistWidget />

// Around line 783-785
<div className="fixed bottom-20 right-6 z-30">
  <RadioWidget />
</div>
```

**Check 2:** Are the files there?
- `/components/RadioWidget.tsx` ✓
- `/components/PlaylistWidget.tsx` ✓

**Check 3:** Any console errors?
- Open browser DevTools
- Look for import errors or DnD provider issues

## Key Architecture Points

### Audio Coordination
All three audio sources (Radio, Playlist, Mixer) use a global event system:
```tsx
// When playing starts
window.dispatchEvent(new CustomEvent('audioSourcePlaying', {
  detail: { source: 'radio' } // or 'playlist' or 'mixer'
}));

// Each listens for others
window.addEventListener('audioSourcePlaying', handleOtherAudioPlaying);
```

### Drag-Drop Types
```tsx
// Radio Widget
type: 'RADIO_TRACK'

// Playlist accepts
accept: ['TRACK', 'GLOBE_CARD', 'CRATE_TRACK', 'RADIO_TRACK']

// Playlist items (for reordering)
type: 'PLAYLIST_ITEM'
```

### Smart Playback (Playlist Only)
```tsx
if (track.content_type === 'full_song') {
  // Limit to 20 seconds preview
  if (audio.currentTime >= 20) playNext();
} else {
  // Loops play full length until 'ended' event
}
```

## What We Were Working On

The widgets are **feature-complete** but haven't been tested in a clean environment yet. The previous instance hit build cache corruption after multiple cache clears.

## Next Steps After Verification

If everything loads correctly:
1. Test all drag-drop sources (Globe, Mixer, Crate, Search)
2. Test playlist reordering
3. Test audio coordination between all sources
4. If all works → merge `feature/playlist-widget` to main
5. If issues → debug using implementation guide

## Resources

1. **Full Implementation Guide**: `AUDIO_WIDGETS_IMPLEMENTATION.md`
   - Complete code examples
   - Line-by-line explanations
   - Troubleshooting guide

2. **Previous Teammate's Context**: Available in the previous chat
   - Design decisions
   - Styling rationale
   - Why certain approaches were chosen

3. **GitHub Branches**:
   - `main` - Has Radio Widget working
   - `feature/playlist-widget` - Has both widgets + implementation doc

## Communication Style

The user (Sandy) prefers:
- **Concise responses** - Get to the point
- **Show, don't explain** - Code changes over lengthy explanations
- **Proactive problem-solving** - Fix issues as you find them
- **Collaborative approach** - "Let's try X" rather than "You should do X"

## Important Notes

⚠️ **Do NOT**:
- Create new implementations from scratch (code already exists!)
- Modify working Radio Widget unless specifically asked
- Push directly to main (use feature branch workflow)

✅ **Do**:
- Use the existing code in `feature/playlist-widget` branch
- Read `AUDIO_WIDGETS_IMPLEMENTATION.md` for detailed context
- Test thoroughly before merging
- Ask Sandy for clarification if anything is unclear

## Success Criteria

You'll know you're successful when:
1. ✅ Dev server runs without errors
2. ✅ Both widgets appear on Globe page
3. ✅ Radio plays random tracks continuously
4. ✅ Playlist accepts drops from all sources
5. ✅ Tracks can be reordered in playlist
6. ✅ Loops play full length, songs preview 20 seconds
7. ✅ Only one audio source plays at a time
8. ✅ All features work as documented

---

**Welcome to the team! The groundwork is all done - you're here to verify and polish. You've got this! 🚀**

---

## Quick Reference Commands

```bash
# Check current branch
git branch

# Switch to playlist branch
git checkout feature/playlist-widget

# See what's changed
git status
git diff main

# If you need to start completely fresh
rm -rf node_modules .next
npm install
npm run dev

# Kill stuck dev servers
lsof -ti:3001 | xargs kill -9
```

## Emergency Contacts

- **Previous teammate**: Available in previous chat for deep context
- **Implementation docs**: `AUDIO_WIDGETS_IMPLEMENTATION.md`
- **User**: Sandy (available for questions and testing)

Good luck! 🎵
