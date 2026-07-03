"""
╔══════════════════════════════════════════════════════════════════╗
║         AUDIO LISTENER UTILITY — Zero-Keystroke Voice Architect  ║
║         Persistent mic capture · Wake-word gate · STT pipeline   ║
╚══════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import io
import queue
import threading
import time
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Callable, Optional

import speech_recognition as sr

from console_ui import ConsoleUI, ListenerState


# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

WAKE_WORDS: tuple[str, ...] = (
    # Standard forms
    "antigravity",
    "hey agent",
    "hey antigravity",
    # Hyphenated variants — Google STT often produces these
    "anti-gravity",
    "hey anti-gravity",
    # Space-separated variant
    "anti gravity",
    "hey anti gravity",
)

# Seconds of silence after speech burst is considered end-of-command
PHRASE_PAUSE_THRESHOLD: float = 3.0

# Max seconds for a full command phrase
PHRASE_TIME_LIMIT: float = 15.0

# How many seconds to calibrate ambient noise on startup
CALIBRATION_DURATION: float = 1.5

# Retry window before giving up on an unresolvable audio segment
MAX_RETRIES: int = 2


# ─────────────────────────────────────────────────────────────────────────────
# Data Structures
# ─────────────────────────────────────────────────────────────────────────────

class AudioEvent(Enum):
    WAKE_WORD_DETECTED = auto()
    COMMAND_CAPTURED   = auto()
    UNRESOLVED_AUDIO   = auto()
    STREAM_ERROR       = auto()


@dataclass
class VoiceCommand:
    raw_text:    str
    confidence:  float = 1.0           # placeholder; expanded with Whisper
    timestamp:   float = field(default_factory=time.time)
    audio_data:  Optional[bytes] = None


# ─────────────────────────────────────────────────────────────────────────────
# AudioListener
# ─────────────────────────────────────────────────────────────────────────────

class AudioListener:
    """
    Persistent background microphone listener.

    Lifecycle
    ---------
    1. Calibrate ambient noise.
    2. Block in background thread waiting for a wake-word phrase.
    3. On detection, capture the command phrase.
    4. Place a VoiceCommand onto the outbound queue for the main loop.
    """

    def __init__(
        self,
        ui: ConsoleUI,
        command_queue: "queue.Queue[VoiceCommand]",
        on_event: Optional[Callable[[AudioEvent, str], None]] = None,
    ) -> None:
        self._ui             = ui
        self._command_queue  = command_queue
        self._on_event       = on_event or (lambda e, m: None)

        self._recognizer     = sr.Recognizer()
        self._microphone: Optional[sr.Microphone] = None

        self._listening      = False
        self._cooldown_lock  = threading.Event()    # set = busy, clear = idle
        self._stop_event     = threading.Event()

        self._listener_thread: Optional[threading.Thread] = None

    # ── Public API ───────────────────────────────────────────────────────────

    def start(self) -> None:
        """Start the background listener thread."""
        self._stop_event.clear()
        self._calibrate()
        self._listener_thread = threading.Thread(
            target=self._listen_loop,
            name="AudioListenerThread",
            daemon=True,
        )
        self._listener_thread.start()
        self._ui.set_state(ListenerState.LISTENING)

    def stop(self) -> None:
        """Signal the listener to stop and release mic resources."""
        self._stop_event.set()
        if self._listener_thread:
            self._listener_thread.join(timeout=3.0)

    def set_cooldown(self, active: bool) -> None:
        """
        Called by the execution manager to block/unblock wake-word processing
        while an Antigravity agent lifecycle is running.
        """
        if active:
            self._cooldown_lock.set()
        else:
            self._cooldown_lock.clear()
            self._ui.set_state(ListenerState.LISTENING)

    @property
    def is_in_cooldown(self) -> bool:
        return self._cooldown_lock.is_set()

    # ── Internals ────────────────────────────────────────────────────────────

    def _calibrate(self) -> None:
        """Auto-calibrate energy threshold against ambient room noise."""
        self._ui.print_info(
            f"🎚️  Calibrating ambient noise ({CALIBRATION_DURATION}s) — "
            "please stay quiet…"
        )
        with sr.Microphone() as source:
            self._recognizer.adjust_for_ambient_noise(
                source, duration=CALIBRATION_DURATION
            )
        threshold = self._recognizer.energy_threshold
        self._ui.print_info(
            f"✅  Calibration complete. Energy threshold set to "
            f"{threshold:.1f}"
        )
        # Store mic reference for reuse
        self._microphone = sr.Microphone()

    def _listen_loop(self) -> None:
        """
        Main loop: opens the microphone ONCE and holds the stream open for
        the entire session. Both wake-word detection and command capture
        share this single source — no repeated open/close that caused
        [Errno -9988] Stream closed on Windows.
        """
        try:
            mic = sr.Microphone()
            with mic as source:
                # Dynamic energy compression helps in variable-noise rooms
                self._recognizer.dynamic_energy_threshold = True
                self._ui.print_info("🎤  Microphone stream opened and held.")

                while not self._stop_event.is_set():
                    # ── Cooldown gate ─────────────────────────────────────
                    if self._cooldown_lock.is_set():
                        time.sleep(0.2)
                        continue

                    # ── Listen for next speech phrase ─────────────────────
                    try:
                        self._recognizer.pause_threshold = 0.8
                        audio = self._recognizer.listen(
                            source,
                            timeout=2.0,        # short timeout → tight loop
                            phrase_time_limit=PHRASE_TIME_LIMIT,
                        )
                    except sr.WaitTimeoutError:
                        # Silence window — just loop again
                        continue

                    # ── Transcribe ────────────────────────────────────────
                    text = self._transcribe(audio)
                    if not text:
                        continue

                    self._ui.print_info(f"   heard: \"{text}\"")
                    lower = text.lower()
                    # Normalize: remove hyphens so 'anti-gravity' == 'anti gravity'
                    # and both match the canonical 'antigravity' form
                    normalized = lower.replace("-", " ")

                    # ── Wake-word check ───────────────────────────────────
                    # Check both original and hyphen-stripped forms
                    wake_hit = next(
                        (
                            w for w in WAKE_WORDS
                            if w in lower or w.replace("-", " ") in normalized
                        ),
                        None,
                    )

                    if wake_hit and not self._cooldown_lock.is_set():
                        self._on_event(AudioEvent.WAKE_WORD_DETECTED, wake_hit)
                        self._ui.set_state(ListenerState.PROCESSING)
                        # Pass the SAME source so no second mic stream opens
                        self._capture_command(source)

        except OSError as exc:
            self._on_event(AudioEvent.STREAM_ERROR, str(exc))
            self._ui.print_error(
                f"Fatal microphone error: {exc}\n"
                "  Tip: ensure no other app has exclusive mic access."
            )

    def _capture_command(self, source: sr.AudioSource) -> None:
        """
        After a wake-word trigger, record the user's full command phrase
        using the SAME persistent mic source (no new stream opened).
        Gives the user a generous 3-second pause window.
        """
        self._ui.print_info("🎙️  Wake word detected — speak your command now…")

        for attempt in range(1, MAX_RETRIES + 2):
            try:
                # Wider pause threshold: waits 3s of silence = end of command
                self._recognizer.pause_threshold = PHRASE_PAUSE_THRESHOLD
                audio = self._recognizer.listen(
                    source,
                    timeout=8.0,
                    phrase_time_limit=PHRASE_TIME_LIMIT,
                )
                # Reset to tight threshold after capture
                self._recognizer.pause_threshold = 0.8
            except sr.WaitTimeoutError:
                self._recognizer.pause_threshold = 0.8
                self._ui.print_warning(
                    "[ VOICE COMMAND UNRESOLVED - RETRYING... ]"
                )
                if attempt > MAX_RETRIES:
                    self._ui.set_state(ListenerState.LISTENING)
                    return
                continue

            text = self._transcribe(audio)

            if text and len(text.strip()) > 2:
                wav_bytes = audio.get_wav_data()
                cmd = VoiceCommand(
                    raw_text=text.strip(),
                    audio_data=wav_bytes,
                )
                self._command_queue.put(cmd)
                self._on_event(AudioEvent.COMMAND_CAPTURED, text)
                self._ui.set_state(ListenerState.LISTENING)
                return
            else:
                self._ui.print_warning(
                    "[ VOICE COMMAND UNRESOLVED - RETRYING... ]"
                )
                if attempt > MAX_RETRIES:
                    self._ui.set_state(ListenerState.LISTENING)
                    return

    def _transcribe(self, audio: sr.AudioData) -> Optional[str]:
        """
        Attempt Google Speech Recognition → fallback graceful None.
        Swap this method body for a local faster-whisper call if preferred.
        """
        try:
            text: str = self._recognizer.recognize_google(audio)
            return text
        except sr.UnknownValueError:
            # The recognizer caught audio (crossed threshold) but couldn't extract words.
            # We log it faintly so the user knows the mic is at least working.
            self._ui.print_info("   (audio detected, but no words recognized)")
            return None
        except sr.RequestError as exc:
            self._ui.print_error(f"STT service unavailable: {exc}")
            return None


# ─────────────────────────────────────────────────────────────────────────────
# Optional: Whisper-backed transcription (swap-in replacement for _transcribe)
# ─────────────────────────────────────────────────────────────────────────────

class WhisperTranscriber:
    """
    Local faster-whisper transcription engine.
    Usage: pass an instance to AudioListener via dependency injection or
    monkey-patch AudioListener._transcribe with this callable.

    Requires: pip install faster-whisper
    """

    def __init__(self, model_size: str = "base") -> None:
        try:
            from faster_whisper import WhisperModel  # type: ignore
            self._model = WhisperModel(model_size, device="cpu", compute_type="int8")
            self._available = True
        except ImportError:
            self._available = False
            self._model = None

    @property
    def available(self) -> bool:
        return self._available

    def transcribe(self, audio: sr.AudioData) -> Optional[str]:
        if not self._available or self._model is None:
            return None
        wav_bytes = audio.get_wav_data()
        audio_file = io.BytesIO(wav_bytes)
        segments, _ = self._model.transcribe(audio_file, language="en")
        parts = [seg.text for seg in segments]
        return " ".join(parts).strip() if parts else None
