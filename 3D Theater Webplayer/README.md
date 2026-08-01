# 3D IMAX Theatre WebPlayer

A fully immersive 3D IMAX cinema hall experience built right in your browser!
This WebPlayer uses a local Node.js media server to instantly extract and process 5.1 Surround Sound audio, WebVTT subtitles, and stream high-quality MKV/MP4 files directly into a beautifully rendered 3D theatre.

## Features
- **Real 3D Cinema Environment**: Curved IMAX screen, stadium seating, and dynamic screen bloom.
- **5.1 Surround Sound Spatial Audio**: Dynamically maps 5.1 audio channels (like character dialogue) to physically modeled 3D speakers in the room using the Web Audio API.
- **On-the-Fly Audio Switching**: Change dubbed audio tracks instantly while the movie is playing without stalling!
- **Automatic Subtitles**: Automatically extracts subtitles from `.mkv` files and projects them into the 3D space with cinematic styling.
- **Look Around**: Click and drag your mouse to look around the immersive theatre.

---

## 🛠️ Step-by-Step Installation Tutorial

Because this player performs advanced media processing (like live FFmpeg audio track transcoding for MKV files), it requires a lightweight local server to run on your PC.

### Step 1: Install Node.js
If you don't have Node.js installed, download and install it from the official website: [Node.js Downloads](https://nodejs.org/)

### Step 2: Clone the Project
Download or clone this project to your local PC.

### Step 3: Install Dependencies
Open your terminal (Command Prompt, PowerShell, or macOS Terminal), navigate to the folder where you saved this project, and run:
```bash
npm install
```
*(This will automatically download the required FFmpeg binaries so you don't have to install them manually!)*

### Step 4: Add Your Movies 🍿
Create a folder named `movies` inside the project folder if it doesn't already exist.
Place your `.mkv`, `.mp4`, or `.webm` movie files directly into the `movies/` folder.

### Step 5: Start the IMAX Server
In your terminal, run the following command to start the backend server:
```bash
node server.js
```
You should see a message saying `🍿 IMAX Media Server is running!`.

### Step 6: Enjoy the Show!
Open your modern web browser (Google Chrome or Microsoft Edge recommended) and go to:
```
http://localhost:3000
```
Pick a movie from your library, click the gear icon to change audio or subtitles, sit back, and enjoy!

---

## Controls
| Key | Action |
|-----|--------|
| **Space** | Play / Pause |
| **Left / Right Arrow** | Skip backward/forward 10 seconds |
| **Up / Down Arrow** | Volume up/down |
| **F** | Toggle Fullscreen |
| **L** | Toggle Theatre Lights |
| **Mouse Drag** | Look around the cinema |

## Known Limitations
- The player requires a GPU for smooth 60fps rendering in the browser.
- Only `.mkv`, `.mp4`, `.mov`, `.m4v`, `.webm`, and `.ogv` are supported.
