# 📵 Force Study AI — Neural Study Monitor & Meme Scolder

[![JavaScript](https://img.shields.io/badge/Language-JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Python](https://img.shields.io/badge/Server-Python%203.8+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![TensorFlow.js](https://img.shields.io/badge/AI-TensorFlow.js-FF6F00?logo=tensorflow&logoColor=white)](https://www.tensorflow.org/js)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

> **Stop slacking, put your phone down, and get back to studying!**  
> Force Study AI is a high-tech in-browser computer vision web app that monitors your study sessions using your webcam. If you touch your smartphone or walk away from your desk, it immediately intercepts and plays legendary scolding meme audios.

---

## 📑 Table of Contents

- [✨ Features](#-features)
- [🧠 How It Works (Architecture)](#-how-it-works-architecture)
- [💻 Prerequisites](#-prerequisites)
- [⚡ Quick Start (Local Setup)](#-quick-start-local-setup)
  - [Option A: Windows 1-Click Launch (`.bat`)](#option-a-windows-1-click-launch-bat)
  - [Option B: Command Line (Windows, Mac, Linux)](#option-b-command-line-windows-mac-linux)
  - [Option C: Using Node.js (Alternative)](#option-c-using-nodejs-alternative)
- [📖 How to Use the App](#-how-to-use-the-app)
- [🔊 Adding Your Own Meme Sounds](#-adding-your-own-meme-sounds)
- [🚀 Deploying to Vercel (Free Cloud Hosting)](#-deploying-to-vercel-free-cloud-hosting)
- [📂 Project Anatomy](#-project-anatomy)
- [❓ Troubleshooting & FAQ](#-troubleshooting--faq)
- [📜 License](#-license)

---

## ✨ Features

- 🎯 **100% Client-Side In-Browser AI**: Runs real-time computer vision locally in your browser using **TensorFlow.js COCO-SSD** and **MediaPipe Hands** accelerated by WebGL. No expensive GPU or server needed.
- 🔒 **Total Privacy**: Video streams never leave your device. All image frames are processed entirely in your browser's memory and immediately discarded.
- 🔲 **Kinematic Cyber Tracking Reticle**: An Apple Vision Pro-inspired autofocus box tracks your head and upper body smoothly with linear interpolation (`lerp`).
- 📱 **Physical Phone Touch Detection**: Differentiates between a phone resting innocently on your desk versus your hand actually reaching out, touching, or picking it up (via laser interaction tethering).
- 🏃‍♂️ **Desk Departure Alarm**: If you get up and leave your desk instead of studying, a customizable grace countdown triggers and scolds you to return.
- 🔁 **Non-Repeating Scolding Queue**: Built-in Fisher-Yates playlist engine ensures **zero consecutive duplicates** across study sessions. Every trigger plays a distinct meme sound.
- 🔊 **Mastered Audio Equalization**: All meme sounds are loudness-balanced to ~3600 RMS with soft-knee limiting to eliminate harsh digital clipping.
- 🪟 **Futuristic Glassmorphic HUD**: Edge-to-edge full-screen video, smooth ambient edge vignette, animated audio wave bars, and an off-canvas slide-out dashboard.

---

## 🧠 How It Works (Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│                          FORCE STUDY AI WORKFLOW                       │
└────────────────────────────────────────────────────────────────────────┘

    [ Webcam Video Stream ]
               │
               ▼
    [ TensorFlow.js (COCO-SSD) + MediaPipe Hands ]
               │
      ┌────────┴──────────────────────────┐
      ▼                                   ▼
 [ Person Tracking ]             [ Smartphone Detection ]
      │                                   │
      │ User left desk?                   │ Hand touching phone?
      ├───────────────────┐               ├───────────────────┐
      │ YES               │ NO            │ YES               │ NO
      ▼                   ▼               ▼                   ▼
 [ Absence Timer ]    [ Focused 📚 ] [ Scold Trigger 🚨 ]  [ Safe Desk ]
 (Grace Period Expired)                   │
      │                                   │
      └─────────────────┬─────────────────┘
                        ▼
       [ Non-Repeating Meme Audio Queue ]
                        │
                        ▼
       [ Play Audio + Ambient Vignette + Toast ]
                        │
                        ▼
       [ Cooldown: Wait for Phone Release / User Return ]
```

---

## 💻 Prerequisites

To run this project locally, you only need:

1. **Python 3.8 or higher** (Already pre-installed on most modern PCs).  
   *Check with: `python --version` or `python3 --version`*
2. **A Modern Web Browser** (Google Chrome, Microsoft Edge, Brave, or Firefox) with webcam access enabled.
3. *(Optional)* **Node.js 18+** if you plan to deploy to Vercel via CLI.

> [!NOTE]
> **No complex pip packages are required to run the web app!** The local server uses Python's built-in standard library (`http.server`).

---

## ⚡ Quick Start (Local Setup)

Clone or download this repository to your computer:

```bash
git clone https://github.com/amitsikdar37/am1t_builds.git
cd "am1t_builds/force study ai"
```

### Option A: Windows 1-Click Launch (`.bat`)

If you are on Windows, simply double-click the **`start.bat`** file in the project folder!

It will:
1. Start the local server.
2. Automatically launch your default web browser at `http://localhost:8000`.

---

### Option B: Command Line (Windows, Mac, Linux)

Open your terminal or command prompt inside the `force study ai` directory and run:

```bash
# Windows
python server.py

# Mac / Linux
python3 server.py
```

You will see:
```text
=======================================================
[*] Force Study AI Server running at http://localhost:8000
[*] Serving files from: ...
[*] Voices directory: .../voices
=======================================================
```

Open your browser and navigate to: **`http://localhost:8000`**

---

### Option C: Using Node.js (Alternative)

If you prefer Node.js over Python:

```bash
# Using npx serve
npx serve . -p 8000

# Or using Vercel local dev environment
npx vercel dev
```

---

## 📖 How to Use the App

1. **Initiate Study Session**:
   - Click the white **"Initiate Study Session"** button on the welcome screen.
   - When prompted by your browser, click **"Allow"** to grant camera access.
2. **Position Your Setup**:
   - Sit comfortably in front of your camera.
   - You will see a glowing **cyan cyber tracking square** lock onto your face and upper body.
3. **Study Peacefully**:
   - The status in the header will read `● ATTENTIVE` and the study timer will begin tracking your focus time.
4. **Distraction Test (Touch Phone)**:
   - Reach out and touch or hold your smartphone in front of the camera.
   - 🚨 **BAM!** The tracking reticle turns neon red, an ambient crimson vignette illuminates the screen, an executive toast notification slides down from the top, and a loud scolding meme will yell at you!
   - Put your phone down. Once the audio completes and your phone is away for ~1.5s, the system re-arms.
   - Next time you touch your phone, a **different distinct meme** will play!
5. **Absence Test (Leave Desk)**:
   - Step away from your desk or duck out of the camera view.
   - The HUD will begin an absence countdown: `Student away... (4s) ... (3s) ...`.
   - If you don't return before the countdown expires, a scolding audio will blast calling you back to your desk!
6. **Open the Dashboard Drawer**:
   - Click the floating **"📊 Dashboard"** button on the top right to:
     - Check your total focus duration and slacking count.
     - Preview individual meme voices from the pool.
     - Toggle the **Desk Departure Alarm** ON/OFF or adjust the grace period slider (2s–15s).
     - Switch detection mode between **Hand Touch** (default) and **Any Phone Visible**.
     - Adjust volume and AI confidence sensitivity.
7. **Fullscreen Mode**:
   - Click the **`⛶`** button in the top bar for borderless full-screen study immersion.

---

## 🔊 Adding Your Own Meme Sounds

Want to add your own custom voices or favorite memes? It takes 5 seconds!

1. Open the **`voices/`** directory in your file explorer.
2. Copy and paste any audio file into it.  
   *Supported formats: `.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac`*.
3. Refresh your browser at `http://localhost:8000`.

The server dynamically scans the `voices/` folder, URL-encodes the filenames, and automatically adds them to the rotation queue without editing any code!

---

## 🚀 Deploying to Vercel (Free Cloud Hosting)

This project is configured out-of-the-box with `api/voices.js` and `vercel.json` for seamless Vercel hosting.

### Method 1: Deploy with Vercel CLI (1 Minute)

Run inside the `force study ai` directory:

```bash
npx vercel
```

- When prompted `Set up and deploy?`, press `y`.
- Accept the default options by pressing Enter.
- Done! You will receive a live production link (e.g. `https://force-study-ai.vercel.app`).
- For future updates: `npx vercel --prod`.

### Method 2: Deploy with GitHub

1. Commit and push your changes to GitHub:
   ```bash
   git add .
   git commit -m "Deploy Force Study AI"
   git push origin main
   ```
2. Go to [Vercel](https://vercel.com) and log in.
3. Click **"Add New..."** $\rightarrow$ **"Project"** and import your repository.
4. **Important**: If `force study ai` is in a subfolder, click **Edit** next to **Root Directory** and select `force study ai`.
5. Click **Deploy**.

> [!TIP]
> Hosting on Vercel provides **HTTPS by default**, which allows mobile browsers (iOS Safari, Android Chrome) and laptops to grant camera access without security warnings!

---

## 📂 Project Anatomy

```text
force study ai/
│
├── api/
│   └── voices.js            # Vercel Serverless API for dynamic audio discovery
│
├── voices/                  # Directory containing mastered meme MP3 audios
│   ├── Abe Padhai Likhai me Dhyan Do...mp3
│   ├── Kyu nhi ho rahi padhai.mp3
│   ├── Tum ek kaam karo IAS ki taiyaari...mp3
│   └── bade harami ho beta meme video...mp3
│
├── index.html               # Main application layout, canvas HUD & dashboard drawer
├── style.css                # Futuristic glassmorphic styles, ambient vignette animations
├── app.js                   # Client-side AI vision pipeline, tracking reticle, queue state machine
├── server.py                # Zero-dependency Python server with /api/voices endpoint
├── vercel.json              # Vercel routing & cache-control rules
├── package.json             # NPM metadata and deployment scripts
├── start.bat                # Windows double-click shortcut launcher
└── README.md                # Project documentation & setup guide
```

---

## ❓ Troubleshooting & FAQ

### Q1: The camera feed is black or shows "Unable to access camera".
- **Fix**: Check your browser address bar. Look for the camera icon (or the tune/padlock icon on the left) and make sure Camera permissions are set to **"Allow"**.
- **Fix**: Ensure no other application (Zoom, Teams, OBS, Discord) is currently using your webcam.

### Q2: Port 8000 is already in use (`Address already in use`).
- **Fix**: `server.py` automatically detects occupied ports and will increment to `8001`, `8002`, etc. Check your terminal output for the exact URL.
- Or close the existing process running on port 8000:
  ```powershell
  # Windows PowerShell
  Stop-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess -Force
  ```

### Q3: Audio does not play automatically.
- **Fix**: Modern browsers block audio autoplay until the user interacts with the page. Always click **"Initiate Study Session"** or any button on the page first to unlock the browser's audio permissions.
- **Fix**: Open the **"📊 Dashboard"** drawer and ensure the volume slider is not at 0%.

### Q4: "Python is not recognized as an internal or external command".
- **Fix**: When installing Python on Windows, make sure to check the box **"Add Python to PATH"** on the first installation screen.
- Alternatively, you can run the project using Node.js: `npx serve .`

---

## 📜 License

This project is licensed under the [ISC License](LICENSE). Feel free to use, modify, and distribute it for personal study and non-commercial projects.

---

<p align="center">
  <b>Built with ❤️, TensorFlow.js & Legendary Memes. Happy Studying! 📚</b>
</p>
