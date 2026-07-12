# Website Cloner

An incredibly fast, highly-accurate website cloning tool that uses a **Zero-AI, Auto-Assembly Architecture**. 

It uses Playwright to harvest a target website's raw data (pristine initial HTML, all CSS stylesheets, and design assets) and automatically bundles them into a perfectly formatted, highly-maintainable clone project.

## How it works (Zero-AI Architecture)

Previously, this tool relied on LLMs to write code based on scraped data, which often resulted in hallucinated code, broken animations, or failed generation. 

The new pipeline is **100% deterministic** and perfectly preserves complex Webflow and GSAP animations:

1. **Harvest:** Playwright navigates to the target URL. It intercepts all CSS stylesheets and captures the pristine `initialHTML` exactly as the server sent it—*before* any JavaScript mutates the DOM. This preserves the pre-loaders and exact starting states for animations.
2. **Auto-Assemble:** It injects a `<base href="...">` tag into the HTML. This magic tag forces the browser to resolve all relative links (images, fonts, APIs, and scripts) against the original live website. 
3. **Format:** It uses `prettier` to un-minify the massive chunks of code, extracting the CSS into a beautifully formatted `styles.css` file and creating a highly readable `index.html`.
4. **ZIP Project:** It bundles the split, formatted files into a `clone_project.zip` file ready for you to download and modify.

Because the clone borrows the original scripts directly from the live site via the `<base>` tag, all scrolling effects, GSAP timelines, and interactions work flawlessly out of the box.

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

1. Start the local Express server:
   ```bash
   npm start
   ```
2. Open your browser and navigate to: **[http://localhost:3000](http://localhost:3000)**

## Usage Guide

1. Enter the URL of the website you want to clone into the input field in the UI.
2. Click **Start Cloning**. The server will launch a headless browser in the background to harvest the site.
3. You will see a live terminal streaming the progress (Navigating, Intercepting CSS, Assembling...).
4. Once complete, the UI will switch to the **Generated Clone** tab, showing an instant live preview.
5. Click **⬇️ Download ZIP Project** to download the clean, heavily formatted `index.html` and `styles.css` workspace. 
6. Open the extracted folder in VS Code to modify the text, HTML structure, or CSS styles however you want!
