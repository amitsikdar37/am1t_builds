/**
 * Animation loop with an adaptive pixel-ratio governor.
 *
 * Ported from the sibling 3D Theater project (js/main.js:44-53), which proved
 * the approach. The idea: rather than picking a resolution once and hoping,
 * sample FPS every second and trade resolution for framerate in small steps.
 * A mid-range phone that starts to struggle quietly drops to a lower internal
 * resolution instead of dropping frames — far less noticeable to the user.
 */

export function createLoop({ renderer, tier, onUpdate, onResize, onQuality }) {
  let frames = 0;
  let lastSample = performance.now();
  let currentPR = renderer.getPixelRatio();
  const maxPR = Math.min(window.devicePixelRatio, tier.pixelRatio);
  // Raised from 0.6. Below about 0.85 the image is soft enough that the cure is
  // worse than the disease — a visitor notices mush long before they notice the
  // difference between 50fps and 60fps, and the effect-shedding ladder below now
  // provides somewhere else for the savings to come from.
  const minPR = 0.85;

  // Hysteresis: we only react after a couple of consecutive bad samples so a
  // single hitch (texture decode, GC pause) doesn't permanently degrade quality.
  let badSamples = 0;
  let goodSamples = 0;

  let lastTime = performance.now();
  let running = true;
  let currentFPS = 60;

  /**
   * Order of sacrifice.
   *
   * The old governor had exactly one lever — internal resolution — so every
   * performance problem was answered by making the entire image blurrier. That is
   * the most visible possible response, and it is what left the phone view soft.
   *
   * These are in the order a viewer misses them least. Post-processing bloom goes
   * first: it is a pair of full-screen passes and its absence reads as slightly
   * less glow. Only when both are gone does resolution start to fall, and it
   * stops well short of mush.
   *
   * The floor reflection is deliberately NOT on this ladder. It is the only
   * effect here that self-governs: fx/reflect.js reads the same FPS and doubles
   * its update stride — never its visibility — so a slow device gets a more
   * delayed mirror rather than no mirror. Permanently retiring it (the old
   * behaviour) is what made the reflection vanish on desktop: a heavy desktop
   * trips the ladder during startup texture loads, the reflection is shed, and
   * the "never reinstated" rule below keeps it gone for the whole visit even
   * though the machine would have cruised once the scene settled. Mobile kept
   * its reflection only because its smaller target never tripped the ladder.
   *
   * Each step is announced through onQuality so the owning module can act; the
   * loop does not reach into the scene itself.
   */
  const LADDER = ['bloom', 'dust'];
  let rung = 0;

  function shed() {
    if (rung < LADDER.length) {
      const what = LADDER[rung++];
      if (onQuality) onQuality(what);
      return true;
    }
    if (currentPR > minPR) {
      setPixelRatio(Math.max(minPR, currentPR - 0.25));
      return true;
    }
    return false;
  }

  function setPixelRatio(pr) {
    currentPR = pr;
    renderer.setPixelRatio(pr);
    if (onResize) onResize(window.innerWidth, window.innerHeight);
  }

  function frame(now) {
    if (!running) return;

    // Clamped so a backgrounded tab or a long stall can't produce a huge dt
    // that teleports the camera or explodes the particle integrators.
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    frames++;
    if (now - lastSample >= 1000) {
      currentFPS = (frames * 1000) / (now - lastSample);
      frames = 0;
      lastSample = now;

      // A genuinely bad sample gets acted on immediately rather than after two.
      // The user's hard requirement is that the site must never freeze, and 30fps
      // is already visible stutter — waiting a second to confirm it is a second
      // of jank the visitor has to sit through. Mild dips keep the old patience.
      if (currentFPS < 30) {
        shed();
        badSamples = 0;
        goodSamples = 0;
      } else if (currentFPS < 45) {
        badSamples++;
        goodSamples = 0;
        if (badSamples >= 2) {
          shed();
          badSamples = 0;
        }
      } else if (currentFPS > 57) {
        goodSamples++;
        badSamples = 0;
        // Slower to climb back up than to come down — avoids oscillating
        // between two ratios on a device sitting right at the threshold.
        //
        // Resolution is restored before any shed effect is reinstated, and the
        // effects are never reinstated at all. A device that needed the headroom
        // once will need it again, and flickering bloom on and off every few
        // seconds is far more objectionable than simply not having it.
        if (goodSamples >= 4 && currentPR < maxPR) {
          setPixelRatio(Math.min(maxPR, currentPR + 0.25));
          goodSamples = 0;
        }
      } else {
        badSamples = 0;
        goodSamples = 0;
      }
    }

    onUpdate(dt, now);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  // Stop rendering entirely when the tab is hidden. On a phone this is the
  // difference between a warm battery and a hot one.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      lastTime = performance.now();
      lastSample = performance.now();
      frames = 0;
      requestAnimationFrame(frame);
    }
  });

  return {
    getFPS: () => currentFPS,
    getPixelRatio: () => currentPR,
    stop: () => { running = false; },
  };
}
