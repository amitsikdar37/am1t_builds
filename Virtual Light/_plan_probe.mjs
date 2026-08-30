// Faithful 1-D port of normalAt() + the lambert/composite/encode chain from
// src/gl/shaders.js, at the shipped uniforms. Purpose: measure the relief
// kernel's STEP RESPONSE (plateau + rim) and the cliff flag's tap-alignment
// holes, and compare candidate fixes. No GPU involved; this is the shader's
// arithmetic evaluated on a synthetic depth scanline.

// ---- geometry, derived exactly as renderer.js does -------------------------
const SRC_W = 1280, SRC_H = 720;
const REFINE_MAX_EDGE = 768;
const rscale = Math.min(1, REFINE_MAX_EDGE / Math.max(SRC_W, SRC_H));
const RW = Math.round(SRC_W * rscale), RH = Math.round(SRC_H * rscale); // 768x432
const PATCH = 14;
function planSize(w, h, longEdge) {
  const s = longEdge / Math.max(w, h);
  const snap = (v) => Math.max(PATCH, Math.round((v * s) / PATCH) * PATCH);
  return [snap(w), snap(h)];
}
const [DW, DH] = planSize(SRC_W, SRC_H, 308);
const modelScale = Math.max(1, RW / DW);
const uNormalStep = Math.max(2, modelScale * 1.25);
const uTexel = [1 / RW, 1 / RH];
const e = [uTexel[0] * uNormalStep, uTexel[1] * uNormalStep];

// ---- shipped state --------------------------------------------------------
const uDepthRange = 1.5, uNear = 0.22, uRefZ = uNear + uDepthRange * 0.5;
const uPerspective = 0.55, uNormalFloor = uDepthRange * 0.002;
const uNormalStrength = 0.3, uWrap = 0.65, uAmbient = 0.16, uExposure = 1.0;
const uAspect = SRC_W / SRC_H;
const CANVAS_W = SRC_W; // 1:1 read, so 1 source px == 1 display px

const scaleFor = (z) => 1 + uPerspective * (z / uRefZ - 1);
const unproject = (su, sv, z) => {
  const s = scaleFor(z);
  return [(su - 0.5) * uAspect * s, (sv - 0.5) * s, z];
};
const deaden = (d) => Math.sign(d) * Math.max(Math.abs(d) - uNormalFloor, 0);
const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// ---- the refined depth scanline -------------------------------------------
// Smooth dome (real geometry) + one localised ledge (the fictitious depth the
// model invents on a dark facial feature). The ledge ramps over RAMP refine
// texels, which is what a 1-model-texel feature becomes after the 2.49x
// bilinear upsample to the refine grid.
const H = Number(process.env.LEDGE ?? 0.06);   // ledge height, disparity
const RAMP = Number(process.env.RAMP ?? 2.5);  // ramp width, refine texels
const DOME = Number(process.env.DOME ?? 0.18); // dome swing, disparity
const LEDGE_AT = 0.5;                          // uv of the feature

function dispAt(su) {
  // dome: a smooth cheek, curvature only
  const t = (su - 0.5) * 2;
  let d = 0.62 + DOME * (1 - t * t) * 0.5;
  // fictitious ledge, centred on the feature, ramped
  const x = (su - LEDGE_AT) / (RAMP * uTexel[0]);
  d += H * Math.max(0, 1 - Math.abs(x));
  return d;
}
// sample onto the refine grid, then read back bilinearly the way zAt() does
const grid = new Float64Array(RW);
for (let i = 0; i < RW; i++) grid[i] = dispAt((i + 0.5) / RW);
function depthAt(su) {
  const x = Math.min(Math.max(su, 0), 1) * RW - 0.5;
  const i0 = Math.floor(x), f = x - i0;
  const a = grid[Math.min(Math.max(i0, 0), RW - 1)];
  const b = grid[Math.min(Math.max(i0 + 1, 0), RW - 1)];
  return a + (b - a) * f;
}
const zAt = (su) => uNear + (1 - depthAt(su)) * uDepthRange;

// ---- normalAt, 1-D (field is constant in y, so dzy / near.zw vanish) ------
// mode.relief: 'box'  -> shipped, (sxp-sxn)/6
//              'c21'  -> proposed Edit C, (2*(mr-ml)+(sxp-sxn))*0.1
//              'eq'   -> equal weights, (mr-ml+sxp-sxn)*0.125
// mode.fade:   'cliff' -> shipped smoothstep(4.2,5.4)
//              'relief'-> smoothstep(1.2,5.4)
function normalAt(su, mode) {
  const ml = zAt(su - e[0]), mr = zAt(su + e[0]);
  const z0 = zAt(su);
  const dzx = deaden(mr - ml) * 0.5;
  const s = scaleFor(z0);
  const worldx = e[0] * uAspect * s;
  const slope = Math.abs(dzx / Math.max(worldx, 1e-6));

  const sxp = zAt(su + e[0] * 3), sxn = zAt(su - e[0] * 3);
  const nx = Math.max(Math.abs(sxp - mr) - uNormalFloor, 0) / Math.max(2 * worldx, 1e-6);
  const ny = Math.max(Math.abs(ml - sxn) - uNormalFloor, 0) / Math.max(2 * worldx, 1e-6);
  const grade = Math.max(slope, nx, ny);
  const cliff = smoothstep(4.2, 5.4, grade);
  const fade = mode.fade === 'relief' ? smoothstep(1.2, 5.4, grade) : cliff;

  let dzxw;
  if (mode.relief === 'box') dzxw = deaden((sxp - sxn) * (1 / 6));
  else if (mode.relief === 'c21') dzxw = deaden((2 * (mr - ml) + (sxp - sxn)) * 0.1);
  else dzxw = deaden((mr - ml + sxp - sxn) * 0.125);

  // px = unproject(su+ex, z0+dzxw) - unproject(su-ex, z0-dzxw); py is the y pair,
  // which for a y-constant field has dzyw = 0.
  const pxv = unproject(su + e[0], 0.5, z0 + dzxw).map((v, k) =>
    v - unproject(su - e[0], 0.5, z0 - dzxw)[k]);
  const pyv = unproject(su, 0.5 + e[1], z0).map((v, k) =>
    v - unproject(su, 0.5 - e[1], z0)[k]);
  pxv[2] *= uNormalStrength;
  pyv[2] *= uNormalStrength;
  // n = cross(px, py)
  let n = [
    pxv[1] * pyv[2] - pxv[2] * pyv[1],
    pxv[2] * pyv[0] - pxv[0] * pyv[2],
    pxv[0] * pyv[1] - pxv[1] * pyv[0],
  ];
  const len = Math.hypot(...n);
  if (len < 1e-9) return { N: [0, 0, -1], cliff, fade, grade, dzxw, tilt: 0 };
  n = n.map((v) => v / len);
  if (n[2] > 0) n = n.map((v) => -v);
  const rawTilt = (Math.acos(Math.min(1, Math.abs(n[2]))) * 180) / Math.PI;
  let N = [
    n[0] * (1 - fade) + 0 * fade,
    n[1] * (1 - fade) + 0 * fade,
    n[2] * (1 - fade) + -1 * fade,
  ];
  const nl2 = Math.hypot(...N);
  N = N.map((v) => v / nl2);
  return { N, cliff, fade, grade, dzxw, tilt: rawTilt };
}

// ---- shading: lambert -> composite -> encode, shadows off (isolate normals) -
const LIGHT = { u: 0.72, v: 0.30, z: uNear + 0.2 * uDepthRange, I: 2.0, R: 0.45 };
const LCOL = [1, 0.7011, 0.4287]; // #ffd9a8 gamma-decoded
const ALB = [0.2462, 0.1274, 0.0802]; // mid skin (196,150,120) sRGB -> linear

const composite = (base, add) => {
  const head = Math.max(1 - Math.min(Math.max(base, 0), 1), 1e-5);
  const t = Math.max(add, 0) / head;
  const s = (t * (1 + t / 4)) / (1 + t);
  return Math.min(Math.max(base, 0), 1) + head * Math.min(s, 1);
};
const encode = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function shade(su, mode) {
  const r = normalAt(su, mode);
  const z0 = zAt(su);
  const P = unproject(su, 0.5, z0);
  const Lp = unproject(LIGHT.u, LIGHT.v, LIGHT.z);
  const tl = [Lp[0] - P[0], Lp[1] - P[1], Lp[2] - P[2]];
  const dist = Math.hypot(...tl);
  const L = tl.map((v) => v / dist);
  const ratio = dist / LIGHT.R;
  let atten = 1 / (1 + ratio * ratio);
  const win = Math.min(Math.max(1 - Math.pow(ratio / 3, 4), 0), 1);
  atten *= win * win;
  const nl = r.N[0] * L[0] + r.N[1] * L[1] + r.N[2] * L[2];
  const lambert = (1 - uWrap) * Math.max(nl, 0) + uWrap * Math.max(nl * 0.5 + 0.5, 0);
  const energy = LIGHT.I * atten; // sh = 1, shadows isolated out
  // green channel, the one the eye weights most
  const base = ALB[1] * uAmbient * uExposure;
  const add = ALB[1] * LCOL[1] * lambert * energy * uExposure;
  return { byte: 255 * encode(composite(base, add)), ...r, nl, lambert, atten };
}

// ---- scan -----------------------------------------------------------------
const modes = {
  'shipped        (box + cliff)': { relief: 'box', fade: 'cliff' },
  'A+B            (box + relief)': { relief: 'box', fade: 'relief' },
  'A+B+C as-proposed (2:1 + relief)': { relief: 'c21', fade: 'relief' },
  'A+B+C equal    (1:1/8 + relief)': { relief: 'eq', fade: 'relief' },
};
const ePx = e[0] * CANVAS_W; // one e, in display px
console.log(`geometry: refine ${RW}x${RH}  model ${DW}x${DH}  modelScale ${modelScale.toFixed(4)}`);
console.log(`uNormalStep ${uNormalStep.toFixed(4)}  e.x ${e[0].toFixed(7)} uv = ${ePx.toFixed(2)} display px  3e = ${(3 * ePx).toFixed(2)} px`);
console.log(`ledge H=${H} disparity (${((H * 100) / 1).toFixed(1)}% of normalised range), ramp ${RAMP} refine texels, dome swing ${DOME}\n`);

const x0 = Math.round(LEDGE_AT * CANVAS_W);
const HALF = 60; // display px each side
for (const [name, mode] of Object.entries(modes)) {
  const prof = [];
  for (let px = x0 - HALF; px <= x0 + HALF; px++) prof.push(shade((px + 0.5) / CANVAS_W, mode));
  const bytes = prof.map((p) => p.byte);
  // worst adjacent 1-px step, excluding the feature's own core (|x| < 1.5 texel)
  let worst = 0, worstAt = 0, hard = 0;
  for (let i = 1; i < bytes.length; i++) {
    const dx = i - HALF;
    if (Math.abs(dx) < 2) continue;
    const d = Math.abs(bytes[i] - bytes[i - 1]);
    if (d >= 4) hard++;
    if (d > worst) { worst = d; worstAt = dx; }
  }
  // plateau: mean |tilt| over the 8..20 px band either side (the "filled" zone)
  const band = prof.filter((p, i) => { const d = Math.abs(i - HALF); return d >= 8 && d <= 20; });
  const meanTilt = band.reduce((s, p) => s + p.tilt, 0) / band.length;
  const meanFade = band.reduce((s, p) => s + p.fade, 0) / band.length;
  // effective tilt after the fade, which is what actually shades
  const effTilt = band.reduce((s, p) => {
    const nz = Math.abs(p.N[2]);
    return s + (Math.acos(Math.min(1, nz)) * 180) / Math.PI;
  }, 0) / band.length;
  const flat = shade((x0 + 200 + 0.5) / CANVAS_W, mode).byte;
  const dip = Math.min(...bytes.filter((_, i) => Math.abs(i - HALF) >= 2));
  console.log(name);
  console.log(`  worst 1px step ${worst.toFixed(2)} LSB at ${worstAt > 0 ? '+' : ''}${worstAt} px   pixels >=4 LSB/px: ${hard}`);
  console.log(`  8-20px band: raw tilt ${meanTilt.toFixed(2)} deg, fade ${meanFade.toFixed(3)}, EFFECTIVE tilt ${effTilt.toFixed(2)} deg`);
  console.log(`  darkest byte outside core ${dip.toFixed(1)} vs far-field ${flat.toFixed(1)}  => dip ${(flat - dip).toFixed(2)} LSB\n`);
}

// ---- the cliff pinhole table ---------------------------------------------
console.log('cliff / reliefFade / raw tilt vs distance from the ledge (display px):');
console.log(' px |  grade | cliff | relief | rawTilt | eff(cliff) | eff(relief)');
for (const d of [-30, -26, -23, -20, -16, -12, -9, -8, -7, -6, -4, 0, 4, 6, 7, 8, 9, 12, 16, 20, 23, 26, 30]) {
  const su = (x0 + d + 0.5) / CANVAS_W;
  const a = normalAt(su, { relief: 'box', fade: 'cliff' });
  const b = normalAt(su, { relief: 'box', fade: 'relief' });
  const ea = (Math.acos(Math.min(1, Math.abs(a.N[2]))) * 180) / Math.PI;
  const eb = (Math.acos(Math.min(1, Math.abs(b.N[2]))) * 180) / Math.PI;
  console.log(`${String(d).padStart(4)}| ${a.grade.toFixed(3).padStart(6)} | ${a.cliff.toFixed(3)} | ${b.fade.toFixed(3)}  | ${a.tilt.toFixed(2).padStart(6)}  | ${ea.toFixed(2).padStart(9)}  | ${eb.toFixed(2).padStart(9)}`);
}
