# Zero-Keystroke Voice Architect

> **Voice → Antigravity CLI bridge.** Speak a command, watch multi-agent software engineering run autonomously.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  MICROPHONE                                                      │
│     │  (PyAudio / PortAudio)                                    │
│     ▼                                                           │
│  AudioListener  ──wake-word gate──►  VoiceCommand queue         │
│     │  (audio_listener.py)                  │                   │
│     │  • Energy auto-calibration            │                   │
│     │  • Wake: "Antigravity" / "Hey Agent"  │                   │
│     │  • Google STT  OR  faster-whisper     │                   │
│     │  • Cooldown lock (blocks re-trigger)  │                   │
│     │                                       ▼                   │
│  ConsoleUI  ◄───────────────────  ExecutionManager              │
│  (console_ui.py)                  (execution_manager.py)        │
│  • ANSI state banners             • Prompt builder              │
│  • [AGY-ARCHITECT] prefix         • subprocess: agy run "…"     │
│  • [AGY-BROWSER]   prefix         • Real-time stdout/stderr     │
│                                   • 3s post-run cooldown        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files

| File | Purpose |
|------|---------|
| `main.py` | Entry point, signal handlers, dispatch loop |
| `audio_listener.py` | Mic capture, wake-word, STT pipeline |
| `execution_manager.py` | Prompt builder, `agy` subprocess, stream relay |
| `console_ui.py` | ANSI terminal UI, state banners, log lines |
| `requirements.txt` | Python dependencies |
| `.env.example` | Environment variable template |

---

## Quick Start

### 1. Install dependencies

```bash
# Windows — install PortAudio first (required by PyAudio)
pip install pipwin && pipwin install pyaudio

# Then install Python packages
pip install -r requirements.txt
```

### 2. Configure workspace

```bash
copy .env.example .env
# Edit .env — set AGY_WORKSPACE to your project path
```

### 3. Run the bridge

```bash
# Default — Google STT (requires internet)
python main.py --workspace "D:\VS Code\am1t_builds\MyProject"

# Fully offline — local faster-whisper
pip install faster-whisper
python main.py --workspace "D:\VS Code\am1t_builds\MyProject" --whisper --model small
```

---

## Wake Words

| Phrase | Action |
|--------|--------|
| `"Antigravity"` | Triggers command capture |
| `"Hey Agent"` | Triggers command capture |
| `"Hey Antigravity"` | Triggers command capture |

After the wake word, **speak your engineering task** (up to 15 seconds).  
A 3-second pause signals end-of-command.

**Example voice input:**
> *"Antigravity — build a REST API with FastAPI that serves a product catalog with pagination"*

**Generated `agy` call:**
```
agy run "Autonomous Task: Build a REST API with FastAPI that serves a product catalog with pagination. Initialize full multi-agent implementation, dependency installation, and browser verification loops."
```

---

## Terminal States

| Banner | Meaning |
|--------|---------|
| 🎙️ `LISTENING FOR ACTIVATE SIGNAL...` | Idle, waiting for wake word |
| 🧠 `PROCESSING VOICE PROMPT...` | Transcribing captured audio |
| 🚀 `ORCHESTRATING ANTIGRAVITY AGENTS...` | `agy` subprocess running |

---

## Offline STT with faster-whisper

```bash
pip install faster-whisper
python main.py --whisper --model base   # ~74MB download on first run
```

| Model | Size | Speed (CPU) | Accuracy |
|-------|------|-------------|----------|
| `tiny` | 39 MB | Very fast | Good |
| `base` | 74 MB | Fast | Better |
| `small` | 244 MB | Moderate | Great |
| `medium` | 769 MB | Slow | Excellent |

---

## CLI Flags

```
usage: main.py [-h] [--workspace PATH] [--whisper] [--model {tiny,base,small,medium,large}]

  --workspace, -w   Target project directory (default: CWD or AGY_WORKSPACE env)
  --whisper         Use local faster-whisper instead of Google STT
  --model           Whisper model size (default: base)
```

---

## Stopping

Press **`Ctrl+C`** — the bridge catches `SIGINT`, releases the microphone, waits for any running agent lifecycle to finish, then exits cleanly.
