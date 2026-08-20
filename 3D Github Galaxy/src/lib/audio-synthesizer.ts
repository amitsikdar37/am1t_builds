/**
 * Web Audio API Synthesizer for 3D GitHub Galaxy
 * Provides procedural deep space ambient drone, warp flight whooshes, and star resonance frequencies
 */

class SpaceAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // Audio Nodes
  private masterGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private lfoOsc: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.22, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Lowpass filter for deep space warmth
      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.setValueAtTime(160, this.ctx.currentTime);
      this.droneFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);
      this.droneFilter.connect(this.masterGain);

      // Primary Sub-Bass Drone (Fundamental ~ 55Hz - A1 note)
      this.droneOsc1 = this.ctx.createOscillator();
      this.droneOsc1.type = 'sawtooth';
      this.droneOsc1.frequency.setValueAtTime(55, this.ctx.currentTime);

      // Secondary Harmonic Drone (Fifth ~ 82.5Hz - E2 note with subtle detune)
      this.droneOsc2 = this.ctx.createOscillator();
      this.droneOsc2.type = 'sine';
      this.droneOsc2.frequency.setValueAtTime(82.4, this.ctx.currentTime);
      this.droneOsc2.detune.setValueAtTime(4, this.ctx.currentTime);

      // LFO for slow atmospheric breathing / cosmic pulse (0.15 Hz)
      this.lfoOsc = this.ctx.createOscillator();
      this.lfoOsc.type = 'sine';
      this.lfoOsc.frequency.setValueAtTime(0.12, this.ctx.currentTime);

      this.lfoGain = this.ctx.createGain();
      this.lfoGain.gain.setValueAtTime(35, this.ctx.currentTime); // mod range 35Hz

      this.lfoOsc.connect(this.lfoGain);
      this.lfoGain.connect(this.droneFilter.frequency);

      // Connect drone oscillators through filter
      this.droneOsc1.connect(this.droneFilter);
      this.droneOsc2.connect(this.droneFilter);

      // Start oscillators
      this.droneOsc1.start();
      this.droneOsc2.start();
      this.lfoOsc.start();

      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported or blocked by browser policy:', e);
    }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (!this.masterGain || !this.ctx) return;
    
    const targetGain = muted ? 0 : 0.22;
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.3);
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Modulate space drone pitch & harmonics when focusing on a star system
   */
  public tuneToStarSystem(stars: number, distance: number) {
    if (!this.ctx || !this.droneOsc1 || !this.droneOsc2 || !this.droneFilter || this.isMuted) return;

    this.resume();

    // High-star systems have richer, higher harmonics; distant systems have lower sub-rumble
    const baseFreq = 50 + Math.min(stars * 0.12, 45);
    const filterFreq = 140 + Math.min(stars * 0.2, 180);

    const now = this.ctx.currentTime;
    this.droneOsc1.frequency.cancelScheduledValues(now);
    this.droneOsc1.frequency.exponentialRampToValueAtTime(Math.max(40, baseFreq), now + 1.2);

    this.droneOsc2.frequency.cancelScheduledValues(now);
    this.droneOsc2.frequency.exponentialRampToValueAtTime(Math.max(60, baseFreq * 1.5), now + 1.2);

    this.droneFilter.frequency.cancelScheduledValues(now);
    this.droneFilter.frequency.linearRampToValueAtTime(filterFreq, now + 1.5);
  }

  /**
   * Reset drone to galactic overview ambient state
   */
  public resetToOverview() {
    if (!this.ctx || !this.droneOsc1 || !this.droneOsc2 || !this.droneFilter || this.isMuted) return;

    const now = this.ctx.currentTime;
    this.droneOsc1.frequency.cancelScheduledValues(now);
    this.droneOsc1.frequency.exponentialRampToValueAtTime(55, now + 1.5);

    this.droneOsc2.frequency.cancelScheduledValues(now);
    this.droneOsc2.frequency.exponentialRampToValueAtTime(82.4, now + 1.5);

    this.droneFilter.frequency.cancelScheduledValues(now);
    this.droneFilter.frequency.linearRampToValueAtTime(160, now + 1.5);
  }

  /**
   * Cinematic hyperspace / warp whoosh when camera zooms into a star
   */
  public triggerWarpWhoosh() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;

      // Noise buffer for atmospheric rushing wind
      const bufferSize = this.ctx.sampleRate * 1.2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(300, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(1400, now + 0.6);
      noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 1.2);
      noiseFilter.Q.setValueAtTime(2.5, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.01, now);
      noiseGain.gain.linearRampToValueAtTime(0.18, now + 0.3);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noise.start(now);
      noise.stop(now + 1.2);
    } catch {
      // Ignore if sound creation fails
    }
  }

  /**
   * Sci-fi chime when clicking UI or selecting star
   */
  public triggerStarChime(freq: number = 880) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.15);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // Ignore
    }
  }
}

export const spaceAudio = new SpaceAudioSynthesizer();
