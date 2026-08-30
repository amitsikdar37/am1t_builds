/**
 * Depth-estimation worker.
 *
 * Runs Depth Anything V2 (small) through transformers.js, on WebGPU when the
 * browser has it and WASM otherwise. Lives in a worker because a single
 * inference is 30-200 ms and must not stall the 60 fps render loop.
 *
 * Out: a half-float depth buffer, normalised so 1.0 = nearest to the lens.
 */

import { AutoModel, AutoProcessor, RawImage, env } from '@huggingface/transformers';

env.allowLocalModels = false;

const MODEL_ID = 'onnx-community/depth-anything-v2-small-ONNX';

let model = null;
let processor = null;
let backend = { device: 'wasm', dtype: 'q8' };
let busy = false;

/** Smoothed normalisation window, so the scene does not pulse frame to frame. */
let lo = null;
let hi = null;
let rangeSmoothing = 0.75;

self.onmessage = async (event) => {
  const msg = event.data;
  try {
    if (msg.type === 'init') await init();
    else if (msg.type === 'frame') await onFrame(msg);
    else if (msg.type === 'config') {
      if (typeof msg.rangeSmoothing === 'number') rangeSmoothing = msg.rangeSmoothing;
      if (msg.resetRange) lo = hi = null;
    }
  } catch (err) {
    busy = false;
    self.postMessage({ type: 'error', message: describe(err) });
  }
};

async function init() {
  const progress = (p) => {
    if (p.status === 'progress' && p.file && typeof p.progress === 'number') {
      self.postMessage({
        type: 'progress',
        file: p.file,
        progress: p.progress,
        loaded: p.loaded,
        total: p.total,
      });
    } else if (p.status === 'initiate' || p.status === 'download' || p.status === 'done') {
      self.postMessage({ type: 'progress', file: p.file, status: p.status });
    }
  };

  processor = await AutoProcessor.from_pretrained(MODEL_ID, { progress_callback: progress });
  // We hand the model an exactly-sized, multiple-of-14 frame, so the processor's
  // own resize step is pure overhead (and needs a canvas inside the worker).
  processor.image_processor.do_resize = false;
  processor.image_processor.do_pad = false;

  const attempts = await candidateBackends();
  let lastError = null;
  for (const attempt of attempts) {
    try {
      model = await AutoModel.from_pretrained(MODEL_ID, {
        device: attempt.device,
        dtype: attempt.dtype,
        progress_callback: progress,
      });
      backend = attempt;
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      self.postMessage({
        type: 'progress',
        status: 'fallback',
        file: `${attempt.device}/${attempt.dtype} unavailable`,
      });
    }
  }
  if (!model) throw lastError ?? new Error('No usable inference backend.');

  self.postMessage({ type: 'ready', device: backend.device, dtype: backend.dtype });
}

async function candidateBackends() {
  const list = [];
  const gpu = navigator.gpu;
  if (gpu) {
    let fp16 = false;
    try {
      const adapter = await gpu.requestAdapter();
      fp16 = !!adapter?.features?.has('shader-f16');
    } catch {
      /* adapter request can reject on blocklisted drivers */
    }
    if (fp16) list.push({ device: 'webgpu', dtype: 'fp16' });
    list.push({ device: 'webgpu', dtype: 'fp32' });
  }
  list.push({ device: 'wasm', dtype: 'q8' });
  return list;
}

async function onFrame({ id, data, width, height }) {
  if (!model || busy) {
    // Drop the frame rather than queueing: stale depth is worse than fewer updates.
    self.postMessage({ type: 'dropped', id });
    return;
  }
  busy = true;
  const started = performance.now();

  const image = new RawImage(new Uint8ClampedArray(data), width, height, 4);
  const inputs = await processor(image);
  const { predicted_depth } = await model(inputs);

  const raw = predicted_depth.data; // Float32Array, higher = nearer
  const dims = predicted_depth.dims;
  const h = dims[dims.length - 2];
  const w = dims[dims.length - 1];

  const [rlo, rhi] = robustRange(raw);
  lo = lo === null ? rlo : lo + (rlo - lo) * (1 - rangeSmoothing);
  hi = hi === null ? rhi : hi + (rhi - hi) * (1 - rangeSmoothing);
  const span = Math.max(hi - lo, 1e-6);

  const half = new Uint16Array(w * h);
  for (let i = 0; i < half.length; i++) {
    const t = (raw[i] - lo) / span;
    half[i] = toHalf(t < 0 ? 0 : t > 1 ? 1 : t);
  }

  busy = false;
  self.postMessage(
    {
      type: 'depth',
      id,
      buffer: half.buffer,
      width: w,
      height: h,
      ms: performance.now() - started,
    },
    [half.buffer],
  );
}

/**
 * 1st/99th percentile via a 512-bin histogram. A couple of speckle pixels at
 * the extremes would otherwise squash the useful part of the range.
 */
function robustRange(arr) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!(max > min)) return [min, min + 1e-6];

  const BINS = 512;
  const hist = new Uint32Array(BINS);
  const scale = (BINS - 1) / (max - min);
  for (let i = 0; i < arr.length; i++) hist[((arr[i] - min) * scale) | 0]++;

  const cut = Math.max(1, Math.floor(arr.length * 0.01));
  let acc = 0;
  let loBin = 0;
  for (; loBin < BINS; loBin++) {
    acc += hist[loBin];
    if (acc >= cut) break;
  }
  acc = 0;
  let hiBin = BINS - 1;
  for (; hiBin > loBin; hiBin--) {
    acc += hist[hiBin];
    if (acc >= cut) break;
  }
  const step = (max - min) / (BINS - 1);
  return [min + loBin * step, min + hiBin * step];
}

const _f32 = new Float32Array(1);
const _u32 = new Uint32Array(_f32.buffer);

/** IEEE-754 binary32 -> binary16. Inputs here are always within [0, 1]. */
function toHalf(value) {
  _f32[0] = value;
  const x = _u32[0];
  const sign = (x >>> 16) & 0x8000;
  let exp = (x >>> 23) & 0xff;
  let mant = x & 0x7fffff;

  if (exp === 0xff) return sign | 0x7c00 | (mant ? 0x200 : 0); // Inf / NaN
  let e = exp - 127 + 15;
  if (e >= 0x1f) return sign | 0x7c00; // overflow -> Inf
  if (e <= 0) {
    if (e < -10) return sign; // underflow -> signed zero
    mant |= 0x800000;
    const shift = 14 - e;
    const rounded = (mant + (1 << (shift - 1))) >>> shift;
    return sign | rounded;
  }
  const rounded = mant + 0x1000; // round to nearest, ties away from zero
  if (rounded & 0x800000) return sign | ((e + 1) << 10);
  return sign | (e << 10) | (rounded >>> 13);
}

function describe(err) {
  const text = err?.message ?? String(err);
  if (/fetch|network|Failed to load/i.test(text)) {
    return `Could not download the depth model. Check your connection — the first run pulls ~50 MB from huggingface.co. (${text})`;
  }
  return text;
}
