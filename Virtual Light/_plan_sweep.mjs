// Sweep version: feature kind (bump = glasses rim / moustache, step = hairline /
// beard boundary), width, height, sub-texel phase. Reports aggregate hard-edge
// and dip metrics for each candidate relief kernel + fade pairing.
const SRC_W = 1280, SRC_H = 720, RW = 768, RH = 432, DW = 308;
const PATCH = 14;
const modelScale = RW / DW;
const uNormalStep = Math.max(2, modelScale * 1.25);
const uTexel = [1 / RW, 1 / RH];
const e = [uTexel[0] * uNormalStep, uTexel[1] * uNormalStep];
const uDepthRange = 1.5, uNear = 0.22, uRefZ = uNear + uDepthRange * 0.5;
const uPerspective = 0.55, uNormalFloor = uDepthRange * 0.002;
const uNormalStrength = 0.3, uWrap = 0.65, uAmbient = 0.16;
const uAspect = SRC_W / SRC_H, CANVAS_W = SRC_W;
const scaleFor = (z) => 1 + uPerspective * (z / uRefZ - 1);
const deaden = (d) => Math.sign(d) * Math.max(Math.abs(d) - uNormalFloor, 0);
const ss = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

function makeField({ kind, h, halfW, phase, dome }) {
  const at = 0.5 + phase * uTexel[0];
  const f = (su) => {
    const t = (su - 0.5) * 2;
    let d = 0.62 + dome * (1 - t * t) * 0.5;
    const x = (su - at) / (halfW * uTexel[0]);
    if (kind === 'bump') d += h * Math.max(0, 1 - Math.abs(x));
    else d += h * Math.min(Math.max((x + 1) * 0.5, 0), 1); // ramped step
    return d;
  };
  const grid = new Float64Array(RW);
  for (let i = 0; i < RW; i++) grid[i] = f((i + 0.5) / RW);
  const depthAt = (su) => {
    const x = Math.min(Math.max(su, 0), 1) * RW - 0.5;
    const i0 = Math.floor(x), fr = x - i0;
    const a = grid[Math.min(Math.max(i0, 0), RW - 1)];
    const b = grid[Math.min(Math.max(i0 + 1, 0), RW - 1)];
    return a + (b - a) * fr;
  };
  return { at, zAt: (su) => uNear + (1 - depthAt(su)) * uDepthRange };
}

function normalAt(su, zAt, mode) {
  const ml = zAt(su - e[0]), mr = zAt(su + e[0]), z0 = zAt(su);
  const dzx = deaden(mr - ml) * 0.5;
  const worldx = e[0] * uAspect * scaleFor(z0);
  const slope = Math.abs(dzx / Math.max(worldx, 1e-6));
  const sxp = zAt(su + e[0] * 3), sxn = zAt(su - e[0] * 3);
  const nx = Math.max(Math.abs(sxp - mr) - uNormalFloor, 0) / Math.max(2 * worldx, 1e-6);
  const ny = Math.max(Math.abs(ml - sxn) - uNormalFloor, 0) / Math.max(2 * worldx, 1e-6);
  const grade = Math.max(slope, nx, ny);
  const cliff = ss(4.2, 5.4, grade);
  const fade = mode.fade === 'relief' ? ss(1.2, 5.4, grade) : cliff;
  let dzxw;
  if (mode.relief === 'box') dzxw = deaden((sxp - sxn) * (1 / 6));
  else if (mode.relief === 'c21') dzxw = deaden((2 * (mr - ml) + (sxp - sxn)) * 0.1);
  else dzxw = deaden((mr - ml + sxp - sxn) * 0.125);
  // px/py cross product, 1-D (dzyw = 0)
  const sp = scaleFor(z0 + dzxw), sn = scaleFor(z0 - dzxw);
  const pxv = [(su + e[0] - 0.5) * uAspect * sp - (su - e[0] - 0.5) * uAspect * sn, 0, 2 * dzxw * uNormalStrength];
  const s0 = scaleFor(z0);
  const pyv = [0, 2 * e[1] * s0, 0];
  let n = [pxv[1] * pyv[2] - pxv[2] * pyv[1], pxv[2] * pyv[0] - pxv[0] * pyv[2], pxv[0] * pyv[1] - pxv[1] * pyv[0]];
  const len = Math.hypot(...n);
  if (len < 1e-9) return { N: [0, 0, -1], grade, cliff, fade, tilt: 0 };
  n = n.map((v) => v / len);
  if (n[2] > 0) n = n.map((v) => -v);
  const tilt = (Math.acos(Math.min(1, Math.abs(n[2]))) * 180) / Math.PI;
  let N = [n[0] * (1 - fade), n[1] * (1 - fade), n[2] * (1 - fade) - fade];
  const L2 = Math.hypot(...N);
  N = N.map((v) => v / L2);
  return { N, grade, cliff, fade, tilt };
}

const LIGHT = { u: 0.72, v: 0.30, z: uNear + 0.2 * uDepthRange, I: 2.0, R: 0.45 };
const LG = 0.7011, ALBG = 0.1274;
const composite = (base, add) => {
  const head = Math.max(1 - Math.min(Math.max(base, 0), 1), 1e-5);
  const t = Math.max(add, 0) / head, s = (t * (1 + t / 4)) / (1 + t);
  return Math.min(Math.max(base, 0), 1) + head * Math.min(s, 1);
};
const encode = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function shade(su, zAt, mode) {
  const r = normalAt(su, zAt, mode);
  const z0 = zAt(su), s0 = scaleFor(z0);
  const P = [(su - 0.5) * uAspect * s0, 0, z0];
  const sl = scaleFor(LIGHT.z);
  const Lp = [(LIGHT.u - 0.5) * uAspect * sl, (LIGHT.v - 0.5) * sl, LIGHT.z];
  const tl = [Lp[0] - P[0], Lp[1] - P[1], Lp[2] - P[2]];
  const dist = Math.hypot(...tl), L = tl.map((v) => v / dist);
  const ratio = dist / LIGHT.R;
  let atten = 1 / (1 + ratio * ratio);
  const win = Math.min(Math.max(1 - Math.pow(ratio / 3, 4), 0), 1);
  atten *= win * win;
  const nl = r.N[0] * L[0] + r.N[1] * L[1] + r.N[2] * L[2];
  const lambert = (1 - uWrap) * Math.max(nl, 0) + uWrap * Math.max(nl * 0.5 + 0.5, 0);
  const byte = 255 * encode(composite(ALBG * uAmbient, ALBG * LG * lambert * LIGHT.I * atten));
  return { byte, ...r, nl };
}

const modes = {
  'shipped   box + cliff        ': { relief: 'box', fade: 'cliff' },
  'A+B       box + reliefFade   ': { relief: 'box', fade: 'relief' },
  'A+B+C21   2:1 + reliefFade   ': { relief: 'c21', fade: 'relief' },
  'A+B+Ceq   1:1/8 + reliefFade ': { relief: 'eq', fade: 'relief' },
};

// control: identical dome, NO fictitious ledge -> the honest reference
function refByte(su, dome, mode) {
  const { zAt } = makeField({ kind: 'bump', h: 0, halfW: 2.5, phase: 0, dome });
  return shade(su, zAt, mode).byte;
}

const HALF = 45;
const agg = {};
for (const k of Object.keys(modes)) agg[k] = { worst: 0, hard: 0, dipMax: 0, n: 0, worstCfg: '' };

const cfgs = [];
for (const kind of ['bump', 'step'])
  for (const h of [0.03, 0.06, 0.12])
    for (const halfW of [1.5, 2.5, 4.0])
      for (const phase of [0, 0.25, 0.5, 0.75]) cfgs.push({ kind, h, halfW, phase, dome: 0.18 });

for (const cfg of cfgs) {
  const { zAt, at } = makeField(cfg);
  const x0 = at * CANVAS_W;
  for (const [name, mode] of Object.entries(modes)) {
    const bytes = [], refs = [];
    for (let d = -HALF; d <= HALF; d++) {
      const su = (x0 + d) / CANVAS_W;
      bytes.push(shade(su, zAt, mode).byte);
      refs.push(refByte(su, cfg.dome, mode));
    }
    const A = agg[name];
    // exclude the feature's own core: |d| < halfW+1 refine texels, in display px
    const core = (cfg.halfW + 1) * (CANVAS_W / RW);
    for (let i = 1; i < bytes.length; i++) {
      const d = i - HALF;
      if (Math.abs(d) < core) continue;
      const st = Math.abs(bytes[i] - bytes[i - 1]);
      if (st >= 4) A.hard++;
      if (st > A.worst) { A.worst = st; A.worstCfg = `${cfg.kind} h${cfg.h} w${cfg.halfW} p${cfg.phase} @${d}px`; }
      const dip = refs[i] - bytes[i];
      if (dip > A.dipMax) A.dipMax = dip;
      A.n++;
    }
  }
}
console.log(`e.x = ${(e[0] * CANVAS_W).toFixed(2)} display px, 3e = ${(3 * e[0] * CANVAS_W).toFixed(2)} px`);
console.log(`${cfgs.length} feature configs x ${2 * HALF} px, core excluded\n`);
console.log('mode                            worst1px  >=4LSB/px   maxDip(vs no-ledge)');
for (const [k, A] of Object.entries(agg))
  console.log(`${k}  ${A.worst.toFixed(2).padStart(7)}  ${String(A.hard).padStart(7)}   ${A.dipMax.toFixed(2).padStart(6)}      ${A.worstCfg}`);

// noise gain of each relief kernel (independent sigma per tap)
const ng = { box: Math.hypot(1 / 6, 1 / 6), c21: Math.hypot(0.2, 0.2, 0.1, 0.1), eq: Math.hypot(0.125, 0.125, 0.125, 0.125), sobel: Math.hypot(0.5, 0.5) };
console.log('\nrelief-kernel noise gain (std of dzxw per unit tap sigma):');
for (const [k, v] of Object.entries(ng)) console.log(`  ${k.padEnd(6)} ${v.toFixed(4)}`);
console.log('\nstep response (kernel applied to a broad depth step of height h), plateau/rim in units of h:');
for (const [k, p, q] of [['box', 0, 1 / 6], ['c21', 0.2, 0.1], ['eq', 0.125, 0.125]])
  console.log(`  ${k.padEnd(6)} inner |x|<1e: ${(p + q).toFixed(4)}h   outer 1e<|x|<3e: ${q.toFixed(4)}h   worst rim: ${Math.max(p, q).toFixed(4)}h`);
