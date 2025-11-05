# Web Audio API + MediaRecorder GRAB Feature - Solution

## Problem Summary

The original implementation attempted to create a rolling buffer using MediaRecorder with timeslice recording (`recorder.start(500)`). The chunks were being stored in a rolling array, but when merged into a Blob, the audio failed to play with the error: `DEMUXER_ERROR_COULD_NOT_OPEN: FFmpegDemuxer: open context failed`.

## Root Cause

**WebM chunks recorded with timeslice are not independently playable fragments.** When you call `recorder.start(500)`, each 500ms chunk is a **continuation fragment** that depends on:

1. The **initialization segment** from the first chunk
2. The proper sequence of chunks from the start of the recording session

When you shift older chunks out of the array to maintain a rolling buffer, you're discarding the critical initialization segment and creating an incomplete WebM file that the browser's demuxer cannot parse.

## The Fix

### Approach 1: Continuous Recording (Implemented)

Record continuously from when the radio starts, then grab the entire recording when the user clicks GRAB.

**Changes Made:**

1. **Removed timeslice parameter**: Changed from `recorder.start(500)` to `recorder.start()`
2. **Capture entire recording**: Keep all chunks from start to GRAB
3. **Preserve initialization segment**: The first chunk contains the WebM initialization data needed to decode subsequent chunks
4. **Added destination node cleanup**: Disconnect the recording tap after GRAB to avoid feedback

**Key Code Changes:**

```typescript
// OLD (BROKEN):
recorder.start(500); // Record in 500ms chunks
recorder.ondataavailable = (e) => {
  if (e.data.size > 0) {
    chunks.current.push(e.data);
    if (chunks.current.length > 20) {
      chunks.current.shift(); // BREAKS INITIALIZATION SEGMENT!
    }
  }
};

// NEW (WORKING):
recorder.start(); // Continuous recording
recorder.ondataavailable = (e) => {
  if (e.data.size > 0) {
    chunks.current.push(e.data); // Keep ALL chunks
  }
};
```

**Pros:**
- Simple and reliable
- Complete WebM file with proper headers
- No complex buffering logic
- Guaranteed to work across all browsers

**Cons:**
- Captures entire session since radio started, not just last 10 seconds
- Memory usage grows with recording duration
- First GRAB captures everything, subsequent GRABs need new recording session

---

### Approach 2: Periodic Recording Restarts (Optional Enhancement)

To truly capture only the last ~10 seconds, restart the recording every 10 seconds, discarding the previous session.

**Implementation:**

```typescript
const MAX_RECORDING_DURATION = 10000; // 10 seconds
const recordingTimerRef = React.useRef<NodeJS.Timeout | null>(null);

const startRecording = (deck: 'A' | 'B') => {
  // ... existing setup code ...

  recorder.start();

  // Auto-restart recording every 10 seconds to keep only recent audio
  const restartRecording = () => {
    if (recorder.state === 'recording') {
      recorder.stop();

      recorder.addEventListener('stop', () => {
        // Clear old chunks and start fresh
        chunks.current = [];
        recorder.start();

        // Schedule next restart
        if (deck === 'A') {
          recordingTimerRef.current = setTimeout(restartRecording, MAX_RECORDING_DURATION);
        }
      }, { once: true });
    }
  };

  // Schedule first restart
  if (deck === 'A') {
    recordingTimerRef.current = setTimeout(restartRecording, MAX_RECORDING_DURATION);
  }
};

// Don't forget to cleanup on unmount:
useEffect(() => {
  return () => {
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
    }
  };
}, []);
```

**Pros:**
- Captures only last 10 seconds
- Bounded memory usage
- Still maintains proper WebM structure

**Cons:**
- More complex logic
- Slight audio gap during restart
- User must wait up to 10 seconds after loading radio before GRAB works

---

### Approach 3: AudioWorklet + Manual Buffering (Advanced)

For production-grade "last 10 seconds" capture with no gaps, use AudioWorklet to manually buffer PCM data.

**Implementation Overview:**

```typescript
// Create AudioWorklet that buffers samples
class RingBufferProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = sampleRate * 10; // 10 seconds
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.writeIndex] = channelData[i];
        this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
      }
    }
    return true;
  }
}
```

When GRAB is clicked:
1. Copy the ring buffer to a new Float32Array
2. Encode to WAV/WebM using OfflineAudioContext or a library like wav-encoder
3. Create Blob and load into deck

**Pros:**
- True "last 10 seconds" with no gaps
- Precise control over buffer
- No MediaRecorder limitations

**Cons:**
- Much more complex
- Requires encoding logic
- Higher CPU usage
- Need to manage AudioWorklet lifecycle

---

## Why Timeslice Doesn't Work for Rolling Buffers

MediaRecorder with timeslice creates **dependent chunks**:

```
Chunk 0: [Init Segment][Data]      <- Has WebM headers & initialization
Chunk 1: [Data]                     <- Continuation
Chunk 2: [Data]                     <- Continuation
...
```

When you create a Blob from chunks [1, 2, 3], the browser sees:
```
[Data][Data][Data]  <- Missing initialization segment!
```

The demuxer cannot parse this because it doesn't know:
- Codec information
- Sample rate
- Channel count
- Timestamp mapping

**Only Chunk 0 has this information**, so you must include it in any blob you create.

---

## Recommended Solution

For your use case (radio stream GRAB feature):

**Use Approach 1 (Continuous Recording) for MVP:**
- Simple, reliable, works everywhere
- Users understand they're grabbing "what they've heard so far"
- Can improve to Approach 2 later if needed

**Consider Approach 2 (Periodic Restarts) for enhancement:**
- Add 10-second rolling window
- Better memory management
- Still simple enough to maintain

**Only use Approach 3 if:**
- You need sample-accurate timing
- You're building a professional audio tool
- You have time to handle edge cases and browser compatibility

---

## Testing the Fix

1. Load a radio station to a deck
2. Wait a few seconds for audio to record
3. Click GRAB
4. Verify the grabbed audio loads and plays correctly
5. Check console for blob size and chunk count

Expected console output:
```
🎙️ Started continuous recording Deck A for GRAB feature
🎙️ First chunk recorded for A: 12345 bytes, type: audio/webm;codecs=opus
🎯 GRAB triggered for Deck A!
📦 Have 1 chunks to merge (total recording)
📦 Created audio blob: 456789 bytes, 1 chunks
📦 Blob type: audio/webm;codecs=opus
✅ GRAB complete! Deck A now playing grabbed radio loop!
```

---

## Alternative Container Formats

If WebM continues to cause issues, you can try:

1. **WAV encoding**: Most compatible, but larger files
2. **Ogg Vorbis**: Good browser support
3. **MP4**: Requires H.264 support

Change the MIME type priority:
```typescript
const types = [
  'audio/mp4',               // Try MP4 first
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm'
];
```

---

## Files Modified

- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-10/components/mixer/UniversalMixer.tsx`
  - Added destination node refs for cleanup
  - Changed `recorder.start(500)` to `recorder.start()`
  - Removed rolling buffer logic (shift)
  - Added proper disconnection after GRAB
  - Improved error handling and logging

---

## Further Reading

- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [WebM Container Format](https://www.webmproject.org/docs/container/)
- [AudioWorklet Guide](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
