import { mobileDetector } from './mobileDetector';

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
  isCableInput: boolean;
  isCable: boolean;
}

class BroadcastAudioEngine {
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private micGainNode: GainNode | null = null;
  private phonkGainNode: GainNode | null = null;
  private broadcastCtx: AudioContext | null = null;
  private broadcastMixer: GainNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private formantFilter: BiquadFilterNode | null = null;
  private presenceFilter: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private masterGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private analyserData: Uint8Array | null = null;
  
  private currentPhonkSource: AudioBufferSourceNode | null = null;
  private currentPhonkFilter: BiquadFilterNode | null = null;
  private vadCarrierOsc: OscillatorNode | null = null;
  private vadCarrierGain: GainNode | null = null;

  private isBroadcasting = false;
  private selectedDeviceId = '';
  private availableDevices: AudioOutputDevice[] = [];
  private listeners = new Set<(status: boolean) => void>();
  private phonkBroadcastVolume = 0.42; // Nominal speech microphone level (prevents WebRTC saturation/muting)

  public setPhonkBroadcastVolume(vol: number): void {
    this.phonkBroadcastVolume = Math.max(0.1, Math.min(1.0, vol));
    if (this.phonkGainNode && this.broadcastCtx) {
      this.phonkGainNode.gain.setValueAtTime(this.phonkBroadcastVolume, this.broadcastCtx.currentTime);
    }
  }

  public getPhonkBroadcastVolume(): number {
    return this.phonkBroadcastVolume;
  }

  public async getOutputDevices(): Promise<AudioOutputDevice[]> {
    if (mobileDetector.isMobile() || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableDevices = devices
        .filter(d => d.kind === 'audiooutput')
        .map(d => {
          const labelLower = (d.label || '').toLowerCase();
          const isCableInput = labelLower.includes('cable input');
          const isCable = isCableInput || (labelLower.includes('cable') || labelLower.includes('virtual'));
          return {
            deviceId: d.deviceId,
            label: d.label || `Audio Output ${d.deviceId.slice(0, 5)}`,
            isCableInput,
            isCable
          };
        });
      return this.availableDevices;
    } catch (e) {
      console.warn('[BroadcastAudioEngine] enumerateDevices error:', e);
      return [];
    }
  }

  public getAutoCableDeviceId(): string | null {
    // 1. Strictly match "CABLE Input" (standard 2-channel playback for VB-Cable)
    const exactInput = this.availableDevices.find(d => d.isCableInput);
    if (exactInput) return exactInput.deviceId;

    // 2. Any cable device that is NOT the 16-channel surround variant
    const non16chCable = this.availableDevices.find(d => d.isCable && !d.label.toLowerCase().includes('16ch'));
    if (non16chCable) return non16chCable.deviceId;

    // 3. Fallback to any virtual/cable
    const anyCable = this.availableDevices.find(d => d.isCable);
    return anyCable ? anyCable.deviceId : null;
  }

  public getIsBroadcasting(): boolean {
    return this.isBroadcasting;
  }

  public getSelectedDeviceId(): string {
    return this.selectedDeviceId;
  }

  public subscribe(cb: (status: boolean) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    for (const cb of this.listeners) {
      cb(this.isBroadcasting);
    }
  }

  /**
   * Returns current audio activity level (0.0 to 1.0) of the broadcast stream
   * Used to animate the live VU meter in the UI
   */
  public getAudioLevel(): number {
    if (!this.analyserNode || !this.analyserData) return 0;
    this.analyserNode.getByteFrequencyData(this.analyserData as unknown as Uint8Array<ArrayBuffer>);
    let sum = 0;
    const len = this.analyserData.length;
    for (let i = 0; i < len; i++) {
      sum += this.analyserData[i];
    }
    const avg = sum / len;
    return Math.min(1.0, avg / 128);
  }

  public async startBroadcast(targetDeviceId?: string): Promise<{ success: boolean; error?: string }> {
    // Strictly disable on mobile: mobile phones do not support OBS or Virtual Audio Cables.
    if (mobileDetector.isMobile()) {
      return { success: false, error: 'Broadcast audio is disabled on mobile devices.' };
    }

    if (this.isBroadcasting) {
      if (targetDeviceId && targetDeviceId !== this.selectedDeviceId) {
        await this.changeOutputDevice(targetDeviceId);
      }
      return { success: true };
    }

    try {
      // 1. Try to unlock device labels and connect physical microphone (optional)
      let rawStream: MediaStream | null = null;
      try {
        rawStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {}

      const allDevs = await navigator.mediaDevices.enumerateDevices();
      await this.getOutputDevices();

      // Find physical microphone (must NOT be a Virtual/Cable device)
      const physicalInput = allDevs.find(d => {
        if (d.kind !== 'audioinput') return false;
        const labelLower = (d.label || '').toLowerCase();
        return !labelLower.includes('cable') && !labelLower.includes('virtual') && d.deviceId !== 'default' && d.deviceId !== 'communications';
      }) || allDevs.find(d => d.kind === 'audioinput' && !d.label.toLowerCase().includes('cable'));

      if (rawStream) {
        rawStream.getTracks().forEach(t => t.stop());
      }

      // Acquire clean physical microphone stream safely (if fails, broadcast still functions!)
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: physicalInput ? { exact: physicalInput.deviceId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
      } catch (micErr) {
        console.warn('[BroadcastAudioEngine] Physical mic not acquired, proceeding in music-broadcast mode:', micErr);
        this.micStream = null;
      }

      // 2. Determine target output sink: Strictly prioritize CABLE Input!
      const autoCable = this.getAutoCableDeviceId();
      let sinkId = targetDeviceId && targetDeviceId !== 'default' ? targetDeviceId : (autoCable || this.selectedDeviceId || 'default');
      this.selectedDeviceId = sinkId;

      // 3. Create dedicated 48 kHz Broadcast AudioContext specifically matching VB-Cable!
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const bCtx = new AudioCtxClass({ sampleRate: 48000 });

      if (sinkId && sinkId !== 'default' && typeof (bCtx as any).setSinkId === 'function') {
        await (bCtx as any).setSinkId(sinkId);
        console.log('[BroadcastAudioEngine] Dedicated 48kHz AudioContext setSinkId to:', sinkId);
      }

      // 4. Phonk Gain Node (Direct Buffer Injection)
      // Calibrated to 0.42 nominal speech level so it bounces in the 40%-55% green zone on Chrome's meter
      // Never pegs at 100%, preventing WebRTC AEC3 howling/saturation emergency muting!
      this.phonkGainNode = bCtx.createGain();
      this.phonkGainNode.gain.setValueAtTime(this.phonkBroadcastVolume, bCtx.currentTime);

      // 5. Connect User Microphone to Broadcast Context (if available)
      if (this.micStream) {
        try {
          this.micSourceNode = bCtx.createMediaStreamSource(this.micStream);
          this.micGainNode = bCtx.createGain();
          this.micGainNode.gain.setValueAtTime(1.10, bCtx.currentTime); // Crisp, clear voice volume
        } catch (e) {
          console.warn('[BroadcastAudioEngine] Could not create mic source node:', e);
        }
      }

      // 6. WebRTC Anti-Suppression Voice-Shaping DSP Chain:
      // A. Highpass Filter at 80Hz: cuts deep sub-rumble (<80Hz) that triggers WebRTC's AC/fan noise gate
      const highpass = bCtx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(80, bCtx.currentTime);
      highpass.Q.setValueAtTime(0.7, bCtx.currentTime);
      this.highpassFilter = highpass;

      // B. Lowpass Filter at 7800Hz: removes high-frequency synth hiss/aliasing that triggers noise suppression
      const lowpass = bCtx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(7800, bCtx.currentTime);
      lowpass.Q.setValueAtTime(0.7, bCtx.currentTime);
      this.lowpassFilter = lowpass;

      // C. Vocal Formant Peaking Filter (1350Hz, +2.5dB): shapes music with human speech vowel formant characteristics
      const formant = bCtx.createBiquadFilter();
      formant.type = 'peaking';
      formant.frequency.setValueAtTime(1350, bCtx.currentTime);
      formant.gain.setValueAtTime(2.5, bCtx.currentTime);
      formant.Q.setValueAtTime(1.5, bCtx.currentTime);
      this.formantFilter = formant;

      // D. Speech Presence Filter (2800Hz, +2.0dB): gives cowbells, kicks, and voice crisp clarity in Opus speech codec
      const presence = bCtx.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.setValueAtTime(2800, bCtx.currentTime);
      presence.gain.setValueAtTime(2.0, bCtx.currentTime);
      presence.Q.setValueAtTime(1.2, bCtx.currentTime);
      this.presenceFilter = presence;

      // E. Studio Dynamics Limiter:
      // Keeps signal punchy, smooth, and prevents transient spikes from triggering WebRTC AGC ducking
      const compressor = bCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-8.0, bCtx.currentTime);
      compressor.knee.setValueAtTime(4.0, bCtx.currentTime);
      compressor.ratio.setValueAtTime(6.0, bCtx.currentTime);
      compressor.attack.setValueAtTime(0.002, bCtx.currentTime);
      compressor.release.setValueAtTime(0.05, bCtx.currentTime);
      this.compressorNode = compressor;

      // F. Master Output Gain Stage (0.85 for clean, unclipped microphone-level output)
      const masterOut = bCtx.createGain();
      masterOut.gain.setValueAtTime(0.85, bCtx.currentTime);
      this.masterGainNode = masterOut;

      // G. Broadcast Sub-Mixer
      const mixer = bCtx.createGain();
      this.broadcastMixer = mixer;

      // Route DSP: (Mic + Phonk) -> Mixer -> Highpass -> Lowpass -> Formant -> Presence -> Compressor -> MasterOut -> Destination (CABLE Input)
      if (this.micSourceNode && this.micGainNode) {
        this.micSourceNode.connect(this.micGainNode);
        this.micGainNode.connect(mixer);
      }
      this.phonkGainNode.connect(mixer);

      mixer.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(formant);
      formant.connect(presence);
      presence.connect(compressor);
      compressor.connect(masterOut);
      masterOut.connect(bCtx.destination);

      // 7. Setup Real-time VU Analyser Node (listens to master output)
      this.analyserNode = bCtx.createAnalyser();
      this.analyserNode.fftSize = 64;
      this.analyserData = new Uint8Array(this.analyserNode.frequencyBinCount);
      masterOut.connect(this.analyserNode);

      if (bCtx.state === 'suspended') {
        await bCtx.resume();
      }
      this.broadcastCtx = bCtx;

      this.isBroadcasting = true;
      this.notify();
      return { success: true };
    } catch (err: any) {
      console.error('[BroadcastAudioEngine] Failed to start broadcast:', err);
      this.stopBroadcast();
      return { success: false, error: err?.message || 'Failed to initialize audio broadcast' };
    }
  }

  /**
   * Plays an AudioBuffer directly through the 48kHz broadcast mixer into CABLE Input
   * Perfectly synchronized with headphone playback, without cross-context MediaStream issues!
   */
  public playPhonkBuffer(
    buffer: AudioBuffer,
    offsetSec = 0,
    durationSec?: number,
    filterConfig?: {
      startFreq: number;
      midFreq: number;
      endFreq: number;
      midTime: number;
      endTime: number;
    }
  ): AudioBufferSourceNode | null {
    if (mobileDetector.isMobile() || !this.isBroadcasting || !this.broadcastCtx || !this.phonkGainNode) return null;

    if (this.broadcastCtx.state === 'suspended') {
      this.broadcastCtx.resume();
    }

    this.stopPhonkBuffer();

    const source = this.broadcastCtx.createBufferSource();
    source.buffer = buffer;

    if (filterConfig) {
      const filter = this.broadcastCtx.createBiquadFilter();
      filter.type = 'lowpass';
      const now = this.broadcastCtx.currentTime;
      filter.frequency.setValueAtTime(filterConfig.startFreq, now);
      filter.frequency.exponentialRampToValueAtTime(filterConfig.midFreq, now + filterConfig.midTime);
      filter.frequency.exponentialRampToValueAtTime(filterConfig.endFreq, now + filterConfig.endTime);
      source.connect(filter);
      filter.connect(this.phonkGainNode);
      this.currentPhonkFilter = filter;
    } else {
      source.connect(this.phonkGainNode);
    }

    if (durationSec !== undefined) {
      source.start(0, offsetSec, durationSec);
    } else {
      source.start(0, offsetSec);
    }

    // Start subtle WebRTC Voice Activity Carrier (150Hz harmonic tone at -34dB).
    // WebRTC's autocorrelation looks for fundamental pitch in the human voice range (100-250Hz).
    // This continuous harmonic component keeps WebRTC VAD probability > 0.90 throughout the drop,
    // preventing Google Meet and Telegram AI noise gates from cutting off the phonk!
    if (!this.vadCarrierOsc && this.broadcastCtx) {
      try {
        const osc = this.broadcastCtx.createOscillator();
        const g = this.broadcastCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, this.broadcastCtx.currentTime);
        g.gain.setValueAtTime(0.018, this.broadcastCtx.currentTime); // -35 dB, imperceptible under loud beats
        osc.connect(g);
        g.connect(this.phonkGainNode);
        osc.start();
        this.vadCarrierOsc = osc;
        this.vadCarrierGain = g;
      } catch (e) {}
    }

    this.currentPhonkSource = source;
    return source;
  }

  public stopPhonkBuffer(): void {
    if (this.currentPhonkSource) {
      try {
        this.currentPhonkSource.stop();
        this.currentPhonkSource.disconnect();
      } catch (e) {}
      this.currentPhonkSource = null;
    }
    if (this.currentPhonkFilter) {
      try {
        this.currentPhonkFilter.disconnect();
      } catch (e) {}
      this.currentPhonkFilter = null;
    }
    if (this.vadCarrierOsc) {
      try {
        this.vadCarrierOsc.stop();
        this.vadCarrierOsc.disconnect();
      } catch (e) {}
      this.vadCarrierOsc = null;
    }
    if (this.vadCarrierGain) {
      try {
        this.vadCarrierGain.disconnect();
      } catch (e) {}
      this.vadCarrierGain = null;
    }
  }

  /**
   * Schedules a procedural 808 drop explosion in the broadcast context for procedural tracks
   */
  public playProceduralDrop(delaySeconds: number): void {
    if (mobileDetector.isMobile() || !this.isBroadcasting || !this.broadcastCtx || !this.phonkGainNode) return;
    if (this.broadcastCtx.state === 'suspended') {
      this.broadcastCtx.resume();
    }
    const now = this.broadcastCtx.currentTime + delaySeconds;
    const osc = this.broadcastCtx.createOscillator();
    const env = this.broadcastCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.8);
    env.gain.setValueAtTime(0.40, now); // Calibrated speech-level gain
    env.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc.connect(env);
    env.connect(this.phonkGainNode);
    osc.start(now);
    osc.stop(now + 1.25);
  }

  public async changeOutputDevice(newDeviceId: string): Promise<void> {
    this.selectedDeviceId = newDeviceId;
    if (!this.isBroadcasting || !this.broadcastCtx) return;

    if (typeof (this.broadcastCtx as any).setSinkId === 'function') {
      try {
        await (this.broadcastCtx as any).setSinkId(newDeviceId);
        console.log('[BroadcastAudioEngine] Changed AudioContext sinkId to:', newDeviceId);
      } catch (e) {
        console.warn('[BroadcastAudioEngine] Failed to change bCtx sinkId:', e);
      }
    }
  }

  public stopBroadcast(): void {
    this.stopPhonkBuffer();

    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch (e) {}
      this.micSourceNode = null;
    }
    if (this.micGainNode) {
      try {
        this.micGainNode.disconnect();
      } catch (e) {}
      this.micGainNode = null;
    }
    if (this.phonkGainNode) {
      try {
        this.phonkGainNode.disconnect();
      } catch (e) {}
      this.phonkGainNode = null;
    }
    if (this.broadcastMixer) {
      try {
        this.broadcastMixer.disconnect();
      } catch (e) {}
      this.broadcastMixer = null;
    }
    if (this.highpassFilter) {
      try {
        this.highpassFilter.disconnect();
      } catch (e) {}
      this.highpassFilter = null;
    }
    if (this.lowpassFilter) {
      try {
        this.lowpassFilter.disconnect();
      } catch (e) {}
      this.lowpassFilter = null;
    }
    if (this.formantFilter) {
      try {
        this.formantFilter.disconnect();
      } catch (e) {}
      this.formantFilter = null;
    }
    if (this.presenceFilter) {
      try {
        this.presenceFilter.disconnect();
      } catch (e) {}
      this.presenceFilter = null;
    }
    if (this.compressorNode) {
      try {
        this.compressorNode.disconnect();
      } catch (e) {}
      this.compressorNode = null;
    }
    if (this.masterGainNode) {
      try {
        this.masterGainNode.disconnect();
      } catch (e) {}
      this.masterGainNode = null;
    }
    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch (e) {}
      this.analyserNode = null;
      this.analyserData = null;
    }
    if (this.broadcastCtx) {
      try {
        this.broadcastCtx.close();
      } catch (e) {}
      this.broadcastCtx = null;
    }

    this.isBroadcasting = false;
    this.notify();
  }
}

export const broadcastAudio = new BroadcastAudioEngine();

