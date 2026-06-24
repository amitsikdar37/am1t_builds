# GitHub Profile Auditor (Hindi Roast Edition)

A brutally honest, 100% client-side React application that audits your GitHub profile and roasts you in Hindi based on your actual coding metrics.

![GitHub Auditor](https://img.shields.io/badge/Status-Brutal-red.svg)

## Features
- **Zero Backend**: Fetches GitHub data completely client-side using the public REST API.
- **Deep Analytics**: Analyzes Profile stats, Public Repositories, Event History, Starred Repos, Organizations, and Followers quality.
- **Archetype Engine**: Classifies developers into 11 distinct archetypes (e.g., *The Fake Senior*, *The Digital Hoarder*, *The Lone Wolf*).
- **Hindi Roast Terminal**: Dynamically generates a customized Hindi roast paragraph with a cyberpunk typewriter effect.

## How to Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```

## How to Deploy to Vercel

Since this project is built with **Vite** and **React**, it is incredibly easy to host on Vercel for free.

### Method 1: Using the Vercel Dashboard (Easiest)
1. Push this codebase to a public or private repository on your GitHub account.
2. Go to [Vercel.com](https://vercel.com/) and log in with your GitHub account.
3. Click **Add New...** -> **Project**.
4. Find your repository in the list and click **Import**.
5. Vercel will automatically detect that you are using Vite! It will pre-fill the correct settings:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Click **Deploy**. Within 30 seconds, your site will be live with a free `.vercel.app` URL!

### Method 2: Using the Vercel CLI
If you prefer deploying directly from VS Code:
1. Open your terminal in VS Code.
2. Install the Vercel CLI globally: `npm i -g vercel`
3. Type `vercel` and hit Enter.
4. Follow the prompt instructions (log in, link the folder, and deploy).
