/**
 * Blow-classifier tests.
 *
 * The classifier can't be exercised through the UI without a real microphone and
 * a real person exhaling, so the DSP is kept pure and driven here with synthetic
 * spectra shaped like the signals it has to tell apart.
 *
 * IMPORTANT: spectra here are declared in DECIBELS and then encoded to bytes the
 * same way getByteFrequencyData does. An earlier version of this file declared
 * them as linear amplitude and wrote that straight into the byte array, which is
 * contrast no microphone can produce — the tests passed while real hardware
 * failed, because they were testing a fictional microphone.
 *
 * The bugs these guard against, in order of discovery:
 *  1. Bands compared as raw sums over bins of very different widths (10 bins of
 *     low against 470 of high), so highRatio sat near 0.8 regardless of input.
 *  2. Band ratios computed on dB bytes rather than linear amplitude, which
 *     compressed every contrast toward 1/3 and left a genuine blow sitting on
 *     the wrong side of the threshold on any real mic.
 */

import { strict as assert } from 'node:assert';
import { analyseSpectrum, classifyBlow } from '../src/audio/blow.js';

const SR = 48000;
const BINS = 512;
const HZ_PER_BIN = (SR / 2) / BINS;

const DB_MIN = -100;
const DB_MAX = -30;

/** Encode a dB-valued spectrum exactly as getByteFrequencyData would. */
function spectrumDb(shapeDb) {
  const a = new Uint8Array(BINS);
  for (let i = 0; i < BINS; i++) {
    const db = shapeDb(i * HZ_PER_BIN);
    const b = Math.round(((db - DB_MIN) / (DB_MAX - DB_MIN)) * 255);
    a[i] = Math.max(0, Math.min(255, b));
  }
  return a;
}

/** Turbulent airflow: loud and low, rolling off steeply with frequency. */
const blowDb = (peak = -38, floor = -80) => (hz) =>
  Math.max(floor, peak - 30 * Math.log10(1 + hz / 250));

// Voiced speech: formants at 700/1200/2600Hz over a -78dB floor.
const speechDb = (hz) => {
  const f = (c, w, g) => g * Math.exp(-((hz - c) ** 2) / (2 * w * w));
  return -78 + f(700, 130, 42) + f(1200, 180, 36) + f(2600, 320, 30);
};

// Sibilance ("sss"): energy concentrated well above 4kHz.
const hissDb = (hz) => (hz > 4000 ? -40 : -78);

// A quiet room: gentle low-frequency room tone, nothing above it.
const quietDb = (hz) => Math.max(-82, -72 - 6 * Math.log10(1 + hz / 300));

const blow = spectrumDb(blowDb());
const speech = spectrumDb(speechDb);
const hiss = spectrumDb(hissDb);
const quiet = spectrumDb(quietDb);

// The cases that were failing on real hardware.
const blowNoisyRoom = spectrumDb((hz) => Math.max(-62, blowDb(-38, -62)(hz)));
const blowWeakMic = spectrumDb(blowDb(-48, -76));
// A processed phone/headset microphone that removes much of the sub-500Hz wind
// energy. This is less bass-heavy than ideal brown noise but is still broad and
// decisively unlike voiced speech.
const blowHighPassed = spectrumDb((hz) => {
  const base = blowDb(-39, -78)(hz);
  const highPassLoss = hz < 500 ? 10 * (1 - hz / 500) : 0;
  return base - highPassLoss;
});

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name]); }
  catch (e) { results.push([false, name + '\n    ' + e.message]); }
}

// Calibrate against the quiet room, exactly as the runtime does.
const noiseFloor = analyseSpectrum(quiet, SR, null).level;

const mBlow = analyseSpectrum(blow, SR, null);
const mSpeech = analyseSpectrum(speech, SR, null);
const mHiss = analyseSpectrum(hiss, SR, null);
const mQuiet = analyseSpectrum(quiet, SR, null);
const mNoisy = analyseSpectrum(blowNoisyRoom, SR, null);
const mWeak = analyseSpectrum(blowWeakMic, SR, null);
const mHighPassed = analyseSpectrum(blowHighPassed, SR, null);

check('a blow is classified as a blow', () => {
  const r = classifyBlow(mBlow, noiseFloor);
  assert.ok(r.isBlow, `checks: ${JSON.stringify(r.checks)}  level=${mBlow.level.toFixed(3)} thr=${r.threshold.toFixed(3)}`);
});

check('every individual check passes for a blow', () => {
  const { checks } = classifyBlow(mBlow, noiseFloor);
  const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  assert.equal(failed.length, 0, `unsatisfiable checks: ${failed.join(', ')}`);
});

check('a blow in a noisy room still fires', () => {
  // Room tone lifts the high band and crushes the dB-domain ratio. This is the
  // case that failed on real hardware while the old tests were green.
  const r = classifyBlow(mNoisy, noiseFloor);
  assert.ok(r.isBlow, `checks: ${JSON.stringify(r.checks)}  low=${mNoisy.lowRatio.toFixed(3)} high=${mNoisy.highRatio.toFixed(3)}`);
});

check('a blow into a weak mic still fires', () => {
  // A laptop headset or phone mic with 10dB less low-end output.
  const r = classifyBlow(mWeak, noiseFloor);
  assert.ok(r.isBlow, `checks: ${JSON.stringify(r.checks)}  low=${mWeak.lowRatio.toFixed(3)} level=${mWeak.level.toFixed(3)} thr=${r.threshold.toFixed(3)}`);
});

check('a high-pass-filtered phone or headset blow still fires', () => {
  const r = classifyBlow(mHighPassed, noiseFloor);
  assert.ok(r.isBlow,
    `checks: ${JSON.stringify(r.checks)} low=${mHighPassed.lowRatio.toFixed(3)} high=${mHighPassed.highRatio.toFixed(3)}`);
});

check('speech does not fire', () => {
  assert.ok(!classifyBlow(mSpeech, noiseFloor).isBlow);
});

check('sibilance does not fire', () => {
  assert.ok(!classifyBlow(mHiss, noiseFloor).isBlow);
});

check('a silent room does not fire', () => {
  assert.ok(!classifyBlow(mQuiet, noiseFloor).isBlow);
});

check('band ratios are width-independent', () => {
  // A perfectly flat spectrum must split evenly across the three bands. Under
  // the old sum-based maths it came out ~0.02 / 0.06 / 0.92, purely because the
  // high band spans far more bins.
  const flat = analyseSpectrum(spectrumDb(() => -60), SR, null);
  assert.ok(Math.abs(flat.lowRatio - 1 / 3) < 0.02, `lowRatio ${flat.lowRatio.toFixed(3)}`);
  assert.ok(Math.abs(flat.highRatio - 1 / 3) < 0.02, `highRatio ${flat.highRatio.toFixed(3)}`);
});

check('ratios are computed on amplitude, not decibels', () => {
  // Direct guard on bug #2. A blow with 34dB of low-over-high contrast must
  // report a decisively low-dominant ratio. Computed on dB bytes this lands
  // around 0.46 — nominally "passing" but with no margin, which is why it broke
  // the moment a real room lifted the noise floor.
  assert.ok(mBlow.lowRatio > 0.75, `lowRatio ${mBlow.lowRatio.toFixed(3)} suggests dB-domain maths`);
  assert.ok(mBlow.highRatio < 0.10, `highRatio ${mBlow.highRatio.toFixed(3)} suggests dB-domain maths`);
});

check('a harder blow reports greater strength', () => {
  const soft = analyseSpectrum(spectrumDb(blowDb(-52)), SR, null);
  const hard = analyseSpectrum(spectrumDb(blowDb(-34)), SR, null);
  const s = classifyBlow(soft, noiseFloor).strength;
  const h = classifyBlow(hard, noiseFloor).strength;
  assert.ok(h > s, `hard ${h.toFixed(3)} should exceed soft ${s.toFixed(3)}`);
});

check('a sustained blow survives the flux check and fires', () => {
  // Every case above passes prevSpectrum = null, which pins flux at 0 and leaves
  // `sustained` — one of the five AND-ed conditions — never actually exercised.
  // A single unsatisfiable condition is what broke detection the first time, so
  // drive a held blow frame-by-frame with turbulent jitter and run the real
  // sustain integrator over it.
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  const prev = new Float32Array(BINS);
  analyseSpectrum(quiet, SR, prev); // prime, as calibration does

  let sustained = 0;
  let firedAt = -1;
  let worstSteadyFlux = 0;
  for (let f = 0; f < 40; f++) {
    // +/-3dB of per-frame wobble — turbulent airflow is not a clean tone.
    const jitter = (rnd() - 0.5) * 6;
    const m = analyseSpectrum(spectrumDb(blowDb(-38 + jitter)), SR, prev);
    if (f > 0) worstSteadyFlux = Math.max(worstSteadyFlux, m.flux);
    // Mirrors the runtime integrator in createBlowDetector at ~60fps.
    if (classifyBlow(m, noiseFloor).isBlow) sustained += 16.7;
    else sustained = Math.max(0, sustained - 16.7 * 1.6);
    if (sustained >= 180 && firedAt < 0) firedAt = f;
  }

  assert.ok(firedAt >= 0, 'a held blow never reached the sustain threshold');
  // Only the onset frame may spike; a steady stream of air must sit well clear
  // of the limit or the integrator decays faster than it accumulates.
  assert.ok(worstSteadyFlux < 0.09, `steady flux ${worstSteadyFlux.toFixed(4)} exceeds the limit`);
});

check('threshold stays reachable in a loud room', () => {
  // level is derived from decibels and caps at 1.0. The old threshold multiplied
  // the noise floor by 2.6, which in any non-silent room exceeded 1.0 and made
  // detection impossible.
  const loudFloor = analyseSpectrum(spectrumDb(() => -50), SR, null).level;
  assert.ok(classifyBlow(mBlow, loudFloor).threshold < 1.0);
});

console.log('\nmeasured features');
const rows = [
  ['blow', mBlow], ['blow/noisy', mNoisy], ['blow/weak', mWeak],
  ['blow/highpass', mHighPassed], ['speech', mSpeech], ['hiss', mHiss], ['quiet', mQuiet],
];
for (const [n, m] of rows) {
  const { isBlow } = classifyBlow(m, noiseFloor);
  console.log(
    `  ${n.padEnd(11)} level=${m.level.toFixed(3)}  low=${m.lowRatio.toFixed(3)}` +
    `  high=${m.highRatio.toFixed(3)}  centroid=${m.centroid.toFixed(3)}  ${isBlow ? 'FIRES' : '-'}`
  );
}
console.log(`  noiseFloor=${noiseFloor.toFixed(3)}  threshold=${classifyBlow(mBlow, noiseFloor).threshold.toFixed(3)}\n`);

let failures = 0;
for (const [ok, name] of results) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures++;
}
console.log(`\n${results.length - failures}/${results.length} passed\n`);
process.exit(failures ? 1 : 0);
