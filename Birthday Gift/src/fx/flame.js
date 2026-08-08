import * as THREE from 'three';

/**
 * Candle flames.
 *
 * Camera-facing billboards driven by a small noise shader. A flame is a
 * teardrop mask with a hot white core fading through gold to a translucent
 * orange tip, distorted by two layers of scrolling noise so it never repeats
 * visibly. Additive blending, no depth write.
 *
 * This is ~30 lines of GLSL running on a handful of pixels — effectively free,
 * and far more convincing than an animated sprite sheet would be at this size.
 */

const vertexShader = `
  uniform float uTime;
  uniform float uFlicker;
  varying vec2 vUv;

  void main() {
    vUv = uv;

    // Billboard: build the quad in view space so it always faces the camera.
    vec3 pos = position;

    // Taper toward the tip and add a slow lateral lean, stronger higher up.
    float h = uv.y;
    float lean = sin(uTime * 2.3 + position.z * 12.0) * 0.055 * h * h;
    pos.x += lean;

    // Breathe the whole flame vertically.
    pos.y *= 1.0 + sin(uTime * 8.0 + position.x * 6.0) * 0.06 * uFlicker;

    vec4 mvPosition = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mvPosition.xy += pos.xy;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uFlicker;
  varying vec2 vUv;

  // Cheap hash-based value noise. Two octaves is plenty at this scale.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec2 uv = vUv;

    // Teardrop mask: narrow at the base, widest a third of the way up,
    // tapering to a point at the tip.
    float h = uv.y;
    float width = smoothstep(0.0, 0.25, h) * (1.0 - smoothstep(0.35, 1.0, h));
    width = max(width, 0.0);

    float dx = abs(uv.x - 0.5) * 2.0;
    float shape = 1.0 - smoothstep(0.0, width + 0.001, dx);

    // Two layers of scrolling noise eat into the edges to make it dance.
    float n1 = noise(vec2(uv.x * 6.0, uv.y * 4.0 - uTime * 2.2));
    float n2 = noise(vec2(uv.x * 12.0 + 3.7, uv.y * 8.0 - uTime * 3.6));
    float n = mix(n1, n2, 0.45);
    shape *= 0.72 + n * 0.5 * uFlicker;

    // Vertical fade so the tip dissolves into air.
    shape *= 1.0 - smoothstep(0.55, 1.0, h);

    if (shape < 0.01) discard;

    // Hot white core -> gold -> deep orange at the edges and tip.
    vec3 core   = vec3(1.0, 0.98, 0.85);
    vec3 mid    = vec3(1.0, 0.72, 0.22);
    vec3 outerC = vec3(0.95, 0.32, 0.05);

    float coreAmt = smoothstep(0.35, 0.95, shape) * (1.0 - smoothstep(0.0, 0.42, h));
    vec3 col = mix(outerC, mid, smoothstep(0.05, 0.55, shape));
    col = mix(col, core, coreAmt);

    gl_FragColor = vec4(col, shape * uOpacity);
  }
`;

export function createFlame() {
  const geo = new THREE.PlaneGeometry(0.09, 0.20, 1, 6);
  // Shift the pivot to the base so the flame grows upward from the wick.
  geo.translate(0, 0.10, 0);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uFlicker: { value: 1 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 10;
  // The billboard is done in the shader, so frustum culling against the
  // original geometry bounds would be wrong.
  mesh.frustumCulled = false;

  return {
    mesh,
    material: mat,
    update(time, flicker = 1) {
      mat.uniforms.uTime.value = time * 0.001;
      mat.uniforms.uFlicker.value = flicker;
    },
    setOpacity(v) {
      mat.uniforms.uOpacity.value = v;
    },
  };
}
