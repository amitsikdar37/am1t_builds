/**
 * Virtual Light — app entry point.
 *
 * Two clocks run side by side: the render loop at display rate, and depth
 * estimation at whatever the model manages (roughly 5-25 fps). The renderer
 * cross-fades between the last two depth maps so the lighting never steps.
 */

import { state, VIEW_NAMES, MAX_LIGHTS, makeLight } from './state.js';
import { FrameSource } from './source.js';
import { DepthEngine } from './depth-engine.js';
import { Renderer } from './gl/renderer.js';
import { attachPointer } from './ui/pointer.js';
import { buildPanel } from './ui/controls.js';

const DEFAULTS = structuredClone({ lights: state.lights, ...stripRuntime(state) });

const dom = {
  canvas: document.getElementById('gl'),
  boot: document.getElementById('boot'),
  bootNote: document.getElementById('bootNote'),
  startCam: document.getElementById('startCam'),
  startFile: document.getElementById('startFile'),
  loader: document.getElementById('loader'),
  loaderText: document.getElementById('loaderText'),
  loaderBar: document.getElementById('loaderBar'),
  hud: document.getElementById('hud'),
  pillDevice: document.getElementById('pillDevice'),
  pillDepthFps: document.getElementById('pillDepthFps'),
  pillRenderFps: document.getElementById('pillRenderFps'),
  hint: document.getElementById('hint'),
  panel: document.getElementById('panel'),
  panelToggle: document.getElementById('panelToggle'),
  toast: document.getElementById('toast'),
  fileInput: document.getElementById('fileInput'),
};

const source = new FrameSource();
const depth = new DepthEngine();
let renderer = null;
let panel = null;
let started = false;
let renderTimes = [];
let toastTimer = 0;

boot();

function boot() {
  if (!('gpu' in navigator)) {
    note(
      'No WebGPU here, so the depth model will run on the CPU (WASM) — expect a few frames per second. Chrome or Edge 121+ is much faster.',
      true,
    );
  } else {
    note('First run downloads ~50 MB of model weights, then it is cached by the browser.');
  }

  dom.startCam.addEventListener('click', () => start(() => source.useCamera()));
  dom.startFile.addEventListener('click', () => dom.fileInput.click());
  dom.fileInput.addEventListener('change', () => {
    const file = dom.fileInput.files?.[0];
    if (file) start(() => source.useFile(file));
  });
}

async function start(acquire) {
  if (dom.boot.hidden && !started) return;
  try {
    dom.boot.hidden = true;
    show(dom.loader, 'Waiting for the frame source…');
    await acquire();

    if (!renderer) renderer = new Renderer(dom.canvas);

    if (!depth.ready) {
      wireProgress();
      await depth.start();
      dom.pillDevice.textContent = `${depth.device} · ${depth.dtype}`;
      dom.pillDevice.classList.toggle('good', depth.device === 'webgpu');
      dom.pillDevice.classList.toggle('warn', depth.device !== 'webgpu');
      depth.onError = (err) => toast(err.message);
    }
    depth.setQuality(state.quality);

    if (!started) {
      started = true;
      state.running = true;
      panel = buildPanel(dom.panel, {
        onQuality: (key) => depth.setQuality(key),
        onSave: saveFrame,
        onReset: reset,
        onCamera: () => start(() => source.useCamera()),
        onFile: () => dom.fileInput.click(),
      });
      attachPointer(dom.canvas, renderer, { onChange: () => panel.refresh() });
      wireChrome();
      requestAnimationFrame(frame);
    }

    dom.loader.hidden = true;
    dom.hud.hidden = false;
    // On a phone the panel covers the whole stage, so let the user open it.
    dom.panel.hidden = window.innerWidth < 560;
    dom.panelToggle.hidden = false;
    revealHint();
  } catch (err) {
    dom.loader.hidden = true;
    if (!started) {
      dom.boot.hidden = false;
      note(explain(err), true);
    } else {
      toast(explain(err));
    }
  }
}

/* --------------------------------------------------------------- render loop */

let viewW = 0;
let viewH = 0;
let viewDpr = 0;
let viewDirty = true;
let needDepth = false;

function frame(now) {
  requestAnimationFrame(frame);
  fitCanvas();

  if (source.ready && !state.paused) {
    source.pokeIfPolling();
    if (source.takeFrame()) {
      renderer.uploadSource(source.el, source.width, source.height);
      needDepth = true;
    }
    // Keep asking until the engine actually takes it, so a still image is not
    // lost just because the model happened to be busy on that one frame.
    if (needDepth && depth.submit(source.el, source.width, source.height)) needDepth = false;
  }

  renderer.draw(state, now);
  tickRenderFps(now);
}

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (!viewDirty && dpr === viewDpr) return;
  viewDirty = false;
  viewDpr = dpr;
  if (viewW > 0 && viewH > 0) renderer.resize(viewW, viewH, dpr);
}

function tickRenderFps(now) {
  renderTimes.push(now);
  while (renderTimes.length > 1 && now - renderTimes[0] > 1000) renderTimes.shift();
  if (renderTimes.length > 1 && now - (tickRenderFps.last ?? 0) > 400) {
    tickRenderFps.last = now;
    const span = now - renderTimes[0];
    const fps = ((renderTimes.length - 1) * 1000) / span;
    dom.pillRenderFps.textContent = `render ${Math.round(fps)}`;
    dom.pillDepthFps.textContent = depth.lastMs
      ? `depth ${depth.fps.toFixed(1)} · ${Math.round(depth.lastMs)}ms`
      : 'depth –';
  }
}

/* -------------------------------------------------------------------- wiring */

function wireProgress() {
  depth.onProgress = (msg) => {
    if (msg.status === 'fallback') {
      show(dom.loader, `${msg.file} — falling back to the next backend…`);
      return;
    }
    if (typeof msg.progress === 'number') {
      dom.loaderBar.style.width = `${Math.min(100, msg.progress).toFixed(1)}%`;
      const mb =
        msg.total > 0
          ? ` · ${(msg.loaded / 1048576).toFixed(1)}/${(msg.total / 1048576).toFixed(1)} MB`
          : '';
      show(dom.loader, `Downloading ${basename(msg.file)}${mb}`);
    } else if (msg.status === 'done') {
      dom.loaderBar.style.width = '100%';
      show(dom.loader, 'Warming up the model…');
    }
  };
  depth.onDepth = (data, w, h) => renderer.uploadDepth(data, w, h);
}

function wireChrome() {
  new ResizeObserver((entries) => {
    const box = entries[0].contentRect;
    viewW = box.width;
    viewH = box.height;
    viewDirty = true;
  }).observe(dom.canvas);
  const rect = dom.canvas.getBoundingClientRect();
  viewW = rect.width;
  viewH = rect.height;

  dom.panelToggle.addEventListener('click', togglePanel);
  document.addEventListener('visibilitychange', () => {
    state.paused = document.hidden;
  });
  window.addEventListener('keydown', onShortcut);
}

function togglePanel() {
  dom.panel.hidden = !dom.panel.hidden;
}

function onShortcut(event) {
  if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey) return;
  if (event.key === 'Tab') {
    // Leave real focus navigation alone once the user is inside the panel.
    if (event.target !== document.body && event.target !== dom.canvas) return;
    event.preventDefault();
    togglePanel();
    return;
  }

  switch (event.key.toLowerCase()) {
    case 'v':
      state.view = (state.view + 1) % VIEW_NAMES.length;
      toast(VIEW_NAMES[state.view]);
      break;
    case 'n':
      if (state.lights.length >= MAX_LIGHTS) return;
      state.lights.push(makeLight(state.lights.length));
      state.active = state.lights.length - 1;
      panel.rebuild();
      return;
    case 'm':
      state.mirror = !state.mirror;
      break;
    case 's':
      saveFrame();
      return;
    default:
      return;
  }
  event.preventDefault();
  panel.refresh();
}

/* ------------------------------------------------------------------- actions */

async function saveFrame() {
  try {
    const blob = await renderer.toBlob('image/png');
    if (!blob) throw new Error('The canvas could not be read back.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `virtual-light-${stamp()}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Frame saved.');
  } catch (err) {
    toast(explain(err));
  }
}

function reset() {
  const fresh = structuredClone(DEFAULTS);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
  state.active = 0;
  depth.setQuality(state.quality);
  panel.rebuild();
  toast('Back to defaults.');
}

/* -------------------------------------------------------------------- chrome */

function note(text, warn = false) {
  dom.bootNote.textContent = text;
  dom.bootNote.classList.toggle('warn', warn);
}

function show(element, text) {
  element.hidden = false;
  if (element === dom.loader) dom.loaderText.textContent = text;
}

function toast(message) {
  dom.toast.textContent = message;
  dom.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dom.toast.hidden = true;
  }, 3400);
}

function revealHint() {
  dom.hint.hidden = false;
  dom.hint.style.opacity = '1';
  setTimeout(() => {
    dom.hint.style.opacity = '0';
  }, 6000);
  setTimeout(() => {
    dom.hint.hidden = true;
  }, 6600);
}

/* ------------------------------------------------------------------- helpers */

function explain(err) {
  const message = err?.message ?? String(err);
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was blocked. Allow it from the address bar, or open a video file instead.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found. Try opening a video or photo instead.';
    case 'NotReadableError':
      return 'The camera is busy in another app or tab.';
    default:
      break;
  }
  if (/camera|mediaDevices/i.test(message) && !window.isSecureContext) {
    return `${message} Camera capture needs a secure context — open this over localhost or https.`;
  }
  return message;
}

/** The parts of the store that describe the look, as opposed to the session. */
function stripRuntime(source) {
  const { running, paused, device, depthFps, renderFps, active, ...rest } = source;
  return rest;
}

function basename(path = '') {
  return path.split('/').pop() || path;
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
