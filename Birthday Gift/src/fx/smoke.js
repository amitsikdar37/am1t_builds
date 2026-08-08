import * as THREE from 'three';

/**
 * Smoke puffs for the candle extinguish moment.
 *
 * Layered soft billboards from a pre-allocated InstancedMesh pool. Puffs rise,
 * expand, curl on per-instance noise, and fade.
 *
 * This is deliberately NOT raymarched volumetric smoke. Real volumetrics mean a
 * per-pixel march through a 3D texture, which a mid-range phone cannot afford at
 * 60fps — and this scene's whole promise is that it stays smooth on that phone.
 * Layered billboards are what shipped games use for exactly this effect, and at
 * the scale of a candle wisp they read the same.
 */

function makeSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');

  // Soft radial falloff, then noise punched into it so edges aren't perfect
  // circles — that's what makes a stack of billboards read as one wispy mass.
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(230, 230, 235, 0.62)');
  g.addColorStop(0.45, 'rgba(200, 200, 210, 0.28)');
  g.addColorStop(1, 'rgba(180, 180, 195, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);

  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 60;
    const x = 64 + Math.cos(a) * r;
    const y = 64 + Math.sin(a) * r;
    const rad = 4 + Math.random() * 14;
    const hole = ctx.createRadialGradient(x, y, 0, x, y, rad);
    hole.addColorStop(0, `rgba(0,0,0,${0.10 + Math.random() * 0.16})`);
    hole.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSmoke(scene, tier) {
  const MAX = tier.smoke;

  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({
    map: makeSmokeTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 1,
    // NormalBlending, not additive: smoke occludes, it doesn't glow.
    blending: THREE.NormalBlending,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  mesh.frustumCulled = false;
  mesh.renderOrder = 9;
  mesh.count = MAX;
  scene.add(mesh);

  // Particle state as plain arrays — no per-particle objects, no GC churn.
  const px = new Float32Array(MAX);
  const py = new Float32Array(MAX);
  const pz = new Float32Array(MAX);
  const vx = new Float32Array(MAX);
  const vy = new Float32Array(MAX);
  const vz = new Float32Array(MAX);
  const life = new Float32Array(MAX);
  const maxLife = new Float32Array(MAX);
  const size0 = new Float32Array(MAX);
  const rot = new Float32Array(MAX);
  const rotV = new Float32Array(MAX);
  const seed = new Float32Array(MAX);
  const active = new Uint8Array(MAX);

  let cursor = 0;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  // Park everything off-screen initially.
  dummy.position.set(0, -999, 0);
  dummy.scale.setScalar(0.0001);
  dummy.updateMatrix();
  for (let i = 0; i < MAX; i++) mesh.setMatrixAt(i, dummy.matrix);
  mesh.instanceMatrix.needsUpdate = true;

  function spawn(x, y, z, count, strength = 1) {
    for (let n = 0; n < count; n++) {
      const i = cursor;
      cursor = (cursor + 1) % MAX;

      px[i] = x + (Math.random() - 0.5) * 0.03;
      py[i] = y + Math.random() * 0.02;
      pz[i] = z + (Math.random() - 0.5) * 0.03;

      // Initial burst carries sideways in the direction of the "breath",
      // then buoyancy takes over.
      vx[i] = (Math.random() - 0.5) * 0.35 * strength;
      vy[i] = 0.18 + Math.random() * 0.32;
      vz[i] = (Math.random() - 0.5) * 0.35 * strength;

      maxLife[i] = 1.6 + Math.random() * 1.5;
      life[i] = maxLife[i];
      size0[i] = 0.05 + Math.random() * 0.05;
      rot[i] = Math.random() * Math.PI * 2;
      rotV[i] = (Math.random() - 0.5) * 0.9;
      seed[i] = Math.random() * 100;
      active[i] = 1;
    }
  }

  return {
    mesh,
    spawn,

    update(dt, camera) {
      let any = false;

      for (let i = 0; i < MAX; i++) {
        if (!active[i]) continue;
        any = true;

        life[i] -= dt;
        if (life[i] <= 0) {
          active[i] = 0;
          dummy.position.set(0, -999, 0);
          dummy.scale.setScalar(0.0001);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          continue;
        }

        const t = 1 - life[i] / maxLife[i]; // 0 at birth -> 1 at death

        // Buoyancy plus drag: fast initial rise easing into a slow drift.
        vy[i] += 0.28 * dt;
        const drag = Math.exp(-1.7 * dt);
        vx[i] *= drag;
        vz[i] *= drag;
        vy[i] *= Math.exp(-0.55 * dt);

        // Curl — cheap sinusoidal swirl standing in for turbulence.
        const s = seed[i];
        const tt = performance.now() * 0.001;
        vx[i] += Math.sin(tt * 1.6 + s) * 0.10 * dt;
        vz[i] += Math.cos(tt * 1.3 + s * 1.7) * 0.10 * dt;

        px[i] += vx[i] * dt;
        py[i] += vy[i] * dt;
        pz[i] += vz[i] * dt;

        rot[i] += rotV[i] * dt;

        // Expand as it rises and dissipates.
        const scale = size0[i] * (1 + t * 5.5);

        // Fade in fast, out slow.
        const alpha = Math.min(1, t * 6) * (1 - t) * (1 - t);

        dummy.position.set(px[i], py[i], pz[i]);
        // Billboard toward the camera, then spin in-plane.
        if (camera) dummy.quaternion.copy(camera.quaternion);
        dummy.rotateZ(rot[i]);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        // Per-instance alpha is folded into instanceColor (multiplied against
        // the material in the shader) — avoids needing a custom shader here.
        const v = alpha * 0.55;
        col.setRGB(v, v, v);
        mesh.setColorAt(i, col);
      }

      if (any) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
  };
}
