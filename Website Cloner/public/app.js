// app.js — Frontend logic for Website Cloner (Zero-AI architecture)
// Phase 1 = Playwright harvests + assembles the clone automatically.
// No Phase 2. No AI prompt. The clone is ready as soon as Phase 1 finishes.

/* ── State ─────────────────────────────────────────────────────────────────── */
let currentSessionId = null;
let currentBundleId  = null;
let eventSource      = null;

/* ── DOM refs ──────────────────────────────────────────────────────────────── */
const cloneForm       = document.getElementById('cloneForm');
const urlInput        = document.getElementById('urlInput');
const cloneBtn        = document.getElementById('cloneBtn');
const pipelineSection = document.getElementById('pipelineSection');

const phase1Card    = document.getElementById('phase1Card');
const phase1Status  = document.getElementById('phase1Status');
const terminalBody  = document.getElementById('terminalBody');

const previewSection  = document.getElementById('previewSection');
const screenshotImg   = document.getElementById('screenshotImg');
const cloneIframe     = document.getElementById('cloneIframe');
const tabCloneBtn     = document.getElementById('tabClone');
const historyGrid     = document.getElementById('historyGrid');

/* ── Step tracking ─────────────────────────────────────────────────────────── */
const stepKeywords = {
  browser:    ['chromium', 'browser', 'launching'],
  navigate:   ['navigating', 'navigate'],
  screenshot: ['screenshot'],
  html:       ['dom', 'rendered', 'html'],
  css:        ['css', 'stylesheet', 'merging'],
  assemble:   ['assembling', 'self-executing', 'clone'],
};

function markStep(stepKey, state = 'done') {
  const el = document.querySelector(`[data-step="${stepKey}"]`);
  if (!el) return;
  el.classList.remove('running', 'done');
  el.classList.add(state);
}

function detectAndMarkStep(message) {
  const lc = message.toLowerCase();
  for (const [key, keywords] of Object.entries(stepKeywords)) {
    if (keywords.some(k => lc.includes(k))) {
      const keys = Object.keys(stepKeywords);
      const idx = keys.indexOf(key);
      keys.slice(0, idx).forEach(k => markStep(k, 'done'));
      markStep(key, 'running');
      break;
    }
  }
  if (lc.includes('clone complete') || lc.includes('phase 1 complete')) {
    Object.keys(stepKeywords).forEach(k => markStep(k, 'done'));
  }
}

/* ── Terminal logger ───────────────────────────────────────────────────────── */
function logToTerminal(message, type = 'normal') {
  const time = new Date().toTimeString().slice(0, 8);
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  line.innerHTML = `<span class="log-time">${time}</span><span>${escapeHtml(message)}</span>`;
  terminalBody.appendChild(line);
  terminalBody.scrollTop = terminalBody.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── Status helper ─────────────────────────────────────────────────────────── */
function setStatus(el, state, label) {
  const dot   = el.querySelector('.status-dot');
  const lblEl = el.querySelector('.status-label');
  dot.className = `status-dot status-dot--${state}`;
  lblEl.textContent = label;
}

/* ── Form submit ───────────────────────────────────────────────────────────── */
cloneForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;

  resetUI();
  pipelineSection.style.display = 'block';
  pipelineSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  cloneBtn.disabled = true;
  cloneBtn.querySelector('.btn-text').textContent = 'Cloning...';

  try {
    const resp = await fetch('/api/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Server error');

    currentSessionId = data.sessionId;
    currentBundleId  = data.bundleId;

    subscribeToProgress(currentSessionId);
  } catch (err) {
    logToTerminal(`❌ Failed to start: ${err.message}`, 'error');
    resetFormBtn();
  }
});

/* ── SSE subscription ──────────────────────────────────────────────────────── */
function subscribeToProgress(sessionId) {
  if (eventSource) eventSource.close();
  eventSource = new EventSource(`/api/progress/${sessionId}`);
  eventSource.onmessage = (e) => handleEvent(JSON.parse(e.data));
  eventSource.onerror = () => eventSource.close();
}

function handleEvent(data) {
  switch (data.type) {
    case 'connected':
      logToTerminal('Connected to progress stream...', 'normal');
      phase1Card.classList.add('active');
      setStatus(phase1Status, 'running', 'Running...');
      break;

    case 'phase':
    case 'progress':
      logToTerminal(data.message, 'normal');
      detectAndMarkStep(data.message);
      break;

    case 'phase1_complete':
      handlePhase1Complete(data);
      break;

    case 'error':
      logToTerminal(data.message, 'error');
      setStatus(phase1Status, 'error', 'Failed');
      phase1Card.classList.remove('active');
      resetFormBtn();
      break;
  }
}

/* ── Phase 1 complete → show clone instantly ───────────────────────────────── */
async function handlePhase1Complete(data) {
  logToTerminal('✅ Clone assembled! Loading preview...', 'success');
  setStatus(phase1Status, 'done', 'Done');
  phase1Card.classList.remove('active');
  Object.keys(stepKeywords).forEach(k => markStep(k, 'done'));

  // Show screenshot thumbnail
  if (data.screenshotUrl) {
    screenshotImg.src = data.screenshotUrl;
    previewSection.style.display = 'block';
  }

  // Load the clone directly into the iframe — it's already ready in output/
  const cloneUrl = `/output/${currentBundleId}/index.html`;
  loadClonePreview(cloneUrl, null, data.summary?.harvestedAt);

  resetFormBtn();
  loadHistory();
}

/* ── Clone preview ─────────────────────────────────────────────────────────── */
function loadClonePreview(cloneUrl, size, generatedAt) {
  cloneIframe.src = cloneUrl;

  tabCloneBtn.innerHTML = `⚡ Generated Clone <span class="clone-ready-badge">Ready!</span>`;
  tabCloneBtn.disabled = false;
  tabCloneBtn.style.pointerEvents = 'auto';

  // Add open + download links
  const bar = document.createElement('div');
  bar.className = 'clone-download-bar';
  bar.innerHTML = `
    <a href="${cloneUrl}" target="_blank" class="clone-open-btn">🔗 Open Clone in New Tab</a>
    <a href="${cloneUrl}" download="clone.html" class="clone-dl-btn">⬇️ Download HTML</a>
  `;
  const oldBar = document.querySelector('.clone-download-bar');
  if (oldBar) oldBar.remove();

  const phase1Content = document.getElementById('phase1Content');
  if (phase1Content) phase1Content.appendChild(bar);

  switchTab('clone');
  logToTerminal('⚡ Clone ready!', 'success');
}

/* ── Preview tabs ──────────────────────────────────────────────────────────── */
document.getElementById('tabOriginal').addEventListener('click', () => switchTab('original'));
document.getElementById('tabClone').addEventListener('click', () => {
  if (currentBundleId && (!cloneIframe.src || cloneIframe.src === window.location.href)) {
    fetch(`/api/output/${currentBundleId}/check`)
      .then(r => r.json())
      .then(d => { if (d.exists) loadClonePreview(d.url, d.size, d.generatedAt); })
      .catch(() => {});
  }
  switchTab('clone');
});

function switchTab(tab) {
  document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');
  document.getElementById('paneOriginal').style.display = tab === 'original' ? 'block' : 'none';
  document.getElementById('paneClone').style.display    = tab === 'clone'    ? 'block' : 'none';
}

/* ── History ───────────────────────────────────────────────────────────────── */
async function loadHistory() {
  try {
    const resp = await fetch('/api/bundles');
    const data = await resp.json();
    const bundles = (data.bundles || []).filter(b => b.summary);

    if (!bundles.length) {
      historyGrid.innerHTML = '<p class="history-empty">No clones yet. Clone your first site above! ↑</p>';
      return;
    }

    const cards = bundles.slice(-12).reverse().map(async b => {
      const s = b.summary;
      const thumb = `/bundle/${b.bundleId}/screenshot.png`;
      let cloneLink = '';
      try {
        const chk = await fetch(`/api/output/${b.bundleId}/check`);
        const chkData = await chk.json();
        if (chkData.exists) {
          cloneLink = `
            <div class="history-card-clone">
              <a href="${chkData.url}" target="_blank" class="history-clone-link">⚡ View Clone</a>
              <a href="${chkData.url}" download="clone.html" class="history-clone-link history-clone-dl">⬇️ Download</a>
            </div>`;
        }
      } catch (_) {}
      return `
        <div class="history-card">
          <img class="history-card-thumb" src="${thumb}" alt="${escapeHtml(s.title || '')}" loading="lazy"
               onerror="this.style.display='none'" onclick="window.open('${thumb}','_blank')" style="cursor:pointer" />
          <div class="history-card-body">
            <div class="history-card-title">${escapeHtml(s.title || 'Untitled')}</div>
            <div class="history-card-url">${escapeHtml(s.url || '')}</div>
            <div class="history-card-meta">Cloned ${formatDate(s.harvestedAt)}</div>
            ${cloneLink}
          </div>
        </div>`;
    });
    historyGrid.innerHTML = (await Promise.all(cards)).join('');
  } catch (_) {}
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString();
}

/* ── Reset helpers ─────────────────────────────────────────────────────────── */
function resetUI() {
  terminalBody.innerHTML = '';
  screenshotImg.src = '';
  cloneIframe.src   = '';
  tabCloneBtn.innerHTML = '⚡ Generated Clone';
  const oldBar = document.querySelector('.clone-download-bar');
  if (oldBar) oldBar.remove();
  phase1Card.classList.remove('active');
  setStatus(phase1Status, 'idle', 'Waiting...');
  document.querySelectorAll('.step-item').forEach(el => el.classList.remove('done', 'running'));
  previewSection.style.display = 'none';
  currentSessionId = null;
  currentBundleId  = null;
  if (eventSource) { eventSource.close(); eventSource = null; }
}

function resetFormBtn() {
  cloneBtn.disabled = false;
  cloneBtn.querySelector('.btn-text').textContent = 'Clone It';
}

/* ── Init ──────────────────────────────────────────────────────────────────── */
loadHistory();
