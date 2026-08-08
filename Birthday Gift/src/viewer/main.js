import * as THREE from 'three';
import { detectTier, probeFPS, refineTier } from '../core/tiers.js';
import { createEngine } from '../core/engine.js';
import { createLoop } from '../core/loop.js';
import { createScroll } from '../core/scroll.js';
import { createInteraction } from '../core/interaction.js';
import { buildRoom, ROOM_H } from '../scene/room.js';
import { buildLighting } from '../scene/lighting.js';
import { buildDecor } from '../scene/decor.js';
import { buildFrames, FRAME_SPACING, FIRST_FRAME_Z } from '../scene/frames.js';
import { buildCake } from '../scene/cake.js';
import { createSmoke } from '../fx/smoke.js';
import { createConfetti } from '../fx/confetti.js';
import { createDust } from '../fx/dust.js';
import { createBeams } from '../fx/beams.js';
import { createFloorReflection } from '../fx/reflect.js';
import { createPost } from '../fx/post.js';
import { createPartyLights } from '../fx/partyLights.js';
import { createMusic } from '../audio/music.js';
import { createBlowDetector, micSupported } from '../audio/blow.js';

/** Fallback gift used when no gift.json is present (dev / bare checkout). */
const DEMO_GIFT = {
  v: 1,
  name: 'Friend',
  theme: 'midnight-gold',
  letter: 'Add your photos in the Studio to build the real gift.',
  candles: 5,
  frames: Array.from({ length: 8 }, (_, i) => ({
    type: 'photo',
    caption: `Memory ${i + 1}`,
    w: 1024,
    h: 768,
    wall: i % 2 === 0 ? 'L' : 'R',
  })),
};

const el = (id) => document.getElementById(id);

/**
 * Asset paths inside a manifest are relative to the manifest itself, not to the
 * page. That distinction only matters in the Studio, where the viewer runs from
 * /src/viewer/ but the manifest and its assets are served from the API root —
 * resolving against the page would look for the photos in the wrong directory.
 * In the published gift both are the same directory, so this is a no-op there.
 */
function resolveGiftPaths(gift, giftUrl) {
  const base = new URL(giftUrl, location.href);
  const abs = (p) => (p ? new URL(p, base).href : p);

  return {
    ...gift,
    frames: (gift.frames || []).map((f) => ({
      ...f,
      src: abs(f.src),
      src512: abs(f.src512),
      lqip: abs(f.lqip),
      poster: abs(f.poster),
    })),
    music: gift.music ? { ...gift.music, src: abs(gift.music.src) } : undefined,
  };
}

async function loadGift() {
  // The Studio points the preview at its live manifest; the published site just
  // uses the gift.json sitting next to index.html.
  const giftUrl = new URLSearchParams(location.search).get('gift') || './gift.json';

  try {
    const res = await fetch(giftUrl, { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    if (!data.frames || !Array.isArray(data.frames) || data.frames.length === 0) {
      return { ...DEMO_GIFT, ...data, frames: DEMO_GIFT.frames };
    }
    return resolveGiftPaths(data, giftUrl);
  } catch {
    return DEMO_GIFT;
  }
}

async function main() {
  const gift = await loadGift();

  el('intro-name').textContent = `Happy Birthday, ${gift.name}`;
  el('finale-title').textContent = `Happy Birthday, ${gift.name}!`;
  el('finale-letter').textContent = gift.letter?.trim() ||
    `Wishing you a beautiful year ahead, ${gift.name}.`;
  document.title = `Happy Birthday, ${gift.name}`;

  // ── Tier selection ────────────────────────────────────────────────────────
  let tier = detectTier();
  const measured = await probeFPS(450);
  tier = refineTier(tier, measured);

  const container = el('canvas-container');
  const { renderer, scene, camera } = createEngine(container, tier);

  // Corridor geometry is derived from the frame count. Frames alternate walls,
  // so N frames occupy roughly N/2 spacings of corridor.
  const frameCount = gift.frames.length;
  const lastFrameZ = FIRST_FRAME_Z + (frameCount - 1) * FRAME_SPACING;
  const cakeZ = lastFrameZ + 9;
  const corridorLength = cakeZ + 5;

  const room = buildRoom(scene, corridorLength, tier);
  const lighting = buildLighting(scene, tier, corridorLength);
  const decor = buildDecor(scene, tier, corridorLength);
  const frames = buildFrames(scene, gift.frames, tier);
  const cake = buildCake(scene, tier, cakeZ, gift.candles ?? 5, gift.name);
  const smoke = createSmoke(scene, tier);
  const confetti = createConfetti(scene, tier);

  // ── Atmosphere ────────────────────────────────────────────────────────────
  // Built after the cake because the big shaft is aligned from the cake's own
  // spotlight anchors, and after the room because the reflection is built from
  // the actual floor mesh. Order matters here in a way it doesn't above.
  const beams = createBeams(scene, tier, corridorLength, cake.spotAnchors);
  const dust = createDust(scene, tier);

  // The polished floor is the only effect that re-renders the whole scene, so
  // it needs a live framerate read to lower its update rate on a device that
  // turns out to be slower than its tier suggested. The loop is created further down, so
  // the read is deferred through a holder rather than passed directly.
  let loopRef = null;
  const reflection = createFloorReflection(
    scene,
    room.floor,
    tier,
    () => (loopRef ? loopRef.getFPS() : 60)
  );
  // Lets the reflection pass skip what isn't worth drawing at a quarter
  // resolution — unlit 2px dust motes resolve to noise down there.
  reflection.attach(dust, beams);

  const post = createPost(renderer, scene, camera, tier);
  const music = createMusic(gift.music?.src, gift.music?.volume ?? 0.45);
  const partyLights = createPartyLights(scene, lighting, tier);

  // Preload the tiny placeholders, then eagerly warm the first few frames so
  // the opening view is sharp the moment the intro clears.
  el('progress-fill').style.width = '40%';
  await frames.preloadPlaceholders();
  el('progress-fill').style.width = '80%';
  frames.warmup(3);
  // Create all (at most three) metadata-only media elements before the intro
  // clears. The Enter tap can then unlock every clip on iOS in one real gesture.
  frames.prepareVideos();
  el('progress-fill').style.width = '100%';

  // Where the camera comes to rest. Named, because the cake-arrival test below
  // has to agree with it — previously the camera stopped at cakeZ - 8 while the
  // test waited for cakeZ - 7, a gap the camera could never close, so the mic
  // prompt never opened.
  //
  // Derived from the field of view rather than fixed at 8m, because the fov is
  // no longer fixed either: core/engine.js opens it up on a narrow viewport, and
  // a wider lens from the same spot would leave the cake a small object in the
  // middle of a phone screen. Solving for a constant slice of world height
  // instead keeps the finale composed the same way everywhere — and at the
  // desktop's 52° it works out to exactly the 8m this replaces.
  const CAKE_VIEW_HEIGHT = 7.8;
  const cakeGap = CAKE_VIEW_HEIGHT /
    (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  const viewEndZ = cakeZ - cakeGap;

  // Cake mode begins only after the final frame has passed the camera-attention
  // beat (peak is 6m before a frame, with a 3.2m tail in core/scroll.js). This
  // keeps the top-view blend and prompt from stealing the last photograph.
  const lastFrame = frames.frames[frames.frames.length - 1];
  const cakeArrivalZ = Math.min(
    viewEndZ - 0.35,
    Math.max(viewEndZ - 1.5, (lastFrame?.z ?? 0) - 6 + 3.2)
  );

  const scroll = createScroll({
    camera,
    corridorLength,
    // Stop well short of the cake rather than at the end of the room — the
    // corridor runs on past it only so there is depth behind the finale. The
    // gap is sized so the whole cake, candles included, sits inside the frame
    // with room left for the "Make a Wish" prompt that overlays it.
    viewEndZ,
    lookTarget: new THREE.Vector3(0, cake.topY - 0.5, cakeZ),
    // The camera turns toward each photograph as it comes up, so it needs to
    // know where they hang. Without this it falls back to travelling straight
    // down the middle — safe, but the walls go unregarded.
    frames: frames.frames,
    onProgressChange: null,
  });

  // ── State ─────────────────────────────────────────────────────────────────
  let entered = false;
  let atCake = false;
  let micRequested = false;
  let finaleTriggered = false;
  let finaleRevealAt = Infinity;
  let finaleRevealed = false;
  let blowDetector = null;
  let bloomBoost = 0;
  let focusedFrame = null;
  let focusAnchorFrame = null;
  let focusAmount = 0;
  let hintTimer = null;
  let tapBlowTimer = null;
  let cakeTopView = false;
  let cakeViewAmount = 0;

  const focusPosition = new THREE.Vector3();
  const basePosition = new THREE.Vector3();
  const focusCamera = camera.clone();
  const baseQuaternion = new THREE.Quaternion();
  const cakeViewPosition = new THREE.Vector3();
  const cakeViewCamera = camera.clone();
  let finaleViewAmount = 0;
  const finaleViewPosition = new THREE.Vector3();
  const finaleViewCamera = camera.clone();

  function setCakeView(topView) {
    if (!atCake || finaleTriggered) return;
    cakeTopView = topView;
    el('cake-view-btn').textContent = topView ? 'Front view' : 'Top view';
    showInteractionHint(topView ? 'Tap a candle to blow it out' : '', topView ? 2200 : 0);
  }

  el('cake-view-btn').addEventListener('click', () => setCakeView(!cakeTopView));

  function showInteractionHint(text, duration = 0) {
    const hint = el('interaction-hint');
    if (hintTimer) clearTimeout(hintTimer);
    hint.textContent = text;
    hint.classList.toggle('visible', Boolean(text));
    if (text && duration) {
      hintTimer = setTimeout(() => hint.classList.remove('visible'), duration);
    }
  }

  function inspectFrame(frame) {
    if (!entered || atCake || !frame) return;
    focusedFrame = frame;
    focusAnchorFrame = frame;
    frames.setHovered(frame);
    el('close-focus-btn').classList.add('visible');
    showInteractionHint(frame.data.caption || 'A memory worth keeping');
  }

  function closeFrame() {
    focusedFrame = null;
    frames.setHovered(null);
    el('close-focus-btn').classList.remove('visible');
    showInteractionHint('');
  }

  el('close-focus-btn').addEventListener('click', closeFrame);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFrame();
  });

  createInteraction({
    canvas: renderer.domElement,
    camera,
    scene,
    onHover(target) {
      if (focusedFrame) return;
      const frame = target?.type === 'frame' ? target.frame : null;
      frames.setHovered(frame);
      if (entered && frame) showInteractionHint('Open this memory');
      else if (!focusedFrame) showInteractionHint('');
    },
    onActivate(target) {
      if (!entered || finaleTriggered) return;
      if (target.type === 'frame') {
        inspectFrame(target.frame);
      } else if (target.type === 'candle' && cake.tapCandle(target.candle)) {
        const c = target.candle;
        smoke.spawn(c.x, c.y, cake.cakeZ + c.z, Math.min(10, Math.floor(tier.smoke / 5)), 0.65);
        if (cake.litCount() === 0) triggerFinale();
      } else if (target.type === 'cake') {
        cake.react();
        showInteractionHint('The cake approves ✨', 1200);
      }
    },
  });

  // ── Intro ─────────────────────────────────────────────────────────────────
  el('enter-btn').addEventListener('click', () => {
    if (entered) return;
    entered = true;
    el('intro-screen').classList.add('hidden');
    el('hud').classList.add('visible');
    // The tap is what unlocks audio playback — this is the only moment we can
    // reliably start the music.
    music.play();
    music.fadeIn();
    frames.unlockVideos();
    showInteractionHint('Tap a photo to look closer', 4200);
  });

  // ── Cake arrival / mic prompt ─────────────────────────────────────────────

  // Live mic readout, enabled with ?debug=1. The production build strips
  // console output and mic trouble usually shows up on a phone, where there are
  // no devtools to open — so the numbers have to be legible on the screen.
  const debugMic = new URLSearchParams(location.search).has('debug');
  let micDebugEl = null;
  if (debugMic) {
    micDebugEl = document.createElement('div');
    micDebugEl.style.cssText =
      'position:fixed;left:8px;bottom:8px;z-index:300;font:11px ui-monospace,Menlo,Consolas,monospace;' +
      'background:rgba(0,0,0,.82);color:#8fe;padding:8px 10px;border-radius:8px;white-space:pre;' +
      'pointer-events:none;line-height:1.45';
    micDebugEl.textContent = 'mic: idle';
    document.body.appendChild(micDebugEl);
  }

  function showBlowPrompt() {
    const prompt = el('blow-prompt');
    prompt.classList.add('visible');
    // Give a working microphone a clean first attempt. The fallback appears
    // immediately when a mic is unavailable/denied, or five seconds after
    // access succeeds so it never becomes a permanent gate.
    el('tap-blow-btn').style.display = 'none';

    if (!micSupported()) {
      // No mic API at all — go straight to the tap button, no false promises.
      el('allow-mic-btn').style.display = 'none';
      el('tap-blow-btn').style.display = 'inline-block';
      // Overwhelmingly the cause is an insecure context: getUserMedia is only
      // exposed over HTTPS or on localhost, so opening the gift over a plain
      // http:// LAN address removes navigator.mediaDevices entirely. Say so,
      // rather than implying the device has no microphone.
      document.querySelector('.blow-instruction').textContent =
        window.isSecureContext
          ? 'This browser has no microphone support — tap the button instead'
          : 'Microphone needs a secure (https) connection — tap the button instead';
      return;
    }

  }

  el('allow-mic-btn').addEventListener('click', async () => {
    if (micRequested) return;
    micRequested = true;

    const btn = el('allow-mic-btn');
    btn.textContent = 'Listening...';
    btn.disabled = true;

    blowDetector = createBlowDetector({
      onBlow: (strength) => handleBlow(strength),
      onLevel: (level, isCalibrating) => {
        const instr = document.querySelector('.blow-instruction');
        if (isCalibrating) {
          instr.textContent = 'Calibrating… stay quiet for one second';
        } else if (level > 0) {
          instr.textContent = 'Microphone hears you — blow steadily for a moment';
        } else {
          instr.textContent = 'Listening — blow steadily near the microphone';
        }
      },
      onError: () => {
        if (tapBlowTimer) clearTimeout(tapBlowTimer);
        tapBlowTimer = null;
        btn.style.display = 'none';
        el('tap-blow-btn').style.display = 'inline-block';
        document.querySelector('.blow-instruction').textContent =
          'No microphone access — tap the button instead';
      },
      onReady: () => {
        btn.textContent = 'Listening...';
        document.querySelector('.blow-instruction').textContent =
          'Calibrating… stay quiet for one second';
      },
      onMetrics: micDebugEl
        ? (m, d) => {
            const mark = (ok) => (ok ? 'ok  ' : 'FAIL');
            micDebugEl.textContent =
              `level    ${m.level.toFixed(3)} > ${d.threshold.toFixed(3)}   ${mark(d.checks.loudEnough)}\n` +
              `lowRatio ${m.lowRatio.toFixed(3)} > 0.340   ${mark(d.checks.lowDominant)}\n` +
              `highRat  ${m.highRatio.toFixed(3)} < 0.380   ${mark(d.checks.notHissy)}\n` +
              `flux     ${m.flux.toFixed(3)} < 0.090   ${mark(d.checks.sustained)}\n` +
              `centroid ${m.centroid.toFixed(3)} (not a gate)\n` +
              `floor    ${d.noiseFloor.toFixed(3)}\n` +
              `held     ${d.sustainedFor.toFixed(0)}/180ms  ${d.isBlow ? 'BLOWING' : ''}`;
          }
        : null,
    });

    const ok = await blowDetector.start();
    if (!ok) {
      btn.style.display = 'none';
      el('tap-blow-btn').style.display = 'inline-block';
      return;
    }

    // Access is now genuinely granted and the detector is running. Keep the
    // experience microphone-only for five seconds, then reveal the accessible
    // fallback if the candles are still lit.
    if (tapBlowTimer) clearTimeout(tapBlowTimer);
    tapBlowTimer = setTimeout(() => {
      tapBlowTimer = null;
      if (!finaleTriggered && cake.litCount() > 0) {
        el('tap-blow-btn').style.display = 'inline-block';
      }
    }, 5000);
  });

  el('tap-blow-btn').addEventListener('click', () => {
    handleBlow(1.0);
  });

  /**
   * A blow lands. Strength maps to how many candles go out, so a soft puff takes
   * one or two and a proper breath takes them all — and any left over can be
   * blown again. Binary "all out on any noise" felt like a button; this feels
   * physical.
   */
  function handleBlow(strength) {
    if (finaleTriggered) return;

    const remaining = cake.litCount();
    if (remaining === 0) return;

    const count = Math.max(1, Math.round(strength * cake.candles.length));
    const snuffed = cake.extinguish(count);

    for (const c of snuffed) {
      const world = new THREE.Vector3(c.x, c.y, cake.cakeZ + c.z);
      smoke.spawn(world.x, world.y, world.z, Math.min(14, Math.floor(tier.smoke / 4)), strength);
    }

    if (cake.litCount() === 0) {
      triggerFinale();
    } else {
      document.querySelector('.blow-instruction').textContent =
        `${cake.litCount()} candle${cake.litCount() > 1 ? 's' : ''} left — blow again!`;
    }
  }

  function triggerFinale() {
    if (finaleTriggered) return;
    finaleTriggered = true;
    if (tapBlowTimer) clearTimeout(tapBlowTimer);
    tapBlowTimer = null;
    // Set the reveal deadline before any optional flourish. A missing or broken
    // audio/effect implementation must never strand the recipient after the
    // confetti with no birthday card.
    finaleRevealAt = performance.now() + 1300;
    setTimeout(revealFinale, 1300);

    if (blowDetector) blowDetector.stop();

    el('blow-prompt').classList.remove('visible');

    const origin = new THREE.Vector3(0, cake.topY + 0.5, cake.cakeZ);
    confetti.burst(origin, tier.confetti, 1);
    // A second, wider wave a beat later reads as a real celebration rather than
    // one mechanical puff.
    setTimeout(() => confetti.burst(origin, Math.floor(tier.confetti * 0.6), 1.5), 380);

    music.swell();
    bloomBoost = 1;
  }

  function revealFinale() {
    if (finaleRevealed) return;
    finaleRevealed = true;
    el('finale-overlay').classList.add('visible');
    el('hud').classList.remove('visible');
    el('cake-view-btn').classList.remove('visible');
    showInteractionHint('');
  }

  // ── Main loop ─────────────────────────────────────────────────────────────
  const loop = createLoop({
    renderer,
    tier,
    onResize: (w, h) => {
      post.resize(w, h);
      // Point size is expressed in device pixels, so the dust has to follow the
      // adaptive pixel-ratio governor — otherwise motes visibly change size
      // every time the renderer trades resolution for framerate.
      dust.setPixelScale(h, renderer.getPixelRatio());
    },
    onQuality: (what) => {
      // The FPS governor sheds cost in this order: bloom → dust → resolution.
      // Each step announces itself here so the owning module can react.
      //
      // Every rung goes through the owning module's own retire() rather than
      // reaching in and setting `.visible`. Both effects toggle that flag
      // themselves every frame — the reflection pass hides the dust while it
      // renders, and puts it back afterwards — so an external write would be
      // silently undone a few milliseconds later.
      //
      // The reflection is absent from the ladder on purpose; see the comment on
      // LADDER in core/loop.js. It governs its own update stride from the same
      // FPS reading and stays visible at every quality level, so there is
      // nothing for the loop to shed here.
      if (what === 'bloom' && post.enabled) {
        post.disable();
      } else if (what === 'dust') {
        dust.retire();
      }
    },
    onUpdate: (dt, time) => {
      scroll.update(dt);

      // The corridor position the SCROLL alone asked for, captured before any of
      // the blends below move the camera elsewhere.
      //
      // The cake-arrival test reads this rather than the camera's final z.
      // Inspecting a photograph flies the camera to that frame's own z, and the
      // last frame in the gift sits PAST the arrival threshold — eight frames put
      // it at 44.5 against a threshold of 44.0 — so testing the blended position
      // meant opening the final memory tripped cake mode and snatched the camera
      // away to the top view mid-inspection.
      const scrollZ = camera.position.z;

      // Blend on top of the scroll camera rather than replacing it. Closing a
      // memory therefore returns to wherever the visitor has scrolled to.
      basePosition.copy(camera.position);
      baseQuaternion.copy(camera.quaternion);
      const focusTarget = focusedFrame ? 1 : 0;
      focusAmount += (focusTarget - focusAmount) * (1 - Math.exp(-dt * 7));
      if (focusedFrame || focusAmount > 0.001) {
        const frame = focusedFrame || focusAnchorFrame;
        if (frame) {
          focusPosition.set(frame.wall === 'L' ? -0.72 : 0.72, frame.y, frame.z);
          focusCamera.position.copy(focusPosition);
          focusCamera.lookAt(frame.holder.position);
          camera.position.lerpVectors(basePosition, focusPosition, focusAmount);
          camera.quaternion.copy(baseQuaternion).slerp(focusCamera.quaternion, focusAmount);
        }
      } else {
        focusAmount = 0;
        focusAnchorFrame = null;
      }

      // The normal corridor camera remains the base. At the cake, blend into a
      // high three-quarter composition: enough elevation to read the candle
      // layout, but low and forward enough that all three tiers, the pedestal,
      // and the personalised icing plaque remain unmistakably cake-shaped.
      const cakeViewTarget = atCake && cakeTopView && !finaleTriggered ? 1 : 0;
      cakeViewAmount += (cakeViewTarget - cakeViewAmount) * (1 - Math.exp(-dt * 4.5));
      if (cakeViewAmount > 0.001) {
        basePosition.copy(camera.position);
        baseQuaternion.copy(camera.quaternion);
        // Stay inside the room and off the spotlight's centre axis. The old
        // camera rose above the 5m ceiling and looked straight through the open
        // volumetric cone, turning its shell into a giant brown disc on phones.
        // This lower three-quarter angle still exposes the candle layout while
        // preserving the cake tiers and the surrounding room.
        cakeViewPosition.set(0.85, Math.min(ROOM_H - 0.72, cake.topY + 2.25), cake.cakeZ - 4.45);
        cakeViewCamera.position.copy(cakeViewPosition);
        cakeViewCamera.lookAt(0, cake.topY - 0.72, cake.cakeZ);
        camera.position.lerpVectors(basePosition, cakeViewPosition, cakeViewAmount);
        camera.quaternion.copy(baseQuaternion).slerp(cakeViewCamera.quaternion, cakeViewAmount);
      }

      // ── The finale composition ────────────────────────────────────────────
      //
      // Once the candles are out the camera must come down to a SPECIFIED front
      // view. It used to have none: triggerFinale only let cakeViewAmount decay,
      // which hands the camera back to whatever scroll and focus had left behind.
      //
      // That is why the cake ended up off to one side. The scroll's own squaring-up
      // ramp (`arrival` in core/scroll.js) only completes at the very bottom of the
      // page, and the visitor stops scrolling the moment the blow prompt appears —
      // so a residual left-wall attention turn was still applied, aiming the camera
      // left of the centre line and pushing the cake to the right edge with a
      // side-wall photograph sitting in the middle of the birthday card.
      //
      // Stating the shot explicitly makes it independent of where the visitor
      // happened to stop, on every aspect ratio. Dead centre on x, backed off by
      // the same fov-derived gap the scroll uses so the whole cake is framed.
      const finaleTarget = finaleTriggered ? 1 : 0;
      finaleViewAmount += (finaleTarget - finaleViewAmount) * (1 - Math.exp(-dt * 2.6));
      if (finaleViewAmount > 0.001) {
        basePosition.copy(camera.position);
        baseQuaternion.copy(camera.quaternion);
        finaleViewPosition.set(0, cake.topY + 0.35, cake.cakeZ - cakeGap);
        finaleViewCamera.position.copy(finaleViewPosition);
        finaleViewCamera.lookAt(0, cake.topY - 0.45, cake.cakeZ);
        camera.position.lerpVectors(basePosition, finaleViewPosition, finaleViewAmount);
        camera.quaternion.copy(baseQuaternion).slerp(finaleViewCamera.quaternion, finaleViewAmount);
      }

      const camZ = camera.position.z;

      const audioLevels = music.analyse(time, tier.partyAnalysisHz);
      decor.setMusicReactive(audioLevels);
      beams.setMusicReactive(audioLevels);
      dust.setMusicReactive(audioLevels);
      cake.setMusicReactive(audioLevels);

      frames.update(camZ, time);
      lighting.update(camZ, frames.frames);
      partyLights.update(dt, time, audioLevels);
      decor.update(time);
      beams.update(time, camZ, frames.frames, cakeViewAmount > 0.08);
      dust.update(time, camZ);
      cake.update(dt, time);
      smoke.update(dt, camera);
      confetti.update(dt);

      // Caption for the frame currently nearest the camera.
      if (entered && !finaleTriggered) {
        const near = frames.nearest(camZ);
        const cap = el('caption');
        const text = near?.data.caption || '';
        if (cap.textContent !== text) cap.textContent = text;
      }

      // Arriving at the cake opens the mic prompt — not on page load, which
      // would be an unexplained permission dialog.
      //
      // Tested against the camera's actual resting point, with a lead-in so the
      // prompt is up by the time the cake fills the view. Gated on `entered` for
      // the flag as well as the call: the page scrolls behind the intro overlay,
      // so latching atCake before the visitor has tapped in would suppress the
      // prompt permanently.
      // Gated on `scrollZ`, not the blended camera position — and never while a
      // memory is open or still easing shut, so the last photograph gets its full
      // moment before the finale takes over.
      if (!atCake && entered && !focusedFrame && focusAmount < 0.01 && scrollZ >= cakeArrivalZ) {
        atCake = true;
        cakeTopView = true;
        document.querySelector('.scroll-hint').textContent = '';
        el('cake-view-btn').classList.add('visible');
        el('cake-view-btn').textContent = 'Front view';
        showInteractionHint('A view from above — tap a candle to blow it out', 3200);
        showBlowPrompt();
      }

      if (finaleTriggered && performance.now() >= finaleRevealAt) revealFinale();

      // Ease the finale bloom boost back down.
      if (post.enabled && bloomBoost > 0) {
        bloomBoost = Math.max(0, bloomBoost - dt * 0.5);
        post.setStrength(0.62 + bloomBoost * 0.5);
      }

      post.render();
    },
  });

  // Hand the loop to the reflection's FPS governor, and give the dust its
  // initial point scale — onResize only fires when something changes.
  loopRef = loop;
  dust.setPixelScale(window.innerHeight, renderer.getPixelRatio());

  // Expose a small handle for debugging and for the Studio's tier simulator.
  window.__museum = {
    tier, loop, renderer, scene, camera, cake, confetti, frames,
    beams, dust, reflection, partyLights, decor, scroll,
    // Camera-state readouts. The arrival and finale transitions are decided from
    // these, and a hidden preview pane cannot scroll (zero viewport height means
    // zero scroll range), so exposing them is the only way to verify the
    // sequencing without a real browser window.
    debugState: () => ({
      entered, atCake, cakeTopView, finaleTriggered, finaleRevealed,
      focusAmount, cakeViewAmount, finaleViewAmount,
      focusedFrame: focusedFrame ? focusedFrame.z : null,
      cakeArrivalZ, viewEndZ, cakeGap,
      camZ: camera.position.z, camX: camera.position.x,
    }),
    debugInspect: (i) => inspectFrame(frames.frames[i]),
    debugCloseFrame: () => closeFrame(),
  };
}

main();
