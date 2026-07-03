"""
╔══════════════════════════════════════════════════════════════════╗
║         CONSOLE UI — Zero-Keystroke Voice Architect              ║
║         ANSI terminal state machine · color-coded prefixes       ║
╚══════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import io
import sys
import threading
from datetime import datetime
from enum import Enum, auto

# ── Force UTF-8 output on Windows (avoids cp1252 UnicodeEncodeError) ─────────
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout = io.TextIOWrapper(
            sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True
        )
        sys.stderr = io.TextIOWrapper(
            sys.stderr.buffer, encoding="utf-8", errors="replace", line_buffering=True
        )
    except AttributeError:
        pass  # already wrapped or running in an environment without .buffer


# ─────────────────────────────────────────────────────────────────────────────
# ANSI Color Codes
# ─────────────────────────────────────────────────────────────────────────────

class C:
    RESET    = "\033[0m"
    BOLD     = "\033[1m"
    DIM      = "\033[2m"

    # State banner colors
    CYAN     = "\033[96m"
    YELLOW   = "\033[93m"
    GREEN    = "\033[92m"
    RED      = "\033[91m"
    MAGENTA  = "\033[95m"
    BLUE     = "\033[94m"
    WHITE    = "\033[97m"
    ORANGE   = "\033[38;5;208m"

    # Agent prefix colors
    ARCHITECT = "\033[38;5;81m"   # steel blue
    BROWSER   = "\033[38;5;118m"  # lime green

    BG_DARK   = "\033[48;5;234m"  # near-black bg for banners


# ─────────────────────────────────────────────────────────────────────────────
# Listener States
# ─────────────────────────────────────────────────────────────────────────────

class ListenerState(Enum):
    IDLE         = auto()
    LISTENING    = auto()
    PROCESSING   = auto()
    ORCHESTRATING = auto()
    ERROR        = auto()


_STATE_META: dict[ListenerState, tuple[str, str]] = {
    ListenerState.IDLE:          ("⏸️ ", C.DIM    + C.WHITE),
    ListenerState.LISTENING:     ("🎙️ ", C.CYAN              ),
    ListenerState.PROCESSING:    ("🧠 ", C.YELLOW             ),
    ListenerState.ORCHESTRATING: ("🚀 ", C.GREEN              ),
    ListenerState.ERROR:         ("❌ ", C.RED                ),
}

_STATE_LABEL: dict[ListenerState, str] = {
    ListenerState.IDLE:          "STANDBY",
    ListenerState.LISTENING:     "LISTENING FOR ACTIVATE SIGNAL...",
    ListenerState.PROCESSING:    "PROCESSING VOICE PROMPT...",
    ListenerState.ORCHESTRATING: "ORCHESTRATING ANTIGRAVITY AGENTS...",
    ListenerState.ERROR:         "ERROR — CHECK LOGS",
}


# ─────────────────────────────────────────────────────────────────────────────
# ConsoleUI
# ─────────────────────────────────────────────────────────────────────────────

class ConsoleUI:
    """
    Thread-safe, ANSI-powered terminal UI for the Voice Architect bridge.

    All output is serialised through a single internal lock so that
    concurrent agent stdout piping never scrambles the display.
    """

    _BANNER_WIDTH = 68
    _BANNER_LINE  = "-" * 68

    def __init__(self) -> None:
        self._lock  = threading.Lock()
        self._state = ListenerState.IDLE
        self._enable_color = sys.stdout.isatty() or True   # force-on in CI
        self._dashboard = None

    def set_dashboard(self, dashboard) -> None:
        """Bind a dashboard server to mirror UI events to the browser."""
        self._dashboard = dashboard

    # ── State Banner ─────────────────────────────────────────────────────────

    def set_state(self, state: ListenerState, command: str | None = None) -> None:
        self._state = state
        self._print_state_banner(state)
        if self._dashboard:
            # Map enum name to dashboard state strings (e.g. LISTENING -> listening)
            db_state = state.name.lower()
            if db_state == "orchestrating":
                db_state = "building"
            self._dashboard.set_state(db_state, command)

    def _print_state_banner(self, state: ListenerState) -> None:
        icon, color = _STATE_META[state]
        label       = _STATE_LABEL[state]
        ts          = datetime.now().strftime("%H:%M:%S")

        line = (
            f" {icon} {label}"
            f"{' ' * max(0, self._BANNER_WIDTH - len(label) - 12)}"
            f"[{ts}] "
        )

        with self._lock:
            print()
            print(f"{C.BOLD}{color}{C.BG_DARK}{self._BANNER_LINE}{C.RESET}")
            print(f"{C.BOLD}{color}{C.BG_DARK}{line}{C.RESET}")
            print(f"{C.BOLD}{color}{C.BG_DARK}{self._BANNER_LINE}{C.RESET}")
            print()
            sys.stdout.flush()

    # ── Structured Log Lines ──────────────────────────────────────────────────

    def print_info(self, message: str) -> None:
        self._log(C.BLUE, "INFO", message)

    def print_warning(self, message: str) -> None:
        self._log(C.YELLOW, "WARN", message)

    def print_error(self, message: str) -> None:
        self._log(C.RED, "ERRO", message)

    def print_success(self, message: str) -> None:
        self._log(C.GREEN, "DONE", message)

    def _log(self, color: str, level: str, message: str) -> None:
        ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        with self._lock:
            print(
                f"{C.DIM}[{ts}]{C.RESET} "
                f"{C.BOLD}{color}[{level}]{C.RESET} "
                f"{message}"
            )
            sys.stdout.flush()

        if self._dashboard:
            self._dashboard.push_log(level, message)

    # ── Agent Stream Lines ────────────────────────────────────────────────────

    def print_agent_line(self, agent: str, line: str) -> None:
        """
        Pipe a single stdout/stderr line from a running agent subprocess
        with a color-coded agent prefix.

        Supported agent tags: ARCHITECT, BROWSER, (fallback → magenta)
        """
        tag_upper = agent.upper()
        if "ARCHITECT" in tag_upper:
            color = C.ARCHITECT
        elif "BROWSER" in tag_upper:
            color = C.BROWSER
        else:
            color = C.MAGENTA

        ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        with self._lock:
            print(
                f"{C.DIM}[{ts}]{C.RESET} "
                f"{C.BOLD}{color}[AGY-{agent.upper()}]{C.RESET} "
                f"{C.DIM}{line}{C.RESET}"
            )
            sys.stdout.flush()

        if self._dashboard:
            self._dashboard.push_log("INFO", line, agent=agent)

    # ── Startup Header ────────────────────────────────────────────────────────

    def print_header(self) -> None:
        header = (
            "\n"
            "  *** ZERO-KEYSTROKE VOICE ARCHITECT ***\n"
            "  Antigravity Bridge v1.0\n"
        )
        divider = "  " + "=" * 64

        with self._lock:
            print(f"{C.BOLD}{C.CYAN}{header}{C.RESET}")
            print(f"{C.DIM}{C.CYAN}{divider}{C.RESET}")
            print()
            sys.stdout.flush()

    def print_shutdown(self) -> None:
        with self._lock:
            print()
            print(
                f"{C.BOLD}{C.MAGENTA}"
                f"  [STOP] Voice Architect shutting down - "
                f"mic resources released."
                f"{C.RESET}"
            )
            print()
            sys.stdout.flush()
