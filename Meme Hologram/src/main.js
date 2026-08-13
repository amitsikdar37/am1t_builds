import { HologramField } from './lib/hologram.js'
import { createTestPattern } from './lib/testpattern.js'

const $ = (id) => document.getElementById(id)

const video = $('source')

let field
try {
  field = new HologramField($('stage'))
} catch (err) {
  document.getElementById('onboard').innerHTML =
    '<div class="onboard__card">' +
    '<p class="onboard__eyebrow">Cannot start</p>' +
    '<h2 class="onboard__title">This browser can’t run WebGL</h2>' +
    '<p class="onboard__body">The projector needs hardware-accelerated WebGL 2. ' +
    'Check that hardware acceleration is enabled in your browser settings, then reload.</p>' +
    '</div>'
  throw err
}

/**
 * Density ladder, low to high. The top three stops are new: measured at 1080p,
 * 300k costs 7.6 ms a frame against 100k's 6.9 ms, because the expensive part
 * of a point cloud is the area its sprites cover and that area is set by
 * SPRITE_PITCH, not by how many points there are. Extra particles are close to
 * free; they buy a finer sampling of the frame, which is what resolves small
 * features like eyes and strands of hair.
 *
 * The low stops stay for machines that need them.
 */
const DENSITY = [12500, 25000, 50000, 100000, 200000, 300000]

const state = {
  objectUrl: null,
  pattern: null,
  hasSource: false,
}

/* ---------------------------------------------------------------- toast */

let toastTimer = 0
function toast(msg, isError = false) {
  const el = $('toast')
  el.textContent = msg
  el.classList.toggle('is-error', isError)
  el.classList.add('is-shown')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('is-shown'), 3200)
}

field.onContextLost = () => {
  toast('Graphics context lost — restoring', true)
}
field.onContextRestored = () => {
  if (state.hasSource) field.setVideo(video)
  toast('Projector back online')
}

/* --------------------------------------------------------------- source */

function clearSource() {
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl)
    state.objectUrl = null
  }
  if (state.pattern) {
    state.pattern.stop()
    state.pattern = null
  }
  video.srcObject = null
}

async function play() {
  try {
    await video.play()
  } catch (err) {
    // Autoplay rejection is expected until the user gestures; not an error
    // worth surfacing on its own.
    if (err?.name !== 'AbortError') toast('Press play to start')
  }
}

async function loadFile(file) {
  if (!file) return

  if (!file.type.startsWith('video/')) {
    toast(`${file.name} is not a video file`, true)
    return
  }

  clearSource()

  state.objectUrl = URL.createObjectURL(file)
  video.src = state.objectUrl
  video.loop = $('ctlLoop').checked

  try {
    await new Promise((resolve, reject) => {
      const ok = () => {
        cleanup()
        resolve()
      }
      const bad = () => {
        cleanup()
        reject(new Error('decode failed'))
      }
      const cleanup = () => {
        video.removeEventListener('loadeddata', ok)
        video.removeEventListener('error', bad)
      }
      video.addEventListener('loadeddata', ok, { once: true })
      video.addEventListener('error', bad, { once: true })
    })
  } catch {
    toast("Couldn't decode that file — try an MP4 (H.264)", true)
    return
  }

  field.setVideo(video)
  video.muted = $('ctlMute').checked

  state.hasSource = true
  $('btnPlay').disabled = false
  $('onboard').classList.add('is-hidden')

  const short = file.name.length > 34 ? file.name.slice(0, 31) + '…' : file.name
  toast(`Projecting ${short}`)

  await play()
}

async function loadTestPattern() {
  clearSource()

  const pattern = createTestPattern(30)
  state.pattern = pattern

  video.removeAttribute('src')
  video.srcObject = pattern.stream
  video.loop = false // a live stream does not loop

  await new Promise((resolve) => {
    if (video.readyState >= 2) return resolve()
    video.addEventListener('loadeddata', resolve, { once: true })
  })

  field.setVideo(video)
  video.muted = $('ctlMute').checked

  state.hasSource = true
  $('btnPlay').disabled = false
  $('onboard').classList.add('is-hidden')
  toast('Test pattern — drop a clip to replace it')

  await play()
}

/* ------------------------------------------------------------ drag/drop */

let dragDepth = 0

window.addEventListener('dragenter', (e) => {
  e.preventDefault()
  dragDepth++
  $('dropzone').classList.add('is-active')
})

window.addEventListener('dragover', (e) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
})

window.addEventListener('dragleave', (e) => {
  e.preventDefault()
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) $('dropzone').classList.remove('is-active')
})

window.addEventListener('drop', (e) => {
  e.preventDefault()
  dragDepth = 0
  $('dropzone').classList.remove('is-active')

  const file = [...(e.dataTransfer?.files || [])].find((f) =>
    f.type.startsWith('video/')
  )

  if (!file) {
    toast('That file is not a video', true)
    return
  }

  loadFile(file)
})

/* ------------------------------------------------------------- controls */

$('filePicker').addEventListener('change', (e) => {
  loadFile(e.target.files?.[0])
  e.target.value = '' // allow re-picking the same file
})

const pick = () => $('filePicker').click()
$('btnLoad').addEventListener('click', pick)
$('btnLoad2').addEventListener('click', pick)

$('btnSample').addEventListener('click', loadTestPattern)
$('btnSample2').addEventListener('click', loadTestPattern)

$('btnPlay').addEventListener('click', () => {
  video.paused ? play() : video.pause()
})

video.addEventListener('play', () => {
  $('btnPlayLabel').textContent = 'Pause'
})
video.addEventListener('pause', () => {
  $('btnPlayLabel').textContent = 'Play'
})

/**
 * Snap the projection back to a square, head-on framing. recenter() also stops
 * the drift — otherwise the cloud would rotate straight back out of alignment —
 * so the Drift toggle has to follow, or its checkbox would lie about the state.
 */
function align() {
  field.recenter()
  $('ctlSpin').checked = false
  toast('Aligned — drift paused')
}

$('btnAlign').addEventListener('click', align)

$('ctlDepth').addEventListener('input', (e) => {
  const v = parseFloat(e.target.value)
  field.setDepth(v)
  $('outDepth').textContent = v.toFixed(2)
})

$('ctlCount').addEventListener('input', (e) => {
  const n = DENSITY[parseInt(e.target.value, 10) - 1]
  field.setCount(n)
  $('outCount').textContent = n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`
})

$('ctlSpin').addEventListener('change', (e) => {
  field.drift = e.target.checked
})

$('ctlLoop').addEventListener('change', (e) => {
  video.loop = e.target.checked
})

$('ctlMute').addEventListener('change', (e) => {
  video.muted = e.target.checked
})

window.addEventListener('keydown', (e) => {
  // Typing in a field, or driving a control with the keyboard, must not also
  // trigger a shortcut. Buttons are deliberately not excluded: focus lands on
  // one after any click, and swallowing every shortcut from then on makes the
  // keys look broken. Space and Enter are the only keys a focused button
  // consumes, and Space is handled by letting the button's own click through.
  const el = e.target instanceof Element ? e.target : null
  if (el?.matches('input, select, textarea')) return
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return

  const onButton = !!el?.matches('button')

  if (e.code === 'Space') {
    if (onButton) return // let the focused button activate instead
    e.preventDefault()
    if (state.hasSource) video.paused ? play() : video.pause()
  } else if (e.code === 'KeyC') {
    align()
  }
})

window.addEventListener('resize', () => {
  field.resize()
})

/* ------------------------------------------------------------------ loop */

function tick() {
  requestAnimationFrame(tick)
  field.render()
}

requestAnimationFrame(tick)

// Dev-only handle. The preview pane runs pages in a hidden tab, where
// requestAnimationFrame is throttled to ~1Hz, so frame cost has to be
// measured by driving render() directly and forcing a GPU sync.
if (import.meta.env.DEV) {
  window.__bay = { field, state }
}
