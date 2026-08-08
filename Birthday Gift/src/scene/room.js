import * as THREE from 'three';
import { THEME } from './theme.js';

/**
 * The gallery corridor.
 *
 * All surface detail is generated into canvases at runtime rather than shipped
 * as image files. This technique is borrowed from the sibling 3D Theater
 * project (js/room.js) and matters a lot here: it keeps the published gift
 * payload dedicated almost entirely to the recipient's actual photos, rather
 * than to wall textures they'll barely look at.
 */

export const ROOM_W = 5.8;
export const ROOM_H = 5;

function makeWallTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  // Warm cream base with peachy glow gradient
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#fff8f0');
  g.addColorStop(0.5, '#ffe8d8');
  g.addColorStop(1, '#ffd8c0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Soft fabric texture
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < size; i += 2) {
    ctx.fillStyle = i % 4 === 0 ? '#ffffff' : '#ffe0c8';
    ctx.fillRect(i, 0, 1, size);
  }
  ctx.globalAlpha = 1;

  // Subtle warm mottling
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = Math.random() * 15;
    ctx.fillStyle = `rgba(${255}, ${240 + v}, ${220 + v}, 0.08)`;
    ctx.fillRect(x, y, 2, 2);
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Small deterministic PRNG.
 *
 * The floor texture used to call Math.random() for its grain, which produced a
 * different — and visibly different — tile on every load, and made the artefacts
 * impossible to reproduce or reason about. A fixed seed means the tile is the
 * same every time and its seam behaviour can actually be verified.
 */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Oak plank flooring.
 *
 * The previous version drew grain as random polylines that jumped up to 90px per
 * segment in both axes — that is what produced the chaotic scribbles across the
 * floor. Grain in real timber runs *along* the plank, so here every grain line is
 * a low-amplitude sine that completes a whole number of cycles over the tile
 * height. Whole cycles are what make the tile seamless end-to-end; the planks run
 * along the corridor's length, so any discontinuity would have shown up as a
 * repeating band every few metres.
 */
function makeFloorTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const rnd = makeRng(0x5eed1234);

  const PLANKS = 4;
  const pw = size / PLANKS;

  ctx.fillStyle = '#e9d6bd';
  ctx.fillRect(0, 0, size, size);

  for (let p = 0; p < PLANKS; p++) {
    const x0 = p * pw;

    // Per-plank tone variation — real floors are milled from different boards.
    const t = 0.93 + rnd() * 0.14;
    ctx.fillStyle = `rgb(${Math.round(233 * t)},${Math.round(214 * t)},${Math.round(189 * t)})`;
    ctx.fillRect(x0, 0, pw, size);

    const lines = 16;
    for (let i = 0; i < lines; i++) {
      const cx = x0 + (i + 0.5) * (pw / lines);
      const amp = 0.8 + rnd() * 2.6;
      const cycles = 1 + Math.floor(rnd() * 3); // whole cycles → seamless in v
      const phase = rnd() * Math.PI * 2;

      ctx.beginPath();
      ctx.lineWidth = 0.5 + rnd() * 1.0;
      ctx.strokeStyle = `rgba(176, 143, 104, ${(0.08 + rnd() * 0.14).toFixed(3)})`;
      for (let y = 0; y <= size; y += 4) {
        const x = cx + Math.sin((y / size) * cycles * Math.PI * 2 + phase) * amp;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Plank seam, drawn on both edges of the tile so the wrap joins cleanly.
    ctx.strokeStyle = 'rgba(148, 118, 86, 0.34)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0 + 0.6, 0);
    ctx.lineTo(x0 + 0.6, size);
    ctx.stroke();
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  // Anisotropy is set by buildRoom from the tier, not here. The floor is the most
  // grazing-angle surface in the scene — the camera looks down its length for the
  // entire visit — so it must not be pinned to a number chosen for one device.
  return t;
}

/**
 * Roughness map for the floor, generated from the same seed so its features line
 * up with the albedo. Grain lines sit slightly rougher than the surrounding
 * board and the seams are rougher still, so the cake's light smears along the
 * planks instead of producing one uniform mirror sheen.
 *
 * Not sRGB — roughness is linear data, and tagging it sRGB would gamma-shift it.
 */
function makeFloorRoughnessTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const rnd = makeRng(0x5eed1234);

  const PLANKS = 4;
  const pw = size / PLANKS;

  // Mid grey = the base roughness the material multiplies against.
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, size, size);

  for (let p = 0; p < PLANKS; p++) {
    const x0 = p * pw;
    const t = 0.93 + rnd() * 0.14;
    const v = Math.round(138 * t);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x0, 0, pw, size);

    const lines = 16;
    for (let i = 0; i < lines; i++) {
      const cx = x0 + (i + 0.5) * (pw / lines);
      const amp = (0.8 + rnd() * 2.6) * (size / 512);
      const cycles = 1 + Math.floor(rnd() * 3);
      const phase = rnd() * Math.PI * 2;

      ctx.beginPath();
      ctx.lineWidth = (0.5 + rnd() * 1.0) * (size / 512) * 2;
      ctx.strokeStyle = `rgba(200, 200, 200, ${(0.20 + rnd() * 0.25).toFixed(3)})`;
      for (let y = 0; y <= size; y += 4) {
        const x = cx + Math.sin((y / size) * cycles * Math.PI * 2 + phase) * amp;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(230, 230, 230, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0 + 0.6, 0);
    ctx.lineTo(x0 + 0.6, size);
    ctx.stroke();
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * Build the corridor. Length is driven by frame count so the room always fits
 * the gift rather than the gift being padded to fit a fixed room.
 */
export function buildRoom(scene, corridorLength, tier) {
  const group = new THREE.Group();
  const len = corridorLength + 20; // extra for the rotunda at the end

  // Canvas sizes raised from hard-coded 512 to tier-driven values. These are
  // generated once at boot, so the cost is a few milliseconds of 2D canvas work
  // and some texture memory — there is no per-frame cost whatsoever. A 512 tile
  // stretched over tens of metres arrives as mush regardless of render resolution,
  // so doubling the source is the cheapest sharpness in the project.
  const surfaceRes = tier.surfaceTex || 512;
  const wallTex = makeWallTexture(surfaceRes);
  wallTex.repeat.set(len / 6, ROOM_H / 4);
  if (tier.anisotropy) wallTex.anisotropy = tier.anisotropy;

  const floorTex = makeFloorTexture(surfaceRes);
  // Planks run along the corridor. One tile spans the full width (4 planks) and
  // 3m of length, which is roughly a real plank run.
  floorTex.repeat.set(1, len / 3);
  if (tier.anisotropy) floorTex.anisotropy = tier.anisotropy;

  const floorRough = makeFloorRoughnessTexture(Math.floor(surfaceRes / 2));
  floorRough.repeat.copy(floorTex.repeat);

  // The textures already carry the cream hues. Tinting on top of them would
  // multiply and shift the result, so the material colour stays white and the
  // canvas is the single source of hue.
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.88,
    metalness: 0.0,
  });

  // Sealed timber, not metal. metalness 0.25 was making the floor read as a
  // brushed-steel sheet: on a metallic surface the diffuse albedo is suppressed
  // in favour of a tinted specular, so the wood colour was being thrown away.
  // Roughness is driven by the map, with the scalar acting as a multiplier.
  // Lowered from 0.85 to 0.52 so the floor reads as glossy sealed timber even
  // on LOW tier, which gets no planar reflection.
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughnessMap: floorRough,
    roughness: 0.52,
    metalness: 0.0,
  });

  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0xfff2e4,
    roughness: 1.0,
  });

  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, len), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = len / 2 - 10;
  group.add(floor);

  // Ceiling
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, len), ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, ROOM_H, len / 2 - 10);
  group.add(ceil);

  // Side walls
  const wallGeo = new THREE.PlaneGeometry(len, ROOM_H);
  const leftWall = new THREE.Mesh(wallGeo, wallMat);
  leftWall.position.set(-ROOM_W / 2, ROOM_H / 2, len / 2 - 10);
  leftWall.rotation.y = Math.PI / 2;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(wallGeo, wallMat);
  rightWall.position.set(ROOM_W / 2, ROOM_H / 2, len / 2 - 10);
  rightWall.rotation.y = -Math.PI / 2;
  group.add(rightWall);

  // Back wall (behind the camera at start) so early frames don't show the void
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), wallMat);
  backWall.position.set(0, ROOM_H / 2, -10);
  group.add(backWall);

  // End wall behind the cake
  const endWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), wallMat);
  endWall.position.set(0, ROOM_H / 2, len - 10);
  endWall.rotation.y = Math.PI;
  group.add(endWall);

  // Skirting, dado rail and crown moulding.
  //
  // These are what stop the wall/floor junction reading as a bare polygonal
  // edge. The skirting is deliberately tall and stands proud of the wall so it
  // catches the picture lights along its top face and casts its own gradient —
  // a flat strip painted on the wall would not.
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xfffaf2,
    roughness: 0.55,
    metalness: 0.0,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: THEME.brass,
    roughness: 0.3,
    metalness: 0.85,
  });

  // Skirting board: a tall lower box plus a thinner proud cap, so the silhouette
  // steps rather than being a single slab.
  const skirtGeo = new THREE.BoxGeometry(len, 0.30, 0.08);
  const skirtCapGeo = new THREE.BoxGeometry(len, 0.05, 0.12);
  // Slim brass dado line at picture-rail height, and the crown at the ceiling.
  const dadoGeo = new THREE.BoxGeometry(len, 0.035, 0.05);
  const crownGeo = new THREE.BoxGeometry(len, 0.22, 0.10);

  for (const side of [-1, 1]) {
    const x = side * (ROOM_W / 2 - 0.04);

    const skirt = new THREE.Mesh(skirtGeo, trimMat);
    skirt.position.set(x, 0.15, len / 2 - 10);
    skirt.rotation.y = Math.PI / 2;
    group.add(skirt);

    const skirtCap = new THREE.Mesh(skirtCapGeo, trimMat);
    skirtCap.position.set(x, 0.325, len / 2 - 10);
    skirtCap.rotation.y = Math.PI / 2;
    group.add(skirtCap);

    // Clear of the picture-light fixtures, which top out around y=3.3.
    const dado = new THREE.Mesh(dadoGeo, brassMat);
    dado.position.set(x, 3.95, len / 2 - 10);
    dado.rotation.y = Math.PI / 2;
    group.add(dado);

    const crown = new THREE.Mesh(crownGeo, trimMat);
    crown.position.set(x, ROOM_H - 0.14, len / 2 - 10);
    crown.rotation.y = Math.PI / 2;
    group.add(crown);
  }

  scene.add(group);
  // The floor is returned alongside the group because fx/reflect.js builds the
  // polished surface from this exact mesh — its geometry, transform and
  // roughness map — so the reflection can never drift out of register with the
  // timber underneath it.
  return { group, floor };
}
