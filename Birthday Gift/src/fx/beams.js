import * as THREE from 'three';
import { THEME } from '../scene/theme.js';
import { ROOM_W, ROOM_H } from '../scene/room.js';

/**
 * Visible light shafts.
 *
 * Until now the lamps only lit surfaces — the air between the fixture and the
 * wall was perfectly empty, which is what made the corridor read as a diagram of
 * a room rather than a room. Real galleries are full of scattering: you see the
 * beam itself, not just what it lands on.
 *
 * This is NOT raymarched volumetrics. A true volumetric pass marches every pixel
 * through a shadow map, which on a mid-range phone costs more than everything
 * else in this scene put together. What's here is the technique shipped games
 * actually use: an open-ended cone shell, additively blended, whose opacity is
 * driven by how square-on the surface faces the camera.
 *
 * That last part is the whole trick, and it is counter-intuitive. Rendering a
 * shell double-sided means a ray toward the middle of the cone punches through
 * two near-perpendicular faces, while a ray at the silhouette grazes one. Making
 * opacity rise with |dot(normal, view)| therefore accumulates most light down the
 * axis and least at the edges — a soft solid core with feathered sides, which is
 * what a real shaft looks like. Weighting it the other way (the usual Fresnel
 * reflex) produces a hollow tube, and the illusion dies instantly.
 *
 * Everything is computed in view space so the cones can be non-uniformly scaled
 * to fit each fixture without the lighting skewing.
 */

// Ceiling fixtures run down the centre of the corridor. Exported because the
// dust field brightens motes as they drift through these same shafts, and the
// two must agree on where the light actually is — a mote lighting up in clear
// air is worse than no mote lighting up at all.
export const BEAM_SPACING = 7.5;
export const BEAM_START = 4.0;
export const BEAM_RADIUS = 1.05;

// Gel colours for the ceiling downlights, cycled along the corridor. Falls back
// to the old single warm hue if a theme predates the palette.
const SHAFT_TINTS = THEME.shaftTints && THEME.shaftTints.length
  ? THEME.shaftTints
  : [THEME.beamColor];

const SHAFT_TOP = ROOM_H - 0.05;

/**
 * Vertical streaks scrolling slowly down the shaft. Without this the cone is a
 * clean mathematical gradient, and clean is exactly what an air-filled beam is
 * not — dust is unevenly distributed, so the light through it is banded.
 */
function makeBeamNoise(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // Soft vertical bands, drawn wrapping in x so the cone's UV seam is invisible.
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * size;
    const w = 3 + Math.random() * 22;
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    const a = 0.10 + Math.random() * 0.22;
    const light = Math.random() > 0.5;
    const col = light ? '255,255,255' : '0,0,0';
    g.addColorStop(0, `rgba(${col},0)`);
    g.addColorStop(0.5, `rgba(${col},${a})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    // Draw three times so a band straddling the edge appears on both sides.
    for (const off of [-size, 0, size]) ctx.fillRect(x - w + off, 0, w * 2, size);
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const VERT = /* glsl */`
  uniform float uInvH;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  varying float vDist;
  varying float vAlong;

  void main() {
    vUv = uv;
    // 0 at the wide open end, 1 at the narrow end where the bulb is. Taken from
    // local geometry rather than uv.y so it stays correct for cones that are
    // scaled or rotated onto a picture light.
    vAlong = position.y * uInvH + 0.5;

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // normalMatrix is the inverse-transpose of modelView, so this stays correct
    // under the non-uniform scaling used to fit a cone to its fixture.
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vDist = length(mv.xyz);

    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  uniform vec3  uColor;
  uniform float uIntensity;
  uniform float uTime;
  uniform float uNearFade;
  uniform float uFarFade;
  uniform float uTail;
  uniform float uSharp;
  uniform float uCap;
  uniform sampler2D uNoise;

  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  varying float vDist;
  varying float vAlong;

  // No tonemapping_pars/colorspace_pars includes here: three injects both into
  // every ShaderMaterial's fragment prefix automatically (WebGLProgram.js), so
  // including them again redefines sRGBTransferOETF and the colour-space
  // matrices and the shader fails to compile. Only the call sites belong here.

  void main() {
    // See the note at the top of this file: opacity RISES with how head-on the
    // shell is, which is what fills the core instead of ringing the silhouette.
    //
    // The EXPONENT is what separates "scattering" from "solid pillar", and it was
    // 1.7. That is very nearly linear over the middle of the shell, so the whole
    // width of the cone sat near full opacity and only the last few degrees at
    // the silhouette fell away — a cylinder of paint with soft edges. Raising it
    // concentrates the accumulation into a narrow core and lets the body of the
    // cone go thin, which is the actual shape of a light shaft: a bright thread
    // down the axis with haze around it, not a wall.
    float facing = abs(dot(vN, vView));
    float core = pow(facing, uSharp);

    float n = texture2D(uNoise, vec2(vUv.x * 2.0, vAlong * 0.6 - uTime * 0.014)).r;
    float grain = 0.66 + n * 0.68;

    // Brightest at the bulb, thinning as it spreads — inverse-square, roughly.
    float along = mix(uTail, 1.0, vAlong * vAlong);
    // Feather the open ends so neither ring of the cone shows as a hard edge.
    float ends = smoothstep(0.0, 0.09, vAlong) * smoothstep(1.0, 0.93, vAlong);

    // The camera scrolls straight through these. Without a near fade, passing
    // through a shaft flashes the whole screen as the shell fills the frustum.
    float near = smoothstep(0.0, uNearFade, vDist);
    // Custom distance falloff, because an additive shader gets no scene fog and
    // distant shafts would otherwise stay at full strength through the haze.
    //
    // It starts early and finishes well short of the cull radius on purpose.
    // Perspective compresses the far half of the corridor into a handful of
    // pixels, so every remaining shaft lands on the same few fragments and adds
    // up — a gentle fade that still leaves three of them at half strength blows
    // the vanishing point to pure white.
    float far = 1.0 - smoothstep(uFarFade * 0.28, uFarFade * 0.72, vDist);

    // Ceiling on a single shell's contribution. Additive blending has no upper
    // bound of its own: two cones overlapping, or one cone seen end-on, will
    // happily drive a pixel past white and take the cake behind it with them.
    // Air scatters a *fraction* of the light passing through it, so capping this
    // is physical, not a fudge — and it is the difference between a beam you can
    // see the cake through and a beam that hides it.
    float a = min(uCap, core * along * ends * grain * near * far * uIntensity);
    if (a < 0.002) discard;

    gl_FragColor = vec4(uColor, a);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * One cone shell. Height and radii are baked into the geometry rather than
 * applied as a scale, so `uInvH` matches the mesh and repeated cones can still
 * share a material.
 */
function makeCone(noise, {
  height, rTop, rBottom, color, intensity, far,
  tail = 0.16, radial = 14, sharp = 3.4, cap = 0.32,
}) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, height, radial, 1, true);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uTime: { value: 0 },
      uNearFade: { value: 1.6 },
      uFarFade: { value: far },
      uTail: { value: tail },
      uSharp: { value: sharp },
      uCap: { value: cap },
      uInvH: { value: 1 / height },
      uNoise: { value: noise },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 6;
  return mesh;
}

/** Additive disc where a shaft meets the floor. */
function makeFloorPool(radius, color, opacity) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.34)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);

  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: tex,
      color,
      transparent: true,
      depthWrite: false,
      opacity,
      blending: THREE.AdditiveBlending,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 5;
  return mesh;
}

/**
 * Recessed ceiling fixtures — the physical source each shaft comes out of. A
 * beam with no visible emitter reads as a rendering artefact, so the brass
 * bezel and the hot disc inside it are not decoration, they're what makes the
 * light legible as light.
 */
function buildFixtures(group, positions) {
  const bezelGeo = new THREE.CylinderGeometry(0.19, 0.22, 0.06, 16);
  const bezelMat = new THREE.MeshStandardMaterial({
    color: THEME.brass,
    roughness: 0.32,
    metalness: 0.9,
  });
  const discGeo = new THREE.CircleGeometry(0.17, 16);
  const discMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.86,
    toneMapped: false,
  });

  const bezels = new THREE.InstancedMesh(bezelGeo, bezelMat, positions.length);
  const discs = new THREE.InstancedMesh(discGeo, discMat, positions.length);
  const d = new THREE.Object3D();

  positions.forEach((z, i) => {
    d.position.set(0, ROOM_H - 0.03, z);
    d.rotation.set(0, 0, 0);
    d.updateMatrix();
    bezels.setMatrixAt(i, d.matrix);

    // Face down, just below the bezel's mouth.
    d.position.set(0, ROOM_H - 0.062, z);
    d.rotation.set(Math.PI / 2, 0, 0);
    d.updateMatrix();
    discs.setMatrixAt(i, d.matrix);
    // Instanced bulb colours mirror the gel used by the shaft directly below.
    // This makes the visible source and its emitted volume read as one fixture.
    discs.setColorAt(i, new THREE.Color(SHAFT_TINTS[i % SHAFT_TINTS.length]));
  });

  bezels.instanceMatrix.needsUpdate = true;
  discs.instanceMatrix.needsUpdate = true;
  if (discs.instanceColor) discs.instanceColor.needsUpdate = true;
  group.add(bezels, discs);
  return discs;
}

/**
 * @param cakeSpot {{ position: THREE.Vector3, target: THREE.Vector3 }} anchors
 *   for the big shaft over the cake, taken from the real SpotLight so the two
 *   cannot drift apart.
 */
export function createBeams(scene, tier, corridorLength, cakeSpot) {
  const group = new THREE.Group();
  const noise = makeBeamNoise();

  // tier.shafts is a budget on how many cones may overlap at once, not on how
  // many exist — the cost here is fill rate, and a shaft twenty metres back
  // costs the same per pixel as the one you are standing in. Turning the budget
  // into a cull radius is what actually enforces it: two half-spacings per
  // shaft either side of the camera works out to exactly tier.shafts on screen.
  const CULL_DIST = Math.max(12, (tier.shafts * BEAM_SPACING) / 2);

  // ── Ceiling shafts ────────────────────────────────────────────────────────
  const zs = [];
  for (let z = BEAM_START; z < corridorLength - 2; z += BEAM_SPACING) zs.push(z);

  const fixtureDiscs = buildFixtures(group, zs);

  const shaftH = SHAFT_TOP;
  const shafts = zs.map((z, i) => {
    // Every downlight is gelled a different colour, cycling down the corridor.
    // This is where most of the room's colour now comes from: a shaft is the
    // one thing in the scene that tints the air itself, so gelling them washes
    // the walls, the floor pool and the dust inside it all at once — far more
    // effective per draw call than repainting surfaces would be.
    const tint = SHAFT_TINTS[i % SHAFT_TINTS.length];
    const cone = makeCone(noise, {
      height: shaftH,
      // Narrower at the floor than the 1.05 it was. The cone's job is to be
      // seen through, and its screen area is what decides how much of the wall
      // behind it survives — geometry is a blunter and more reliable control
      // over that than any amount of shader tuning.
      rTop: 0.15,
      rBottom: BEAM_RADIUS,
      color: tint,
      // Halved. The previous 0.52 was set when the shell spread its opacity
      // across the whole cone; with the core concentrated it lands far harder
      // for the same number, so the number has to come down to match.
      intensity: 0.26,
      cap: 0.20,
      far: CULL_DIST,
    });
    cone.position.set(0, shaftH / 2, z);

    // The pool on the floor carries the same gel, so the colour arrives on a
    // surface as well as in the air — that pairing is what makes it read as a
    // lamp with a coloured gel rather than as fog that happens to be pink.
    const pool = makeFloorPool(BEAM_RADIUS * 1.5, tint, 0.15);
    pool.position.set(0, 0.015, z);

    group.add(cone, pool);
    return { z, cone, pool };
  });

  // ── Cake shaft ────────────────────────────────────────────────────────────
  // Wider, warmer and stronger: it is the destination of the whole corridor, and
  // the one beam the visitor stops and looks at rather than passing through.
  const cakeDir = new THREE.Vector3().subVectors(cakeSpot.position, cakeSpot.target);
  // Stops SHORT of the cake instead of overshooting it by a metre. The cone used
  // to run a full metre past its own target, which put the widest, brightest end
  // of the shell level with the icing and the candles — the shaft was drawing
  // over the exact object it exists to illuminate. Ending just above the top
  // tier lets the light arrive at the cake without covering it.
  const cakeH = Math.max(1.0, cakeDir.length() - 0.6);
  const cakeCone = makeCone(noise, {
    height: cakeH,
    rTop: 0.18,
    // 1.55 was the single worst number in this file. The camera comes to rest
    // looking straight down the corridor's axis, so this cone is seen end-on
    // with the cake directly behind it — a 3.1m-wide additive shell in that
    // position is not lighting the cake, it is a screen in front of it. Just
    // over half the width, and it now flares to the cake's own footprint rather
    // than past it.
    rBottom: 0.82,
    color: 0xfff0cc,
    // The finale's brightness comes from the candles, the bloom and the confetti
    // — all of which are behind this shell and were being washed out by it.
    intensity: 0.30,
    // The tightest cap in the scene, because this is the one cone the visitor
    // stops and stares through rather than passing under.
    cap: 0.16,
    // Sharper than the ceiling shafts: a thin bright thread over the cake reads
    // as a spotlight picking it out, which is the whole point of the fixture.
    sharp: 4.2,
    tail: 0.22,
    radial: 18,
    // The one shaft that must not fade with the others: it marks the end of the
    // corridor and should be legible from the moment the rotunda comes into
    // view. It can afford to be, because unlike the ceiling shafts there is only
    // ever one of it — the tight falloff exists to stop a row of them stacking
    // up at the vanishing point, and a lone cone has nothing to stack with.
    far: CULL_DIST * 2.2,
  });
  cakeCone.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    cakeDir.clone().normalize()
  );
  // Hang the cone off its narrow end so the apex sits at the bulb.
  cakeCone.position.copy(cakeSpot.position).addScaledVector(
    cakeDir.clone().normalize(), -cakeH / 2
  );
  group.add(cakeCone);

  // ── Picture-light spill ───────────────────────────────────────────────────
  // Pooled exactly like the SpotLights in scene/lighting.js, and for the same
  // reason: one cone per frame would put an unbounded number of overlapping
  // transparent shells on screen, and overdraw is what actually kills phones.
  const SPILL_POOL = 4;
  const spillH = 1.5;
  // Named because update() re-derives it every frame against distance. Two
  // literals would silently drift apart the first time either is tuned.
  const SPILL_INTENSITY = 0.30;
  const spills = [];
  for (let i = 0; i < SPILL_POOL; i++) {
    const cone = makeCone(noise, {
      height: spillH,
      rTop: 0.05,
      rBottom: 0.48,
      // These stay warm and un-gelled on purpose. They fall across the
      // photographs, and a coloured light on someone's face is a colour cast on
      // the photo — the one place in this room where the colour scheme has to
      // give way to the thing being looked at.
      color: THEME.pictureLightColor,
      intensity: SPILL_INTENSITY,
      cap: 0.22,
      sharp: 3.0,
      tail: 0.25,
      radial: 10,
      far: 14,
    });
    cone.visible = false;
    group.add(cone);
    spills.push(cone);
  }

  scene.add(group);

  const up = new THREE.Vector3(0, 1, 0);
  const axis = new THREE.Vector3();
  const fixtureColor = new THREE.Color();
  let musicEnergy = 0;
  let musicBass = 0;
  let musicMid = 0;
  let beatPulse = 0;
  let beatSequence = 0;
  let lastBeatId = 0;
  let musicActive = false;

  return {
    group,

    /**
     * Hide the parts of the effect that aren't worth a second scene pass. The
     * floor reflection re-renders everything from below; a shaft reflected in
     * polished timber is most of the payoff, but the little picture-light
     * spills are near-invisible down there and cost the same as the big ones.
     */
    setReflectionPass(on) {
      for (const s of spills) s.visible = on ? false : s.userData.wanted === true;
    },

    setMusicReactive(analysis) {
      musicActive = analysis?.active === true;
      musicEnergy = analysis?.energy || 0;
      musicBass = analysis?.bass || 0;
      musicMid = analysis?.mid || 0;
      beatPulse = Math.max(beatPulse, analysis?.pulse || 0);
      if (analysis?.beatId !== undefined && analysis.beatId !== lastBeatId) {
        lastBeatId = analysis.beatId;
        beatSequence++;
      }
    },

    update(time, cameraZ, frames, hideCakeShaft = false) {
      const t = time * 0.001;

      // The complete centre run is one InstancedMesh (one draw call). Updating
      // its tiny colour buffer gives every visible bulb a proper beat chase
      // without creating a PointLight per fixture — essential on budget phones.
      for (let i = 0; i < zs.length; i++) {
        const chaseGroup = (i + beatSequence) % 4;
        const hit = musicActive && chaseGroup === 0 ? beatPulse : 0;
        const palette = musicActive
          ? (i + beatSequence) % SHAFT_TINTS.length
          : i % SHAFT_TINTS.length;
        // Deeper dim/lit ratio than before. What makes a run of lamps read as
        // real lighting is that the un-accented ones go genuinely DARK — at a
        // 0.58 floor every bulb stayed lit and the chase was a slight ripple
        // across an evenly bright row, which is why the whole thing looked like a
        // colour filter over the room. Dropping the floor and raising the accent
        // takes the on/off ratio from about 2.7:1 to roughly 7:1.
        const blink = musicActive
          ? 0.34 + musicEnergy * 0.26 + hit * 2.05
          : 0.92;
        fixtureColor.setHex(SHAFT_TINTS[palette]).multiplyScalar(blink);
        fixtureDiscs.setColorAt(i, fixtureColor);
      }
      if (fixtureDiscs.instanceColor) fixtureDiscs.instanceColor.needsUpdate = true;
      fixtureDiscs.material.opacity = 0.96;

      for (const s of shafts) {
        const d = Math.abs(s.z - cameraZ);
        const near = d < CULL_DIST;
        s.cone.visible = near;
        s.pool.visible = near;
        if (near) {
          s.cone.material.uniforms.uTime.value = t;
          const index = Math.round((s.z - BEAM_START) / BEAM_SPACING);
          const chase = musicActive && (index + beatSequence) % 4 === 0 ? 1 : 0;
          const hit = beatPulse * chase;
          const palette = musicActive
            ? (index + beatSequence) % SHAFT_TINTS.length
            : index % SHAFT_TINTS.length;
          s.cone.material.uniforms.uColor.value.setHex(SHAFT_TINTS[palette]);
          s.pool.material.color.setHex(SHAFT_TINTS[palette]);
          // ── The shaft chases too ───────────────────────────────────────────
          //
          // The bulb above and the beam below it have to agree. Previously the
          // fixture disc chased while its shaft held a constant 0.34 base, so the
          // beam stayed lit under a bulb that had gone dark — which reads as a
          // coloured cone hanging in the air independently of any lamp. Both now
          // share `hit`, so an accented fixture fires its shaft and its floor pool
          // together and the un-accented ones drop back to a dim wash.
          //
          // uCap is lifted on the accent as well as uIntensity. Intensity alone
          // only widens the region that saturates at the cap; raising the cap is
          // what lets an accented beam get genuinely BRIGHTER rather than merely
          // fatter, which is the difference between a lamp firing and a lamp
          // being nudged. All of this is uniform writes — no new geometry, no new
          // draw calls, nothing added to a low-end phone's frame cost.
          const lit = musicActive
            ? 0.42 + musicEnergy * 0.30 + musicBass * 0.20 + hit * 1.95
            : 1;
          s.cone.material.uniforms.uIntensity.value = 0.34 * lit;
          s.cone.material.uniforms.uCap.value = 0.20 * (1 + hit * 0.75);
          s.pool.material.opacity = 0.18 * (musicActive
            ? 0.45 + musicMid * 0.30 + hit * 1.70
            : 1);
        }
      }
      cakeCone.material.uniforms.uTime.value = t;
      cakeCone.material.uniforms.uIntensity.value = 0.30 * (
        1 + musicEnergy * 0.24 + musicBass * 0.22 + beatPulse * 0.32
      );
      // The showcase camera looks down the cone's open axis. From there its
      // translucent shell overlaps itself into a large brown ring, so retire
      // only this decorative shaft during that view; the real SpotLight still
      // illuminates the cake and the beam returns during the front view.
      cakeCone.visible = !hideCakeShaft &&
        Math.abs(cakeSpot.position.z - cameraZ) < CULL_DIST + 8;

      if (!frames || frames.length === 0) {
        beatPulse *= 0.82;
        return;
      }

      // Nearest SPILL_POOL frames, same selection the light pool makes.
      const sorted = frames
        .map((f) => ({ f, d: Math.abs(f.z - cameraZ) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, SPILL_POOL);

      for (let i = 0; i < SPILL_POOL; i++) {
        const cone = spills[i];
        const hit = sorted[i];

        if (!hit || !hit.f.lightPos || !hit.f.lightTarget || hit.d > 16) {
          cone.visible = false;
          cone.userData.wanted = false;
          continue;
        }

        axis.subVectors(hit.f.lightPos, hit.f.lightTarget);
        const len = axis.length() || spillH;
        axis.normalize();

        cone.quaternion.setFromUnitVectors(up, axis);
        cone.position.copy(hit.f.lightPos).addScaledVector(axis, -spillH / 2);
        // Stretch to actually reach the artwork. Baked geometry can't know the
        // photo's aspect ratio, and view-space normals keep the shading honest
        // under the scale.
        cone.scale.set(1, len / spillH, 1);

        cone.material.uniforms.uTime.value = t;
        cone.material.uniforms.uIntensity.value =
          SPILL_INTENSITY * Math.max(0, 1 - hit.d / 16) *
          (1 + musicEnergy * 0.20 + beatPulse * 0.20);
        cone.visible = true;
        cone.userData.wanted = true;
      }
      beatPulse *= 0.82;
    },
  };
}
