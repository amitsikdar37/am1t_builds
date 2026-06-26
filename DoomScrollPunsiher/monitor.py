"""
monitor.py — Active Window Listener
====================================
Background daemon thread that polls the active window title every 2 seconds.
When a blocklisted keyword is found, it pauses itself and fires the
distraction callback so the execution pipeline can take over.

Uses ctypes + Windows API directly (GetForegroundWindow / GetWindowTextW)
instead of pygetwindow, which is unreliable on many Windows setups.
"""

import threading
import time
import ctypes
import logging

logger = logging.getLogger(__name__)

# ── Windows API via ctypes ───────────────────────────────────────────
user32 = ctypes.windll.user32


def get_active_window_title() -> str:
    """
    Get the title of the currently focused window using the Win32 API.
    Returns an empty string if no window is focused or the title is blank.
    """
    try:
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return ""
        length = user32.GetWindowTextLengthW(hwnd)
        if length == 0:
            return ""
        buf = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buf, length + 1)
        return buf.value
    except Exception:
        return ""


# ── Blocklisted keywords (checked against lowercase window title) ──
# NOTE: Browser titles show site NAMES, not URLs.
#   e.g. "Shorts - YouTube - Google Chrome", not "youtube.com/shorts"
#   For X.com, titles look like "Home / X - Google Chrome", matched via "/ x"
BLOCKED_KEYWORDS = [
    "youtube",
    "instagram",
    "twitter",
    "reddit",
    "/ x",          # Matches X.com titles like "Home / X", "Notifications / X"
]

POLL_INTERVAL_SECONDS = 2


class WindowMonitor:
    """Watches the active window title for distraction keywords."""

    def __init__(self, on_distraction_detected):
        """
        Args:
            on_distraction_detected: Callable(window_title: str) invoked
                when a blocklisted keyword is found. Called from the
                monitor thread — the callee must handle thread safety.
        """
        self._on_distraction = on_distraction_detected
        self._paused = threading.Event()          # Set = paused
        self._stop_flag = threading.Event()        # Set = shut down
        self._thread = None

    # ── Public Controls ──────────────────────────────────────────────

    def start(self):
        """Launch the polling loop in a daemon thread."""
        self._thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._thread.start()
        logger.info("Window monitor started -- polling every %ds.", POLL_INTERVAL_SECONDS)

    def pause(self):
        """Temporarily suspend polling (idempotent)."""
        self._paused.set()
        logger.info("Window monitor paused.")

    def resume(self):
        """Resume polling after a pause (idempotent)."""
        self._paused.clear()
        logger.info("Window monitor resumed.")

    def stop(self):
        """Permanently shut down the monitor thread."""
        self._stop_flag.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        logger.info("Window monitor stopped.")

    # ── Internal Loop ────────────────────────────────────────────────

    def _poll_loop(self):
        """Core polling loop running on the daemon thread."""
        while not self._stop_flag.is_set():
            # While paused, sleep in short bursts so we can respond to stop
            if self._paused.is_set():
                time.sleep(0.5)
                continue

            title = get_active_window_title()
            if title:
                title_lower = title.lower()
                logger.debug("Polling window: '%s'", title)
                for keyword in BLOCKED_KEYWORDS:
                    if keyword in title_lower:
                        logger.info(
                            "DISTRACTION DETECTED! Window: '%s' matched keyword: '%s'",
                            title,
                            keyword,
                        )
                        self.pause()
                        self._on_distraction(title)
                        break
            else:
                logger.debug("No active window detected or title is empty.")

            time.sleep(POLL_INTERVAL_SECONDS)
