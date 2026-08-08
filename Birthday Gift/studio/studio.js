/**
 * Birthday Gift Studio — client.
 *
 * The whole design rule here: the server owns the state, the DOM is a view of
 * it. Every mutation round-trips through the API and re-renders from the
 * response, so the panel can never drift from what will actually be published.
 *
 * The preview is a real iframe running the real viewer against the real
 * manifest — not a mock. If it looks right here, it is right.
 */

const $ = (id) => document.getElementById(id);
const API = '';

let state = null;
let limits = { maxFrames: 16, maxVideos: 3 };
let previewTier = 'auto';
let reloadTimer = null;

// ── Server sync ─────────────────────────────────────────────────────────────

async function api(path, opts = {}) {
  const res = await fetch(API + path, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

/** Apply a server response and repaint everything that derives from it. */
function adopt(body) {
  if (body.state) state = body.state;
  if (body.limits) limits = body.limits;
  renderFrames();
  renderMusic();
  refreshValidation();
  schedulePreviewReload();
}

// ── Preview ─────────────────────────────────────────────────────────────────

function previewURL() {
  const params = new URLSearchParams();
  params.set('gift', '/api/gift.json');
  if (previewTier !== 'auto') params.set('tier', previewTier);
  // Cache-buster: the manifest changes on every edit and the iframe would
  // otherwise happily serve the previous one.
  params.set('t', String(Date.now()));
  return `/src/viewer/index.html?${params}`;
}

function reloadPreview() {
  $('preview').src = previewURL();
}

/**
 * Typing a caption fires an input event per keystroke. Reloading a WebGL scene
 * that often would make the panel unusable, so edits settle first.
 */
function schedulePreviewReload(delay = 700) {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(reloadPreview, delay);
}

// ── Scalar fields ───────────────────────────────────────────────────────────

let saveTimer = null;
function saveFields(immediate = false) {
  clearTimeout(saveTimer);
  const run = async () => {
    const body = await api('/api/state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: $('f-name').value,
        letter: $('f-letter').value,
        candles: Number($('f-candles').value),
        musicVolume: Number($('f-volume').value) / 100,
      }),
    });
    state = body.state;
    refreshValidation();
    schedulePreviewReload();
  };
  if (immediate) run();
  else saveTimer = setTimeout(run, 400);
}

function bindFields() {
  $('f-name').addEventListener('input', () => saveFields());
  $('f-candles').addEventListener('input', () => saveFields());

  $('f-letter').addEventListener('input', (e) => {
    $('letter-count').textContent = String(e.target.value.length);
    saveFields();
  });

  $('f-volume').addEventListener('input', (e) => {
    $('vol-out').textContent = `${e.target.value}%`;
    saveFields();
  });
}

// ── Uploads ─────────────────────────────────────────────────────────────────

function setStatus(msg, kind = '') {
  const box = $('upload-status');
  if (!msg) { box.hidden = true; return; }
  box.hidden = false;
  box.className = `status ${kind}`;
  box.textContent = msg;
}

async function uploadFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const fd = new FormData();
  for (const f of files) fd.append('files', f);

  setStatus(`Processing ${files.length} file${files.length > 1 ? 's' : ''}…`);

  try {
    const body = await api('/api/media', { method: 'POST', body: fd });
    adopt(body);

    if (body.rejected?.length) {
      // Say exactly which file and exactly why. "Some files failed" would leave
      // the sender guessing which of their 16 photos to re-pick.
      const lines = body.rejected.map((r) => `${r.name}: ${r.reason}`).join('\n');
      setStatus(
        `Added ${body.added}. Skipped ${body.rejected.length}:\n${lines}`,
        'err'
      );
    } else {
      setStatus(`Added ${body.added}.`, 'ok');
      setTimeout(() => setStatus(''), 2500);
    }
  } catch (err) {
    setStatus(err.message, 'err');
  }
}

function bindDropzone() {
  const dz = $('dropzone');
  const input = $('file-input');

  dz.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    uploadFiles(input.files);
    input.value = '';
  });

  for (const evt of ['dragenter', 'dragover']) {
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.add('over');
    });
  }
  for (const evt of ['dragleave', 'drop']) {
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.remove('over');
    });
  }
  dz.addEventListener('drop', (e) => uploadFiles(e.dataTransfer?.files));

  // Dropping anywhere but the zone would otherwise make the browser navigate
  // away to the image — losing the whole in-progress gift.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
}

// ── Frame list ──────────────────────────────────────────────────────────────

function renderFrames() {
  const list = $('frame-list');
  list.innerHTML = '';
  $('max-frames').textContent = String(limits.maxFrames);

  const videos = state.frames.filter((f) => f.type === 'video').length;
  $('video-note').textContent =
    `Videos: ${videos} of ${limits.maxVideos}. More than that and phones start ` +
    `dropping frames across the whole page.`;

  for (const frame of state.frames) {
    list.appendChild(frameRow(frame));
  }
}

function frameRow(frame) {
  const li = document.createElement('li');
  li.className = 'frame-item';
  li.draggable = true;
  li.dataset.id = frame.id;

  const thumb = document.createElement('img');
  thumb.className = 'thumb';
  thumb.loading = 'lazy';
  thumb.alt = '';
  thumb.src = `/api/a/${frame.lqip || frame.poster || frame.src}`;
  li.appendChild(thumb);

  const meta = document.createElement('div');
  meta.className = 'meta';

  const cap = document.createElement('input');
  cap.className = 'cap';
  cap.type = 'text';
  cap.maxLength = 80;
  cap.placeholder = 'Add a caption…';
  cap.value = frame.caption || '';
  cap.addEventListener('input', () => patchFrame(frame.id, { caption: cap.value }));
  meta.appendChild(cap);

  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent =
    frame.type === 'video'
      ? `Video · ${Math.round(frame.duration || 0)}s · ${frame.w}×${frame.h}`
      : `Photo · ${frame.w}×${frame.h}`;
  meta.appendChild(tag);
  li.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'actions';

  for (const w of ['L', 'R']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn tiny wall${frame.wall === w ? ' on' : ''}`;
    b.textContent = w;
    b.title = `Pin to the ${w === 'L' ? 'left' : 'right'} wall`;
    b.addEventListener('click', () => {
      // Clicking the active wall unpins, handing the frame back to automatic
      // balancing rather than trapping it on one side forever.
      patchFrame(frame.id, { wall: frame.wall === w ? null : w });
    });
    actions.appendChild(b);
  }

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'btn tiny danger';
  del.textContent = '✕';
  del.title = 'Remove';
  del.addEventListener('click', async () => {
    adopt(await api(`/api/media/${frame.id}`, { method: 'DELETE' }));
  });
  actions.appendChild(del);

  li.appendChild(actions);
  return li;
}

let patchTimers = new Map();
function patchFrame(id, patch) {
  // Optimistic local update keeps typing responsive; the server confirms after.
  const frame = state.frames.find((f) => f.id === id);
  if (frame) Object.assign(frame, patch);
  if ('wall' in patch) renderFrames();

  clearTimeout(patchTimers.get(id));
  patchTimers.set(id, setTimeout(async () => {
    const body = await api(`/api/media/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    state = body.state;
    refreshValidation();
    schedulePreviewReload();
  }, 350));
}

// ── Drag to reorder ─────────────────────────────────────────────────────────

function bindReorder() {
  const list = $('frame-list');
  let draggingId = null;

  list.addEventListener('dragstart', (e) => {
    const li = e.target.closest('.frame-item');
    if (!li) return;
    draggingId = li.dataset.id;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    // Firefox refuses to start a drag without data set.
    e.dataTransfer.setData('text/plain', draggingId);
  });

  list.addEventListener('dragend', () => {
    draggingId = null;
    for (const n of list.querySelectorAll('.frame-item')) {
      n.classList.remove('dragging', 'drop-target');
    }
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    const over = e.target.closest('.frame-item');
    if (!over || over.dataset.id === draggingId) return;

    for (const n of list.querySelectorAll('.frame-item')) {
      n.classList.toggle('drop-target', n === over);
    }
  });

  list.addEventListener('drop', async (e) => {
    e.preventDefault();
    const over = e.target.closest('.frame-item');
    if (!over || !draggingId || over.dataset.id === draggingId) return;

    const ids = state.frames.map((f) => f.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(over.dataset.id);
    if (from === -1 || to === -1) return;

    ids.splice(to, 0, ids.splice(from, 1)[0]);

    adopt(await api('/api/media/order', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ order: ids }),
    }));
  });
}

// ── Music ───────────────────────────────────────────────────────────────────

function renderMusic() {
  const has = Boolean(state.music?.src);
  $('music-current').hidden = !has;
  $('music-pick').textContent = has ? 'Replace track' : 'Choose a track';
  $('music-name').textContent = has ? state.music.src : '';
  if (!has) $('music-input').value = '';
}

function bindMusic() {
  $('music-pick').addEventListener('click', () => $('music-input').click());

  $('music-input').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setStatus('Encoding audio…');
    try {
      const fd = new FormData();
      fd.append('file', file);
      adopt(await api('/api/music', { method: 'POST', body: fd }));
      setStatus('Music added.', 'ok');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setStatus(err.message, 'err');
    }
  });

  $('music-remove').addEventListener('click', async () => {
    try {
      adopt(await api('/api/music', { method: 'DELETE' }));
      setStatus('Music removed.', 'ok');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setStatus(err.message, 'err');
    }
  });
}

// ── Preview controls ────────────────────────────────────────────────────────

function bindPreviewControls() {
  $('tier-switch').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg');
    if (!btn) return;
    for (const b of $('tier-switch').children) b.classList.toggle('active', b === btn);
    previewTier = btn.dataset.tier;
    reloadPreview();
  });

  $('viewport-switch').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg');
    if (!btn) return;
    for (const b of $('viewport-switch').children) b.classList.toggle('active', b === btn);
    $('stage-frame').classList.toggle('phone', btn.dataset.vp === 'phone');
  });

  $('reload-btn').addEventListener('click', reloadPreview);
}

// ── Validation ──────────────────────────────────────────────────────────────

async function refreshValidation() {
  try {
    const { problems } = await api('/api/validate');
    const box = $('problems');

    if (!problems.length) {
      box.hidden = true;
      $('publish-btn').disabled = false;
      return;
    }

    box.hidden = false;
    box.innerHTML = '<ul>' + problems.map((p) => `<li>${escapeHtml(p)}</li>`).join('') + '</ul>';
    $('publish-btn').disabled = true;
  } catch {
    // Validation is advisory; a hiccup here shouldn't lock the sender out.
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ── Export & publish ────────────────────────────────────────────────────────

function bindPublish() {
  $('publish-btn').addEventListener('click', async () => {
    const btn = $('publish-btn');
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Building...';

    try {
      const exportRes = await api('/api/export', { method: 'POST' });
      const { result } = exportRes;

      // Check what publish routes this sender has. The CLI path is strictly an
      // optimisation; everything always degrades to drag-and-drop.
      const opts = await api('/api/publish/options');

      // Show a modal with the export summary and publish choices. Rather than
      // building a whole modal UI from scratch, replace the preview temporarily
      // with the publish card — the sender is done editing for the moment anyway.
      showPublishCard(result, opts);
    } catch (err) {
      setStatus(err.message || 'Export failed.', 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });
}

function showPublishCard(result, opts) {
  const stage = $('stage');
  stage.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center;
                height: 100%; padding: 2rem; background: var(--bg);">
      <div style="max-width: 500px; background: var(--panel); border: 1px solid var(--line);
                  border-radius: var(--radius); padding: 2rem;">
        <h2 style="font-size: 1.4rem; color: var(--gold); margin-bottom: 1rem;">
          Ready to publish
        </h2>
        <p style="margin-bottom: 1.5rem; color: var(--ink-dim); line-height: 1.6;">
          Built <b>${result.frames}</b> frame${result.frames > 1 ? 's' : ''},
          <b>${(result.totalBytes / 1024).toFixed(0)} KB</b> total.
          ${result.hasMusic ? 'Music included.' : ''}
        </p>
        ${opts.cli.authenticated ? `
          <button id="publish-cli-btn" class="btn primary" style="margin-bottom: 0.8rem;">
            Publish now
          </button>
          <p style="font-size: 12px; color: var(--ink-dim); margin-bottom: 1.5rem;">
            Uses Netlify CLI — the link appears here in ~30 seconds.
          </p>
        ` : ''}
        <button id="publish-drop-btn" class="btn ${opts.cli.authenticated ? 'ghost' : 'primary'}">
          ${opts.cli.authenticated ? 'Or download & drag to Netlify Drop' : 'Download & drag to Netlify Drop'}
        </button>
        <p style="font-size: 12px; color: var(--ink-dim); margin-top: 0.8rem;">
          ${opts.cli.authenticated ? 'No CLI install needed.' : 'No account needed — just drag the zip in.'}
        </p>
        <div id="publish-result" style="margin-top: 1.5rem; display: none;"></div>
        <button id="publish-back-btn" class="btn ghost" style="margin-top: 1.5rem;">
          Back to Studio
        </button>
      </div>
    </div>
  `;

  $('publish-back-btn').addEventListener('click', () => location.reload());

  if (opts.cli.authenticated) {
    $('publish-cli-btn').addEventListener('click', async () => {
      const btn = $('publish-cli-btn');
      btn.disabled = true;
      btn.textContent = 'Deploying...';
      const resultBox = $('publish-result');
      resultBox.style.display = 'block';
      resultBox.innerHTML = '<p style="color: var(--ink-dim);">Uploading to Netlify...</p>';

      try {
        const res = await api('/api/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
        resultBox.innerHTML = `
          <p style="color: var(--ok); font-weight: 600; margin-bottom: 0.8rem;">Published!</p>
          <a href="${res.url}" target="_blank" rel="noopener"
             style="color: var(--gold); word-break: break-all; text-decoration: underline;">
            ${res.url}
          </a>
          <div style="margin-top: 1rem;">
            <img src="/api/qr?url=${encodeURIComponent(res.url)}" alt="QR code"
                 style="width: 180px; height: 180px; border: 4px solid var(--line); border-radius: 8px;">
            <p style="font-size: 12px; color: var(--ink-dim); margin-top: 0.5rem;">
              Scan with your phone to test it.
            </p>
          </div>
        `;
      } catch (err) {
        resultBox.innerHTML = `<p style="color: var(--danger);">${escapeHtml(err.message || 'Deploy failed.')}</p>`;
      }
    });
  }

  $('publish-drop-btn').addEventListener('click', async () => {
    // Download the zip, then open the Drop page. The sender drags the file in
    // and gets a URL. This always works, even on a fresh install.
    const a = document.createElement('a');
    a.href = '/api/export/zip';
    a.download = 'gift.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => window.open(opts.dropUrl, '_blank'), 500);
  });
}

// ── Boot ────────────────────────────────────────────────────────────────────

async function boot() {
  const body = await api('/api/state');
  state = body.state;
  limits = body.limits;

  $('f-name').value = state.name || '';
  $('f-letter').value = state.letter || '';
  $('f-candles').value = state.candles ?? 5;
  $('f-volume').value = Math.round((state.musicVolume ?? 0.45) * 100);
  $('vol-out').textContent = `${$('f-volume').value}%`;
  $('letter-count').textContent = String((state.letter || '').length);

  bindFields();
  bindDropzone();
  bindReorder();
  bindMusic();
  bindPreviewControls();
  bindPublish();

  renderFrames();
  renderMusic();
  refreshValidation();
  reloadPreview();
}

boot();
