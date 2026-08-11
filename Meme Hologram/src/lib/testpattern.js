/**
 * Test pattern
 * ------------
 * A synthetic clip so the projector has something to show before the user
 * has picked a file, and so the depth relief is demonstrable without one.
 *
 * It draws a lit face-like form: a shaded head with a strong luminance
 * gradient (which the vertex shader turns into real depth), eyes, and a
 * mouth that opens on a slow cycle. Rendered to a canvas and handed over as
 * a MediaStream, so it travels the exact same path as a dropped MP4 — same
 * <video> element, same texture, same transport controls.
 */

export function createTestPattern(fps = 30) {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 360
  const ctx = canvas.getContext('2d', { alpha: false })

  const W = canvas.width
  const H = canvas.height
  const cx = W / 2
  const cy = H / 2 + 8

  let raf = 0
  let t = 0

  function frame() {
    t += 1 / fps

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)

    const sway = Math.sin(t * 0.6) * 14
    const headX = cx + sway
    const headR = 108

    // Head: off-centre radial gradient so one side falls into shadow. The
    // gradient is the whole point — it becomes the z-relief.
    const head = ctx.createRadialGradient(
      headX - 34,
      cy - 42,
      12,
      headX,
      cy,
      headR * 1.5
    )
    head.addColorStop(0, '#ffffff')
    head.addColorStop(0.34, '#cfd0e6')
    head.addColorStop(0.68, '#5a5f7d')
    head.addColorStop(1, '#07080f')

    ctx.fillStyle = head
    ctx.beginPath()
    ctx.ellipse(headX, cy, headR * 0.82, headR, 0, 0, Math.PI * 2)
    ctx.fill()

    // Brow ridge shadow, adds structure to the relief.
    ctx.fillStyle = 'rgba(0,0,0,0.42)'
    ctx.beginPath()
    ctx.ellipse(headX, cy - 44, headR * 0.72, 15, 0, 0, Math.PI * 2)
    ctx.fill()

    // Eyes. Bright, so they punch forward.
    const blink = Math.sin(t * 1.7) > 0.93 ? 0.12 : 1
    for (const side of [-1, 1]) {
      const ex = headX + side * 33
      const ey = cy - 26
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.ellipse(ex, ey, 15, 10 * blink, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#0a0a14'
      ctx.beginPath()
      ctx.ellipse(ex + Math.sin(t * 0.9) * 4, ey, 6, 6.5 * blink, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // Nose highlight.
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath()
    ctx.ellipse(headX + 2, cy + 6, 7, 22, 0, 0, Math.PI * 2)
    ctx.fill()

    // Mouth, opening and closing.
    const open = (Math.sin(t * 2.4) * 0.5 + 0.5) * 22 + 4
    ctx.fillStyle = '#101018'
    ctx.beginPath()
    ctx.ellipse(headX, cy + 52, 34, open, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.beginPath()
    ctx.ellipse(headX, cy + 52 - open * 0.55, 30, 4, 0, 0, Math.PI * 2)
    ctx.fill()

    // Scan band travelling down the frame.
    const bandY = ((t * 90) % (H + 120)) - 60
    const band = ctx.createLinearGradient(0, bandY - 40, 0, bandY + 40)
    band.addColorStop(0, 'rgba(255,255,255,0)')
    band.addColorStop(0.5, 'rgba(255,255,255,0.16)')
    band.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = band
    ctx.fillRect(0, bandY - 40, W, 80)

    raf = requestAnimationFrame(frame)
  }

  frame()

  const stream = canvas.captureStream(fps)

  return {
    stream,
    stop() {
      cancelAnimationFrame(raf)
      stream.getTracks().forEach((tr) => tr.stop())
    },
  }
}
