# mixmi Alpha - Mixer Architecture Deep Dive

**Skill Purpose:** Complete technical reference for the professional mixer system architecture, audio routing, recording implementation, and all internal mechanics

**Last Updated:** October 26, 2025

---

## Overview

The mixmi Alpha professional mixer (`/mixer` page) is a dual-deck DJ interface built with:
- **Tone.js** for professional audio processing and effects
- **Web Audio API** for low-level audio routing
- **MediaRecorder API** for live mix recording
- **React Context** (MixerContext) for global state
- **Canvas API** for waveform visualization
- **requestAnimationFrame** for smooth playhead updates

**File:** `components/mixer/SimplifiedMixer.tsx` (68KB, 1800+ lines)

---

## Architecture Principles

### Design Philosophy

1. **Professional Audio Quality:** No quality loss, proper gain staging, clean signal flow
2. **Real-time Performance:** 60fps waveform updates, instant FX response
3. **Memory Safety:** Proper cleanup, no leaks, stable for extended sessions
4. **Modular Design:** Decks, FX, controls are independent, reusable components

### Key Constraints

- **Loop-only content:** Mixer accepts 8-bar loops only (no songs/EPs)
- **BPM range:** 60-200 BPM supported
- **Sync locked:** When sync enabled, both decks match master BPM
- **Fixed loop lengths:** 2, 4, 8, 16 bars only

---

## State Management

### SimplifiedMixerState Structure

```typescript
interface SimplifiedMixerState {
  deckA: DeckState;
  deckB: DeckState;
  masterBPM: number;              // Global tempo (default 120)
  crossfaderPosition: number;     // 0-100 (0=A only, 50=center, 100=B only)
  syncActive: boolean;            // Master sync on/off
}

interface DeckState {
  track: Track | null;            // Currently loaded track
  playing: boolean;               // Playback state
  audioState?: any;               // Tone.js player state
  audioControls?: any;            // Playback controls
  loading?: boolean;              // Track loading indicator
  loopEnabled: boolean;           // Loop on/off (default true)
  loopLength: number;             // 2, 4, 8, 16 bars
  loopPosition: number;           // Which loop section (0, 1, 2...)
  boostLevel: number;             // 0=off, 1=gentle (cyan), 2=aggressive (orange)
}
```

**State Persistence:**
- MixerContext provides global state accessible across pages
- localStorage backing for track collection
- Deck states reset on page refresh (intentional - fresh session each time)

---

## Audio Signal Flow

### Complete Routing Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         DECK A                                  │
│                                                                 │
│  Audio File (track.audioUrl)                                   │
│         ↓                                                       │
│  Tone.Player (playback, loop control)                          │
│         ↓                                                       │
│  Filter (lowpass 20kHz, adjustable cutoff)                     │
│         ↓                                                       │
│  Reverb (decay 2.0s, wet/dry mix)                              │
│         ↓                                                       │
│  Delay (8th note feedback, adjustable)                         │
│         ↓                                                       │
│  Deck Gain (volume control, boost levels)                      │
│         ↓                                                       │
└─────────┼───────────────────────────────────────────────────────┘
          │
          ├─────────────→ Crossfader (mixing)
          │                     ↓
┌─────────┼───────────────────────────────────────────────────────┐
│         ↓                                                       │
│  Deck Gain (volume control, boost levels)                      │
│         ↑                                                       │
│  Delay (8th note feedback, adjustable)                         │
│         ↑                                                       │
│  Reverb (decay 2.0s, wet/dry mix)                              │
│         ↑                                                       │
│  Filter (lowpass 20kHz, adjustable cutoff)                     │
│         ↑                                                       │
│  Tone.Player (playback, loop control)                          │
│         ↑                                                       │
│  Audio File (track.audioUrl)                                   │
│                                                                 │
│                         DECK B                                  │
└─────────────────────────────────────────────────────────────────┘
                          ↓
                   Master Gain
                          ↓
              AudioContext Destination (speakers)
                          ↓
         MediaStreamAudioDestinationNode (recording)
                          ↓
                  MediaRecorder
                          ↓
                  Recorded Blob (MP3)
```

### Signal Flow Details

**Per-Deck Chain:**
1. **Tone.Player:** Loads audio, handles playback rate (for BPM sync), loop points
2. **Filter:** Tone.Filter (lowpass), default 20kHz (wide open), FX control adjusts cutoff
3. **Reverb:** Tone.Reverb, 2.0s decay, wet/dry mix controlled by FX knob
4. **Delay:** Tone.FeedbackDelay, 8th note timing (synced to BPM), feedback adjustable
5. **Deck Gain:** Tone.Gain, controls volume + boost (gentle: 1.2x, aggressive: 1.5x)

**Crossfader Mixing:**
```typescript
const crossfaderGainA = (100 - crossfaderPosition) / 100;
const crossfaderGainB = crossfaderPosition / 100;

// Position 0:   A=1.0, B=0.0 (A only)
// Position 50:  A=0.5, B=0.5 (center)
// Position 100: A=0.0, B=1.0 (B only)
```

**Master Output:**
- Master gain node (overall volume)
- Splits to:
  - AudioContext.destination (speakers)
  - MediaStreamAudioDestinationNode (recording capture point)

---

## Audio Implementation Details

### Tone.js Integration

**Initialization:**
```typescript
import * as Tone from 'tone';

// Start audio context on user interaction (browser requirement)
const startAudio = async () => {
  await Tone.start();
  console.log('Audio context started');
};

// Create audio chain for deck
const createDeckAudioChain = (audioUrl: string) => {
  const player = new Tone.Player(audioUrl).toDestination();
  const filter = new Tone.Filter(20000, 'lowpass');
  const reverb = new Tone.Reverb(2.0);
  const delay = new Tone.FeedbackDelay('8n', 0.5);
  const gain = new Tone.Gain(1.0);

  player
    .connect(filter)
    .connect(reverb)
    .connect(delay)
    .connect(gain)
    .connect(crossfaderGain);

  return { player, filter, reverb, delay, gain };
};
```

**Playback Control:**
```typescript
// Play/pause
if (playing) {
  player.start();
} else {
  player.stop();
}

// Loop configuration
player.loop = true;
player.loopStart = loopPosition * loopDuration;
player.loopEnd = (loopPosition + 1) * loopDuration;

// BPM sync (adjust playback rate)
const ratio = masterBPM / track.bpm;
player.playbackRate = ratio;
```

---

### Loop Implementation

**Loop Timing Calculation:**
```typescript
// Calculate loop duration based on BPM and bar count
const beatsPerLoop = loopLength * 4;  // 4 beats per bar
const secondsPerBeat = 60 / bpm;
const loopDuration = beatsPerBeat * beatsPerLoop;

// Example: 8-bar loop at 120 BPM
// beatsPerLoop = 8 * 4 = 32 beats
// secondsPerBeat = 60 / 120 = 0.5 seconds
// loopDuration = 0.5 * 32 = 16 seconds
```

**Loop Position Control:**
```typescript
// Loop position = which 8-bar section to play
const setLoopPosition = (position: number) => {
  const startTime = position * loopDuration;
  const endTime = (position + 1) * loopDuration;

  player.loopStart = startTime;
  player.loopEnd = endTime;

  // If playing, seek to new position
  if (player.state === 'started') {
    player.seek(startTime);
  }
};

// Loop length selector (2, 4, 8, 16 bars)
const setLoopLength = (bars: number) => {
  const newDuration = (60 / bpm) * 4 * bars;
  player.loopEnd = player.loopStart + newDuration;
};
```

---

### BPM Sync Engine

**File:** `lib/mixerAudio.ts` - `SimpleLoopSync` class

**Core Logic:**
```typescript
class SimpleLoopSync {
  private masterBPM: number = 120;
  private deckAPlayer: Tone.Player | null = null;
  private deckBPlayer: Tone.Player | null = null;

  setMasterBPM(bpm: number) {
    this.masterBPM = bpm;
    this.syncAllDecks();
  }

  syncDeck(player: Tone.Player, originalBPM: number) {
    const ratio = this.masterBPM / originalBPM;
    player.playbackRate = ratio;
  }

  syncAllDecks() {
    if (this.deckAPlayer && deckATrack) {
      this.syncDeck(this.deckAPlayer, deckATrack.bpm);
    }
    if (this.deckBPlayer && deckBTrack) {
      this.syncDeck(this.deckBPlayer, deckBTrack.bpm);
    }
  }

  // Master BPM increment/decrement
  incrementBPM() {
    this.setMasterBPM(this.masterBPM + 1);
  }

  decrementBPM() {
    this.setMasterBPM(this.masterBPM - 1);
  }
}
```

**Sync Behavior:**
- When sync enabled: Both decks match master BPM via playback rate adjustment
- When sync disabled: Each deck plays at its original BPM
- Master BPM changes: Immediately updates both decks when synced
- Track load: If sync active, new track auto-syncs to master BPM

**Important Fix (Oct 23, 2025):**
```typescript
// BEFORE: Sync engine didn't update when master BPM changed via increment/decrement
handleBPMIncrement() {
  setMasterBPM(prev => prev + 1);
  // ❌ Sync engine not notified!
}

// AFTER: Proper sync engine notification
handleBPMIncrement() {
  const newBPM = masterBPM + 1;
  setMasterBPM(newBPM);
  syncEngine.setMasterBPM(newBPM);  // ✅ Sync engine updates both decks
}
```

---

## Effects (FX) Architecture

### FX Chain Structure

**Per-Deck FX:**
```typescript
interface DeckFX {
  filter: Tone.Filter;       // Lowpass filter (cutoff adjustable)
  reverb: Tone.Reverb;       // Reverb (decay 2.0s, wet/dry mix)
  delay: Tone.FeedbackDelay; // Delay (8th note, feedback adjustable)
}
```

**FX Component:**
```typescript
// File: components/mixer/FXComponent.tsx
interface FXElement extends HTMLDivElement {
  audioInput?: GainNode;
  audioOutput?: GainNode;
  resetToDefaults?: () => void;
}

const FXComponent = React.forwardRef<FXElement>((props, ref) => {
  const [filterCutoff, setFilterCutoff] = useState(20000);  // Wide open
  const [reverbMix, setReverbMix] = useState(0);            // Dry
  const [delayFeedback, setDelayFeedback] = useState(0);    // Off

  // Connect FX to deck audio chain
  useEffect(() => {
    if (ref.current) {
      ref.current.audioInput = deckGain;
      ref.current.audioOutput = deckGain;
    }
  }, []);

  return (
    <div ref={ref} className="fx-panel">
      {/* Filter knob */}
      <FXKnob
        label="Filter"
        value={filterCutoff}
        min={200}
        max={20000}
        onChange={setFilterCutoff}
      />

      {/* Reverb knob */}
      <FXKnob
        label="Reverb"
        value={reverbMix}
        min={0}
        max={1}
        onChange={setReverbMix}
      />

      {/* Delay knob */}
      <FXKnob
        label="Delay"
        value={delayFeedback}
        min={0}
        max={0.8}
        onChange={setDelayFeedback}
      />
    </div>
  );
});
```

**FX Connection Pattern:**
```typescript
// Retry logic for FX connection (handles async audio initialization)
const connectDeckFX = (
  deck: 'A' | 'B',
  retryCount: number = 0
): NodeJS.Timeout | null => {
  const fxRef = deck === 'A' ? deckAFXRef : deckBFXRef;
  const deckGain = deck === 'A' ? deckAGain : deckBGain;

  if (fxRef.current?.audioInput && fxRef.current?.audioOutput) {
    // Connect deck output → FX input
    deckGain.connect(fxRef.current.audioInput);
    // Connect FX output → crossfader
    fxRef.current.audioOutput.connect(crossfaderGain);
    return null;
  }

  // Retry up to 10 times with 100ms delay
  if (retryCount < 10) {
    const timeout = setTimeout(() => {
      connectDeckFX(deck, retryCount + 1);
    }, 100);
    fxRetryTimeoutsRef.current.add(timeout);
    return timeout;
  }

  console.warn(`FX connection failed for deck ${deck}`);
  return null;
};
```

**Important Fix (Oct 23, 2025):**
```typescript
// BEFORE: FX retry timeouts leaked, causing memory issues
connectDeckFX(deck);  // Created timeouts but never cleaned up

// AFTER: Track and cleanup FX retry timeouts
const fxRetryTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());

const timeout = setTimeout(/* retry logic */);
fxRetryTimeoutsRef.current.add(timeout);

// Cleanup on unmount
useEffect(() => {
  return () => {
    fxRetryTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    fxRetryTimeoutsRef.current.clear();
  };
}, []);
```

---

## Recording System

### Recording Architecture

**Recording State:**
```typescript
interface RecordingState {
  isRecording: boolean;
  recordingStartTime: number | null;  // AudioContext.currentTime
  barsRecorded: number;
  targetBars: number;                 // Safety limit (120 bars default)
  recordedUrl: string | null;         // Blob URL for playback
  recordedDuration: number | null;
  showPreview: boolean;               // Show preview modal
}
```

**Recording Flow:**

```typescript
// 1. Start Recording
const startRecording = async () => {
  const audioCtx = getAudioContext();

  // Create destination for recording
  const destination = audioCtx.createMediaStreamDestination();
  mixerDestinationRef.current = destination;

  // Connect master output to recorder
  masterGain.connect(destination);

  // Create MediaRecorder
  const mediaRecorder = new MediaRecorder(destination.stream, {
    mimeType: 'audio/webm;codecs=opus'  // Browser support varies
  });

  mediaRecorderRef.current = mediaRecorder;
  recordedChunksRef.current = [];

  // Collect audio chunks
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      recordedChunksRef.current.push(e.data);
    }
  };

  // Handle recording stop
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunksRef.current, {
      type: 'audio/webm'
    });
    const url = URL.createObjectURL(blob);

    setRecordingState(prev => ({
      ...prev,
      recordedUrl: url,
      recordedDuration: audioCtx.currentTime - recordingStartTime,
      showPreview: true
    }));
  };

  // Start recording
  mediaRecorder.start(1000);  // Capture in 1-second chunks

  setRecordingState({
    isRecording: true,
    recordingStartTime: audioCtx.currentTime,
    barsRecorded: 0,
    targetBars: 120,
    recordedUrl: null,
    recordedDuration: null,
    showPreview: false
  });
};

// 2. Monitor Recording Progress
useEffect(() => {
  if (!recordingState.isRecording) return;

  const interval = setInterval(() => {
    const elapsed = audioCtx.currentTime - recordingState.recordingStartTime;
    const beatsElapsed = (elapsed / 60) * masterBPM;
    const barsRecorded = Math.floor(beatsElapsed / 4);

    setRecordingState(prev => ({
      ...prev,
      barsRecorded
    }));

    // Auto-stop at target bars (safety limit)
    if (barsRecorded >= recordingState.targetBars) {
      stopRecording();
    }
  }, 100);

  return () => clearInterval(interval);
}, [recordingState.isRecording]);

// 3. Stop Recording
const stopRecording = () => {
  if (mediaRecorderRef.current?.state === 'recording') {
    mediaRecorderRef.current.stop();
  }

  setRecordingState(prev => ({
    ...prev,
    isRecording: false
  }));
};

// 4. Download Recording
const downloadRecording = () => {
  if (!recordingState.recordedUrl) return;

  const a = document.createElement('a');
  a.href = recordingState.recordedUrl;
  a.download = `mixmi-mix-${Date.now()}.webm`;
  a.click();
};
```

**Recording UI:**
```tsx
// components/mixer/RecordingPreview.tsx
<div className="recording-controls">
  {!isRecording ? (
    <button onClick={startRecording} className="record-button">
      <div className="record-icon" />
      Record
    </button>
  ) : (
    <div className="recording-active">
      <div className="recording-indicator animate-pulse" />
      Recording: {barsRecorded} bars
      <button onClick={stopRecording}>Stop</button>
    </div>
  )}
</div>

{/* Preview modal after recording */}
{showPreview && recordedUrl && (
  <Modal isOpen={showPreview} onClose={() => setShowPreview(false)}>
    <h3>Your Mix</h3>
    <audio src={recordedUrl} controls />
    <div>Duration: {formatDuration(recordedDuration)}</div>
    <button onClick={downloadRecording}>Download</button>
  </Modal>
)}
```

---

### Recording Limitations & Future Improvements

**Current Limitations:**
1. **Format:** WebM/Opus (browser-dependent, not universally supported)
2. **No upload:** Download only, not saved to Supabase
3. **No waveform:** Preview audio player only
4. **Safety limit:** Auto-stops at 120 bars (~15 min at 120 BPM)
5. **Memory:** Large recordings consume RAM (no streaming to disk)

**Planned Improvements:**
1. **MP3 encoding:** Use Web Audio API + lamejs for universal format
2. **Upload to Supabase:** Save to user-content bucket
3. **Mix metadata:** Track list, timestamp, BPM, duration
4. **Waveform preview:** Visual representation before download
5. **Remix creation:** Convert recording to new remix track (Gen 1)
6. **Streaming encoder:** Handle longer mixes without memory issues

**Recording → Remix Upload Flow (Future):**
```typescript
// After recording
const createRemixFromRecording = async () => {
  // 1. Upload audio to Supabase
  const audioBlob = recordedChunksRef.current;
  const audioPath = `${walletAddress}/remix-${timestamp}.webm`;
  await supabase.storage.from('user-content').upload(audioPath, audioBlob);

  // 2. Calculate remix IP attribution
  const sourceLoops = [deckATrack, deckBTrack].filter(Boolean);
  const remixSplits = calculateRemixSplits(sourceLoops);

  // 3. Create remix track record
  await supabase.from('ip_tracks').insert({
    title: `Mix ${timestamp}`,
    artist: userProfile.display_name,
    content_type: 'mix',
    remix_depth: 1,
    source_track_ids: sourceLoops.map(t => t.id),
    audio_url: audioPublicUrl,
    bpm: masterBPM,
    ...remixSplits,
    primary_uploader_wallet: walletAddress
  });
};
```

---

## Waveform Visualization

### Waveform Rendering System

**File:** `components/mixer/WaveformDisplay.tsx`

**Architecture:**
```typescript
interface WaveformDisplayProps {
  audioUrl: string;
  isPlaying: boolean;
  currentTime: number;       // Audio playback position (seconds)
  duration: number;          // Total track duration
  loopStart: number;         // Loop start time
  loopEnd: number;           // Loop end time
  width: number;             // Canvas width (responsive)
  height: number;            // Canvas height (fixed 80px)
}
```

**Rendering Pipeline:**

**Step 1: Audio Analysis**
```typescript
// Load audio and extract waveform data
const analyzeAudio = async (audioUrl: string) => {
  const audioContext = new AudioContext();
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Get raw audio data (mono)
  const rawData = audioBuffer.getChannelData(0);

  // Downsample to fit canvas width
  const samples = width;
  const blockSize = Math.floor(rawData.length / samples);
  const filteredData = [];

  for (let i = 0; i < samples; i++) {
    const blockStart = blockSize * i;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(rawData[blockStart + j]);
    }
    filteredData.push(sum / blockSize);
  }

  return filteredData;
};
```

**Step 2: Canvas Rendering**
```typescript
const renderWaveform = (
  canvas: HTMLCanvasElement,
  waveformData: number[],
  currentTime: number,
  duration: number,
  loopStart: number,
  loopEnd: number
) => {
  const ctx = canvas.getContext('2d')!;
  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Calculate playhead position
  const playheadX = (currentTime / duration) * width;

  // Draw waveform bars
  const barWidth = width / waveformData.length;
  const barGap = 1;

  waveformData.forEach((value, i) => {
    const barHeight = value * height * 0.8;  // 80% of canvas height
    const x = i * barWidth;
    const y = (height - barHeight) / 2;  // Center vertically

    // Color: purple for loop region, gray for outside
    const inLoop = (x / width) * duration >= loopStart &&
                   (x / width) * duration <= loopEnd;
    ctx.fillStyle = inLoop ? '#9772F4' : '#374151';

    // Highlight played region (darker)
    if (x < playheadX) {
      ctx.fillStyle = inLoop ? '#7B5FD3' : '#1F2937';
    }

    ctx.fillRect(x, y, barWidth - barGap, barHeight);
  });

  // Draw playhead line
  ctx.strokeStyle = '#81E4F2';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(playheadX, 0);
  ctx.lineTo(playheadX, height);
  ctx.stroke();

  // Draw loop region markers
  const loopStartX = (loopStart / duration) * width;
  const loopEndX = (loopEnd / duration) * width;

  ctx.strokeStyle = '#9772F4';
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 5]);

  // Loop start line
  ctx.beginPath();
  ctx.moveTo(loopStartX, 0);
  ctx.lineTo(loopStartX, height);
  ctx.stroke();

  // Loop end line
  ctx.beginPath();
  ctx.moveTo(loopEndX, 0);
  ctx.lineTo(loopEndX, height);
  ctx.stroke();

  ctx.setLineDash([]);
};
```

**Step 3: Playhead Animation**
```typescript
// BEFORE (Oct 23, 2025): setInterval caused race conditions
const updatePlayhead = () => {
  setInterval(() => {
    setCurrentTime(player.currentTime);  // ❌ State update conflicts
  }, 16);  // ~60fps
};

// AFTER: requestAnimationFrame with ref-based tracking
const deckACurrentTimeRef = useRef(0);
const deckBCurrentTimeRef = useRef(0);
const animationFrameRef = useRef<number | null>(null);
const [, forceUpdate] = useState(0);

const updatePlayheads = () => {
  // Update refs (no state conflicts)
  if (deckAPlayer) {
    deckACurrentTimeRef.current = deckAPlayer.currentTime;
  }
  if (deckBPlayer) {
    deckBCurrentTimeRef.current = deckBPlayer.currentTime;
  }

  // Trigger React re-render
  forceUpdate(prev => prev + 1);

  // Schedule next frame
  animationFrameRef.current = requestAnimationFrame(updatePlayheads);
};

useEffect(() => {
  // Start animation loop
  animationFrameRef.current = requestAnimationFrame(updatePlayheads);

  // Cleanup on unmount
  return () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };
}, []);

// Pass ref values to waveform
<WaveformDisplay
  currentTime={deckACurrentTimeRef.current}
  {...otherProps}
/>
```

**Performance Optimization:**
- Waveform data cached after first analysis
- Canvas only re-renders on playhead update (60fps)
- Responsive width recalculates on window resize (debounced)
- Downsampling reduces data points to canvas width

---

## Component Breakdown

### SimplifiedDeck Component

**File:** `components/mixer/SimplifiedDeck.tsx`

**Responsibilities:**
- Track display (cover, title, artist)
- Play/pause control
- Volume slider
- Boost buttons (gentle/aggressive)
- Waveform display
- Drag-and-drop target for track loading

**UI Structure:**
```tsx
<div className="deck-container">
  {/* Header */}
  <div className="deck-header">
    <span>Deck {deck}</span>
    {track && (
      <Link href={`/store/${track.primary_uploader_wallet}`}>
        {track.artist}
      </Link>
    )}
  </div>

  {/* Track card */}
  {track ? (
    <div className="deck-track-card">
      <img src={track.cover_image_url} alt={track.title} />
      <div className="track-info">
        <div className="track-title">{track.title}</div>
        <div className="track-bpm">{track.bpm} BPM</div>
      </div>
      <button onClick={handleRemoveTrack}>✕</button>
    </div>
  ) : (
    <DeckDropZone onDrop={handleTrackDrop} />
  )}

  {/* Waveform */}
  {track && (
    <WaveformDisplay
      audioUrl={track.audioUrl}
      currentTime={currentTime}
      loopStart={loopStart}
      loopEnd={loopEnd}
      {...waveformProps}
    />
  )}

  {/* Controls */}
  <div className="deck-controls">
    <button onClick={togglePlay}>
      {playing ? <Pause /> : <Play />}
    </button>

    <VolumeSlider value={volume} onChange={setVolume} />

    {/* Boost buttons */}
    <button
      className={boostLevel === 1 ? 'active' : ''}
      onClick={() => setBoostLevel(1)}
      style={{ color: '#81E4F2' }}
    >
      Gentle Boost
    </button>

    <button
      className={boostLevel === 2 ? 'active' : ''}
      onClick={() => setBoostLevel(2)}
      style={{ color: '#FB923C' }}
    >
      Aggressive Boost
    </button>
  </div>

  {/* FX panel */}
  <FXComponent ref={fxRef} />
</div>
```

**Drag-and-Drop Integration:**
```typescript
const [{ isOver, canDrop }, drop] = useDrop({
  accept: ['TRACK_CARD', 'COLLECTION_TRACK'],
  canDrop: (item: { track: IPTrack }) => {
    // Only accept loops (not songs/EPs)
    return item.track.content_type === 'loop';
  },
  drop: (item: { track: IPTrack }) => {
    loadTrackToDeck(item.track);
  },
  collect: (monitor) => ({
    isOver: monitor.isOver(),
    canDrop: monitor.canDrop()
  })
});
```

**Educational Error Messages:**
```typescript
const handleInvalidDrop = (track: IPTrack) => {
  if (track.content_type === 'loop_pack') {
    showToast(
      'Loop packs must be expanded first. ' +
      'Hover over the card and click the chevron to drag individual loops.',
      'error',
      5000  // 5 seconds for readability
    );
  } else if (track.content_type === 'full_song' || track.content_type === 'ep') {
    showToast(
      'Songs and EPs cannot be loaded to mixer. ' +
      'Add them to your Crate for purchase instead.',
      'error',
      5000
    );
  } else if (track.content_type === 'mix') {
    showToast(
      'Mixes cannot be loaded to mixer. ' +
      'Download the mix or add to Crate for purchase.',
      'error',
      5000
    );
  }
};
```

---

### MasterTransportControls Component

**File:** `components/mixer/MasterTransportControls.tsx`

**Responsibilities:**
- Master BPM display and increment/decrement
- Sync toggle button
- Recording controls
- Keyboard shortcuts modal

**UI Structure:**
```tsx
<div className="master-controls">
  {/* BPM control */}
  <div className="bpm-control">
    <button onClick={decrementBPM}>−</button>
    <div className="bpm-display">{masterBPM} BPM</div>
    <button onClick={incrementBPM}>+</button>
  </div>

  {/* Sync button */}
  <button
    className={syncActive ? 'active' : ''}
    onClick={toggleSync}
    style={{
      backgroundColor: syncActive ? '#81E4F2' : '#374151'
    }}
  >
    {syncActive ? 'SYNC ON' : 'SYNC OFF'}
  </button>

  {/* Recording controls */}
  <button
    className={isRecording ? 'recording' : ''}
    onClick={isRecording ? stopRecording : startRecording}
  >
    {isRecording ? (
      <>
        <div className="recording-indicator" />
        Stop Recording ({barsRecorded} bars)
      </>
    ) : (
      <>
        <div className="record-icon" />
        Record
      </>
    )}
  </button>

  {/* Keyboard shortcuts */}
  <button onClick={() => setShowKeyboardShortcuts(true)}>
    <Keyboard className="w-4 h-4" />
  </button>
</div>
```

---

### CrossfaderControl Component

**File:** `components/mixer/CrossfaderControl.tsx`

**Responsibilities:**
- Crossfader slider (0-100)
- Visual feedback (gradient background)
- Smooth transitions

**UI Structure:**
```tsx
<div className="crossfader-container">
  <span className="deck-label">A</span>

  <div className="crossfader-track">
    {/* Gradient background shows mix level */}
    <div
      className="crossfader-fill"
      style={{
        background: `linear-gradient(to right,
          #9772F4 0%,
          #9772F4 ${100 - position}%,
          #FFE4B5 ${position}%,
          #FFE4B5 100%
        )`
      }}
    />

    {/* Slider */}
    <input
      type="range"
      min="0"
      max="100"
      value={position}
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="crossfader-slider"
    />
  </div>

  <span className="deck-label">B</span>
</div>
```

**Crossfader Curve:**
```typescript
// Linear crossfade (current implementation)
const gainA = (100 - position) / 100;
const gainB = position / 100;

// Future: Add crossfader curve options
// - Linear: Equal power throughout
// - Fast Cut: Quick transition in center
// - Slow Cut: Gradual transition
```

---

### LoopControls Component

**File:** `components/mixer/LoopControls.tsx`

**Responsibilities:**
- Loop enable/disable toggle
- Loop length selector (2, 4, 8, 16 bars)
- Loop position navigation (previous/next)

**UI Structure:**
```tsx
<div className="loop-controls">
  {/* Loop toggle */}
  <button
    className={loopEnabled ? 'active' : ''}
    onClick={toggleLoop}
  >
    Loop {loopEnabled ? 'ON' : 'OFF'}
  </button>

  {/* Loop length selector */}
  <div className="loop-length-selector">
    {[2, 4, 8, 16].map(bars => (
      <button
        key={bars}
        className={loopLength === bars ? 'active' : ''}
        onClick={() => setLoopLength(bars)}
      >
        {bars}
      </button>
    ))}
  </div>

  {/* Loop position navigation */}
  <div className="loop-position">
    <button onClick={previousLoop}>◄</button>
    <span>Position {loopPosition + 1}</span>
    <button onClick={nextLoop}>►</button>
  </div>
</div>
```

---

## Memory Management & Stability

### Memory Leak Prevention (Oct 23, 2025 Fixes)

**Problem 1: Audio Elements Not Cleaned Up**
```typescript
// BEFORE: Audio elements leaked on deck unload
const loadTrack = (track: Track) => {
  const player = new Tone.Player(track.audioUrl);
  // ❌ Player never disconnected/disposed
};

// AFTER: Proper cleanup
const loadTrack = (track: Track) => {
  // Clean up previous track
  if (deckAPlayer) {
    deckAPlayer.stop();
    deckAPlayer.disconnect();
    deckAPlayer.dispose();
  }

  // Load new track
  const player = new Tone.Player(track.audioUrl);
  setDeckAPlayer(player);
};

// Component unmount cleanup
useEffect(() => {
  return () => {
    if (deckAPlayer) {
      deckAPlayer.stop();
      deckAPlayer.disconnect();
      deckAPlayer.dispose();
    }
    if (deckBPlayer) {
      deckBPlayer.stop();
      deckBPlayer.disconnect();
      deckBPlayer.dispose();
    }
  };
}, []);
```

**Problem 2: FX Retry Timeouts Leaked**
```typescript
// BEFORE: Timeouts created but never cleared
const connectFX = () => {
  setTimeout(() => {/* retry */}, 100);  // ❌ Leaked
};

// AFTER: Track and cleanup timeouts
const fxRetryTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());

const connectFX = () => {
  const timeout = setTimeout(() => {/* retry */}, 100);
  fxRetryTimeoutsRef.current.add(timeout);
  return timeout;
};

useEffect(() => {
  return () => {
    fxRetryTimeoutsRef.current.forEach(t => clearTimeout(t));
    fxRetryTimeoutsRef.current.clear();
  };
}, []);
```

**Problem 3: Animation Frame Not Canceled**
```typescript
// BEFORE: requestAnimationFrame never canceled
const animate = () => {
  requestAnimationFrame(animate);  // ❌ Runs forever
};

// AFTER: Track and cancel animation frame
const animationFrameRef = useRef<number | null>(null);

const animate = () => {
  animationFrameRef.current = requestAnimationFrame(animate);
};

useEffect(() => {
  animationFrameRef.current = requestAnimationFrame(animate);

  return () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };
}, []);
```

---

### Type Safety Improvements (Oct 23, 2025)

**Eliminated All 'any' Types:**
```typescript
// BEFORE: Type safety issues
const handleDrop = (item: any) => {  // ❌ any type
  const track = item.track;
};

// AFTER: Proper types
interface DropItem {
  track: IPTrack;
  sourceIndex?: number;
}

const handleDrop = (item: DropItem) => {  // ✅ Type-safe
  const track = item.track;
};
```

**FX Element Type:**
```typescript
// Custom type for FX component ref
interface FXElement extends HTMLDivElement {
  audioInput?: GainNode;
  audioOutput?: GainNode;
  resetToDefaults?: () => void;
}

const deckAFXRef = useRef<FXElement>(null);
```

---

## Keyboard Shortcuts

**Current Shortcuts:**
```typescript
// Playback
Space:     Play/Pause Deck A
Shift+Space: Play/Pause Deck B

// BPM
ArrowUp:   Increment Master BPM (+1)
ArrowDown: Decrement Master BPM (-1)

// Sync
S:         Toggle Sync

// Recording
R:         Start/Stop Recording

// Loop
L:         Toggle Loop (Deck A)
Shift+L:   Toggle Loop (Deck B)

// Loop Position
[: Previous Loop Position (Deck A)
]: Next Loop Position (Deck A)

// Crossfader
A: Crossfader to Deck A (position 0)
B: Crossfader to Deck B (position 100)
C: Crossfader to Center (position 50)
```

**Implementation:**
```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Ignore if typing in input
    if (e.target instanceof HTMLInputElement) return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (e.shiftKey) {
          toggleDeckB();
        } else {
          toggleDeckA();
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        incrementBPM();
        break;

      case 'ArrowDown':
        e.preventDefault();
        decrementBPM();
        break;

      case 's':
      case 'S':
        toggleSync();
        break;

      case 'r':
      case 'R':
        isRecording ? stopRecording() : startRecording();
        break;

      // ... other shortcuts
    }
  };

  document.addEventListener('keydown', handleKeyPress);
  return () => document.removeEventListener('keydown', handleKeyPress);
}, [/* dependencies */]);
```

---

## Known Issues & Limitations

### Current Issues

1. **Recording Format:** WebM/Opus not universally supported (need MP3 encoding)
2. **No Upload:** Recordings download only, not saved to Supabase
3. **FX Automation:** No automation lanes, manual FX control only
4. **No EQ:** Basic filter only, no 3-band EQ
5. **No Beat Matching:** Manual BPM sync only, no auto-beat detection
6. **Single Crossfader Curve:** Linear only, no curve options

### Future Enhancements

**High Priority:**
1. **MP3 Recording:** Convert WebM to MP3 using lamejs or similar
2. **Upload to Supabase:** Save recordings as new tracks
3. **Remix Metadata:** Track source loops, auto-calculate IP splits
4. **Waveform Preview:** Visual preview before download

**Medium Priority:**
1. **3-Band EQ:** Low/Mid/High per deck
2. **Additional FX:** Flanger, phaser, distortion
3. **FX Automation:** Record FX parameter changes
4. **Cue Points:** Mark points in loops for quick jumps
5. **Beat Grid:** Visual beat alignment

**Low Priority:**
1. **MIDI Support:** Control mixer with MIDI controllers
2. **Multiple Crossfader Curves:** Fast cut, slow cut options
3. **Advanced Loop Modes:** Reverse, half-speed, double-speed
4. **Spectrum Analyzer:** Frequency visualization

---

## Troubleshooting Guide

### Common Issues

**Problem: No audio playback**
```typescript
// Solution: Ensure AudioContext started
await Tone.start();

// Check browser autoplay policy
// User interaction required before audio starts
```

**Problem: Sync not working**
```typescript
// Check: Is sync engine receiving BPM updates?
handleBPMChange(newBPM) {
  setMasterBPM(newBPM);
  syncEngine.setMasterBPM(newBPM);  // ← Must call this!
}
```

**Problem: Recording produces no file**
```typescript
// Check: Is master gain connected to destination?
masterGain.connect(mixerDestinationRef.current);

// Check: MediaRecorder state
console.log(mediaRecorderRef.current?.state);  // Should be "recording"
```

**Problem: FX not working**
```typescript
// Check: Are FX refs connected?
console.log(deckAFXRef.current?.audioInput);  // Should be GainNode

// Check: FX retry logic completing?
// Look for console warnings: "FX connection failed for deck A"
```

**Problem: Waveform not updating**
```typescript
// Check: Is animation frame running?
console.log(animationFrameRef.current);  // Should be number (frame ID)

// Check: Are refs being updated?
console.log(deckACurrentTimeRef.current);  // Should match playback time
```

---

## Related Skills

- **mixmi-component-library.md** - UI components (SimplifiedDeck, WaveformDisplay, etc.)
- **mixmi-payment-flow.md** - Smart contract integration for remix payments
- **mixmi-user-flows.md** - Mixer usage flows and user journeys
- **mixmi-design-patterns.md** - Visual design patterns for new features

---

**End of Mixer Architecture Reference**
