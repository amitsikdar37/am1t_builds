# Website Cloner (Powered by Antigravity AI)

This is an advanced, two-phase AI website cloning tool. It uses Playwright to harvest a target website's raw data (HTML, CSS, computed styles, animations, and a smooth-scrolling video), and then prepares an ultra-detailed prompt for an Agentic AI (like Antigravity) to accurately reconstruct the site into a single, self-contained frontend.

## Features

- **Phase 1: Automated Harvesting**
  - Uses Playwright to navigate to the target URL.
  - Extracts the fully rendered DOM (`raw.html`).
  - Downloads and merges all stylesheets (`styles.css`).
  - Records a buttery-smooth scrolling video (`scroll_video.webm`) of the webpage so the AI can physically see the animations.
  - Extracts computed styles, color palettes, and structural metadata.
  - Generates an `animations.json` map of GSAP timelines, Webflow interactions, and CSS keyframes.

- **Phase 2: AI Generation**
  - Generates a tightly-constrained, highly specific prompt.
  - Enforces GSAP/Lenis best practices (waiting for `window.onload`, syncing ScrollTrigger).
  - You hand the prompt and the harvested bundle to an AI, and it writes the pixel-perfect clone directly into the `output/` directory!

## Prerequisites

You need [Node.js](https://nodejs.org/) installed on your machine (v18 or higher is recommended).

## Installation

1. **Clone or download this repository** to your local machine.
2. **Open a terminal** inside the root directory of the project.
3. **Install the Node dependencies:**
   ```bash
   npm install
   ```
4. **Install Playwright browsers:**
   Because this tool uses headless Chromium to take screenshots and record videos, you must install the Playwright browser binaries:
   ```bash
   npm run install:browsers
   ```
   *(or run `npx playwright install chromium`)*

## How to Run

1. Start the local server:
   ```bash
   npm start
   ```
2. Open your browser and go to: **[http://localhost:3000](http://localhost:3000)**

## Usage Guide

1. Enter the URL of the website you want to clone into the input field in the UI.
2. Click **Start Harvesting**. The server will launch a headless browser to record the site.
3. Once Phase 1 is complete, you will see a **"Copy AI Prompt"** button. Click it.
4. Open a **new chat** with your AI Assistant (like Antigravity).
5. Paste the prompt. The AI will read the `harvested_bundle` files and generate the HTML/CSS/JS directly into the `output/` folder.
6. Once the AI is finished, switch to the **"Generated Clone"** tab in the UI to preview your pixel-perfect site!

## Troubleshooting

- **Animations breaking in a new tab?**
  The AI prompt strictly enforces `window.addEventListener("load", ...)` for GSAP ScrollTrigger to ensure images are loaded before trigger calculations. If an animation still breaks, verify that the AI followed the GSAP rules and didn't use `DOMContentLoaded`.
- **AI writing Node.js scripts instead of HTML?**
  The prompt now bans the AI from writing `build.js` or `clone.js` scripts, forcing it to act as a pure frontend developer.
