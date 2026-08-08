import * as THREE from 'three';
import { THEME } from './theme.js';
import { ROOM_W, ROOM_H } from './room.js';
import { createFlame } from '../fx/flame.js';

/**
 * The birthday cake in the rotunda at the end of the corridor.
 *
 * Three stacked tiers with piped frosting rings, on a brass pedestal, under a
 * warm spot. N candles, each with a shader flame and (on capable devices) a
 * flickering point light.
 *
 * Shadows are baked as a radial-gradient decal plane rather than rendered.
 * Enabling a single shadow-casting light here would cost more than the entire
 * rest of the scene combined on a mid-range phone.
 */

function makeContactShadow(radius = 1.6) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function makeFrostingTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f7e9dd';
  ctx.fillRect(0, 0, 256, 256);

  // Soft swirls so the frosting isn't a flat colour under the spotlight.
  for (let i = 0; i < 120; i++) {
    ctx.beginPath();
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 6 + Math.random() * 20;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${232 + Math.random() * 18}, ${208 + Math.random() * 20}, ${196 + Math.random() * 20}, 0.5)`;
    ctx.fill();
  }
  // Fine sprinkles
  const sprinkle = ['#d4a24c', '#e8b4b8', '#f0c070', '#ffffff'];
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = sprinkle[Math.floor(Math.random() * sprinkle.length)];
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 6);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildCake(scene, tier, cakeZ, candleCount = 5, recipientName = 'Friend') {
  const group = new THREE.Group();
  group.position.set(0, 0, cakeZ);
  let reaction = 0;
  const cakeInteractive = { type: 'cake' };
  const frostingTex = makeFrostingTexture();
  frostingTex.repeat.set(3, 1);

  const cakeMat = new THREE.MeshStandardMaterial({
    map: frostingTex,
    roughness: 0.72,
    metalness: 0.0,
  });
  const creamMat = new THREE.MeshStandardMaterial({
    color: 0xfff4ea,
    roughness: 0.6,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: THEME.brass,
    roughness: 0.3,
    metalness: 0.9,
  });

  // ── Pedestal ──────────────────────────────────────────────────────────────
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.25, 0.9, 24),
    new THREE.MeshStandardMaterial({ color: 0x1e1836, roughness: 0.4, metalness: 0.3 })
  );
  pedestal.position.y = 0.45;
  pedestal.userData.interactive = cakeInteractive;
  group.add(pedestal);

  const pedTop = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.07, 24), brassMat);
  pedTop.position.y = 0.92;
  group.add(pedTop);

  const shadow = makeContactShadow(1.9);
  shadow.position.y = 0.012;
  group.add(shadow);

  // ── Cake tiers ────────────────────────────────────────────────────────────
  const tiers = [
    { r: 0.85, h: 0.42, y: 1.17 },
    { r: 0.62, h: 0.36, y: 1.56 },
    { r: 0.40, h: 0.30, y: 1.89 },
  ];

  for (const t of tiers) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(t.r, t.r, t.h, 28), cakeMat);
    body.position.y = t.y;
    body.userData.interactive = cakeInteractive;
    group.add(body);

    // Piped frosting rim at the top edge of each tier.
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(t.r, 0.045, 6, 28),
      creamMat
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = t.y + t.h / 2;
    group.add(rim);

    // Drip skirt just under the rim.
    const skirt = new THREE.Mesh(
      new THREE.TorusGeometry(t.r, 0.03, 6, 24),
      creamMat
    );
    skirt.rotation.x = Math.PI / 2;
    skirt.position.y = t.y + t.h / 2 - 0.09;
    group.add(skirt);
  }

  // A personalised icing plaque on the front of the cake. It is a canvas
  // texture rather than DOM text, so the recipient's live gift name is truly
  // part of the 3D cake and follows it through every camera angle/reaction.
  const namePlaque = makeNamePlaque(recipientName);
  namePlaque.position.set(0, tiers[0].y + 0.015, -tiers[0].r - 0.008);
  namePlaque.rotation.y = Math.PI;
  namePlaque.userData.interactive = cakeInteractive;
  group.add(namePlaque);

  const topY = tiers[2].y + tiers[2].h / 2;

  // ── Candles ───────────────────────────────────────────────────────────────
  const candleMat = new THREE.MeshStandardMaterial({ color: 0xfaf3e6, roughness: 0.55 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xe8b4b8, roughness: 0.55 });
  const wickMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 1 });

  const n = Math.max(1, Math.min(12, candleCount));
  const candles = [];
  const ringR = n === 1 ? 0 : 0.26;

  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const cx = Math.cos(a) * ringR;
    const cz = Math.sin(a) * ringR;
    const ch = 0.30;

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.030, ch, 8),
      i % 2 === 0 ? candleMat : stripeMat
    );
    body.position.set(cx, topY + ch / 2, cz);
    group.add(body);

    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.045, 4),
      wickMat
    );
    wick.position.set(cx, topY + ch + 0.02, cz);
    group.add(wick);

    const flame = createFlame();
    flame.mesh.position.set(cx, topY + ch + 0.045, cz);
    group.add(flame.mesh);

    // Generous invisible target: the rendered candle is too thin for a thumb.
    const hitArea = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.82, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitArea.position.set(cx, topY + 0.20, cz);
    group.add(hitArea);

    // Real point lights only where the tier can afford them.
    let light = null;
    if (tier.candleLights) {
      light = new THREE.PointLight(0xffaa44, 0.55, 2.4, 2);
      light.position.set(cx, topY + ch + 0.10, cz);
      group.add(light);
    }

    const candle = {
      flame,
      light,
      lit: true,
      x: cx,
      z: cz,
      y: topY + ch + 0.045,
      phase: Math.random() * Math.PI * 2,
      snuffT: 0,
      hitArea,
    };
    const interactive = { type: 'candle', candle };
    body.userData.interactive = interactive;
    wick.userData.interactive = interactive;
    flame.mesh.userData.interactive = interactive;
    hitArea.userData.interactive = interactive;
    candles.push(candle);
  }

  // ── Rotunda lighting ──────────────────────────────────────────────────────
  const spot = new THREE.SpotLight(THEME.cakeSpotColor, 14, 12, Math.PI / 7, 0.55, 1.6);
  spot.position.set(0, ROOM_H - 0.3, cakeZ - 0.4);
  spot.target.position.set(0, 1.2, cakeZ);
  scene.add(spot);
  scene.add(spot.target);

  // A pool of warm light on the floor sells the spot without volumetrics.
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 28),
    new THREE.MeshBasicMaterial({
      color: THEME.cakeSpotColor,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.02;
  group.add(pool);
  const baseSpotIntensity = spot.intensity;
  const basePoolOpacity = pool.material.opacity;
  let musicEnergy = 0;
  let musicBass = 0;
  let beatPulse = 0;

  // "HAPPY BIRTHDAY" banner on the end wall behind the cake.
  const banner = makeBanner(
    (tier.surfaceTex || 512) >= 2048 ? 2 : 1,
    tier.anisotropy || 1
  );
  banner.position.set(0, 3.2, cakeZ + 3.4);
  scene.add(banner);

  scene.add(group);

  return {
    group,
    candles,

    tapCandle(candle) {
      if (!candle?.lit) return false;
      candle.lit = false;
      candle.snuffT = 0;
      reaction = Math.min(1.5, reaction + 0.8);
      return true;
    },

    react() {
      reaction = Math.min(1.5, reaction + 1);
    },
    topY,
    cakeZ,
    /**
     * Anchors for the real rotunda SpotLight. fx/beams.js hangs the big cake
     * shaft off these rather than re-deriving them, so the visible beam and the
     * light that actually illuminates the cake cannot end up pointing in
     * different directions.
     */
    spotAnchors: {
      position: spot.position.clone(),
      target: spot.target.position.clone(),
    },
    /** World position just above the candles — used as the FX emit point. */
    flamePosition: new THREE.Vector3(0, topY + 0.35, cakeZ),

    litCount() {
      return candles.filter((c) => c.lit).length;
    },

    /** Snuff up to `count` still-lit candles. Returns those actually snuffed. */
    extinguish(count) {
      const out = [];
      for (const c of candles) {
        if (out.length >= count) break;
        if (!c.lit) continue;
        c.lit = false;
        c.snuffT = 0;
        out.push(c);
      }
      return out;
    },

    relight() {
      for (const c of candles) {
        c.lit = true;
        c.snuffT = 0;
        c.flame.setOpacity(1);
        c.flame.mesh.scale.setScalar(1);
        if (c.light) c.light.intensity = 0.55;
      }
    },

    setMusicReactive(analysis) {
      musicEnergy = analysis?.energy || 0;
      musicBass = analysis?.bass || 0;
      beatPulse = Math.max(beatPulse, analysis?.pulse || 0);
    },

    update(dt, time) {
      reaction *= Math.pow(0.91, dt * 60);
      group.rotation.z = Math.sin(time * 0.026) * reaction * 0.055;
      group.rotation.x = Math.cos(time * 0.021) * reaction * 0.018;
      const bounce = 1 + Math.sin(time * 0.031) * reaction * 0.018;
      group.scale.set(bounce, 1 + reaction * 0.025, bounce);
      const stagePulse = musicEnergy * 0.20 + musicBass * 0.14 + beatPulse * 0.34;
      spot.intensity = baseSpotIntensity * (1 + stagePulse);
      pool.material.opacity = basePoolOpacity * (1 + musicEnergy * 0.55 + beatPulse * 0.85);

      for (const c of candles) {
        if (c.lit) {
          // Independent flicker per candle, or they pulse in unison and look fake.
          const f = 0.82 + Math.sin(time * 0.011 + c.phase) * 0.12
                         + Math.sin(time * 0.027 + c.phase * 2.1) * 0.06;
          c.flame.update(time, f);
          if (c.light) c.light.intensity = 0.42 + f * 0.28;
        } else if (c.snuffT < 1) {
          // Quick squash-and-vanish rather than a plain fade.
          c.snuffT = Math.min(1, c.snuffT + dt * 6);
          const k = 1 - c.snuffT;
          c.flame.setOpacity(k);
          c.flame.mesh.scale.set(k * 0.7 + 0.3, k, 1);
          if (c.light) c.light.intensity = 0.55 * k;
        }
      }
      beatPulse *= Math.pow(0.02, dt);
    },
  };
}

/** Canvas icing plaque — dynamic, crisp, and dependency-free. */
function makeNamePlaque(name) {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 256;
  const ctx = c.getContext('2d');
  const safeName = String(name || 'Friend').trim().slice(0, 24) || 'Friend';

  ctx.clearRect(0, 0, c.width, c.height);

  // Soft fondant oval with a piped gold edge. Transparent corners make it read
  // as icing laid onto the cylindrical tier instead of a rectangular sign.
  ctx.beginPath();
  ctx.ellipse(384, 128, 340, 102, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#fff3e6';
  ctx.shadowColor = 'rgba(78, 38, 24, 0.34)';
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 13;
  ctx.strokeStyle = '#d4a24c';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(384, 128, 315, 80, 0, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(184, 138, 60, 0.55)';
  ctx.stroke();

  let fontSize = 92;
  do {
    ctx.font = `600 ${fontSize}px Georgia, "Times New Roman", serif`;
    fontSize -= 4;
  } while (ctx.measureText(safeName).width > 550 && fontSize > 44);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8f542f';
  ctx.fillText(safeName, 384, 132);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  return new THREE.Mesh(
    new THREE.PlaneGeometry(1.32, 0.44),
    new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      roughness: 0.68,
      metalness: 0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
  );
}

/**
 * Canvas-drawn banner — no font files to ship, no layout to break.
 *
 * This is the largest piece of text in the museum and it hangs at the end of the
 * corridor, so the visitor spends the whole approach reading it from progressively
 * closer range. It was fixed at 1024x256 with no mipmap filtering or anisotropy,
 * which meant the serif strokes shimmered at distance and never fully resolved.
 */
function makeBanner(scale = 1, anisotropy = 1) {
  const c = document.createElement('canvas');
  c.width = 1024 * scale;
  c.height = 256 * scale;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  // Keep drawing in 1024x256 space so the font size and shadow radius below stay
  // as tuned; the extra pixels land as sharper glyph edges rather than a relayout.
  ctx.scale(scale, scale);
  const W = 1024;
  const H = 256;

  ctx.font = '300 92px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = 'rgba(212, 162, 76, 0.85)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = '#f0c070';
  ctx.fillText('Happy Birthday', W / 2, H / 2);
  ctx.shadowBlur = 0;

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 240, 210, 0.6)';
  ctx.strokeText('Happy Birthday', W / 2, H / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = anisotropy;

  return new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 1.1),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    })
  );
}
