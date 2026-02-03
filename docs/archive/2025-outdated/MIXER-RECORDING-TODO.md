# Mixer Recording Feature - Improvements Needed

## Issues to Fix

### 1. Recording Start Timing Issue ⏱️
**Problem:** Mixer stutters when first starting, missing the downbeat of the first 8 bars
- This causes timing offset throughout the entire recording
- Makes precise 8-bar loop selection difficult

**Potential Solutions:**
- [ ] Add a count-in before recording starts (4 beats?)
- [ ] Start recording after mixer has stabilized (detect when audio is flowing smoothly)
- [ ] Pre-roll the mixer playback before hitting record
- [ ] Visual metronome countdown before recording begins

### 2. Selection Quantization Too Coarse 🎯
**Problem:** Current quantization is 1 bar, but we need finer control
- Users need to find the exact downbeat by trial and error
- 1-bar quantization is too large for precise alignment

**Solution:**
- [ ] Change quantization from 1 bar to 1 beat (quarter of a bar)
- [ ] This gives 4x more precision for finding the downbeat
- [ ] Update drag handles to snap to beats instead of bars
- [ ] Update UI labels to show beat positions (e.g., "Bar 3, Beat 2")

### 3. Payment Modal - Wallet Not Launching 💳
**Problem:** "Pay to Stacks" button in PaymentModal doesn't trigger wallet popup

**Investigation Needed:**
- [ ] Check if `openContractCall` is being invoked
- [ ] Verify contract parameters are correct
- [ ] Check console for errors
- [ ] Ensure PostConditionMode.Allow is set
- [ ] Verify contract address and function name

## What's Working Well ✅

- Interface design is really good
- Waveform visualization is clear
- Zoom controls work well
- Loop preview functionality
- Selection bracket is intuitive
- Modal design is fantastic

## Next Steps

1. Fix recording start timing (add count-in or pre-roll)
2. Change quantization to 1 beat (4x more precise)
3. Debug payment modal wallet popup issue
4. Test smart contract integration

---

**Priority:** Fix items 1 & 2 for better UX, then tackle item 3 for payment flow
