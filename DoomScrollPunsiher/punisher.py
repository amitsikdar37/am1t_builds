"""
punisher.py — Fullscreen Lockdown Overlay (Tkinter)
====================================================
Launches an inescapable, fullscreen, always-on-top overlay with:
  • Flashing crimson header: [ BRAINROT DETECTED. PUNISHMENT ACTIVATED. ]
  • The AI-generated roast in a styled blockquote card
  • A single dismiss button: [ I WILL GO BACK TO WORK ]

The overlay cannot be Alt-F4'd, closed, or minimised.
"""

import tkinter as tk
import logging

logger = logging.getLogger(__name__)


class PunishmentOverlay:
    """Manages the fullscreen punishment UI."""

    def __init__(self, root: tk.Tk):
        self._root = root
        self._overlay: tk.Toplevel | None = None
        self._flash_state = True
        self._flash_job = None
        self._on_dismiss = None
        self._header_label = None

    # ── Public API ───────────────────────────────────────────────────

    def launch(self, roast_text: str, on_dismiss=None):
        """
        Show the punishment overlay.

        Args:
            roast_text: The Gemini-generated insult to display.
            on_dismiss: Callback invoked when the user clicks the dismiss button.
        """
        self._on_dismiss = on_dismiss
        self._build_overlay(roast_text)
        logger.info("🔒 Punishment overlay launched.")

    # ── UI Construction ──────────────────────────────────────────────

    def _build_overlay(self, roast_text: str):
        """Construct every widget for the lockdown screen."""
        overlay = tk.Toplevel(self._root)
        self._overlay = overlay

        overlay.title("DOOM SCROLL PUNISHER")
        overlay.configure(bg="#0B0F19")

        # ── Make it inescapable ──
        overlay.attributes("-fullscreen", True)
        overlay.attributes("-topmost", True)
        overlay.overrideredirect(False)  # keep title bar for grab_set compatibility
        overlay.protocol("WM_DELETE_WINDOW", lambda: None)

        # Block keyboard escape routes
        overlay.bind("<Alt-F4>", lambda e: "break")
        overlay.bind("<Escape>", lambda e: "break")
        overlay.bind("<Alt-Tab>", lambda e: "break")

        # ── Central content container ──
        container = tk.Frame(overlay, bg="#0B0F19")
        container.place(relx=0.5, rely=0.5, anchor="center")

        # ── Warning icon row ──
        icon_top = tk.Label(
            container,
            text="⚠️  💀  ⚠️",
            font=("Segoe UI Emoji", 52),
            bg="#0B0F19",
        )
        icon_top.pack(pady=(0, 25))

        # ── Flashing header ──
        self._header_label = tk.Label(
            container,
            text="[ BRAINROT DETECTED. PUNISHMENT ACTIVATED. ]",
            font=("Consolas", 34, "bold"),
            fg="#DC143C",
            bg="#0B0F19",
            wraplength=1200,
        )
        self._header_label.pack(pady=(0, 15))

        # ── Subtitle ──
        subtitle = tk.Label(
            container,
            text="Your browser has been terminated. Your dignity is next.",
            font=("Consolas", 14),
            fg="#555E7E",
            bg="#0B0F19",
        )
        subtitle.pack(pady=(0, 40))

        # ── Roast blockquote card ──
        # Outer frame = left accent border
        quote_outer = tk.Frame(container, bg="#DC143C")
        quote_outer.pack(padx=80, pady=(0, 50))

        # Inner card
        quote_card = tk.Frame(quote_outer, bg="#141927", padx=0, pady=0)
        quote_card.pack(padx=(4, 0), pady=0)  # 4px left red border

        # Card inner padding
        quote_inner = tk.Frame(quote_card, bg="#141927", padx=45, pady=30)
        quote_inner.pack()

        # Quote marks
        open_quote = tk.Label(
            quote_inner,
            text="❝",
            font=("Georgia", 32),
            fg="#DC143C",
            bg="#141927",
            anchor="w",
        )
        open_quote.pack(anchor="w")

        # Roast text
        roast_label = tk.Label(
            quote_inner,
            text=roast_text,
            font=("Georgia", 22, "italic"),
            fg="#E8E8E8",
            bg="#141927",
            wraplength=850,
            justify="center",
        )
        roast_label.pack(pady=(5, 5))

        # Closing quote
        close_quote = tk.Label(
            quote_inner,
            text="❞",
            font=("Georgia", 32),
            fg="#DC143C",
            bg="#141927",
            anchor="e",
        )
        close_quote.pack(anchor="e")

        # Attribution
        attr_label = tk.Label(
            quote_inner,
            text="— Gemini AI, Productivity Enforcement Division",
            font=("Consolas", 11),
            fg="#555E7E",
            bg="#141927",
            anchor="e",
        )
        attr_label.pack(anchor="e", pady=(5, 0))

        # ── Dismiss button ──
        dismiss_btn = tk.Button(
            container,
            text="[ I WILL GO BACK TO WORK ]",
            font=("Consolas", 18, "bold"),
            fg="#0B0F19",
            bg="#DC143C",
            activebackground="#FF1744",
            activeforeground="#FFFFFF",
            relief="flat",
            bd=0,
            padx=40,
            pady=15,
            cursor="hand2",
            command=self._dismiss,
        )
        dismiss_btn.pack(pady=(10, 0))

        # Hover effects for the button
        dismiss_btn.bind("<Enter>", lambda e: dismiss_btn.configure(bg="#FF1744", fg="#FFFFFF"))
        dismiss_btn.bind("<Leave>", lambda e: dismiss_btn.configure(bg="#DC143C", fg="#0B0F19"))

        # ── Start flashing animation ──
        self._flash_state = True
        self._flash_header()

        # ── Force focus & grab ──
        overlay.focus_force()
        overlay.grab_set()
        overlay.lift()

    # ── Animation ────────────────────────────────────────────────────

    def _flash_header(self):
        """Toggle header colour between bright crimson and dark red."""
        if self._overlay is None or not self._overlay.winfo_exists():
            return

        self._flash_state = not self._flash_state
        colour = "#DC143C" if self._flash_state else "#4A0000"
        self._header_label.configure(fg=colour)

        self._flash_job = self._overlay.after(500, self._flash_header)

    # ── Dismiss Logic ────────────────────────────────────────────────

    def _dismiss(self):
        """Tear down the overlay and invoke the on_dismiss callback."""
        # Cancel pending animation
        if self._flash_job and self._overlay:
            self._overlay.after_cancel(self._flash_job)
            self._flash_job = None

        # Release grab and destroy
        if self._overlay:
            try:
                self._overlay.grab_release()
            except tk.TclError:
                pass
            self._overlay.destroy()
            self._overlay = None

        logger.info("🔓 Punishment overlay dismissed. User has promised to work.")

        if self._on_dismiss:
            self._on_dismiss()
