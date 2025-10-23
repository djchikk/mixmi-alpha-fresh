'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';

/**
 * COMPLETE FX COMPONENT IMPLEMENTATION WITH PERFORMANCE OPTIMIZATION
 * For 8-bar loop mixer with Filter and Delay+Reverb effects
 * 
 * VISUAL DESIGN:
 * - 2 effects: FLT (Filter) and DLY (Delay with integrated Reverb)
 * - Flat grey selector buttons with light grey active state
 * - Power buttons with glowing blue borders when active
 * - XY pad for parameter control
 * - Colors: Filter (#4D5DE8), Delay (#4895EF)
 * 
 * AUDIO IMPLEMENTATION:
 * - Filter: Biquad filter with cutoff (Y) and resonance (X)
 * - Delay: Delay node with reverb convolver, time+mix (Y), feedback+space (X)
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - 60fps throttling on XY pad updates
 * - Parameter ramping to prevent clicks
 * - Safety limits on feedback and reverb
 * - CPU monitoring with graceful degradation
 */

// ========================================
// PERFORMANCE CONSTANTS
// ========================================
const PERFORMANCE_CONFIG = {
    // Throttling
    UPDATE_INTERVAL: 16, // ~60fps
    SMOOTHING_TIME: 0.05, // 50ms for smooth DJ-style sweeps

    // Safety limits
    MAX_FEEDBACK: 0.5, // Musical feedback range (was 0.85 - too extreme)
    MAX_DELAY_TIME: 0.375, // 375ms max = dotted eighth note at 120 BPM (was 1.0s - too extreme)
    MAX_REVERB_WITH_DELAY: 0.3, // Prevent mud when both active (was 0.5)
    MAX_Q: 3, // Musical resonance - higher values cause artifacts

    // CPU monitoring
    MAX_ACCEPTABLE_LATENCY: 0.02, // 20ms
    PERFORMANCE_CHECK_INTERVAL: 5000 // Check every 5 seconds
};

// ========================================
// WEB AUDIO EFFECTS CHAIN WITH PERFORMANCE OPTIMIZATION
// ========================================
class FXChain {
    context: AudioContext;
    deckId: string;
    cpuProtectionEnabled: boolean;
    reverbEnabled: boolean;
    performanceInterval?: NodeJS.Timeout;
    currentBPM: number; // 🎵 Current BPM for tempo-synced delay

    input: GainNode;
    output: GainNode;
    
    filter: {
        input: GainNode;
        output: GainNode;
        highpass: BiquadFilterNode;
        lowpass: BiquadFilterNode;
        enabled: boolean;
    };
    
    delay: {
        input: GainNode;
        output: GainNode;
        delayNode: DelayNode;
        feedbackGain: GainNode;
        convolver: ConvolverNode;
        delayWetGain: GainNode;
        reverbWetGain: GainNode;
        dryGain: GainNode;
        enabled: boolean;
    };
    
    constructor(audioContext: AudioContext, deckId: string, initialBPM: number = 120) {
        this.context = audioContext;
        this.deckId = deckId;
        this.currentBPM = initialBPM;

        // Performance monitoring
        this.cpuProtectionEnabled = true;
        this.reverbEnabled = true;
        
        // Create nodes
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Filter effect
        console.log(`🎛️ Creating filter nodes for ${deckId}...`);
        this.filter = {
            input: audioContext.createGain(),
            output: audioContext.createGain(),
            highpass: audioContext.createBiquadFilter(),
            lowpass: audioContext.createBiquadFilter(),
            enabled: false  // Default to OFF
        };
        console.log(`🎛️ Filter nodes created:`, {
            input: this.filter.input,
            output: this.filter.output,
            highpass: this.filter.highpass,
            lowpass: this.filter.lowpass
        });
        
        // Delay + Reverb effect
        this.delay = {
            input: audioContext.createGain(),
            output: audioContext.createGain(),
            delayNode: audioContext.createDelay(2.0),
            feedbackGain: audioContext.createGain(),
            convolver: audioContext.createConvolver(),
            delayWetGain: audioContext.createGain(),
            reverbWetGain: audioContext.createGain(),
            dryGain: audioContext.createGain(),
            enabled: false  // Default to OFF
        };
        
        this.setupEffects();
        this.connectChain();
        this.startPerformanceMonitoring();
        
        // Initialize to center position (50%, 50%)
        console.log(`🎛️ FXChain constructor: Initializing effects to center position for ${deckId}`);
        this.updateFilter(0.5, 0.5);
        this.updateDelay(0.5, 0.5);
        
        // Verify filter frequencies after init
        console.log(`🎛️ Filter initial state - highpass: ${this.filter.highpass.frequency.value}Hz, lowpass: ${this.filter.lowpass.frequency.value}Hz`);
    }
    
    setupEffects() {
        console.log(`🎛️ FXChain.setupEffects() called for ${this.deckId}`);
        
        // Filter setup
        this.filter.highpass.type = 'highpass';
        this.filter.highpass.frequency.value = 20;
        this.filter.lowpass.type = 'lowpass';
        this.filter.lowpass.frequency.value = 20000;
        this.filter.lowpass.Q.value = 1;
        
        // Internal filter routing
        console.log(`🎛️ Connecting filter internals...`);
        try {
            this.filter.input.connect(this.filter.highpass);
            console.log(`🎛️ Connected: filter.input → highpass`);
            this.filter.highpass.connect(this.filter.lowpass);
            console.log(`🎛️ Connected: highpass → lowpass`);
            this.filter.lowpass.connect(this.filter.output);
            console.log(`🎛️ Connected: lowpass → filter.output`);
            console.log(`🎛️ Filter chain connected: input → highpass → lowpass → output`);
        } catch (error) {
            console.error(`🎛️ ERROR connecting filter internals:`, error);
        }
        
        // Delay + Reverb setup
        this.delay.delayNode.delayTime.value = 0.25;
        this.delay.feedbackGain.gain.value = 0.3;
        this.delay.delayWetGain.gain.value = 0;
        this.delay.reverbWetGain.gain.value = 0;
        this.delay.dryGain.gain.value = 1;
        
        // Delay routing with feedback loop
        this.delay.input.connect(this.delay.dryGain);
        this.delay.input.connect(this.delay.delayNode);
        this.delay.delayNode.connect(this.delay.feedbackGain);
        this.delay.feedbackGain.connect(this.delay.delayNode);
        this.delay.delayNode.connect(this.delay.delayWetGain);
        
        // Reverb routing (parallel to delay) - DON'T connect convolver yet
        // Convolver without buffer blocks audio completely!
        // this.delay.input.connect(this.delay.convolver);
        // this.delay.convolver.connect(this.delay.reverbWetGain);
        
        // All signals to output
        this.delay.dryGain.connect(this.delay.output);
        this.delay.delayWetGain.connect(this.delay.output);
        this.delay.reverbWetGain.connect(this.delay.output);
        console.log(`🎛️ Delay chain connected: input → (dry + delay + reverb) → output`);
    }
    
    connectChain() {
        // Since both effects default to OFF, connect input directly to output
        console.log(`🎛️ FXChain.connectChain() called for ${this.deckId} - defaulting to bypass`);
        this.input.connect(this.output);
        console.log(`🎛️ FX chain connected for ${this.deckId}: input → output (effects bypassed by default)`);
    }
    
    // Update filter from XY pad (0-1 values) with performance optimization
    updateFilter(x: number, y: number) {
        if (!this.filter.enabled) return;

        // Y-axis: Cutoff frequency (400Hz to 12kHz, exponential)
        // More musical range - avoids extreme low/high artifacts
        const minFreq = 400;  // Start higher for cleaner sound
        const maxFreq = 12000; // Cap lower to avoid harsh highs
        const cutoff = minFreq * Math.pow(maxFreq / minFreq, y);

        // X-axis: Resonance (Q factor, 0.7 to MAX_Q)
        // Add dead zone in center (40-60%) for neutral sound
        let qValue;
        if (x >= 0.4 && x <= 0.6) {
            // Dead zone - minimal resonance for smooth, neutral filtering
            qValue = 0.7;
        } else {
            // Map outer ranges to resonance
            const normalizedX = x < 0.4 ? x / 0.4 : (x - 0.6) / 0.4;
            qValue = 0.7 + (normalizedX * (PERFORMANCE_CONFIG.MAX_Q - 0.7));
        }
        const resonance = Math.min(qValue, PERFORMANCE_CONFIG.MAX_Q);

        console.log(`🎛️ FX updateFilter for ${this.deckId}: cutoff=${cutoff.toFixed(0)}Hz, Q=${resonance.toFixed(1)}`);

        // Use setTargetAtTime for smooth, click-free updates
        const now = this.context.currentTime;

        this.filter.lowpass.frequency.cancelScheduledValues(now);
        this.filter.lowpass.frequency.setTargetAtTime(
            cutoff,
            now,
            PERFORMANCE_CONFIG.SMOOTHING_TIME
        );

        this.filter.lowpass.Q.cancelScheduledValues(now);
        this.filter.lowpass.Q.setTargetAtTime(
            resonance,
            now,
            PERFORMANCE_CONFIG.SMOOTHING_TIME
        );
    }
    
    // Set BPM for tempo-synced delay
    setBPM(bpm: number) {
        this.currentBPM = bpm;
        console.log(`🎵 FX ${this.deckId} BPM updated to ${bpm}`);
    }

    // Update delay + reverb from XY pad (0-1 values) with tempo-synced delay times
    updateDelay(x: number, y: number) {
        if (!this.delay.enabled) return;

        // Y-axis: Delay time (tempo-synced) + Wet/Dry mix
        // Add dead zone at bottom (0-20%) for completely dry signal
        let delayTime;
        let wetAmount;
        if (y < 0.2) {
            // Dead zone - minimal delay
            delayTime = 0.01; // Very short delay (essentially off)
            wetAmount = 0;
        } else {
            // Map 20-100% to tempo-synced beat divisions
            const normalizedY = (y - 0.2) / 0.8;

            // Calculate beat duration in seconds
            const beatDuration = 60.0 / this.currentBPM;

            // Map Y position to musical note values:
            // 0.0 (20%) = 1/16 note (0.25 beats)
            // 0.5 (60%) = 1/8 note (0.5 beats)
            // 1.0 (100%) = Dotted 8th (0.75 beats)
            const beatFraction = 0.25 + (normalizedY * 0.5); // Range: 0.25 to 0.75 beats
            delayTime = beatDuration * beatFraction;

            wetAmount = normalizedY * 0.7; // Cap wet at 70% to keep some dry signal

            console.log(`🎵 Tempo-synced delay: ${this.currentBPM} BPM, ${beatFraction.toFixed(2)} beats = ${(delayTime * 1000).toFixed(0)}ms`);
        }

        // X-axis: Feedback + Reverb size
        // Add dead zone in center (40-60%) for neutral feedback
        let feedback;
        if (x >= 0.4 && x <= 0.6) {
            // Dead zone - minimal feedback for single repeat
            feedback = 0.1;
        } else {
            // Map outer ranges to feedback
            const normalizedX = x < 0.4 ? x / 0.4 : (x - 0.6) / 0.4;
            feedback = 0.1 + (normalizedX * (PERFORMANCE_CONFIG.MAX_FEEDBACK - 0.1));
        }

        // Limit reverb when delay is high to prevent mud
        const reverbLimit = this.reverbEnabled ? PERFORMANCE_CONFIG.MAX_REVERB_WITH_DELAY : 0;
        const reverbAmount = Math.min(x * reverbLimit, reverbLimit);

        console.log(`🎛️ FX updateDelay for ${this.deckId}: time=${delayTime.toFixed(3)}s, feedback=${feedback.toFixed(2)}, wet=${wetAmount.toFixed(2)}, reverb=${reverbAmount.toFixed(2)}`);

        const now = this.context.currentTime;

        // Update delay parameters with ramping
        this.delay.delayNode.delayTime.cancelScheduledValues(now);
        this.delay.delayNode.delayTime.setTargetAtTime(
            delayTime,
            now,
            PERFORMANCE_CONFIG.SMOOTHING_TIME
        );

        this.delay.feedbackGain.gain.cancelScheduledValues(now);
        this.delay.feedbackGain.gain.setTargetAtTime(
            feedback,
            now,
            PERFORMANCE_CONFIG.SMOOTHING_TIME
        );

        // Update wet/dry mix
        this.delay.dryGain.gain.cancelScheduledValues(now);
        this.delay.dryGain.gain.setTargetAtTime(
            1 - wetAmount,
            now,
            PERFORMANCE_CONFIG.SMOOTHING_TIME
        );

        this.delay.delayWetGain.gain.cancelScheduledValues(now);
        this.delay.delayWetGain.gain.setTargetAtTime(
            wetAmount,
            now,
            PERFORMANCE_CONFIG.SMOOTHING_TIME
        );

        this.delay.reverbWetGain.gain.cancelScheduledValues(now);
        this.delay.reverbWetGain.gain.setTargetAtTime(
            wetAmount * reverbAmount,
            now,
            PERFORMANCE_CONFIG.SMOOTHING_TIME
        );
    }
    
    // Performance monitoring
    startPerformanceMonitoring() {
        if (!this.cpuProtectionEnabled) return;
        
        this.performanceInterval = setInterval(() => {
            const latency = (this.context as any).baseLatency || (this.context as any).outputLatency || 0;
            
            if (latency > PERFORMANCE_CONFIG.MAX_ACCEPTABLE_LATENCY) {
                console.warn(`High latency detected (${latency}s), disabling reverb`);
                this.disableReverb();
            }
        }, PERFORMANCE_CONFIG.PERFORMANCE_CHECK_INTERVAL);
    }
    
    // Graceful degradation
    disableReverb() {
        if (!this.reverbEnabled) return;
        
        this.reverbEnabled = false;
        this.delay.convolver.disconnect();
        this.delay.reverbWetGain.gain.value = 0;
        
        // Notify user (optional)
        console.log('Reverb disabled for performance');
    }
    
    // Ensure filter internal connections
    ensureFilterInternalsConnected() {
        console.log(`🎛️ Ensuring filter internals are connected for ${this.deckId}`);
        try {
            // Disconnect first to avoid double connections
            this.filter.input.disconnect();
            this.filter.highpass.disconnect();
            this.filter.lowpass.disconnect();
            
            // Reconnect
            this.filter.input.connect(this.filter.highpass);
            this.filter.highpass.connect(this.filter.lowpass);
            this.filter.lowpass.connect(this.filter.output);
            console.log(`🎛️ Filter internals reconnected successfully`);
        } catch (e) {
            console.error(`🎛️ Error ensuring filter connections:`, e);
        }
    }

    // Ensure delay internal connections
    ensureDelayInternalsConnected() {
        console.log(`🎛️ Ensuring delay internals are connected for ${this.deckId}`);
        try {
            // Disconnect first to avoid double connections
            this.delay.input.disconnect();
            this.delay.dryGain.disconnect();
            this.delay.delayNode.disconnect();
            this.delay.feedbackGain.disconnect();
            this.delay.delayWetGain.disconnect();
            this.delay.reverbWetGain.disconnect();
            
            // Reconnect delay routing
            this.delay.input.connect(this.delay.dryGain);
            this.delay.input.connect(this.delay.delayNode);
            this.delay.delayNode.connect(this.delay.feedbackGain);
            this.delay.feedbackGain.connect(this.delay.delayNode);
            this.delay.delayNode.connect(this.delay.delayWetGain);
            
            // Reconnect reverb routing if convolver has buffer
            if (this.delay.convolver.buffer) {
                this.delay.input.connect(this.delay.convolver);
                this.delay.convolver.connect(this.delay.reverbWetGain);
                console.log(`🎛️ Reverb routing reconnected`);
            } else {
                console.log(`🎛️ Convolver has no buffer, skipping reverb connection`);
            }
            
            // All signals to output
            this.delay.dryGain.connect(this.delay.output);
            this.delay.delayWetGain.connect(this.delay.output);
            this.delay.reverbWetGain.connect(this.delay.output);
            
            console.log(`🎛️ Delay internals reconnected successfully`);
        } catch (e) {
            console.error(`🎛️ Error ensuring delay connections:`, e);
        }
    }

    // Bypass an effect
    bypassEffect(effectName: 'filter' | 'delay', bypass: boolean) {
        console.log(`🎛️ FXChain.bypassEffect called - ${this.deckId} ${effectName}: ${bypass ? 'BYPASS' : 'ENABLE'}`);
        const effect = this[effectName];
        if (!effect) {
            console.error(`🎛️ Effect ${effectName} not found!`);
            return;
        }

        effect.enabled = !bypass;
        console.log(`🎛️ Effect states - filter.enabled: ${this.filter.enabled}, delay.enabled: ${this.delay.enabled}`);

        // Always disconnect everything first to avoid double connections
        console.log(`🎛️ Disconnecting all nodes for ${this.deckId}`);
        try {
            this.input.disconnect();
            this.filter.input.disconnect();
            this.filter.output.disconnect();
            this.delay.input.disconnect();
            this.delay.output.disconnect();
        } catch (e) {
            console.warn(`🎛️ Some nodes already disconnected for ${this.deckId}:`, e);
        }

        // Now reconnect based on enabled states
        if (this.filter.enabled && this.delay.enabled) {
            // Both enabled: input → filter → delay → output
            console.log(`🎛️ ✅ Routing: input → filter → delay → output`);
            this.input.connect(this.filter.input);
            this.ensureFilterInternalsConnected();
            this.filter.output.connect(this.delay.input);
            this.ensureDelayInternalsConnected();
            this.delay.output.connect(this.output);
            console.log(`🎛️ ✅ Both effects connected successfully`);
        } else if (this.filter.enabled && !this.delay.enabled) {
            // Only filter: input → filter → output
            console.log(`🎛️ ✅ Routing: input → filter → output`);
            this.input.connect(this.filter.input);
            this.ensureFilterInternalsConnected();
            this.filter.output.connect(this.output);
            console.log(`🎛️ ✅ Filter connected successfully`);
        } else if (!this.filter.enabled && this.delay.enabled) {
            // Only delay: input → delay → output
            console.log(`🎛️ ✅ Routing: input → delay → output`);
            this.input.connect(this.delay.input);
            this.ensureDelayInternalsConnected();
            this.delay.output.connect(this.output);
            console.log(`🎛️ ✅ Delay connected successfully`);
        } else {
            // Both bypassed: input → output
            console.log(`🎛️ ✅ Routing: input → output (bypass mode)`);
            this.input.connect(this.output);
            console.log(`🎛️ ✅ Bypass connected successfully`);
        }
    }
    
    // Load reverb impulse response
    async loadReverbImpulse(url: string) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.delay.convolver.buffer = audioBuffer;
        } catch (error) {
            console.error('Error loading reverb impulse:', error);
            // Create synthetic reverb as fallback
            this.createSyntheticReverb();
        }
    }
    
    // Better synthetic reverb (more musical)
    createSyntheticReverb() {
        console.log(`🎛️ Creating synthetic reverb for ${this.deckId}...`);
        const length = this.context.sampleRate * 2; // 2 second reverb
        const impulse = this.context.createBuffer(2, length, this.context.sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            
            // Early reflections (first 100ms)
            const earlyReflections = Math.floor(0.1 * this.context.sampleRate);
            for (let i = 0; i < earlyReflections; i++) {
                if (Math.random() < 0.001) { // Sparse early reflections
                    channelData[i] = (Math.random() * 2 - 1) * 0.5;
                }
            }
            
            // Diffuse tail
            for (let i = earlyReflections; i < length; i++) {
                const decay = Math.pow(1 - i / length, 2);
                channelData[i] = (Math.random() * 2 - 1) * decay * 0.3;
            }
            
            // Add some stereo width
            if (channel === 1) {
                for (let i = 0; i < length; i++) {
                    channelData[i] *= -0.8; // Slight phase inversion for width
                }
            }
        }
        
        this.delay.convolver.buffer = impulse;
        
        // NOW connect the convolver after it has a buffer
        try {
            this.delay.input.connect(this.delay.convolver);
            this.delay.convolver.connect(this.delay.reverbWetGain);
            console.log(`🎛️ Reverb convolver connected for ${this.deckId}`);
        } catch (error) {
            console.error(`🎛️ Failed to connect reverb for ${this.deckId}:`, error);
        }
    }
    
    // Cleanup
    destroy() {
        if (this.performanceInterval) {
            clearInterval(this.performanceInterval);
        }

        // Disconnect all audio nodes to prevent memory leaks
        try {
            this.input.disconnect();
            this.output.disconnect();
            this.filter.input.disconnect();
            this.filter.highpass.disconnect();
            this.filter.lowpass.disconnect();
            this.filter.output.disconnect();
            this.delay.input.disconnect();
            this.delay.delayNode.disconnect();
            this.delay.feedbackGain.disconnect();
            this.delay.dryGain.disconnect();
            this.delay.delayWetGain.disconnect();
            this.delay.reverbWetGain.disconnect();
            if (this.delay.convolver.buffer) {
                this.delay.convolver.disconnect();
            }
            this.delay.output.disconnect();
            console.log(`✅ FX chain ${this.deckId} nodes disconnected`);
        } catch (error) {
            console.warn(`⚠️ FX chain ${this.deckId} cleanup warning:`, error);
        }
    }
}

// ========================================
// FX COMPONENT PROPS
// ========================================
interface FXComponentProps {
  audioContext: AudioContext | null;
  deckId: 'deckA' | 'deckB';
  audioControls?: any; // 🎛️ Audio controls for EQ
  masterBPM?: number; // 🎵 Master BPM for tempo-synced delay
}

// ========================================
// FX COMPONENT
// ========================================
const FXComponent = React.memo(React.forwardRef<HTMLDivElement, FXComponentProps>(({
  audioContext,
  deckId,
  audioControls,
  masterBPM = 120
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fxChainRef = useRef<FXChain | null>(null);
  const currentEffectRef = useRef<'filter' | 'delay'>('filter');
  const updatePositionRef = useRef<((e: { clientX: number; clientY: number }) => void) | null>(null);

  // Add state for current effect to trigger UI updates
  const [currentEffect, setCurrentEffect] = useState<'filter' | 'delay'>('filter');

  // 🎛️ NEW: Track EQ button states
  const [hiCutActive, setHiCutActive] = useState(false);
  const [loCutActive, setLoCutActive] = useState(false);

  // Track renders for debugging
  useEffect(() => {
    console.log(`🎛️ FXComponent rendered for ${deckId}, audioContext:`, !!audioContext);
  });

  // Define event handlers first, before useEffect references them
  const selectEffect = useCallback((button: HTMLButtonElement) => {
    const effect = button.dataset.effect as 'filter' | 'delay';
    if (!effect || !containerRef.current) return;
    
    const container = containerRef.current;
    const xyPad = container.querySelector('.xy-pad');
    const xyPosition = container.querySelector('.xy-position');
    
    // Update active button
    container.querySelectorAll('.fx-select-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    button.classList.add('active');
    
    // Update current effect (both ref and state)
    currentEffectRef.current = effect;
    setCurrentEffect(effect);
    
    // Update XY pad labels
    const labels = {
      filter: { x: 'Resonance →', y: '↑ Cutoff' },
      delay: { x: 'Feedback + Space →', y: '↑ Time + Mix' }
    };
    
    const xLabel = container.querySelector('.xy-label-x');
    const yLabel = container.querySelector('.xy-label-y');
    if (xLabel) xLabel.textContent = labels[effect].x;
    if (yLabel) yLabel.textContent = labels[effect].y;
    
    // Position indicators are now handled by display styles on separate elements
    
    // Check if this effect is bypassed
    const powerBtn = container.querySelector<HTMLButtonElement>(`.fx-power-btn.${effect}`);
    const isActive = powerBtn?.classList.contains('active') || false;
    xyPad?.classList.toggle('bypassed', !isActive);
  }, []);

  const togglePower = useCallback((button: HTMLButtonElement) => {
    console.log('🎛️ togglePower called');
    const effect = button.dataset.effect as 'filter' | 'delay';
    console.log('🎛️ Effect:', effect, 'FXChain:', !!fxChainRef.current, 'Container:', !!containerRef.current);

    if (!effect) {
      console.error('🎛️ togglePower: No effect specified on button');
      return;
    }

    if (!fxChainRef.current) {
      console.error('🎛️ togglePower: fxChainRef.current is null - FX chain not initialized yet');
      return;
    }

    if (!containerRef.current) {
      console.error('🎛️ togglePower: containerRef.current is null - container not mounted');
      return;
    }

    button.classList.toggle('active');
    const isActive = button.classList.contains('active');
    console.log(`🎛️ ${deckId} ${effect} power toggled to:`, isActive ? 'ON' : 'OFF');

    // Update effects chain
    console.log(`🎛️ Calling bypassEffect(${effect}, ${!isActive})`);
    fxChainRef.current.bypassEffect(effect, !isActive);

    // If this is the currently selected effect, update XY pad
    if (effect === currentEffectRef.current) {
      const xyPad = containerRef.current.querySelector('.xy-pad');
      xyPad?.classList.toggle('bypassed', !isActive);
      console.log(`🎛️ XY pad ${!isActive ? 'enabled' : 'disabled'} for ${effect}`);
    }
  }, [deckId]);

  // 🎛️ NEW: EQ button handlers
  const toggleHiCut = useCallback(() => {
    if (!audioControls?.setHiCut) {
      console.warn(`🎛️ ${deckId} HI-CUT: audioControls not available`);
      return;
    }

    const newState = !hiCutActive;
    setHiCutActive(newState);
    audioControls.setHiCut(newState);
  }, [audioControls, hiCutActive, deckId]);

  const toggleLoCut = useCallback(() => {
    if (!audioControls?.setLoCut) {
      console.warn(`🎛️ ${deckId} LO-CUT: audioControls not available`);
      return;
    }

    const newState = !loCutActive;
    setLoCutActive(newState);
    audioControls.setLoCut(newState);
  }, [audioControls, loCutActive, deckId]);

  const initXYPad = useCallback(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const xyPad = container.querySelector<HTMLDivElement>('.xy-pad');
    const filterPosition = container.querySelector<HTMLDivElement>('.xy-position.filter');
    const delayPosition = container.querySelector<HTMLDivElement>('.xy-position.delay');
    
    if (!xyPad || !filterPosition || !delayPosition) return;
    
    let isDragging = false;
    let currentX = 0.5;
    let currentY = 0.5;
    
    // Throttling for performance
    let lastUpdateTime = 0;
    let animationFrameId: number | null = null;
    
    const updatePosition = (e: { clientX: number; clientY: number }) => {
      if (xyPad.classList.contains('bypassed')) return;
      
      const rect = xyPad.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
      
      currentX = x;
      currentY = y;
      
      // Always update visual position for responsiveness
      const activePosition = currentEffectRef.current === 'filter' ? filterPosition : delayPosition;
      activePosition.style.left = (x * 100) + '%';
      activePosition.style.top = ((1 - y) * 100) + '%';
      
      // Throttle audio updates to 60fps
      const now = performance.now();
      if (now - lastUpdateTime >= PERFORMANCE_CONFIG.UPDATE_INTERVAL) {
        lastUpdateTime = now;
        
        // Cancel any pending updates
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        
        // Schedule audio update
        animationFrameId = requestAnimationFrame(() => {
          if (!fxChainRef.current) return;
          
          if (currentEffectRef.current === 'filter') {
            fxChainRef.current.updateFilter(x, y);
          } else if (currentEffectRef.current === 'delay') {
            fxChainRef.current.updateDelay(x, y);
          }
        });
      }
      
      if (isDragging) {
        activePosition.classList.add('dragging');
      }
    };
    
    // Store updatePosition so we can use it in resetToDefaults
    updatePositionRef.current = updatePosition;
    
    // Mouse events
    xyPad.addEventListener('mousedown', (e) => {
      if (xyPad.classList.contains('bypassed')) return;
      isDragging = true;
      updatePosition(e);
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        updatePosition(e);
      }
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
      filterPosition.classList.remove('dragging');
      delayPosition.classList.remove('dragging');
    });
    
    // Touch events
    xyPad.addEventListener('touchstart', (e) => {
      if (xyPad.classList.contains('bypassed')) return;
      isDragging = true;
      updatePosition(e.touches[0]);
      e.preventDefault();
    });
    
    document.addEventListener('touchmove', (e) => {
      if (isDragging) {
        updatePosition(e.touches[0]);
        e.preventDefault(); // Prevent scrolling
      }
    });
    
    document.addEventListener('touchend', () => {
      isDragging = false;
      filterPosition.classList.remove('dragging');
      delayPosition.classList.remove('dragging');
    });
    
    // Initialize center position
    const rect = xyPad.getBoundingClientRect();
    updatePosition({ 
      clientX: rect.left + rect.width / 2, 
      clientY: rect.top + rect.height / 2 
    });
  }, []);

  useEffect(() => {
    console.log(`🎛️ FX Component useEffect for ${deckId} - audioContext:`, !!audioContext, 'containerRef:', !!containerRef.current);
    
    if (!audioContext || !containerRef.current) {
      console.log(`🎛️ FX Component ${deckId} waiting for audioContext or container...`);
      return;
    }

    console.log(`🎛️ FX Component initializing for ${deckId}...`);

    // Create FX chain with current BPM
    const fxChain = new FXChain(audioContext, deckId, masterBPM);
    fxChainRef.current = fxChain;
    
    // Initialize with synthetic reverb
    fxChain.createSyntheticReverb();

    // Store audio nodes on the container for external access
    (containerRef.current as any).audioInput = fxChain.input;
    (containerRef.current as any).audioOutput = fxChain.output;
    
    console.log(`🎛️ FX Component audio chain created for ${deckId}`);
    console.log(`🎛️ Audio nodes stored - input:`, fxChain.input, 'output:', fxChain.output);

    // Setup UI interactions
    const container = containerRef.current;
    
    // No need to add event listeners - we're using React's onClick now
    console.log(`🎛️ FX UI ready for ${deckId}`);

    // XY Pad setup - delay to ensure DOM is ready
    setTimeout(() => {
      initXYPad();
    }, 0);

    // Keyboard shortcuts
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!container.matches(':hover')) return; // Only if hovering this deck
      
      switch(e.key.toLowerCase()) {
        case 'q':
          container.querySelector<HTMLButtonElement>('.fx-power-btn.filter')?.click();
          break;
        case 'w':
          container.querySelector<HTMLButtonElement>('.fx-power-btn.delay')?.click();
          break;
        case '1':
          container.querySelector<HTMLButtonElement>('.fx-select-btn[data-effect="filter"]')?.click();
          break;
        case '2':
          container.querySelector<HTMLButtonElement>('.fx-select-btn[data-effect="delay"]')?.click();
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeydown);

    console.log(`🎛️ FX Component fully initialized for ${deckId}`);

    return () => {
      console.log(`🎛️ FX Component cleanup for ${deckId}`);
      document.removeEventListener('keydown', handleKeydown);
      if (fxChainRef.current) {
        fxChainRef.current.destroy();
        fxChainRef.current = null;
      }
    };
  }, [audioContext, deckId]); // Remove callback deps to prevent re-render loops

  // Update BPM when masterBPM changes
  useEffect(() => {
    if (fxChainRef.current && masterBPM) {
      fxChainRef.current.setBPM(masterBPM);
    }
  }, [masterBPM]);

  // Method to reset FX to defaults (exposed via ref)
  useEffect(() => {
    if (!containerRef.current) return;
    
    (containerRef.current as any).resetToDefaults = () => {
      if (!containerRef.current || !updatePositionRef.current) return;
      
      const container = containerRef.current;
      
      // Reset XY pad to center (50%, 50%)
      const xyPad = container.querySelector<HTMLDivElement>('.xy-pad');
      if (xyPad) {
        const rect = xyPad.getBoundingClientRect();
        const centerEvent = { 
          clientX: rect.left + rect.width / 2, 
          clientY: rect.top + rect.height / 2 
        };
        
        // This will trigger the position update and parameter changes
        updatePositionRef.current(centerEvent);
      }
      
      // Make sure both effects are OFF by default
      container.querySelectorAll<HTMLButtonElement>('.fx-power-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Bypass both effects in the chain (OFF by default)
      if (fxChainRef.current) {
        fxChainRef.current.bypassEffect('filter', true);
        fxChainRef.current.bypassEffect('delay', true);
      }
    };
  }, []);

  // Combine refs
  React.useImperativeHandle(ref, () => containerRef.current!);

  return (
    <div ref={containerRef} className="fx-panel" data-deck={deckId}>
      {/* Control Bar */}
      <div className="fx-control-bar">
        {/* Filter */}
        <div className="fx-control-group">
          <button 
            className={`fx-select-btn ${currentEffect === 'filter' ? 'active' : ''}`}
            data-effect="filter"
            onClick={(e) => {
              console.log(`🎛️ Filter select clicked for ${deckId}`);
              selectEffect(e.currentTarget as HTMLButtonElement);
            }}
            style={{ cursor: 'pointer', userSelect: 'none', position: 'relative', zIndex: 10 }}
          >
            FLT
          </button>
          <button 
            className="fx-power-btn filter" 
            data-effect="filter"
            onClick={(e) => {
              console.log(`🎛️ Filter power clicked for ${deckId}`);
              togglePower(e.currentTarget as HTMLButtonElement);
            }}
            style={{ cursor: 'pointer', userSelect: 'none', position: 'relative', zIndex: 10 }}
          >
            <span className="power-icon">⏻</span>
          </button>
        </div>

        {/* Delay + Reverb */}
        <div className="fx-control-group">
          <button 
            className={`fx-select-btn ${currentEffect === 'delay' ? 'active' : ''}`}
            data-effect="delay"
            onClick={(e) => {
              console.log(`🎛️ Delay select clicked for ${deckId}`);
              selectEffect(e.currentTarget as HTMLButtonElement);
            }}
            style={{ cursor: 'pointer', userSelect: 'none', position: 'relative', zIndex: 10 }}
          >
            DLY
          </button>
          <button 
            className="fx-power-btn delay" 
            data-effect="delay"
            onClick={(e) => {
              console.log(`🎛️ Delay power clicked for ${deckId}`);
              togglePower(e.currentTarget as HTMLButtonElement);
            }}
            style={{ cursor: 'pointer', userSelect: 'none', position: 'relative', zIndex: 10 }}
          >
            <span className="power-icon">⏻</span>
          </button>
        </div>
      </div>

      {/* XY Pad Section */}
      <div className="xy-pad-container">
        <div className="xy-pad" data-deck={deckId}>
          <div className="xy-grid"></div>
          <div className="xy-center-lines"></div>
          <div className="xy-labels">
            <div className="xy-label xy-label-x">
              {currentEffect === 'filter' ? 'Resonance →' : 'Feedback + Space →'}
            </div>
            <div className="xy-label xy-label-y">
              {currentEffect === 'filter' ? '↑ Cutoff' : '↑ Time + Mix'}
            </div>
          </div>
          <div className="xy-position filter" style={{ display: currentEffect === 'filter' ? 'block' : 'none' }}></div>
          <div className="xy-position delay" style={{ display: currentEffect === 'delay' ? 'block' : 'none' }}></div>
        </div>
      </div>

      {/* EQ Section */}
      <div className="eq-section">
        <div className="eq-label">EQ</div>
        <div className="eq-controls">
          <button
            className={`eq-btn hi-cut ${hiCutActive ? 'active' : ''}`}
            onClick={toggleHiCut}
            title="High Cut - Remove highs above 2kHz (warm/muffled sound)"
          >
            <span className="eq-btn-label">HI CUT</span>
          </button>
          <button
            className={`eq-btn lo-cut ${loCutActive ? 'active' : ''}`}
            onClick={toggleLoCut}
            title="Low Cut - Remove lows below 500Hz (thin/no bass sound)"
          >
            <span className="eq-btn-label">LO CUT</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        /* Main FX Panel */
        .fx-panel {
          width: 200px;
          background: rgba(129, 228, 242, 0.03);
          border-radius: 12px;
          border: 1px solid rgba(129, 228, 242, 0.1);
          overflow: hidden;
        }

        /* Control Bar */
        .fx-control-bar {
          display: flex;
          gap: 8px;
          padding: 8px;
          background: rgba(0, 0, 0, 0.2);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* Each effect group */
        .fx-control-group {
          display: flex;
          gap: 4px;
          flex: 1;
          padding: 4px;
          border-radius: 8px;
          background: transparent;
          transition: background 0.3s ease;
        }

        /* Visual connection - subtle highlight when effect is selected */
        .fx-control-group:has(.fx-select-btn.active) {
          background: rgba(255, 255, 255, 0.05);
        }

        /* Effect selector button - flat design */
        .fx-select-btn {
          flex: 1;
          padding: 4px 4px;
          background: rgba(255, 255, 255, 0.08);
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.6);
        }

        .fx-select-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.8);
        }

        .fx-select-btn.active {
          background: rgba(129, 228, 242, 0.15);
          color: #fff;
          border: 1px solid rgba(129, 228, 242, 0.3);
        }

        /* Power button */
        .fx-power-btn {
          width: 28px;
          height: 28px;
          padding: 0;
          background: rgba(0, 0, 0, 0.4);
          border: 2px solid #4a4a4a;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .fx-power-btn:hover {
          background: rgba(0, 0, 0, 0.6);
          border-color: rgba(255, 255, 255, 0.4);
        }

        .power-icon {
          font-size: 18px;
          font-weight: bold;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1;
        }

        .fx-power-btn.active .power-icon {
          color: #fff;
        }

        /* Filter - Deep Blue */
        .fx-power-btn.filter.active {
          border-color: #4D5DE8;
        }

        /* Delay - Sky Blue */
        .fx-power-btn.delay.active {
          border-color: #4895EF;
        }

        /* XY Pad Container */
        .xy-pad-container {
          padding: 16px;
        }

        /* XY Pad */
        .xy-pad {
          width: 168px;
          height: 168px;
          background: #0a0b0f;
          border-radius: 8px;
          position: relative;
          cursor: crosshair;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.5);
          margin: 0 auto;
          transition: opacity 0.3s ease, filter 0.3s ease;
        }

        .xy-pad.bypassed {
          opacity: 0.4;
          filter: grayscale(50%);
          cursor: not-allowed;
        }

        /* Grid overlay */
        .xy-grid {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 42px 42px;
          pointer-events: none;
        }

        /* Center lines */
        .xy-center-lines {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
        }

        .xy-center-lines::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
        }

        .xy-center-lines::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          width: 1px;
          background: rgba(255, 255, 255, 0.1);
        }

        /* XY Labels */
        .xy-labels {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
        }

        .xy-label {
          position: absolute;
          font-size: 10px;
          text-transform: uppercase;
          opacity: 0.5;
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        .xy-label-x {
          bottom: 6px;
          right: 6px;
        }

        .xy-label-y {
          top: 6px;
          left: 6px;
        }

        /* XY Position Indicator */
        .xy-position {
          position: absolute;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          left: 50%;
          top: 50%;
          transition: opacity 0.3s;
        }

        .xy-position.filter {
          background: #4D5DE8;
          border: 2px solid #4D5DE8;
        }

        .xy-position.delay {
          background: #4895EF;
          border: 2px solid #4895EF;
        }

        .xy-position.dragging {
          transform: translate(-50%, -50%) scale(1.2);
        }

        .xy-pad.bypassed .xy-position {
          opacity: 0.3;
        }

        /* EQ Section */
        .eq-section {
          padding: 12px 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .eq-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 8px;
          font-weight: 600;
          text-align: center;
        }

        .eq-controls {
          display: flex;
          gap: 8px;
        }

        .eq-btn {
          flex: 1;
          padding: 8px 4px;
          background: rgba(0, 0, 0, 0.4);
          border: 2px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .eq-btn:hover {
          background: rgba(0, 0, 0, 0.6);
          border-color: rgba(255, 255, 255, 0.3);
        }

        .eq-btn-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.6);
          display: block;
          text-align: center;
        }

        /* Hi-Cut (Orange glow when active) */
        .eq-btn.hi-cut.active {
          border-color: #FF9500;
          box-shadow: 0 0 12px rgba(255, 149, 0, 0.4), inset 0 0 8px rgba(255, 149, 0, 0.2);
          background: rgba(255, 149, 0, 0.1);
        }

        .eq-btn.hi-cut.active .eq-btn-label {
          color: #FFB340;
        }

        /* Lo-Cut (Purple glow when active) */
        .eq-btn.lo-cut.active {
          border-color: #A855F7;
          box-shadow: 0 0 12px rgba(168, 85, 247, 0.4), inset 0 0 8px rgba(168, 85, 247, 0.2);
          background: rgba(168, 85, 247, 0.1);
        }

        .eq-btn.lo-cut.active .eq-btn-label {
          color: #C084FC;
        }

      `}</style>
    </div>
  );
}));

FXComponent.displayName = 'FXComponent';

export default FXComponent;