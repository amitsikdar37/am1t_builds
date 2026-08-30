/**
 * Main-thread side of depth estimation.
 *
 * Owns the worker, the small scratch canvas the model is fed from, and the
 * pacing: exactly one inference in flight at a time, newest frame wins.
 */

import { QUALITY } from './state.js';

const PATCH = 14; // DINOv2 patch size — input dims must be a multiple of it

export class DepthEngine {
  constructor() {
    this.worker = null;
    this.ready = false;
    this.inflight = false;
    this.frameId = 0;
    this.longEdge = QUALITY.balanced.longEdge;
    this.width = 0;
    this.height = 0;
    this.lastMs = 0;
    this.fps = 0;
    this.device = '–';
    this.dtype = '';

    this.onDepth = () => {};
    this.onProgress = () => {};
    this.onError = () => {};

    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
    this._times = [];
  }

  start() {
    if (this.worker) return this._startPromise;

    this.worker = new Worker(new URL('./depth-worker.js', import.meta.url), { type: 'module' });

    this._startPromise = new Promise((resolve, reject) => {
      this.worker.onmessage = (event) => {
        const msg = event.data;
        switch (msg.type) {
          case 'ready':
            this.ready = true;
            this.device = msg.device;
            this.dtype = msg.dtype;
            resolve(msg);
            break;
          case 'progress':
            this.onProgress(msg);
            break;
          case 'depth':
            this.inflight = false;
            this.lastMs = msg.ms;
            this._tickFps();
            this.onDepth(new Uint16Array(msg.buffer), msg.width, msg.height);
            break;
          case 'dropped':
            this.inflight = false;
            break;
          case 'error':
            this.inflight = false;
            if (!this.ready) reject(new Error(msg.message));
            else this.onError(new Error(msg.message));
            break;
        }
      };
      this.worker.onerror = (event) => {
        const err = new Error(event.message || 'The depth worker failed to start.');
        if (!this.ready) reject(err);
        else this.onError(err);
      };
      this.worker.postMessage({ type: 'init' });
    });

    return this._startPromise;
  }

  setQuality(key) {
    const preset = QUALITY[key] ?? QUALITY.balanced;
    if (preset.longEdge === this.longEdge) return;
    this.longEdge = preset.longEdge;
    this.width = this.height = 0; // force a re-plan on the next submit
    this.worker?.postMessage({ type: 'config', resetRange: true });
  }

  setTemporalRange(smoothing) {
    this.worker?.postMessage({ type: 'config', rangeSmoothing: smoothing });
  }

  /** Downscale the current source frame and hand it to the worker. No-op while busy. */
  submit(element, srcWidth, srcHeight) {
    if (!this.ready || this.inflight || !srcWidth || !srcHeight) return false;

    const [w, h] = planSize(srcWidth, srcHeight, this.longEdge);
    if (w !== this.width || h !== this.height) {
      this.width = this._canvas.width = w;
      this.height = this._canvas.height = h;
    }

    try {
      this._ctx.drawImage(element, 0, 0, w, h);
    } catch {
      return false; // element not decodable yet
    }
    const image = this._ctx.getImageData(0, 0, w, h);

    this.inflight = true;
    this.frameId++;
    this.worker.postMessage(
      { type: 'frame', id: this.frameId, data: image.data.buffer, width: w, height: h },
      [image.data.buffer],
    );
    return true;
  }

  _tickFps() {
    const now = performance.now();
    this._times.push(now);
    while (this._times.length > 1 && now - this._times[0] > 2000) this._times.shift();
    const span = now - this._times[0];
    this.fps = span > 0 ? ((this._times.length - 1) * 1000) / span : 0;
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
  }
}

/** Aspect-preserving size whose both dimensions are multiples of the patch size. */
export function planSize(srcWidth, srcHeight, longEdge) {
  const aspect = srcWidth / srcHeight;
  let w;
  let h;
  if (aspect >= 1) {
    w = longEdge;
    h = longEdge / aspect;
  } else {
    h = longEdge;
    w = longEdge * aspect;
  }
  return [snap(w), snap(h)];
}

function snap(value) {
  return Math.max(PATCH * 4, Math.round(value / PATCH) * PATCH);
}
