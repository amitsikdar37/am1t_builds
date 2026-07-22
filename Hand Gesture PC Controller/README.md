# ✋ Hand Gesture & Eye-Gaze PC Controller

An intelligent, contactless PC controller that lets you manage your computer entirely using **hand gestures and eye gaze** — no mouse or physical keyboard required! Built with **Python, MediaPipe, and OpenCV**.

---

## 🌟 Key Features

- 🎯 **Fixed-Base Joystick Mouse Control**: Point/lean your index finger to steer the mouse cursor continuously. Returning your finger to the center base freezes the cursor cleanly with zero tremor. Includes dynamic HUD visual joystick overlays.
- 👁️ **Eye-Gaze Scrolling**: Look up or look down to scroll through web pages, social media, or documents hands-free. Includes blink-suppression debounce so natural blinking won't interrupt your reading.
- 🔊 **Sticky Pinch Volume Control**: Pinch your thumb and index finger together to engage volume control, then stretch them apart to smoothly adjust system volume from 0% to 100%.
- ⏱️ **Auto-Dwell Clicking**: Hover over any button or target for 1.5 seconds to trigger an automatic left-click.
- 🖥️ **Dynamic Screen Resolution**: Automatically detects screen resolution dynamically using PyAutoGUI — works on any monitor size or multi-monitor setup without hardcoding.
- 📦 **Auto-Model Downloader**: Automatically fetches missing MediaPipe `.task` models on first run.

---

## 📋 Prerequisites

- **Operating System**: Windows 10/11 (Windows required for pycaw Volume Control; mouse & gaze scroll are cross-platform).
- **Python**: Version **3.10** or higher.
- **Hardware**: A working **webcam**.

---

## ⚡ Quick Start & Installation

Follow these steps to run the controller on any PC:

### 1. Clone or Download the Repository

```bash
git clone <your-repository-url>
cd "Hand Gesture PC Controller"
```

### 2. Create & Activate a Virtual Environment

**On Windows (PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\activate
```

**On Windows (Command Prompt):**
```cmd
python -m venv .venv
.venv\Scripts\activate.bat
```

**On Linux / macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Required Dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the Gesture Controller

```bash
python gesture_controller.py
```

*(Or explicitly using your virtual environment Python binary)*:
```powershell
.\.venv\Scripts\python.exe gesture_controller.py
```

> 💡 **To Exit**: Press **`Q`** while focused on the camera window to stop the controller cleanly.

---

## 🎮 How to Control

| Gesture / Input | How to Perform | Result |
|---|---|---|
| **Mouse Steering** | Extend index finger. First detected point sets the fixed joystick base. Lean tip away from base. | Mouse cursor travels in the direction you lean. |
| **Freeze Mouse** | Return index finger to the fixed base point. | Mouse freezes instantly without jitter. |
| **Dwell Click** | Hold cursor over any target/button for **1.5 seconds**. | Automatic left mouse click. |
| **Volume Control** | Pinch thumb + index finger together (< 3.5 cm), then stretch gap apart. | Adjust system volume (0% - 100%). |
| **Cancel Volume** | Extend middle, ring, and pinky fingers (Open Hand). | Exits volume control mode. |
| **Eye Scroll** | Look up (above upper threshold) or look down (below lower threshold). | Continuously scrolls the active window up or down. |

---

## 📂 Project Structure & Clean Codebase

```
Hand Gesture PC Controller/
├── gesture_controller.py   # Main application entry point & gesture engine
├── requirements.txt        # Python dependency list
├── .gitignore              # Excludes virtualenvs, cache, and build files
└── README.md               # Documentation
```

- **Clean Repo**: Virtual environment folders (`.venv/`), bytecode (`__pycache__/`), OS metadata (`.DS_Store`), and large binary models (`*.task`) are untracked via `.gitignore`.
- **Auto-Fetch**: Missing MediaPipe `.task` models are downloaded on demand on first run.

---

## 🛠 Troubleshooting

| Issue | Solution |
|---|---|
| **Camera fails to open** | Change `CAMERA_INDEX = 1` (or 2) in `gesture_controller.py` if using an external or secondary webcam. |
| **Mouse moving too fast / slow** | Adjust `MOUSE_MAX_SPEED_PX` or `MOUSE_MAX_DISP` in the configuration block at top of `gesture_controller.py`. |
| **Accidental scroll while looking at screen bottom** | `Y_DOWN_THRESH` is set to `0.08` to prevent false triggers when looking at captions/reels. Adjust if needed. |
| **Volume control error on Linux/Mac** | Volume control utilizes Windows Core Audio via `pycaw`. Mouse & gaze scroll will continue working cleanly. |

---

## 📄 Dependencies

- `mediapipe` (Hand & Face landmark tracking)
- `opencv-python` (Webcam processing & HUD display)
- `pyautogui` (Mouse movement, clicking, and screen geometry)
- `numpy` (Coordinate math)
- `pycaw` & `comtypes` (Windows audio control)
