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
│     │                                       ▼                   │
│  ConsoleUI  ◄───────────────────  ExecutionManager              │
│  (console_ui.py)                  (execution_manager.py)        │
│  • ANSI state banners             • agy --continue --print "…"  │
│  • Simulated Progress Tracker     • Live Dashboard (Port 1337)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files

| File | Purpose |
|------|---------|
| `main.py` | Entry point, signal handlers, dispatch loop |
| `audio_listener.py` | Mic capture, wake-word, STT pipeline |
| `execution_manager.py` | Prompt builder, `agy` subprocess, background tasks |
| `console_ui.py` | ANSI terminal UI, state banners, progress tracker |
| `dashboard_server.py` | Flask server and SSE engine for the live browser UI |
| `requirements.txt` | Python dependencies |
| `.env.example` | Environment variable template |

---

## Quick Start (Running Locally on PC)

### 1. Install dependencies

```bash
# 1. Install PortAudio (required for microphone access on Windows)
pip install pipwin
pipwin install pyaudio

# 2. Install remaining Python packages
pip install -r requirements.txt
```

### 2. Configure Environment

Create your `.env` file:
```bash
copy .env.example .env
```
Open `.env` and set `AGY_WORKSPACE` to the folder where you want your projects built (e.g. `C:\Users\YourName\Desktop\AgyProjects`).

### 3. Run the bridge

```bash
# Default — Google STT (requires internet)
python main.py

# Fully offline — local faster-whisper
python main.py --whisper --model small
```

> **Note:** Running `main.py` will automatically launch a beautifully designed, live UI dashboard in your web browser at `http://localhost:1337/`. As you speak, the dashboard will display your transcripts, microphone status, progress trackers, and a real-time iframe preview of your AI-generated website!

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
