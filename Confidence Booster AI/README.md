# 🗿 SIGMA // PHONK WEBCAM // TACTICAL MONITOR
### *Confidence Booster AI — Real-Time Computer Vision & Phonk Edit Generator*

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

> **Note:** Requires camera access. All AI vision processing, audio synthesis, and video rendering happen **100% client-side** directly in your browser. Zero video or biometric data is transmitted or stored on any server.

---

## ⚡ Overview

**Confidence Booster AI** (also known as **Sigma Phonk Webcam**) is a cutting-edge, browser-native tactical monitor and automated video editor. Using Google's **MediaPipe Vision AI**, the app tracks your face landmarks, head orientation (pitch, yaw, roll), and hand movements in real-time. 

When it detects an "alpha gesture"—such as taking a sip of your drink or adjusting your glasses—it instantly creates a synchronized, adrenaline-fueled **Phonk Beat Drop Edit** featuring fluid slow-motion build-ups, screen-shaking 808 impacts, chromatic aberration, ghost trails, and dark manga strobe glitches.

You can preview the generated edit instantly in Picture-in-Picture (PiP) and export it directly as a high-quality **MP4 video** with encoded audio!

---

## ✨ Key Features

### 🧠 1. Real-Time On-Device AI Vision
- **GPU-Accelerated Face & Hand Landmarker**: Powered by `@mediapipe/tasks-vision`, tracking 468+ facial landmarks and hand coordinates at 30–60 FPS.
- **Dynamic Action Detection**:
  - ☕ **Drink Sip Detection**: Automatically detects when a cup, bottle, or mug approaches your mouth with head tilt.
  - 👓 **Glasses Adjust Detection**: Detects hand elevation near the eye/temple region.
  - ⚡ **Dual Mode**: Monitors both gestures simultaneously.
  - 🎛️ **Sensitivity Tuner**: Cycle between `NORMAL`, `HIGH`, and `HYPER` sensitivity for different lighting conditions.

### 📐 2. 3D Perspective Tactical Target HUD
- **3D Wireframe Target Cube**: Renders a true 3D perspective-projected tactical wireframe bounding box anchored to your face that tracks 3D Euler angles (pitch, yaw, and roll).
- **Cyber Tactical Overlay**: Live millisecond timecodes, target acquisition crosshairs, CAM-01 status, and neon visualizers.
- **Mirror Mode Support**: Full horizontal flip alignment for natural selfie-camera interaction.

### 🎬 3. Multi-Take Cinematic Edit Presets
Each preset features dynamic slow-motion frame interpolation, camera zooms, flash strobe impacts, and beat synchronization:

| Preset | Sound / Track | Visual Style & Effects |
|---|---|---|
| **👻 GHOST TRAILS** | *Montagem Tomada* | Ethereal slow-motion ghost trails, afterimages, neon cyan/magenta beat pulses, and chromatic aberration. |
| **🗿 SIGMA SNAPS** | *Marlon Mogged* | Hard beat cuts, extreme zooms, bass shakes, mogger overlays, and wasted meme aesthetic. |
| **⚡ DARK MANGA** | *Mogger Phonk* | High-contrast black & white manga inversion, negative-film flashes, and lightning-fast strobe glitches. |

### 🔊 4. Web Audio Engine & Meme Soundboard
- **Synchronized 808 Bass Drops**: Visual edits are dynamically synchronized with musical drops down to the millisecond.
- **Track Selection**: Switch between high-energy phonk tracks including *Montagem Tomada*, *Marlon Mogged*, and *Mogger*.
- **Interactive Meme Soundboard**:
  - 🗿 *"What the sigma"*
  - 🐺 *"Sigma male rule #1: Never break eye contact"*
  - 💪 *"Gigachad mode activated"*
  - 💀 *"Emotional damage"*
  - 🔊 *Bass Cannon 808 & Vinyl Scratch FX*

### 📹 5. Fast-Start MP4 Video Export
- **In-Memory Frame Buffer**: Continuously maintains rolling frame buffers (pre-roll and post-roll takes) in RAM with zero lag.
- **Browser-Side MP4 Conversion**: Uses `@mediabunny` and `@mediabunny/aac-encoder` (WebAssembly AAC audio encoder) to produce universal, fast-start MP4 files ready for TikTok, Instagram Reels, and YouTube Shorts.

---

## 🕹️ Controls & Shortcuts

| Key / Control | Action |
|---|---|
| <kbd>SPACE</kbd> | **Force Drop / Trigger**: Manually initiate the phonk edit instantly without waiting for gesture detection. |
| **STYLE PRESETS** | Switch between *Ghost Trails*, *Sigma Snaps*, and *Dark Manga*. |
| **TRIGGER MODE** | Toggle between `BOTH`, `DRINK`, or `GLASSES` auto-detection. |
| **SENSITIVITY** | Cycle detection threshold (`NORM` $\rightarrow$ `HIGH` $\rightarrow$ `HYPER`). |
| **CAMERA** | Switch between available camera devices (front / rear). |
| **MIRROR** | Toggle horizontal video flip. |
| **AUDIO / TRACKS** | Mute/unmute master audio or open the Soundboard & Track selector. |
| **DOWNLOAD MP4** | Export and download the generated edit once playback completes. |
| **FULLSCREEN** | Toggle immersive edge-to-edge tactical display. |

---

## 🛠️ Tech Stack

- **Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Tooling**: [Vite 6](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 3](https://tailwindcss.com/) + Custom Cyberpunk / Tactical HUD CSS
- **AI / Computer Vision**: [@mediapipe/tasks-vision](https://developers.google.com/mediapipe/solutions/vision)
- **Audio Synthesis**: Web Audio API + HTML5 Audio
- **Video Processing & Encoding**:
  - [Mediabunny](https://github.com/Vanilagy/mediabunny)
  - [@mediabunny/aac-encoder](https://www.npmjs.com/package/@mediabunny/aac-encoder)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Special Effects**: [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti)
- **Deployment**: [Vercel](https://vercel.com/)

---

## 🚀 Getting Started (Local Development)

### Prerequisites
Make sure you have **Node.js** (v18.0 or newer) and **npm** installed on your system.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/confidence-booster-ai.git
   cd "Confidence Booster AI"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173`.

4. **Build for production:**
   ```bash
   npm run build
   ```
   The compiled production assets will be output to the `dist/` directory.

5. **Preview production build:**
   ```bash
   npm run preview
   ```

---

## 📁 Project Structure

```text
Confidence Booster AI/
├── public/
│   ├── audios/              # Fallback audio assets
│   ├── models/              # TFLite selfie segmenter models
│   └── pngs/                # Meme overlays & graphics
├── src/
│   ├── audios/              # Bundled phonk tracks (Tomada, Marlon Mogged, Mogger)
│   ├── components/
│   │   ├── ControlsBar.tsx  # Floating bottom cyber controls HUD
│   │   ├── EditOverlay.tsx  # Dynamic meme and reaction overlay
│   │   ├── PipPlayer.tsx    # Picture-in-picture video preview & download
│   │   ├── SoundboardModal.tsx # Track selection & meme soundboard
│   │   └── TacticalHUD.tsx  # Millisecond timecode & HUD visualizer
│   ├── pngs/                # Visual assets and mogger textures
│   ├── services/
│   │   ├── cameraManager.ts    # WebRTC camera feed handler & device switcher
│   │   ├── clipRecorder.ts     # Canvas recording & Mediabunny MP4 / AAC pipeline
│   │   ├── cube3dRenderer.ts   # 3D Euler-angle perspective target cube renderer
│   │   ├── frameBuffer.ts      # Low-latency circular RAM frame buffer
│   │   ├── phonkAudioEngine.ts # Web Audio API synthesizer & soundboard engine
│   │   ├── selfieSegmenter.ts  # Background isolation & portrait segmentation
│   │   ├── sigmaEditRenderer.ts# Phonk edit compositor (blends, zooms, strobes)
│   │   └── visionDetector.ts   # MediaPipe FaceLandmarker & HandLandmarker
│   ├── types/
│   │   └── index.ts         # TypeScript definitions for metrics, tracks & presets
│   ├── App.tsx              # Main orchestrator component
│   ├── index.css            # Tailwind & futuristic tactical typography styles
│   └── main.tsx             # React entry point
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vercel.json              # Vercel deployment routing configuration
└── vite.config.ts
```

---

## 🔒 Privacy & Performance

- **Zero Server Uplink**: No images, audio streams, or personal metrics ever leave your machine.
- **Hardware Acceleration**: Computation runs on WebGL and WebAssembly (WASM) via GPU delegates where supported.
- **Adaptive Frame Rate**: Optimizes canvas rendering loop dynamically based on device performance to maintain smooth FPS.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to open an issue or submit a pull request if you want to add new phonk tracks, visual presets, or detection triggers.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <b>Built with 🗿 energy by <a href="https://github.com/amitsikdar37">am1t_builds</a></b><br>
  <i>Stay confident. Stay Sigma.</i>
</p>
