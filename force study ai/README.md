# Force Study AI 📵📚

An AI-powered web application that monitors you via webcam while studying. Whenever you touch or hold your smartphone, it immediately catches you and plays legendary scolding meme audios from your `voices/` directory!

Every phone distraction plays a **distinct sound** without repeating until the entire pool is exhausted.

---

## ⚡ How to Run

### Option 1: Double-Click Launcher (Windows)
Double-click `start.bat`. It will launch the local server and automatically open the application in your browser at `http://localhost:8000`.

### Option 2: Command Line
```bash
python server.py
```
Then open your browser at **`http://localhost:8000`**.

---

## 🚀 How to Use

1. **Click "Start Study Session"**:
   - This requests camera permission and enables audio autoplay.
2. **Position Your Webcam**:
   - Make sure your desk and study area are in frame.
3. **Study Peacefully**:
   - The AI monitors your session in real-time.
4. **Touch Your Smartphone**:
   - 🚨 The moment your hand touches or holds your phone, a scolding meme will instantly fire!
   - A red alarm banner will pop up, and your distraction counter will increment.
5. **Put the Phone Down**:
   - Once the meme finishes speaking, put your phone away. The system will cool down and re-arm.
6. **Pick it up again**:
   - Next time you touch your smartphone, a **different distinct meme sound** will play!

---

## 🔊 Adding More Meme Sounds

You can drop any new audio files (`.mp3`, `.wav`, `.ogg`, `.m4a`) into the `voices/` folder:
`d:\VS Code\am1t_builds\force study ai\voices\`

The server dynamically scans the folder and includes them automatically in the scolding rotation without needing any code changes!

---

## 🧠 AI Features & Controls

- **Computer Vision Pipeline**:
  - **COCO-SSD (MobileNet v2)**: High-speed real-time smartphone object detection running locally in your browser via WebGL.
  - **MediaPipe Hands**: 21-point 3D hand tracking to verify hand-to-phone contact.
- **Detection Modes**:
  - **Hand Touching Phone (Default)**: Triggers only when your hand touches or holds the phone.
  - **Any Phone Visible**: Strict mode that triggers whenever a phone is anywhere within camera frame.
- **Non-Repeating Queue Engine**:
  - Guaranteed zero consecutive repetitions.
  - 100% distinct sound coverage per cycle.
- **Controls & HUD**:
  - Mirror flip toggle for natural webcam viewing.
  - Sensitivity and volume sliders.
  - Manual "Test Scold" button.
  - Sound preview buttons for all loaded memes.
  - Study timer and distraction counter.
