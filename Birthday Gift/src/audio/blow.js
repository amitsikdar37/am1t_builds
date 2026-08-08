/**
 * Blow detection.
 *
 * The hard part isn't detecting sound — it's detecting a *blow* and nothing else.
 * A birthday party is a loud room: people talking, laughing, music playing,
 * someone saying "blow it out!". Any of those firing the candles early ruins the
 * moment, and a blow that doesn't register ruins it just as badly.
 *
 * What separates a blow from speech, physically:
 *
 *  - A blow is turbulent airflow across the mic — broadband noise, dominated by
 *    low frequencies, with no harmonic structure.
 *  - Speech is periodic and formant-structured: energy concentrated in moving
 *    peaks, with a much higher spectral centroid and rapid frame-to-frame change.
 *  - Music has strong mid/high content and rhythmic, not sustained, envelopes.
 *
 * So we require, simultaneously and sustained over ~180ms:
 *   1. Loudness well above a calibrated noise floor
 *   2. Enough low-frequency energy to distinguish breath from speech
 *   3. No dominant high-frequency hiss
 *   4. Low spectral flux (sustained, not a one-frame impact)
 *
 * We deliberately disable echoCancellation / noiseSuppression / autoGainControl:
 * those are tuned to *remove* exactly the broadband wind noise we need, and
 * leaving them on makes a genuine blow nearly undetectable.
 */

const FFT_SIZE = 1024;
const CALIBRATION_MS = 900;
const SUSTAIN_MS = 180;

// Band edges, in Hz.
//
// Analysis stops at 8kHz. Above that a microphone is mostly reporting its own
// self-noise, and including it only drags the averages around.
const BAND_LOW_HZ = 500;
const BAND_MID_HZ = 2000;
const BAND_TOP_HZ = 8000;

// AnalyserNode defaults. getByteFrequencyData maps this dB window onto 0..255,
// which means the bytes it hands back are DECIBELS, not amplitude.
const DB_MIN = -100;
const DB_MAX = -30;

/**
 * byte -> linear amplitude, precomputed.
 *
 * This conversion is the whole ballgame for the band ratios. Decibels are
 * logarithmic, so comparing bands in the byte domain crushes every contrast
 * toward 1/3: a blow that is genuinely 34 dB louder in the low band than the
 * high band reports a low-ratio of only ~0.46 as bytes, but ~0.86 as amplitude.
 * Ratios taken on dB bytes therefore sat a hair above the threshold in a silent
 * room and dropped below it the moment there was any room tone or a mic with a
 * weak low end — which is every laptop headset and every phone.
 */
const LINEAR = new Float32Array(256);
for (let b = 0; b < 256; b++) {
  LINEAR[b] = b === 0 ? 0 : Math.pow(10, (DB_MIN + (b / 255) * (DB_MAX - DB_MIN)) / 20);
}

// Classification thresholds, in the linear-amplitude domain. A flat spectrum
// still scores 1/3 per band, but real signals now separate by an order of
// magnitude instead of a few percent, so these have real margin either side.
//
// Phone and headset microphones commonly high-pass wind/handling noise, so a
// real breath can land well below the 0.50 low-band ratio produced by idealised
// brown noise. Require broad, non-hissy breath energy instead of an unrealistically
// bass-heavy spectrum. Sustain and loudness still reject speech transients.
const LOW_DOMINANT = 0.34;
const MAX_HIGH_RATIO = 0.38;
// A transient rejector (mic bump, door slam), NOT a speech discriminator —
// measured blow flux peaks at 0.037 while modulated speech reaches 0.023, so the
// two genuinely overlap and no threshold here separates them. Set clear of a
// wavering blow; the 180ms sustain requirement is what actually kills impulses.
const MAX_FLUX = 0.09;
// level stays in the dB domain deliberately: it is a loudness measure, the room
// calibration is a loudness calibration, and dB is the perceptually right scale
// for both. One unit of level is 70 dB, so this offset is roughly 4.5 dB over the
// room — comfortably above room tone, far below a real breath.
const LEVEL_OVER_FLOOR = 0.065;

/**
 * Turn a byte spectrum into the handful of features the classifier needs.
 *
 * Pure, and exported, so the classification can be exercised against synthetic
 * spectra without a microphone or an AudioContext.
 *
 * The critical detail is that every band figure is a **mean per bin**, never a
 * sum. At a 1024-point FFT and 48kHz, the 0-500Hz band is 10 bins while
 * 2k-8kHz is 128 — comparing their sums measures how wide the bands are, not
 * where the energy is. Summing made `highRatio` sit around 0.8 no matter what
 * the microphone heard.
 */
export function analyseSpectrum(freqData, sampleRate, prevSpectrum) {
  const binCount = freqData.length;
  const hzPerBin = (sampleRate / 2) / binCount;

  const clampBin = (hz) => Math.min(binCount, Math.max(1, Math.round(hz / hzPerBin)));
  const lowCut = clampBin(BAND_LOW_HZ);
  const midCut = Math.max(lowCut + 1, clampBin(BAND_MID_HZ));
  const topCut = Math.max(midCut + 1, clampBin(BAND_TOP_HZ));

  // Band energies in linear amplitude — see the LINEAR table above for why this
  // cannot be done on the raw bytes.
  let lowLin = 0;
  let midLin = 0;
  let highLin = 0;
  let weightedLin = 0;
  let totalLin = 0;

  // Loudness stays in the dB domain.
  let loudSum = 0;
  let flux = 0;

  for (let i = 0; i < topCut; i++) {
    const b = freqData[i];
    const lin = LINEAR[b];
    const db = b / 255;

    totalLin += lin;
    weightedLin += lin * i;

    if (i < lowCut) { lowLin += lin; loudSum += db; }
    else if (i < midCut) { midLin += lin; loudSum += db; }
    else highLin += lin;

    if (prevSpectrum) {
      // Spectral flux stays in the dB domain too: it is a perceptual change
      // detector, and what makes speech stand out is that syllable onsets are
      // large *perceived* jumps. In linear amplitude the quiet bins contribute
      // essentially nothing and the measure stops discriminating.
      const d = db - prevSpectrum[i];
      if (d > 0) flux += d;
      prevSpectrum[i] = db;
    }
  }

  const lowMean = lowLin / lowCut;
  const midMean = midLin / (midCut - lowCut);
  const highMean = highLin / (topCut - midCut);
  const meanSum = lowMean + midMean + highMean;

  return {
    // Loudness is measured where a blow actually lives. Averaging across the
    // whole spectrum diluted it by ~50x and made it unreachable.
    level: loudSum / midCut,
    centroid: totalLin > 0 ? (weightedLin / totalLin) / topCut : 0,
    lowRatio: meanSum > 0 ? lowMean / meanSum : 0,
    highRatio: meanSum > 0 ? highMean / meanSum : 0,
    flux: flux / topCut,
  };
}

/**
 * Decide whether a frame looks like a blow.
 *
 * The threshold is the noise floor plus a fixed offset, not a multiple of it.
 * `level` is derived from decibels, so it is already logarithmic — multiplying
 * it by 2.6 was not "2.6x louder", and in a normal room it produced a threshold
 * above 1.0, i.e. above the maximum the metric can ever report.
 *
 * There is deliberately no spectral-centroid gate. It was measured to be both
 * redundant and actively harmful: speech centroid (0.21) lands *below* a blow
 * recorded in a noisy room (0.35), so no threshold separates them, and every
 * value that admitted the noisy blow also admitted speech. lowRatio already
 * separates those two by a factor of twenty. `centroid` is still reported for
 * the on-screen diagnostics, it just doesn't vote.
 */
export function classifyBlow(m, noiseFloor) {
  const threshold = Math.min(0.92, noiseFloor + LEVEL_OVER_FLOOR);

  const checks = {
    loudEnough: m.level > threshold,
    lowDominant: m.lowRatio > LOW_DOMINANT,
    notHissy: m.highRatio < MAX_HIGH_RATIO,
    sustained: m.flux < MAX_FLUX,
  };

  const isBlow =
    checks.loudEnough && checks.lowDominant &&
    checks.notHissy && checks.sustained;

  const strength = Math.min(1, Math.max(0, (m.level - threshold) / 0.22));

  return { isBlow, threshold, strength, checks };
}

export function createBlowDetector({ onBlow, onLevel, onError, onReady, onMetrics }) {
  let audioCtx = null;
  let analyser = null;
  let stream = null;
  let source = null;
  let rafId = null;

  let freqData = null;
  let prevSpectrum = null;

  let calibrating = true;
  let calibrationStart = 0;
  let calibrationLevels = [];
  let noiseFloor = 0.02;
  let sustainedFor = 0;
  let lastFrameTime = 0;
  let lastBlowAt = 0;
  let running = false;

  async function start() {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // Safari can return a suspended context. Await the transition rather than
      // launching it in the background and starting an analyser that only ever
      // returns zeroes.
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      // Some mobile browsers suspend again while their native permission sheet
      // is open, so verify once more after getUserMedia resolves.
      if (audioCtx.state === 'suspended') await audioCtx.resume();
    } catch (err) {
      if (audioCtx) { try { audioCtx.close(); } catch { } }
      if (onError) onError(err);
      return false;
    }

    source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.35;
    source.connect(analyser);

    freqData = new Uint8Array(analyser.frequencyBinCount);
    prevSpectrum = new Float32Array(analyser.frequencyBinCount);

    calibrating = true;
    calibrationStart = performance.now();
    calibrationLevels = [];
    lastFrameTime = performance.now();
    running = true;

    if (onReady) onReady();
    loop();
    return true;
  }

  function analyse() {
    analyser.getByteFrequencyData(freqData);
    return analyseSpectrum(freqData, audioCtx.sampleRate, prevSpectrum);
  }

  function loop() {
    if (!running) return;
    rafId = requestAnimationFrame(loop);

    const now = performance.now();
    const dt = now - lastFrameTime;
    lastFrameTime = now;

    const m = analyse();

    // ── Calibration: learn the room ────────────────────────────────────────
    if (calibrating) {
      calibrationLevels.push(m.level);
      if (now - calibrationStart >= CALIBRATION_MS) {
        // A percentile is robust if the visitor starts blowing before the
        // instruction changes from "calibrating". An average lets that first
        // breath raise the threshold until subsequent breaths are unreachable.
        calibrationLevels.sort((a, b) => a - b);
        const floorIndex = Math.floor((calibrationLevels.length - 1) * 0.35);
        noiseFloor = calibrationLevels.length > 0
          ? calibrationLevels[Math.max(0, floorIndex)]
          : 0.02;
        calibrating = false;
      }
      if (onLevel) onLevel(0, true);
      return;
    }

    // ── Classification ─────────────────────────────────────────────────────
    const { isBlow, strength, threshold, checks } = classifyBlow(m, noiseFloor);

    // Diagnostics. The production build strips console output, and the people
    // hitting mic problems are usually on a phone with no devtools, so this has
    // to be reportable on-screen.
    if (onMetrics) onMetrics(m, { isBlow, threshold, checks, noiseFloor, sustainedFor });

    if (isBlow) {
      sustainedFor += dt;
    } else {
      // Decay rather than reset — a blow naturally wavers, and a hard reset
      // means a real breath keeps failing the sustain requirement.
      sustainedFor = Math.max(0, sustainedFor - dt * 1.6);
    }

    // Report audible input even when its spectral shape has not passed every
    // blow gate. This distinguishes "the mic hears me" from a dead/incorrect
    // input device and gives useful feedback on real hardware.
    const activity = Math.min(1, Math.max(0, (m.level - noiseFloor - 0.025) / 0.16));
    if (onLevel) onLevel(activity, false);

    if (sustainedFor >= SUSTAIN_MS && now - lastBlowAt > 450) {
      lastBlowAt = now;
      sustainedFor = 0;
      if (onBlow) onBlow(strength);
    }
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    if (source) { try { source.disconnect(); } catch { } }
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (audioCtx) { try { audioCtx.close(); } catch { } }
    audioCtx = null;
    analyser = null;
    stream = null;
    source = null;
  }

  return {
    start,
    stop,
    isRunning: () => running,
    isCalibrating: () => calibrating,
  };
}

/** Feature check — lets the UI offer the tap fallback without a failed prompt. */
export function micSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
    (window.AudioContext || window.webkitAudioContext));
}
