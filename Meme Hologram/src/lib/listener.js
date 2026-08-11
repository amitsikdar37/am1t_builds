/**
 * Listener
 * --------
 * Watches an audio source and reports sudden attacks.
 *
 * A plain loudness gate is the obvious approach and it is wrong: it fires
 * continuously through any loud passage and never fires at all in a quiet
 * one. What the brief asks for — a *sudden, sharp spike* — is an onset, so
 * this measures spectral flux (the frame-to-frame rise in energy, summed
 * only over bins that got louder) and compares it against a rolling median
 * of recent flux. That makes the trigger relative to whatever is currently
 * playing: a shout in a quiet room and a snare in a loud mix both register,
 * and sustained noise settles into the baseline and stops firing.
 *
 * Two sources can be live at once (clip audio and microphone); each gets its
 * own detector so a loud video cannot desensitise the mic.
 */

const HISTORY = 43 // ~0.7s of flux at 60fps — long enough to be stable

/**
 * Minimum gap between bursts, in seconds, from permissive to strict.
 *
 * This was 0.11s, which is the bug behind "it bursts constantly": a burst
 * animation lasts 0.34s, so a second trigger landed while the first was still
 * in flight and restarted it. The cloud never reached the snap-back, so there
 * was no formation to explode *from* — just perpetual debris. Any refractory
 * shorter than the burst duration makes the reset unreachable.
 *
 * The floor is therefore comfortably longer than one burst, so every explosion
 * is seen to complete and the image is legible again before the next one.
 */
const GAP_OPEN = 0.42
const GAP_TIGHT = 1.15

export class Detector {
  constructor(analyser) {
    this.analyser = analyser
    this.bins = new Uint8Array(analyser.frequencyBinCount)
    this.prev = new Float32Array(analyser.frequencyBinCount)
    this.history = new Float32Array(HISTORY)
    this.cursor = 0
    this.filled = 0
    this.warm = 0
    this.level = 0
    this.lastHit = -1e3

    // Each burst raises the bar for the next one; see the gate calculation.
    this.fatigue = 0
    this.lastT = 0
  }

  /**
   * @returns {{level:number, flux:number, gate:number, hit:boolean, power:number}}
   */
  sample(now, sensitivity) {
    const a = this.analyser
    a.getByteFrequencyData(this.bins)

    const n = this.bins.length
    // Ignore the very top of the spectrum: mostly hiss, and it makes the
    // detector jumpy on compressed footage.
    const top = Math.floor(n * 0.72)

    let flux = 0
    let sum = 0
    for (let i = 0; i < top; i++) {
      const v = this.bins[i] / 255
      sum += v
      const d = v - this.prev[i]
      if (d > 0) flux += d // rising bins only — that's the attack
      this.prev[i] = v
    }

    const level = sum / top
    // Smooth the displayed level; the raw value is too noisy to read.
    this.level += (level - this.level) * 0.28

    // Rolling baseline over recent flux.
    let mean = 0
    const len = this.filled
    for (let i = 0; i < len; i++) mean += this.history[i]
    mean = len ? mean / len : 0

    let variance = 0
    for (let i = 0; i < len; i++) {
      const d = this.history[i] - mean
      variance += d * d
    }
    const sd = len ? Math.sqrt(variance / len) : 0

    // Sensitivity 0..1 maps to strict..permissive.
    //
    // The gate is multiplicative on the running baseline rather than additive,
    // because flux scales with how loud and how broadband the material is:
    // a fixed offset that works for speech is nothing for a drum track. The
    // absolute floor only guards against triggering on silence.
    const strict = 1 - sensitivity
    const mult = 1.9 + strict * 6.0 // ~1.9x baseline (open) .. ~7.9x (tight)
    const spread = sd * (1.5 + strict * 3.0)
    const floor = 2.2 + strict * 8.0

    // Fatigue: each burst temporarily raises the bar, decaying over ~1.4s.
    //
    // Continuous speech produces a genuine onset on nearly every syllable, so
    // a correct onset detector with a fixed threshold fires several times a
    // second on a talking clip — technically right, visually exhausting. This
    // makes the trigger self-limiting: the first hit of a phrase lands, and
    // the ones immediately behind it have to be markedly stronger to also
    // land. Sustained loud passages settle down instead of strobing, while an
    // isolated shout into a quiet room still fires at full strength.
    const dt = Math.max(0, Math.min(now - this.lastT, 0.5))
    this.lastT = now
    this.fatigue *= Math.pow(0.5, dt / 1.4)

    const gate = Math.max(mean * mult + spread, floor) * (1 + this.fatigue)

    const gap = GAP_OPEN + strict * (GAP_TIGHT - GAP_OPEN)
    const quiet = now - this.lastHit < gap

    // Warm-up: the baseline is meaningless until a few frames of real audio
    // have landed. Count only frames that carried signal — polling faster
    // than the analyser refreshes yields duplicate frames with zero flux,
    // and counting those would let a spike through before there is anything
    // to compare it against.
    if (flux > 0) this.warm++

    const hit = !quiet && flux > gate && this.warm > 6

    if (hit) {
      this.lastHit = now
      this.fatigue = Math.min(this.fatigue + 0.85, 2.4)
    }

    // Only record frames that carried signal, for the reason above: a
    // duplicate frame is not evidence that the room went quiet.
    if (flux > 0) {
      this.history[this.cursor] = flux
      this.cursor = (this.cursor + 1) % HISTORY
      if (this.filled < HISTORY) this.filled++
    }

    // How far past the gate it landed, as a burst strength.
    const power = hit ? Math.min(1 + (flux - gate) / Math.max(gate, 0.6), 2.6) : 0

    return { level: this.level, flux, gate, hit, power }
  }
}

export class Listener {
  constructor() {
    this.ctx = null
    this.videoDet = null
    this.micDet = null
    this.micStream = null
    this.videoNode = null
    this.gain = null
    this.muted = false
  }

  _ensureContext() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      this.ctx = new Ctx()
    }
    return this.ctx
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
  }

  _makeAnalyser() {
    const a = this.ctx.createAnalyser()
    a.fftSize = 1024
    a.smoothingTimeConstant = 0.5
    a.minDecibels = -92
    a.maxDecibels = -8
    return a
  }

  /**
   * Route a video element through the graph so we can both hear it and
   * analyse it. A MediaElementSource can only be created once per element,
   * so the node is cached.
   */
  attachVideo(video) {
    const ctx = this._ensureContext()

    if (!this.videoNode) {
      this.videoNode = ctx.createMediaElementSource(video)
      this.gain = ctx.createGain()
      this.gain.gain.value = this.muted ? 0 : 1
      this.videoNode.connect(this.gain)
      this.gain.connect(ctx.destination)
    }

    if (!this.videoDet) {
      const a = this._makeAnalyser()
      this.videoNode.connect(a)
      this.videoDet = new Detector(a)
    }
  }

  setMuted(muted) {
    this.muted = muted
    if (this.gain) {
      this.gain.gain.value = muted ? 0 : 1
    }
  }

  async enableMic() {
    const ctx = this._ensureContext()
    await this.resume()

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })

    this.micStream = stream
    const src = ctx.createMediaStreamSource(stream)
    const a = this._makeAnalyser()
    src.connect(a) // analyser only — never to destination, that's feedback
    this.micDet = new Detector(a)
  }

  disableMic() {
    this.micStream?.getTracks().forEach((t) => t.stop())
    this.micStream = null
    this.micDet = null
  }

  get micLive() {
    return !!this.micDet
  }

  /**
   * Sample every live source once. Returns the strongest hit this frame plus
   * the reading to draw on the scope.
   *
   * The scope needs flux and gate to come from the *same* detector, otherwise
   * it draws one source's spike against another's threshold and the picture
   * lies. So the louder source wins both values together.
   */
  poll(now, sensitivity) {
    const readings = []
    if (this.videoDet) readings.push(this.videoDet.sample(now, sensitivity))
    if (this.micDet) readings.push(this.micDet.sample(now, sensitivity))

    if (!readings.length) {
      return { level: 0, flux: 0, gate: 0, hit: false, power: 0 }
    }

    let lead = readings[0]
    let level = 0
    let hit = false
    let power = 0

    for (const r of readings) {
      if (r.flux > lead.flux) lead = r
      if (r.level > level) level = r.level
      if (r.hit) {
        hit = true
        if (r.power > power) power = r.power
      }
    }

    return { level, flux: lead.flux, gate: lead.gate, hit, power }
  }
}
