import * as Tone from 'tone';

// Gate pattern definitions
// Each pattern is an array of 0 (off/quiet) and 1 (on/full volume)
export const GATE_PATTERNS = [
  {
    name: 'PULSE',
    pattern: [1, 0, 1, 0, 1, 0, 1, 0],
    subdivision: '8n' as Tone.Unit.Time
  },
  {
    name: 'CHOP',
    pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    subdivision: '16n' as Tone.Unit.Time
  },
  {
    name: 'BOUNCE',
    pattern: [1, 0, 0, 1, 0, 1, 1, 0],
    subdivision: '16n' as Tone.Unit.Time
  },
  {
    name: 'TRIPLET',
    pattern: [1, 1, 0, 1, 1, 0],
    subdivision: '8t' as Tone.Unit.Time
  },
  {
    name: 'STUTTER',
    pattern: [1, 0, 1, 0, 0, 0, 1, 1],
    subdivision: '16n' as Tone.Unit.Time
  },
  {
    name: 'DRIFT',
    pattern: [1, 0, 0, 0, 1, 0, 0, 1, 0],
    subdivision: '16n' as Tone.Unit.Time
  }
];

// Gate effect manager class
export class GateEffect {
  private gainNode: GainNode;
  private sequence: Tone.Sequence | null = null;
  private patternIndex: number | null = null;
  private audioContext: AudioContext;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.value = 1.0; // Start at full volume
  }

  getGainNode(): GainNode {
    return this.gainNode;
  }

  // Start a gate pattern
  start(patternIndex: number, bpm: number) {
    console.log(`🎚️ GateEffect.start() called:`, { patternIndex, bpm, currentGain: this.gainNode.gain.value });

    // Stop any existing pattern
    this.stop();

    if (patternIndex < 0 || patternIndex >= GATE_PATTERNS.length) {
      console.error('Invalid gate pattern index:', patternIndex);
      return;
    }

    const pattern = GATE_PATTERNS[patternIndex];
    this.patternIndex = patternIndex;

    console.log(`🎚️ Selected pattern:`, pattern);

    // Ensure Tone.js is started
    if (Tone.getContext().state !== 'running') {
      console.log('🎚️ Starting Tone.js context...');
      Tone.start();
    }

    // Set BPM
    Tone.getTransport().bpm.value = bpm;
    console.log(`🎚️ Tone.js transport BPM set to ${bpm}, state: ${Tone.getTransport().state}`);

    // Create sequence that modulates the gain node
    // Using 20% minimum volume for musicality (0.2 to 1.0 range)
    // Change to 0.0 for full gate effect
    const minGain = 0.2;
    const maxGain = 1.0;

    this.sequence = new Tone.Sequence(
      (time, value) => {
        // Schedule gain change at the exact time
        const targetGain = value === 1 ? maxGain : minGain;
        console.log(`🎚️ Gate step: ${value} → gain: ${targetGain} at time ${time}`);
        this.gainNode.gain.setValueAtTime(targetGain, time);
      },
      pattern.pattern,
      pattern.subdivision
    );

    // Start the sequence
    this.sequence.start(0);
    console.log(`🎚️ Sequence started`);

    // Start transport if not already started
    if (Tone.getTransport().state !== 'started') {
      console.log('🎚️ Starting Tone.js transport...');
      Tone.getTransport().start();
    }

    console.log(`✅ Gate started: ${pattern.name} at ${bpm} BPM, transport state: ${Tone.getTransport().state}`);
  }

  // Stop the gate pattern
  stop() {
    if (this.sequence) {
      this.sequence.stop();
      this.sequence.dispose();
      this.sequence = null;
      this.patternIndex = null;
    }

    // Reset gain to full volume
    this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
    this.gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
  }

  // Update BPM of active pattern
  updateBPM(bpm: number) {
    if (this.sequence && this.patternIndex !== null) {
      Tone.getTransport().bpm.value = bpm;
    }
  }

  // Get current pattern index (null if no pattern active)
  getActivePattern(): number | null {
    return this.patternIndex;
  }

  // Cleanup
  dispose() {
    this.stop();
    this.gainNode.disconnect();
  }
}
