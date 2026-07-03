"""
╔══════════════════════════════════════════════════════════════════╗
║         EXECUTION MANAGER — Zero-Keystroke Voice Architect       ║
║         Prompt builder · agy subprocess launcher · stream relay  ║
╚══════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import os
import re
import subprocess
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    _WATCHDOG_OK = True
except ImportError:
    _WATCHDOG_OK = False

from audio_listener import VoiceCommand
from console_ui import ConsoleUI, ListenerState


# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

# Token patterns to strip from the wake-word prefix before building the prompt
_WAKE_WORD_PATTERNS = re.compile(
    r"^(antigravity|hey agent|hey antigravity)[,\s]*",
    flags=re.IGNORECASE,
)

# Heuristic line-prefix routing: if a line mentions browser/test/navigate etc.
# route it to the BROWSER agent label, otherwise ARCHITECT.
_BROWSER_KEYWORDS = re.compile(
    r"\b(browser|navigate|click|screenshot|puppeteer|playwright|selenium|url|http)\b",
    flags=re.IGNORECASE,
)

# How long to wait (seconds) after a process ends before accepting next command
COOLDOWN_SECONDS: float = 3.0

# Prompt template: clean, direct task description passed to agy.
# No 'Autonomous Task' or 'antigravity' keywords — those trigger agy's own
# skill guide instead of building what the user asked for.
_PROMPT_TEMPLATE = "{voice_text}"


# ─────────────────────────────────────────────────────────────────────────────
# Data
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ExecutionResult:
    prompt:       str
    return_code:  int
    elapsed:      float
    aborted:      bool = False


class AutoBootstrapper(FileSystemEventHandler if _WATCHDOG_OK else object):
    """Watches the scratch directory for file changes and auto-boots Vite/React dev servers."""
    def __init__(self, ui: ConsoleUI):
        self._ui = ui
        self._dashboard = ui._dashboard
        self._bootstrapped_dirs = set()
        self._lock = threading.Lock()
        self._dev_processes = []

    def on_created(self, event):
        self._handle_event(event)

    def on_modified(self, event):
        self._handle_event(event)

    def _handle_event(self, event):
        if event.is_directory:
            return
        
        path = event.src_path
        directory = os.path.dirname(path)
        filename = os.path.basename(path)

        # 1. Always notify dashboard to live reload static files
        if self._dashboard:
            self._dashboard.set_preview_dir(directory)
            self._dashboard.push_file_created(filename)

        # 2. Check for package.json to bootstrap bundlers
        if filename == "package.json":
            with self._lock:
                if directory in self._bootstrapped_dirs:
                    return
                self._bootstrapped_dirs.add(directory)
            
            # Start background bootstrap thread
            threading.Thread(target=self._bootstrap_project, args=(directory,), daemon=True).start()

    def _bootstrap_project(self, directory: str) -> None:
        self._ui.print_info(f"📦  Detected package.json. Auto-bootstrapping dev server in background...")
        
        # npm install
        try:
            subprocess.run(["npm", "install"], cwd=directory, shell=True, check=True, capture_output=True)
            self._ui.print_info(f"✅  Dependencies installed for {os.path.basename(directory)}")
        except subprocess.CalledProcessError as e:
            self._ui.print_error(f"Failed to install dependencies: {e.stderr.decode('utf-8', errors='replace')}")
            return

        # npm run dev
        try:
            proc = subprocess.Popen(
                ["npm", "run", "dev"], 
                cwd=directory, 
                shell=True, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
            self._dev_processes.append(proc)

            # Scrape output for localhost URL
            url_re = re.compile(r'http://localhost:(\d+)\b', re.IGNORECASE)
            for line in proc.stdout:
                m = url_re.search(line)
                if m and self._dashboard:
                    url = f"http://localhost:{m.group(1)}"
                    self._ui.print_info(f"🌐  Live Dev Server Online: {url}")
                    # Switch dashboard iframe to live server!
                    self._dashboard.set_preview_url(url)
                    break
                    
            # Let it run in background...
        except Exception as e:
            self._ui.print_error(f"Failed to start dev server: {e}")

    def stop_all(self):
        for proc in self._dev_processes:
            try:
                proc.terminate()
            except OSError:
                pass


# ─────────────────────────────────────────────────────────────────────────────
# ExecutionManager
# ─────────────────────────────────────────────────────────────────────────────

class ExecutionManager:
    """
    Manages the full Antigravity agent lifecycle for a single voice command.

    Responsibilities
    ----------------
    * Strip wake-word tokens from raw transcript.
    * Build the structured engineering prompt.
    * Launch `agy run "…"` as an async subprocess inside the workspace dir.
    * Relay stdout/stderr to the ConsoleUI with agent-name prefixes.
    * Enforce the cooldown lock on the AudioListener after completion.
    """

    def __init__(
        self,
        ui: ConsoleUI,
        workspace: Path,
        on_cooldown_change: Optional[callable] = None,  # type: ignore[valid-type]
    ) -> None:
        self._ui                   = ui
        self._workspace            = workspace
        self._on_cooldown_change   = on_cooldown_change or (lambda active: None)

        self._active_proc: Optional[subprocess.Popen] = None  # type: ignore[type-arg]
        self._exec_thread:  Optional[threading.Thread] = None
        self._busy          = threading.Event()
        self._bootstrapper  = None
        self._observer      = None

        if _WATCHDOG_OK:
            self._bootstrapper = AutoBootstrapper(self._ui)
            self._observer = Observer()
            # Watch both workspace and scratch
            scratch_dir = os.path.expanduser("~/.gemini/antigravity-cli/scratch")
            if os.path.exists(scratch_dir):
                self._observer.schedule(self._bootstrapper, scratch_dir, recursive=True)
            self._observer.schedule(self._bootstrapper, str(self._workspace), recursive=True)
            self._observer.start()

    # ── Public API ───────────────────────────────────────────────────────────

    @property
    def is_busy(self) -> bool:
        return self._busy.is_set()

    def submit(self, cmd: VoiceCommand) -> bool:
        """
        Non-blocking submit. Returns False if already busy.
        Spawns a thread to run the agent lifecycle.
        """
        if self._busy.is_set():
            return False

        prompt = self._build_prompt(cmd.raw_text)
        self._exec_thread = threading.Thread(
            target=self._run_lifecycle,
            args=(cmd, prompt),
            name="AgentLifecycleThread",
            daemon=True,
        )
        self._exec_thread.start()
        return True

    def abort(self) -> None:
        """Terminate any running subprocess immediately."""
        proc = self._active_proc
        if proc and proc.poll() is None:
            self._ui.print_warning("🛑  Aborting running Antigravity process…")
            try:
                proc.terminate()
                time.sleep(0.5)
                if proc.poll() is None:
                    proc.kill()
            except OSError:
                pass

    def wait(self) -> None:
        """Block until the current lifecycle completes (used for clean shutdown)."""
        if self._exec_thread and self._exec_thread.is_alive():
            self._exec_thread.join()

    def shutdown(self) -> None:
        """Cleanly shutdown the ExecutionManager, watchdog, and background servers."""
        self.abort()
        self.wait()
        if self._observer:
            self._observer.stop()
            self._observer.join()
        if self._bootstrapper:
            self._bootstrapper.stop_all()

    # ── Internals ────────────────────────────────────────────────────────────

    def _build_prompt(self, raw: str) -> str:
        """
        1. Strip leading wake-word tokens.
        2. Normalize whitespace and remove punctuation run.
        3. Capitalize and wrap in the standard engineering prompt template.
        """
        cleaned = _WAKE_WORD_PATTERNS.sub("", raw).strip()
        # Remove trailing punctuation artifacts
        cleaned = re.sub(r"[?.!,]+$", "", cleaned).strip()
        # Collapse internal whitespace
        cleaned = re.sub(r"\s+", " ", cleaned)
        # Capitalize first character
        if cleaned:
            cleaned = cleaned[0].upper() + cleaned[1:]
        return _PROMPT_TEMPLATE.format(voice_text=cleaned)

    def _run_lifecycle(self, cmd: VoiceCommand, prompt: str) -> None:
        """Full blocking execution in its own thread."""
        self._busy.set()
        self._on_cooldown_change(True)
        self._ui.set_state(ListenerState.ORCHESTRATING, command=cmd.raw_text)
        self._ui.print_info(f"📝  Prompt → {prompt}")

        start = time.monotonic()
        result = self._launch_agy(prompt)
        elapsed = time.monotonic() - start

        if result.return_code == 0:
            self._ui.print_success(
                f"✅  Agent lifecycle complete in {elapsed:.1f}s "
                f"(exit code 0)."
            )

            # Force dashboard to find the newly generated project since agy bypasses stdout pipes
            if self._ui._dashboard:
                import glob
                search_paths = [
                    str(self._workspace),
                    os.path.expanduser("~/.gemini/antigravity-cli/scratch/*"),
                    os.path.expanduser("~/.gemini/antigravity-cli/scratch")
                ]
                latest_dir = None
                latest_time = 0
                for path_pattern in search_paths:
                    for d in glob.glob(path_pattern):
                        if os.path.isdir(d):
                            idx = os.path.join(d, "index.html")
                            if os.path.exists(idx):
                                mtime = os.path.getmtime(idx)
                                if mtime > latest_time:
                                    latest_time = mtime
                                    latest_dir = d
                
                if latest_dir:
                    self._ui._dashboard.set_preview_dir(latest_dir)
                    self._ui.print_info(f"🌐  Auto-previewing latest project: {latest_dir}")
            
            if self._ui._dashboard:
                self._ui._dashboard.set_state("done")
        else:
            code_label = "ABORTED" if result.aborted else str(result.return_code)
            self._ui.print_error(
                f"⛔  Agent lifecycle ended with exit code {code_label} "
                f"after {elapsed:.1f}s."
            )
            if self._ui._dashboard:
                self._ui._dashboard.set_state("error")

        self._ui.print_info(
            f"⏳  Cooldown — next command accepted in {COOLDOWN_SECONDS}s…"
        )
        time.sleep(COOLDOWN_SECONDS)

        self._busy.clear()
        self._on_cooldown_change(False)
        self._ui.set_state(ListenerState.LISTENING)

    def _launch_agy(self, prompt: str) -> ExecutionResult:
        """
        Launch `agy --print "<prompt>"` inside the workspace directory.
        Since CI=true and TERM=dumb are removed, --print will stream thoughts natively!
        """
        cmd_args = ["agy", "--continue", "--print", prompt, "--print-timeout", "30m"]

        self._ui.print_info(
            f"🔧  Launching: agy --continue --print \"...\" in {self._workspace}"
        )

        env = {
            **os.environ, 
            "PYTHONUNBUFFERED": "1"
        }
        aborted = False

        try:
            proc = subprocess.Popen(
                cmd_args,
                cwd=str(self._workspace),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
            )
            self._active_proc = proc

            # Relay stdout and stderr concurrently
            stdout_thread = threading.Thread(
                target=self._relay_stream,
                args=(proc.stdout, "ARCHITECT", True),
                daemon=True,
            )
            stderr_thread = threading.Thread(
                target=self._relay_stream,
                args=(proc.stderr, "BROWSER", False),
                daemon=True,
            )
            stdout_thread.start()
            stderr_thread.start()

            proc.wait()
            stdout_thread.join(timeout=2.0)
            stderr_thread.join(timeout=2.0)

            rc = proc.returncode

        except FileNotFoundError:
            self._ui.print_error(
                "❌  'agy' command not found. "
                "Ensure Antigravity CLI is installed and on PATH."
            )
            rc = -1
        except KeyboardInterrupt:
            aborted = True
            rc = -2
        finally:
            self._active_proc = None

        return ExecutionResult(
            prompt=prompt,
            return_code=rc,
            elapsed=0.0,
            aborted=aborted,
        )

    def _relay_stream(self, stream, default_agent: str, is_stdout: bool = True) -> None:
        """
        Read lines from a subprocess stream and emit them through the UI.
        Heuristically routes lines containing browser keywords to BROWSER tag.
        Includes a heartbeat if the LLM takes too long to respond.
        """
        if stream is None:
            return
        
        import queue
        q = queue.Queue()
        
        def _reader():
            try:
                for raw_line in iter(stream.readline, ""):
                    q.put(raw_line)
                q.put(None)  # EOF marker
            except Exception:
                q.put(None)
                
        t = threading.Thread(target=_reader, daemon=True)
        t.start()
        
        start_time = time.monotonic()
        last_log_time = start_time
        
        while True:
            try:
                raw_line = q.get(timeout=5.0)
                if raw_line is None:
                    break  # EOF
                line = raw_line.rstrip("\n\r")
                if not line:
                    continue
                agent = (
                    "BROWSER"
                    if _BROWSER_KEYWORDS.search(line)
                    else default_agent
                )
                self._ui.print_agent_line(agent, line)
                last_log_time = time.monotonic()
            except queue.Empty:
                # Provide dynamic, reassuring progress updates for long-running AI tasks
                if is_stdout and time.monotonic() - last_log_time >= 5.0:
                    elapsed = int(time.monotonic() - start_time)
                    if elapsed < 15:
                        msg = "🧠  Analyzing prompt and mapping architecture..."
                    elif elapsed < 35:
                        msg = "🔍  Planning component structure and defining UI..."
                    elif elapsed < 75:
                        msg = "⚡  Generating core HTML, CSS, and layout systems..."
                    elif elapsed < 140:
                        msg = "🔧  Writing JavaScript logic and interactive elements... (This takes a moment)"
                    elif elapsed < 220:
                        msg = "⏳  Finalizing assets and assembling the project... (Almost there)"
                    elif elapsed < 300:
                        msg = "🔄  Performing final code review and optimization... (Hold on!)"
                    else:
                        msg = "📦  Packaging files and ensuring zero-downtime deployment..."
                        
                    self._ui.print_info(f"⏳  [Elapsed: {elapsed}s] {msg}")
                    last_log_time = time.monotonic()
