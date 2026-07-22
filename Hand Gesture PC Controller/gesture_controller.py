# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════╗
║            HAND GESTURE PC CONTROLLER                        ║
║  Controls your PC via webcam hand gestures using MediaPipe   ║
╠══════════════════════════════════════════════════════════════╣
║  GESTURES:                                                   ║
║  • Open hand / pointing  → Mouse cursor (laser pointer)      ║
║  • Index finger only up  → Scroll (velocity-based)           ║
║  • Thumb + index pinch   → Volume control (stretch gap)      ║
║  • Cursor hold still 1.5s → Dwell click (auto left-click)    ║
╚══════════════════════════════════════════════════════════════╝
  Press Q in the HUD window to quit.
"""

import cv2
import mediapipe as mp
import pyautogui
import numpy as np
import time
import math
import sys
import collections
from ctypes import cast, POINTER

# ──────────────────────────────────────────────────────────────────────────────
# CONFIGURATION  (tweak these to your liking)
# ──────────────────────────────────────────────────────────────────────────────
CAMERA_INDEX       = 0       # Webcam index (0 = default)
CAM_W, CAM_H       = 1280, 720

# ── Mouse (Fixed-Base Displacement Joystick) ───────────────────────────────────
# Point finger at screen → base position is saved.
# Move tip left/right/up/down from base → cursor keeps moving that direction.
# Return tip to base → cursor stops. Hand leaves frame → base resets.
MOUSE_DEAD_ZONE     = 0.030  # Displacement from base below this = cursor frozen
MOUSE_MAX_DISP      = 0.20   # Displacement for full speed (hold past this = max speed)
MOUSE_MAX_SPEED_PX  = 45.0   # Cursor pixels per frame at max displacement
MOUSE_ACCEL         = 1.4    # Speed curve: higher = more precision at small displacements

# ── Eye-Gaze Scroll ──────────────────────────────────────────────────────────
# Joystick model: hold eyes above/below thresholds to scroll continuously.
# The resting position of the eye is usually negative (e.g. -0.05), so the dead zone must be asymmetric.
Y_UP_THRESH          = -0.10  # Look UP threshold (gaze_y must be < this)
Y_DOWN_THRESH        = 0.08   # Look DOWN threshold (gaze_y must be > this)

EYE_SCROLL_MAX_DISP  = 0.08   # Additional displacement beyond threshold for MAX speed
EYE_SCROLL_MAX_SPEED = 40.0   # Wheel clicks per second at full displacement (very fast)
EYE_SCROLL_CURVE     = 1.5    # 1.0=linear, 1.5=mild curve
EYE_SMOOTH           = 0.30   # EMA weight for eye smoothing

EAR_BLINK_THRESH     = 0.24   # If EAR drops below this, consider it a blink
POST_BLINK_BLOCK_SEC = 0.15   # Seconds to ignore gaze AFTER eyes open (debounce)


R_IRIS = 468;  L_IRIS = 473
R_INNER = 133; R_OUTER = 33
L_INNER = 362; L_OUTER = 263
R_EAR = {"p1":33,  "p2":160, "p3":158, "p4":133, "p5":153, "p6":144}
L_EAR = {"p1":362, "p2":385, "p3":387, "p4":263, "p5":380, "p6":373}


# ── Volume ───────────────────────────────────────────────────────────────────
# Sticky-state model: pinch to enter, spread freely to adjust, open hand to exit.
VOL_PINCH_ENTER    = 0.035  # Reduced threshold: must be a VERY tight pinch to enter (stops false triggers)
VOL_MIN_DIST       = 0.03   # Distance that maps to   0 % volume
VOL_MAX_DIST       = 0.30   # Distance that maps to 100 % volume  (full stretch)
VOL_SMOOTH         = 0.15   # EMA weight for volume smoothing (avoids audio crackling)
# Exit volume mode when middle+ring+pinky are ALL extended (open-hand gesture)

# ── Dwell Click ──────────────────────────────────────────────────────────────
DWELL_RADIUS_PX    = 5       # Pixels: cursor must stay within this circle
DWELL_TIME_SEC     = 1.5     # Seconds of stillness before auto-click fires

DETECTION_CONF     = 0.80
TRACKING_CONF      = 0.75


# ──────────────────────────────────────────────────────────────────────────────
# SCREEN RESOLUTION  — auto-detected, never hardcoded
# ──────────────────────────────────────────────────────────────────────────────
SCREEN_W, SCREEN_H = pyautogui.size()


from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

import os
import urllib.request

# ──────────────────────────────────────────────────────────────────────────────
# MEDIAPIPE SETUP
# ──────────────────────────────────────────────────────────────────────────────
def ensure_model_files():
    """Auto-downloads MediaPipe task files if they are missing."""
    models = {
        'hand_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        'face_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
    }
    for filename, url in models.items():
        if not os.path.exists(filename) or os.path.getsize(filename) == 0:
            print(f"[INFO] Downloading {filename} from MediaPipe models repository...")
            try:
                urllib.request.urlretrieve(url, filename)
                print(f"[INFO] {filename} downloaded successfully.")
            except Exception as e:
                print(f"[ERROR] Failed to download {filename}: {e}")

ensure_model_files()

base_options = mp_python.BaseOptions(model_asset_path='hand_landmarker.task')
options = vision.HandLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.IMAGE,
    num_hands=1,
    min_hand_detection_confidence=DETECTION_CONF,
    min_hand_presence_confidence=TRACKING_CONF,
    min_tracking_confidence=TRACKING_CONF)
hands_detector = vision.HandLandmarker.create_from_options(options)

face_base_options = mp_python.BaseOptions(model_asset_path='face_landmarker.task')
face_options = vision.FaceLandmarkerOptions(
    base_options=face_base_options,
    running_mode=vision.RunningMode.IMAGE,
    num_faces=1,
    min_face_detection_confidence=DETECTION_CONF,
    min_face_presence_confidence=TRACKING_CONF,
    min_tracking_confidence=TRACKING_CONF
)
face_detector = vision.FaceLandmarker.create_from_options(face_options)

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),      # Thumb
    (0, 5), (5, 6), (6, 7), (7, 8),      # Index finger
    (5, 9), (9, 10), (10, 11), (11, 12), # Middle finger
    (9, 13), (13, 14), (14, 15), (15, 16), # Ring finger
    (13, 17), (17, 18), (18, 19), (19, 20), # Pinky
    (0, 17), (5, 9), (9, 13), (13, 17)   # Palm connections
]


# ──────────────────────────────────────────────────────────────────────────────
# WINDOWS VOLUME CONTROL (pycaw — Windows only)
# ──────────────────────────────────────────────────────────────────────────────
volume_ctrl = None
try:
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume

    _speakers = AudioUtilities.GetSpeakers()

    # pycaw ≥20251023: GetSpeakers() returns an AudioDevice wrapper;
    # .EndpointVolume is already the cast IAudioEndpointVolume pointer.
    if hasattr(_speakers, 'EndpointVolume'):
        volume_ctrl = _speakers.EndpointVolume
    else:
        # Legacy pycaw path
        from comtypes import CLSCTX_ALL
        _interface  = _speakers.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        volume_ctrl = cast(_interface, POINTER(IAudioEndpointVolume))

    print(f"[Volume] Windows Core Audio initialised ✓  (current: {int(volume_ctrl.GetMasterVolumeLevelScalar()*100)}%)")
except Exception as exc:
    print(f"[Volume] Skipping volume control: {exc}")


def set_volume(level: float) -> None:
    """Set master volume, level in [0.0, 1.0]."""
    if volume_ctrl:
        volume_ctrl.SetMasterVolumeLevelScalar(float(np.clip(level, 0.0, 1.0)), None)


def get_volume() -> float:
    if volume_ctrl:
        return float(volume_ctrl.GetMasterVolumeLevelScalar())
    return 0.5


# ──────────────────────────────────────────────────────────────────────────────
# UTILITIES
# ──────────────────────────────────────────────────────────────────────────────

def dist(p1, p2) -> float:
    """Euclidean distance between two (x, y) tuples."""
    return math.hypot(p2[0] - p1[0], p2[1] - p1[1])


def lm_xy(lm_list, idx):
    """Return normalised (x, y) for a MediaPipe landmark index."""
    lm = lm_list[idx]
    return lm.x, lm.y


def finger_extended(lm_list, tip: int, pip: int) -> bool:
    """
    True if the finger is genuinely extended (unfurled), independent of hand tilt.
    Checks if the distance from the Tip to the Wrist (lm 0) is greater than
    the distance from the PIP to the Wrist.
    """
    wrist = lm_list[0]
    dist_tip = math.hypot(lm_list[tip].x - wrist.x, lm_list[tip].y - wrist.y)
    dist_pip = math.hypot(lm_list[pip].x - wrist.x, lm_list[pip].y - wrist.y)
    return dist_tip > dist_pip


def px_dist(p1, p2, w, h):
    return math.hypot((p2.x - p1.x) * w, (p2.y - p1.y) * h)

def compute_ear(lm, w, h, idx):
    v1 = px_dist(lm[idx["p2"]], lm[idx["p6"]], w, h)
    v2 = px_dist(lm[idx["p3"]], lm[idx["p5"]], w, h)
    hz = px_dist(lm[idx["p1"]], lm[idx["p4"]], w, h)
    return (v1 + v2) / (2.0 * hz) if hz > 1e-6 else 0.0

def get_norm_y(lm, inner, outer, iris, w, h):
    eye_w = px_dist(lm[inner], lm[outer], w, h)
    if eye_w < 1e-6:
        return 0.0
    center_y = ((lm[inner].y + lm[outer].y) / 2.0) * h
    return (lm[iris].y * h - center_y) / eye_w




def map_to_screen(nx: float, ny: float):
    """
    Map normalised camera coords → screen pixels.
    A FRAME_MARGIN is removed from each edge so that full-screen
    corners are reachable without pushing your hand to the camera border.
    """
    nx = np.clip((nx - FRAME_MARGIN) / (1.0 - 2 * FRAME_MARGIN), 0.0, 1.0)
    ny = np.clip((ny - FRAME_MARGIN) / (1.0 - 2 * FRAME_MARGIN), 0.0, 1.0)
    # Webcam is already flipped (mirrored) at capture time, so x maps directly
    return int(nx * SCREEN_W), int(ny * SCREEN_H)


# ──────────────────────────────────────────────────────────────────────────────
# HUD DRAWING
# ──────────────────────────────────────────────────────────────────────────────
C = {
    "bg"     : (15,  15,  25),
    "green"  : (0,  210,  90),
    "blue"   : (60, 140, 255),
    "orange" : (0,  165, 255),
    "red"    : (60,  60, 255),
    "white"  : (235, 235, 245),
    "gray"   : (110, 110, 130),
    "teal"   : (0,  195, 175),
    "yellow" : (0,  220, 220),
}

MODE_COLORS = {
    "IDLE"   : C["gray"],
    "MOUSE"  : C["blue"],
    "SCROLL" : C["green"],
    "VOLUME" : C["orange"],
}


def _bar(frame, label, x0, y0, w, h_bar, pct, color):
    cv2.putText(frame, label, (x0, y0 + h_bar - 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38, C["white"], 1)
    bx = x0 + 55
    cv2.rectangle(frame, (bx, y0), (bx + w, y0 + h_bar), (45, 45, 65), -1)
    fill = int(w * pct)
    if fill > 0:
        cv2.rectangle(frame, (bx, y0), (bx + fill, y0 + h_bar), color, -1)
    cv2.putText(frame, f"{int(pct * 100)}%", (bx + w + 6, y0 + h_bar - 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38, C["white"], 1)


def draw_hud(frame, mode: str, vol: float, dwell: float, hint: str):
    fh, fw = frame.shape[:2]
    panel_w, panel_h = 340, 170

    overlay = frame.copy()
    cv2.rectangle(overlay, (8, 8), (8 + panel_w, 8 + panel_h), (8, 10, 22), -1)
    cv2.addWeighted(overlay, 0.65, frame, 0.35, 0, frame)
    cv2.rectangle(frame, (8, 8), (8 + panel_w, 8 + panel_h), C["blue"], 1)

    # Title
    cv2.putText(frame, "GESTURE CONTROLLER",
                (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.56, C["teal"], 2)

    # Mode badge
    mc = MODE_COLORS.get(mode, C["white"])
    badge_text = f" {mode} "
    (tw, th), _ = cv2.getTextSize(badge_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
    cv2.rectangle(frame, (20, 45), (20 + tw + 4, 45 + th + 6), mc, -1)
    cv2.putText(frame, badge_text, (22, 45 + th + 2),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, C["bg"], 2)

    # Hint text
    cv2.putText(frame, hint, (20, 92),
                cv2.FONT_HERSHEY_SIMPLEX, 0.40, C["gray"], 1)

    # Volume bar
    _bar(frame, "VOL", 20, 103, 220, 16, vol, C["orange"])

    # Dwell bar
    dwell_color = C["red"] if dwell > 0.85 else C["green"]
    _bar(frame, "DWELL", 20, 128, 220, 16, dwell, dwell_color)

    # Screen resolution footnote
    cv2.putText(frame, f"Screen: {SCREEN_W}x{SCREEN_H}  |  Q = quit",
                (14, fh - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.36, C["gray"], 1)


def draw_laser(frame, nx: float, ny: float):
    """Blue laser-dot at index fingertip."""
    fx = int(nx * frame.shape[1])
    fy = int(ny * frame.shape[0])
    cv2.circle(frame, (fx, fy), 14, C["blue"], -1)
    cv2.circle(frame, (fx, fy), 18, C["blue"],  2)
    cv2.circle(frame, (fx, fy),  4, C["white"], -1)


def draw_dwell_arc(frame, screen_x: int, screen_y: int, pct: float):
    """Draw a progress arc at the current finger position on the preview frame."""
    # With the relative model we no longer have an inverse margin mapping.
    # The arc is drawn at the raw finger coords instead (passed in from the caller).
    fh, fw = frame.shape[:2]
    # screen_x/screen_y are cursor pixels; we will draw at the laser dot position
    # which is stored in raw_nx/raw_ny by the caller.  Accept those as fractions.
    # We re-use the values already in the frame directly using the passed position.
    cx = int(np.clip(screen_x / SCREEN_W, 0.0, 1.0) * fw)
    cy = int(np.clip(screen_y / SCREEN_H, 0.0, 1.0) * fh)
    arc_color = C["red"] if pct > 0.85 else C["green"]
    cv2.ellipse(frame, (cx, cy), (22, 22), -90, 0, int(360 * pct), arc_color, 3)
    cv2.circle(frame, (cx, cy), 5, C["white"], -1)


def draw_pinch_line(frame, p1, p2, vol: float):
    """Orange line between thumb and index + VOL% label."""
    fh, fw = frame.shape[:2]
    x1, y1 = int(p1[0] * fw), int(p1[1] * fh)
    x2, y2 = int(p2[0] * fw), int(p2[1] * fh)
    cv2.line(frame, (x1, y1), (x2, y2), C["orange"], 3)
    cv2.circle(frame, (x1, y1), 9, C["orange"], -1)
    cv2.circle(frame, (x2, y2), 9, C["orange"], -1)
    mid = ((x1 + x2) // 2 - 30, (y1 + y2) // 2 - 14)
    cv2.putText(frame, f"VOL {int(vol * 100)}%",
                mid, cv2.FONT_HERSHEY_SIMPLEX, 0.7, C["yellow"], 2)


def draw_gaze_diagnostics(frame, gaze_y: float):
    """Draws eye-gaze data onto the screen."""
    fh = frame.shape[0]
    
    # Color based on being outside the asymmetric dead zone
    yc = (80, 255, 80) if (gaze_y < Y_UP_THRESH or gaze_y > Y_DOWN_THRESH) else (180, 180, 180)
    
    cv2.putText(frame, f"Gaze Y: {gaze_y:+.3f}  deadzone={Y_UP_THRESH:+.2f} to {Y_DOWN_THRESH:+.2f}",
                (14, fh - 35), cv2.FONT_HERSHEY_SIMPLEX, 0.48, yc, 1, cv2.LINE_AA)


# ──────────────────────────────────────────────────────────────────────────────
# MAIN LOOP
# ──────────────────────────────────────────────────────────────────────────────
def main():
    pyautogui.FAILSAFE = False
    pyautogui.PAUSE    = 0

    # Smoothed cursor position (starts at screen centre)
    cur_x = float(SCREEN_W // 2)
    cur_y = float(SCREEN_H // 2)

    # Dwell state
    dwell_anchor     = (int(cur_x), int(cur_y))
    dwell_timer_start = time.time()
    dwell_fired      = False
    
    # Mouse joystick state (fixed-base displacement model)
    mouse_base_x = None    # Tip x when index finger was first detected (fixed reference)
    mouse_base_y = None    # Tip y when index finger was first detected
    hand_lost_time = None  # Debounce timer for when tracking flickers
    # Scroll state — joystick model
    scroll_neutral_y  = None    # Y when scroll mode was first entered (the "neutral" point)
    scroll_accumulator = 0.0    # Fractional scroll accumulator (fire when ≥1)
    last_frame_time   = time.time()

    # Volume state — sticky model
    vol_active  = False         # True once a pinch has been detected
    vol_smooth  = get_volume()  # Smoothed volume target (avoids audio crackling)

    # Volume (read current level)
    vol = get_volume()

    # ── Open camera — auto-scan indices 0‥4 ──────────────────────────────────
    def _open_camera():
        """Find the first camera that can actually deliver frames."""
        for idx in range(5):
            cap = cv2.VideoCapture(idx)
            if not cap.isOpened():
                cap.release()
                continue
            # Read a test frame at native resolution to verify it works
            ret, test_frame = cap.read()
            if ret and test_frame is not None:
                print(f"[Camera] Found working camera at index {idx}")
                return cap, idx
            cap.release()
        return None, -1

    cap, found_idx = _open_camera()
    if cap is None:
        print("[ERROR] No working camera found (tried indices 0–4). "
              "Make sure your webcam is connected and not used by another app.")
        sys.exit(1)

    # Get native resolution (confirmed working from the test read above)
    native_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    native_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Try to upgrade to the desired resolution — verify with an ACTUAL test read
    if (native_w, native_h) != (CAM_W, CAM_H):
        cap.set(cv2.CAP_PROP_FRAME_WIDTH,  CAM_W)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAM_H)
        cap.set(cv2.CAP_PROP_FPS, 30)
        try:
            ret, test = cap.read()
            if ret and test is not None and test.shape[1] == CAM_W:
                actual_w, actual_h = CAM_W, CAM_H
            else:
                raise RuntimeError("test read failed after resolution change")
        except Exception:
            # Resolution change broke the camera — reopen at native resolution
            cap.release()
            cap = cv2.VideoCapture(found_idx)
            cap.set(cv2.CAP_PROP_FPS, 30)
            actual_w, actual_h = native_w, native_h
            print(f"[Camera] {CAM_W}×{CAM_H} not supported — "
                  f"using native {actual_w}×{actual_h}")
    else:
        actual_w, actual_h = native_w, native_h

    print(f"[Camera] Running at {actual_w}×{actual_h}")

    cv2.namedWindow("Gesture Controller", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Gesture Controller", 960, 540)

    print(f"[INFO] Screen auto-detected: {SCREEN_W} × {SCREEN_H}")
    print("[INFO] Controller running — press Q in the window to quit.\n")

    mode        = "IDLE"
    hint        = "No hand detected"
    dwell_pct   = 0.0
    
    gaze_y_smooth     = 0.0
    eye_scroll_accum  = 0.0
    blink_block_until = 0.0

    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            # Silent retry — no spam
            time.sleep(0.01)
            continue


        # Mirror so it feels like a mirror/natural
        frame = cv2.flip(frame, 1)
        rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        results = hands_detector.detect(mp_image)
        face_results = face_detector.detect(mp_image)
        now = time.time()

        # Reset per-frame visuals
        mode       = "IDLE"
        hint       = "No hand detected"
        dwell_pct  = 0.0

        if results.hand_landmarks:
            hand_lost_time = None
            lm = results.hand_landmarks[0]

            # Draw hand skeleton manually
            fh, fw = frame.shape[:2]
            points = []
            for mark in lm:
                px, py = int(mark.x * fw), int(mark.y * fh)
                points.append((px, py))
                cv2.circle(frame, (px, py), 4, C["white"], -1)
            
            for (i, j) in HAND_CONNECTIONS:
                cv2.line(frame, points[i], points[j], C["teal"], 2)

            # ── Extract key landmarks ──────────────────────────────────────
            thumb   = lm_xy(lm, 4)   # thumb tip
            idx     = lm_xy(lm, 8)   # index tip
            mid     = lm_xy(lm, 12)  # middle tip
            ring    = lm_xy(lm, 16)  # ring tip
            pinky   = lm_xy(lm, 20)  # pinky tip

            idx_up   = finger_extended(lm, 8,  6)
            mid_up   = finger_extended(lm, 12, 10)
            ring_up  = finger_extended(lm, 16, 14)
            pinky_up = finger_extended(lm, 20, 18)

            pinch_dist = dist(thumb, idx)

            # ════════════════════════════════════════════════════════════════
            # PRIORITY 1 — VOLUME  (sticky pinch model)
            # Enter: thumb+index touch (pinch). Stay: fingers can spread freely.
            # Exit:  middle + ring + pinky ALL up = deliberate open-hand cancel.
            # ════════════════════════════════════════════════════════════════
            open_hand_cancel = mid_up and ring_up and pinky_up

            if pinch_dist < VOL_PINCH_ENTER:
                vol_active = True           # (re-)enter volume mode on any pinch
            if open_hand_cancel:
                vol_active = False          # open hand deliberately cancels

            if vol_active:
                mode = "VOLUME"
                hint = "Pinch then stretch ↔ to set volume"
                scroll_neutral_y  = None    # clear scroll memory
                scroll_accumulator = 0.0

                # Map the ABSOLUTE distance (not limited by entry threshold) to 0–100 %
                t = (pinch_dist - VOL_MIN_DIST) / (VOL_MAX_DIST - VOL_MIN_DIST)
                vol_target = float(np.clip(t, 0.0, 1.0))

                # Smooth the target to avoid crackling when fingers wobble
                vol_smooth = vol_smooth + VOL_SMOOTH * (vol_target - vol_smooth)
                vol = round(vol_smooth, 3)
                set_volume(vol)

                draw_pinch_line(frame, thumb, idx, vol)

            # ════════════════════════════════════════════════════════════════
            # PRIORITY 2 — MOUSE  (fixed-base displacement joystick + dwell click)
            # ════════════════════════════════════════════════════════════════
            else:
                mode   = "MOUSE"
                hint   = "Point finger at screen to set base · move tip to steer cursor"

                raw_nx, raw_ny = idx[0], idx[1]   # normalised index tip position

                # ── Capture fixed base on first detected frame ───────────────────
                if mouse_base_x is None:
                    mouse_base_x = raw_nx
                    mouse_base_y = raw_ny

                # Displacement of tip from fixed base = joystick input
                dx  = raw_nx - mouse_base_x
                dy  = raw_ny - mouse_base_y
                mag = math.hypot(dx, dy)

                # ── Dead-zone + speed curve ────────────────────────────────────
                if mag > MOUSE_DEAD_ZONE:
                    normed = min(1.0, mag / MOUSE_MAX_DISP)
                    speed  = (normed ** MOUSE_ACCEL) * MOUSE_MAX_SPEED_PX
                    cur_x  = max(0.0, min(float(SCREEN_W), cur_x + (dx / mag) * speed))
                    cur_y  = max(0.0, min(float(SCREEN_H), cur_y + (dy / mag) * speed))
                    pyautogui.moveTo(int(cur_x), int(cur_y))

                # ── Visuals ──────────────────────────────────────────────
                # Draw the virtual joystick: center anchor and a line to the finger
                if mouse_base_x is not None:
                    fh, fw = frame.shape[:2]
                    bx = int(mouse_base_x * fw)
                    by = int(mouse_base_y * fh)
                    fx = int(raw_nx * fw)
                    fy = int(raw_ny * fh)
                    cv2.circle(frame, (bx, by), 6, C["teal"], -1)
                    cv2.circle(frame, (bx, by), int(MOUSE_DEAD_ZONE * fw), C["teal"], 1)
                    cv2.line(frame, (bx, by), (fx, fy), C["teal"], 2)

                # ── Dwell Click ──────────────────────────────────────────
                moved = dist((int(cur_x), int(cur_y)), dwell_anchor) > DWELL_RADIUS_PX
                if moved:
                    dwell_anchor      = (int(cur_x), int(cur_y))
                    dwell_timer_start = time.time()
                    dwell_fired       = False

                elapsed   = time.time() - dwell_timer_start
                dwell_pct = min(elapsed / DWELL_TIME_SEC, 1.0)

                if elapsed >= DWELL_TIME_SEC and not dwell_fired:
                    pyautogui.click()
                    dwell_fired       = True
                    dwell_timer_start = time.time() - DWELL_TIME_SEC

                draw_laser(frame, raw_nx, raw_ny)
                if dwell_pct > 0.05:
                    draw_dwell_arc(frame, int(cur_x), int(cur_y), dwell_pct)

        else:
            if hand_lost_time is None:
                hand_lost_time = time.time()
                
            elapsed_loss = time.time() - hand_lost_time
            
            # Draw a warning if we are preserving the base during a tracking drop
            if mouse_base_x is not None and elapsed_loss < 1.5:
                cv2.putText(frame, f"Tracking lost! Preserving base... {1.5 - elapsed_loss:.1f}s", (50, 150),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, C["orange"], 2)

            # Only reset the base if the hand has been lost for more than 1.5 seconds.
            if elapsed_loss > 1.5:
                vol_active        = False
                mouse_base_x      = None   
                mouse_base_y      = None
                dwell_anchor      = (int(cur_x), int(cur_y))
                dwell_timer_start = time.time()
                dwell_fired       = False

        # ── Eye-Gaze Scroll Processing ────────────────────────────────────
        if face_results.face_landmarks:
            lm = face_results.face_landmarks[0]
            fh, fw = frame.shape[:2]

            # Draw iris dots
            for idx in range(468, 478):
                cv2.circle(frame, (int(lm[idx].x * fw), int(lm[idx].y * fh)),
                           2, C["white"], -1, cv2.LINE_AA)

            r_y = get_norm_y(lm, R_INNER, R_OUTER, R_IRIS, fw, fh)
            l_y = get_norm_y(lm, L_INNER, L_OUTER, L_IRIS, fw, fh)
            
            r_ear = compute_ear(lm, fw, fh, R_EAR)
            l_ear = compute_ear(lm, fw, fh, L_EAR)
            avg_ear = (r_ear + l_ear) / 2.0
            
            raw_gaze_y = (r_y + l_y) / 2.0
            gaze_y_smooth = gaze_y_smooth + EYE_SMOOTH * (raw_gaze_y - gaze_y_smooth)

            now = time.time()
            dt  = max(now - last_frame_time, 0.001) if 'last_frame_time' in locals() else 0.033
            last_frame_time = now

            if avg_ear < EAR_BLINK_THRESH:
                blink_block_until = now + POST_BLINK_BLOCK_SEC

            if now < blink_block_until:
                # Blinking or recovering from a blink — stop scrolling
                eye_scroll_accum = 0.0
                gaze_y_smooth = 0.0
            elif gaze_y_smooth < Y_UP_THRESH:
                # Looking UP (scroll downward)
                displacement = Y_UP_THRESH - gaze_y_smooth
                eff = displacement / EYE_SCROLL_MAX_DISP
                eff = min(eff, 1.0)
                speed = (eff ** EYE_SCROLL_CURVE) * EYE_SCROLL_MAX_SPEED
                eye_scroll_accum -= speed * dt  # negative scroll pushes page downward
                
            elif gaze_y_smooth > Y_DOWN_THRESH:
                # Looking DOWN (scroll upward)
                displacement = gaze_y_smooth - Y_DOWN_THRESH
                eff = displacement / EYE_SCROLL_MAX_DISP
                eff = min(eff, 1.0)
                speed = (eff ** EYE_SCROLL_CURVE) * EYE_SCROLL_MAX_SPEED
                eye_scroll_accum += speed * dt  # positive scroll pulls page upward
                
            else:
                eye_scroll_accum = 0.0

            clicks = int(eye_scroll_accum)
            if clicks != 0:
                pyautogui.scroll(clicks * 120)
                eye_scroll_accum -= clicks

        # ── HUD overlay ───────────────────────────────────────────────────
        draw_hud(frame, mode, vol, dwell_pct, hint)
        draw_gaze_diagnostics(frame, gaze_y_smooth)

        cv2.imshow("Gesture Controller", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # ── Cleanup ───────────────────────────────────────────────────────────
    cap.release()
    cv2.destroyAllWindows()
    hands_detector.close()
    face_detector.close()
    print("\n[INFO] Gesture controller stopped cleanly. Bye!")


if __name__ == "__main__":
    main()
