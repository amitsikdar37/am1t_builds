# 💀 The Anti-Doomscroll Saboteur

A self-imposed punishment tool that watches your Instagram reel usage and automatically likes posts on a target profile when you go over your time limit.

---

## How it works

```
[Tkinter widget floats over your browser]
        ↓ timer hits 00:00
[PyAutoGUI jerks your mouse violently]
        ↓
[Selenium opens an invisible Chrome session]
        ↓
[Injects your saved Instagram cookies]
        ↓
[Navigates to the target Instagram profile]
        ↓
[Likes 3 posts automatically using JavaScript DOM interaction]
        ↓
[Widget self-destructs]
```

---

## Setup (one-time)

### 1. Install Python
Download from https://python.org — make sure to check "Add Python to PATH".

### 2. Create virtual environment & install dependencies
```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install pyautogui selenium webdriver-manager
```

### 3. Extract your Instagram Session Cookies
You only need to do this once, so the Saboteur can log into Instagram automatically without being blocked.

```powershell
.\venv\Scripts\python.exe setup.py
```
- A Chrome window will open to Instagram.
- Log in manually.
- Wait for the script to say `[+] Cookies saved to cookies.json` and close the browser.

---

## Usage

When you are about to start browsing Instagram, launch the Saboteur:

```powershell
.\venv\Scripts\python.exe saboteur.py
```

The red countdown widget will appear at the top-left of your screen.

### Try not to doomscroll.
When the timer hits `00:00`:
- Widget flashes white ⚡
- Mouse jerks violently across your screen 🖱️
- Chrome opens `instagram.com/_egoist.1/` in the background 🌐
- 3 posts get liked automatically ❤️
- Widget self-destructs 💥

---

## Config

The script reads the target Instagram profile URL directly from a file called `target.txt` in the same folder. 

If `target.txt` doesn't exist, it will be created automatically with a default placeholder (`https://example.com/`). Just open `target.txt` and paste the URL you want to target (e.g., `https://www.instagram.com/am1t_builds/`).

Other settings like the timer duration can be changed by editing the variables at the top of `saboteur.py`:

| Variable | Default | Description |
|---|---|---|
| `TIMER_SECONDS` | `10` | Set to `600` for 10 minutes |
| `POSTS_TO_LIKE` | `3` | How many posts to like |

---

## Abort

- **During countdown**: you can drag the widget around, or close the terminal window to stop it entirely.
- **During mouse jerk**: press `Ctrl+C` in the terminal.

---

## Troubleshooting

**"First-time setup required!"**
→ You haven't generated the `cookies.json` file yet. Run `setup.py` and log in to Instagram.

**"Could not find the Like button"**
→ Instagram may have updated its HTML structure. The script uses robust JavaScript DOM traversal, but if Instagram completely changes their DOM, the selectors in `saboteur.py` might need an update.
