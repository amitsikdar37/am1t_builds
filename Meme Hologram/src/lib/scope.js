/**
 * Scope
 * -----
 * The scrolling strip under the projection. It draws three things: how loud
 * the input is right now (filled trace), the level a spike has to clear to
 * fire (the gate line, which moves as the detector adapts), and a mark at
 * every burst.
 *
 * It exists because the trigger is otherwise invisible. When nothing
 * explodes, this is what tells you whether the sound never spiked or the
 * sensitivity is simply set too strict.
 */

const COLUMNS = 320

export class Scope {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    this.trace = new Float32Array(COLUMNS)
    this.gate = new Float32Array(COLUMNS)
    this.hits = new Float32Array(COLUMNS)
    this.head = 0

    // Flux and gate live in an open-ended range; track a running ceiling so
    // the strip stays readable across quiet and loud material.
    this.ceiling = 4

    this.resize()
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = this.canvas.getBoundingClientRect()
    this.w = Math.max(1, Math.floor(rect.width))
    this.h = Math.max(1, Math.floor(rect.height))
    this.canvas.width = this.w * dpr
    this.canvas.height = this.h * dpr
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  push(flux, gate, hit) {
    const peak = Math.max(flux, gate)
    if (peak > this.ceiling) this.ceiling = peak
    else this.ceiling += (Math.max(peak, 2) - this.ceiling) * 0.01

    this.trace[this.head] = flux
    this.gate[this.head] = gate
    this.hits[this.head] = hit ? 1 : 0
    this.head = (this.head + 1) % COLUMNS
  }

  draw() {
    const { ctx, w, h } = this
    const scale = 1 / (this.ceiling * 1.12)
    const step = w / (COLUMNS - 1)
    const base = h - 1

    ctx.clearRect(0, 0, w, h)

    // Baseline grid: quarter marks, barely there.
    ctx.strokeStyle = 'rgba(195, 178, 255, 0.07)'
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      const y = Math.round(base - (base * i) / 4) + 0.5
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    const at = (i) => (this.head + i) % COLUMNS

    // Loudness trace, filled.
    ctx.beginPath()
    ctx.moveTo(0, base)
    for (let i = 0; i < COLUMNS; i++) {
      const v = Math.min(this.trace[at(i)] * scale, 1)
      ctx.lineTo(i * step, base - v * (h - 3))
    }
    ctx.lineTo(w, base)
    ctx.closePath()

    const fill = ctx.createLinearGradient(0, 0, 0, h)
    fill.addColorStop(0, 'rgba(195, 178, 255, 0.42)')
    fill.addColorStop(1, 'rgba(195, 178, 255, 0.03)')
    ctx.fillStyle = fill
    ctx.fill()

    ctx.strokeStyle = 'rgba(195, 178, 255, 0.85)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < COLUMNS; i++) {
      const v = Math.min(this.trace[at(i)] * scale, 1)
      const y = base - v * (h - 3)
      i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * step, y)
    }
    ctx.stroke()

    // Gate line.
    ctx.strokeStyle = 'rgba(125, 227, 255, 0.62)'
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    for (let i = 0; i < COLUMNS; i++) {
      const v = Math.min(this.gate[at(i)] * scale, 1)
      const y = base - v * (h - 3)
      i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * step, y)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Burst marks.
    for (let i = 0; i < COLUMNS; i++) {
      if (!this.hits[at(i)]) continue
      const x = Math.round(i * step) + 0.5
      const g = ctx.createLinearGradient(x, 0, x, h)
      g.addColorStop(0, 'rgba(255, 77, 109, 0)')
      g.addColorStop(0.45, 'rgba(255, 77, 109, 0.9)')
      g.addColorStop(1, 'rgba(255, 77, 109, 0.15)')
      ctx.strokeStyle = g
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, base)
      ctx.stroke()
    }
  }
}
