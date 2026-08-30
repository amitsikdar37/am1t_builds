/**
 * Single mutable store for everything the renderer and UI both need to see.
 * Plain object on purpose: the render loop reads it every frame, so we want
 * zero indirection and no change-notification bookkeeping.
 */

/** Warm tungsten, neutral, and a few saturated stage-light colours. */
export const SWATCHES = [
  '#ffd9a8',
  '#ffffff',
  '#ffb066',
  '#ff6b6b',
  '#ff7ad9',
  '#8b7bff',
  '#5ec8ff',
  '#7cf0b4',
];

export const MAX_LIGHTS = 4;

/** Model input resolution presets, expressed as the long edge in pixels. */
export const QUALITY = {
  fast: { label: 'Fast', longEdge: 224 },
  balanced: { label: 'Balanced', longEdge: 308 },
  sharp: { label: 'Sharp', longEdge: 392 },
};

export function makeLight(i = 0) {
  const spread = [
    { x: 0.3, y: 0.42 },
    { x: 0.72, y: 0.35 },
    { x: 0.5, y: 0.72 },
    { x: 0.18, y: 0.7 },
  ][i % 4];
  return {
    x: spread.x,
    y: spread.y,
    // 0 = at the lens, 1 = far wall. A subject filling the frame sits at roughly
    // 0.2-0.5 once depth is renormalised, so this puts the light just in front of
    // them: they carry the light and the wall falls away behind, and a short
    // scroll is enough to push it past them. Shipping it deeper lit the wall and
    // left the subject backlit — measured, the face came out dimmer than the wall.
    z: 0.2,
    color: SWATCHES[i % SWATCHES.length],
    // Intensity 4.0 drove the whole lit subject into a flat, blown band near the
    // top of the range; the old asymptotic composite then squeezed that band into
    // low contrast, and the pair is what read as an over-lit "plastic" look. With
    // the clip-capable composite in place, ~2.0 lands the lit subject at a
    // believable mid with only its hotspot blowing to white — the reference look.
    // Radius 0.65 washed a soft glow across most of the frame; 0.45 draws a
    // defined warm pool that falls off across the subject (real light, not a wash).
    // Both are live sliders — [ ] and the radius control — so this is just where
    // the out-of-box look starts, tuned to match the reference reel.
    intensity: 2.0,
    radius: 0.45,
    size: 0.028, // visible bulb radius, in screen-height units
    on: true,
  };
}

export const state = {
  // scene
  lights: [makeLight(0)],
  active: 0,

  // exposure / shading. The camera frame is the base and the lights add to it,
  // so ambient 1 / exposure 1 hand the original pixels through untouched; the
  // shipped 0.16 dims the room hard so unlit content falls to clean black and the
  // virtual light carries the scene — the reference's dark-room-with-a-light look.
  // (A brightly-lit room can't reach a pure-black background by dimming alone: a
  // pale wall at albedo 0.55 x 0.16 still prints ~84/255. That floor is a property
  // of the source room, not something the shader can remove without also killing
  // the subject.)
  ambient: 0.16,
  exposure: 1.0,
  wrap: 0.65,
  // A touch of specular gives skin life, but 0.1 laid a broad sheen over the face
  // that itself reads as plastic; 0.04 keeps a small catchlight without the film.
  specular: 0.04,
  shininess: 40,
  normalStrength: 0.3,
  glow: 1.0,
  bulb: 1.0,

  // geometry interpretation
  perspective: 0.55,
  depthRange: 1.5,
  near: 0.22,

  // shadows
  shadows: true,
  shadowStrength: 0.85,
  shadowSteps: 18,
  shadowBias: 0.012,
  // How much solid matter sits behind a visible surface, scaled per-occluder by
  // its own disparity — see slabFor() in the shader.
  shadowThickness: 0.3,
  // Sampled source radius, in screen heights. The penumbra it throws is this
  // times (receiver-to-occluder / occluder-to-light), so it decides how quickly
  // a shadow loses its edge as the surface catching it moves away.
  shadowSoftness: 0.05,
  // How far behind an occluder its shadow still reaches, as a fraction of the
  // depth range. Depth is re-normalised to the scene's own spread every frame,
  // so this is scene-relative: 0.15 means "about a sixth of the visible depth".
  shadowReach: 0.15,

  // depth post-processing
  edgeAware: true,
  edgeSharpness: 9.0,
  spatialBlur: 1.4,
  temporal: 0.65,

  // presentation
  view: 0, // 0 composite · 1 depth · 2 normals · 3 shadow · 4 source
  fit: 'cover',
  mirror: true,
  quality: 'balanced',
  vignette: 0.0,
  grain: 0.0,

  // runtime, written by the app
  running: false,
  paused: false,
  device: '–',
  depthFps: 0,
  renderFps: 0,
};

export const VIEW_NAMES = ['Composite', 'Depth', 'Normals', 'Shadow', 'Source'];

export function activeLight() {
  return state.lights[Math.min(state.active, state.lights.length - 1)];
}

/** '#rrggbb' -> [r, g, b] in 0..1, gamma-decoded so mixing stays linear. */
export function hexToLinear(hex) {
  const n = parseInt(hex.slice(1), 16);
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return srgb.map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
}
