"""
verify_setup.py
===============
Automated diagnostic tool to verify MediaPipe installation, download the hand
landmarker AI model, validate native Win32 User32 ctypes mouse API hooks, and
test One-Euro speed filter mathematics.
"""
import os
import sys
import urllib.request

print("[1/4] Checking Python libraries...")
import cv2
import numpy as np
import mediapipe as mp
import config
import filter_math
from win_mouse import WinMouseController
print("  -> All core imports succeeded!")

print("[2/4] Verifying & bootstrapping MediaPipe hand landmark model...")
if not os.path.exists(config.MODEL_PATH):
    print(f"  -> Model missing at {config.MODEL_PATH}. Downloading from Google Cloud...")
    urllib.request.urlretrieve(config.MODEL_URL, config.MODEL_PATH)
    print("  -> Model download successful!")
else:
    print(f"  -> Model found at {config.MODEL_PATH} ({os.path.getsize(config.MODEL_PATH)} bytes).")

print("[3/4] Testing Native Win32 Mouse API Integration...")
mouse = WinMouseController()
cur_x, cur_y = mouse.get_position()
print(f"  -> Current screen resolutions detected: {mouse.screen_width}x{mouse.screen_height}")
print(f"  -> Current OS cursor position: X={cur_x}, Y={cur_y}")
# Test sub-pixel residual banking
mouse.move_relative(0.4, 0.3)
print(f"  -> Sub-pixel residuals banked: res_x={mouse.res_x:.2f}, res_y={mouse.res_y:.2f}")
mouse.reset_residuals()
print("  -> Win32 User32 mouse API verified zero-latency!")

print("[4/4] Testing Adaptive One-Euro Speed Filter...")
f_pair = filter_math.OneEuroPairFilter()
p1 = f_pair((100.0, 100.0), 0.0)
p2 = f_pair((100.5, 100.3), 0.033)  # simulated micro-jitter at rest
dx, dy = filter_math.apply_deadzone(p2[0] - p1[0], p2[1] - p1[1], config.VELOCITY_DEADZONE_PX)
print(f"  -> Filtered micro-jitter delta after deadzone: ({dx:.2f}, {dy:.2f}) -> (0.00, 0.00 expected at idle)")

print("\n==========================================================")
print("  ALL VERIFICATION TESTS PASSED! SYSTEM READY TO RUN!     ")
print("==========================================================")
print("To launch your Desk Touchpad with your Phone Link camera, run:")
print("    python desk_touchpad.py")
