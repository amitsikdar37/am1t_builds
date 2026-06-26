"""
analyzer.py — Screenshot Capture & Gemini AI Analysis
======================================================
Captures the current screen, sends it to Gemini 1.5 Flash with a strict
"toxic productivity officer" system prompt, and returns the roast string.
Gracefully falls back to hardcoded insults when the API key is missing
or the request fails.
"""

import logging
import random

import pyautogui
import PIL.Image

logger = logging.getLogger(__name__)

# ── System prompt fed to Gemini ──────────────────────────────────────
SYSTEM_PROMPT = (
    "You are a toxic, sarcastic productivity officer. Analyze this screenshot "
    "of a developer slacking off. Identify exactly what distracting content "
    "they are consuming, cross-reference it with the fact that they should be "
    "writing code, and generate a brutal, single-sentence insult (under 30 words) "
    "mocking their work ethic and choice of brainrot. Speak in direct, biting English. "
    "Reply with ONLY the insult — no preamble, no quotes, no extra text."
)

# ── Fallback roasts when Gemini is unavailable ───────────────────────
FALLBACK_ROASTS = [
    "Your code won't write itself, but apparently neither will you — too busy rotting your brain on the internet.",
    "Ah yes, doomscrolling — the ancient art of achieving absolutely nothing while feeling busy.",
    "Your IDE is crying in the background while you feast on digital garbage. Pathetic.",
    "The compiler doesn't care about memes. Get back to work, you absolute waste of RAM.",
    "Your GitHub contribution graph is flatter than your motivation. Close the tab.",
]


def capture_screenshot() -> PIL.Image.Image | None:
    """Grab a full-screen screenshot. Returns a PIL Image or None on failure."""
    try:
        screenshot = pyautogui.screenshot()
        logger.info("Screenshot captured (%dx%d).", screenshot.width, screenshot.height)
        return screenshot
    except Exception as exc:
        logger.error("Failed to capture screenshot: %s", exc)
        return None


def analyze_distraction(
    image: PIL.Image.Image | None,
    window_title: str,
    api_key: str | None = None,
) -> str:
    """
    Send a screenshot to Gemini 1.5 Flash and get a roast back.

    Args:
        image:        PIL Image of the current screen (can be None).
        window_title: Title of the offending window.
        api_key:      Gemini API key. If None, returns a fallback roast.

    Returns:
        A savage one-liner string.
    """
    if not api_key:
        logger.warning("No GEMINI_API_KEY configured — using fallback roast.")
        return random.choice(FALLBACK_ROASTS)

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = (
            f"{SYSTEM_PROMPT}\n\n"
            f"Context: The developer currently has this window in focus: '{window_title}'."
        )

        # Build content list — include image if available
        content = [prompt]
        if image is not None:
            content.append(image)

        response = model.generate_content(content)

        if response and response.text:
            roast = response.text.strip().strip('"').strip("'")
            logger.info("Gemini roast received (%d chars).", len(roast))
            return roast

        logger.warning("Gemini returned an empty response — using fallback.")
        return random.choice(FALLBACK_ROASTS)

    except Exception as exc:
        logger.error("Gemini API call failed: %s", exc)
        return random.choice(FALLBACK_ROASTS)
