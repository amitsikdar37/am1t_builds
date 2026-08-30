/**
 * Pointer + keyboard control of the lights.
 *
 * A light's bulb always renders at its own source-UV position (the projection is
 * the exact inverse of the unprojection used to place it), so hit-testing is a
 * straight UV -> pixel conversion with no depth correction needed.
 */

import { state, activeLight, MAX_LIGHTS } from '../state.js';

const GRAB_PX = 46;

export function attachPointer(canvas, renderer, { onChange = () => {} } = {}) {
  let dragging = false;
  let pointerId = null;
  let grabOffset = [0, 0];

  const toCanvasUv = (event) => {
    const rect = canvas.getBoundingClientRect();
    return [(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height];
  };

  const screenOf = (light) => {
    const xform = renderer.lastXform ?? renderer.uvXform(state.fit, state.mirror);
    const [ux, uy] = renderer.sourceToCanvas(xform, light.x, light.y);
    const rect = canvas.getBoundingClientRect();
    return [ux * rect.width, uy * rect.height];
  };

  const pick = (event) => {
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    let best = -1;
    let bestDist = GRAB_PX;
    state.lights.forEach((light, i) => {
      if (!light.on) return;
      const [lx, ly] = screenOf(light);
      const d = Math.hypot(px - lx, py - ly);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  };

  const moveTo = (event) => {
    const xform = renderer.lastXform ?? renderer.uvXform(state.fit, state.mirror);
    const [cx, cy] = toCanvasUv(event);
    const [u, v] = renderer.canvasToSource(xform, cx + grabOffset[0], cy + grabOffset[1]);
    const light = activeLight();
    light.x = clamp(u, -0.25, 1.25);
    light.y = clamp(v, -0.25, 1.25);
    onChange();
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    const hit = pick(event);
    if (hit >= 0) {
      state.active = hit;
      const light = state.lights[hit];
      const xform = renderer.lastXform ?? renderer.uvXform(state.fit, state.mirror);
      const [cx, cy] = toCanvasUv(event);
      const [gu, gv] = renderer.sourceToCanvas(xform, light.x, light.y);
      grabOffset = [gu - cx, gv - cy];
    } else {
      grabOffset = [0, 0];
    }
    dragging = true;
    pointerId = event.pointerId;
    canvas.setPointerCapture(pointerId);
    canvas.classList.add('grabbing');
    moveTo(event);
    event.preventDefault();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (dragging && event.pointerId === pointerId) {
      moveTo(event);
      return;
    }
    canvas.classList.toggle('grabbable', pick(event) >= 0);
  });

  const release = (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    dragging = false;
    canvas.classList.remove('grabbing');
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    pointerId = null;
  };

  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const light = activeLight();
      const step = (event.deltaY > 0 ? 1 : -1) * (event.shiftKey ? 0.01 : 0.035);
      if (event.altKey) light.radius = clamp(light.radius + step, 0.04, 2.5);
      else light.z = clamp(light.z + step, 0, 1);
      onChange();
    },
    { passive: false },
  );

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement) return;
    const light = activeLight();
    const fine = event.shiftKey ? 0.25 : 1;
    let handled = true;
    switch (event.key) {
      case 'ArrowUp':
        light.z = clamp(light.z - 0.03 * fine, 0, 1);
        break;
      case 'ArrowDown':
        light.z = clamp(light.z + 0.03 * fine, 0, 1);
        break;
      case 'ArrowLeft':
        light.x = clamp(light.x - 0.012 * fine, -0.25, 1.25);
        break;
      case 'ArrowRight':
        light.x = clamp(light.x + 0.012 * fine, -0.25, 1.25);
        break;
      case '[':
        light.intensity = clamp(light.intensity - 0.2, 0, 12);
        break;
      case ']':
        light.intensity = clamp(light.intensity + 0.2, 0, 12);
        break;
      default:
        handled = false;
    }
    if (!handled && /^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (index < state.lights.length && index < MAX_LIGHTS) {
        state.active = index;
        handled = true;
      }
    }
    if (handled) {
      event.preventDefault();
      onChange();
    }
  });
}

function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}
