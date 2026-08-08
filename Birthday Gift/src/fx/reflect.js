import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { THEME } from '../scene/theme.js';

/**
 * Mirror-polished floor.
 *
 * A matte wood plane occupies the bottom third of every frame and contributes
 * nothing — it is a dead zone. Making it reflective doubles the apparent
 * density of the room for free: the cake, the frames and the light shafts all
 * appear twice, and the corridor reads as an expensive gallery rather than a
 * corridor with a texture on the floor.
 *
 * Two decisions carry this:
 *
 * 1. The reflection is a SEPARATE TRANSPARENT PLANE sitting a couple of
 *    millimetres above the real floor, alpha-blended over it — not a
 *    replacement for it. The stock Reflector outputs opaque `blendOverlay`,
 *    which throws away the oak albedo entirely and gives you a bathroom
 *    mirror. Layering means the floor is still a properly lit
 *    MeshStandardMaterial and the reflection is an addition to it, which is
 *    both what sealed timber actually does and what keeps this tunable.
 *
 * 2. Strength is FRESNEL × ROUGHNESS. Fresnel because reflections strengthen
 *    at grazing angles, so the far end of the corridor mirrors strongly while
 *    the floor directly under the camera barely does — that gradient is most
 *    of what sells it. Roughness because the floor's own grain map then
 *    smears the reflection along the planks instead of leaving one uniform
 *    sheet of glass.
 *
 * COST: this is the only thing in the scene that re-renders the whole world a
 * second time. LOW uses a 192px target every fourth frame; MID renders a 384px
 * target every other frame; HIGH renders full. The FPS governor lowers update
 * frequency further instead of removing the reflection, so every tier retains
 * the visual depth of a polished floor.
 */

const VERT = /* glsl */`
  uniform mat4 textureMatrix;

  varying vec4 vUv;
  varying vec2 vGrain;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vDepth;

  void main() {
    vUv = textureMatrix * vec4(position, 1.0);
    // The floor's own surface coordinates, kept separate from the projective
    // ones above — the grain has to follow the planks, not the screen.
    vGrain = uv;

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = -mv.xyz;
    vDepth = -mv.z;

    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  uniform vec3 color;
  uniform sampler2D tDiffuse;
  uniform sampler2D tRoughness;
  uniform vec2 uRoughRepeat;
  uniform float uStrength;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uGain;
  uniform float uKnee;

  varying vec4 vUv;
  varying vec2 vGrain;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vDepth;

  // No tonemapping_pars/colorspace_pars includes here: three injects both into
  // every ShaderMaterial's fragment prefix automatically (WebGLProgram.js), so
  // including them again redefines sRGBTransferOETF and the colour-space
  // matrices and the shader fails to compile. Only the call sites belong here.

  void main() {
    // Projective fetch: the coordinates come from the mirrored camera, so this
    // is the scene as seen from underneath the floor.
    vec4 refl = texture2DProj(tDiffuse, vUv);

    // Grazing angles reflect more. The camera flies down the corridor a metre
    // and a half up, so the floor near the lens is near-perpendicular and the
    // floor at the far end is near-grazing — this is the gradient that reads as
    // polish rather than as a second image pasted underneath.
    //
    // Two changes from the version that was invisible. The exponent was 2.6,
    // which is a correct Schlick-ish curve for glass and quite wrong for a
    // sealed floor: it held the reflection near zero across the entire near half
    // of the corridor, which is the half that fills the screen. And there is now
    // a FLOOR under it, because varnished timber has a real specular response
    // even looked at straight down — at exactly zero the beams terminate on the
    // planks with a hard edge, which is the "abruptly stop" the room was
    // showing.
    float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
    float fresnel = mix(0.24, 1.0, pow(1.0 - facing, 1.4));

    // Grain and plank seams are rougher than the boards, so they scatter more
    // and mirror less. Without this the floor is a sheet of glass with a wood
    // photo behind it. Eased off: at 0.62 the grain was removing most of what
    // little reflection survived the fresnel curve above.
    float rough = texture2D(tRoughness, vGrain * uRoughRepeat).r;
    float gloss = 1.0 - clamp(rough, 0.0, 1.0) * 0.38;

    // The scene is fogged; an unfogged reflection would stay razor sharp into
    // the haze and give the corridor a false horizon.
    //
    // Pushed back, because this curve and the fresnel curve above are opposed —
    // fresnel needs distance to strengthen and haze was removing it from 14m,
    // so the two peaks never met and their product was near zero everywhere.
    // The band where the floor actually mirrors now sits in front of the haze
    // rather than inside it.
    float haze = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);

    float a = clamp(fresnel * gloss * haze * uStrength, 0.0, 1.0);

    // ── Highlight-weighted opacity ────────────────────────────────────────────
    // The reflected image is mostly fogged air: measured over a full target, 65%
    // of it is flat background and nothing in it exceeded 0.35 luma. Blending
    // that uniformly over warm oak does not read as a mirror, it reads as a grey
    // veil — the floor gets *darker* and no brighter, which is the "no reflection
    // visible" the desktop was showing.
    //
    // What the eye actually reads as polish is the bright things: the fixtures,
    // the lit frames, the cake. So opacity is weighted toward luminance — dim
    // reflected air stays nearly transparent and lets the timber through, while
    // highlights come through at full strength and are lifted by uGain.
    float lum = dot(refl.rgb, vec3(0.2126, 0.7152, 0.0722));
    float hi = smoothstep(uKnee * 0.35, uKnee, lum);
    // Weighting, not gating. Measured over a full target the reflected corridor
    // spans only 0.13–0.21 linear, so a hard highlight gate would find nothing to
    // pass; this keeps the dim end at just over half alpha and the bright end at
    // full, which is enough to turn a flat veil into readable contrast without
    // dropping the overall strength the phones already look right at.
    a *= 0.55 + 0.45 * hi;

    // Tinted by the timber it is bouncing off — a reflection in warm oak is
    // warmer than the thing being reflected. Highlights are gained up so the
    // fixtures and frames actually register against the lit floor beneath.
    vec3 rgb = refl.rgb * color * (1.0 + uGain * hi);

    gl_FragColor = vec4(rgb, a);

    // tDiffuse holds linear scene colour (three disables both the tone map and
    // the output transfer when rendering into a target), so this plane has to be
    // graded like any other surface. Under the composer both are no-ops; they
    // matter the moment this is drawn straight to the canvas.
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * @param {THREE.Mesh} floorMesh floor plane built by scene/room.js. Its
 *   geometry, transform and roughnessMap are all reused, so the reflection
 *   cannot drift out of register with the wood underneath it.
 * @param {() => number} getFPS from core/loop.js.
 */
export function createFloorReflection(scene, floorMesh, tier, getFPS) {
  // LOW tier, or any caller that doesn't want a second scene pass.
  if (!tier.reflectSize) {
    return {
      reflector: null,
      state: () => ({ retired: true, stride: 0, strength: 0 }),
      retire() {},
      attach() {},
      dispose() {},
    };
  }

  const roughMap = floorMesh.material.roughnessMap;

  const reflector = new Reflector(floorMesh.geometry, {
    color: new THREE.Color(THEME.floorReflectTint),
    textureWidth: tier.reflectSize,
    textureHeight: tier.reflectSize,
    // Slightly generous: the corridor is long and shallow, so the reflection
    // plane sits nearly edge-on to the virtual frustum and a tight bias makes
    // the oblique near plane clip the first metre of the reflection away.
    clipBias: 0.004,
    multisample: tier.reflectHQ ? 4 : 0,
    shader: {
      name: 'PolishedFloorShader',
      uniforms: {
        // The three the Reflector itself writes into. They must exist or its
        // constructor throws on the assignment.
        color: { value: null },
        tDiffuse: { value: null },
        textureMatrix: { value: null },

        tRoughness: { value: roughMap },
        uRoughRepeat: { value: new THREE.Vector2(1, 1) },
        // Lower tiers use a softer contribution as well as a smaller target;
        // this hides blockiness without sacrificing the readable reflection.
        uStrength: { value: tier.name === 'low' ? 0.58 : tier.name === 'mid' ? 0.78 : 0.92 },
        uFogNear: { value: 26 },
        uFogFar: { value: 62 },
        // Highlight lift, tuned against a luminance histogram of a real reflection
        // target rather than guessed: the reflected corridor occupies 0.13–0.21
        // linear (mean 0.171), so the knee sits at the top of that range and the
        // toe below its floor. Picked so `hi` actually sweeps most of 0..1 across
        // the content that exists — a knee above 0.21 would never engage at all.
        uGain: { value: 0.9 },
        uKnee: { value: 0.24 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    },
  });

  // The roughness map is tiled across the corridor by the floor material. The
  // reflector samples the same texture, so it has to tile it the same way —
  // otherwise the grain modulation is stretched over the whole room and looks
  // like a single smudge.
  if (roughMap) {
    reflector.material.uniforms.uRoughRepeat.value.copy(roughMap.repeat);
  }

  // Blended over the wood, not instead of it. depthWrite off so the beams and
  // floor pools sitting just above the floor still composite correctly.
  reflector.material.transparent = true;
  reflector.material.depthWrite = false;

  reflector.position.copy(floorMesh.position);
  reflector.rotation.copy(floorMesh.rotation);
  // A hair above the timber. Any less and the two planes z-fight along the far
  // half of the corridor, where depth precision is worst.
  reflector.position.y += 0.004;
  // Under the beams (6) and their floor pools (5), so light lying on the floor
  // reads as being on top of the polish rather than under it.
  reflector.renderOrder = 3;

  scene.add(reflector);

  // ── Runtime governor ──────────────────────────────────────────────────────
  // The scene re-render happens inside the Reflector's onBeforeRender, so
  // gating that one function gates the entire cost — the mesh keeps drawing
  // with the texture it already has.
  const renderReflection = reflector.onBeforeRender;

  // Two consecutive bad samples before acting: a single dip while photo textures
  // are still streaming in is not evidence about the device.
  //
  // A bad sample lowers update frequency, never visibility. The texture remains
  // valid between updates, so a slow phone gets a slightly more delayed mirror
  // rather than abruptly losing the floor treatment altogether.
  const FPS_FLOOR = tier.name === 'high' ? 45 : 38;
  let retired = false;
  let stride = tier.reflectStride;
  let poorSamples = 0;
  let frame = 0;

  // Set by attach(); the reflection pass skips whatever isn't worth a second
  // draw at this resolution.
  let dust = null;
  let beams = null;

  // ── Aspect-aware target sizing ──────────────────────────────────────────────
  //
  // The Reflector's target was a fixed square, which is wrong for any canvas that
  // isn't one. The virtual camera copies the MAIN camera's projection matrix, so
  // the full horizontal field of view is squeezed into `reflectSize` columns
  // whatever the canvas is doing. Measured on a 730px-wide canvas that is already
  // a 1.9x horizontal undersample; on a 16:9 desktop at devicePixelRatio 2 it is
  // about 5x, which smears every reflected frame into a flat smudge. A portrait
  // phone canvas is nearly square and much smaller, so it barely undersamples at
  // all — which is exactly why the reflection survived on mobile and vanished on
  // desktop.
  //
  // Height is held at the tier's number and width GROWS with aspect, never
  // shrinks. That matters: a budget-preserving fit would have traded mobile's
  // horizontal resolution away to buy vertical, and mobile is the case that
  // currently looks right. At aspect <= 1 this returns the old square exactly, so
  // phones are bit-for-bit unchanged and only wide canvases pay for more texels.
  const MAX_W = Math.min(1600, tier.reflectSize * 3);
  const bufSize = new THREE.Vector2();
  let sizedW = tier.reflectSize;
  let sizedH = tier.reflectSize;

  function fitTarget(renderer) {
    renderer.getDrawingBufferSize(bufSize);
    if (bufSize.x < 1 || bufSize.y < 1) return;

    const aspect = bufSize.x / bufSize.y;
    const h = tier.reflectSize;
    // Never finer than the canvas itself — past 1:1 the extra texels are pure
    // cost for no visible gain.
    const w = Math.min(MAX_W, Math.round(bufSize.x),
      Math.max(tier.reflectSize, Math.round(tier.reflectSize * aspect)));

    // setSize tears down and reallocates the framebuffer, so only act on a real
    // change. Without the threshold a canvas animating its width would thrash
    // the allocator every frame.
    if (Math.abs(w - sizedW) < 12 && Math.abs(h - sizedH) < 12) return;
    sizedW = w;
    sizedH = h;
    reflector.getRenderTarget().setSize(w, h);
  }

  reflector.onBeforeRender = function (renderer, sceneRef, camera) {
    frame++;

    if (retired) return;

    fitTarget(renderer);

    // Sampled about once a second at 60fps. loop.js's own FPS counter is
    // already averaged over a 1s window, so there is nothing to smooth here.
    if (frame % 60 === 0) {
      const fps = getFPS();
      if (fps > 0 && fps < FPS_FLOOR) {
        if (++poorSamples >= 2) {
          poorSamples = 0;
          if (stride < 8) {
            // Still drawing, just half as often. The texture persists between
            // renders, so the visible cost is a frame or two of lag in the
            // reflection — far cheaper than losing it.
            stride = Math.min(8, stride * 2);
          }
        }
      } else {
        poorSamples = 0;
      }
    }

    // MID renders every other frame. The reflection then trails the camera by
    // one frame, which at scroll speed is a fraction of a pixel of drift — and
    // it halves the cost of the most expensive thing on screen.
    // Populate the target immediately, then adopt the tier cadence. Otherwise a
    // stride-4 LOW device briefly composites an uninitialised texture at boot.
    if (frame !== 1 && frame % stride !== 0) return;

    if (dust) dust.setReflectionPass(true);
    if (beams) beams.setReflectionPass(true);

    renderReflection.call(this, renderer, sceneRef, camera);

    if (dust) dust.setReflectionPass(false);
    if (beams) beams.setReflectionPass(false);
  };

  return {
    reflector,

    /**
     * What the governor has done to the effect so far. There is otherwise no way
     * to tell a reflection that is subtle from one that has been switched off,
     * which made the last round of tuning guesswork.
     */
    state: () => ({
      retired, stride,
      strength: reflector.material.uniforms.uStrength.value,
      target: [sizedW, sizedH],
    }),

    /**
     * Second rung of the governor's ladder in core/loop.js. Sets the same internal
     * flag the module's own FPS watchdog uses, so there is one notion of "retired"
     * rather than an external `visible = false` that the watchdog cannot see.
     */
    retire() {
      retired = true;
      reflector.visible = false;
    },

    /**
     * Hand over the atmosphere effects so they can opt parts of themselves out
     * of the reflection pass. Called after they're constructed, because the
     * reflection is built before them (it needs the floor, they don't).
     */
    attach(dustHandle, beamsHandle) {
      dust = dustHandle;
      beams = beamsHandle;
    },

    dispose() {
      reflector.dispose();
      scene.remove(reflector);
    },
  };
}
