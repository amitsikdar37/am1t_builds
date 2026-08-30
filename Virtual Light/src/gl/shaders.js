/**
 * GLSL for the two passes.
 *
 * Pass 1 (refine): temporally interpolate the last two model outputs and run a
 * cross-bilateral filter guided by source luma, so depth edges snap to real
 * image edges instead of the model's blurry silhouette.
 *
 * Pass 2 (main): treat the depth map as a height field, unproject it into a
 * view-space point cloud, and shade it with point lights that live at an
 * arbitrary depth — which is what lets a light sit behind a shoulder.
 *
 * Both passes work in *source UV space* (0..1 across the camera frame). The
 * canvas letterbox/mirror transform is applied once, in the main pass.
 */

/**
 * Identity full-screen quad, used for the offscreen passes.
 *
 * Textures here are stored image-space (row 0 = top of frame), which is what
 * both `texImage2D` from a <video> and the worker's row-major depth buffer give
 * us. An FBO pass writes framebuffer row 0 first, and row 0 is sampled at v=0,
 * so an *unflipped* vUv keeps the convention intact through the pass.
 */
export const QUAD_VS = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;
out vec2 vUv;

void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

/**
 * Same quad, but for the pass that draws to the screen — where y runs the other
 * way, so v has to be flipped to keep "v = 0" meaning the top of the frame.
 */
export const QUAD_VS_FLIP = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;
out vec2 vUv;

void main() {
  vUv = vec2(aPos.x, -aPos.y) * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const REFINE_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uDepthPrev;
uniform sampler2D uDepthNext;
uniform sampler2D uSource;

uniform float uMix;        // 0 = previous model frame, 1 = newest
uniform float uSpacing;    // tap spacing, in refine texels — see renderer.js
uniform vec2  uTexel;      // 1 / refine resolution
uniform float uEdgeSharp;  // <= 0 leaves a plain spatial blur

float rawDepth(vec2 uv) {
  vec2 c = clamp(uv, vec2(0.0), vec2(1.0));
  float prev = texture(uDepthPrev, c).r;
  float next = texture(uDepthNext, c).r;
  // Motion-adaptive temporal mix. A flat lerp of two model frames denoises a
  // still scene, but across a moving silhouette prev and next hold different
  // surfaces (subject vs background), and averaging them invents a mid-depth
  // that belongs to neither — a ghost ring that the relight pass then unprojects
  // and lights as a real ledge, trailing the motion as a dark fringe. Where the
  // two frames disagree by more than sensor jitter the subject has moved, so we
  // fade the mix toward the newest frame: smoothing only ever averages frames
  // that match, and moving edges snap clean. Still pixels (motion ~ 0) keep the
  // full uMix, so this is identity on a static scene.
  float motion = abs(next - prev);
  float m = mix(uMix, 1.0, smoothstep(0.06, 0.20, motion));
  return mix(prev, next, m);
}

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

/**
 * Radius-2 diamond, 13 taps. The 20 percent of a full 5x5 that this drops sits
 * in the corners, where the spatial gaussian has already fallen to 0.06.
 *
 * The spacing matters more than the kernel. The model output is several times
 * coarser than this target, so a kernel one refine-texel wide never spanned two
 * real depth samples: it left the model's jitter untouched and, worse, left the
 * bilinear ramp between samples untouched. A bilinear ramp has a discontinuous
 * derivative, so differencing it yields a grid of flat facets, one per model
 * texel — which is precisely what reads as moulded plastic across a wall that
 * is in fact flat. Spacing the taps a model texel apart is what dissolves them.
 */
void main() {
  float d0 = rawDepth(vUv);

  if (uSpacing <= 0.0) {
    outColor = vec4(d0, 0.0, 0.0, 1.0);
    return;
  }

  float g0 = luma(texture(uSource, vUv).rgb);
  float sum = 0.0;
  float wsum = 0.0;

  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      float r2 = float(i * i + j * j);
      if (r2 > 4.5) continue;

      vec2 uv = vUv + vec2(float(i), float(j)) * uTexel * uSpacing;
      float w = exp(-r2 * 0.36); // sigma ~1.2 taps
      float dt = rawDepth(uv);

      if (uEdgeSharp > 0.0) {
        // Gaussian in the luma difference, not an exponential in its magnitude.
        // The exponential form weighted a 5 percent texture variation at 0.64
        // and a real silhouette at 0.07 — barely selective — so wall texture
        // printed itself into the depth field and from there into the shading.
        // Squaring flattens the response to fine texture and steepens it at an
        // edge, so texture averages away while a silhouette still stops the
        // filter dead.
        //
        // Gated by depth agreement, because luma on its own cannot tell a
        // silhouette from a dark eyebrow. uSource is uploaded as SRGB8_ALPHA8, so
        // these are linear samples and the differences are larger than they look:
        // a spectacle rim, a brow, a beard, even lit against shaded skin on one
        // continuous cheek all clear the cutoff, while the genuine face-against-
        // wall silhouette barely does. The filter was cutting itself off at
        // precisely the features the eye lands on, collapsing to under a third of
        // its kernel and handing the shading pass jitter it had never averaged —
        // which measured worse on a smooth forehead than no filter at all.
        // Requiring the depths to disagree too restores the kernel to 96 percent
        // on skin and costs the silhouette about one percent of its sharpness,
        // since there the depths disagree emphatically and the gate stays shut.
        // On its own this barely moves the worst step; what it removes is their
        // density, two thirds of the pixels carrying a visible hard step.
        float dl = (luma(texture(uSource, clamp(uv, vec2(0.0), vec2(1.0))).rgb) - g0) * uEdgeSharp;
        dl *= smoothstep(0.05, 0.12, abs(dt - d0));
        w *= exp(-dl * dl);
      }

      sum += dt * w;
      wsum += w;
    }
  }

  outColor = vec4(sum / max(wsum, 1e-5), 0.0, 0.0, 1.0);
}
`;

export const MAIN_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

#define MAX_LIGHTS 4
#define MAX_SHADOW_STEPS 32

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uSource;     // SRGB8_ALPHA8, so samples come back linear
uniform sampler2D uDepth;      // refined depth, 1.0 = nearest the lens

uniform vec4  uUvXform;        // canvas uv -> source uv : xy scale, zw offset
uniform vec2  uResolution;     // canvas pixels
uniform vec2  uDepthTexel;     // 1 / refine resolution
uniform float uAspect;         // source width / height
uniform float uTime;

uniform int   uLightCount;
uniform vec3  uLightUvZ[MAX_LIGHTS];    // source uv + world depth
uniform vec3  uLightColor[MAX_LIGHTS];  // linear rgb
uniform vec3  uLightParams[MAX_LIGHTS]; // intensity, falloff radius, bulb size

uniform float uAmbient;
uniform float uExposure;
uniform float uWrap;
uniform float uSpecular;
uniform float uShininess;
uniform float uNormalStrength;
uniform float uNormalStep;
uniform float uNormalFloor;    // gradient magnitude treated as sensor noise
uniform float uGlow;
uniform float uBulb;

uniform float uPerspective;
uniform float uNear;
uniform float uDepthRange;
uniform float uRefZ;

uniform int   uShadowSteps;    // 0 disables shadowing entirely
uniform float uShadowStrength;
uniform float uShadowBias;
uniform float uShadowThickness;
uniform float uShadowSoftness; // sampled light radius, in screen-height units
uniform float uShadowReach;    // how far behind an occluder its shadow survives

uniform int   uView;           // 0 composite · 1 depth · 2 normals · 3 shadow · 4 source
uniform float uVignette;
uniform float uGrain;

vec2 toSource(vec2 uv) {
  return uv * uUvXform.xy + uUvXform.zw;
}

float depthAt(vec2 suv) {
  return texture(uDepth, clamp(suv, vec2(0.0), vec2(1.0))).r;
}

// Model output is relative inverse depth (1 = near), so flip it into a
// monotonically-increasing "distance from the lens" in arbitrary world units.
float zAt(vec2 suv) {
  return uNear + (1.0 - depthAt(suv)) * uDepthRange;
}

// 0 = orthographic (a light keeps its screen position at any depth),
// 1 = full perspective (things spread out as they recede).
float scaleFor(float z) {
  return mix(1.0, z / uRefZ, uPerspective);
}

vec3 unproject(vec2 suv, float z) {
  vec2 c = (suv - 0.5) * vec2(uAspect, 1.0);
  return vec3(c * scaleFor(z), z);
}

vec2 project(vec3 p) {
  vec2 c = p.xy / max(scaleFor(p.z), 1e-4);
  return c / vec2(uAspect, 1.0) + 0.5;
}

vec3 posAt(vec2 suv) {
  return unproject(suv, zAt(suv));
}

/**
 * A gradient smaller than the depth map's own noise is not geometry. Half-float
 * depth quantises at roughly 5e-4, and the model adds its own jitter on top, so
 * a flat wall still yields a non-zero difference between neighbours — which
 * uNormalStrength then amplifies into visible orange-peel speckle. Subtracting
 * a floor leaves real slopes almost untouched (they clear it by an order of
 * magnitude) while flat stays flat.
 */
float deaden(float d) {
  return sign(d) * max(abs(d) - uNormalFloor, 0.0);
}

/**
 * Surface normal from the depth gradient, plus how much that gradient should be
 * believed.
 *
 * The second output is the important one. A height field cannot represent
 * occlusion: where a silhouette meets the wall behind it, depth steps by
 * everything separating the two, and a Sobel reads that step as a near-vertical
 * face joining them — a face that is not there. Shading it draws a dark outline
 * around every silhouette, worst on hands and hair, because an invented vertical
 * face is edge-on to almost any light. The same invented face is what let the
 * shadow march find an occluder one texel from its own receiver and print a hard
 * line along the boundary.
 *
 * Detecting it needs more care than a threshold on the gradient. See the
 * occlusion-boundary section of the README for why the obvious tests fail and
 * where the constants below come from.
 *
 * The third output is the raw depth gradient in uv units, which the shadow march
 * needs in order to extrapolate this surface's own tangent plane and so avoid
 * shadowing it with itself.
 */
vec3 normalAt(vec2 suv, out float cliff, out vec2 grad) {
  vec2 e = uDepthTexel * uNormalStep;
  vec2 ex = vec2(e.x, 0.0);
  vec2 ey = vec2(0.0, e.y);

  // Sobel, not a bare central difference. Two taps per axis difference the
  // model's jitter exactly as readily as they difference its geometry; the 3x3
  // form weighs three rows against three rows, so uncorrelated noise falls by
  // about the square root of the tap count while a real slope is untouched. It
  // costs six extra fetches from a texture already in cache.
  float tl = zAt(suv + vec2(-e.x,  e.y));
  float tc = zAt(suv + ey);
  float tr = zAt(suv + vec2( e.x,  e.y));
  float ml = zAt(suv - ex);
  float mr = zAt(suv + ex);
  float bl = zAt(suv + vec2(-e.x, -e.y));
  float bc = zAt(suv - ey);
  float br = zAt(suv + vec2( e.x, -e.y));

  float z0 = zAt(suv);
  float dzx = deaden(((tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl)) * 0.25) * 0.5;
  float dzy = deaden(((tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br)) * 0.25) * 0.5;

  // Measured against the world extent of the Sobel footprint, so this is a real
  // slope and not a number that shifts with resolution, depth or aspect.
  vec2 world = vec2(e.x * uAspect, e.y) * scaleFor(z0);
  float slope = length(vec2(dzx / max(world.x, 1e-6), dzy / max(world.y, 1e-6)));

  // dzx is the half-step central difference over e.x, so this is dz/duv.
  grad = vec2(dzx / max(e.x, 1e-6), dzy / max(e.y, 1e-6));

  // The flag has to fire on the boundary's skirt as well as its crest, and out
  // there the slope has fallen back to where ordinary curvature lives. What still
  // separates them is *where* the steepness sits rather than how much of it there
  // is: a step has one steep narrow window at its edge and flat ground either
  // side, while a curved surface reads much the same wherever the window is put.
  // So the same window is re-measured a little to each side and the steepest
  // reading wins. Four taps, and the two inner ones are already in hand.
  float sxp = zAt(suv + ex * 3.0), sxn = zAt(suv - ex * 3.0);
  float syp = zAt(suv + ey * 3.0), syn = zAt(suv - ey * 3.0);
  vec4 near = vec4(sxp - mr, ml - sxn, syp - tc, bc - syn);
  near = max(abs(near) - uNormalFloor, vec4(0.0)) / max(2.0 * world.xxyy, vec4(1e-6));
  float grade = max(slope, max(max(near.x, near.y), max(near.z, near.w)));
  // Measured, not chosen: a dome swinging a sixth of the depth range tops out at
  // 4.1, a subject a fourteenth of the range off the wall bottoms out at 5.8, and
  // the knee sits in that gap. Curvature was tried here too — a Laplacian folded
  // into the same grade — and measured worse: on a ragged feature it clears the
  // knee at some texels and not the neighbours, so the flat-normal patch it forces
  // is itself ragged and tears the relief harder than leaving it alone. The torn
  // fringe on hair and glasses is answered by the wider baseline the relief normal
  // now reads from, below, not by widening what this flag catches.
  cliff = smoothstep(4.2, 5.4, grade);

  // The relief normal reads from the ±3 taps, not the ±1 Sobel. A real slope is
  // coherent across that span so relief is untouched, while per-texel depth noise —
  // which the edge-aware refine preserves along a thin dark feature's own luma edge —
  // is uncorrelated across it and averages down. Left in, that noise reverses the
  // normal every texel and, on dark albedo, reads as a torn black fringe on hair and
  // glasses; it never shifts the mean, so it hides from any brightness test. Free:
  // the taps are already in hand, and the narrow gradient still feeds the slope, the
  // flag and the shadow tangent. See the relief-normal note in the README.
  float dzxw = deaden((sxp - sxn) * (1.0 / 6.0));
  float dzyw = deaden((syp - syn) * (1.0 / 6.0));
  vec3 px = unproject(suv + ex, z0 + dzxw) - unproject(suv - ex, z0 - dzxw);
  vec3 py = unproject(suv + ey, z0 + dzyw) - unproject(suv - ey, z0 - dzyw);
  // Exaggerating the depth gradient tilts the normal further, which reads as
  // more relief without touching the underlying depth values.
  px.z *= uNormalStrength;
  py.z *= uNormalStrength;
  vec3 n = cross(px, py);
  float len = length(n);
  if (len < 1e-9) return vec3(0.0, 0.0, -1.0);
  n /= len;
  n = n.z > 0.0 ? -n : n; // always face the camera, which sits at the origin
  // At an occlusion boundary the honest normal is the one that invents no
  // shading of its own: straight back at the lens.
  return normalize(mix(n, vec3(0.0, 0.0, -1.0), cliff));
}

/**
 * How much solid matter to assume sits behind a visible surface, in the depth
 * units this shader works in.
 *
 * The depth map is disparity and zAt() is an affine remap of it, so equal steps
 * in z are not equal steps in metres. A fixed real thickness t behind a surface
 * at disparity p lands at disparity p / (1 + t * p) — a step of
 * t * p^2 / (1 + t * p), quadratic in the surface's own disparity. One global
 * slab therefore means something different for every object in the frame, which
 * is the whole bug: a person half a metre from the lens and the far wall behind
 * them were credited with the same depth of matter, so the wall kept catching a
 * shadow as though it were pressed against their back.
 */
float slabFor(float disparity) {
  return uShadowThickness * max(disparity * disparity, 0.05);
}

/** One occlusion test: is the ray at depth sz passing behind the surface at su? */
float shadowTap(vec2 su, float sz, float pz, float bias, vec2 dsu, vec2 grad) {
  float d = depthAt(su);
  float zo = uNear + (1.0 - d) * uDepthRange;
  float gap = sz - zo;
  if (gap <= bias) return 0.0;

  float slab = slabFor(d);
  float w = 1.0 - smoothstep(slab * 0.35, slab, gap - bias);

  // Is this a different surface, or is it the receiver's own?
  //
  // A convex body cannot shadow itself and a flat wall cannot shadow itself: on
  // both, the only unlit part is the part turned away from the light, which the
  // diffuse term already handles. The march does not know that. It leaves the
  // surface, and because the surface curves or recedes underneath it, the ray
  // passes behind the very geometry it started on and every test above fires. A
  // face then prints its own nose, brow and cheek onto itself as dark patches,
  // worst when the light sits inside or just behind the subject's own depth span,
  // where the rays to it fan out across the surface instead of leaving it.
  //
  // What settles it is the receiver's own tangent plane, extrapolated to wherever
  // the ray is looking. A convex surface always falls *behind* that plane and a
  // flat one lies exactly on it, so neither can rise in front of it — while a hand
  // held in front of a face clears it by a large margin. So the claim is gated on
  // how far the occluder rises above the plane rather than above a single depth,
  // and self-shadowing stops being representable. The extrapolation is clamped
  // because the gradient at a silhouette is near-vertical and would otherwise
  // throw the plane out of the scene.
  float plane = pz + clamp(dot(grad, dsu), -0.5 * uDepthRange, 0.5 * uDepthRange);
  w *= smoothstep(bias, bias * 6.0, plane - zo);

  // How much empty space separates the surface catching this shadow from the
  // thing casting it.
  //
  // This term is what the march cannot discover on its own. A ray from a distant
  // receiver to a nearby light sweeps through every depth in between, so it is
  // *always* momentarily just behind any silhouette that stands between the two
  // on screen — the slab test above therefore fires whether the occluder is
  // touching the receiver or metres clear of it, and a person standing in an open
  // kitchen gets a wall-shaped shadow printed on shelving three metres behind
  // them. Separation only exists in the occluder's own depth, not in the ray's.
  //
  // Beyond a short range the claim is also unfounded: a depth map is a shell, and
  // it records where surfaces are while saying nothing about the volume behind
  // them. Fading the claim out with separation is measured against uDepthRange,
  // which the worker re-normalises to the scene's own 1st..99th percentile spread
  // every frame — so a fraction of it means "a large share of the depth actually
  // visible here" in a cupboard or across a room alike.
  float sep = (pz - zo) / max(uDepthRange, 1e-4);
  return w * (1.0 - smoothstep(uShadowReach, uShadowReach * 3.2, sep));
}

/**
 * Screen-space soft shadow: walk from the shaded point toward the light and look
 * for a visible surface sitting in front of the ray.
 *
 * A single depth layer has no idea how thick anything is, so occluders are
 * treated as a finite slab, sized per-occluder by slabFor() — otherwise every
 * pixel behind the subject falls into permanent darkness.
 *
 * The march is filtered laterally by a radius that grows with *where* along the
 * ray the occluder turned up. A hit a fraction f of the way to the light sits
 * f * d in front of the receiver and (1 - f) * d behind the light, so a source
 * of radius R throws a penumbra of R * f / (1 - f). That one ratio separates a
 * contact shadow from a shadow thrown across an empty room, which is otherwise
 * indistinguishable in a depth map — the silhouette is identical either way.
 * A bottle standing against a wall keeps a hard edge; a person with three
 * metres of air behind them spreads until the umbra is gone.
 */
float shadowFactor(vec3 P, vec3 N, vec3 Lp, vec2 suv, vec2 grad, float jitter, float phase) {
  if (uShadowSteps <= 0) return 1.0;

  vec3 delta = Lp - P;
  float dlen = length(delta);
  if (dlen < 1e-5) return 1.0;

  // A safety net under the tangent-plane test in shadowTap: where the gradient is
  // itself unreliable the plane is too, and at grazing incidence the ray runs
  // nearly parallel to the surface it started on, so gap sits either side of the
  // threshold and crosses it wherever depth noise happens to land.
  float ndl = clamp(dot(N, delta / dlen), 0.0, 1.0);
  float slope = min(sqrt(1.0 - ndl * ndl) / max(ndl, 0.12), 4.0);
  float bias = uShadowBias * (1.0 + slope);

  float occ = 0.0;
  float prev = 0.0;
  for (int i = 0; i < MAX_SHADOW_STEPS; i++) {
    if (i >= uShadowSteps) break;
    float f = (float(i) + 0.5 + jitter) / float(uShadowSteps);
    vec3 s = P + delta * f;

    float w = 0.0;
    if (s.z > uNear * 0.5) {
      vec2 su = project(s);
      if (su.x >= 0.0 && su.x <= 1.0 && su.y >= 0.0 && su.y <= 1.0) {
        float spread = min(uShadowSoftness * f / max(1.0 - f, 0.06), 0.14);
        w = shadowTap(su, s.z, P.z, bias, su - suv, grad);

        if (spread > uDepthTexel.y) {
          // Centre plus a per-pixel-rotated triangle. Three directions cover the
          // plane closely enough that a penumbra reads as a gradient instead of as
          // rings, and rotating the triangle per pixel turns what quantisation is
          // left into dither. As the disc widens the centre tap loses its privilege
          // and the four become a plain coverage average — which is what makes a
          // shadow cast at long range dissolve rather than merely blur, since a
          // lone hit in the middle of an open penumbra is a quarter of the light,
          // not all of it.
          float cw = mix(0.4, 0.25, clamp(spread * 7.0, 0.0, 1.0));
          float rw = (1.0 - cw) * 0.3333333;
          w *= cw;
          for (int t = 0; t < 3; t++) {
            float a = phase + float(t) * 2.0943951;
            vec2 o = vec2(cos(a) / uAspect, sin(a)) * spread;
            w += rw * shadowTap(su + o, s.z, P.z, bias, su + o - suv, grad);
          }
        }
      }
    }

    // Average each adjacent pair before taking the maximum, rather than maximising
    // the raw steps. A plain max over the march is a maximum over noisy samples:
    // no smoothing anywhere in it, every pixel free to pick whichever of its own
    // dithered steps reads darkest, and since jitter and phase are drawn per pixel
    // neighbours pick different ones. Times uShadowStrength that is exactly the
    // hard-edged dark patch — the max was not finding the shadow, it was
    // rectifying the dither into structure. It did this even on a depth field with
    // no jitter in it at all, which is what took four attempts to see.
    //
    // Pairing works because a real occluder is coherent along the ray while noise
    // is not: slabFor gives it thickness so consecutive steps agree and their mean
    // survives, while an isolated spurious step is halved. Measured on lit skin on
    // real hardware, against this same shader with the plain max: worst
    // single-pixel step 22 levels down to 10, pixels carrying a visible hard step
    // 1.86 percent down to 0.28, and a genuine cast shadow keeps 76 percent of its
    // depth — the one real cost, and uShadowStrength is a live slider.
    if (i > 0) occ = max(occ, (w + prev) * 0.5);
    prev = w;
  }
  return clamp(1.0 - occ * uShadowStrength, 0.0, 1.0);
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/**
 * Interleaved gradient noise. A plain hash gives every pixel an independent
 * value, so a dithered penumbra comes out as salt-and-pepper — the grain that
 * used to fringe every silhouette. This spreads successive values across a
 * regular lattice instead, so neighbouring pixels take *different* offsets by
 * construction and the same number of samples resolves a smooth gradient.
 */
float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

/** Linear -> sRGB. The source texture is sRGB-decoded on sample, so all of the
 *  shading above happens in linear light and has to be re-encoded here. */
vec3 encode(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

/**
 * Composite the virtual light onto the captured frame.
 *
 * The knee is the unlit pixel itself, so with nothing added the result is the
 * frame bit-for-bit: encode() is the exact inverse of the texture unit's sRGB
 * decode, and this expression collapses to the base when add is zero. Added
 * light then climbs through the remaining headroom with unit slope at the knee
 * (so dim light behaves like a plain add and mids are untouched) and eases into
 * a clean white clip once it reaches W*head. A bright bulb therefore actually
 * blows to white where it is strong, the way a real light does.
 *
 * The earlier form add/(add+head) asymptoted toward 1.0 but never reached it, so
 * the brightest pixels topped out around 220-235 and the whole upper range was
 * squeezed below the ceiling: highlights stayed soft, nothing clipped, and the
 * lit subject sat in a flat compressed band -- the "punch-less, plastic" read.
 * A global operator like 1-exp(-c) cannot fix this either: it compresses the
 * whole picture to make room for one bright corner, and that uniform loss of
 * contrast and saturation is itself a plastic film. This stays per-pixel in
 * headroom units, so blacks and mids are left exactly where they were.
 */
vec3 composite(vec3 base, vec3 add) {
  base = clamp(base, vec3(0.0), vec3(1.0));
  add = max(add, vec3(0.0));
  vec3 head = max(vec3(1.0) - base, vec3(1e-5));
  const float W = 2.0;              // add = W*head blows the pixel clean to white
  vec3 t = add / head;             // added light, in units of remaining headroom
  vec3 s = t * (1.0 + t / (W * W)) / (1.0 + t);
  return base + head * min(s, vec3(1.0));
}

/** Compact Turbo approximation, for the depth debug view. */
vec3 turbo(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 a = vec3(0.1357, 0.0914, 0.1067);
  vec3 b = vec3(4.5974, 2.1856, 12.5925);
  vec3 c = vec3(-42.3277, 4.8052, -60.1097);
  vec3 d = vec3(130.5887, -14.0195, 109.0745);
  vec3 e = vec3(-150.5666, 4.2709, -88.5060);
  vec3 f = vec3(58.1375, 2.8210, 26.8183);
  return clamp(a + t * (b + t * (c + t * (d + t * (e + t * f)))), 0.0, 1.0);
}

void main() {
  vec2 suv = toSource(vUv);
  if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec3 albedo = texture(uSource, suv).rgb;
  if (uView == 4) {
    outColor = vec4(encode(albedo), 1.0);
    return;
  }
  if (uView == 1) {
    // Turbo already lands in display space, so it skips the encode step.
    outColor = vec4(turbo(depthAt(suv)), 1.0);
    return;
  }

  float cliff;
  vec2 grad;
  vec3 N = normalAt(suv, cliff, grad);
  if (uView == 2) {
    outColor = vec4(N * vec3(0.5, -0.5, -0.5) + 0.5, 1.0);
    return;
  }

  vec3 P = posAt(suv);
  vec3 V = normalize(-P);
  // One dither value drives both the step offset and the rotation of the lateral
  // filter, decorrelated by a quarter turn of the lattice so the two do not line
  // up into a visible weave.
  vec2 pix = vUv * uResolution;
  float dither = ign(pix + floor(uTime * 60.0) * 5.588238);
  float jitter = dither - 0.5;
  float phase = ign(pix.yx + 21.0) * 6.2831853;

  vec3 diffuse = vec3(0.0);
  vec3 spec = vec3(0.0);
  vec3 emissive = vec3(0.0);
  float minShadow = 1.0;

  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;

    vec3 col = uLightColor[i];
    float intensity = uLightParams[i].x;
    float radius = max(uLightParams[i].y, 1e-3);
    float bulbSize = uLightParams[i].z;

    vec3 Lp = unproject(uLightUvZ[i].xy, uLightUvZ[i].z);
    vec3 toLight = Lp - P;
    float dist = length(toLight);
    vec3 L = dist > 1e-5 ? toLight / dist : vec3(0.0, 0.0, -1.0);

    float ratio = dist / radius;
    // Windowed inverse-square. The 1/(1+r^2) term is the physical falloff; the
    // window drives it to exactly zero at three radii. Without it the tail never
    // reaches zero and a single light lifts the entire frame by a fifth of a
    // stop, which looks like a haze over the image rather than a lamp in a room.
    float atten = 1.0 / (1.0 + ratio * ratio);
    float win = clamp(1.0 - pow(ratio * 0.3333333, 4.0), 0.0, 1.0);
    atten *= win * win;

    float nl = dot(N, L);
    float lambert = mix(max(nl, 0.0), max(nl * 0.5 + 0.5, 0.0), uWrap);

    float sh = shadowFactor(P, N, Lp, suv, grad, jitter, phase);
    // A pixel straddling an occlusion boundary has no trustworthy depth, and the
    // march can find its own silhouette one texel away and shadow the pixel with
    // it. Withdrawing the claim there costs a couple of pixels of contact shadow
    // and removes the hard line that used to trace every edge.
    sh = mix(sh, 1.0, cliff);
    minShadow = min(minShadow, sh);

    float energy = intensity * atten * sh;
    diffuse += col * lambert * energy;

    vec3 H = normalize(L + V);
    spec += col * pow(max(dot(N, H), 0.0), uShininess) * uSpecular * energy;

    // The bulb, depth-sorted against the scene: it shows only where the visible
    // surface is farther from the lens than the light is. The disc can afford a
    // hard compare because it is a few pixels across; the halo cannot. The halo
    // spreads over much of the frame, so testing it hard against a noisy
    // low-resolution depth map cuts it with a jagged, silhouette-shaped edge —
    // a scalloped outline that traces every wobble in the model output, which is
    // the other half of what reads as a plastic overlay. Fading the halo across
    // a slab as wide as the depth map's own uncertainty removes that edge and
    // still hides the halo behind a subject that is genuinely in front of it.
    vec2 lsuv = project(Lp);
    float r = length((suv - lsuv) * vec2(uAspect, 1.0)) /
              max(bulbSize * scaleFor(Lp.z), 1e-4);
    float gap = P.z - Lp.z;
    float disc = 1.0 - smoothstep(0.8, 1.05, r);
    float discVis = smoothstep(-0.015, 0.015, gap);
    float haloVis = smoothstep(-0.12 * uDepthRange, 0.12 * uDepthRange, gap);
    emissive += mix(col, vec3(1.0), 0.7) * disc * uBulb * discVis +
                col * exp(-r * r * 0.45) * uGlow * 0.8 * haloVis;
  }

  if (uView == 3) {
    outColor = vec4(vec3(minShadow), 1.0);
    return;
  }

  // The frame is already a photograph of the scene under whatever light the room
  // has, so the virtual light *adds* irradiance rather than standing in for it:
  // uAmbient = 1 means "the room as it is", and diffuse is brightness relative
  // to that. Nothing here can darken a pixel below what the camera captured,
  // which is the whole point — shadows read as light withheld, not paint added.
  //
  // Dimming the room is a plain multiply, so already-dark content goes cleanly to
  // black: hair at 0.01 linear times a 0.16 room is 0.0016, which encodes to ~5 of
  // 255. That is the point. The reference look is a real light in a dark room — a
  // large clean-black lobe with the lit subject riding on top — and crushing unlit
  // darks to black is what produces it. An earlier build lifted this floor with a
  // (1 - albedo) taper to "keep shadow detail visible," but that parked every dark
  // pixel around 26-41 of 255 — a flat milky grey band across the whole frame that
  // is exactly the "plastic film / dark-patch" complaint. So there is no floor:
  // unlit content is albedo * ambient and is meant to fall to black off the light.
  vec3 base = albedo * uAmbient * uExposure;
  vec3 add = (albedo * diffuse + spec + emissive) * uExposure;
  vec3 lit = composite(base, add);

  vec2 vd = (vUv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  lit *= mix(1.0, smoothstep(1.15, 0.3, length(vd)), uVignette);

  vec3 srgb = encode(lit);
  srgb += (hash(vUv * uResolution + uTime * 13.7) - 0.5) * uGrain * 0.08;
  outColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
}
`;

