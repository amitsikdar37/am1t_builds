# AntiGravity Desk Touchpad 🖱️✨

Turn any flat desk surface into a high-precision, zero-latency laptop multi-touch trackpad using just your smartphone camera (via Phone Link or webcam) and AI.

This project completely replaces standard mouse hardware by mapping your physical hand movements on a desk directly to Windows OS cursor control with pixel-perfect accuracy. It uses an overhead (top-down / bird's eye) camera setup.

## 🚀 Key Features

* **Multi-Anchor Thumb Engagement Switch**: Mouse tracking is only active when your thumb rests against the side of your index finger. Open your thumb to instantly pause the mouse. No accidental drifting!
* **Magnetic Dwell Target-Locking**: To left-click, simply hold your hand still over a button for 360ms. An animated AR ring will countdown and snap the click. During the countdown, your cursor is magnetically frozen in place so you never miss the button.
* **Anti-Flicker Glitch Rejection**: Automatically intercepts and discards impossible AI vision spikes caused by shadows or poor lighting, keeping your cursor rock solid.
* **Zero-Latency Zero-Wobble Kinematics**: Implements a highly optimized One-Euro low-pass filter paired with a kinematic trajectory stabilizer to eliminate back-and-forth cursor oscillation while preserving 1.85x calm sensitivity.
* **Direct Win32 Zero-Latency Injection**: Uses Python `ctypes` to inject mouse packets directly into the Windows OS ring, bypassing slow GUI automation libraries.

## 🛠️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/desk-touchpad.git
   cd desk-touchpad
   ```

2. **Install Python dependencies:**
   Ensure you have Python 3.9+ installed.
   ```bash
   pip install -r requirements.txt
   ```
   *(Note: The MediaPipe Hand Landmarker AI model is automatically downloaded on first run!)*

3. **Camera Setup:**
   Mount your smartphone (using Windows Phone Link) or a standard webcam directly above your desk pointing straight down (overhead view).

## 🎮 How to Use

Run the main application:
```bash
python desk_touchpad.py
```

1. **Camera Selection**: The console will list available cameras. Type the index of your overhead camera and press Enter.
2. **Move the Mouse**: Lightly touch your thumb against your index finger and slide across your desk.
3. **Pause the Mouse**: Slide your thumb away from your index finger. The cursor will freeze.
4. **Left Click (Dwell)**: With your thumb engaged, hold your hand completely still over an icon for a fraction of a second. An animated ring will fill up and fire a click.
5. **Scroll Pages**: Touch your Middle fingertip and Index fingertip together, engage your thumb, and slide up or down.

### ⌨️ Hotkeys (While Video Window is Focused)
* `[UP] / [W]`: Raise the Thumb Gap threshold line (makes it easier to activate the mouse without pinching tightly).
* `[DOWN] / [S]`: Lower the Thumb Gap threshold line (requires a firmer pinch).
* `[Q] / [ESC]`: Safely release all operating system mouse locks and quit the program.

## 🧠 Architecture Overview
* `desk_touchpad.py`: Main application loop and Augmented Reality HUD rendering.
* `touch_engine.py`: Multi-Anchor bone proximity matrix for infallible thumb-switch detection.
* `gesture_fsm.py`: Finite State Machine orchestrating target-lock clicking, motion, and anti-spam cooldowns.
* `filter_math.py`: Advanced kinematics, One-Euro jitter damping, and trajectory stabilization.
* `win_mouse.py`: Ultra-low-latency Windows OS mouse driver wrapper.

## 📜 License
MIT License
