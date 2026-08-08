import * as THREE from 'three';
import { THEME } from './../scene/theme.js';

/**
 * Confetti burst for the finale.
 *
 * One InstancedMesh of small quads, pre-allocated at the tier's budget, stepped
 * in plain JS. Each piece tumbles on all three axes with its own drag, so the
 * burst reads as paper rather than as points — the tumble is what sells it, and
 * it costs one quaternion per piece per frame.
 */

export function createConfetti(scene, tier) {
  const MAX = tier.confetti;

  // Small rectangle — paper, not square.
  const geo = new THREE.PlaneGeometry(0.055, 0.09);
  const mat = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  mesh.frustumCulled = false;
  mesh.count = MAX;
  scene.add(mesh);

  const px = new Float32Array(MAX);
  const py = new Float32Array(MAX);
  const pz = new Float32Array(MAX);
  const vx = new Float32Array(MAX);
  const vy = new Float32Array(MAX);
  const vz = new Float32Array(MAX);
  const rx = new Float32Array(MAX);
  const ry = new Float32Array(MAX);
  const rz = new Float32Array(MAX);
  const rvx = new Float32Array(MAX);
  const rvy = new Float32Array(MAX);
  const rvz = new Float32Array(MAX);
  const life = new Float32Array(MAX);
  const maxLife = new Float32Array(MAX);
  const scl = new Float32Array(MAX);
  const active = new Uint8Array(MAX);

  let cursor = 0;
  let anyActive = false;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const palette = THEME.confettiColors;

  // Park all instances off-screen.
  dummy.position.set(0, -999, 0);
  dummy.scale.setScalar(0.0001);
  dummy.updateMatrix();
  for (let i = 0; i < MAX; i++) {
    mesh.setMatrixAt(i, dummy.matrix);
    col.setHex(palette[i % palette.length]);
    mesh.setColorAt(i, col);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  /**
   * Fire a burst. Emits in a wide cone biased toward the camera so the confetti
   * appears to fly out of the screen at the viewer.
   */
  function burst(origin, count = MAX, spread = 1) {
    const n = Math.min(count, MAX);
    for (let k = 0; k < n; k++) {
      const i = cursor;
      cursor = (cursor + 1) % MAX;

      px[i] = origin.x + (Math.random() - 0.5) * 0.5;
      py[i] = origin.y + (Math.random() - 0.5) * 0.3;
      pz[i] = origin.z + (Math.random() - 0.5) * 0.5;

      // Upward-and-outward cone.
      const angle = Math.random() * Math.PI * 2;
      const radial = (0.9 + Math.random() * 3.2) * spread;
      vx[i] = Math.cos(angle) * radial;
      vz[i] = Math.sin(angle) * radial - Math.random() * 2.2; // bias toward camera
      vy[i] = 3.2 + Math.random() * 4.0;

      rx[i] = Math.random() * Math.PI * 2;
      ry[i] = Math.random() * Math.PI * 2;
      rz[i] = Math.random() * Math.PI * 2;
      rvx[i] = (Math.random() - 0.5) * 12;
      rvy[i] = (Math.random() - 0.5) * 12;
      rvz[i] = (Math.random() - 0.5) * 12;

      maxLife[i] = 3.4 + Math.random() * 2.6;
      life[i] = maxLife[i];
      scl[i] = 0.75 + Math.random() * 0.7;
      active[i] = 1;

      col.setHex(palette[Math.floor(Math.random() * palette.length)]);
      mesh.setColorAt(i, col);
    }
    anyActive = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  return {
    mesh,
    burst,
    isActive: () => anyActive,

    update(dt) {
      if (!anyActive) return;
      let stillActive = false;

      for (let i = 0; i < MAX; i++) {
        if (!active[i]) continue;

        life[i] -= dt;
        if (life[i] <= 0) {
          active[i] = 0;
          dummy.position.set(0, -999, 0);
          dummy.scale.setScalar(0.0001);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          continue;
        }
        stillActive = true;

        // Gravity + air drag. Paper decelerates hard, which is why confetti
        // flutters down instead of falling like gravel.
        vy[i] -= 5.2 * dt;
        const drag = Math.exp(-1.5 * dt);
        vx[i] *= drag;
        vz[i] *= drag;
        vy[i] *= Math.exp(-0.7 * dt);

        // Flutter: a little lateral wobble as it tumbles.
        vx[i] += Math.sin(rx[i] * 2) * 0.5 * dt;
        vz[i] += Math.cos(ry[i] * 2) * 0.5 * dt;

        px[i] += vx[i] * dt;
        py[i] += vy[i] * dt;
        pz[i] += vz[i] * dt;

        rx[i] += rvx[i] * dt;
        ry[i] += rvy[i] * dt;
        rz[i] += rvz[i] * dt;

        const t = 1 - life[i] / maxLife[i];
        // Hold full opacity, then fade only over the last third of life.
        const fade = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;

        dummy.position.set(px[i], py[i], pz[i]);
        dummy.rotation.set(rx[i], ry[i], rz[i]);
        dummy.scale.setScalar(scl[i] * fade);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }

      mesh.instanceMatrix.needsUpdate = true;
      anyActive = stillActive;
    },
  };
}
