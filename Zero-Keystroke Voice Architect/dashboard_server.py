"""
╔══════════════════════════════════════════════════════════════════╗
║         DASHBOARD SERVER — Zero-Keystroke Voice Architect        ║
║         Flask SSE server · Real-time build visualization UI      ║
╚══════════════════════════════════════════════════════════════════╝
"""
from __future__ import annotations

import json
import queue
import re
import threading
import time
import webbrowser
from datetime import datetime
from typing import Optional

try:
    from flask import Flask, Response
    _FLASK_OK = True
except ImportError:
    _FLASK_OK = False

# ── State IDs ─────────────────────────────────────────────────────────────────
STATE_IDLE       = "idle"
STATE_LISTENING  = "listening"
STATE_PROCESSING = "processing"
STATE_BUILDING   = "building"
STATE_DONE       = "done"
STATE_ERROR      = "error"

# ── Patterns to extract metadata from agy output ──────────────────────────────
_URL_RE  = re.compile(r'https?://localhost:(\d+)\b', re.IGNORECASE)
_FILE_RE = re.compile(
    r'(?:Create|Write|Edit|Update|Wrote|Created)\s*\(([^)]+)\)',
    re.IGNORECASE,
)
_NPM_RE  = re.compile(r'added\s+\d+\s+packages', re.IGNORECASE)

# ─────────────────────────────────────────────────────────────────────────────
# HTML Dashboard (fully self-contained — embedded as a Python string)
# ─────────────────────────────────────────────────────────────────────────────
_DASHBOARD_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Voice Architect · Live Build</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg: #09090b;
  --term-bg: #09090b;
  --term-text: #e4e4e7;
  --term-dim: #52525b;
  --term-accent: #3b82f6; /* Premium blue */
  --term-success: #10b981;
  --font-ui: 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', Consolas, monospace;
}
html, body {
  height: 100%;
  background: var(--bg);
  color: var(--term-text);
  font-family: var(--font-ui);
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

.app {
  display: flex;
  width: 100vw;
  height: 100vh;
  position: relative;
}

/* --- Layout States --- */
/* Blank State */
.layout-blank .mic-container,
.layout-blank .terminal-panel,
.layout-blank .preview-panel {
  display: none !important;
}

/* Glitch/Listening State */
.layout-glitch .mic-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at center, #18181b 0%, #09090b 100%);
}
.layout-glitch .terminal-panel,
.layout-glitch .preview-panel {
  display: none !important;
}

/* Split Screen State */
.layout-split .mic-container {
  display: none !important;
}
.layout-split .terminal-panel {
  display: flex;
  width: 50%;
  height: 100%;
  flex-direction: column;
  border-right: 1px solid #27272a;
}
.layout-split .preview-panel {
  display: flex;
  width: 50%;
  height: 100%;
  background: #ffffff;
}

/* --- Mic Container --- */
.glitch-wave {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.1);
  box-shadow: 0 0 50px rgba(59, 130, 246, 0.4);
  animation: pulse 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.glitch-wave::after {
  content: 'STANDBY';
  position: absolute;
  bottom: -50px;
  font-weight: 600;
  letter-spacing: 2px;
  color: var(--term-dim);
  transition: all 0.3s;
  font-size: 14px;
}

/* Active State (Processing Wake Word) */
.mic-container.active .glitch-wave {
  background: rgba(16, 185, 129, 0.15);
  box-shadow: 0 0 80px rgba(16, 185, 129, 0.6);
  animation: pulse-fast 1s infinite cubic-bezier(0.4, 0, 0.2, 1);
}
.mic-container.active .glitch-wave::after {
  content: 'LISTENING...';
  color: var(--term-success);
  bottom: -50px;
  font-size: 14px;
}

@keyframes pulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
  70% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(59, 130, 246, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
}
@keyframes pulse-fast {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
  70% { transform: scale(1.1); box-shadow: 0 0 0 30px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

/* --- Terminal Panel --- */
.terminal-panel {
  background: var(--term-bg);
  position: relative;
}

.terminal-header {
  padding: 16px 24px;
  font-weight: 600;
  font-size: 12px;
  border-bottom: 1px solid #27272a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(9, 9, 11, 0.8);
  backdrop-filter: blur(8px);
  z-index: 10;
  color: #a1a1aa;
  display: flex;
  align-items: center;
}
.terminal-header::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--term-accent);
  margin-right: 12px;
  box-shadow: 0 0 8px var(--term-accent);
}

.log-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  font-size: 13px;
  line-height: 1.6;
  font-family: var(--font-mono);
  color: var(--term-text);
  display: flex;
  flex-direction: column;
}
.log-scroll::-webkit-scrollbar { width: 8px; }
.log-scroll::-webkit-scrollbar-track { background: transparent; }
.log-scroll::-webkit-scrollbar-thumb { 
  background: #3f3f46; 
  border-radius: 4px;
}
.log-scroll::-webkit-scrollbar-thumb:hover { background: #52525b; }

.log-entry {
  margin-bottom: 6px;
  word-break: break-all;
  display: flex;
  align-items: flex-start;
}
.log-ts {
  color: var(--term-dim);
  margin-right: 12px;
  user-select: none;
  font-size: 11px;
  padding-top: 2px;
}
.log-msg {
  color: var(--term-text);
  flex: 1;
}
.log-msg.error { color: #ef4444; }
.log-msg.warn { color: #f59e0b; }


/* --- Preview Panel --- */
iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
  transition: opacity 1s ease-in-out;
  opacity: 0;
}
iframe.loaded {
  opacity: 1;
}
.preview-actions {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 100;
  display: flex;
  gap: 10px;
  align-items: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.5s;
}
.preview-actions.visible {
  opacity: 1;
  pointer-events: auto;
}
.status-indicator {
  padding: 6px 14px;
  background: rgba(24, 24, 27, 0.85);
  color: #e4e4e7;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-right: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}
.status-indicator.done {
  color: var(--term-success);
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.05);
}
.status-indicator.error {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.05);
}
.action-btn {
  padding: 7px 14px;
  background: rgba(39, 39, 42, 0.85);
  color: #e4e4e7;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  cursor: pointer;
  backdrop-filter: blur(12px);
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}
.action-btn:hover {
  background: rgba(63, 63, 70, 0.95);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.15);
}

</style>
</head>
<body>

<div class="app layout-blank" id="appRoot">
  <!-- Glitchy Mic Container -->
  <div class="mic-container" id="micContainer">
    <div class="glitch-wave"></div>
  </div>
  
  <!-- Terminal Side (Left) -->
  <div class="terminal-panel" id="terminalPanel">
    <div class="terminal-header" id="terminalHeader">AGY ROOT :: SYSTEM GENERATION</div>
    <div class="log-scroll" id="logScroll"></div>
  </div>

  <!-- Preview Side (Right) -->
  <div class="preview-panel" id="previewPanel">
    <div class="preview-actions" id="previewActions">
      <div class="status-indicator" id="statusIndicator">Building...</div>
      <button class="action-btn" onclick="openFullView()">Open Full View</button>
      <button class="action-btn" onclick="openFolder()">Open Folder</button>
    </div>
    <iframe id="previewFrame" src="about:blank"></iframe>
  </div>
</div>

<script>
let currentState = 'idle';
let previewReady = false;
let hasBuiltOnce = false;

function applyState(state) {
  currentState = state;
  const app = document.getElementById('appRoot');
  const termHeader = document.getElementById('terminalHeader');
  const actions = document.getElementById('previewActions');
  const status = document.getElementById('statusIndicator');
  
  // Manage mic container visual state
  const micContainer = document.getElementById('micContainer');
  if (state === 'processing') {
    micContainer.classList.add('active');
  } else {
    micContainer.classList.remove('active');
  }
  
  if (state === 'building') {
    hasBuiltOnce = true;
    app.className = 'app layout-split';
    termHeader.innerText = 'AGY ROOT :: SYSTEM GENERATION (BUILDING)';
    actions.classList.add('visible');
    status.innerText = 'Building...';
    status.className = 'status-indicator';
  } else if (state === 'done') {
    hasBuiltOnce = true;
    app.className = 'app layout-split';
    termHeader.innerText = 'AGY ROOT :: SYSTEM GENERATION (COMPLETE)';
    actions.classList.add('visible');
    status.innerText = 'Build Complete';
    status.className = 'status-indicator done';
  } else if (state === 'error') {
    hasBuiltOnce = true;
    app.className = 'app layout-split';
    termHeader.innerText = 'AGY ROOT :: SYSTEM GENERATION (ERROR)';
    status.innerText = 'Build Failed';
    status.className = 'status-indicator error';
  } else if (state === 'listening' || state === 'processing') {
    app.className = hasBuiltOnce ? 'app layout-split' : 'app layout-glitch';
  } else if (state === 'idle') {
    app.className = hasBuiltOnce ? 'app layout-split' : 'app layout-blank';
  }
}

function openFullView() {
  const f = document.getElementById('previewFrame');
  if (f.src && f.src !== 'about:blank') {
    window.open(f.src, '_blank');
  }
}

function openFolder() {
  fetch('/open-folder', { method: 'POST' });
}

function addLog(data) {
  const scroll = document.getElementById('logScroll');
  const row = document.createElement('div');
  row.className = 'log-entry';

  const ts = document.createElement('span');
  ts.className = 'log-ts';
  ts.textContent = `[${data.ts}]`;
  row.appendChild(ts);

  const msg = document.createElement('span');
  msg.className = 'log-msg';
  if(data.level === 'ERRO' || data.level === 'ERROR') msg.classList.add('error');
  if(data.level === 'WARN') msg.classList.add('warn');
  
  let text = data.message;
  if(data.agent) {
    text = `<${data.agent}> ${text}`;
  }
  msg.textContent = text;
  row.appendChild(msg);

  scroll.appendChild(row);
  scroll.scrollTop = scroll.scrollHeight;
}

function setPreview(url) {
  const frame = document.getElementById('previewFrame');
  const currentBase = frame.src.split('?')[0];
  const newBase = url.split('?')[0];
  
  if (!currentBase.endsWith(newBase)) {
    // If it's a static preview, always bust the cache to ensure we get the latest changes
    if (url.startsWith('/preview/')) {
      frame.src = url + '?t=' + new Date().getTime();
    } else {
      frame.src = url;
    }
    frame.onload = () => {
      frame.classList.add('loaded');
      previewReady = true;
    };
  } else if (url.startsWith('/preview/')) {
    // If it's the SAME static URL, still force a reload to catch edits
    frame.src = url + '?t=' + new Date().getTime();
  }
}

// Auto-refresh iframe every 12s while building
setInterval(() => {
  const f = document.getElementById('previewFrame');
  if (currentState === 'building' && previewReady && f.src && f.src !== 'about:blank') {
    f.src = f.src;
  }
}, 12000);

let retry = 1000;
function connect() {
  const es = new EventSource('/events');
  retry = 1000;

  es.addEventListener('state', e => {
    const d = JSON.parse(e.data);
    applyState(d.state);
    if (d.preview_url) setPreview(d.preview_url);
  });
  es.addEventListener('log', e => {
    addLog(JSON.parse(e.data));
  });
  es.addEventListener('preview', e => {
    setPreview(JSON.parse(e.data).url);
  });
  es.addEventListener('file', e => {
    const d = JSON.parse(e.data);
    const iframe = document.getElementById('previewFrame');
    
    if (!previewReady && (d.name.endsWith('.html') || d.name.endsWith('.htm'))) {
      setPreview('/preview/index.html');
    } else if (previewReady) {
      // Reload on subsequent file changes IF we are using the static preview server
      // (Dev servers like Vite handle their own HMR, so we ignore them)
      if (iframe.src && iframe.src.includes('/preview/')) {
        // Bust the cache by appending a timestamp query parameter
        const base = iframe.src.split('?')[0];
        iframe.src = base + '?t=' + new Date().getTime();
      }
    }
  });
  es.onerror = () => {
    es.close();
    setTimeout(connect, retry);
    retry = Math.min(retry * 2, 8000);
  };
}

connect();
applyState('idle');
</script>
</body>
</html>"""


# ─────────────────────────────────────────────────────────────────────────────
# DashboardServer
# ─────────────────────────────────────────────────────────────────────────────

class DashboardServer:
    """
    Lightweight Flask SSE dashboard.

    Lifecycle
    ---------
    1. Call start() → Flask binds on DEFAULT_PORT in a daemon thread.
    2. Call open_browser() → browser opens after a short delay.
    3. As events arrive from AudioListener / ExecutionManager, call
       push_log(), set_state(), push_file_created(), set_preview_url().
    4. All connected browser tabs receive live SSE updates.
    """

    DEFAULT_PORT: int = 8765

    def __init__(self, port: int = DEFAULT_PORT) -> None:
        if not _FLASK_OK:
            raise ImportError(
                "Flask is required for the dashboard: "
                "python -m pip install flask"
            )
        from flask import Flask  # local import to keep module loadable

        self._port = port
        self._app  = Flask(__name__, static_folder=None)
        self._clients: list[queue.Queue] = []
        self._lock   = threading.Lock()

        self._state      = STATE_IDLE
        self._command:   Optional[str] = None
        self._preview:   Optional[str] = None
        self._preview_dir: Optional[str] = None

        self._setup_routes()

    # ── Route Setup ───────────────────────────────────────────────────────────

    def _setup_routes(self) -> None:
        app = self._app

        @app.route("/")
        def index():
            return _DASHBOARD_HTML, 200, {"Content-Type": "text/html; charset=utf-8"}

        @app.route("/events")
        def events():
            def generate():
                q: queue.Queue = queue.Queue(maxsize=300)
                with self._lock:
                    self._clients.append(q)
                # Send current state to the new subscriber immediately
                yield self._sse("state", {
                    "state":       self._state,
                    "command":     self._command,
                    "preview_url": self._preview,
                })
                try:
                    while True:
                        try:
                            payload = q.get(timeout=20)
                        except queue.Empty:
                            yield ": heartbeat\n\n"
                            continue
                        if payload is None:
                            break
                        yield payload
                except GeneratorExit:
                    pass
                finally:
                    with self._lock:
                        try:
                            self._clients.remove(q)
                        except ValueError:
                            pass

            return Response(
                generate(),
                mimetype="text/event-stream",
                headers={
                    "Cache-Control":   "no-cache",
                    "X-Accel-Buffering": "no",
                    "Connection":      "keep-alive",
                },
            )

        @app.route("/api/state")
        def api_state():
            from flask import jsonify
            return jsonify({
                "state":       self._state,
                "command":     self._command,
                "preview_url": self._preview,
            })

        @app.route("/preview/<path:filename>")
        def preview_file(filename):
            from flask import send_from_directory, abort, make_response
            if not self._preview_dir:
                abort(404)
            response = make_response(send_from_directory(self._preview_dir, filename))
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            return response

        @app.route("/<path:filename>")
        def catch_all_static(filename):
            from flask import send_from_directory, make_response
            import os
            if self._preview_dir and os.path.exists(os.path.join(self._preview_dir, filename)):
                response = make_response(send_from_directory(self._preview_dir, filename))
                response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
                response.headers['Pragma'] = 'no-cache'
                response.headers['Expires'] = '0'
                return response
            return "", 404

        @app.route("/open-folder", methods=["POST"])
        def open_folder():
            import os, subprocess
            if self._preview_dir and os.path.exists(self._preview_dir):
                # Works on Windows
                subprocess.Popen(f'explorer "{self._preview_dir}"')
                return "", 200
            return "No folder", 404

    # ── Internal helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data)}\n\n"

    def _broadcast(self, event: str, data: dict) -> None:
        payload = self._sse(event, data)
        with self._lock:
            dead = []
            for q in self._clients:
                try:
                    q.put_nowait(payload)
                except queue.Full:
                    dead.append(q)
            for d in dead:
                try:
                    self._clients.remove(d)
                except ValueError:
                    pass

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    def start(self) -> None:
        """Start Flask in a background daemon thread (non-blocking)."""
        import logging
        logging.getLogger("werkzeug").setLevel(logging.ERROR)

        def _run() -> None:
            self._app.run(
                host="127.0.0.1",
                port=self._port,
                threaded=True,
                debug=False,
                use_reloader=False,
            )

        t = threading.Thread(target=_run, name="DashboardThread", daemon=True)
        t.start()
        time.sleep(0.6)   # allow Flask to bind before browser opens

    def open_browser(self, delay: float = 1.4) -> None:
        """Open the dashboard in the default browser after a short delay."""
        def _open() -> None:
            time.sleep(delay)
            webbrowser.open(f"http://localhost:{self._port}")

        threading.Thread(target=_open, name="BrowserOpener", daemon=True).start()

    # ── Public event API ───────────────────────────────────────────────────────

    def set_state(self, state: str, command: Optional[str] = None) -> None:
        """Push a state change to all browser tabs."""
        self._state = state
        if command is not None:
            self._command = command
        self._broadcast("state", {
            "state":       state,
            "command":     self._command,
            "preview_url": self._preview,
        })

    def push_log(
        self,
        level: str,
        message: str,
        agent: Optional[str] = None,
    ) -> None:
        """
        Push a log line to all browser tabs.
        Automatically detects:
          - localhost URLs   → triggers set_preview_url()
          - File creation    → triggers push_file_created()
        """
        ts = datetime.now().strftime("%H:%M:%S")
        data: dict = {"ts": ts, "level": level, "message": message}
        if agent:
            data["agent"] = agent

        # Auto-detect preview URL in output (for manually logged dev servers)
        m = _URL_RE.search(message)
        if m and self._preview is None:
            self.set_preview_url(f"http://localhost:{m.group(1)}")

        self._broadcast("log", data)

    def set_preview_url(self, url: str) -> None:
        """Update the iframe preview URL and notify all tabs."""
        self._preview = url
        self._broadcast("preview", {"url": url})
        
    def set_preview_dir(self, path: str) -> None:
        """Set the local directory to serve preview files from."""
        import os
        self._preview_dir = os.path.abspath(path)
        # Only switch back to static preview if we aren't currently on a live dev server
        if not self._preview or not self._preview.startswith("http://localhost:"):
            self.set_preview_url("/preview/index.html")

    def push_file_created(self, filename: str) -> None:
        """Notify the dashboard that a new file was created by the agent."""
        self._broadcast("file", {"name": filename})
