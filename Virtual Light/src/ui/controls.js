/**
 * Control panel. Declarative-ish: each control registers a `sync` closure, and
 * `refresh()` pushes state back into the DOM after the pointer changes things.
 */

import { state, activeLight, makeLight, SWATCHES, MAX_LIGHTS, QUALITY, VIEW_NAMES } from '../state.js';

export function buildPanel(root, hooks) {
  const syncers = [];
  const ctx = { root, syncers, hooks, rebuild: () => {} };

  const render = () => {
    root.replaceChildren();
    syncers.length = 0;
    lightSection(ctx);
    lightGroup(ctx);
    shadingGroup(ctx);
    shadowGroup(ctx);
    depthGroup(ctx);
    presentationGroup(ctx);
    actionGroup(ctx);
  };
  ctx.rebuild = render;
  render();

  return {
    refresh() {
      for (const fn of syncers) fn();
    },
    rebuild: render,
  };
}

/* ------------------------------------------------------------------ sections */

function lightSection(ctx) {
  const group = addGroup(ctx.root, 'Lights');
  const bar = el('div', 'lightbar');

  state.lights.forEach((light, i) => {
    const chip = el('button', 'chip');
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(i === state.active));
    const dot = el('span', 'dot');
    dot.style.background = light.color;
    dot.style.color = light.color;
    chip.append(dot, document.createTextNode(`${i + 1}`));
    chip.addEventListener('click', () => {
      state.active = i;
      ctx.rebuild();
    });
    bar.append(chip);
  });

  if (state.lights.length < MAX_LIGHTS) {
    const add = el('button', 'chip');
    add.type = 'button';
    add.textContent = '+ add';
    add.addEventListener('click', () => {
      state.lights.push(makeLight(state.lights.length));
      state.active = state.lights.length - 1;
      ctx.rebuild();
    });
    bar.append(add);
  }

  if (state.lights.length > 1) {
    const remove = el('button', 'chip');
    remove.type = 'button';
    remove.textContent = '− remove';
    remove.addEventListener('click', () => {
      state.lights.splice(state.active, 1);
      state.active = Math.max(0, state.active - 1);
      ctx.rebuild();
    });
    bar.append(remove);
  }

  group.append(bar);

  const row = el('div', 'row');
  const swatches = el('div', 'swatches');
  SWATCHES.forEach((hex) => {
    const button = el('button', 'swatch');
    button.type = 'button';
    button.style.background = hex;
    button.title = hex;
    button.setAttribute('aria-label', `Light colour ${hex}`);
    button.setAttribute('aria-pressed', String(activeLight().color === hex));
    button.addEventListener('click', () => {
      activeLight().color = hex;
      ctx.rebuild();
    });
    swatches.append(button);
  });
  row.append(swatches);
  group.append(row);
}

function lightGroup(ctx) {
  const group = addGroup(ctx.root, `Light ${state.active + 1}`);
  const get = () => activeLight();

  addSlider(ctx, group, {
    label: 'Depth',
    min: 0,
    max: 1,
    step: 0.005,
    read: () => get().z,
    write: (v) => (get().z = v),
    format: (v) => (v < 0.02 ? 'at the lens' : v > 0.98 ? 'far wall' : v.toFixed(2)),
    note: 'Scroll on the canvas to move the light through the scene.',
  });
  addSlider(ctx, group, {
    label: 'Intensity',
    min: 0,
    max: 10,
    step: 0.05,
    read: () => get().intensity,
    write: (v) => (get().intensity = v),
  });
  addSlider(ctx, group, {
    label: 'Falloff radius',
    min: 0.05,
    max: 2.5,
    step: 0.01,
    read: () => get().radius,
    write: (v) => (get().radius = v),
  });
  addSlider(ctx, group, {
    label: 'Bulb size',
    min: 0,
    max: 0.12,
    step: 0.001,
    read: () => get().size,
    write: (v) => (get().size = v),
  });
  addToggle(ctx, group, {
    label: 'Enabled',
    read: () => get().on,
    write: (v) => (get().on = v),
  });
}

function shadingGroup(ctx) {
  const group = addGroup(ctx.root, 'Shading');
  const s = (key, label, min, max, step, note) =>
    addSlider(ctx, group, {
      label,
      min,
      max,
      step,
      note,
      read: () => state[key],
      write: (v) => (state[key] = v),
    });

  s(
    'ambient',
    'Room light',
    0,
    1,
    0.005,
    'At 1.0 the camera frame passes through exactly as the sensor saw it. Lower it to darken the room so the virtual light carries the scene.',
  );
  s('exposure', 'Exposure', 0.1, 3, 0.01, '1.0 leaves the original frame alone.');
  s('wrap', 'Wrap', 0, 1, 0.01, 'Softens the terminator — flatters noisy depth normals.');
  s('specular', 'Specular', 0, 1.5, 0.01, 'Sheen from the virtual light. Depth-derived normals are coarse, so a little goes a long way.');
  s('shininess', 'Tightness', 2, 120, 1);
  s('normalStrength', 'Relief', 0.2, 5, 0.05, 'Exaggerates the depth gradient, so shading bites harder.');
  s('glow', 'Halo', 0, 3, 0.01);
  s('bulb', 'Bulb', 0, 3, 0.01);
}

function shadowGroup(ctx) {
  const group = addGroup(ctx.root, 'Shadows');
  addToggle(ctx, group, {
    label: 'Cast shadows',
    read: () => state.shadows,
    write: (v) => (state.shadows = v),
  });
  const s = (key, label, min, max, step, note) =>
    addSlider(ctx, group, {
      label,
      min,
      max,
      step,
      note,
      read: () => state[key],
      write: (v) => (state[key] = v),
    });
  s('shadowStrength', 'Strength', 0, 1, 0.01);
  s(
    'shadowReach',
    'Reach',
    0.02,
    1,
    0.01,
    'How far behind an object its shadow still lands, as a share of the scene’s own depth. Low keeps shadows near what casts them, so a subject standing clear of the back wall stops printing itself onto it.',
  );
  s(
    'shadowSoftness',
    'Source size',
    0,
    0.2,
    0.005,
    'How big the light is, not how bright. A shadow stays hard where the surface catching it is right behind the object and spreads as that surface moves away.',
  );
  s('shadowSteps', 'Ray steps', 4, 32, 1, 'More steps catch thinner occluders, at a GPU cost.');
  s('shadowBias', 'Bias', 0, 0.06, 0.001, 'Raise this if surfaces shadow themselves.');
  s(
    'shadowThickness',
    'Occluder depth',
    0.04,
    1,
    0.01,
    'How deep an object is assumed to be behind its visible surface. Scaled by how near the object is, so one setting holds across a scene.',
  );
}

function depthGroup(ctx) {
  const group = addGroup(ctx.root, 'Depth');

  addSeg(ctx, group, {
    label: 'Model resolution',
    options: Object.entries(QUALITY).map(([key, preset]) => ({
      value: key,
      label: `${preset.label} · ${preset.longEdge}`,
    })),
    read: () => state.quality,
    write: (v) => {
      state.quality = v;
      ctx.hooks.onQuality?.(v);
    },
    note: 'Bigger input means finer silhouettes and fewer depth updates per second.',
  });

  addToggle(ctx, group, {
    label: 'Snap depth to image edges',
    read: () => state.edgeAware,
    write: (v) => (state.edgeAware = v),
    note: 'Off still smooths depth; it just stops the smoothing from respecting silhouettes.',
  });

  const s = (key, label, min, max, step, note, after) =>
    addSlider(ctx, group, {
      label,
      min,
      max,
      step,
      note,
      read: () => state[key],
      write: (v) => {
        state[key] = v;
        after?.(v);
      },
    });

  s('edgeSharpness', 'Edge guide', 0, 30, 0.5, 'How hard a brightness edge has to be before it stops the smoothing.');
  s('spatialBlur', 'Smoothing', 0, 4, 0.05, 'Measured in model samples, so 1.0 is one real depth pixel. Below ~0.8 the model’s own facets start to show as shading blobs.');
  s('temporal', 'Temporal blend', 0, 1, 0.01, 'Interpolates between model outputs so motion does not step.');
  s('perspective', 'Perspective', 0, 1, 0.01, '0 keeps the light on its screen position at any depth; 1 makes it recede.');
  s('depthRange', 'Depth range', 0.4, 4, 0.02, 'How far apart the nearest and farthest pixels are placed.');
  s('near', 'Near plane', 0.05, 1, 0.01);
}

function presentationGroup(ctx) {
  const group = addGroup(ctx.root, 'View');

  addSeg(ctx, group, {
    label: 'Output',
    options: VIEW_NAMES.map((label, i) => ({ value: i, label })),
    read: () => state.view,
    write: (v) => (state.view = Number(v)),
    note: 'Depth and Normals show what the model actually gave us.',
  });

  addSeg(ctx, group, {
    label: 'Fit',
    options: [
      { value: 'cover', label: 'Fill' },
      { value: 'contain', label: 'Fit' },
    ],
    read: () => state.fit,
    write: (v) => (state.fit = v),
  });

  addToggle(ctx, group, {
    label: 'Mirror horizontally',
    read: () => state.mirror,
    write: (v) => (state.mirror = v),
  });

  addSlider(ctx, group, {
    label: 'Vignette',
    min: 0,
    max: 1,
    step: 0.01,
    read: () => state.vignette,
    write: (v) => (state.vignette = v),
  });
  addSlider(ctx, group, {
    label: 'Grain',
    min: 0,
    max: 1,
    step: 0.01,
    read: () => state.grain,
    write: (v) => (state.grain = v),
    note: 'A little dither hides banding in the falloff.',
  });
}

function actionGroup(ctx) {
  const group = addGroup(ctx.root, 'Session');
  const row = el('div', 'btn-row');

  const button = (label, handler, primary = false) => {
    const b = el('button', `btn btn-sm${primary ? ' btn-primary' : ''}`);
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', handler);
    row.append(b);
  };

  button('Save frame', () => ctx.hooks.onSave?.());
  button('Reset', () => ctx.hooks.onReset?.());
  button('Camera', () => ctx.hooks.onCamera?.());
  button('Open file', () => ctx.hooks.onFile?.());
  group.append(row);

  const note = el('p', 'row-note');
  note.textContent =
    'Drag the bulb · scroll for depth · alt+scroll for falloff · 1-4 selects a light · arrows nudge.';
  group.append(note);
}

/* ---------------------------------------------------------------- primitives */

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function addGroup(root, title) {
  const group = el('section', 'group');
  const heading = el('h2', 'group-title');
  heading.textContent = title;
  group.append(heading);
  root.append(group);
  return group;
}

function addSlider(ctx, parent, spec) {
  const row = el('div', 'row');
  const head = el('div', 'row-head');
  const label = el('span', 'row-label');
  label.textContent = spec.label;
  const value = el('span', 'row-value');
  head.append(label, value);

  const input = el('input');
  input.type = 'range';
  input.min = String(spec.min);
  input.max = String(spec.max);
  input.step = String(spec.step);
  input.setAttribute('aria-label', spec.label);

  const fmt = spec.format ?? ((v) => (spec.step >= 1 ? String(Math.round(v)) : v.toFixed(2)));
  const sync = () => {
    const current = spec.read();
    if (document.activeElement !== input) input.value = String(current);
    value.textContent = fmt(current);
  };

  input.addEventListener('input', () => {
    spec.write(Number(input.value));
    value.textContent = fmt(Number(input.value));
  });

  row.append(head, input);
  if (spec.note) {
    const note = el('p', 'row-note');
    note.textContent = spec.note;
    row.append(note);
  }
  parent.append(row);
  ctx.syncers.push(sync);
  sync();
}

function addToggle(ctx, parent, spec) {
  const row = el('div', 'row');
  const label = el('label', 'toggle');
  const text = el('span');
  text.textContent = spec.label;
  const input = el('input');
  input.type = 'checkbox';
  input.addEventListener('change', () => spec.write(input.checked));
  label.append(text, input);
  row.append(label);
  if (spec.note) {
    const note = el('p', 'row-note');
    note.textContent = spec.note;
    row.append(note);
  }
  parent.append(row);
  const sync = () => {
    input.checked = !!spec.read();
  };
  ctx.syncers.push(sync);
  sync();
}

function addSeg(ctx, parent, spec) {
  const row = el('div', 'row');
  const head = el('div', 'row-head');
  const label = el('span', 'row-label');
  label.textContent = spec.label;
  head.append(label);

  const seg = el('div', 'seg');
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', spec.label);
  const buttons = spec.options.map((option) => {
    const button = el('button');
    button.type = 'button';
    button.textContent = option.label;
    button.addEventListener('click', () => {
      spec.write(option.value);
      for (const [i, b] of buttons.entries()) {
        b.setAttribute('aria-pressed', String(spec.options[i].value === spec.read()));
      }
    });
    seg.append(button);
    return button;
  });

  row.append(head, seg);
  if (spec.note) {
    const note = el('p', 'row-note');
    note.textContent = spec.note;
    row.append(note);
  }
  parent.append(row);

  const sync = () => {
    const current = spec.read();
    for (const [i, b] of buttons.entries()) {
      b.setAttribute('aria-pressed', String(spec.options[i].value === current));
    }
  };
  ctx.syncers.push(sync);
  sync();
}
