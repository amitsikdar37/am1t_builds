# 👁️ Eye-Gaze Reel Controller

Control short-form video reels (Instagram, YouTube Shorts, TikTok on PC) **entirely with your eyes** — no hands required.

Built with Python, MediaPipe, and OpenCV.

---

## ✨ Features

| Eye Gesture | Action |
|---|---|
| Look **UP** slowly | ▲ Next reel |
| Look **DOWN** slowly | ▼ Previous reel |
| Close eyes for **~0.6 s** | ⏸ Pause / Play |
| **Double-blink** (two fast blinks) | ♥ Like the reel |

---

## 🖥️ Requirements

- Python **3.10 – 3.13**
- A working **webcam** (built-in laptop camera works perfectly)
- Windows 10 / 11 (tested) — macOS / Linux should work with minor adjustments

---

## ⚡ Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/amitsikdar37/am1t_builds.git
cd am1t_builds/Eye-Gaze\ Reel\ Controller
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the controller

```bash
python eye_gaze_controller.py
```

The script will **automatically download** the MediaPipe face-landmark model (~14 MB) on first run. It is saved locally as `face_landmarker.task` and is not uploaded to GitHub.

---

## 🎮 How to Use

1. **Open your browser** and navigate to Instagram Reels, YouTube Shorts, or TikTok.
2. **Run the script.** A small camera preview window will appear in the corner of your screen — keep it visible but move it out of the way.
3. **Position your face** clearly in the camera (good lighting helps a lot).
4. **Hover your mouse** over the center of the video player so scrolls land on the right element.
5. **Start gazing!**

### Calibrating the Like Button (for Double-Blink to Like)

The Like button position is different on every screen, so you must calibrate it once:

1. With the camera preview window active (click it if needed), press **`c`**.
2. You will see a **3-second countdown** appear on the HUD.
3. During those 3 seconds, move your mouse over the **Like / Heart button** on the reel.
4. After 3 seconds, the position is saved automatically to `config.json` and will be remembered on the next run.

---

## 🔧 Tuning (Optional)

All sensitivity settings are at the top of `eye_gaze_controller.py`:

```python
Y_UP_THRESH   = -0.10   # how far UP to look to trigger "next"
Y_DOWN_THRESH =  0.01   # how far DOWN to look to trigger "prev"
MAX_VELOCITY  =  0.015  # max eye speed — fast darts are ignored
LONG_BLINK_SEC = 0.6    # how long to keep eyes closed to pause
```

- **Scrolling too easily?** Increase the absolute value of `Y_UP_THRESH` (e.g. `-0.12`) or decrease `Y_DOWN_THRESH` (e.g. `0.03`).
- **Scrolling not triggering?** Do the opposite.
- **Pause triggering too fast?** Increase `LONG_BLINK_SEC` to `0.8` or `1.0`.

---

## 🗂️ Project Structure

```
Eye-Gaze Reel Controller/
├── eye_gaze_controller.py   # Main script
├── requirements.txt         # Python dependencies
├── .gitignore               # Excludes model + config from git
└── README.md                # This file

# Auto-generated (not in git):
├── face_landmarker.task     # Downloaded MediaPipe model (~14 MB)
└── config.json              # Your saved Like-button position
```

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| `mediapipe` | Face & iris landmark detection |
| `opencv-python` | Camera capture & preview window |
| `pyautogui` | Simulating mouse scroll & clicks |
| `numpy` | Numerical operations |

---

## 🤔 Troubleshooting

**"Cannot open camera"**
→ Make sure no other app (Teams, Zoom, etc.) is using your webcam. Try changing `CAM_INDEX = 1` if you have multiple cameras.

**Eyes tracked but reels not scrolling**
→ Make sure your mouse cursor is hovering **over the video**, not the sidebar or address bar.

**Pause not triggering**
→ Keep your eyes fully closed for at least 0.6 seconds. Make sure the room is well lit.

**Double-blink not liking**
→ Press `c` in the camera window to (re)calibrate the Like button position.

---

## 📄 License

MIT — free to use, modify, and share.

---

*Built by [@am1t](https://github.com/amitsikdar37)*
