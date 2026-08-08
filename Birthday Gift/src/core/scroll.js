import * as THREE from 'three';

/**
 * Virtual scroll -> camera movement along a corridor.
 *
 * A tall spacer div gives native momentum scrolling (iOS needs this for it to
 * feel correct). We read scroll position, map it to [0,1] progress, critically
 * damp toward it in the animation loop, and move the camera down the corridor.
 *
 * The camera travels the centre line and turns toward each photograph as it
 * comes up, leaning slightly away from that wall for a squarer view of it.
 */

/**
 * Why the turn is derived from the frames rather than from a wave.
 *
 * This used to sway on a fixed sinusoid — sin(t * PI * 3.5) — whose phase had
 * nothing whatever to do with where the photographs actually hang. Whether a
 * given frame got looked at was down to the accident of its z landing on a
 * favourable part of that wave, and the wave's period is a function of the
 * corridor's total length, so adding one photo re-rolled the dice for all of
 * them.
 *
 * On a wide desktop viewport that was survivable: the horizontal field of view
 * is wide enough that a frame is on screen whether or not the camera is
 * pointing at it. In portrait it is not — see the fov note in core/engine.js —
 * and frames on an unlucky phase were never brought into shot at all.
 *
 * So attention is now keyed to the thing being attended to. Every frame gets
 * the camera turned toward it as it comes up, on any aspect ratio and at any
 * corridor length, because the turn is computed from that frame's own position.
 */
/**
 * The geometry these were solved against, since they are not free parameters.
 *
 * Walls stand at x = ±2.9 (ROOM_W/2) and the camera leans another 0.5 away from
 * whichever it is regarding, so a photograph sits 3.4m to the side. A portrait
 * phone has about 36° of horizontal field — ±17.9° about the gaze — and a frame
 * is 2.2m wide along the corridor, not across it, because it is rotated flat to
 * the wall.
 *
 * The gaze runs atan((LOOK_REACH + LEAN) / LOOK_AHEAD) ≈ 35.9° off the corridor
 * axis. At 6m of lead the frame's near edge sits 1.2° inside that and its far
 * edge 10.4° — the whole picture on screen with 7° to spare.
 *
 * The lead is the parameter that matters. At 3.6m the same frame swings out to
 * 43° while the gaze stays at 35.9°, and the near edge lands 17.7° off centre
 * against a 17.9° limit: nominally inside, but with a fifth of a degree of
 * margin it clips the moment the scroll damping lags a frame behind.
 */
const PRESENT_LEAD = 6.0;   // metres ahead of the camera at peak attention
const PRESENT_SPAN = 3.2;   // half-width of the attention window, in metres
const LOOK_REACH = 2.4;     // how far the gaze target slides toward the wall
const LOOK_AHEAD = 4.0;     // how far down the corridor the gaze target sits
const LEAN = 0.5;           // camera drifts away from the wall being looked at

export function createScroll({
  camera,
  corridorLength,
  viewEndZ,
  lookTarget,
  frames = [],
  onProgressChange,
}) {
  const spacer = document.getElementById('scroll-spacer');
  if (!spacer) throw new Error('Missing #scroll-spacer');

  // Where the camera comes to rest. This is deliberately short of the room's far
  // wall: the corridor extends past the cake so there is depth behind it, but the
  // camera must stop in front of the cake, not sail through it.
  const endZ = viewEndZ ?? corridorLength;
  const finalLook = lookTarget ?? new THREE.Vector3(0, 1.7, endZ + 3);

  // Do not start centring on the cake until the last photograph has completed
  // its own attention window. A fixed 82%-of-corridor handoff worked only by
  // accident for some frame counts; in the current eight-frame gift it faded
  // the final right-wall turn before that frame reached peak presentation.
  const lastFrameZ = frames.length > 0
    ? Math.max(...frames.map((frame) => frame.z))
    : 0;
  const lastPresentationZ = lastFrameZ - PRESENT_LEAD;
  const arrivalStart = Math.max(0, Math.min(0.98,
    (lastPresentationZ + PRESENT_SPAN) / Math.max(endZ, 0.001)
  ));

  // Smooth 0->1 ramp, used to taper the sway out as the cake comes into view.
  const smoothstep = (a, b, t) => {
    const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };

  const anchors = frames.map((f) => ({
    z: f.z,
    side: f.wall === 'L' ? -1 : 1,
  }));

  /**
   * Signed attention at a point in the corridor: -1 fully turned toward the left
   * wall, +1 the right, 0 looking straight down the middle.
   *
   * Contributions are summed rather than winner-takes-all. Where two frames on
   * opposite walls are both in the window their pulls partly cancel, which is
   * the right answer — there is no single thing to look at, so look less — and
   * it avoids the discontinuity a max() would produce at the handover.
   */
  function attention(z) {
    let sum = 0;
    for (const a of anchors) {
      const k = (a.z - z - PRESENT_LEAD) / PRESENT_SPAN;
      if (k <= -1 || k >= 1) continue;
      // Squared so the weight leaves and rejoins zero with zero slope. A bare
      // parabola kinks visibly at the moment each frame enters the window.
      const w = 1 - k * k;
      sum += a.side * w * w;
    }
    return Math.max(-1, Math.min(1, sum));
  }

  let targetProgress = 0;
  let currentProgress = 0;

  // Spacer height determines the scroll range. We set it proportional to the
  // corridor length so longer gifts get more scroll distance.
  const scrollHeight = Math.max(300, endZ * 20);
  spacer.style.height = `${scrollHeight}vh`;

  function updateFromScroll() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) {
      targetProgress = 0;
      return;
    }
    targetProgress = Math.min(1, window.scrollY / maxScroll);
  }

  window.addEventListener('scroll', updateFromScroll, { passive: true });
  window.addEventListener('resize', updateFromScroll, { passive: true });

  // Keyboard: arrow keys and space scroll the page, which then drives the camera.
  window.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Space', 'PageDown', 'PageUp'].includes(e.code)) {
      e.preventDefault();
      const delta = e.code === 'ArrowDown' || e.code === 'Space' ? 100 :
                    e.code === 'PageDown' ? 400 :
                    e.code === 'ArrowUp' ? -100 : -400;
      window.scrollBy({ top: delta, behavior: 'smooth' });
    }
  });

  updateFromScroll();

  const look = new THREE.Vector3();

  return {
    update(dt) {
      // Critically damped spring toward the target. This is the secret to smooth
      // scroll-driven animation: no matter how janky the scroll events fire, the
      // camera motion integrates them into a silky continuous motion.
      const damping = 8;
      currentProgress += (targetProgress - currentProgress) * damping * dt;

      const clamped = Math.max(0, Math.min(1, currentProgress));
      const z = clamped * endZ;

      // Square up over the final stretch. Arriving off to one side and looking
      // at the cake diagonally reads as a bug; the last thing the scroll should
      // do is centre the centrepiece.
      const arrival = smoothstep(arrivalStart, 1, clamped);
      const turn = attention(z) * (1 - arrival);

      // Away from the wall, not toward it. Standing back from a picture gives a
      // squarer, less foreshortened view of it — and because the gaze is aimed
      // at the frame explicitly, backing off costs nothing in visibility.
      camera.position.set(-turn * LEAN, 1.6, z);

      look.set(turn * LOOK_REACH, 1.7, z + LOOK_AHEAD);
      look.lerp(finalLook, arrival);
      camera.lookAt(look);

      if (onProgressChange) {
        onProgressChange(clamped);
      }
    },
    getProgress: () => currentProgress,
    setProgress: (p) => {
      targetProgress = p;
      currentProgress = p;
    },
  };
}
