/**
 * WebGL2 renderer: two passes over a full-screen quad.
 *
 * Textures are kept in image space throughout (row 0 = top of frame); see the
 * note on QUAD_VS in ./shaders.js for why only the screen pass flips v.
 */

import { QUAD_VS, QUAD_VS_FLIP, REFINE_FS, MAIN_FS } from './shaders.js';
import { MAX_LIGHTS, hexToLinear } from '../state.js';

/** Cap for the depth-refine pass. Beyond this the bilateral filter buys nothing. */
const REFINE_MAX_EDGE = 768;

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true, // so "save frame" can read the canvas back
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');

    this.canvas = canvas;
    this.gl = gl;

    // Rendering to a single-channel float target needs one of these.
    this.floatTargets =
      !!gl.getExtension('EXT_color_buffer_float') ||
      !!gl.getExtension('EXT_color_buffer_half_float');

    this.quad = makeQuad(gl);
    this.refineProgram = new Program(gl, QUAD_VS, REFINE_FS);
    this.mainProgram = new Program(gl, QUAD_VS_FLIP, MAIN_FS);

    this.sourceTex = makeTexture(gl);
    this.depthTex = [makeTexture(gl), makeTexture(gl)];
    this.depthSize = [0, 0];
    this.writeSlot = 0; // the newest of the two model frames
    this.haveDepth = 0;

    this.refineTex = makeTexture(gl);
    this.refineFbo = gl.createFramebuffer();
    this.refineSize = [0, 0];

    this.sourceSize = [0, 0];
    this.aspect = 16 / 9;
    this.depthArrival = 0;
    this.depthInterval = 120;

    this._lightUvZ = new Float32Array(MAX_LIGHTS * 3);
    this._lightColor = new Float32Array(MAX_LIGHTS * 3);
    this._lightParams = new Float32Array(MAX_LIGHTS * 3);
    this._colorCache = new Map();

    gl.bindVertexArray(this.quad);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  resize(cssWidth, cssHeight, dpr) {
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  /** Upload the current source frame. Also (re)plans the refine target size. */
  uploadSource(element, width, height) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    // SRGB8_ALPHA8 means samples arrive linearised, so shading stays physical.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, element);

    if (width !== this.sourceSize[0] || height !== this.sourceSize[1]) {
      this.sourceSize = [width, height];
      this.aspect = width / height;
      this._planRefine();
    }
  }

  _planRefine() {
    const [w, h] = this.sourceSize;
    if (!w || !h) return;
    const scale = Math.min(1, REFINE_MAX_EDGE / Math.max(w, h));
    const rw = Math.max(32, Math.round(w * scale));
    const rh = Math.max(32, Math.round(h * scale));
    if (rw === this.refineSize[0] && rh === this.refineSize[1]) return;

    const gl = this.gl;
    this.refineSize = [rw, rh];
    gl.bindTexture(gl.TEXTURE_2D, this.refineTex);
    if (this.floatTargets) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, rw, rh, 0, gl.RED, gl.HALF_FLOAT, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, rw, rh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.refineFbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.refineTex,
      0,
    );
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      // Fall back to 8-bit if the float attachment was rejected after all.
      this.floatTargets = false;
      gl.bindTexture(gl.TEXTURE_2D, this.refineTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, rw, rh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        this.refineTex,
        0,
      );
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** A new model output arrived; it becomes "next" and the old next becomes "prev". */
  uploadDepth(halfFloats, width, height) {
    const gl = this.gl;
    this.writeSlot ^= 1;
    const tex = this.depthTex[this.writeSlot];
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, width, height, 0, gl.RED, gl.HALF_FLOAT, halfFloats);
    this.depthSize = [width, height];

    if (this.haveDepth === 0) {
      // Prime the other slot so the first frame does not cross-fade from nothing.
      gl.bindTexture(gl.TEXTURE_2D, this.depthTex[this.writeSlot ^ 1]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, width, height, 0, gl.RED, gl.HALF_FLOAT, halfFloats);
    }

    const now = performance.now();
    if (this.depthArrival) {
      const dt = now - this.depthArrival;
      this.depthInterval = this.depthInterval * 0.8 + Math.min(dt, 1000) * 0.2;
    }
    this.depthArrival = now;
    this.haveDepth = Math.min(this.haveDepth + 1, 2);
  }

  /** canvas uv -> source uv, as [scaleX, scaleY, offsetX, offsetY]. */
  uvXform(fit, mirror) {
    const canvasAspect = this.canvas.width / Math.max(this.canvas.height, 1);
    const a = this.aspect;
    let sx = 1;
    let sy = 1;
    let ox = 0;
    let oy = 0;

    if (fit === 'cover') {
      if (a > canvasAspect) {
        sx = canvasAspect / a;
        ox = (1 - sx) / 2;
      } else {
        sy = a / canvasAspect;
        oy = (1 - sy) / 2;
      }
    } else if (a > canvasAspect) {
      const h = canvasAspect / a;
      sy = 1 / h;
      oy = -(1 - h) / 2 / h;
    } else {
      const w = a / canvasAspect;
      sx = 1 / w;
      ox = -(1 - w) / 2 / w;
    }

    if (mirror) {
      ox = 1 - ox;
      sx = -sx;
    }
    return [sx, sy, ox, oy];
  }

  /** Inverse of uvXform, for turning a light's position back into a screen point. */
  sourceToCanvas([sx, sy, ox, oy], u, v) {
    return [(u - ox) / sx, (v - oy) / sy];
  }

  canvasToSource([sx, sy, ox, oy], x, y) {
    return [x * sx + ox, y * sy + oy];
  }

  draw(state, timeMs) {
    const gl = this.gl;
    const [cw, ch] = [this.canvas.width, this.canvas.height];

    if (!this.haveDepth || !this.sourceSize[0]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, cw, ch);
      gl.clearColor(0.04, 0.04, 0.047, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    // --- pass 1: temporal blend + edge-aware refine, into refineTex ---
    const elapsed = performance.now() - this.depthArrival;
    const ramp = clamp01(elapsed / Math.max(this.depthInterval, 16));
    const eased = ramp * ramp * (3 - 2 * ramp);
    const blend = this.haveDepth < 2 ? 1 : 1 - state.temporal * (1 - eased);

    const [rw, rh] = this.refineSize;
    // The refine target is several times finer than the model output, so a tap
    // spacing measured in refine texels lands inside a single model texel and
    // filters nothing. Scaling by the ratio makes one unit of "Smoothing" mean
    // one model sample, which is the only spacing at which the filter can reach
    // the model's own jitter — or the bilinear ramps between its samples.
    const modelScale = Math.max(1, rw / Math.max(this.depthSize[0], 1));
    const refine = this.refineProgram;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.refineFbo);
    gl.viewport(0, 0, rw, rh);
    refine.use();
    refine.tex('uDepthPrev', 0, this.depthTex[this.writeSlot ^ 1]);
    refine.tex('uDepthNext', 1, this.depthTex[this.writeSlot]);
    refine.tex('uSource', 2, this.sourceTex);
    refine.f('uMix', blend);
    refine.v2('uTexel', 1 / rw, 1 / rh);
    refine.f('uSpacing', state.spatialBlur * modelScale);
    refine.f('uEdgeSharp', state.edgeAware ? state.edgeSharpness : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // --- pass 2: relight, to the screen ---
    const p = this.mainProgram;
    const xform = this.uvXform(state.fit, state.mirror);
    this.lastXform = xform;
    const count = this._packLights(state);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);
    p.use();
    p.tex('uSource', 0, this.sourceTex);
    p.tex('uDepth', 1, this.refineTex);
    p.v4('uUvXform', xform[0], xform[1], xform[2], xform[3]);
    p.v2('uResolution', cw, ch);
    p.v2('uDepthTexel', 1 / rw, 1 / rh);
    p.f('uAspect', this.aspect);
    p.f('uTime', timeMs * 0.001);

    p.i('uLightCount', count);
    p.v3v('uLightUvZ', this._lightUvZ);
    p.v3v('uLightColor', this._lightColor);
    p.v3v('uLightParams', this._lightParams);

    p.f('uAmbient', state.ambient);
    p.f('uExposure', state.exposure);
    p.f('uWrap', state.wrap);
    p.f('uSpecular', state.specular);
    p.f('uShininess', state.shininess);
    p.f('uNormalStrength', state.normalStrength);
    // The Sobel baseline is measured against the *model's* resolution, not this
    // target's. A step narrower than one model texel differences the interior of
    // a bilinear ramp, whose derivative is constant, so every model texel became
    // a flat facet with its own normal — a grid of them across a flat wall.
    p.f('uNormalStep', Math.max(2, modelScale * 1.25));
    // Below this, a gradient is the model's frame-to-frame jitter and fp16
    // quantisation rather than geometry. A real depth edge over this baseline
    // clears it fifty-fold and a gently receding wall still clears it fivefold,
    // so the floor costs almost no genuine relief and buys back a flat wall.
    p.f('uNormalFloor', state.depthRange * 0.002);
    p.f('uGlow', state.glow);
    p.f('uBulb', state.bulb);

    p.f('uPerspective', state.perspective);
    p.f('uNear', state.near);
    p.f('uDepthRange', state.depthRange);
    p.f('uRefZ', state.near + state.depthRange * 0.5);

    p.i('uShadowSteps', state.shadows ? Math.min(32, Math.round(state.shadowSteps)) : 0);
    p.f('uShadowStrength', state.shadowStrength);
    p.f('uShadowBias', state.shadowBias);
    p.f('uShadowThickness', state.shadowThickness);
    p.f('uShadowSoftness', state.shadowSoftness);
    p.f('uShadowReach', Math.max(state.shadowReach, 1e-3));

    p.i('uView', state.view);
    p.f('uVignette', state.vignette);
    p.f('uGrain', state.grain);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  _packLights(state) {
    let n = 0;
    for (const light of state.lights) {
      if (!light.on || n >= MAX_LIGHTS) continue;
      let rgb = this._colorCache.get(light.color);
      if (!rgb) {
        rgb = hexToLinear(light.color);
        this._colorCache.set(light.color, rgb);
      }
      const o = n * 3;
      this._lightUvZ[o] = light.x;
      this._lightUvZ[o + 1] = light.y;
      this._lightUvZ[o + 2] = state.near + light.z * state.depthRange;
      this._lightColor[o] = rgb[0];
      this._lightColor[o + 1] = rgb[1];
      this._lightColor[o + 2] = rgb[2];
      this._lightParams[o] = light.intensity;
      this._lightParams[o + 1] = light.radius;
      this._lightParams[o + 2] = light.size;
      n++;
    }
    return n;
  }

  toBlob(type = 'image/png') {
    return new Promise((resolve) => this.canvas.toBlob(resolve, type, 0.95));
  }

  dispose() {
    const gl = this.gl;
    gl.deleteTexture(this.sourceTex);
    gl.deleteTexture(this.refineTex);
    for (const t of this.depthTex) gl.deleteTexture(t);
    gl.deleteFramebuffer(this.refineFbo);
    gl.deleteVertexArray(this.quad);
    this.refineProgram.dispose();
    this.mainProgram.dispose();
  }
}

/* ------------------------------------------------------------------ helpers */

class Program {
  constructor(gl, vertexSource, fragmentSource) {
    this.gl = gl;
    this.handle = link(gl, vertexSource, fragmentSource);
    this._locations = new Map();
  }

  use() {
    this.gl.useProgram(this.handle);
  }

  loc(name) {
    let found = this._locations.get(name);
    if (found === undefined) {
      found = this.gl.getUniformLocation(this.handle, name);
      this._locations.set(name, found);
    }
    return found;
  }

  f(name, x) {
    this.gl.uniform1f(this.loc(name), x);
  }

  i(name, x) {
    this.gl.uniform1i(this.loc(name), x);
  }

  v2(name, x, y) {
    this.gl.uniform2f(this.loc(name), x, y);
  }

  v4(name, x, y, z, w) {
    this.gl.uniform4f(this.loc(name), x, y, z, w);
  }

  v3v(name, array) {
    this.gl.uniform3fv(this.loc(`${name}[0]`), array);
  }

  tex(name, unit, texture) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.loc(name), unit);
  }

  dispose() {
    this.gl.deleteProgram(this.handle);
  }
}

function link(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Shader link failed: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? '';
    const line = Number(/:(\d+):/.exec(log)?.[1] ?? 0);
    const context = source
      .split('\n')
      .slice(Math.max(0, line - 3), line + 2)
      .join('\n');
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}\n--- near ---\n${context}`);
  }
  return shader;
}

function makeQuad(gl) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return vao;
}

function makeTexture(gl) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
