import * as THREE from 'three';
import { THEME } from '../scene/theme.js';
import { ROOM_W, ROOM_H } from '../scene/room.js';
import { BEAM_SPACING, BEAM_START, BEAM_RADIUS } from './beams.js';

/**
 * Airborne dust.
 *
 * Sterile air is the single biggest tell that a room is synthetic. Real air
 * always has something suspended in it, and because those motes sit at every
 * distance between the eye and the far wall, they give the brain a continuous
 * parallax read on the depth of the space — which no amount of wall detail can.
 * They also keep the frame alive while the visitor has stopped scrolling, so the
 * scene never freezes into a screenshot.
 *
 * Three decisions carry this:
 *
 * 1. The field WRAPS AROUND THE CAMERA rather than spanning the corridor. A
 *    corridor-length field would need tens of thousands of motes to reach useful
 *    density near the eye, and all but a handful would be too far away to
 *    resolve. Wrapping keeps the same particles perpetually just-ahead, so a
 *    few thousand look like millions and the count is independent of how many
 *    photos the sender added.
 *
 * 2. All motion is in the VERTEX SHADER, driven by one time uniform. There is no
 *    per-particle CPU work, no buffer re-upload per frame, and nothing to
 *    garbage-collect — the whole field costs three uniform writes a frame.
 *
 * 3. Motes BRIGHTEN inside the light shafts, using the same beam geometry
 *    fx/beams.js draws. This is what ties the two effects into one phenomenon:
 *    the shaft is visible *because* there is dust in it. Without the coupling
 *    you get two unrelated overlays that happen to share a screen.
 */

// How far the wrapping window extends. Mostly ahead of the camera, because
// motes behind it are pure cost — but not entirely, or they visibly pop into
// existence at the edges of vision when the camera turns toward the cake.
const SPAN_AHEAD = 26.0;
const SPAN_BEHIND = 7.0;
const SPAN = SPAN_AHEAD + SPAN_BEHIND;

// Cycle index is computed in the vertex shader so each mote picks up whichever
// gel it is currently inside. Falls back to the old behaviour if the palette
// predates the tint array.
const TINT_COUNT = (THEME.shaftTints && THEME.shaftTints.length) || 1;

const VERT = /* glsl */`
  uniform float uTime;
  uniform float uCamZ;
  uniform float uPixelScale;
  uniform float uSizeClamp;
  uniform vec3 uTints[${TINT_COUNT}];

  attribute float aSize;
  attribute float aPhase;
  attribute float aDrift;

  varying float vFade;
  varying float vGlow;
  varying vec3 vTint;

  void main() {
    vec3 p = position;

    // Slow convection: a rise plus a lazy horizontal wander. Real dust is not
    // falling, it's suspended — the air moves it more than gravity does.
    float t = uTime;
    p.y += mod(t * aDrift * 0.045 + aPhase * 3.3, ${ROOM_H.toFixed(2)});
    p.y = mod(p.y, ${ROOM_H.toFixed(2)});
    p.x += sin(t * 0.16 + aPhase * 6.2831) * 0.24;
    p.z += cos(t * 0.11 + aPhase * 4.1) * 0.20;

    // Wrap into a window that travels with the camera. Two mods because GLSL's
    // mod is positive-definite: shift in, wrap, shift back out.
    float zRel = mod(p.z - uCamZ + ${SPAN_BEHIND.toFixed(1)}, ${SPAN.toFixed(1)});
    p.z = uCamZ - ${SPAN_BEHIND.toFixed(1)} + zRel;

    // ── Is this mote inside a light shaft? ──────────────────────────────────
    // Ceiling shafts are a repeating series of vertical cones on the centre
    // line, so proximity is a fold of z against the spacing plus a distance
    // from x=0. The cone widens toward the floor, hence the y term.
    float zc = abs(mod(p.z - ${BEAM_START.toFixed(1)} + ${(BEAM_SPACING / 2).toFixed(3)},
                       ${BEAM_SPACING.toFixed(2)}) - ${(BEAM_SPACING / 2).toFixed(3)});
    float widen = mix(0.28, 1.0, 1.0 - p.y / ${ROOM_H.toFixed(2)});
    float r = ${BEAM_RADIUS.toFixed(2)} * widen;
    float inBeam = (1.0 - smoothstep(r * 0.35, r, zc)) *
                   (1.0 - smoothstep(r * 0.35, r, abs(p.x)));

    // Which downlight the mote is under, cycling through the gel palette. The
    // fold against spacing puts shaft N at index N % palette-length, so the
    // shafts and the motes stay locked together — a mote under the pink shaft
    // glows pink, and the same mote one spacing later glows blue.
    int idx = int(mod((p.z - ${BEAM_START.toFixed(1)}) / ${BEAM_SPACING.toFixed(2)}, float(${TINT_COUNT})));
    vTint = uTints[idx];

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;

    // Fade in at the far edge of the window so nothing pops, and out well clear
    // of the lens. The near cutoff is generous on purpose: point size grows as
    // 1/distance, so a mote allowed within a metre of the camera is a
    // dinner-plate-sized blob no matter what the size clamp says, and a hundred
    // of them at once is a snowstorm rather than air.
    vFade = smoothstep(1.3, 4.5, dist) *
            (1.0 - smoothstep(${(SPAN_AHEAD * 0.62).toFixed(1)}, ${SPAN_AHEAD.toFixed(1)}, dist));
    vGlow = inBeam;

    // Perspective sizing, clamped: unclamped, a mote passing the near plane
    // becomes a full-screen quad and strobes the whole frame.
    gl_PointSize = min(uSizeClamp, aSize * uPixelScale / max(dist, 0.35));
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform vec3 uBeamColor;
  uniform float uOpacity;

  varying float vFade;
  varying float vGlow;
  varying vec3 vTint;

  // No tonemapping_pars/colorspace_pars includes here: three injects both into
  // every ShaderMaterial's fragment prefix automatically (WebGLProgram.js), so
  // including them again redefines sRGBTransferOETF and the colour-space
  // matrices and the shader fails to compile. Only the call sites belong here.

  void main() {
    // Procedural soft disc. Cheaper than a texture fetch and, at these sizes,
    // indistinguishable — plus there's no sprite to upload or keep resident.
    // No discard: on a tile-based mobile GPU that costs more than simply
    // blending a zero, and this pass writes no depth for it to protect.
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d);
    float falloff = 1.0 - smoothstep(0.04, 0.25, r2);

    // Motes in a shaft are several times brighter than motes in shadow. That
    // ratio is the effect: an evenly-lit field just looks like screen noise.
    //
    // The in-beam colour is now the mote's own gel rather than one shared warm
    // hue, so a speck drifting through the pink downlight goes pink and the same
    // speck under the next one goes blue. This is the coupling that makes the
    // gels read as light filling a volume instead of as coloured cones hanging
    // in clear air.
    vec3 col = mix(uColor, vTint, vGlow * 0.85);
    // Individually almost invisible. Thousands of these overlap additively, so
    // an alpha that looks right on one mote is a white-out on the field —
    // legibility here comes from the count and the in-beam ratio, not from any
    // single particle being bright.
    //
    // Nudged up from 0.10/0.62. The motes were correctly scaled against beams
    // that were three times too bright; with the shafts capped they had gone
    // from being swamped to being genuinely too faint to see.
    float a = falloff * vFade * uOpacity * (0.15 + vGlow * 0.72);

    gl_FragColor = vec4(col, a);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createDust(scene, tier) {
  const count = tier.dust;
  if (!count) {
    return {
      points: null,
      update() {},
      retire() {},
      setReflectionPass() {},
      setPixelScale() {},
      setMusicReactive() {},
    };
  }

  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const drift = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Biased toward the centre line, where the shafts are and where the camera
    // travels. A uniform spread puts most of the budget in the corners.
    const xr = Math.random() * 2 - 1;
    pos[i * 3] = Math.sign(xr) * Math.pow(Math.abs(xr), 1.6) * (ROOM_W / 2 - 0.15);
    pos[i * 3 + 1] = Math.random() * ROOM_H;
    pos[i * 3 + 2] = Math.random() * SPAN;

    // A wide size spread is what creates the depth read — a field of identically
    // sized dots reads as a flat screen-space overlay no matter how it moves.
    // The absolute numbers are small: dust is sub-millimetre, and the moment a
    // mote is big enough to have a recognisable shape it stops being dust.
    size[i] = 0.35 + Math.pow(Math.random(), 2.4) * 1.15;
    phase[i] = Math.random();
    drift[i] = 0.5 + Math.random() * 1.6;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aDrift', new THREE.BufferAttribute(drift, 1));

  // Build the tint array for the uniform. Falls back to the old single warm hue
  // if the theme predates the palette.
  const tints = (THEME.shaftTints && THEME.shaftTints.length)
    ? THEME.shaftTints.map(h => new THREE.Color(h))
    : [new THREE.Color(THEME.beamColor)];

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCamZ: { value: 0 },
      // Placeholders. main.js calls setPixelScale immediately after
      // construction, but these have to be in the right order of magnitude or
      // the very first frame renders a screenful of blobs before it lands.
      uPixelScale: { value: 14 },
      uSizeClamp: { value: 9 },
      uColor: { value: new THREE.Color(THEME.dustColor) },
      uBeamColor: { value: new THREE.Color(THEME.beamColor) },
      uTints: { value: tints },
      uOpacity: { value: 0.85 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  // The field is rebuilt around the camera every frame, so its bounding sphere
  // is meaningless — leaving culling on makes it flicker out at glancing angles.
  points.frustumCulled = false;
  points.renderOrder = 7;
  scene.add(points);
  let basePixelScale = 14;
  // Set once by the FPS governor's quality ladder and never cleared. Kept separate
  // from `points.visible` because the reflection pass toggles that every frame, and
  // a permanent decision must not be expressible in a field something else
  // overwrites 60 times a second.
  let retired = false;

  return {
    points,
    musicEnergy: 0,
    musicHigh: 0,
    beatPulse: 0,

    /**
     * Last rung of the governor's ladder in core/loop.js. One-way: a device that
     * needed this headroom will need it again, and dust fading in and out every few
     * seconds is worse than no dust.
     */
    retire() {
      retired = true;
      points.visible = false;
    },

    /**
     * Dust is invisible in a floor reflection — the motes are unlit points a few
     * pixels across, and at reflection resolution they resolve to nothing but
     * noise. Skipping them there is free quality.
     */
    setReflectionPass(on) {
      points.visible = retired ? false : !on;
    },

    /**
     * Point size is in device pixels, so it has to track the pixel ratio — and
     * the adaptive governor in core/loop.js changes that ratio at runtime, so
     * this is called on every resize rather than once at startup.
     *
     * The clamp is the important number. Point size goes as 1/distance, so
     * without a ceiling one mote drifting past the near plane covers the screen.
     * Nine CSS pixels is about the largest a speck can be and still read as a
     * speck rather than a snowflake.
     */
    setPixelScale(rendererHeight, pixelRatio) {
      basePixelScale = 0.016 * rendererHeight * pixelRatio;
      mat.uniforms.uPixelScale.value = basePixelScale;
      mat.uniforms.uSizeClamp.value = 9 * pixelRatio;
    },

    update(time, cameraZ) {
      mat.uniforms.uTime.value = time * 0.001;
      mat.uniforms.uCamZ.value = cameraZ;
      // Point size is the cheapest way to make existing motes sparkle on beats:
      // no new particles, draw calls, buffers, or per-particle CPU work.
      const reactiveScale = 1 + this.musicEnergy * 0.08 + this.musicHigh * 0.13 + this.beatPulse * 0.14;
      mat.uniforms.uPixelScale.value = basePixelScale * reactiveScale;
      this.beatPulse *= 0.80;
    },

    setMusicReactive(analysis) {
      this.musicEnergy = analysis?.energy || 0;
      this.musicHigh = analysis?.treble || 0;
      this.beatPulse = Math.max(this.beatPulse, analysis?.pulse || 0);
    },
  };
}
