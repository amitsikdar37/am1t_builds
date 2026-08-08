import * as THREE from 'three';

/**
 * Bootstrap the Three.js renderer, scene, and camera.
 * Called once at startup, after tier detection.
 */

/**
 * Three exposes a VERTICAL field of view, but what decides whether the pictures
 * on the side walls are in shot is the HORIZONTAL one — and that is the vertical
 * angle scaled by the aspect ratio. A fixed 52° reads as about 82° across a
 * 16:9 desktop window and about 25° across a portrait phone, which is why the
 * gallery looked like a corridor seen through a keyhole on mobile: a frame 2.9m
 * off the centre line does not enter a 25° frustum until it is some 13m ahead,
 * and it leaves again long before the camera draws level with it.
 *
 * So the vertical angle opens up as the viewport narrows, holding the horizontal
 * framing as close to the desktop composition as it can. It deliberately does
 * not hold it exactly: a true horizontal lock works out to roughly 124° vertical
 * on a modern phone, which is a fish-eye. Clamped, a portrait phone gets about
 * 36° horizontal instead of 25° — better, but still less than half the desktop
 * figure, so the rest of the gap is closed in core/scroll.js by turning the
 * camera toward each photograph rather than by bending more room into shot.
 */
const BASE_FOV = 52;
const REFERENCE_ASPECT = 16 / 9;
// Past about here the perspective stretch at the top and bottom of a portrait
// screen becomes more distracting than the extra width is worth.
const MAX_FOV = 70;

export function fovForAspect(aspect) {
  const halfH = Math.tan(THREE.MathUtils.degToRad(BASE_FOV) / 2) * REFERENCE_ASPECT;
  // Guard the divide: some mobile browsers report a zero-height viewport for a
  // frame or two while the URL bar animates, and a hidden tab or preview pane
  // reports zero for both axes.
  //
  // The NaN check is the part that matters. A 0/0 aspect is NaN, and
  // Math.max(NaN, 0.3) is NaN, not 0.3 — so the old guard passed NaN straight
  // through to camera.fov, which makes the whole projection matrix NaN and the
  // scene renders nothing at all. Non-finite input therefore falls back to the
  // reference aspect rather than being clamped.
  const safe = Number.isFinite(aspect) ? Math.max(aspect, 0.3) : REFERENCE_ASPECT;
  const v = 2 * Math.atan(halfH / safe);
  return Math.min(MAX_FOV, Math.max(BASE_FOV, THREE.MathUtils.radToDeg(v)));
}

export function createEngine(container, tier) {
  const renderer = new THREE.WebGLRenderer({
    antialias: tier.antialias,
    alpha: false,
    powerPreference: 'high-performance',
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier.pixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // 1.25 pushed the cream walls into the shoulder of the tone curve, where they
  // clip to white and every additive effect on top of them has nowhere to go.
  // Backed off so the walls land mid-curve and the beams have headroom.
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = false;

  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // Background and fog agree, so the corridor dissolves into the void rather
  // than ending at a visible wall of haze. Both are a shade below the wall
  // albedo now: a fog brighter than the surfaces it covers erases the depth cue
  // it exists to provide, and leaves a light shaft nothing to be brighter than.
  scene.background = new THREE.Color(0xf6dcc2);
  scene.fog = new THREE.FogExp2(0xf3d5b8, 0.013);

  // Same non-finite guard as fovForAspect, for the same reason: a hidden tab or
  // preview pane reports a zero-size viewport, and a NaN aspect makes the whole
  // projection matrix NaN so nothing renders even once the tab becomes visible.
  const safeAspect = (w, h) => (w > 0 && h > 0 ? w / h : REFERENCE_ASPECT);

  const aspect = safeAspect(window.innerWidth, window.innerHeight);
  const camera = new THREE.PerspectiveCamera(fovForAspect(aspect), aspect, 0.1, 200);
  camera.position.set(0, 1.6, 0);

  window.addEventListener('resize', () => {
    camera.aspect = safeAspect(window.innerWidth, window.innerHeight);
    // Recomputed, not just carried over. A phone rotating between portrait and
    // landscape is the exact case this exists for, and leaving fov alone here
    // would mean the fix only ever applied to whatever orientation the page
    // happened to load in.
    camera.fov = fovForAspect(camera.aspect);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera };
}
