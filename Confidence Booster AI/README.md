# 🗿 CONFIDENCE BOOSTER AI // SIGMA PHONK WEBCAM
### *Real-Time Computer Vision AI & Viral Phonk Video Edit Generator*

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://am1t-builds-rm3g.vercel.app/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.1-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Vision%20AI-0078D4?style=for-the-badge&logo=google&logoColor=white)](https://developers.google.com/mediapipe)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

---

## 🌐 Live Application

Experience the application live in your browser:  
👉 **[https://am1t-builds-rm3g.vercel.app/](https://am1t-builds-rm3g.vercel.app/)**

> **Privacy Note:** 100% Client-Side. All computer vision, gesture detection, audio synthesis, and video rendering run directly inside your web browser via WebGL and WebAssembly. Zero video, audio, or biometric data is ever sent to or stored on any server.

---

## ⚡ What is Confidence Booster AI?

**Confidence Booster AI** is an interactive webcam application and automated video editor powered by real-time computer vision and Web Audio synthesis.

Using Google's **MediaPipe Vision AI**, the web app tracks your facial landmarks, 3D head orientation (pitch, yaw, roll), and hand movements in real-time. Whenever you perform an "alpha gesture"—such as taking a sip of water or adjusting your glasses—the system automatically locks onto your face and triggers an adrenaline-fueled **Phonk Beat Drop Edit** with slow-motion replays, screen-shaking 808 bass, chromatic aberration, ghost trails, and dark manga strobe glitches.

You can also export your recorded edits with one click as universal **MP4** video clips ready to post directly on TikTok, YouTube Shorts, or Instagram Reels.

---

## ✨ Key Features

- **🎯 AI Gesture & Landmark Detection**: MediaPipe FaceLandmarker and HandLandmarker accurately detect drinking sips and glasses adjustments in real time.
- **📦 3D Perspective Target Cube**: A cybernetic 3D wireframe bounding cube tracks your head in real 3D space, responding dynamically to pitch, yaw, and roll.
- **🔄 Pre-Roll Circular RAM Buffer**: Constantly retains the previous few seconds of webcam footage in memory, so when you finish a sip, the replay includes the buildup, the action, and the bass drop.
- **⚡ 3 Viral Phonk Edit Presets**:
  - **👻 GHOST TRAILS** (*Montagem Tomada*): Ethereal RGB chromatic splits, motion blur afterimages, and heavy 808 sub-bass.
  - **🗿 SIGMA SNAPS** (*Marlon Mogged*): Hard beat snap zooms, aggressive screen shake, and wasted mog aesthetic.
  - **⚡ DARK MANGA** (*Mogger Phonk*): High-contrast inverted manga flashes, neon red/cyan outlines, and strobe glitches.
- **📱 Mobile-First Performance**: Responsive auto-framing with zero black borders, touch-friendly HUD controls, adaptive frame timing, and zero audio echo.
- **💾 Universal MP4 Video Exporter**: Fast client-side MP4 container packaging with synchronized AAC audio for instant downloads.
- **🎵 Interactive Soundboard**: Includes volume sliders, procedural bass drop impacts, and Phonk audio previews.

---

## 💻 System & Hardware Requirements

Before running the project locally, ensure your machine meets these basic requirements:

- **Operating System**: Windows 10/11, macOS, or Linux.
- **Node.js**: **v18.0.0 or higher** (v20 LTS or v22 LTS recommended).
- **Web Browser**: Google Chrome, Microsoft Edge, Brave, or Opera (Chromium-based browsers provide optimal WebGL and Web Audio performance).
- **Hardware**:
  - Any working webcam or smartphone front camera.
  - Hardware Acceleration turned **ON** in browser settings (`chrome://settings/system`).
  - 4 GB RAM minimum (8 GB recommended for 60 FPS recording).

---

## 🚀 Beginner's Quickstart Guide (Run Locally in 5 Minutes)

Follow these exact steps to clone, install, and run the project on your computer:

### Step 1: Install Node.js
If you don't already have Node.js installed:
1. Visit [nodejs.org](https://nodejs.org/) and download the **LTS (Long Term Support)** version.
2. Run the installer and click "Next" through the setup.
3. Open your terminal (**Command Prompt**, **PowerShell**, or **macOS Terminal**) and check that Node is installed:
   ```bash
   node -v
   npm -v
   ```
   *You should see version numbers (e.g., `v20.18.0` and `10.8.2`).*

---

### Step 2: Clone or Download the Project
In your terminal, navigate to the folder where you want to keep your project and run:

```bash
git clone https://github.com/amitsikdar37/confidence-booster-ai.git
cd "confidence-booster-ai"
```

*(If you downloaded the code as a ZIP file, extract it, and open your terminal inside the extracted folder).*

---

### Step 3: Install Dependencies
Run the following command to download all required packages:

```bash
npm install
```

> **Tip for beginners**: If npm displays warnings about optional dependencies, that is normal. As long as the command finishes without a red `ERR!`, the installation succeeded.

---

### Step 4: Start the Local Development Server
Run:

```bash
npm run dev
```

You will see output similar to this:

```text
  VITE v6.1.0  ready in 350 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.1.15:3000/
  ➜  press h + enter to show help
```

---

### Step 5: Open the App in Your Browser
1. Open Google Chrome or Microsoft Edge.
2. Go to **`http://localhost:3000`**.
3. When prompted, click **"Allow"** to grant camera access.
4. Click **`INITIALIZE TACTICAL CAM`**.
5. You're ready! Sip water, adjust your glasses, or press <kbd>SPACEBAR</kbd> to trigger a phonk drop!

---

## 📱 How to Run on Mobile (Same Local Wi-Fi)

The Vite development server is configured with `host: true`, allowing any smartphone on your local Wi-Fi to test the app:

1. Make sure your phone and PC are connected to the **same Wi-Fi network**.
2. Look at your terminal when running `npm run dev` to find your Network IP (e.g., `http://192.168.1.15:3000/`).
3. On your phone's browser, open `http://<your-pc-ip>:3000`.

> **Important Mobile Note for Local HTTP**:
> Modern mobile browsers restrict camera access on non-secure (`http://`) origins unless it is `localhost`.
> - **Option A (Instant)**: Test via the free live HTTPS deployment on Vercel: [am1t-builds-rm3g.vercel.app](https://am1t-builds-rm3g.vercel.app/).
> - **Option B (Chrome Flag)**: In Android Chrome, visit `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, enter `http://<your-pc-ip>:3000`, tap **Enabled**, and restart Chrome.
> - **Option C (Free HTTPS Tunnel)**: Run `npx localtunnel --port 3000` to get a temporary HTTPS URL for testing.

---

## 🎮 Controls & Interface Guide

| Control | Description |
|---|---|
| <kbd>SPACE</kbd> | **Force Drop Trigger**: Instantly fires the viral phonk edit without waiting for gesture detection. |
| **👻 GHOST TRAILS** | Selects the Montagem Tomada preset with ghost afterimages and 808 drop. |
| **🗿 SIGMA SNAPS** | Selects the Marlon Mogged preset with beat snap zooms and wasted aesthetic. |
| **⚡ DARK MANGA** | Selects the Mogger Phonk preset with B&W inverted flashes and strobe glitches. |
| **TRIGGER MODE** | Switch between `BOTH` (sip or glasses), `DRINK` only, or `GLASSES` only. |
| **SENSITIVITY** | Cycle AI detection threshold (`NORM` ➔ `HIGH` ➔ `HYPER`). |
| **CAMERA SWITCH** | Switch between front and rear cameras (on laptops or mobile devices). |
| **MIRROR** | Toggle horizontal video flip for a natural selfie-mirror view. |
| **TRACKS** | Opens the Soundboard modal to adjust master volume or test phonk drops. |
| **DOWNLOAD MP4** | Exports the recorded edit directly as a fast-start universal `.mp4` file. |

---

## 📁 Repository Directory Structure

```text
Confidence Booster AI/
├── public/
│   ├── audios/                     # Fallback audio assets
│   │   ├── marlon_gets_mogged.mp3
│   │   ├── mogger.mp3
│   │   └── Montagem_Tomada.mp3
│   └── pngs/                       # Visual overlay textures
│       └── MoggedPng.jpeg
├── src/
│   ├── audios/                     # High-fidelity phonk soundtrack buffers
│   ├── components/
│   │   ├── ControlsBar.tsx         # Bottom floating HUD controls & preset selector
│   │   ├── PipPlayer.tsx           # Picture-in-picture edit preview & MP4 download
│   │   └── SoundboardModal.tsx     # Phonk tracks & interactive soundboard
│   ├── pngs/                       # Mogger overlays & visual assets
│   ├── services/
│   │   ├── cameraManager.ts        # WebRTC camera manager with FOV & hardware zoom handling
│   │   ├── clipRecorder.ts         # Fast-start MP4 video & AAC audio recorder
│   │   ├── cube3dRenderer.ts      # 3D perspective wireframe target box renderer
│   │   ├── frameBuffer.ts         # Circular rolling RAM frame buffer (pre-roll replay)
│   │   ├── mobileDetector.ts      # Device profiler for locked 60 FPS mobile performance
│   │   ├── phonkAudioEngine.ts    # Web Audio API 808 synthesizer & beat sequencer
│   │   ├── sigmaEditRenderer.ts   # GPU compositing engine (blends, zooms, strobes)
│   │   ├── unthrottledDriver.ts   # Web Worker clock ensuring unthrottled background 60 FPS
│   │   └── visionDetector.ts      # MediaPipe FaceLandmarker & HandLandmarker pipeline
│   ├── types/
│   │   └── index.ts                # TypeScript interfaces & types
│   ├── App.tsx                     # Master orchestrator & render loop
│   ├── index.css                   # Tailwind directives & tactical HUD styling
│   ├── main.tsx                    # React application entry point
│   └── vite-env.d.ts               # Vite TypeScript environment types
├── index.html                      # HTML root template with fonts and meta tags
├── package.json                    # Project dependencies & npm scripts
├── tailwind.config.js              # Cyberpunk color palettes & theme configuration
├── tsconfig.json                   # Strict TypeScript compiler options
├── vercel.json                     # Production deployment routing rules
└── vite.config.ts                  # Vite server & build configuration
```

---

## 🛠️ Available NPM Scripts

In the project root, you can run:

| Command | Action |
|---|---|
| `npm run dev` | Starts the Vite local development server on `http://localhost:3000`. |
| `npm run build` | Runs TypeScript type-checking (`tsc`) and compiles optimized production assets to `dist/`. |
| `npm run preview` | Spins up a local web server to preview your production `dist/` build. |

---

## ❓ Troubleshooting (FAQ for Beginners)

### 1. "Port 3000 is in use, trying another one..."
- **What happened**: Another process (like a previously opened terminal or another app) is already using port 3000.
- **Solution**: Vite will automatically try port `3001` or `3002`. You can simply open the new port shown in your terminal. Alternatively, on Windows, close any existing node terminal or run `netstat -ano | findstr :3000` to find and stop the PID.

### 2. "Camera Access Error / Permission Denied"
- **What happened**: Your browser or operating system blocked camera access.
- **Solution**:
  1. Look at the address bar in Chrome/Edge, click the **Camera icon** or the **Tune/Lock icon** on the left of the URL, and select **"Allow"** for Camera.
  2. On **Windows**: Open Windows Settings ➔ **Privacy & Security** ➔ **Camera** ➔ Ensure **"Let desktop apps access your camera"** is toggled **ON**.
  3. Ensure no other application (like Zoom, Teams, or another browser window) is exclusively locking your webcam.

### 3. "The camera is lagging or dropping frames"
- **What happened**: Browser hardware acceleration is turned off.
- **Solution**:
  1. In Chrome, go to `chrome://settings/system`.
  2. Toggle **"Use graphics acceleration when available"** to **ON**.
  3. Relaunch your browser.

### 4. "The AI vision model takes 3-5 seconds to start"
- **What happened**: On first load, Google MediaPipe downloads its lightweight WebAssembly vision model from Google CDN and compiles it on your GPU.
- **Solution**: Once loaded, it stays cached in your browser for instant subsequent launches.

---

## 🔒 Security & Privacy

- **No Data Collection**: There are no tracking scripts, cookies, analytics, or external server uploads.
- **Local Media Streams**: Webcam frames remain strictly inside your browser's GPU buffer memory.
- **Open Source**: You can inspect every line of code in `src/` to verify audio and video processing is 100% self-contained.

---

## 📜 License

This project is open-source and licensed under the [MIT License](LICENSE).

---

<p align="center">
  <b>Built with 🗿 energy by <a href="https://github.com/amitsikdar37">am1t_builds</a></b><br>
  <i>Stay confident. Stay Sigma.</i>
</p>
