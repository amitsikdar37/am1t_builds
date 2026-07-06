// app.js — Frontend logic for Website Cloner
// Handles form submission, SSE progress streaming, UI state management

/* ── State ─────────────────────────────────────────────────────────────────── */
let currentSessionId = null;
let currentBundleId  = null;
let eventSource      = null;
let clonePoller      = null;  // Interval that polls for generated clone

/* ── DOM refs ──────────────────────────────────────────────────────────────── */
const cloneForm       = document.getElementById('cloneForm');
const urlInput        = document.getElementById('urlInput');
const cloneBtn        = document.getElementById('cloneBtn');
const pipelineSection = document.getElementById('pipelineSection');

const phase1Card    = document.getElementById('phase1Card');
const phase2Card    = document.getElementById('phase2Card');
const phase1Status  = document.getElementById('phase1Status');
const phase2Status  = document.getElementById('phase2Status');
const terminalBody  = document.getElementById('terminalBody');

const aiWaiting       = document.getElementById('aiWaiting');
const bundleSummary   = document.getElementById('bundleSummary');
const bundleStats     = document.getElementById('bundleStats');
const paletteRow      = document.getElementById('paletteRow');
const generateCloneBtn= document.getElementById('generateCloneBtn');
const actionHint      = document.getElementById('actionHint');

const previewSection  = document.getElementById('previewSection');
const screenshotImg   = document.getElementById('screenshotImg');
const cloneIframe     = document.getElementById('cloneIframe');
const tabCloneBtn     = document.getElementById('tabClone');
const filesSection    = document.getElementById('filesSection');
const filesGrid       = document.getElementById('filesGrid');
const historyGrid     = document.getElementById('historyGrid');

/* ── Step tracking ─────────────────────────────────────────────────────────── */
const stepKeywords = {
  browser:    ['chromium', 'browser', 'launching'],
  navigate:   ['navigating', 'navigate', 'goto'],
  screenshot: ['screenshot'],
  html:       ['html', 'rendered'],
  css:        ['css', 'stylesheet'],
  tokens:     ['metadata', 'design token', 'computed', 'color', 'font'],
  assets:     ['asset', 'inventory', 'javascript', 'palette', 'section'],
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
      // Mark previous steps done
      const keys = Object.keys(stepKeywords);
      const idx = keys.indexOf(key);
      keys.slice(0, idx).forEach(k => markStep(k, 'done'));
      markStep(key, 'running');
      break;
    }
  }
  // If phase 1 complete message
  if (lc.includes('phase 1 complete') || lc.includes('bundle saved')) {
    Object.keys(stepKeywords).forEach(k => markStep(k, 'done'));
  }
}

/* ── Terminal logger ───────────────────────────────────────────────────────── */
function logToTerminal(message, type = 'normal') {
  const now = new Date();
  const time = now.toTimeString().slice(0, 8);

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

  // Reset UI
  resetUI();
  pipelineSection.style.display = 'block';
  pipelineSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Disable form
  cloneBtn.disabled = true;
  cloneBtn.querySelector('.btn-text').textContent = 'Cloning...';

  // Start clone request
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

    // Subscribe to SSE
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

  eventSource.onmessage = (e) => {
    const data = JSON.parse(e.data);
    handleEvent(data);
  };

  eventSource.onerror = () => {
    // SSE closed after completion — normal
    eventSource.close();
  };
}

function handleEvent(data) {
  switch (data.type) {

    case 'connected':
      logToTerminal('Connected to progress stream...', 'normal');
      phase1Card.classList.add('active');
      setStatus(phase1Status, 'running', 'Running...');
      break;

    case 'phase':
      logToTerminal(data.message, 'normal');
      break;

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

/* ── Phase 1 complete ──────────────────────────────────────────────────────── */
async function handlePhase1Complete(data) {
  logToTerminal('✅ Phase 1 complete!', 'success');
  setStatus(phase1Status, 'done', 'Done');
  phase1Card.classList.remove('active');
  Object.keys(stepKeywords).forEach(k => markStep(k, 'done'));

  // Show screenshot
  if (data.screenshotUrl) {
    screenshotImg.src = data.screenshotUrl;
    previewSection.style.display = 'block';
  }

  // Fetch bundle info
  try {
    const resp = await fetch(`/api/bundle/${currentBundleId}`);
    const bundle = await resp.json();
    renderBundleSummary(bundle, data.summary);
    renderFilesList(bundle.files);
  } catch (_) {}

  // Activate Phase 2
  phase2Card.classList.add('active');
  setStatus(phase2Status, 'running', 'Ready for Antigravity');
  aiWaiting.style.display = 'none';
  bundleSummary.style.display = 'block';
  generateCloneBtn.style.display = 'inline-flex';

  actionHint.textContent =
    '💬 Click above to copy context for Antigravity chat. ' +
    'Once Antigravity generates the clone it will auto-appear here!';

  filesSection.style.display = 'block';
  resetFormBtn();

  // Start polling for the AI-generated clone
  pollForClone(currentBundleId);

  // Update history
  loadHistory();
}

/* ── Bundle Summary render ─────────────────────────────────────────────────── */
function renderBundleSummary(bundle, summary) {
  const stats = summary?.stats || {};
  const palette = [];

  bundleStats.innerHTML = [
    { value: stats.cssFilesIntercepted || '—', label: 'CSS Files' },
    { value: stats.imagesFound || '—',          label: 'Images' },
    { value: stats.colorTokens || '—',          label: 'Colors' },
    { value: stats.htmlSize || '—',             label: 'HTML Size' },
    { value: stats.cssSize  || '—',             label: 'CSS Size' },
    { value: bundle.files?.length || '—',       label: 'Files' },
  ].map(s => `
    <div class="stat-chip">
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');

  // Render palette
  paletteRow.innerHTML = '';
  if (summary?.stats?.fonts) {
    // Palette is fetched below
  }

  // Try fetch palette.json
  fetch(`/bundle/${currentBundleId}/palette.json`)
    .then(r => r.json())
    .then(p => {
      paletteRow.innerHTML = (p.palette || []).map(hex =>
        `<div class="palette-swatch" style="background:${hex}" title="${hex}"></div>`
      ).join('');
    })
    .catch(() => {});
}

/* ── File list render ──────────────────────────────────────────────────────── */
const FILE_ICONS = {
  png: '🖼️', jpg: '🖼️', html: '📄', css: '🎨',
  js: '⚡', json: '🗃️', log: '📝',
};

function renderFilesList(files) {
  filesGrid.innerHTML = files.map(f => {
    const ext = f.name.split('.').pop().toLowerCase();
    const icon = FILE_ICONS[ext] || '📁';
    return `
      <div class="file-chip">
        <span class="file-chip-icon">${icon}</span>
        <div class="file-chip-info">
          <div class="file-chip-name">${f.name}</div>
          <div class="file-chip-size">${f.size}</div>
        </div>
      </div>
    `;
  }).join('');
}

/* ── Generate Clone button ─────────────────────────────────────────────────── */
generateCloneBtn.addEventListener('click', () => {
  // Copy bundle context to clipboard for Antigravity
  const ctx = buildAntigravityContext();
  navigator.clipboard.writeText(ctx).then(() => {
    generateCloneBtn.textContent = '✅ Context copied — paste it in Antigravity chat!';
    generateCloneBtn.disabled = true;
    setTimeout(() => {
      generateCloneBtn.innerHTML = '<span>🤖</span> Generate Clone with Antigravity';
      generateCloneBtn.disabled = false;
    }, 4000);
  }).catch(() => {
    alert('Bundle ID: ' + currentBundleId + '\n\nTell Antigravity: "Generate the clone for bundleId: ' + currentBundleId + '"');
  });
});

/* ── Clone Polling ─────────────────────────────────────────────────────────── */
function pollForClone(bundleId) {
  if (clonePoller) clearInterval(clonePoller);

  let attempts = 0;
  const MAX_ATTEMPTS = 60; // Poll for up to ~5 minutes

  clonePoller = setInterval(async () => {
    attempts++;
    if (attempts > MAX_ATTEMPTS) {
      clearInterval(clonePoller);
      clonePoller = null;
      return;
    }

    try {
      const resp = await fetch(`/api/output/${bundleId}/check`);
      const data = await resp.json();

      if (data.exists) {
        clearInterval(clonePoller);
        clonePoller = null;
        loadClonePreview(data.url, data.size, data.generatedAt);
      }
    } catch (_) { /* network hiccup, keep polling */ }
  }, 5000); // every 5 seconds
}

function loadClonePreview(cloneUrl, size, generatedAt) {
  // Load clone into iframe
  cloneIframe.src = cloneUrl;

  // Activate the Clone tab with a success badge
  tabCloneBtn.innerHTML = `⚡ Generated Clone <span class="clone-ready-badge">Ready!</span>`;
  tabCloneBtn.disabled = false;
  tabCloneBtn.style.pointerEvents = 'auto';

  // Update phase 2 status
  setStatus(phase2Status, 'done', 'Clone Generated!');

  // Add download + open link below the action hint
  const downloadLink = document.createElement('div');
  downloadLink.className = 'clone-download-bar';
  downloadLink.innerHTML = `
    <span class="clone-size-badge">📄 ${size || ''}</span>
    <a href="${cloneUrl}" target="_blank" class="clone-open-btn">🔗 Open Clone</a>
    <a href="${cloneUrl}" download="clone.html" class="clone-dl-btn">⬇️ Download HTML</a>
  `;
  // Avoid duplicates
  const oldBar = document.querySelector('.clone-download-bar');
  if (oldBar) oldBar.remove();
  actionHint.insertAdjacentElement('afterend', downloadLink);

  actionHint.textContent = `✅ Clone generated by Antigravity${generatedAt ? ' · ' + new Date(generatedAt).toLocaleTimeString() : ''}. Click the "Generated Clone" tab to preview it.`;

  // Auto-switch to clone tab
  switchTab('clone');

  logToTerminal('⚡ Clone detected! Loading preview...', 'success');
}

function buildAntigravityContext() {
  return [
    `Generate a complete website clone for the following harvested bundle.`,
    `Bundle ID: ${currentBundleId}`,
    `Bundle directory on server: harvested_bundle/${currentBundleId}`,
    ``,
    `Files available:`,
    `  - raw.html                (full rendered HTML)`,
    `  - styles.css              (all CSS merged including @keyframes)`,
    `  - metadata.json           (colors, fonts, headings, images, DOM structure)`,
    `  - computed_styles.json    (computed styles for key elements)`,
    `  - sections.json           (page sections with bg colors)`,
    `  - palette.json            (dominant color palette)`,
    `  - animations.json         (⭐ NEW: GSAP configs, CSS keyframes, scroll triggers, Webflow IX2, animated elements, scroll-state snapshots)`,
    `  - screenshot_full.png     (full-page screenshot)`,
    `  - screenshot_viewport.png (above-the-fold screenshot)`,
    `  - scroll_0pct.png         (page at 0% scroll — for animation start states)`,
    `  - scroll_10pct.png        (page at 10% scroll)`,
    `  - scroll_20pct.png        (page at 20% scroll)`,
    `  - scroll_30pct.png        (page at 30% scroll)`,
    `  - scroll_40pct.png        (page at 40% scroll)`,
    `  - scroll_50pct.png        (page at 50% scroll)`,
    `  - scroll_60pct.png        (page at 60% scroll)`,
    `  - scroll_70pct.png        (page at 70% scroll)`,
    `  - scroll_80pct.png        (page at 80% scroll)`,
    `  - scroll_90pct.png        (page at 90% scroll)`,
    `  - scroll_100pct.png       (page at 100% scroll)`,
    ``,
    `CRITICAL INSTRUCTIONS:`,
    `1. READ animations.json carefully — it contains the exact animation library stack (GSAP, Lenis, AOS, etc.), all CSS @keyframes, GSAP ScrollTrigger instances, and per-element computed states at multiple scroll positions.`,
    `2. COMPARE the scroll-state screenshots (scroll_0pct.png through scroll_100pct.png) to understand what elements animate in/out as the user scrolls.`,
    `3. REPLICATE all scroll-triggered animations: if GSAP is detected, use GSAP + ScrollTrigger. If AOS is detected, use AOS. If Lenis is detected, add smooth scroll. If Webflow IX2 is detected, replicate the interactions with CSS+JS.`,
    `4. RECONSTRUCT text reveal animations (split lines, fade-in, slide-up) for headings and body text.`,
    `5. REPLICATE parallax effects for hero images and background elements.`,
    `6. Use CDN links for detected libraries (e.g. gsap from cdnjs, aos from cdnjs).`,
    ``,
    `Please read ALL these files and generate a single self-contained index.html clone with faithful animation recreation.`,
  ].join('\n');
}


/* ── Preview tabs ──────────────────────────────────────────────────────────── */
document.getElementById('tabOriginal').addEventListener('click', () => switchTab('original'));
document.getElementById('tabClone').addEventListener('click',    () => {
  // If clone not yet loaded, try checking now
  if (currentBundleId && (!cloneIframe.src || cloneIframe.src === window.location.href)) {
    fetch(`/api/output/${currentBundleId}/check`)
      .then(r => r.json())
      .then(data => { if (data.exists) loadClonePreview(data.url, data.size, data.generatedAt); })
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

    // For each bundle, check if a clone exists
    const bundleChecks = bundles.slice(-12).reverse().map(async b => {
      const s = b.summary;
      const thumb = `/bundle/${b.bundleId}/screenshot_viewport.png`;
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
          <img class="history-card-thumb" src="${thumb}" alt="${escapeHtml(s.title || '')}" loading="lazy" onerror="this.style.display='none'" onclick="window.open('/bundle/${b.bundleId}/screenshot_full.png','_blank')" style="cursor:pointer" />
          <div class="history-card-body">
            <div class="history-card-title">${escapeHtml(s.title || 'Untitled')}</div>
            <div class="history-card-url">${escapeHtml(s.url || '')}</div>
            <div class="history-card-meta">Cloned ${formatDate(s.harvestedAt)}</div>
            ${cloneLink}
          </div>
        </div>
      `;
    });
    historyGrid.innerHTML = (await Promise.all(bundleChecks)).join('');
  } catch (_) {}
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString();
}

/* ── Reset helpers ─────────────────────────────────────────────────────────── */
function resetUI() {
  terminalBody.innerHTML = '';
  bundleStats.innerHTML  = '';
  paletteRow.innerHTML   = '';
  filesGrid.innerHTML    = '';
  screenshotImg.src      = '';
  cloneIframe.src        = '';

  // Reset clone tab label
  tabCloneBtn.innerHTML = '⚡ Generated Clone';

  // Remove any download bar
  const oldBar = document.querySelector('.clone-download-bar');
  if (oldBar) oldBar.remove();

  phase1Card.classList.remove('active');
  phase2Card.classList.remove('active');

  setStatus(phase1Status, 'idle', 'Waiting...');
  setStatus(phase2Status, 'idle', 'Waiting for Phase 1...');

  document.querySelectorAll('.step-item').forEach(el => el.classList.remove('done', 'running'));

  aiWaiting.style.display     = 'flex';
  bundleSummary.style.display = 'none';
  previewSection.style.display = 'none';
  filesSection.style.display  = 'none';
  generateCloneBtn.style.display = 'none';
  generateCloneBtn.disabled = false;
  generateCloneBtn.innerHTML = '<span>🤖</span> Generate Clone with Antigravity';
  actionHint.textContent = '';
  currentSessionId = null;
  currentBundleId  = null;
  if (eventSource) { eventSource.close(); eventSource = null; }
  if (clonePoller) { clearInterval(clonePoller); clonePoller = null; }
}

function resetFormBtn() {
  cloneBtn.disabled = false;
  cloneBtn.querySelector('.btn-text').textContent = 'Clone It';
}

/* ── Init ──────────────────────────────────────────────────────────────────── */
loadHistory();
