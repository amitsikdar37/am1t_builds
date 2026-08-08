import * as THREE from 'three';
import { THEME } from './theme.js';
import { ROOM_W, ROOM_H } from './room.js';

/**
 * Birthday decor: balloon clusters, bunting, and fairy-light bokeh.
 *
 * Everything here is instanced or batched. Decor should cost a handful of draw
 * calls total — it sets the mood but it is not what the recipient came to see,
 * so it must not compete with the photos for frame budget.
 */

/**
 * Soft round falloff for one bokeh blob.
 *
 * Deliberately NEUTRAL. It used to be baked warm amber, which fought the
 * per-particle tint: a pink bulb multiplied by an amber sprite arrives orange,
 * so every colour in the palette collapsed toward gold. Greyscale here means the
 * tint attribute is the only thing deciding hue.
 */
function makeBokehSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.28, 'rgba(255, 255, 255, 0.52)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Floating coloured bokeh: fairy-light blobs drifting through the whole corridor.
 * One Points object, one draw call, additive.
 *
 * WHY THIS IS A SHADER AND NOT A ROTATION
 *
 * The previous version wrote static world positions once and then animated the
 * whole Points object with `rotation.y = sin(t) * 0.02 + beat * 0.006`. Rotating a
 * rigid body by a fraction of a degree is not travel — it is a wobble, and folding
 * the beat into that same rotation meant every blob rocked left-right in lockstep
 * on each kick. That is exactly what reads as "moving back and forth according to
 * the beat" instead of as a room full of drifting lights.
 *
 * So each blob now carries its own path, evaluated in the vertex shader:
 *
 *  - Z travels continuously and wraps over the FULL room length, so a blob leaves
 *    past the cake and re-enters behind the visitor. Nothing is anchored.
 *  - X and Y sweep the corridor's whole cross-section on two incommensurate
 *    frequencies, giving each blob a slow Lissajous rather than an orbit around
 *    one spot. Per-blob amplitude, phase and rate mean no two share a path.
 *  - The clock driving all of it is MUSICAL, not wall time (see uBeat below), and
 *    the beat kick is signed off each blob's own seed, so a beat scatters the
 *    field rather than shoving it.
 *
 * Cost is three uniform writes a frame for any number of blobs: no per-particle
 * CPU work and no buffer re-upload.
 */
function buildBokeh(group, corridorLength, count) {
  if (!count) return null;

  // Matches the old spawn window, and now also the wrap window: motes recycle
  // across the entire corridor plus the rotunda rather than living in one slab.
  const Z_MIN = -6;
  const Z_SPAN = corridorLength + 14;

  // Sweep limits. Kept clear of the walls, ceiling and floor by enough margin
  // that the per-blob offset and the beat kick on top still cannot push a blob
  // through a surface — a light clipping the wall breaks the illusion instantly.
  const SWEEP_X = ROOM_W / 2 - 0.5;
  const SWEEP_Y = ROOM_H / 2 - 0.75;
  const CENTRE_Y = ROOM_H / 2;
  // Blobs beyond this fade out. Without it the far end of a long corridor packs
  // into a solid band of dots, which reads as fog rather than as lights.
  const FAR_FADE = 34.0;

  const positions = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const seed = new Float32Array(count);
  const drift = new Float32Array(count);
  const span = new Float32Array(count * 2);
  const tint = new Float32Array(count * 3);

  // Party palette, same hues the shafts use. Pale tints rather than saturated
  // paint, so they read as coloured bulbs catching light rather than as confetti.
  const palette = (THEME.shaftTints || [THEME.bokehColor]).map(h => new THREE.Color(h));

  for (let i = 0; i < count; i++) {
    // Only z is a real start position now. x and y are small per-blob offsets
    // that decorrelate blobs which would otherwise share a sweep amplitude.
    positions[i * 3] = (Math.random() - 0.5) * 0.3;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
    positions[i * 3 + 2] = Math.random() * Z_SPAN;

    // Real per-blob size, which the old field never had: PointsMaterial has no
    // per-point size, so its `scale` attribute was silently ignored and every
    // blob rendered identical. A spread is what makes the field read as depth.
    size[i] = 0.10 + Math.pow(Math.random(), 2.0) * 0.24;
    seed[i] = Math.random();
    // Rate spread. The slowest blob is a third the speed of the fastest, so the
    // field never pulses as one — some are still crossing while others arrive.
    drift[i] = 0.45 + Math.random() * 1.1;
    span[i * 2] = SWEEP_X * (0.35 + Math.random() * 0.65);
    span[i * 2 + 1] = SWEEP_Y * (0.30 + Math.random() * 0.70);

    const col = palette[Math.floor(Math.random() * palette.length)];
    tint[i * 3] = col.r;
    tint[i * 3 + 1] = col.g;
    tint[i * 3 + 2] = col.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aDrift', new THREE.BufferAttribute(drift, 1));
  geo.setAttribute('aSpan', new THREE.BufferAttribute(span, 2));
  geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      // Musical time. Advances faster the louder the music and lurches forward on
      // every beat, so the blobs' whole rhythm — speed, sweep, when they turn —
      // follows the track. Monotonic, so a beat accelerates the drift instead of
      // teleporting anything.
      uBeat: { value: 0 },
      // Steps once per detected beat and phase-shifts the sweeps, so the paths
      // change course with the music rather than repeating one fixed loop.
      uTwist: { value: 0 },
      uPulse: { value: 0 },
      uOpacity: { value: 0.62 },
      uMap: { value: makeBokehSprite() },
      // Written from the renderer's own drawing-buffer size each frame, so point
      // size tracks the adaptive pixel-ratio governor without decor.js needing to
      // be told about resizes.
      uViewportH: { value: 800 },
      uSizeClamp: { value: 70 },
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uBeat;
      uniform float uTwist;
      uniform float uPulse;
      uniform float uViewportH;
      uniform float uSizeClamp;

      attribute float aSize;
      attribute float aSeed;
      attribute float aDrift;
      attribute vec2 aSpan;
      attribute vec3 aTint;

      varying vec3 vTint;
      varying float vTwinkle;
      varying float vFade;

      void main() {
        float m = uBeat * aDrift;
        float ph = aSeed * 6.2831853;

        vec3 p;

        // Travel, wrapped over the whole room.
        p.z = mod(position.z + m * 1.25, ${Z_SPAN.toFixed(2)}) + ${Z_MIN.toFixed(2)};

        // Cross-corridor Lissajous. 0.37 and 0.29 are incommensurate, so the path
        // does not close — a blob never retraces the loop it just flew.
        p.x = sin(m * 0.37 + ph + uTwist) * aSpan.x + position.x;
        p.y = ${CENTRE_Y.toFixed(2)} + sin(m * 0.29 + ph * 1.7 + uTwist * 0.6) * aSpan.y + position.y;

        // Beat kick, signed off the seed so roughly half go up and half go down.
        // A shared, same-direction shove is what made the old field look like one
        // rigid object being nudged on the downbeat.
        p.y += uPulse * 0.22 * sin(ph * 7.0);
        p.x += uPulse * 0.16 * cos(ph * 5.0);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = -mv.z;

        vFade = smoothstep(0.7, 2.6, dist) *
                (1.0 - smoothstep(${(FAR_FADE * 0.68).toFixed(1)}, ${FAR_FADE.toFixed(1)}, dist));
        // Independent slow twinkle per blob, on wall time rather than the musical
        // clock — bulbs shimmer whether or not anything is playing.
        vTwinkle = 0.62 + 0.38 * sin(uTime * 1.7 + ph * 3.0);
        vTint = aTint;

        // Same perspective sizing three's own points shader uses (half the
        // drawing-buffer height over view depth), clamped so a blob passing the
        // near plane cannot become a full-screen flash.
        gl_PointSize = min(uSizeClamp, aSize * uViewportH * 0.5 / max(dist, 0.4));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      uniform float uOpacity;

      varying vec3 vTint;
      varying float vTwinkle;
      varying float vFade;

      // No tonemapping_pars/colorspace_pars includes: three injects both into every
      // ShaderMaterial's fragment prefix already, and including them again is a
      // redefinition error. Only the call sites belong here.

      void main() {
        // The sprite is greyscale, so its alpha is the shape and vTint is the
        // entire colour. Its luminance is reused as a core hotspot, which keeps a
        // bright centre inside the coloured halo.
        vec4 tex = texture2D(uMap, gl_PointCoord);
        vec3 col = vTint * (0.6 + 0.4 * tex.r);
        gl_FragColor = vec4(col, tex.a * uOpacity * vFade * vTwinkle);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  // Positions are computed in the shader and range over the entire corridor, so
  // the geometry's bounding sphere describes none of it — culling against it would
  // blink the field out at glancing angles.
  points.frustumCulled = false;

  // Self-contained resolution tracking. dust.js is told about resizes by main.js;
  // this reads the answer from the renderer instead, which cannot fall out of sync
  // with the governor and needs no wiring.
  const bufferSize = new THREE.Vector2();
  points.onBeforeRender = (renderer) => {
    renderer.getDrawingBufferSize(bufferSize);
    mat.uniforms.uViewportH.value = bufferSize.y;
    // A blob may cover at most ~8% of screen height. Expressed against the buffer
    // rather than as a pixel constant so it holds at every pixel ratio.
    mat.uniforms.uSizeClamp.value = Math.max(8, bufferSize.y * 0.08);
  };

  group.add(points);
  return points;
}

/**
 * Balloon clusters tucked into the corners. InstancedMesh: one geometry, one
 * material, N transforms — 2 draw calls for every balloon in the room.
 */
function buildBalloons(group, corridorLength) {
  const clusters = Math.max(2, Math.floor(corridorLength / 14));
  const perCluster = 5;
  const total = clusters * 2 * perCluster;

  // Low-poly sphere, slightly stretched into a balloon shape.
  const geo = new THREE.SphereGeometry(0.28, 10, 8);
  geo.scale(1, 1.25, 1);

  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.28,
    metalness: 0.15,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, total);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(total * 3), 3
  );

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  // Balloons carry the saturated party palette — this is where the user sees that
  // the room was decorated for a birthday rather than left in gallery neutrals.
  const palette = THEME.partyPalette || [THEME.brass, THEME.brassHighlight, 0xe8b4b8, 0xf5f0e0];

  let idx = 0;
  const anchors = [];

  for (let c = 0; c < clusters; c++) {
    const z = 4 + c * 14 + Math.random() * 3;
    for (const side of [-1, 1]) {
      const baseX = side * (ROOM_W / 2 - 0.7);
      for (let b = 0; b < perCluster; b++) {
        const ox = (Math.random() - 0.5) * 0.5;
        const oy = Math.random() * 0.7;
        const oz = (Math.random() - 0.5) * 0.5;
        const x = baseX + ox;
        const y = ROOM_H - 1.1 + oy;
        const bz = z + oz;

        dummy.position.set(x, y, bz);
        dummy.scale.setScalar(0.8 + Math.random() * 0.4);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);

        color.setHex(palette[Math.floor(Math.random() * palette.length)]);
        mesh.setColorAt(idx, color);

        // Remember the rest position so we can bob them without drifting.
        anchors.push({ x, y, z: bz, phase: Math.random() * Math.PI * 2, scale: dummy.scale.x });
        idx++;
      }
    }
  }

  mesh.count = idx;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);

  return { mesh, anchors, dummy };
}

/**
 * Bunting: triangular flags strung across the ceiling. Built as a single merged
 * geometry with vertex colors so the whole run is one draw call.
 */
function buildBunting(group, corridorLength) {
  const strands = Math.max(2, Math.floor(corridorLength / 12));
  const flagsPer = 9;

  const positions = [];
  const colors = [];
  // Party palette cycling down the strands, same saturated hues as the balloons.
  const palette = (THEME.partyPalette || [THEME.brass, THEME.brassHighlight, 0xe8b4b8, 0xf5f0e0])
    .map(h => new THREE.Color(h));

  for (let s = 0; s < strands; s++) {
    const z = 8 + s * 12;
    const span = ROOM_W - 0.6;
    const startX = -span / 2;
    const step = span / flagsPer;

    for (let f = 0; f < flagsPer; f++) {
      const x = startX + f * step + step / 2;
      const t = f / (flagsPer - 1);
      // Catenary-ish sag across the span.
      const sag = Math.sin(t * Math.PI) * 0.35;
      const topY = ROOM_H - 0.25 - sag;
      const w = step * 0.42;
      const h = 0.3;

      // Downward-pointing triangle
      positions.push(x - w, topY, z);
      positions.push(x + w, topY, z);
      positions.push(x, topY - h, z);

      const col = palette[f % palette.length];
      for (let v = 0; v < 3; v++) colors.push(col.r, col.g, col.b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.75,
    metalness: 0.1,
  });

  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);
  return mesh;
}

export function buildDecor(scene, tier, corridorLength) {
  const group = new THREE.Group();

  const bokeh = buildBokeh(group, corridorLength, tier.bokehCount);
  const balloons = buildBalloons(group, corridorLength);
  buildBunting(group, corridorLength);

  scene.add(group);
  let musicEnergy = 0;
  let musicTreble = 0;
  let beatPulse = 0;

  // ── The musical clock ─────────────────────────────────────────────────────
  //
  // "Change their rhythm according to the beats" is a statement about TIME, not
  // about position, so it is answered with a second clock rather than with an
  // extra term added to a position. `beatClock` is what the bokeh shader reads
  // instead of wall time; everything about the motion — travel speed, how fast
  // the cross-corridor sweeps turn over, how long a blob dwells at the edge of
  // its arc — is a function of it.
  //
  // It advances at `rate`, which sits at a slow idle when nothing is playing and
  // climbs with the music, and each detected beat adds a small forward step. The
  // clock only ever moves forward, so a beat reads as a surge in the drift rather
  // than as a jump cut, and the blobs never snap back the way the old rocking
  // rotation did.
  let beatClock = 0;
  let twist = 0;
  let lastBeatId = -1;
  let lastTime = 0;

  return {
    group,
    update(time) {
      // Derived here rather than taken as a parameter so every existing call site
      // keeps working. Clamped because the first frame, and any return from a
      // background tab, otherwise hands over a delta of seconds — which would
      // teleport the whole field.
      // Clamped at both ends. The ceiling is for the first frame and for returning
      // from a background tab, which otherwise hand over a delta of seconds and
      // teleport the whole field. The floor is because `beatClock` only ever moves
      // forward — a negative delta would run every blob backwards along its path,
      // and one clamp is cheaper than trusting every future caller to pass a
      // monotonic clock.
      const dt = lastTime ? Math.max(0, Math.min(0.05, (time - lastTime) * 0.001)) : 0.016;
      lastTime = time;

      if (bokeh) {
        const u = bokeh.material.uniforms;

        // Idle drift with no music at all, up to roughly 2.4× that when the track
        // is loud. Even a silent room keeps moving — the effect must not depend on
        // audio permission having been granted.
        const rate = 0.55 + musicEnergy * 1.15 + musicTreble * 0.35;
        beatClock += dt * rate;
        // Each beat nudges the clock forward, so the surge arrives on the downbeat
        // and then decays back into the ambient drift.
        beatClock += beatPulse * dt * 2.6;
        // And re-aims the sweeps. This is the part that changes the rhythm rather
        // than just the speed: shifting the phase mid-flight means a blob turns
        // early or late on the beat, so the field's pattern reshuffles with the
        // music instead of cycling a fixed loop faster and slower.
        twist += beatPulse * dt * 0.9;

        u.uTime.value = time * 0.001;
        u.uBeat.value = beatClock;
        u.uTwist.value = twist;
        u.uPulse.value = beatPulse;
        u.uOpacity.value = Math.min(0.95,
          0.52 + Math.sin(time * 0.0006) * 0.08 + musicEnergy * 0.22 + beatPulse * 0.18
        );
      }

      // Gentle balloon bob. Writing all instance matrices each frame is fine at
      // this count (<100) and avoids per-balloon objects in the scene graph.
      const { mesh, anchors, dummy } = balloons;
      const t = time * 0.001;
      for (let i = 0; i < anchors.length; i++) {
        const a = anchors[i];
        dummy.position.set(
          a.x + Math.sin(t * 0.5 + a.phase) * 0.05,
          a.y + Math.sin(t * 0.8 + a.phase) * 0.09,
          a.z
        );
        dummy.rotation.z = Math.sin(t * 0.4 + a.phase) * 0.12;
        dummy.scale.setScalar(a.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      beatPulse *= 0.86;
    },

    setMusicReactive(analysis) {
      musicEnergy = analysis?.energy || 0;
      musicTreble = analysis?.treble || 0;
      beatPulse = Math.max(beatPulse, analysis?.pulse || 0);

      // beatId steps exactly once per detected onset, where `pulse` is a decaying
      // envelope that several frames see partway down. Reacting to the id is how
      // the field gets one discrete event per beat: a full-strength kick that
      // fires on the beat itself and cannot be re-triggered by the tail.
      const id = analysis?.beatId;
      if (id !== undefined && id !== lastBeatId) {
        lastBeatId = id;
        beatPulse = 1.0;
        // A quarter-turn of extra phase per beat. Large enough that the pattern is
        // audibly on the music, small enough that no blob visibly jumps.
        twist += 0.26;
      }
    },
  };
}
