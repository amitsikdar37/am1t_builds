"""
main.py — DoomScroll Punisher Entry Point
==========================================
Orchestrates the full punishment pipeline:

  Monitor (bg thread)  →  detects distraction
       ↓
  Screenshot  →  Gemini AI roast  →  Kill browsers
       ↓
  TTS speaks insult  →  Fullscreen lockdown overlay
       ↓
  User clicks dismiss  →  Monitor resumes

Usage:
    python main.py

Requires GEMINI_API_KEY in a .env file or as an environment variable.
"""

import os
import sys
import io
import signal
import logging
import tkinter as tk

from dotenv import load_dotenv

from monitor import WindowMonitor
from analyzer import capture_screenshot, analyze_distraction
from punisher import PunishmentOverlay
from executioner import speak_roast, kill_browsers

# ── Force UTF-8 output on Windows terminals ─────────────────────────
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ── Load .env & configure API key ────────────────────────────────────
load_dotenv()
API_KEY = os.environ.get("GEMINI_API_KEY")

# ── Logging ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("DoomScrollPunisher")


# ══════════════════════════════════════════════════════════════════════
#  Application Core
# ══════════════════════════════════════════════════════════════════════

class DoomScrollPunisher:
    """Main application class — owns the Tk root and coordinates all modules."""

    def __init__(self):
        # Hidden root window (only surfaces Toplevel overlays)
        self._root = tk.Tk()
        self._root.withdraw()
        self._root.title("DoomScrollPunisher — Engine")

        # Sub-systems
        self._overlay = PunishmentOverlay(self._root)
        self._monitor = WindowMonitor(on_distraction_detected=self._on_distraction)

        # Pipeline guard — prevents double-firing
        self._pipeline_active = False

    # ── Start ────────────────────────────────────────────────────────

    def start(self):
        """Boot the monitor and enter the Tk main loop."""
        self._print_banner()

        if not API_KEY:
            logger.warning(
                "⚠️  GEMINI_API_KEY not found — the app will still work, "
                "but roasts will be generic fallbacks."
            )

        self._monitor.start()

        # Graceful Ctrl+C handling inside Tk's mainloop
        signal.signal(signal.SIGINT, lambda *_: self._shutdown())
        self._root.after(200, self._keep_alive)  # keeps Tk responsive to signals

        try:
            self._root.mainloop()
        except KeyboardInterrupt:
            self._shutdown()

    def _keep_alive(self):
        """Periodic no-op so Tk doesn't block signal handling."""
        self._root.after(500, self._keep_alive)

    # ── Distraction Callback (from monitor thread) ───────────────────

    def _on_distraction(self, window_title: str):
        """
        Called from the monitor's daemon thread.
        Schedules the punishment pipeline on the main (Tk) thread.
        """
        self._root.after(0, lambda: self._execute_pipeline(window_title))

    # ── Punishment Pipeline ──────────────────────────────────────────

    def _execute_pipeline(self, window_title: str):
        """Full punishment sequence — runs on the main thread."""
        if self._pipeline_active:
            return
        self._pipeline_active = True

        logger.info("=" * 55)
        logger.info("🚨  EXECUTION PIPELINE TRIGGERED")
        logger.info("    Offending window: '%s'", window_title)
        logger.info("=" * 55)

        # Step 1 — Screenshot
        logger.info("Capturing screenshot...")
        image = capture_screenshot()

        # Step 2 — AI Analysis
        logger.info("Consulting Gemini for maximum savagery...")
        roast = analyze_distraction(image, window_title, api_key=API_KEY)
        logger.info("Roast: %s", roast)

        # Step 3 — OVERLAY FIRST (instant visual lockdown)
        logger.info("Launching punishment overlay...")
        self._overlay.launch(roast_text=roast, on_dismiss=self._on_dismiss)

        # Step 4 — Kill browsers (while overlay is showing)
        logger.info("Terminating browser processes...")
        kill_browsers()

        # Step 5 — TTS speaks while user stares at the overlay
        logger.info("Speaking roast aloud...")
        speak_roast(roast)

    # ── Dismiss Callback ─────────────────────────────────────────────

    def _on_dismiss(self):
        """User clicked '[ I WILL GO BACK TO WORK ]'."""
        self._pipeline_active = False
        logger.info("✅  User has sworn to return to work. Resuming surveillance…")
        self._monitor.resume()

    # ── Shutdown ─────────────────────────────────────────────────────

    def _shutdown(self):
        """Clean exit."""
        logger.info("Shutting down DoomScrollPunisher…")
        self._monitor.stop()
        try:
            self._root.destroy()
        except tk.TclError:
            pass
        sys.exit(0)

    # ── Banner ───────────────────────────────────────────────────────

    @staticmethod
    def _print_banner():
        banner = r"""
  +===========================================================+
  |                                                           |
  |     ____   ___   ___  __  __                              |
  |    |  _ \ / _ \ / _ \|  \/  |                             |
  |    | | | | | | | | | | |\/| |                             |
  |    | |_| | |_| | |_| | |  | |                             |
  |    |____/ \___/ \___/|_|  |_|                             |
  |          S C R O L L   P U N I S H E R                    |
  |                                                           |
  |    Watching for brainrot... Stay productive.              |
  |                                                           |
  +===========================================================+
        """
        try:
            print(banner)
        except UnicodeEncodeError:
            print("\n  [DOOM SCROLL PUNISHER] Active. Watching for brainrot...\n")


# ══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    app = DoomScrollPunisher()
    app.start()
