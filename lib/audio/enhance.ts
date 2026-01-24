/**
 * Client-side audio enhancement using Web Audio API
 *
 * This provides real-time audio processing without server dependencies.
 * Enhancement chain: Highpass → Compressor → Gain (normalization)
 */

export type EnhancementType = 'auto' | 'voice' | 'clean' | 'warm' | 'studio';

interface EnhancementPreset {
  highpassFreq: number;
  compressor: {
    threshold: number;
    knee: number;
    ratio: number;
    attack: number;
    release: number;
  };
  gain: number;
  lowShelfFreq?: number;
  lowShelfGain?: number;
  highShelfFreq?: number;
  highShelfGain?: number;
}

// Enhancement presets matching the original FFmpeg spec
const PRESETS: Record<EnhancementType, EnhancementPreset> = {
  auto: {
    highpassFreq: 80,
    compressor: { threshold: -24, knee: 10, ratio: 4, attack: 0.003, release: 0.25 },
    gain: 1.2,
  },
  voice: {
    highpassFreq: 100,
    compressor: { threshold: -20, knee: 8, ratio: 5, attack: 0.002, release: 0.2 },
    gain: 1.3,
  },
  clean: {
    highpassFreq: 80,
    compressor: { threshold: -30, knee: 20, ratio: 2, attack: 0.01, release: 0.3 },
    gain: 1.1,
  },
  warm: {
    highpassFreq: 60,
    compressor: { threshold: -22, knee: 12, ratio: 3, attack: 0.005, release: 0.3 },
    gain: 1.15,
    lowShelfFreq: 200,
    lowShelfGain: 2,
  },
  studio: {
    highpassFreq: 40,
    compressor: { threshold: -18, knee: 6, ratio: 6, attack: 0.002, release: 0.15 },
    gain: 1.25,
    lowShelfFreq: 100,
    lowShelfGain: 1,
    highShelfFreq: 8000,
    highShelfGain: 1.5,
  },
};

/**
 * Enhance audio using Web Audio API
 * Returns a Blob URL of the enhanced audio
 */
export async function enhanceAudio(
  sourceUrl: string,
  enhancementType: EnhancementType,
  onProgress?: (progress: number) => void
): Promise<{ enhancedUrl: string; enhancedBlob: Blob }> {
  onProgress?.(5);

  // Create audio context
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

  // Fetch and decode the source audio
  onProgress?.(10);
  const response = await fetch(sourceUrl);
  const arrayBuffer = await response.arrayBuffer();

  onProgress?.(30);
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  onProgress?.(40);

  // Get the preset
  const preset = PRESETS[enhancementType];

  // Create offline context for rendering
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  // Create source node
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  // Build the processing chain
  let currentNode: AudioNode = source;

  // 1. Highpass filter (remove rumble)
  const highpass = offlineContext.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = preset.highpassFreq;
  highpass.Q.value = 0.7;
  currentNode.connect(highpass);
  currentNode = highpass;

  // 2. Low shelf EQ (for warm/studio presets)
  if (preset.lowShelfFreq && preset.lowShelfGain) {
    const lowShelf = offlineContext.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = preset.lowShelfFreq;
    lowShelf.gain.value = preset.lowShelfGain;
    currentNode.connect(lowShelf);
    currentNode = lowShelf;
  }

  // 3. High shelf EQ (for studio preset)
  if (preset.highShelfFreq && preset.highShelfGain) {
    const highShelf = offlineContext.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = preset.highShelfFreq;
    highShelf.gain.value = preset.highShelfGain;
    currentNode.connect(highShelf);
    currentNode = highShelf;
  }

  // 4. Compressor (dynamics control)
  const compressor = offlineContext.createDynamicsCompressor();
  compressor.threshold.value = preset.compressor.threshold;
  compressor.knee.value = preset.compressor.knee;
  compressor.ratio.value = preset.compressor.ratio;
  compressor.attack.value = preset.compressor.attack;
  compressor.release.value = preset.compressor.release;
  currentNode.connect(compressor);
  currentNode = compressor;

  // 5. Output gain (makeup gain / normalization)
  const gainNode = offlineContext.createGain();
  gainNode.gain.value = preset.gain;
  currentNode.connect(gainNode);
  gainNode.connect(offlineContext.destination);

  onProgress?.(50);

  // Start and render
  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  onProgress?.(80);

  // Convert to WAV blob
  const wavBlob = audioBufferToWav(renderedBuffer);

  onProgress?.(95);

  // Create blob URL
  const enhancedUrl = URL.createObjectURL(wavBlob);

  // Cleanup
  await audioContext.close();

  onProgress?.(100);

  return { enhancedUrl, enhancedBlob: wavBlob };
}

/**
 * Convert AudioBuffer to WAV Blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  // Interleave channels
  const length = buffer.length * numChannels;
  const samples = new Int16Array(length);

  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = buffer.getChannelData(channel)[i];
      // Clamp and convert to 16-bit
      const clamped = Math.max(-1, Math.min(1, sample));
      samples[i * numChannels + channel] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
    }
  }

  // Create WAV file
  const dataSize = samples.length * bytesPerSample;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, format, true); // audio format (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write samples
  const offset = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset + i * 2, samples[i], true);
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Revoke a blob URL when done with it
 */
export function revokeEnhancedUrl(url: string) {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
