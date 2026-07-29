"""
palm_trackpad.py
================
Palm Trackpad Human-Computer Interface
---------------------------------------
Uses the LEFT hand as a floating, rotation-invariant virtual trackpad via a
mathematical Change of Basis into the hand's local coordinate system.
The RIGHT index finger acts as the pointer; pinch (index+thumb) to click.

Compatible with:  mediapipe >= 0.10.30  (Tasks API - mp.solutions removed)
Model required:   hand_landmarker.task  (auto-downloaded if missing)

Dependencies:
    pip install opencv-python "mediapipe==0.10.33" pyautogui numpy
"""

import os
import time
import urllib.request

import numpy as np
import cv2
import mediapipe as mp
from mediapipe.tasks.python import vision as mp_vision
from mediapipe.tasks.python.vision import HandLandmarker, HandLandmarkerOptions
from mediapipe.tasks.python.vision import RunningMode
import pyautogui

# -
# GLOBAL CONFIGURATION
# -

CAMERA_INDEX     = 0        # Webcam device index
CAPTURE_WIDTH    = 1280     # Requested capture width  (px)
CAPTURE_HEIGHT   = 720      # Requested capture height (px)
CAPTURE_FPS      = 30       # Requested FPS

MODEL_PATH       = os.path.join(os.path.dirname(__file__), "hand_landmarker.task")
MODEL_URL        = ("https://storage.googleapis.com/mediapipe-models/"
                    "hand_landmarker/hand_landmarker/float16/latest/"
                    "hand_landmarker.task")

# Smoothing - two-stage EMA
EMA_ALPHA_LOCAL  = 0.18     # EMA on normalised local (X_final, Y_final) - primary smoothing
EMA_ALPHA_SCREEN = 0.35     # EMA on screen pixels - final polish

DEAD_ZONE_PX    = 4         # Cursor movement smaller than this (px) is suppressed

TRACKPAD_RANGE  = 1.0       # Normalised range mapped to screen (1.0 = 1 palm-width = edge)

CLICK_THRESHOLD  = 0.04     # Normalised pinch distance that triggers a click
CLICK_DEBOUNCE_S = 0.5      # Minimum seconds between successive clicks

# Touch-to-move: right index tip must be within this 2D normalised distance
# of the LEFT palm centroid to activate cursor movement.
# These are in 2D normalised image coords [0,1].
# When physically touching: ~0.03-0.07.  When lifted: 0.10+.
TOUCH_ENTER_DIST = 0.25     # 2D norm-distance to palm: enter touch state
                            # Generous - covers whole palm area and slight hover
TOUCH_EXIT_DIST  = 0.35     # 2D norm-distance to palm: exit  touch state
TOUCH_EMA_ALPHA  = 0.50     # EMA alpha for touch-distance smoothing
                            # 0.5 = fast response, 1.0 = raw (no smoothing)

pyautogui.FAILSAFE = False
pyautogui.PAUSE    = 0

# -
# MODEL BOOTSTRAP
# -

def ensure_model() -> None:
    """Download hand_landmarker.task if not already present."""
    if not os.path.exists(MODEL_PATH):
        print(f"[Palm Trackpad] Downloading hand landmark model-")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print(f"[Palm Trackpad] Model saved to {MODEL_PATH}")

# -
# HELPER UTILITIES
# -

def lm_to_vec(lm, frame_w: int, frame_h: int) -> np.ndarray:
    """Convert a MediaPipe NormalizedLandmark to pixel-space 2-D numpy vector."""
    return np.array([lm.x * frame_w, lm.y * frame_h], dtype=np.float64)


def normalize(v: np.ndarray) -> np.ndarray:
    """Return unit vector; returns zero-vector when magnitude - 0."""
    mag = np.linalg.norm(v)
    return v / mag if mag > 1e-6 else np.zeros_like(v)


def ema(prev, current: np.ndarray, alpha: float) -> np.ndarray:
    """
    Exponential Moving Average:  S_t = alpha*X_t + (1-alpha)*S_{t-1}
    First call (prev=None) returns current unchanged.
    """
    return current.copy() if prev is None else alpha * current + (1.0 - alpha) * prev


def palm_centroid_2d(left_lm):
    """
    Compute the 2D centroid of the left palm in normalised image coords.
    Returns (cx, cy) in [0,1] x [0,1] normalised space.
    """
    PALM_INDICES = [0, 5, 9, 13, 17]
    cx = sum(left_lm[i].x for i in PALM_INDICES) / len(PALM_INDICES)
    cy = sum(left_lm[i].y for i in PALM_INDICES) / len(PALM_INDICES)
    return cx, cy


def is_touching_palm(right_lm, left_lm):
    """
    Detect whether the RIGHT index fingertip (LM8) is near the LEFT palm.

    Uses 2D-only (x,y) normalised image coordinates.
    Z is excluded because per-hand Z normalization makes cross-hand Z
    comparison meaningless.

    Uses MINIMUM distance to any of the 5 palm-surface landmarks
    (not centroid) so touches anywhere on the palm surface register,
    including edges near LM5, LM17, and near the wrist (LM0).

    Returns:
      min_dist    (float) : 2D normalised distance from R8 to nearest palm lm
      centroid    (tuple) : (cx, cy) normalised for HUD drawing
    """
    r8 = right_lm[8]   # Right index fingertip
    PALM_INDICES = [0, 5, 9, 13, 17]

    min_dist = float('inf')
    for idx in PALM_INDICES:
        lp = left_lm[idx]
        dx = r8.x - lp.x
        dy = r8.y - lp.y
        d  = (dx * dx + dy * dy) ** 0.5   # 2D Euclidean, no Z
        if d < min_dist:
            min_dist = d

    cx, cy = palm_centroid_2d(left_lm)
    return min_dist, (cx, cy)

# -
# CHANGE-OF-BASIS MATH PIPELINE
# -

def build_local_axes(lm_list, frame_w: int, frame_h: int):
    """
    Construct the LEFT hand's local 2-D coordinate system from palm landmarks.

    MediaPipe Hand landmark indices:
        0  = Wrist
        5  = Index MCP   (knuckle)
        9  = Middle MCP  (knuckle) - chosen as origin O
        17 = Pinky MCP   (knuckle)

    Returns
    -------
    origin  : np.ndarray[2]   pixel position of LM9  (middle knuckle)
    v_x     : np.ndarray[2]   unit X-axis  (LM17->LM5, across palm width)
    v_y     : np.ndarray[2]   unit Y-axis  (LM0->LM9,  up the palm)
    palm_w  : float           |LM5 - LM17| in pixels  (scale normalisation)
    palm_h  : float           |LM9 - LM0|  in pixels  (scale normalisation)
    wrist   : np.ndarray[2]   pixel position of LM0   (needed for HUD box)
    """
    L0  = lm_to_vec(lm_list[0],  frame_w, frame_h)   # Wrist
    L5  = lm_to_vec(lm_list[5],  frame_w, frame_h)   # Index MCP
    L9  = lm_to_vec(lm_list[9],  frame_w, frame_h)   # Middle MCP  <- origin
    L17 = lm_to_vec(lm_list[17], frame_w, frame_h)   # Pinky MCP

    origin = L9

    # Y-axis: wrist->middle-MCP  (V_y = (L9 - L0) / ||L9 - L0||)
    raw_vy = L9 - L0
    palm_h = float(np.linalg.norm(raw_vy))
    v_y    = normalize(raw_vy)

    # X-axis: pinky-MCP->index-MCP  (V_x = (L5 - L17) / ||L5 - L17||)
    raw_vx = L5 - L17
    palm_w = float(np.linalg.norm(raw_vx))
    v_x    = normalize(raw_vx)

    return origin, v_x, v_y, palm_w, palm_h, L0


def project_finger(r8: np.ndarray, origin: np.ndarray,
                   v_x: np.ndarray, v_y: np.ndarray,
                   palm_w: float, palm_h: float):
    """
    Project the right index-tip (R8) into the left palm's local frame
    and return depth-invariant normalised coordinates (X_final, Y_final).

    Step 1 - displacement from palm origin to fingertip (pixel space):
                  P = R8 - O

    Step 2 - Change of Basis via dot-product projections:
                  X_local = P - V_x    (pixels along palm-width axis)
                  Y_local = P - V_y    (pixels along palm-height axis)

              The dot product extracts the signed scalar component of P
              along each orthogonal basis vector, completing the basis change.

    Step 3 - Depth / scale invariance by dividing by physical palm size:
                  X_final = X_local / palm_w
                  Y_final = Y_local / palm_h

              A value of -1.0 means the fingertip is exactly one
              palm-dimension away from the origin along that axis.
    """
    P       = r8 - origin                        # displacement vector (pixels)
    X_local = float(np.dot(P, v_x))             # scalar projection onto X-axis
    Y_local = float(np.dot(P, v_y))             # scalar projection onto Y-axis
    X_final = X_local / palm_w if palm_w > 1e-6 else 0.0
    Y_final = Y_local / palm_h if palm_h > 1e-6 else 0.0
    return X_final, Y_final

# -
# COORDINATE MAPPING  (normalised local space - OS screen pixels)
# -

def local_to_screen(x_final: float, y_final: float,
                    screen_w: int, screen_h: int,
                    coord_range: float = TRACKPAD_RANGE) -> np.ndarray:
    """
    Linear remap (X_final, Y_final) - [-range, +range] - screen pixels.
    Y is inverted because palm Y grows toward fingertips (up in camera view)
    while screen Y grows downward.
    """
    x_c = max(-coord_range, min(coord_range, x_final))
    y_c = max(-coord_range, min(coord_range, y_final))

    norm_x   = (x_c + coord_range) / (2.0 * coord_range)
    norm_y   = (y_c + coord_range) / (2.0 * coord_range)
    screen_x = norm_x * screen_w
    screen_y = (1.0 - norm_y) * screen_h         # invert Y axis
    return np.array([screen_x, screen_y], dtype=np.float64)

# -
# HUD RENDERING
# -

COL_AXIS_X   = (0,  200, 255)    # orange  - X-axis arrow
COL_AXIS_Y   = (0,  255, 100)    # green   - Y-axis arrow
COL_ORIGIN   = (255, 100,  0)    # blue    - palm origin dot
COL_FINGER   = (0,   50, 255)    # red     - right index tip (idle)
COL_CLICK    = (0,  255, 255)    # yellow  - right index tip (clicking)
COL_TEXT     = (240, 240, 240)   # near-white
COL_BOX_LINE = (80,  80,  80)    # dark grey bounding parallelogram


def draw_hand_connections(frame: np.ndarray, lm_list, frame_w: int, frame_h: int,
                          colour=(100, 100, 100), role_label: str = "") -> None:
    """Draw simple skeleton lines and an optional role label (TRACKPAD / POINTER)."""
    CONNECTIONS = [
        (0,1),(1,2),(2,3),(3,4),
        (0,5),(5,6),(6,7),(7,8),
        (0,9),(9,10),(10,11),(11,12),
        (0,13),(13,14),(14,15),(15,16),
        (0,17),(17,18),(18,19),(19,20),
        (5,9),(9,13),(13,17),(5,17),
    ]
    pts = [lm_to_vec(lm, frame_w, frame_h).astype(int) for lm in lm_list]
    for a, b in CONNECTIONS:
        cv2.line(frame, tuple(pts[a]), tuple(pts[b]), colour, 1, cv2.LINE_AA)
    for pt in pts:
        cv2.circle(frame, tuple(pt), 3, (200, 200, 200), -1, cv2.LINE_AA)
    # Role label near wrist (LM0)
    if role_label:
        wrist_pt = pts[0]
        cv2.putText(frame, role_label,
                    (wrist_pt[0] - 10, wrist_pt[1] + 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, colour, 1, cv2.LINE_AA)


def clamp_pt(pt, frame_w: int, frame_h: int):
    """Clamp a (x, y) tuple to frame boundaries so OpenCV never silently drops a draw."""
    return (int(max(0, min(frame_w - 1, pt[0]))),
            int(max(0, min(frame_h - 1, pt[1]))))


def draw_palm_axes(frame: np.ndarray, origin: np.ndarray,
                   v_x: np.ndarray, v_y: np.ndarray,
                   palm_w: float, palm_h: float,
                   wrist: np.ndarray) -> None:
    """
    Draw local X/Y axes and the palm bounding parallelogram.

    Robustness guards:
      - If palm_w or palm_h < MIN_PALM_PX (degenerate geometry from extreme angle
        or landmark collapse) we skip drawing rather than produce garbage lines.
      - All pixel coordinates are clamped to frame bounds so OpenCV never
        silently discards a draw call due to out-of-frame coords.

    Box corners (palm local space, anchored at wrist):
        bottom-left  = wrist - half_width   (wrist, pinky side)
        bottom-right = wrist + half_width   (wrist, index side)
        top-right    = knuckle + half_width (LM9,   index side)
        top-left     = knuckle - half_width (LM9,   pinky side)
    """
    MIN_PALM_PX = 20   # below this the geometry is degenerate; skip drawing
    if palm_w < MIN_PALM_PX or palm_h < MIN_PALM_PX:
        return

    fh, fw = frame.shape[:2]
    o    = clamp_pt(tuple(origin.astype(int)), fw, fh)
    w_pt = clamp_pt(tuple(wrist.astype(int)),  fw, fh)

    # X-axis arrow: knuckle origin -> across palm width
    tip_x = clamp_pt(tuple((origin + v_x * palm_w).astype(int)), fw, fh)
    cv2.arrowedLine(frame, o, tip_x, COL_AXIS_X, 2, tipLength=0.15)
    cv2.putText(frame, "X", (min(tip_x[0]+5, fw-15), tip_x[1]),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, COL_AXIS_X, 1, cv2.LINE_AA)

    # Y-axis arrow: wrist -> knuckle (up the palm)
    cv2.arrowedLine(frame, w_pt, o, COL_AXIS_Y, 2, tipLength=0.12)
    cv2.putText(frame, "Y", (min(o[0]+5, fw-15), max(o[1]-5, 10)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, COL_AXIS_Y, 1, cv2.LINE_AA)

    # Origin dot at middle knuckle
    cv2.circle(frame, o, 6, COL_ORIGIN, -1, cv2.LINE_AA)

    # Parallelogram: anchored at wrist, top edge at knuckle row
    hw = v_x * palm_w * 0.5
    raw_corners = [
        wrist  - hw,    # bottom-left   (wrist, pinky side)
        wrist  + hw,    # bottom-right  (wrist, index side)
        origin + hw,    # top-right     (LM9,   index side)
        origin - hw,    # top-left      (LM9,   pinky side)
    ]
    # Clamp each corner individually so partially off-screen palms still draw
    corners = np.array(
        [clamp_pt(tuple(c.astype(int)), fw, fh) for c in raw_corners],
        dtype=np.int32
    )
    cv2.polylines(frame, [corners], isClosed=True,
                  color=(0, 200, 255), thickness=2, lineType=cv2.LINE_AA)


def draw_finger_target(frame: np.ndarray, r8_px: np.ndarray, clicking: bool) -> None:
    """Draw a crosshair-circle on the right index fingertip."""
    p   = tuple(r8_px.astype(int))
    col = COL_CLICK if clicking else COL_FINGER
    r   = 14
    cv2.circle(frame, p, r,  col,  2, cv2.LINE_AA)
    cv2.circle(frame, p, 3,  col, -1, cv2.LINE_AA)
    cv2.line(frame, (p[0]-r-8, p[1]), (p[0]-r,   p[1]), col, 1, cv2.LINE_AA)
    cv2.line(frame, (p[0]+r,   p[1]), (p[0]+r+8, p[1]), col, 1, cv2.LINE_AA)
    cv2.line(frame, (p[0], p[1]-r-8), (p[0], p[1]-r),   col, 1, cv2.LINE_AA)
    cv2.line(frame, (p[0], p[1]+r),   (p[0], p[1]+r+8), col, 1, cv2.LINE_AA)


def draw_hud(frame: np.ndarray, fps: float, x_f: float, y_f: float,
             pinch: float, clicking: bool, touching: bool,
             touch_dist: float, status: str) -> None:
    """Semi-transparent telemetry panel (top-left)."""
    h, w = frame.shape[:2]
    panel = frame.copy()
    cv2.rectangle(panel, (8, 8), (340, 178), (15, 15, 15), -1)
    cv2.addWeighted(panel, 0.55, frame, 0.45, 0, frame)

    touch_col  = (0, 255, 120) if touching else (80, 80, 80)
    touch_txt  = f"ACTIVE  (dist={touch_dist:.3f})" if touching else f"LIFT    (dist={touch_dist:.3f})"
    rows = [
        (f"FPS        : {fps:5.1f}",                                COL_TEXT),
        (f"X_final    : {x_f:+.3f}",                               COL_TEXT),
        (f"Y_final    : {y_f:+.3f}",                               COL_TEXT),
        (f"Pinch Dist : {pinch:.4f}  (thr={CLICK_THRESHOLD})",     COL_TEXT),
        (f"Touch      : {touch_txt}",                              touch_col),
        (f"Click      : {'YES -' if clicking else 'no  -'}",
         COL_CLICK if clicking else COL_TEXT),
        (f"Status     : {status}",                                  COL_TEXT),
    ]
    for i, (txt, col) in enumerate(rows):
        cv2.putText(frame, txt, (16, 34 + i * 21),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.46, col, 1, cv2.LINE_AA)

    cv2.putText(frame, "PALM TRACKPAD  [Q = quit]",
                (w // 2 - 145, h - 14),
                cv2.FONT_HERSHEY_SIMPLEX, 0.52, COL_TEXT, 1, cv2.LINE_AA)

# -
# MAIN LOOP
# -

def main() -> None:
    ensure_model()

    # - Camera -
    cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  CAPTURE_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAPTURE_HEIGHT)
    cap.set(cv2.CAP_PROP_FPS,          CAPTURE_FPS)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open webcam at index {CAMERA_INDEX}.")

    screen_w, screen_h = pyautogui.size()
    print(f"[Palm Trackpad] Screen: {screen_w}-{screen_h}  |  Model: {MODEL_PATH}")

    # - MediaPipe Tasks hand landmarker (IMAGE mode - synchronous) -
    options = HandLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=RunningMode.IMAGE,
        num_hands=2,
        # Very permissive thresholds so detection survives poor light,
        # fast movement and partial occlusion. False positives are rare
        # for hands and are caught by the landmark validity checks.
        min_hand_detection_confidence=0.3,
        min_hand_presence_confidence=0.3,
        min_tracking_confidence=0.3,
    )
    detector = HandLandmarker.create_from_options(options)

    # One-time CLAHE object for low-light preprocessing
    # Applied to the L-channel (lightness) in LAB colour space so colour
    # hue is preserved while local contrast is boosted.
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))

    # -- Tracking state --
    ema_local       = None   # EMA on (X_final, Y_final) -- primary jitter killer
    ema_screen      = None   # EMA on screen pixels       -- secondary polish
    last_click_time = 0.0
    click_active    = False
    prev_tick       = cv2.getTickCount()
    fps             = 0.0
    status          = "Waiting for both hands..."

    # Touch-to-move state with hysteresis
    touching         = False  # whether the finger is currently "on" the trackpad
    touch_dist_now   = 1.0    # last raw 2D distance (for HUD display)
    touch_dist_ema   = None   # None = uninitialised; first reading sets it directly
    pre_occlude_dist = 1.0    # distance measured just before right hand was lost
                              # Used to detect touch-via-occlusion:
                              # if hand was near palm before disappearing => touching

    # Landmark cache — keep last-known position for this many frames before giving up.
    # 20 frames @ 30 FPS = ~0.67 s of tolerance for brief occlusion / lighting drops.
    MAX_LOST_FRAMES   = 20
    left_lm_cache     = None
    right_lm_cache    = None
    left_lost_frames  = 0
    right_lost_frames = 0

    print("[Palm Trackpad] Running - press Q in the window to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            continue

        frame    = cv2.flip(frame, 1)            # mirror so it feels natural
        frame_h, frame_w = frame.shape[:2]

        # - FPS -
        tick      = cv2.getTickCount()
        fps       = cv2.getTickFrequency() / max(tick - prev_tick, 1)
        prev_tick = tick

        # -- CLAHE preprocessing for low-light robustness --
        # Boost local contrast on the L-channel of LAB before sending to
        # MediaPipe. This dramatically helps detection in dim rooms without
        # changing colours (which would confuse the skin-tone classifier).
        lab      = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b  = cv2.split(lab)
        l_eq     = clahe.apply(l)
        enhanced = cv2.cvtColor(cv2.merge([l_eq, a, b]), cv2.COLOR_LAB2BGR)

        # Send the contrast-enhanced frame to MediaPipe; keep original for display
        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=cv2.cvtColor(enhanced, cv2.COLOR_BGR2RGB),
        )
        detection_result = detector.detect(mp_image)

        # Reset per-frame vars
        x_final, y_final = 0.0, 0.0
        pinch_dist       = 1.0
        left_lm          = None
        right_lm         = None

        # -- Hand Differentiation (position-based, guaranteed correct) --
        #
        # We sort detected hands by their x-centroid in the FLIPPED frame.
        # After cv2.flip(frame, 1):
        #   User's LEFT  hand -> appears on LEFT  side (smaller x) -> TRACKPAD
        #   User's RIGHT hand -> appears on RIGHT side (larger  x) -> POINTER
        #
        # This replaces MediaPipe's handedness classifier which was unreliable
        # when hands were close together or partially occluded.
        if detection_result.hand_landmarks:
            hands_detected = []
            for lm_list in detection_result.hand_landmarks:
                cx = sum(lm.x for lm in lm_list) / len(lm_list)
                hands_detected.append((cx, lm_list))
            hands_detected.sort(key=lambda h: h[0])  # left-to-right

            for i, (cx, lm_list) in enumerate(hands_detected):
                if len(hands_detected) == 1:
                    role = "left" if cx < 0.52 else "right"
                else:
                    role = "left" if i == 0 else "right"

                if role == "left":
                    left_lm = lm_list
                    left_lm_cache    = lm_list
                    left_lost_frames = 0
                    draw_hand_connections(frame, lm_list, frame_w, frame_h,
                                          (80, 220, 80), role_label="TRACKPAD")
                else:
                    right_lm = lm_list
                    right_lm_cache    = lm_list
                    right_lost_frames = 0
                    draw_hand_connections(frame, lm_list, frame_w, frame_h,
                                          (80, 80, 220), role_label="POINTER")

        # -- Landmark cache fallback --
        # Reuse last known position for up to MAX_LOST_FRAMES frames so brief
        # occlusion or fast motion doesn't kill tracking.
        if left_lm is None and left_lm_cache is not None:
            left_lost_frames += 1
            if left_lost_frames <= MAX_LOST_FRAMES:
                left_lm = left_lm_cache   # ghost track
            else:
                left_lm_cache = None      # truly lost - clear cache

        if right_lm is None and right_lm_cache is not None:
            right_lost_frames += 1
            if right_lost_frames <= MAX_LOST_FRAMES:
                right_lm = right_lm_cache
            else:
                right_lm_cache = None

        # -- Core Math Pipeline --
        if left_lm is not None and right_lm is not None:

            # STEP 1 - Build left palm's local coordinate system
            origin, v_x, v_y, palm_w, palm_h, wrist = build_local_axes(
                left_lm, frame_w, frame_h
            )

            # STEP 2 - Pixel positions of right-hand pointer landmarks
            r8 = lm_to_vec(right_lm[8], frame_w, frame_h)   # Right Index Tip
            r4 = lm_to_vec(right_lm[4], frame_w, frame_h)   # Right Thumb Tip

            # STEP 3 - Change of Basis + scale normalisation
            x_final, y_final = project_finger(
                r8, origin, v_x, v_y, palm_w, palm_h
            )

            # STEP 4 - Touch detection
            #
            # Two complementary signals, either can activate touch:
            #
            # Signal A - PROXIMITY (fresh detection):
            #   When right_lost_frames == 0, MediaPipe freshly detected the right hand.
            #   Compute 2D distance to left palm; if below TOUCH_ENTER_DIST -> touching.
            #
            # Signal B - OCCLUSION (sustained tracking loss near palm):
            #   When the right finger presses onto the left palm, MediaPipe LOSES
            #   the right hand because it's hidden. This loss is itself a signal.
            #   If the right hand was near the palm just before disappearing
            #   (pre_occlude_dist < 0.20) AND it's been lost for 3+ frames
            #   -> treat as touching.
            #   This handles the case where MediaPipe drops the hand BEFORE
            #   the fresh-detection gate can fire.
            #
            raw_dist, centroid_norm = is_touching_palm(right_lm, left_lm)
            touch_dist_now = raw_dist

            OCCLUDE_TOUCH_FRAMES = 3    # consecutive lost frames to confirm touch
            OCCLUDE_NEAR_DIST    = 0.20 # pre-occlusion distance to qualify

            if right_lost_frames == 0:
                # --- Signal A: fresh detection ---
                pre_occlude_dist = raw_dist   # remember position before next loss

                if touch_dist_ema is None:
                    touch_dist_ema = raw_dist
                else:
                    touch_dist_ema = (TOUCH_EMA_ALPHA * raw_dist
                                      + (1.0 - TOUCH_EMA_ALPHA) * touch_dist_ema)

                if not touching and touch_dist_ema < TOUCH_ENTER_DIST:
                    touching = True
                elif touching and touch_dist_ema > TOUCH_EXIT_DIST:
                    touching = False
                    ema_local  = None
                    ema_screen = None

            else:
                # --- Signal B: sustained occlusion near palm = touching ---
                if (not touching
                        and right_lost_frames >= OCCLUDE_TOUCH_FRAMES
                        and pre_occlude_dist  <  OCCLUDE_NEAR_DIST):
                    touching = True
                # (if already touching, maintain state)

            # Draw touch-zone circle on left palm centroid
            cx_px = int(max(0, min(frame_w-1, centroid_norm[0] * frame_w)))
            cy_px = int(max(0, min(frame_h-1, centroid_norm[1] * frame_h)))
            zone_col    = (0, 255, 120) if touching else (40, 40, 200)
            zone_radius = max(14, int(palm_w * 0.35))
            cv2.circle(frame, (cx_px, cy_px), zone_radius, zone_col, 2, cv2.LINE_AA)
            cv2.circle(frame, (cx_px, cy_px), 4, zone_col, -1, cv2.LINE_AA)
            label_dist = touch_dist_ema if touch_dist_ema is not None else raw_dist
            # Show both the smoothed EMA distance and the lost-frame count
            cv2.putText(frame, f"d={label_dist:.3f}  lost={right_lost_frames}",
                        (cx_px - 44, cy_px + zone_radius + 14),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.40, zone_col, 1, cv2.LINE_AA)

            # STEP 5 - Move cursor ONLY when touching (like a real trackpad)
            if touching:
                status = "Tracking [TOUCH]"

                # Stage-1 EMA on local coords -- kills high-freq landmark noise
                local_vec  = np.array([x_final, y_final], dtype=np.float64)
                ema_local  = ema(ema_local, local_vec, EMA_ALPHA_LOCAL)

                # Map smoothed local coords to screen
                raw_screen = local_to_screen(
                    ema_local[0], ema_local[1], screen_w, screen_h
                )

                # Stage-2 EMA on screen pixels -- final polish
                ema_screen = ema(ema_screen, raw_screen, EMA_ALPHA_SCREEN)
                sx = int(max(0, min(screen_w - 1, ema_screen[0])))
                sy = int(max(0, min(screen_h - 1, ema_screen[1])))

                # Dead zone: suppress micro-movements below DEAD_ZONE_PX
                # to prevent pixel shimmer when holding still.
                cursor_pos = np.array(pyautogui.position(), dtype=np.float64)
                if np.linalg.norm(np.array([sx, sy]) - cursor_pos) > DEAD_ZONE_PX:
                    pyautogui.moveTo(sx, sy)
            else:
                status = "Lift finger to pause"

            # STEP 6 - Pinch-to-click (works regardless of touch state)
            pinch_dist   = float(np.linalg.norm(r8 - r4)) / (palm_w + 1e-6)
            now          = time.time()
            click_active = pinch_dist < CLICK_THRESHOLD

            if click_active and (now - last_click_time) >= CLICK_DEBOUNCE_S:
                pyautogui.click()
                last_click_time = now
                status = "CLICK!"

            # HUD geometry — always draw palm axes when left hand is visible
            draw_palm_axes(frame, origin, v_x, v_y, palm_w, palm_h, wrist)
            # Touch indicator ring around right index tip
            r8_pt = clamp_pt(tuple(r8.astype(int)), frame_w, frame_h)
            touch_ring_col = (0, 255, 120) if touching else (60, 60, 200)
            cv2.circle(frame, r8_pt, 22, touch_ring_col, 2, cv2.LINE_AA)
            draw_finger_target(frame, r8, click_active)

        # -- Draw left palm axes even when right hand is absent --
        # Previously the square only appeared when BOTH hands were tracked.
        # Now we draw it whenever the left hand is detected so the user
        # always gets visual feedback that the trackpad is recognised.
        elif left_lm is not None:
            origin, v_x, v_y, palm_w, palm_h, wrist = build_local_axes(
                left_lm, frame_w, frame_h
            )
            draw_palm_axes(frame, origin, v_x, v_y, palm_w, palm_h, wrist)
            status = "Left hand OK  -- raise right hand to control"
        elif right_lm is not None:
            status = "Right hand OK -- raise left hand as trackpad"
        else:
            status         = "No hands detected"
            ema_local      = None
            ema_screen     = None
            left_lm_cache  = None
            right_lm_cache = None

        draw_hud(frame, fps, x_final, y_final, pinch_dist,
                 click_active, touching, touch_dist_now, status)
        cv2.imshow("Palm Trackpad HCI", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # - Cleanup -
    cap.release()
    cv2.destroyAllWindows()
    detector.close()
    print("[Palm Trackpad] Session ended.")


if __name__ == "__main__":
    main()
