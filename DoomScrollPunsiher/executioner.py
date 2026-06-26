"""
executioner.py — Audio TTS & Browser Kill Switch
=================================================
Two responsibilities:
  1. Speak the Gemini roast aloud via pyttsx3 at maximum volume.
  2. Terminate all known browser processes using psutil.

Firefox and Opera are excluded per user preference.
"""

import threading
import logging

import psutil

logger = logging.getLogger(__name__)

# ── Browser processes to terminate ───────────────────────────────────
# Only Chrome, Edge, and Brave — Firefox & Opera excluded by user request.
BROWSER_PROCESSES = [
    "chrome.exe",
    "msedge.exe",
    "brave.exe",
]


import subprocess

def speak_roast(text: str) -> threading.Thread:
    """
    Speak the roast text using offline TTS in a background thread.
    Uses an isolated subprocess to prevent pyttsx3 from repeating previous
    queues (a known bug when re-initializing in the same process).

    Returns the thread handle (caller can join if needed).
    """

    def _speak():
        try:
            # Escape double quotes for the command line
            safe_text = text.replace('"', '\\"')
            
            script = (
                "import pyttsx3\n"
                "engine = pyttsx3.init()\n"
                "engine.setProperty('volume', 1.0)\n"
                "engine.setProperty('rate', 140)\n"
                f'engine.say("{safe_text}")\n'
                "engine.runAndWait()\n"
                "engine.stop()"
            )
            
            subprocess.run(
                ["python", "-c", script],
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
            )
            logger.info("TTS playback completed.")
        except Exception as exc:
            logger.error("TTS engine error: %s", exc)

    thread = threading.Thread(target=_speak, daemon=True, name="TTS-Thread")
    thread.start()
    return thread


def kill_browsers() -> list[str]:
    """
    Iterate running processes and terminate any matching BROWSER_PROCESSES.

    Returns a list of human-readable strings describing what was killed.
    """
    killed: list[str] = []

    for proc in psutil.process_iter(["pid", "name"]):
        try:
            proc_name = proc.info.get("name", "")
            if proc_name and proc_name.lower() in BROWSER_PROCESSES:
                proc.terminate()
                entry = f"{proc_name} (PID {proc.info['pid']})"
                killed.append(entry)
                logger.info("☠️  Terminated: %s", entry)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess) as exc:
            logger.warning("Could not terminate process: %s", exc)
        except Exception as exc:
            logger.debug("Unexpected error during process kill: %s", exc)

    if killed:
        logger.info("💀 Total browsers terminated: %d", len(killed))
    else:
        logger.info("No target browser processes found running.")

    return killed
