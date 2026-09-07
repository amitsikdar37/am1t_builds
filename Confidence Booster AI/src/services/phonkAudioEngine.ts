import { PhonkTrackId, PhonkTrackInfo } from '../types';

export const PHONK_TRACKS: Record<PhonkTrackId, PhonkTrackInfo> = {
  marlon_mogged: {
    id: 'marlon_mogged',
    title: 'MARLON GETS MOGGED (VIRAL 2026)',
    bpm: 104,
    vibe: 'Wasted Effect + Slowed Mog Beat',
    dropDelaySeconds: 4.7, // Wasted effect hits at 4.7s (stays 1s), then 808 drop at 6.5s
  },
  tokyo_drift: {
    id: 'tokyo_drift',
    title: 'TOKYO DRIFT PHONK',
    bpm: 140,
    vibe: 'Aggressive 808 Cowbell Drift',
    dropDelaySeconds: 1.6,
  },
  cyber_sigma: {
    id: 'cyber_sigma',
    title: 'CYBER SIGMA 2077',
    bpm: 130,
    vibe: 'Dark Cyberpunk Trap & Glitch',
    dropDelaySeconds: 1.5,
  },
  gigachad_anthem: {
    id: 'gigachad_anthem',
    title: 'GIGACHAD ASCENDED',
    bpm: 145,
    vibe: 'Triumphant Sigma Cowbell Anthem',
    dropDelaySeconds: 1.4,
  }
};

class PhonkAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private recordingDestination: MediaStreamAudioDestinationNode | null = null;
  private isPlaying = false;
  private activeTimers: number[] = [];
  private volume = 0.9;
  private muted = false;

  // Custom audio file for the viral mog edit
  private moggedAudioBuffer: AudioBuffer | null = null;
  private currentAudioSource: AudioBufferSourceNode | null = null;
  private isPreloadingAudio = false;

  private initContext() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);

      this.recordingDestination = this.ctx.createMediaStreamDestination();
      
      // Connect master to speakers and recording destination
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.connect(this.recordingDestination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Pre-loads and decodes the viral "Marlon gets mogged" audio file
   */
  public async preloadMoggedAudio(): Promise<void> {
    if (this.moggedAudioBuffer || this.isPreloadingAudio) return;
    this.isPreloadingAudio = true;
    this.initContext();

    try {
      // Fetch from public folder
      const audioUrl = '/audios/marlon_gets_mogged.mp3';
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      if (this.ctx) {
        this.moggedAudioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        console.log('Viral Mog Audio loaded successfully! Duration:', this.moggedAudioBuffer.duration.toFixed(2), 's');
      }
    } catch (err) {
      console.warn('Could not load custom mog audio file, will use procedural fallback:', err);
    } finally {
      this.isPreloadingAudio = false;
    }
  }

  public getAudioStream(): MediaStream | null {
    this.initContext();
    return this.recordingDestination ? this.recordingDestination.stream : null;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.muted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getVolume(): number {
    return this.volume;
  }

  // --- Sound Generation Primitives ---

  // Distortion curve for crunchy Phonk saturation
  private makeDistortionCurve(amount = 25): Float32Array {
    const n = 256;
    const buffer = new ArrayBuffer(n * 4);
    const curve = new Float32Array(buffer);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve as unknown as Float32Array;
  }

  // Classic 808 Phonk Cowbell (2 detuned square waves + bandpass + drive)
  private playPhonkCowbell(time: number, freq: number, gainVal = 0.6) {
    if (!this.ctx || !this.masterGain) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'square';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq * 1.485, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.2, time);
    filter.Q.setValueAtTime(4.0, time);

    const distortion = this.ctx.createWaveShaper();
    distortion.curve = this.makeDistortionCurve(18) as any;
    distortion.oversample = '2x';

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gainVal, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(distortion);
    distortion.connect(env);
    env.connect(this.masterGain);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.36);
    osc2.stop(time + 0.36);
  }

  // Punchy 808 Kick Drum with pitch envelope
  private playKick(time: number, punch = 1.0) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.08);

    env.gain.setValueAtTime(punch, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.36);
  }

  // Deep Sliding 808 Sub-Bass with overdrive crunch
  private play808Sub(time: number, duration: number, startFreq: number, endFreq: number, gainVal = 0.9) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    const distortion = this.ctx.createWaveShaper();
    distortion.curve = this.makeDistortionCurve(10) as any;

    osc.type = 'sawtooth';
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(180, time);

    osc.frequency.setValueAtTime(startFreq * 1.5, time);
    osc.frequency.exponentialRampToValueAtTime(startFreq, time + 0.03);
    if (startFreq !== endFreq) {
      osc.frequency.linearRampToValueAtTime(endFreq, time + duration * 0.8);
    }

    env.gain.setValueAtTime(0.01, time);
    env.gain.linearRampToValueAtTime(gainVal, time + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(lp);
    lp.connect(distortion);
    distortion.connect(env);
    env.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  // Trap Hi-Hat (Bandpassed metallic noise)
  private playHiHat(time: number, open = false, volume = 0.3) {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * (open ? 0.2 : 0.05);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, time);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(volume, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + (open ? 0.2 : 0.04));

    noise.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + (open ? 0.21 : 0.05));
  }

  // Snappy Trap Snare / Clap
  private playSnare(time: number) {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 0.18;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, time);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.5, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    noise.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.exponentialRampToValueAtTime(90, time + 0.1);

    const bodyEnv = this.ctx.createGain();
    bodyEnv.gain.setValueAtTime(0.4, time);
    bodyEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    osc.connect(bodyEnv);
    bodyEnv.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + 0.19);
    osc.start(time);
    osc.stop(time + 0.13);
  }

  // Tactical Riser / Sweep for edit build-up
  private playRiser(time: number, duration: number) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, time);
    osc.frequency.exponentialRampToValueAtTime(1200, time + duration);

    env.gain.setValueAtTime(0.01, time);
    env.gain.linearRampToValueAtTime(0.35, time + duration * 0.9);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  // Massive Bass Drop Explosion
  public playBassDropImpact(timeOffset = 0) {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime + timeOffset;

    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.8);

    env.gain.setValueAtTime(1.0, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.25);

    this.playKick(now, 1.2);
  }

  // --- Voice / Meme Soundboard Line ---
  public playMemeSound(soundName: string) {
    this.initContext();
    if (!this.ctx) return;

    if (soundName === 'bass_cannon') {
      this.playBassDropImpact(0);
      return;
    }

    if (soundName === 'vinyl_scratch') {
      this.playVinylScratch();
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(soundName);
      utterance.pitch = 0.6;
      utterance.rate = 1.1;
      utterance.volume = this.muted ? 0 : this.volume;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Male') || v.name.includes('Natural') || v.name.includes('David')));
      if (preferredVoice) utterance.voice = preferredVoice;

      window.speechSynthesis.speak(utterance);
    }
  }

  private playVinylScratch() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2500, now);
    osc.frequency.linearRampToValueAtTime(400, now + 0.12);
    osc.frequency.linearRampToValueAtTime(1800, now + 0.22);
    env.gain.setValueAtTime(0.4, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  // --- Phonk Track Sequencing ---

  /**
   * Starts playing the selected Phonk edit sequence synced precisely with the edit timeline!
   * @param trackId Selected track (defaults to 'marlon_mogged')
   * @param onDropCallback Fired exactly when the beat drop hits
   */
  public async playEditSequence(
    trackId: PhonkTrackId = 'marlon_mogged',
    onDropCallback?: () => void
  ) {
    this.initContext();
    this.stop();
    this.isPlaying = true;

    if (!this.ctx) return;

    // 1. If using the viral mogged audio (or default)
    if (trackId === 'marlon_mogged') {
      if (!this.moggedAudioBuffer) {
        await this.preloadMoggedAudio();
      }

      if (this.moggedAudioBuffer && this.isPlaying) {
        const source = this.ctx.createBufferSource();
        source.buffer = this.moggedAudioBuffer;
        source.connect(this.masterGain!);
        source.start(0);
        this.currentAudioSource = source;

        // Schedule Drop impact at 4.7s (Wasted mogged effect) and 6.5s (808 drop)
        const dropTimer = window.setTimeout(() => {
          if (this.isPlaying && onDropCallback) {
            onDropCallback();
          }
        }, 4700);
        this.activeTimers.push(dropTimer);

        const beatDropTimer = window.setTimeout(() => {
          if (this.isPlaying && onDropCallback) {
            onDropCallback();
          }
        }, 6500);
        this.activeTimers.push(beatDropTimer);
        return;
      }
    }

    // 2. Procedural Fallback if another track is picked
    const track = PHONK_TRACKS[trackId] || PHONK_TRACKS.tokyo_drift;
    const startTime = this.ctx.currentTime + 0.05;
    const dropTime = startTime + track.dropDelaySeconds;
    const beatDuration = 60 / track.bpm;
    const sixteenth = beatDuration / 4;

    this.playRiser(startTime, track.dropDelaySeconds);

    let rollTime = startTime + 0.2;
    let rollInterval = beatDuration;
    while (rollTime < dropTime - 0.1) {
      this.playSnare(rollTime);
      this.playHiHat(rollTime, false, 0.25);
      rollInterval *= 0.85;
      rollTime += Math.max(rollInterval, sixteenth);
    }

    const dropTimerDelayMs = (dropTime - this.ctx.currentTime) * 1000;
    const dropTimer = window.setTimeout(() => {
      if (this.isPlaying && onDropCallback) {
        onDropCallback();
      }
    }, Math.max(0, dropTimerDelayMs));
    this.activeTimers.push(dropTimer);

    this.playBassDropImpact(track.dropDelaySeconds);

    const cowbellNotes = [740, 880, 988, 1109, 880, 740, 659, 740, 988, 1109, 1319, 1109];
    const dropLengthBeats = 16;
    for (let b = 0; b < dropLengthBeats; b++) {
      const beatTime = dropTime + b * beatDuration;

      if (b % 2 === 0 || b === 3 || b === 7 || b === 11 || b === 14) {
        this.playKick(beatTime, 1.1);
      }

      if (b % 2 === 1) {
        this.playSnare(beatTime);
      }

      if (b % 4 === 0) {
        this.play808Sub(beatTime, beatDuration * 1.8, 46.2, 55.0, 0.95);
      } else if (b % 4 === 2) {
        this.play808Sub(beatTime, beatDuration * 1.8, 41.2, 46.2, 0.95);
      }

      for (let s = 0; s < 4; s++) {
        const subTime = beatTime + s * sixteenth;
        const isRoll = (b === 3 || b === 7 || b === 11) && s >= 2;
        if (isRoll) {
          this.playHiHat(subTime, false, 0.35);
          this.playHiHat(subTime + sixteenth / 2, false, 0.25);
        } else {
          this.playHiHat(subTime, s === 0 && b % 2 === 1, 0.3);
        }
      }

      const note1 = cowbellNotes[(b * 2) % cowbellNotes.length];
      const note2 = cowbellNotes[(b * 2 + 1) % cowbellNotes.length];
      this.playPhonkCowbell(beatTime, note1, 0.65);
      this.playPhonkCowbell(beatTime + sixteenth * 2, note2, 0.6);
    }
  }

  public stop() {
    this.isPlaying = false;
    this.activeTimers.forEach(t => clearTimeout(t));
    this.activeTimers = [];

    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
        this.currentAudioSource.disconnect();
      } catch {}
      this.currentAudioSource = null;
    }
  }
}

export const phonkAudio = new PhonkAudioEngine();
