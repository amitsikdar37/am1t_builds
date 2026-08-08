import * as THREE from 'three';
import { THEME } from './theme.js';
import { ROOM_W } from './room.js';

/**
 * Photo/video frames on the corridor walls, with streamed textures.
 *
 * The memory budget is the whole game here. Sixteen 1024px RGBA textures
 * resident on the GPU is ~90MB, which will get the tab killed on a budget
 * phone. So each frame starts holding only its 32px LQIP thumbnail (a few KB)
 * and only loads its full-resolution texture while it's within a few frames of
 * the camera. On the way out, the texture is disposed and the LQIP goes back.
 *
 * The visible result is a frame that blurs in as you approach it — which reads
 * as intentional, not as a compromise.
 */

export const FRAME_SPACING = 5.5;
export const FIRST_FRAME_Z = 6;
const LOAD_WINDOW = 3;   // load full-res within this many frames of the camera
const UNLOAD_WINDOW = 5; // dispose beyond this many (hysteresis, avoids thrash)
// Camera attention peaks six metres before a frame (core/scroll.js). Video
// playback must follow that gaze, not raw nearest-by-Z distance: adjacent videos
// otherwise let the previous clip consume the one-decoder phone budget while the
// camera is visibly looking at the next one.
const VIDEO_PRESENT_LEAD = 6.0;
const VIDEO_PRESENT_SPAN = 3.8;

/** Shared assets — one geometry/material per style, reused across every frame. */
function createSharedAssets(tier) {
  return {
    // Stained hardwood moulding. This was previously metalness 0.85 / roughness
    // 0.32, i.e. a polished metal — which is what produced the blinding vertical
    // glare down the left edge. Wood is a dielectric: metalness 0, and rough
    // enough that its specular lobe is a broad sheen rather than a mirror.
    woodMat: new THREE.MeshStandardMaterial({
      color: 0x8f5f38,
      roughness: 0.82,
      metalness: 0.0,
    }),
    // A slim genuinely-metallic lip between the wood and the matte. Keeping the
    // metal confined to a 2cm bevel is what reads as a premium frame — the
    // highlight has somewhere legitimate to live instead of smearing across the
    // whole moulding.
    lipMat: new THREE.MeshStandardMaterial({
      color: THEME.brassHighlight,
      roughness: 0.34,
      metalness: 0.95,
    }),
    matteMat: new THREE.MeshStandardMaterial({
      color: 0xf5f0e4,
      roughness: 0.9,
    }),
    fixtureMat: new THREE.MeshStandardMaterial({
      color: THEME.brassDark,
      roughness: 0.28,
      metalness: 0.92,
      // The shade is an open half-cylinder, so its inner surface is visible from
      // below and must not be backface-culled away.
      side: THREE.DoubleSide,
    }),
    // The lit bulb inside the shade. Unlit, so it stays bright regardless of
    // where the SpotLight is pointing.
    bulbMat: new THREE.MeshBasicMaterial({ color: 0xfff4de }),
    // Emissive quad standing in for a real light on distant frames.
    glowMat: new THREE.MeshBasicMaterial({
      color: THEME.pictureLightColor,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    // Glazing.
    //
    // Real transmission means three re-renders the scene into a transmission
    // buffer every frame — a genuine, measurable cost, so it is HIGH tier only.
    // Everywhere else the glass is a subtle non-additive sheen band, which sells
    // the same read for one extra transparent quad and no extra scene pass.
    glassMat: tier.glass
      ? new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 0.0,
          roughness: 0.04,
          transmission: 1.0,
          thickness: 0.02,
          ior: 1.52,
          transparent: true,
          depthWrite: false,
        })
      : new THREE.MeshBasicMaterial({
          map: makeSheenTexture(),
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
        }),
  };
}

/**
 * A diagonal reflection band, the kind a window throws across framed glass.
 * Normal blending, not additive — additive over a photo is exactly what was
 * blowing faces out to flat white earlier.
 */
function makeSheenTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, size, size, 0);
  g.addColorStop(0.0, 'rgba(255,255,255,0)');
  g.addColorStop(0.42, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,252,246,0.85)');
  g.addColorStop(0.66, 'rgba(255,255,255,0)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Caption plate.
 *
 * `scale` exists because this is TEXT on a wall-mounted plane, which makes it the
 * most unforgiving surface in the scene for sharpness. The visitor travels along
 * the corridor, so every plate is read at a grazing angle, and text is the one
 * thing where a soft mip is legible as blur rather than as slight softness. It was
 * hard-coded at 512x64 with no anisotropy — the letterforms were the first thing
 * to mush out on a phone.
 */
function makeCaptionTexture(text, scale = 1, anisotropy = 1) {
  const c = document.createElement('canvas');
  c.width = 512 * scale;
  c.height = 64 * scale;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  // Draw in the original 512x64 coordinate space so every radius, font size and
  // inset below stays as tuned, and the extra resolution is pure detail.
  ctx.scale(scale, scale);
  const W = 512;
  const H = 64;

  // A dark plate behind the text. The walls are now near-white, so the old
  // unbacked gold lettering had almost no contrast against them.
  const r = 14;
  ctx.fillStyle = 'rgba(28, 20, 14, 0.82)';
  ctx.beginPath();
  ctx.moveTo(r, 4);
  ctx.arcTo(W - 4, 4, W - 4, H - 4, r);
  ctx.arcTo(W - 4, H - 4, 4, H - 4, r);
  ctx.arcTo(4, H - 4, 4, 4, r);
  ctx.arcTo(4, 4, W - 4, 4, r);
  ctx.closePath();
  ctx.fill();

  ctx.font = '400 30px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#ffe0a0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2, W - 40);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // Trilinear plus anisotropy. Without the aniso the plate is sampled from one
  // over-blurred mip the moment the visitor is not square-on to it, which is
  // almost always.
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = anisotropy;
  return t;
}

/**
 * Fit the artwork to a fixed frame opening without distortion, by scaling the
 * plane rather than stretching UVs. Sender photos arrive in every aspect ratio
 * imaginable — portrait phone shots next to landscape DSLR shots — and this is
 * what keeps the wall looking deliberate.
 */
function fitToOpening(w, h, maxW, maxH) {
  const aspect = (w || 1) / (h || 1);
  let fw = maxW;
  let fh = maxW / aspect;
  if (fh > maxH) {
    fh = maxH;
    fw = maxH * aspect;
  }
  return { w: fw, h: fh };
}

export function buildFrames(scene, giftFrames, tier) {
  const shared = createSharedAssets(tier);
  const group = new THREE.Group();
  const loader = new THREE.TextureLoader();

  const MAX_W = 2.2;
  const MAX_H = 1.7;
  const CENTER_Y = 2.0;

  const frames = giftFrames.map((data, i) => {
    // Alternate walls unless the sender pinned one.
    const wall = data.wall === 'L' || data.wall === 'R'
      ? data.wall
      : (i % 2 === 0 ? 'L' : 'R');

    const z = FIRST_FRAME_Z + i * FRAME_SPACING;
    const wallX = wall === 'L' ? -ROOM_W / 2 : ROOM_W / 2;
    const inward = wall === 'L' ? 1 : -1;
    const rotY = wall === 'L' ? Math.PI / 2 : -Math.PI / 2;

    const art = fitToOpening(data.w, data.h, MAX_W, MAX_H);

    const holder = new THREE.Group();
    const interactive = { type: 'frame', frame: null };
    holder.position.set(wallX + inward * 0.06, CENTER_Y, z);
    holder.rotation.y = rotY;

    // Hardwood moulding: outer boxes forming the carved silhouette.
    const outerW = art.w + 0.34;
    const outerH = art.h + 0.34;

    const bar = (w, h, d, x, y, zz, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, zz);
      return m;
    };
    holder.add(bar(outerW, 0.17, 0.11, 0, outerH / 2 - 0.085, 0.02, shared.woodMat));
    holder.add(bar(outerW, 0.17, 0.11, 0, -outerH / 2 + 0.085, 0.02, shared.woodMat));
    holder.add(bar(0.17, outerH, 0.11, -outerW / 2 + 0.085, 0, 0.02, shared.woodMat));
    holder.add(bar(0.17, outerH, 0.11, outerW / 2 - 0.085, 0, 0.02, shared.woodMat));

    // Thin brass lip inside the wood. This is the only metal on the frame, so
    // it's the only place a sharp highlight can appear.
    const lipW = art.w + 0.18;
    const lipH = art.h + 0.18;
    holder.add(bar(lipW, 0.022, 0.05, 0, lipH / 2, 0.055, shared.lipMat));
    holder.add(bar(lipW, 0.022, 0.05, 0, -lipH / 2, 0.055, shared.lipMat));
    holder.add(bar(0.022, lipH, 0.05, -lipW / 2, 0, 0.055, shared.lipMat));
    holder.add(bar(0.022, lipH, 0.05, lipW / 2, 0, 0.055, shared.lipMat));

    // Cream matte board behind the art
    const matte = new THREE.Mesh(
      new THREE.PlaneGeometry(art.w + 0.16, art.h + 0.16),
      shared.matteMat
    );
    matte.position.z = 0.005;
    holder.add(matte);

    // The artwork itself. Starts on the LQIP; swapped for full-res on approach.
    const artMat = new THREE.MeshBasicMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 1,
    });
    const artMesh = new THREE.Mesh(new THREE.PlaneGeometry(art.w, art.h), artMat);
    artMesh.position.z = 0.012;
    artMesh.userData.interactive = interactive;
    holder.add(artMesh);

    // Picture light.
    //
    // The old version was a cylinder rotated on Z and another on X, which put the
    // shade's open end facing sideways — the "floating hammer" silhouette. A
    // gallery picture light is a horizontal half-cylinder shade on a bracket that
    // rises off the wall and cranks forward, with the opening aimed down at the
    // art. Built here as: wall plate → upright → forward crank → shade → bulb.
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.022, 12),
      shared.fixtureMat
    );
    plate.position.set(0, outerH / 2 + 0.05, 0.01);
    plate.rotation.x = Math.PI / 2;
    holder.add(plate);

    const upright = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.20, 8),
      shared.fixtureMat
    );
    upright.position.set(0, outerH / 2 + 0.15, 0.03);
    holder.add(upright);

    // Forward crank: leans out over the artwork so the shade clears the frame.
    const crank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.20, 8),
      shared.fixtureMat
    );
    crank.position.set(0, outerH / 2 + 0.235, 0.115);
    crank.rotation.x = Math.PI / 2.1;
    holder.add(crank);

    // Horizontal shade, open side down. thetaStart/-Length give a half-cylinder
    // hood rather than a full tube, so the bulb is visible from below and hidden
    // from above, exactly like the real fixture.
    const SHADE_Y = outerH / 2 + 0.25;
    const SHADE_Z = 0.20;
    const shadeGeo = new THREE.CylinderGeometry(
      0.055, 0.055, Math.min(art.w * 0.5, 0.42),
      12, 1, true,
      0, Math.PI
    );
    const shade = new THREE.Mesh(shadeGeo, shared.fixtureMat);
    shade.position.set(0, SHADE_Y, SHADE_Z);
    shade.rotation.z = Math.PI / 2;
    holder.add(shade);

    // Bulb, tucked just inside the hood's mouth.
    const bulb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, Math.min(art.w * 0.42, 0.34), 8),
      shared.bulbMat
    );
    bulb.position.set(0, SHADE_Y - 0.028, SHADE_Z);
    bulb.rotation.z = Math.PI / 2;
    holder.add(bulb);

    // The hood's halo, sitting just under the shade mouth. Deliberately clear of
    // the artwork — an additive quad overlapping the photo blows its highlights
    // to flat white and the face becomes unreadable.
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(art.w * 0.55, 0.46), 0.14),
      shared.glowMat.clone()
    );
    glow.position.set(0, SHADE_Y - 0.10, SHADE_Z - 0.02);
    holder.add(glow);

    // Glazing over the opening.
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(art.w, art.h),
      shared.glassMat
    );
    glass.position.z = 0.045;
    glass.renderOrder = 2;
    glass.userData.interactive = interactive;
    holder.add(glass);

    // Caption plate under the frame
    let captionMesh = null;
    if (data.caption) {
      // 2x the source resolution on every tier that asks for a large surface
      // canvas. A caption plate is ~130KB of texture at 1024x128, so even a
      // thirty-frame gift adds a few megabytes — worth it for legible text, but
      // not worth scaling with surfaceTex beyond a doubling.
      const capScale = (tier.surfaceTex || 512) >= 1024 ? 2 : 1;
      const capTex = makeCaptionTexture(data.caption, capScale, tier.anisotropy || 1);
      captionMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.2),
        new THREE.MeshBasicMaterial({
          map: capTex,
          transparent: true,
          depthWrite: false,
        })
      );
      captionMesh.position.set(0, -outerH / 2 - 0.22, 0.02);
      holder.add(captionMesh);
    }

    group.add(holder);

    // World-space anchors for the real SpotLight.
    //
    // Derived from the holder's own transform rather than hardcoded, so the light
    // and the fixture geometry cannot drift apart. updateMatrixWorld is needed
    // because the holder was only just added and its world matrix is still stale.
    holder.updateMatrixWorld(true);
    const lightPos = holder.localToWorld(
      new THREE.Vector3(0, SHADE_Y - 0.05, SHADE_Z)
    );
    // Aim a little below the artwork's centre: the fixture is above the frame, so
    // targeting dead centre throws the brightest part of the cone at the top edge
    // and leaves the lower third of the photo noticeably darker.
    const lightTarget = holder.localToWorld(
      new THREE.Vector3(0, -art.h * 0.18, 0.0)
    );

    const frame = {
      data,
      wall,
      z,
      y: CENTER_Y,
      holder,
      artMesh,
      artMat,
      glow,
      glass,
      captionMesh,
      lightPos,
      lightTarget,
      state: 'placeholder', // placeholder | loading | loaded
      fullTex: null,
      lqipTex: null,
      video: null,
      videoPlaying: false,
      videoPlayPending: false,
      videoUnlocking: false,
      hovered: false,
      focusScale: 1,
    };
    interactive.frame = frame;
    return frame;
  });

  scene.add(group);

  // ── Texture streaming ────────────────────────────────────────────────────
  // Loads are serialised through a tiny queue. Decoding several images at once
  // stalls the main thread and produces exactly the hitch we're trying to avoid,
  // so we accept slightly later arrivals in exchange for a steady framerate.
  const queue = [];
  let inFlight = 0;
  let lastCameraZ = 0;
  const MAX_IN_FLIGHT = 2;

  function pump() {
    while (inFlight < MAX_IN_FLIGHT && queue.length > 0) {
      const job = queue.shift();
      if (job.frame.state !== 'loading') continue;
      inFlight++;
      job.run(() => {
        inFlight--;
        pump();
      });
    }
  }

  function srcFor(frame) {
    const d = frame.data;
    // The pipeline emits per-tier variants; fall back to whatever exists.
    if (tier.texture <= 512 && d.src512) return d.src512;
    return d.src || d.src512 || d.poster;
  }

  function loadFull(frame) {
    if (frame.state !== 'placeholder') return;
    frame.state = 'loading';

    if (frame.data.type === 'video') {
      // Creating a metadata-only media element is cheap and synchronous. Do it
      // outside the image decode queue so every clip exists by the Enter tap and
      // can be unlocked by that genuine user gesture on iOS.
      const vid = document.createElement('video');
      // Apply autoplay/inline policy both as properties and attributes before
      // assigning src. Older iOS Safari snapshots these flags when the media
      // resource is attached and may ignore a property set afterwards.
      vid.muted = true;         // required for autoplay everywhere
      vid.defaultMuted = true;
      vid.playsInline = true;   // iOS: don't hijack into fullscreen
      vid.setAttribute('muted', '');
      vid.setAttribute('playsinline', '');
      vid.setAttribute('webkit-playsinline', '');
      vid.loop = true;
      vid.preload = 'metadata';
      vid.crossOrigin = 'anonymous';
      vid.src = frame.data.src;
      vid.load();

      const tex = new THREE.VideoTexture(vid);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;

      frame.video = vid;
      frame.fullTex = tex;
      // Keep the poster/LQIP visible until play() has genuinely succeeded. A
      // rejected mobile autoplay request must never turn the frame into black.
      frame.state = 'loaded';
      return;
    }

    const url = srcFor(frame);
    if (!url) { frame.state = 'loaded'; return; }

    queue.push({
      frame,
      run: (done) => {
        loader.load(
          url,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.generateMipmaps = true;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            // Anisotropic filtering is tier-driven rather than hard-coded: the
            // exact amount of oblique detail phones can sustain matters more than
            // any single fixed number. tier.anisotropy is guaranteed defined by
            // the time this callback runs.
            if (tier.anisotropy) tex.anisotropy = tier.anisotropy;
            frame.fullTex = tex;
            frame.artMat.map = tex;
            frame.artMat.color.setHex(0xffffff);
            frame.artMat.needsUpdate = true;
            frame.state = 'loaded';
            done();
          },
          undefined,
          () => {
            // Leave the LQIP in place on failure — a blurry frame is a far
            // better outcome than a black hole in the wall.
            frame.state = 'loaded';
            done();
          }
        );
      },
    });
    pump();
  }

  function unloadFull(frame) {
    if (frame.state !== 'loaded') return;

    if (frame.video) {
      // There are at most three videos, and paused metadata-only elements are
      // cheap. Preserve them so the user-gesture unlock is not thrown away when
      // a distant clip crosses the image streaming window.
      // In particular, do not interrupt the brief Enter-gesture play: iOS only
      // considers the element unlocked after that promise has settled.
      if (frame.videoUnlocking) return;
      frame.video.pause();
      frame.videoPlaying = false;
      frame.videoPlayPending = false;
      return;
    }
    if (frame.fullTex) {
      frame.fullTex.dispose();
      frame.fullTex = null;
    }
    frame.artMat.map = frame.lqipTex || null;
    frame.artMat.color.setHex(frame.lqipTex ? 0xffffff : 0x333333);
    frame.artMat.needsUpdate = true;
    frame.state = 'placeholder';
  }

  /** Preload every LQIP up front — they're tiny and stop any frame ever being blank. */
  function preloadPlaceholders() {
    const jobs = frames.map((frame) => new Promise((resolve) => {
      const url = frame.data.lqip || frame.data.poster;
      if (!url) return resolve();
      loader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        frame.lqipTex = tex;
        if (frame.state === 'placeholder') {
          frame.artMat.map = tex;
          frame.artMat.color.setHex(0xffffff);
          frame.artMat.needsUpdate = true;
        }
        resolve();
      }, undefined, () => resolve());
    }));
    return Promise.all(jobs);
  }

  return {
    group,
    frames,
    preloadPlaceholders,

    /** Eagerly load the first N frames so the opening view is never blurry. */
    warmup(n = 3) {
      frames.slice(0, n).forEach(loadFull);
    },

    /** Create all media elements before the recipient's Enter gesture. */
    prepareVideos() {
      frames.filter((frame) => frame.data.type === 'video').forEach(loadFull);
    },

    /**
     * Prime loaded video elements from a real user gesture. Mobile Safari can
     * still reject muted VideoTexture playback until each media element has
     * participated in a gesture. Briefly play/pause without moving off frame 0;
     * visibility-driven update() will start the appropriate clip afterwards.
     */
    unlockVideos() {
      for (const frame of frames) {
        if (!frame.video) continue;
        frame.videoUnlocking = true;
        frame.videoPlayPending = true;
        const attempt = frame.video.play();
        if (attempt && typeof attempt.then === 'function') {
          attempt.then(() => {
            frame.video.pause();
            frame.video.currentTime = 0;
            frame.videoPlaying = false;
            frame.videoPlayPending = false;
            frame.videoUnlocking = false;
          }).catch(() => {
            frame.videoPlayPending = false;
            frame.videoUnlocking = false;
          });
        } else {
          frame.video.pause();
          frame.video.currentTime = 0;
          frame.videoPlayPending = false;
          frame.videoUnlocking = false;
        }
      }
    },

    update(cameraZ, time) {
      const playBudget = tier.liveVideos;
      lastCameraZ = cameraZ;

      // Choose decoders by what the camera is presenting, not array order or
      // nearest wall coordinate. This is especially important for consecutive
      // video frames on low/mid phones where only one stream may run at once.
      const selectedVideos = new Set(
        frames
          .filter((frame) => frame.video && frame.state === 'loaded')
          .map((frame) => ({
            frame,
            score: frame.hovered
              ? 0
              : Math.abs(frame.z - cameraZ - VIDEO_PRESENT_LEAD),
          }))
          .filter(({ frame, score }) => frame.hovered || score <= VIDEO_PRESENT_SPAN)
          .sort((a, b) => a.score - b.score)
          .slice(0, playBudget)
          .map(({ frame }) => frame)
      );

      for (const frame of frames) {
        const dz = Math.abs(frame.z - cameraZ);
        const nearIdx = dz / FRAME_SPACING;

        if (nearIdx <= LOAD_WINDOW) loadFull(frame);
        else if (nearIdx > UNLOAD_WINDOW) unloadFull(frame);

        // Videos only run while genuinely near, and only up to the tier's
        // simultaneous-decode budget. Mobile decoders fall over past 1-2.
        if (frame.video && frame.state === 'loaded') {
          const shouldPlay = selectedVideos.has(frame);
          if (shouldPlay && !frame.videoPlaying && !frame.videoPlayPending) {
            frame.videoPlayPending = true;
            const attempt = frame.video.play();
            if (attempt && typeof attempt.then === 'function') {
              attempt.then(() => {
                frame.videoPlayPending = false;
                // The camera may have moved while play() was pending. Do not
                // leave a now-offscreen decoder running.
                const presentationDistance = Math.abs(
                  frame.z - lastCameraZ - VIDEO_PRESENT_LEAD
                );
                if (frame.hovered || presentationDistance <= VIDEO_PRESENT_SPAN) {
                  frame.artMat.map = frame.fullTex;
                  frame.artMat.color.setHex(0xffffff);
                  frame.artMat.needsUpdate = true;
                  frame.videoPlaying = true;
                } else {
                  frame.video.pause();
                  frame.videoPlaying = false;
                }
              }).catch(() => {
                // Crucially, a rejection is not "playing". Clear the pending
                // state so the next animation frame or user gesture can retry.
                frame.videoPlayPending = false;
                frame.videoPlaying = false;
              });
            } else {
              frame.videoPlayPending = false;
              frame.videoPlaying = !frame.video.paused;
              if (frame.videoPlaying) {
                frame.artMat.map = frame.fullTex;
                frame.artMat.color.setHex(0xffffff);
                frame.artMat.needsUpdate = true;
              }
            }
          } else if (!shouldPlay && frame.videoPlaying) {
            frame.video.pause();
            frame.videoPlaying = false;
          }
        }

        // Glow breathes slightly and fades with distance.
        if (frame.glow) {
          const falloff = Math.max(0, 1 - dz / 12);
          const hoverBoost = frame.hovered ? 0.22 : 0;
          frame.glow.material.opacity =
            ((0.20 + hoverBoost) + Math.sin(time * 0.0012 + frame.z) * 0.035) * falloff;
        }

        const targetScale = frame.hovered ? 1.035 : 1;
        frame.focusScale += (targetScale - frame.focusScale) * 0.14;
        frame.holder.scale.setScalar(frame.focusScale);
      }
    },

    setHovered(target) {
      for (const frame of frames) frame.hovered = frame === target;
    },

    /** Nearest frame to the camera — used to drive the on-screen caption. */
    nearest(cameraZ) {
      let best = null;
      let bestD = Infinity;
      for (const f of frames) {
        const d = Math.abs(f.z - cameraZ);
        if (d < bestD) { bestD = d; best = f; }
      }
      return bestD < FRAME_SPACING * 0.85 ? best : null;
    },
  };
}
