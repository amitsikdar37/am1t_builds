"""
╔══════════════════════════════════════════════════════════════════╗
║         MAIN APPLICATION LOOP — Zero-Keystroke Voice Architect   ║
║         Entry point · Signal handlers · Clean shutdown           ║
╚══════════════════════════════════════════════════════════════════╝

Usage
─────
    python main.py [--workspace /path/to/project]

Environment (.env)
──────────────────
    AGY_WORKSPACE   Override the target workspace path
    AGY_MODEL       Whisper model size: tiny|base|small|medium (default: base)
    AGY_USE_WHISPER Set to "1" to prefer local faster-whisper over Google STT
"""

from __future__ import annotations

import os
import queue
import signal
import sys
import threading
import argparse
from pathlib import Path

from dotenv import load_dotenv

from audio_listener import AudioListener, AudioEvent, VoiceCommand
from console_ui import ConsoleUI, ListenerState
from dashboard_server import DashboardServer
from execution_manager import ExecutionManager


# ─────────────────────────────────────────────────────────────────────────────
# Bootstrap
# ─────────────────────────────────────────────────────────────────────────────

load_dotenv()


def _resolve_workspace(cli_arg: str | None) -> Path:
    """
    Priority: CLI flag → AGY_WORKSPACE env var → current working directory.
    """
    raw = cli_arg or os.getenv("AGY_WORKSPACE") or os.getcwd()
    workspace = Path(raw).resolve()
    if not workspace.exists():
        print(f"[ERROR] Workspace path does not exist: {workspace}")
        sys.exit(1)
    return workspace


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Zero-Keystroke Voice Architect — Antigravity Bridge",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--workspace", "-w",
        default=None,
        metavar="PATH",
        help="Target project workspace directory (default: CWD or AGY_WORKSPACE env)",
    )
    parser.add_argument(
        "--whisper",
        action="store_true",
        default=os.getenv("AGY_USE_WHISPER", "0") == "1",
        help="Use local faster-whisper engine instead of Google STT",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("AGY_MODEL", "base"),
        choices=["tiny", "base", "small", "medium", "large"],
        help="Whisper model size (only relevant with --whisper)",
    )
    return parser.parse_args()


# ─────────────────────────────────────────────────────────────────────────────
# Application
# ─────────────────────────────────────────────────────────────────────────────

class VoiceArchitectApp:
    """
    Top-level application: wires AudioListener → command queue → ExecutionManager.

    Thread model
    ────────────
    Main thread   : command dispatch loop (queue.get with timeout)
    Listener thread: persistent mic capture (spawned by AudioListener.start)
    Lifecycle thread: agy subprocess + stream relay (spawned by ExecutionManager)
    """

    def __init__(self, workspace: Path, use_whisper: bool, model_size: str) -> None:
        self._workspace    = workspace
        self._use_whisper  = use_whisper
        self._model_size   = model_size
        self._command_q: "queue.Queue[VoiceCommand]" = queue.Queue()
        self._shutdown     = threading.Event()

        # Sub-systems
        self._ui      = ConsoleUI()
        
        # Dashboard 
        self._dashboard = DashboardServer()
        self._ui.set_dashboard(self._dashboard)

        self._exec    = ExecutionManager(
            ui=self._ui,
            workspace=self._workspace,
            on_cooldown_change=self._handle_cooldown,
        )
        self._listener = AudioListener(
            ui=self._ui,
            command_queue=self._command_q,
            on_event=self._handle_audio_event,
        )

        # Optional Whisper swap-in
        if self._use_whisper:
            self._patch_whisper()

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def run(self) -> None:
        """Main blocking loop — returns only after shutdown."""
        self._ui.print_header()
        self._ui.print_info(
            f"🗂️  Workspace : {self._workspace}"
        )
        stt_engine = (
            f"faster-whisper ({self._model_size})"
            if self._use_whisper
            else "Google Cloud STT"
        )
        self._ui.print_info(f"🔊  STT engine : {stt_engine}")
        self._ui.print_info(
            "💬  Wake words: 'Antigravity' | 'Hey Agent' | 'Hey Antigravity'"
        )

        self._install_signal_handlers()

        # Start the dashboard and web UI
        self._ui.print_info("🌐  Starting live dashboard server...")
        self._dashboard.start()
        self._dashboard.open_browser(delay=1.5)

        self._listener.start()

        try:
            self._dispatch_loop()
        finally:
            self._cleanup()

    def shutdown(self) -> None:
        """Trigger a graceful shutdown from any thread."""
        self._shutdown.set()

    # ── Signal Handlers ───────────────────────────────────────────────────────

    def _install_signal_handlers(self) -> None:
        def _handler(signum, frame):  # noqa: ANN001
            print()  # newline after ^C
            self._ui.print_warning("🛑  Interrupt received — shutting down…")
            self.shutdown()

        signal.signal(signal.SIGINT,  _handler)
        if hasattr(signal, "SIGTERM"):
            signal.signal(signal.SIGTERM, _handler)

    # ── Dispatch Loop ─────────────────────────────────────────────────────────

    def _dispatch_loop(self) -> None:
        """
        Pull VoiceCommand objects off the queue and hand them to the
        ExecutionManager. Checks the shutdown event each iteration.
        """
        while not self._shutdown.is_set():
            try:
                cmd: VoiceCommand = self._command_q.get(timeout=0.3)
            except queue.Empty:
                continue

            self._ui.print_info(
                f"📣  Command received: \"{cmd.raw_text}\""
            )
            self._exec.submit(cmd)

    # ── Callbacks ─────────────────────────────────────────────────────────────

    def _handle_audio_event(self, event: AudioEvent, detail: str) -> None:
        if event == AudioEvent.WAKE_WORD_DETECTED:
            self._ui.print_info(f"🔔  Wake word matched: '{detail}'")
        elif event == AudioEvent.COMMAND_CAPTURED:
            self._ui.print_info(f"✍️  Transcript: '{detail}'")
        elif event == AudioEvent.UNRESOLVED_AUDIO:
            self._ui.print_warning(
                "[ VOICE COMMAND UNRESOLVED - RETRYING... ]"
            )
        elif event == AudioEvent.STREAM_ERROR:
            self._ui.print_error(f"Stream error: {detail}")

    def _handle_cooldown(self, active: bool) -> None:
        """Relay cooldown state to the audio listener."""
        self._listener.set_cooldown(active)
        if not active:
            # When cooldown ends, we are back to listening/idle
            self._ui.set_state(ListenerState.LISTENING)

    # ── Whisper Patch ─────────────────────────────────────────────────────────

    def _patch_whisper(self) -> None:
        from audio_listener import WhisperTranscriber
        transcriber = WhisperTranscriber(model_size=self._model_size)
        if not transcriber.available:
            self._ui.print_warning(
                "faster-whisper not installed — falling back to Google STT."
            )
            return
        # Monkey-patch the private transcribe method
        import types
        self._listener._transcribe = types.MethodType(  # type: ignore[method-assign]
            lambda self_inner, audio: transcriber.transcribe(audio),
            self._listener,
        )
        self._ui.print_info(
            f"🧩  faster-whisper loaded (model: {self._model_size})"
        )

    # ── Cleanup ───────────────────────────────────────────────────────────────

    def _cleanup(self) -> None:
        self._ui.print_info("🔌  Stopping audio listener…")
        self._listener.stop()

        if self._exec.is_busy:
            self._ui.print_warning(
                "⚠️  Agent lifecycle still running — waiting for completion…"
            )
        self._exec.shutdown()

        self._ui.print_shutdown()


# ─────────────────────────────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    args      = _parse_args()
    workspace = _resolve_workspace(args.workspace)

    app = VoiceArchitectApp(
        workspace=workspace,
        use_whisper=args.whisper,
        model_size=args.model,
    )
    app.run()


if __name__ == "__main__":
    main()
