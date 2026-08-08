/**
 * Background music.
 *
 * Autoplay is gated everywhere: the track only starts after the user taps the
 * "Enter" button, which is both what the browser requires and what feels right —
 * the recipient chooses when to step in, rather than being blasted immediately.
 *
 * Volume is sender-configurable via gift.json, and the track fades up gently
 * rather than punching in at full level.
 */

export function createMusic(src, volume = 0.5) {
  const silentLevels = Object.freeze({
    active: false,
    bass: 0,
    mid: 0,
    treble: 0,
    energy: 0,
    pulse: 0,
    beatId: 0,
  });

  // Keep the same interface with or without a soundtrack. Finale code should
  // never have to know whether the sender attached music.
  if (!src) {
    return {
      play() { }, stop() { }, fadeIn() { }, fadeOut() { }, setVolume() { }, swell() { },
      analyse() { return silentLevels; },
    };
  }

  const audio = new Audio(src);
  audio.loop = true;
  audio.volume = 0;
  audio.preload = 'auto';

  let targetVolume = Math.max(0, Math.min(1, volume));
  let fadingIn = false;
  let fadingOut = false;
  let rafId = null;

  // One tiny Web Audio graph powers all audio-reactive visuals. fftSize 256 is
  // intentionally modest: party lighting needs broad bass/mid/treble bands,
  // not a studio-grade spectrum, and 128 bins are cheap even on budget phones.
  let audioCtx = null;
  let analyser = null;
  let spectrum = null;
  let graphAttempted = false;
  let lastAnalysisAt = -Infinity;
  let bassFloor = 0.12;
  let previousBass = 0;
  let bassRise = 0;
  let beatInterval = 500;
  let lastNaturalBeatAt = -Infinity;
  let lastBeatAt = -Infinity;
  let beatId = 0;
  let beatPulse = 0;
  const levels = {
    active: false,
    bass: 0,
    mid: 0,
    treble: 0,
    energy: 0,
    pulse: 0,
    beatId: 0,
  };

  function ensureAnalysisGraph() {
    if (graphAttempted) return;
    graphAttempted = true;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      audioCtx = new AudioContextCtor();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.68;
      analyser.minDecibels = -82;
      analyser.maxDecibels = -18;

      const sourceNode = audioCtx.createMediaElementSource(audio);
      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);
      spectrum = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      // Audio remains useful without analysis. If graph setup fails before the
      // media element is captured, its normal playback path still works.
      audioCtx = null;
      analyser = null;
      spectrum = null;
    }
  }

  function bandAverage(lowHz, highHz) {
    if (!audioCtx || !spectrum) return 0;
    const hzPerBin = audioCtx.sampleRate / analyser.fftSize;
    const from = Math.max(1, Math.floor(lowHz / hzPerBin));
    const to = Math.min(spectrum.length - 1, Math.ceil(highHz / hzPerBin));
    let total = 0;
    for (let i = from; i <= to; i++) total += spectrum[i];
    return total / Math.max(1, to - from + 1) / 255;
  }

  function tick() {
    if (fadingIn && audio.volume < targetVolume) {
      audio.volume = Math.min(targetVolume, audio.volume + 0.012);
      rafId = requestAnimationFrame(tick);
    } else if (fadingOut && audio.volume > 0) {
      audio.volume = Math.max(0, audio.volume - 0.008);
      rafId = requestAnimationFrame(tick);
    } else {
      fadingIn = false;
      fadingOut = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  return {
    play() {
      ensureAnalysisGraph();
      if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => { });
      audio.play().catch(() => {
        // Browsers block autoplay until after a user gesture. The intro button
        // satisfies that, but in case something else went wrong (codec support,
        // network), fail silently — music is nice-to-have, not essential.
      });
    },
    stop() {
      audio.pause();
      audio.currentTime = 0;
      levels.active = false;
    },
    fadeIn(dur = 2000) {
      fadingOut = false;
      fadingIn = true;
      if (!rafId) rafId = requestAnimationFrame(tick);
    },
    fadeOut(dur = 1500) {
      fadingIn = false;
      fadingOut = true;
      if (!rafId) rafId = requestAnimationFrame(tick);
    },
    setVolume(v) {
      targetVolume = Math.max(0, Math.min(1, v));
      if (!fadingIn && !fadingOut) audio.volume = targetVolume;
    },
    /** Push the volume up for the finale. */
    swell() {
      const old = targetVolume;
      targetVolume = Math.min(1, old * 1.35);
      fadingIn = true;
      if (!rafId) rafId = requestAnimationFrame(tick);
    },

    /**
     * Return smoothed broad-band energy and an adaptive bass beat signal.
     * Sampling is rate-limited by the caller's device tier; repeated calls
     * between samples return the same allocation-free object.
     */
    analyse(now = performance.now(), sampleHz = 20) {
      if (!analyser || !spectrum || audio.paused || audio.ended) {
        levels.active = false;
        levels.pulse = 0;
        return levels;
      }

      const interval = 1000 / Math.max(1, sampleHz);
      if (now - lastAnalysisAt < interval) {
        // Pulse decay stays continuous even when the FFT itself is throttled.
        levels.pulse = beatPulse * Math.exp(-(now - lastBeatAt) / 240);
        return levels;
      }
      lastAnalysisAt = now;

      analyser.getByteFrequencyData(spectrum);
      const bass = bandAverage(35, 190);
      const mid = bandAverage(190, 2200);
      const treble = bandAverage(2200, 9000);

      // Fast attack / relaxed release keeps lighting responsive without jitter.
      const smooth = (old, next) => old + (next - old) * (next > old ? 0.58 : 0.22);
      levels.bass = smooth(levels.bass, bass);
      levels.mid = smooth(levels.mid, mid);
      levels.treble = smooth(levels.treble, treble);
      levels.energy = levels.bass * 0.48 + levels.mid * 0.34 + levels.treble * 0.18;
      levels.active = true;

      // Detect an onset relative to the recent signal, not only against an
      // ever-rising absolute floor. The old floor could settle near a mastered
      // track's kick level, making `floor * 1.34` unreachable after a few bars.
      // A short attack/release history keeps this responsive across both loud
      // and quiet sections.
      const rise = bass - previousBass;
      bassRise += (Math.max(0, rise) - bassRise) * (rise > bassRise ? 0.65 : 0.18);
      const deviation = bass - bassFloor;
      const threshold = Math.max(0.10, bassFloor * 0.16 + 0.025);
      const onset = bass > threshold && (
        deviation > 0.035 || bassRise > 0.018
      );
      const canBeat = now - lastBeatAt > 145;
      if (onset && canBeat) {
        beatId++;
        beatPulse = Math.min(1, 0.45 + bass * 0.9);
        if (lastNaturalBeatAt > 0) {
          const gap = now - lastNaturalBeatAt;
          if (gap > 220 && gap < 900) {
            beatInterval += (gap - beatInterval) * 0.22;
          }
        }
        lastNaturalBeatAt = now;
        lastBeatAt = now;
      }
      // Keep the visual rhythm alive through a short low-energy dip. This is
      // only a timer fallback after a real beat has established a tempo; it
      // cannot start pulsing in silence or when analysis has never detected a
      // musical onset.
      const holdoverInterval = Math.max(280, Math.min(750, beatInterval));
      if (lastNaturalBeatAt > 0 && now - lastNaturalBeatAt > Math.max(560, beatInterval * 1.48) &&
          now - lastBeatAt >= holdoverInterval && bass > 0.045) {
        beatId++;
        beatPulse = Math.min(0.82, 0.42 + bass * 0.75);
        lastBeatAt = now;
      }
      bassFloor += (bass - bassFloor) * (bass > bassFloor ? 0.012 : 0.045);
      previousBass = bass;

      levels.beatId = beatId;
      levels.pulse = beatPulse * Math.exp(-(now - lastBeatAt) / 240);
      return levels;
    },
  };
}
