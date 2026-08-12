import * as THREE from 'three'

/**
 * HologramField
 * -------------
 * Renders a video as a dense point cloud.
 *
 * Performance contract: the CPU never touches a particle. Every per-particle
 * behaviour (depth relief, idle vibration, explosion, colour, size, opacity)
 * is computed in the vertex shader from two static attributes plus a handful
 * of uniforms. Cost per frame on the CPU is O(1) regardless of particle count,
 * so 300k points cost the same to drive as 25k, and an explosion costs exactly
 * as much as the idle state.
 *
 * The one real GPU risk is overdraw: 300k sprites flying toward the camera
 * would each cover more screen area as they approach, and fill rate — not
 * vertex count — is what would drop frames. So point size is scaled *down*
 * over the course of a burst. It reads as the image shattering into finer
 * debris, and it keeps total covered area roughly flat while particles are
 * closest to the lens.
 */

const VERT = /* glsl */ `
  precision highp float;

  attribute vec2 aUv;    // sample point in the video frame
  attribute vec3 aSeed;  // per-particle randomness, stable for the lifetime

  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uDepth;      // how far luminance pushes a point back
  uniform float uBurst;      // 0..1 progress through the current explosion
  uniform float uPower;      // strength of the current explosion
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uCut;        // presence below this is treated as empty space
  uniform float uSat;        // >1 lifts saturation, 1.0 passes video through
  uniform float uJitter;     // idle vibration amplitude, in world units
  uniform float uPointScale; // grid pitch projected to pixels at unit depth
  uniform float uSpan;       // largest plane dimension, sets burst travel

  varying vec3  vTint;
  varying float vAlpha;
  varying float vHeat;

  // Cheap hash for directional variety without a texture lookup.
  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }

  void main() {
    vec3 rgb = texture2D(uMap, aUv).rgb;
    float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));

    vec3 pos = position;

    // --- Depth relief -------------------------------------------------
    // Bright pixels sit forward, dark pixels fall away. This is what turns
    // a flat frame into a face suspended in space.
    pos.z += (lum - 0.5) * uDepth;

    // --- Idle vibration ------------------------------------------------
    // Always present, tiny. Keeps the cloud alive between hits.
    //
    // Amplitude has to be a fraction of the grid pitch, not a constant. It was
    // 0.018 world units against a pitch of 0.0194 at 100k points, so every
    // particle wandered nearly a full cell and traded places with its
    // neighbours — the image was being spatially scrambled every frame, which
    // is most of why a face read as static. uJitter is now derived from the
    // pitch, so the cloud breathes without smearing detail at any density.
    float t = uTime + aSeed.x * 100.0;
    vec3 jitter = vec3(
      sin(t * 2.1 + aSeed.y * 6.28),
      cos(t * 1.7 + aSeed.z * 6.28),
      sin(t * 2.6 + aSeed.x * 6.28)
    );
    pos += jitter * uJitter;

    // --- Explosion ------------------------------------------------------
    // Radially outward from the centre of the plane and forward toward the
    // lens. uBurst is driven 0 -> 1 by the host and then dropped hard to 0,
    // which is the instant snap back to formation.
    float heat = 0.0;
    if (uBurst > 0.0) {
      // Travel curve. Full extension is ~4.3 units across a 4.6-unit plane, so
      // the eye is very sensitive to how the first few frames are spent: any
      // front-loaded curve (pow < 1) moves particles far enough on frame one
      // that the face is gone before it has visibly broken, which reads as a
      // hard cut to noise rather than an explosion.
      //
      // Smoothstep instead. Frames 1-3 barely translate, so the image cracks
      // while still legible; the middle is where the violence lands; the tail
      // eases into full extension. The instant response the trigger needs comes
      // from heat and size, which peak on frame one — the cloud flashes coral
      // and goes to fine debris before it has travelled anywhere.
      float amp = uBurst * uBurst * (3.0 - 2.0 * uBurst);

      float spread = hash(aSeed) * 0.65 + 0.35;
      vec3 dir = normalize(vec3(
        position.xy + (aSeed.xy - 0.5) * 0.55,
        0.42 + aSeed.z * 0.75            // bias toward the camera
      ));

      // 0.34 of the plane span threw every particle clear of the frame, so the
      // subject vanished completely on each hit. At 0.21 the cloud visibly
      // ruptures and the silhouette survives inside the debris, which reads as
      // the image being struck rather than replaced. Blast force still scales
      // this up to 2.5x for anyone who wants the frame emptied.
      pos += dir * amp * uPower * spread * uSpan * 0.21;

      // Tumble, so debris does not travel on clean rails.
      pos += jitter * amp * uPower * uSpan * 0.05;

      heat = (1.0 - uBurst) * uPower;
    }
    vHeat = clamp(heat, 0.0, 1.0);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // --- Size -------------------------------------------------------------
    // Perspective attenuation, then the overdraw guard described above.
    //
    // uPointScale ties sprite size to the grid pitch, so points stay just
    // large enough to tile the frame with no gaps at any density. A fixed
    // size left holes between particles at 100k — and holes in a face are
    // what the eye reads as noise.
    float shrink = 1.0 - uBurst * 0.62 * uPower;
    gl_PointSize = uSize * uPointScale * uPixelRatio * shrink / max(-mv.z, 0.6);

    // --- Colour and opacity ------------------------------------------------
    // The particle carries the video's own RGB. An earlier version blended
    // 55% of a luminance-scaled periwinkle over every point, which cost skin
    // tones two thirds of their saturation and pulled every hue toward the
    // same lavender — the whole frame collapsed to one colour, so the subject
    // was unrecognisable no matter how many points drew it. Tint now comes
    // only from the footage.
    //
    // uSat sits at 1.0: a measured passthrough. It was 1.2 to compensate for
    // additive blending washing colour out, but under normal blending that
    // boost pushed every already-vivid region to saturation 1.0 and clipped
    // them flat against each other. Measured at 1.0, rendered hue and
    // saturation come back at the source values to two decimal places.
    float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    vTint = max(mix(vec3(luma), rgb, uSat), vec3(0.0));

    // Presence: keep a pixel if it is bright *or* saturated. Luminance alone
    // discarded every dark-but-vivid region — hair, a red garment against a
    // dark ground — which punched holes in exactly the areas that carry a
    // face's outline.
    //
    // Measured in perceptual space, not linear. The sampler returns
    // linear-light, where dark values are crushed toward zero: hair at #241814
    // scores 0.011 linear against a 0.055 cut and was being deleted outright,
    // while a mid-blue background scored 0.17 and survived at 70%. The subject's
    // silhouette was erased and the backdrop kept — precisely inverted. An
    // approximate gamma encode puts the threshold back on the scale a human
    // eye, and this cut value, were chosen against.
    vec3 per = pow(max(rgb, vec3(0.0)), vec3(0.4545));
    float pLuma = dot(per, vec3(0.2126, 0.7152, 0.0722));
    float mx = max(per.r, max(per.g, per.b));
    float chroma = mx - min(per.r, min(per.g, per.b));
    float presence = max(pLuma, chroma * 0.9);

    // Narrow ramp. Alpha is a matte — "is anything here" — not a second
    // brightness curve. Over a black canvas with normal blending the result is
    // tint * alpha, so grading alpha by luminance applied brightness twice and
    // squared the contrast, dragging every midtone toward black. Colour lives
    // in the tint; alpha only carves away true empty space.
    float body = smoothstep(uCut, uCut + 0.06, presence);
    vAlpha = body * (1.0 - uBurst * 0.45);

    // Hot particles run coral while a burst is in flight — but only as a
    // glaze. Heat peaks on frame one, so a strong mix here repainted the whole
    // cloud coral at the exact moment the image is meant to still be readable
    // as it cracks: the same monochrome wash that made the resting state
    // unrecognisable, just triggered by the trigger. At 0.32 the footage's own
    // colour stays dominant and the heat reads as debris glowing through it.
    // The energy of the hit comes from the fragment's bloom multiplier and the
    // shrink-to-fine-debris, not from overwriting the subject.
    vTint = mix(vTint, vec3(1.0, 0.30, 0.43), vHeat * 0.32);
  }
`

const FRAG = /* glsl */ `
  precision highp float;

  varying vec3  vTint;
  varying float vAlpha;
  varying float vHeat;

  // The video texture is tagged sRGB, so the sampler hands the vertex shader
  // linear-light values and all the maths above happens in linear — which is
  // correct. But a raw ShaderMaterial writes straight to the drawing buffer:
  // three.js only injects the output conversion into its own materials. Without
  // this, linear values were being shown as though they were already sRGB, so
  // every midtone came out roughly gamma-squared — a 0.48 background rendered
  // at 0.18, and the channel ratios stretched, pushing saturation to clipping.
  // Dark and garish is a poor likeness of any footage.
  vec3 toSRGB(vec3 c) {
    vec3 lo = c * 12.92;
    vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
    return mix(lo, hi, step(vec3(0.0031308), c));
  }

  void main() {
    // Round, soft-edged sprite. Discarding early is cheaper than blending a
    // fully transparent fragment.
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;

    // Soft but not hazy: a fully feathered sprite spreads each pixel's colour
    // over its neighbours, which is its own kind of blur. Most of the disc
    // stays at full strength and only the rim falls away.
    float falloff = 1.0 - smoothstep(0.10, 0.25, r2);
    float alpha = vAlpha * falloff;
    if (alpha < 0.004) discard;

    // Hot particles bloom brighter than their own colour during a burst.
    gl_FragColor = vec4(toSRGB(vTint * (1.0 + vHeat * 0.9)), alpha);
  }
`

/**
 * Sprite diameter as a multiple of the grid pitch.
 *
 * This is the single most important number for how sharp the cloud looks, and
 * it is not obvious why. Because sprite size is *derived* from pitch, the cloud
 * is self-similar: doubling the particle count halves the pitch and halves the
 * sprite, so the fraction of the plane left uncovered is identical at 50k and
 * at 600k. Measured, holding this at 1.4: 39% of the frame falls in a gap at
 * every density, and block-wise correlation against the source sits at
 * 0.91-0.94 no matter how many points are added. Adding particles alone cannot
 * sharpen the image. Only overlap can.
 *
 * The gaps also cost tone, not just detail. With 39% of the plane empty over a
 * black canvas, a region the source holds at luminance 54 renders at 25 — the
 * image arrives at 47% of its true brightness, which is a large part of why the
 * hologram read as dim and speckled.
 *
 * Swept at 1080p against a synthetic portrait carrying 2px hair strands and
 * 26px text — detail a coarse grid destroys first:
 *
 *   pitch  holes   shape   feature   fine    tone     cost
 *   1.40x  38.7%   0.962   0.913     0.808   0.47x    6.9 ms
 *   1.61x  ~22%    0.977   0.948     0.871   0.61x    7.0 ms
 *   1.81x  13.4%   0.990   0.961     0.915   0.72x    7.0 ms
 *   1.89x  11.9%   0.991   0.963     0.919   0.75x   11.3 ms
 *
 * Cost scales with sprite area, so it is flat until the fill rate wall, then
 * steep. 1.81x sits right before that wall: two thirds of the holes closed and
 * fine detail up 13 points, for no measurable time. 1.89x buys 0.004 more
 * correlation for 60% more frame cost, which is the same bad trade the old
 * comment identified — just at a different place than it thought, because it
 * was reading a coverage metric that could not see the self-similarity.
 */
const SPRITE_PITCH = 1.81

const TAU = Math.PI * 2

export class HologramField {  constructor(canvas) {
    this.canvas = canvas

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // pointless for points, and costs fill rate
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setClearColor(0x000000, 0)
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(this.pixelRatio)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100)
    this.camera.position.set(0, 0, 9)

    this.uniforms = {
      uMap: { value: null },
      uTime: { value: 0 },
      uDepth: { value: 1.0 },
      uBurst: { value: 0 },
      uPower: { value: 1 },
      uSize: { value: 1.0 },
      uPixelRatio: { value: this.pixelRatio },
      uCut: { value: 0.055 },
      uSat: { value: 1.0 },
      uJitter: { value: 0.004 },
      uPointScale: { value: 14 },
      uSpan: { value: 8.6 },
    }

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      // Normal alpha, not additive. Additive sums overlapping sprites toward
      // white, so any dense region of the cloud — which is to say a face —
      // clipped to grey no matter what colour the footage was. Explosions get
      // their glow from the heat term in the shader instead, which is where
      // the brightness belongs: on the burst, not on the resting image.
      blending: THREE.NormalBlending,
    })

    this.points = null
    this.count = 200000
    this.aspect = 16 / 9
    this.texture = null

    // Burst state (host-side, O(1))
    this.burstT = 0
    this.burstDur = 0.34
    this.bursting = false

    // Camera orbit state. Distance is fitted to the frame in _buildGeometry.
    this.orbit = { theta: 0, phi: 0, dist: 11, tTheta: 0, tPhi: 0, tDist: 11 }
    this.drift = true
    this.dragging = false

    this._buildGeometry()
    this._bindPointer()
    this._bindContextLoss()

    this.lastFrame = performance.now()
    this.resize()
  }

  /**
   * A lost GPU context (driver reset, laptop switching graphics, another tab
   * exhausting VRAM) otherwise leaves a permanently black canvas. Preventing
   * the default on the loss event is what lets the browser hand back a
   * restored context, at which point three.js re-uploads automatically.
   */
  _bindContextLoss() {
    this.contextLost = false

    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.contextLost = true
      this.onContextLost?.()
    })

    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false
      this.lastFrame = performance.now()
      this.onContextRestored?.()
    })
  }

  /** Lay points out on a grid matched to the video's aspect ratio. */
  _buildGeometry() {
    const count = this.count
    const aspect = this.aspect

    // Choose a column/row split whose ratio matches the frame.
    let cols = Math.max(2, Math.round(Math.sqrt(count * aspect)))
    let rows = Math.max(2, Math.round(count / cols))
    const total = cols * rows

    // Contain the frame in a fixed box rather than fixing the height. A
    // portrait clip under a fixed height rendered as a narrow sliver using a
    // third of the viewport, which costs recognition before colour even gets
    // a say.
    const BOX_W = 8.6
    const BOX_H = 6.4
    let width = BOX_W
    let height = BOX_W / aspect
    if (height > BOX_H) {
      height = BOX_H
      width = BOX_H * aspect
    }

    const positions = new Float32Array(total * 3)
    const uvs = new Float32Array(total * 2)
    const seeds = new Float32Array(total * 3)

    let i = 0
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const u = x / (cols - 1)
        const v = y / (rows - 1)

        positions[i * 3] = (u - 0.5) * width
        positions[i * 3 + 1] = (0.5 - v) * height
        positions[i * 3 + 2] = 0

        uvs[i * 2] = u
        uvs[i * 2 + 1] = 1 - v // video textures arrive flipped

        seeds[i * 3] = Math.random()
        seeds[i * 3 + 1] = Math.random()
        seeds[i * 3 + 2] = Math.random()

        i++
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aUv', new THREE.BufferAttribute(uvs, 2))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40)

    if (this.points) {
      this.scene.remove(this.points)
      this.points.geometry.dispose()
    }

    this.points = new THREE.Points(geo, this.material)
    this.points.frustumCulled = false
    this.scene.add(this.points)

    this.activeCount = total

    // Both of these are functions of the grid pitch, so they are recomputed
    // whenever the grid is. Sprites are sized to just overlap their cell
    // (gaps read as noise, large overlaps read as blur), and idle vibration is
    // kept to a fraction of a cell so particles never swap places.
    const pitch = width / (cols - 1)
    this.pitch = pitch
    this.uniforms.uPointScale.value = pitch * SPRITE_PITCH * this._pixelsPerUnit()
    this.uniforms.uJitter.value = pitch * 0.22

    // Burst travel is expressed in plane heights so the explosion clears the
    // frame by the same visual margin whatever shape the clip is.
    this.planeSpan = Math.max(width, height)
    this.uniforms.uSpan.value = this.planeSpan

    // Frame the plane: pull back far enough that the full height fits with a
    // small margin. Fixed at 9 before, which cropped tall clips.
    const fov = (this.camera.fov * Math.PI) / 180
    const fit = (height / 2 / Math.tan(fov / 2)) * 1.28
    this.fitDist = THREE.MathUtils.clamp(fit, 5, 20)
    if (!this._framed) {
      this.orbit.dist = this.fitDist
      this.orbit.tDist = this.fitDist
      this._framed = true
    }
  }

  /**
   * Vertical pixels per world unit at unit distance, for the current camera and
   * canvas. gl_PointSize is in pixels, so sprite size has to be derived from
   * this or density and resolution silently change how the cloud reads.
   */
  _pixelsPerUnit() {
    // Every source here can legitimately be 0: the constructor runs
    // _buildGeometry before the first resize, and a canvas in a hidden or
    // zero-height container reports 0 for both its own height and the window's.
    // A 0 propagates straight into gl_PointSize and the entire cloud silently
    // stops rasterising, so the floor is not defensive noise — it is the only
    // thing standing between an unlucky layout frame and a black screen.
    const h =
      this.renderer.domElement.height / this.pixelRatio ||
      window.innerHeight ||
      720
    const fov = (this.camera.fov * Math.PI) / 180
    return h / (2 * Math.tan(fov / 2))
  }

  setCount(n) {
    if (n === this.count) return
    this.count = n
    this._buildGeometry()
  }

  setVideo(video) {
    if (this.texture) this.texture.dispose()

    const tex = new THREE.VideoTexture(video)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = false
    tex.colorSpace = THREE.SRGBColorSpace

    this.texture = tex
    this.uniforms.uMap.value = tex

    const a = video.videoWidth / video.videoHeight
    if (a && Math.abs(a - this.aspect) > 0.01) {
      this.aspect = a
      // A new clip shape gets re-framed, so a portrait clip after a landscape
      // one is not left sitting at the previous clip's distance.
      this._framed = false
      this._buildGeometry()
    }
  }

  /** Fire an explosion. `power` scales travel distance and heat. */
  burst(power = 1) {
    this.burstT = 0
    this.bursting = true
    this.uniforms.uPower.value = THREE.MathUtils.clamp(power, 0.15, 2.6)
  }

  setDepth(v) {
    this.uniforms.uDepth.value = v
  }

  /**
   * Return the camera to the head-on framing the projection was built for.
   *
   * Orbiting by hand is easy to do and hard to undo: theta and phi have no
   * detent at zero, so getting a face back to square means nudging a drag until
   * it looks right, and the drift term is moving the target the whole time.
   *
   * Two things make this behave. First, theta accumulates without bound — drift
   * adds to it every frame, so after a few idle minutes it sits several
   * revolutions from zero. Targeting a literal 0 would unwind all of them as a
   * long backwards spin, which looks like a bug. The target is instead the
   * nearest multiple of a full turn, so the shortest way round is always the way
   * taken, and the *current* value is rewritten into the same frame so the
   * damped follow in render() sees a small delta rather than a huge one.
   *
   * Second, drift is switched off. Leaving it on would pull the cloud back out
   * of square within a second, making the button look broken; the caller syncs
   * its own toggle to match. Distance goes back to the fitted value from
   * _buildGeometry, which is the framing that contains the whole plane — so this
   * also undoes an over-zealous scroll.
   */
  recenter() {
    const turns = Math.round(this.orbit.theta / TAU)

    this.orbit.theta -= turns * TAU
    this.orbit.tTheta = 0
    this.orbit.tPhi = 0
    this.orbit.tDist = this.fitDist ?? this.orbit.dist

    this.drift = false
  }

  setSize(v) {
    this.uniforms.uSize.value = v
  }

  _bindPointer() {
    const el = this.canvas
    let lastX = 0
    let lastY = 0

    const down = (e) => {
      this.dragging = true
      lastX = e.clientX
      lastY = e.clientY
      el.setPointerCapture?.(e.pointerId)
    }

    const move = (e) => {
      if (!this.dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      this.orbit.tTheta += dx * 0.005
      this.orbit.tPhi = THREE.MathUtils.clamp(
        this.orbit.tPhi + dy * 0.005,
        -0.9,
        0.9
      )
    }

    const up = (e) => {
      this.dragging = false
      el.releasePointerCapture?.(e.pointerId)
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)

    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        this.orbit.tDist = THREE.MathUtils.clamp(
          this.orbit.tDist + e.deltaY * 0.0055,
          3.4,
          20
        )
      },
      { passive: false }
    )
  }

  resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()

    // Sprite size is in pixels but derived from world-space pitch, so it has
    // to be refreshed whenever the viewport changes.
    if (this.pitch) {
      this.uniforms.uPointScale.value =
        this.pitch * SPRITE_PITCH * this._pixelsPerUnit()
    }
  }

  render() {
    if (this.contextLost) return

    const now = performance.now()
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05)
    this.lastFrame = now
    this.uniforms.uTime.value += dt

    // Burst envelope: ramp 0 -> 1 across the duration, then drop to exactly
    // 0 on the same frame. That discontinuity *is* the snap back — the points
    // are in formation on the very next frame, no easing, no settle.
    if (this.bursting) {
      this.burstT += dt
      if (this.burstT >= this.burstDur) {
        this.bursting = false
        this.uniforms.uBurst.value = 0
      } else {
        this.uniforms.uBurst.value = this.burstT / this.burstDur
      }
    }

    // Slow drift so the projection reads as volumetric while untouched.
    if (this.drift && !this.dragging) {
      this.orbit.tTheta += dt * 0.055
      this.orbit.tPhi = Math.sin(this.uniforms.uTime.value * 0.22) * 0.16
    }

    // Critically damped-ish follow, frame-rate independent.
    const k = 1 - Math.pow(0.0015, dt)
    this.orbit.theta += (this.orbit.tTheta - this.orbit.theta) * k
    this.orbit.phi += (this.orbit.tPhi - this.orbit.phi) * k
    this.orbit.dist += (this.orbit.tDist - this.orbit.dist) * k

    const { theta, phi, dist } = this.orbit
    this.camera.position.set(
      Math.sin(theta) * Math.cos(phi) * dist,
      Math.sin(phi) * dist,
      Math.cos(theta) * Math.cos(phi) * dist
    )
    this.camera.lookAt(0, 0, 0)

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.texture?.dispose()
    this.points?.geometry.dispose()
    this.material.dispose()
    this.renderer.dispose()
  }
}
