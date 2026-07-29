"""
win_mouse.py
============
Direct Win32 API ctypes wrapper for high-performance, zero-latency mouse
control, sub-pixel residual motion accumulation, click execution, and scrolling.

Replaces sluggish higher-level libraries with instantaneous system calls.
"""
import ctypes
from ctypes import wintypes
import time

# ==============================================================================
# WIN32 API STRUCTURES & CONSTANTS
# ==============================================================================
user32 = ctypes.WinDLL('user32', use_last_error=True)

# Mouse event flag constants
MOUSEEVENTF_MOVE       = 0x0001
MOUSEEVENTF_LEFTDOWN   = 0x0002
MOUSEEVENTF_LEFTUP     = 0x0004
MOUSEEVENTF_RIGHTDOWN  = 0x0008
MOUSEEVENTF_RIGHTUP    = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP   = 0x0040
MOUSEEVENTF_WHEEL      = 0x0800
MOUSEEVENTF_ABSOLUTE   = 0x8000

class POINT(ctypes.Structure):
    _fields_ = [("x", wintypes.LONG),
                ("y", wintypes.LONG)]

# Configure ctypes argtypes and restypes for safety
user32.GetCursorPos.argtypes = [ctypes.POINTER(POINT)]
user32.GetCursorPos.restype  = wintypes.BOOL
user32.SetCursorPos.argtypes = [wintypes.INT, wintypes.INT]
user32.SetCursorPos.restype  = wintypes.BOOL
user32.mouse_event.argtypes  = [wintypes.DWORD, wintypes.DWORD, wintypes.DWORD, wintypes.DWORD, ctypes.c_ulong]
user32.mouse_event.restype   = None
user32.GetSystemMetrics.argtypes = [wintypes.INT]
user32.GetSystemMetrics.restype  = wintypes.INT

SM_CXSCREEN = 0
SM_CYSCREEN = 1


class WinMouseController:
    """
    Manages low-latency mouse actions and handles sub-pixel precision accumulation
    so that slow diagonal sliding doesn't lose fractional pixel movements to integer rounding.
    """
    def __init__(self):
        self.screen_width  = user32.GetSystemMetrics(SM_CXSCREEN)
        self.screen_height = user32.GetSystemMetrics(SM_CYSCREEN)
        
        # Sub-pixel residual accumulators for precise slow-speed glides
        self.res_x = 0.0
        self.res_y = 0.0
        
        # Track button states to ensure safe releases upon shutdown or liftoff
        self.left_button_down  = False
        self.right_button_down = False

    def get_position(self) -> tuple[int, int]:
        """Return current absolute OS cursor coordinates (x, y)."""
        pt = POINT()
        user32.GetCursorPos(ctypes.byref(pt))
        return pt.x, pt.y

    def move_relative(self, dx: float, dy: float) -> tuple[int, int]:
        """
        Move mouse relative to current position by (dx, dy) pixels.
        Includes sub-pixel remainder banking for super-smooth precision tracking.
        Returns the new absolute cursor position.
        """
        # Add residual sub-pixel fractions from previous frame
        total_dx = dx + self.res_x
        total_dy = dy + self.res_y
        
        # Quantize to integer pixels for OS cursor command
        step_x = int(total_dx)
        step_y = int(total_dy)
        
        # Store unspent fractional residues for the next iteration
        self.res_x = total_dx - step_x
        self.res_y = total_dy - step_y
        
        if step_x != 0 or step_y != 0:
            cur_x, cur_y = self.get_position()
            new_x = max(0, min(self.screen_width  - 1, cur_x + step_x))
            new_y = max(0, min(self.screen_height - 1, cur_y + step_y))
            user32.SetCursorPos(new_x, new_y)
            return new_x, new_y
        
        return self.get_position()

    def set_absolute_position(self, x: int, y: int) -> None:
        """Instantly teleport cursor to absolute screen coordinate."""
        user32.SetCursorPos(x, y)
        self.reset_residuals()

    def reset_residuals(self) -> None:
        """Clear fractional accumulators when finger is lifted or movement pauses."""
        self.res_x = 0.0
        self.res_y = 0.0

    def click_left(self) -> None:
        """Execute a crisp, instant left click (press + release)."""
        user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
        user32.mouse_event(MOUSEEVENTF_LEFTUP,   0, 0, 0, 0)

    def click_right(self) -> None:
        """Execute an instant right click (context menu)."""
        user32.mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
        user32.mouse_event(MOUSEEVENTF_RIGHTUP,   0, 0, 0, 0)

    def press_left_button(self) -> None:
        """Hold down left mouse button (for drag-and-drop gestures)."""
        if not self.left_button_down:
            user32.mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
            self.left_button_down = True

    def release_left_button(self) -> None:
        """Release left mouse button if currently held down."""
        if self.left_button_down:
            user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
            self.left_button_down = False

    def scroll_vertical(self, amount: float) -> None:
        """
        Scroll mouse wheel vertically.
        `amount` > 0 scrolls UP away from user; < 0 scrolls DOWN toward user.
        """
        # Standard Win32 wheel click delta is 120 per click step
        wheel_delta = int(amount * 120)
        if abs(wheel_delta) > 0:
            user32.mouse_event(MOUSEEVENTF_WHEEL, 0, 0, wheel_delta, 0)

    def release_all(self) -> None:
        """Safety cleanup: release any trapped mouse buttons."""
        if self.left_button_down:
            user32.mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
            self.left_button_down = False
        if self.right_button_down:
            user32.mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
            self.right_button_down = False
        self.reset_residuals()
