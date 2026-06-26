# 💀 DoomScroll Punisher

**DoomScroll Punisher** is a harsh, no-nonsense productivity tool for Windows. It runs quietly in the background and watches your active windows. The moment you try to slack off on social media (YouTube, Instagram, Twitter/X, Reddit), it strikes.

### What Happens When You're Caught?
1. 📸 It secretly takes a screenshot of your screen.
2. 🤖 It sends the screenshot to Gemini AI (Google's artificial intelligence), which acts as your toxic productivity manager and generates a brutal, personalized roast based on what you were just looking at.
3. 🔒 A giant, flashing, inescapable red warning screen slams onto your monitor.
4. 💀 Your browser (Chrome, Edge, or Brave) is forcefully terminated — closing all your tabs.
5. 🔊 A robotic voice loudly reads the AI's insult to you.
6. You cannot escape the warning screen until you click the **[ I WILL GO BACK TO WORK ]** button.

---

## 🛠️ Setup Instructions (For Beginners)

You don't need to be a coder to use this, but you do need to set up a few things first. Follow these steps exactly:

### Step 1: Install Python
Your computer needs a program called Python to run this script.
1. Go to [python.org/downloads](https://www.python.org/downloads/)
2. Download the latest version for Windows.
3. **CRITICAL:** When you open the installer, check the box at the very bottom that says **"Add python.exe to PATH"** before you click Install.

### Step 2: Download This Project
1. Download this folder to your computer and extract it.
2. Open the folder so you can see all the files (`main.py`, `monitor.py`, etc.).

### Step 3: Get a Free Gemini API Key
This script uses Google's AI to generate the insults. You need a free "API Key" (a special password) to use it.
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click **"Create API key"**.
4. Copy the long string of letters and numbers it gives you.

### Step 4: Add the API Key to the Project
1. Inside the project folder, find the file named `.env.example`.
2. Rename this file to just `.env` (make sure there is no `.example` at the end).
3. Open the `.env` file with Notepad.
4. Paste your API key right after the equals sign, so it looks like this:
   ```text
   GEMINI_API_KEY=AIzaSy...your_key_here...
   ```
5. Save the file and close Notepad.

### Step 5: Install the Required Packages
The script needs a few extra tools to take screenshots and control your computer.
1. Click on the folder address bar at the top of the window, type `cmd`, and press **Enter**. This will open a black command prompt window.
2. In the black window, copy and paste this exact command and press **Enter**:
   ```cmd
   pip install -r requirements.txt
   ```
3. Wait for it to finish downloading everything.

---

## 🚀 How to Run the Punisher

Whenever you sit down to work and want to force yourself to focus:
1. Open the project folder.
2. Click the address bar, type `cmd`, and press **Enter**.
3. Type this command and press **Enter**:
   ```cmd
   python main.py
   ```
4. You will see a skull banner appear. **The Punisher is now active.**

Leave that black window open in the background and go do your work. If you open a browser tab with "youtube", "instagram", "twitter", "reddit", or "/ x" in the title... prepare to be punished.

To turn it off, go back to the black window and press `Ctrl + C`.

---

## ⚙️ Customization
If you want to change which websites are blocked, open `monitor.py` in Notepad and look for the `BLOCKED_KEYWORDS` list near the top. You can add or remove site names from that list.

*(Note: The script currently only terminates Chrome, Edge, and Brave browsers to preserve other work you might be doing in Firefox or Opera).*
