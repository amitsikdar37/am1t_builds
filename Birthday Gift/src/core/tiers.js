/**
 * Device capability tiering.
 *
 * The recipient may be on anything from a flagship desktop to a three-year-old
 * budget Android. We score the device up front and pick a quality budget, then
 * let the runtime FPS governor (core/loop.js) correct us if we guessed wrong.
 *
 * Tier can be forced with ?tier=low|mid|high for testing.
 */

export const TIERS = {
  LOW: {
    name: 'low',
    texture: 512,
    // Raised from 1.25 to 1.5 with antialias now on. The user reported LOW looks
    // "blurry and low graphics" on real phones — which it was, because 1.25 on a
    // 3x 390px phone renders 488px internally and scales up, leaving soft edges
    // on every photo, caption, and highlight. 1.5 hits 585px: still under the
    // native 1170, but close enough that antialiasing can bridge the gap. The FPS
    // governor stays active, so a phone that truly can't sustain this will degrade
    // at runtime rather than being locked to soft rendering forever.
    pixelRatio: 1.5,
    antialias: true,
    bloom: false,
    confetti: 250,
    smoke: 40,
    liveVideos: 1,
    candleLights: false,
    bokehCount: 80,
    // Real refractive glazing on the frames. MeshPhysicalMaterial with
    // transmission makes three re-render the scene into a transmission buffer
    // every frame, so it stays off anywhere but HIGH; the other tiers use a
    // painted sheen band that costs one transparent quad.
    glass: false,

    // ── Atmosphere ──────────────────────────────────────────────────────────
    // Airborne dust. Cheap enough to keep even here: the field is animated
    // entirely in the vertex shader and wraps around the camera, so the CPU
    // cost is three uniform writes a frame regardless of count, and the fill
    // cost is a few thousand 2-4px sprites.
    dust: 1800,
    // Volumetric-looking light shafts. Two triangles each, so the budget is
    // fill rate, not geometry — this caps how many can overlap at once.
    shafts: 4,
    // Keep a recognisable reflection even on budget phones, but make its second
    // scene pass small and infrequent: 256² every fourth frame is only 65k pixels
    // per update (and roughly 16k amortised per display frame). The texture
    // persists between updates, so the floor still looks polished while camera
    // motion—not reflection resolution—remains the priority.
    reflectSize: 256,
    reflectStride: 4,
    reflectHQ: false,
    // Broad-band music analysis only. A 12Hz refresh still catches visible beat
    // pulses while leaving more main-thread time for scrolling on budget phones.
    partyAnalysisHz: 12,

    /**
     * Anisotropic filtering. This is the highest-value setting in the whole file
     * for how sharp this particular scene looks, and it was the thing actually
     * making the phone view blurry.
     *
     * The reason is the geometry. A corridor viewed down its own axis presents
     * its floor, walls and ceiling at extreme grazing angles, and that is exactly
     * the case ordinary mipmapping handles worst: it has to pick one level of
     * detail for a footprint that is stretched hundreds of times further in one
     * axis than the other, so it picks a blurry one and the whole surface smears.
     * Anisotropic filtering samples along the stretched axis instead, which is
     * the difference between plank seams you can see to the end of the room and a
     * beige gradient.
     *
     * It is also close to free on the tile-based GPUs phones use, because the
     * extra samples are texture-cache hits on data already resident. This is why
     * it is 8 even on LOW while the pixel ratio stays modest — spending here buys
     * far more visible sharpness per millisecond than spending on resolution.
     *
     * Values above the hardware maximum are clamped by three at upload time
     * (WebGLTextures.js), so these are requests rather than assertions.
     */
    anisotropy: 8,

    /**
     * Resolution of the procedurally generated wall and floor canvases.
     *
     * Raised from a hard-coded 512 because these are drawn once at boot and then
     * never touched again — the cost is a few milliseconds of 2D canvas work and
     * some texture memory, and there is no per-frame cost whatsoever. A 512 tile
     * stretched over a corridor tens of metres long is being magnified well past
     * its own detail, so the plank seams and fabric weave arrive as mush no matter
     * how high the render resolution is. Doubling the source is the cheapest
     * sharpness in the project.
     */
    surfaceTex: 1024,
  },
  MID: {
    name: 'mid',
    // Full-resolution photos rather than the 512 variant. The photographs are the
    // one thing the recipient actually leans in to look at, and `srcFor` in
    // scene/frames.js switches to the downscaled variant at <= 512 — so this
    // single number was costing the gift its subject matter.
    texture: 1024,
    pixelRatio: 2.0,
    antialias: true,
    bloom: true,
    confetti: 500,
    smoke: 80,
    liveVideos: 1,
    candleLights: true,
    bokehCount: 120,
    glass: false,

    dust: 3000,
    shafts: 6,
    // A 384px target is a quarter the pixels of a 1080p phone screen, and the
    // stride halves how often it is filled. The reflection then lags the camera
    // by one frame, which at scroll speed is well under a pixel of drift.
    reflectSize: 384,
    reflectStride: 2,
    reflectHQ: false,
    partyAnalysisHz: 20,
    anisotropy: 8,
    surfaceTex: 1024,
  },
  HIGH: {
    name: 'high',
    texture: 1024,
    // Desktops and flagships have the fill rate to render at native density.
    pixelRatio: 2.5,
    antialias: true,
    bloom: true,
    confetti: 900,
    smoke: 140,
    liveVideos: 2,
    candleLights: true,
    bokehCount: 200,
    glass: true,

    dust: 6000,
    shafts: 9,
    reflectSize: 1024,
    reflectStride: 1,
    reflectHQ: true,
    partyAnalysisHz: 30,
    anisotropy: 16,
    surfaceTex: 2048,
  },
};

/**
 * Read the GPU string via WEBGL_debug_renderer_info. Returns '' when the
 * extension is blocked (Firefox privacy.resistFingerprinting, some Safari
 * builds) — callers must treat '' as "unknown", not as "bad GPU".
 */
function getGPUInfo() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return '';
    return (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
  } catch {
    return '';
  }
}

function isMobile() {
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /macintosh/i.test(navigator.userAgent)); // iPadOS masquerades as Mac
}

/**
 * Score the device from static signals. Higher is better.
 * Deliberately conservative: an unknown device scores as MID, not HIGH, because
 * a stuttering premium experience is worse than a smooth simpler one.
 */
export function detectTier() {
  const forced = new URLSearchParams(location.search).get('tier');
  if (forced) {
    const t = TIERS[forced.toUpperCase()];
    if (t) return { ...t, forced: true };
  }

  let score = 0;

  const mem = navigator.deviceMemory; // Chrome/Edge only, undefined elsewhere
  if (mem !== undefined) {
    if (mem >= 8) score += 3;
    else if (mem >= 4) score += 1;
    else score -= 2;
  }

  const cores = navigator.hardwareConcurrency;
  if (cores !== undefined) {
    if (cores >= 8) score += 2;
    else if (cores >= 4) score += 1;
    else score -= 2;
  }

  const gpu = getGPUInfo();
  if (gpu) {
    // Software rasterisers are a hard downgrade regardless of anything else.
    if (/swiftshader|llvmpipe|software/.test(gpu)) score -= 6;
    else if (/apple (a1[4-9]|m[1-9])/.test(gpu)) score += 3;
    else if (/adreno \(tm\) (6[5-9]\d|7\d\d|8\d\d)/.test(gpu)) score += 2;
    else if (/mali-g(7[0-9]|[89]\d)/.test(gpu)) score += 1;
    else if (/nvidia|radeon rx|geforce/.test(gpu)) score += 3;
    else if (/mali-4|adreno \(tm\) [345]\d\d|powervr/.test(gpu)) score -= 3;
  }

  if (isMobile()) score -= 2;

  // Very small viewports are almost always budget phones.
  if (Math.min(screen.width, screen.height) <= 400) score -= 1;

  if (score >= 5) return { ...TIERS.HIGH };
  if (score >= 0) return { ...TIERS.MID };
  return { ...TIERS.LOW };
}

/**
 * Measure real FPS over a short window. Run during the intro screen, where a
 * few hundred ms of sampling costs nothing, to catch devices whose static
 * signals lied. Resolves with the average FPS observed.
 *
 * The wall-clock guard is not optional. requestAnimationFrame does not fire at
 * all in a backgrounded tab, or while the page is not compositing — so without
 * it, opening the gift link in a background tab (or a hidden preview pane)
 * leaves this promise pending forever and boot never completes. The recipient
 * would come back to the tab and find a dead "Tap to Enter" button.
 *
 * Resolving with null rather than a number says "no measurement", which is
 * distinct from "measured, and it was slow" — refineTier must not downgrade on
 * the absence of data.
 */
export function probeFPS(durationMs = 500) {
  return new Promise((resolve) => {
    let frames = 0;
    let settled = false;
    const start = performance.now();

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      resolve(value);
    };

    // Generous relative to durationMs: a genuinely slow first frame shouldn't
    // trip the guard, but a tab that never composites resolves promptly.
    const guard = setTimeout(() => finish(null), durationMs + 1500);

    function tick() {
      frames++;
      const elapsed = performance.now() - start;
      if (elapsed >= durationMs) {
        finish((frames / elapsed) * 1000);
      } else {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  });
}

/**
 * Combine the static guess with the measured FPS. Only ever downgrades —
 * a device that renders an empty intro screen fast has proven nothing about
 * how it will handle a full scene, so we never promote on this signal.
 *
 * A null measurement means the probe couldn't run (backgrounded tab). Keep the
 * static tier; the runtime FPS governor will correct it once the tab is visible
 * and actually rendering.
 */
export function refineTier(tier, measuredFPS) {
  if (tier.forced) return tier;
  if (measuredFPS == null) return tier;
  if (measuredFPS < 40 && tier.name === 'high') return { ...TIERS.MID };
  if (measuredFPS < 30) return { ...TIERS.LOW };
  return tier;
}
