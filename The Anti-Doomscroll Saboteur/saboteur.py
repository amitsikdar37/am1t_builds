"""
The Anti-Doomscroll Saboteur
-----------------------------
When the timer runs out, it opens Instagram and likes posts
on the target profile automatically.

FIRST TIME SETUP (run once):
    .\\venv\\Scripts\\python.exe setup.py

THEN RUN EVERY SESSION:
    .\\venv\\Scripts\\python.exe saboteur.py

STOP ANYTIME:
    Ctrl+C in the terminal.
"""

import tkinter as tk
import threading
import time
import json
import os

import pyautogui
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from webdriver_manager.chrome import ChromeDriverManager

pyautogui.FAILSAFE = False

# ══════════════════════════════════════════════════
#   CONFIG
# ══════════════════════════════════════════════════
TIMER_SECONDS = 20          # change to 600 for 10 minutes
POSTS_TO_LIKE = 3           # how many posts to like
COOKIES_FILE  = "cookies.json"   # created by setup.py
TARGET_FILE   = "target.txt"

# Read target profile URL from target.txt
try:
    with open(TARGET_FILE, "r") as f:
        INSTAGRAM_PROFILE = f.read().strip()
    if not INSTAGRAM_PROFILE:
        INSTAGRAM_PROFILE = "https://example.com/"
except FileNotFoundError:
    INSTAGRAM_PROFILE = "https://example.com/"
    with open(TARGET_FILE, "w") as f:
        f.write(INSTAGRAM_PROFILE)
    print(f"[*] Created default {TARGET_FILE}. Edit this file to change the target profile.")
# ══════════════════════════════════════════════════


def like_posts():
    """Open a fresh Chrome, inject Instagram cookies, like posts."""

    # ── Check cookies exist ───────────────────────────────────────
    if not os.path.exists(COOKIES_FILE):
        print(f"[!] {COOKIES_FILE} not found.")
        print("[!] Run setup.py first:  .\\venv\\Scripts\\python.exe setup.py")
        return

    with open(COOKIES_FILE) as f:
        cookies = json.load(f)

    # ── Launch a fresh Chrome (no profile conflicts) ──────────────
    print("[*] Opening Chrome...")
    options = Options()
    options.add_argument("--start-maximized")
    options.add_argument("--no-first-run")
    options.add_argument("--no-default-browser-check")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    service = Service(ChromeDriverManager().install())
    driver  = webdriver.Chrome(service=service, options=options)

    try:
        # ── Inject Instagram cookies ──────────────────────────────
        print("[*] Loading Instagram session...")
        driver.get("https://www.instagram.com/")
        time.sleep(2)

        for cookie in cookies:
            # Selenium requires 'sameSite' to be a specific value
            cookie.pop("sameSite", None)
            try:
                driver.add_cookie(cookie)
            except Exception:
                pass

        # Refresh to apply cookies (now logged in)
        driver.refresh()
        time.sleep(4)

        # ── Navigate to the target profile ────────────────────────
        print(f"[*] Going to {INSTAGRAM_PROFILE}")
        driver.get(INSTAGRAM_PROFILE)
        time.sleep(5)

        # ── Collect post URLs from the grid ──────────────────────
        print("[*] Looking for posts...")
        try:
            WebDriverWait(driver, 12).until(
                EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "a[href*='/p/'], a[href*='/reel/']")
                )
            )
        except TimeoutException:
            print("[!] No posts found. Are you logged in? Re-run setup.py.")
            return

        post_links = driver.find_elements(
            By.CSS_SELECTOR, "a[href*='/p/'], a[href*='/reel/']"
        )

        # Extract unique post URLs from the grid
        post_urls = []
        seen = set()
        for a in post_links:
            href = a.get_attribute("href")
            if href and href not in seen:
                seen.add(href)
                post_urls.append(href)
            if len(post_urls) >= POSTS_TO_LIKE:
                break

        print(f"[*] Found {len(post_urls)} posts to like.")

        # ── Navigate to each post URL directly and like it ────────
        # This is more reliable than clicking the modal lightbox.
        for i, url in enumerate(post_urls):
            print(f"\n[*] Opening post {i + 1}/{len(post_urls)}: {url}")
            driver.get(url)
            time.sleep(5)  # extra wait for full render

            liked = False

            # ── Click the post Like button ───────────────────────────
            # Strategy from diagnostic:
            #   - Share/Comment SVGs are confirmed inside <section> (post action bar)
            #   - Post Like SVG is also in that section (but deeper, so section wasn't
            #     visible in our 5-level path scan above)
            #   - Comment like buttons are NOT in that section
            # So: find section via Share/Comment, then querySelector Like inside it.
            result = driver.execute_script("""
                const allSvgs = Array.from(document.querySelectorAll('svg[aria-label]'));

                // Anchor on Share or Comment SVG — both are confirmed inside <section>
                const anchor = allSvgs.find(s =>
                    s.getAttribute('aria-label') === 'Share' ||
                    s.getAttribute('aria-label') === 'Comment'
                );
                const section = anchor ? anchor.closest('section') : null;

                let likeSvg = null;
                if (section) {
                    // Find Like inside the post action section
                    likeSvg = section.querySelector('svg[aria-label="Like"]');
                }

                // Fallback: post like button has span as div[role=button]'s grandparent
                // (comment like buttons have div instead — confirmed from diagnostic)
                if (!likeSvg) {
                    const allLike = Array.from(document.querySelectorAll('svg[aria-label="Like"]'));
                    likeSvg = allLike.find(s => {
                        const btn = s.closest('[role="button"]');
                        return btn && btn.parentElement &&
                               btn.parentElement.parentElement &&
                               btn.parentElement.parentElement.tagName === 'SPAN';
                    });
                }

                if (!likeSvg) return 'not_found';

                const btn = likeSvg.closest('[role="button"]') ||
                            likeSvg.closest('button');
                if (!btn) return 'no_button';

                btn.click();
                return 'clicked';
            """)

            if result == 'clicked':
                print(f"[+] Post {i + 1}/{len(post_urls)} liked!")
                liked = True
            elif result == 'not_found':
                already = driver.execute_script(
                    'return !!document.querySelector(\'svg[aria-label="Unlike"]\');'
                )
                if already:
                    print(f"[~] Post {i + 1} already liked -- skipping.")
                    liked = True
                else:
                    shot = os.path.join(os.path.dirname(__file__), f"debug_post_{i+1}.png")
                    driver.save_screenshot(shot)
                    print(f"[!] Like button not found. Debug screenshot: {shot}")
            else:
                shot = os.path.join(os.path.dirname(__file__), f"debug_post_{i+1}.png")
                driver.save_screenshot(shot)
                print(f"[!] JS returned: {result}. Debug screenshot: {shot}")


            time.sleep(2)




        print("\n[DONE] All posts liked!")

    finally:
        time.sleep(3)
        driver.quit()


# ══════════════════════════════════════════════════
#   TKINTER COUNTDOWN WIDGET
# ══════════════════════════════════════════════════

class Saboteur:
    BG        = "#0a0a0a"
    RED       = "#ff2200"
    DIM_RED   = "#8b1000"
    WHITE     = "#ffffff"
    BAR_BG    = "#1a1a1a"

    def __init__(self):
        self.remaining = TIMER_SECONDS
        self.total     = TIMER_SECONDS
        self._pulse    = 0  # for glow animation

        self.root = tk.Tk()
        self.root.title("Doomscroll Saboteur")
        self.root.attributes("-topmost", True)
        self.root.overrideredirect(True)          # no titlebar
        self.root.attributes("-alpha", 0.93)
        self.root.configure(bg=self.BG)

        # ── Outer frame with coloured border ────────────────────
        self.frame = tk.Frame(
            self.root,
            bg=self.BG,
            highlightbackground=self.RED,
            highlightthickness=2,
        )
        self.frame.pack(fill="both", expand=True)

        # ── Row 1: skull + big timer ─────────────────────────────
        # Pre-populate with the longest text so initial width is correct
        self.timer_label = tk.Label(
            self.frame,
            text=" DOOMSCROLL LIMIT: 00:00 ",
            font=("Courier New", 32, "bold"),
            fg=self.RED,
            bg=self.BG,
            padx=20,
            pady=6,
        )
        self.timer_label.pack(fill="x")

        # ── Row 2: subtitle ──────────────────────────────────────
        self.sub_label = tk.Label(
            self.frame,
            text="Stop scrolling before it's too late.",
            font=("Courier New", 10),
            fg=self.DIM_RED,
            bg=self.BG,
            pady=0,
        )
        self.sub_label.pack(fill="x")

        # ── Row 3: progress bar (canvas) ─────────────────────────
        self.bar_canvas = tk.Canvas(
            self.frame,
            height=6,
            bg=self.BAR_BG,
            highlightthickness=0,
        )
        self.bar_canvas.pack(fill="x", padx=0, pady=(4, 0))
        self.bar_rect = self.bar_canvas.create_rectangle(
            0, 0, 0, 6, fill=self.RED, outline=""
        )

        # ── Make window auto-fit content ─────────────────────────
        self.root.update_idletasks()
        w = self.frame.winfo_reqwidth()
        h = self.frame.winfo_reqheight()
        # Force a larger minimum width to ensure no clipping
        self.root.geometry(f"{max(w, 620)}x{h}+50+50")

        # ── Draggable ────────────────────────────────────────────
        for widget in (self.frame, self.timer_label, self.sub_label):
            widget.bind("<ButtonPress-1>", self._drag_start)
            widget.bind("<B1-Motion>",     self._drag_move)

        self._tick()

    def _drag_start(self, e):
        self._ox, self._oy = e.x_root - self.root.winfo_x(), e.y_root - self.root.winfo_y()

    def _drag_move(self, e):
        self.root.geometry(f"+{e.x_root - self._ox}+{e.y_root - self._oy}")

    def _update_bar(self):
        self.bar_canvas.update_idletasks()
        total_w = self.bar_canvas.winfo_width()
        frac    = self.remaining / self.total if self.total > 0 else 0
        fill_w  = int(total_w * frac)
        # Colour shifts red → orange → yellow as time runs out
        if frac > 0.5:
            colour = self.RED
        elif frac > 0.25:
            colour = "#ff6600"
        else:
            colour = "#ffcc00"
        self.bar_canvas.itemconfig(self.bar_rect, fill=colour)
        self.bar_canvas.coords(self.bar_rect, 0, 0, fill_w, 6)

    def _tick(self):
        if self.remaining > 0:
            m, s = divmod(self.remaining, 60)

            # Pulse brightness on the last 10 seconds
            if self.remaining <= 10:
                self._pulse = (self._pulse + 1) % 2
                fg = self.RED if self._pulse else "#ff6633"
            else:
                fg = self.RED

            self.timer_label.config(
                text=f" DOOMSCROLL LIMIT: {m:02d}:{s:02d} ",
                fg=fg,
            )
            self._update_bar()
            self.remaining -= 1
            self.root.after(1000, self._tick)
        else:
            self._punish()

    def _punish(self):
        # Flash white, lock timer at 00:00
        self.timer_label.config(text=" DOOMSCROLL LIMIT: 00:00 ", fg="#000", bg=self.WHITE)
        self.sub_label.config(
            text="TIME'S UP. CAUGHT YOU. Liking posts now...",
            fg="#000", bg=self.WHITE, font=("Courier New", 11, "bold")
        )
        self.frame.config(bg=self.WHITE, highlightbackground=self.WHITE)
        self.root.configure(bg=self.WHITE)
        self.bar_canvas.config(bg="#ff2200")
        
        # Auto-resize just in case the new subtitle is wider
        self.root.update_idletasks()
        w = self.frame.winfo_reqwidth()
        h = self.frame.winfo_reqheight()
        self.root.geometry(f"{max(w, 440)}x{h}")
        self.root.update()

        # Violent mouse jerk
        sw, sh = pyautogui.size()
        for x, y in [
            (int(sw * 0.5),  int(sh * 0.33)),
            (int(sw * 0.67), int(sh * 0.5)),
            (int(sw * 0.33), int(sh * 0.6)),
            (int(sw * 0.5),  int(sh * 0.5)),
        ]:
            pyautogui.moveTo(x, y, duration=0.08)

        threading.Thread(target=self._run_selenium, daemon=True).start()

    def _run_selenium(self):
        try:
            like_posts()
        except Exception as e:
            print(f"[!] Error: {e}")
        finally:
            self.root.after(3000, self.root.destroy)

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    if not os.path.exists(COOKIES_FILE):
        print("=" * 55)
        print("  First-time setup required!")
        print("  Run: .\\venv\\Scripts\\python.exe setup.py")
        print("=" * 55)
    else:
        print("=" * 55)
        print("  Doomscroll Saboteur is running.")
        print(f"  Timer : {TIMER_SECONDS} seconds")
        print(f"  Target: {INSTAGRAM_PROFILE}")
        print("  Stop  : Ctrl+C")
        print("=" * 55)
        Saboteur().run()

