# Sketch to Website 🎨 ➡️ 💻

A magical AI-powered tool that takes a hand-drawn sketch of a website and automatically generates a stunning, fully-functional React (Vite) codebase for it. 

Instead of relying on costly API calls, this project uses a cutting-edge **Local Agent Architecture** powered by the Antigravity (`agy`) CLI to write the code directly on your machine.

---

## 🏗️ Architecture

This is a monorepo consisting of two parts:
1. **Client (Frontend):** A React (Vite) app where you upload your sketch. It shows a beautiful loading UI and a live code preview of the generated site.
2. **Server (Backend):** An Express server that receives the sketch, saves it locally, and orchestrates the `agy` CLI in the background to build the site file-by-file.

Because it uses the `agy` CLI under the hood:
- **No API keys are required** in this project's `.env`.
- Generation takes a few minutes as the agent autonomously creates files in the background.
- It leverages the powerful Gemini models via your existing local CLI authorization.

---

## 🚀 Getting Started

### Prerequisites
1. **Node.js** (v18+)
2. **Antigravity CLI (`agy`)** must be installed and authenticated on your machine.

### Installation
Clone the repository and install dependencies for both the root, server, and client:

```bash
npm run install:all
```
*(This is a shortcut script that runs `npm install` in the root, `/server`, and `/client` directories).*

### Running the App
Start both the frontend and backend development servers concurrently with a single command:

```bash
npm run dev
```

- The **Client** will open at `http://localhost:5173`
- The **Server** will run on `http://localhost:3001`

*(If those ports are in use, the script will automatically attempt to kill the stale processes to free them up).*

---

## 🛠️ How it Works
1. You upload an image on the frontend.
2. The image is POSTed to the backend `/api/generate`.
3. The backend saves the image to `server/temp/sketch_<id>.png`.
4. The backend spawns a local `agy` process with a strict prompt:
   `agy --dangerously-skip-permissions --new-project --print "Analyze the sketch... Generate a Vite React website..."`
5. The `agy` CLI creates the files in `server/temp/output_<id>/`.
6. Once complete, the backend reads the generated files, packages them into a JSON payload, and sends them to the frontend via Server-Sent Events (SSE).
7. The frontend renders the code and a live `iframe` preview.

## 📝 Environment Variables
You can optionally configure the server port by creating a `.env` file in the root directory:
```env
PORT=3001
```
