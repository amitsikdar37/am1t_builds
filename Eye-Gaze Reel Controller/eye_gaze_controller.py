"""
Eye-Gaze Reel Controller  ·  v3.0  (Fully Optimized)
======================================================
Controls
  Look UP slowly     → Next reel   (scroll down)
  Look DOWN slowly   → Prev reel   (scroll up)
  Close eyes ~0.6 s  → Pause/Play  (mouse click)
  Double-blink       → Like reel   (click Like button)
  Press 'c'          → Start 3-second Like-button calibration countdown
  Press 'q'          → Quit
"""

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
import pyautogui
import time
import os
import json
import urllib.request
import sys
import collections
import math

# ─────────────────────────────────────────────────────────────
#  TUNING PARAMETERS
# ─────────────────────────────────────────────────────────────

Y_UP_THRESH   = -0.10
Y_DOWN_THRESH =  0.01
MAX_VELOCITY  =  0.015

EAR_BLINK_THRESH = 0.20
EAR_PAUSE_THRESH = 0.24

LONG_BLINK_SEC     = 0.6
BLINK_DEBOUNCE_SEC = 0.10
FAST_BLINK_MAX_SEC = 0.40
DOUBLE_BLINK_WIN   = 0.80
POST_BLINK_PAUSE   = 0.25
COOLDOWN_SEC       = 1.5

HISTORY_LEN   = 8
SCROLL_AMOUNT = 20

CAM_INDEX  = 0
CAM_WIDTH  = 640
CAM_HEIGHT = 480
CAM_FPS    = 30

# ─────────────────────────────────────────────────────────────
#  CONSTANTS
# ─────────────────────────────────────────────────────────────
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
)
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH  = os.path.join(SCRIPT_DIR, "face_landmarker.task")
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.json")

R_IRIS = 468;  L_IRIS = 473
R_INNER = 133; R_OUTER = 33
L_INNER = 362; L_OUTER = 263
R_EAR = {"p1":33,  "p2":160, "p3":158, "p4":133, "p5":153, "p6":144}
L_EAR = {"p1":362, "p2":385, "p3":387, "p4":263, "p5":380, "p6":373}

FONT = cv2.FONT_HERSHEY_SIMPLEX


# ─────────────────────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────────────────────

def ensure_model():
    if os.path.isfile(MODEL_PATH):
        return
    print("[SETUP] Downloading face-landmark model ...")
    try:
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print(f"[SETUP] Done ({os.path.getsize(MODEL_PATH)//1024//1024} MB)")
    except Exception as e:
        print(f"[ERROR] {e}\nDownload manually:\n  {MODEL_URL}\n-> {MODEL_PATH}")
        sys.exit(1)


def load_config():
    if os.path.isfile(CONFIG_PATH):
        try:
            with open(CONFIG_PATH) as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_config(data: dict):
    try:
        with open(CONFIG_PATH, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"[WARN] Could not save config: {e}")


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


# ─────────────────────────────────────────────────────────────
#  BLINK STATE MACHINE
# ─────────────────────────────────────────────────────────────

class BlinkFSM:
    OPEN       = "OPEN"
    CLOSING    = "CLOSING"
    DEBOUNCING = "DEBOUNCING"

    def __init__(self):
        self.state             = self.OPEN
        self.close_start       = 0.0
        self.open_start        = 0.0
        self.long_triggered    = False
        self.last_fast_blink_t = 0.0
        self.post_blink_until  = 0.0

    def update(self, avg_ear: float, now: float):
        event = None

        if self.state == self.OPEN:
            if avg_ear < EAR_PAUSE_THRESH:
                self.state          = self.CLOSING
                self.close_start    = now
                self.long_triggered = False

        elif self.state == self.CLOSING:
            if avg_ear >= EAR_PAUSE_THRESH:
                self.state      = self.DEBOUNCING
                self.open_start = now
            elif not self.long_triggered and (now - self.close_start) >= LONG_BLINK_SEC:
                self.long_triggered = True
                event = "LONG_BLINK"

        elif self.state == self.DEBOUNCING:
            if avg_ear < EAR_PAUSE_THRESH:
                # Went back down - still closing
                self.state = self.CLOSING
            elif avg_ear > 0.28 or (now - self.open_start) >= BLINK_DEBOUNCE_SEC:
                # Confirmed open
                blink_dur             = self.open_start - self.close_start
                self.state            = self.OPEN
                self.post_blink_until = now + POST_BLINK_PAUSE

                if not self.long_triggered and blink_dur < FAST_BLINK_MAX_SEC:
                    if (now - self.last_fast_blink_t) < DOUBLE_BLINK_WIN and self.last_fast_blink_t > 0:
                        event = "DOUBLE_BLINK"
                        self.last_fast_blink_t = 0.0
                    else:
                        event = "FAST_BLINK"
                        self.last_fast_blink_t = now

        return event

    @property
    def gaze_blocked(self):
        return self.state in (self.CLOSING, self.DEBOUNCING)


# ─────────────────────────────────────────────────────────────
#  GAZE STATE MACHINE
# ─────────────────────────────────────────────────────────────

class GazeFSM:
    def __init__(self):
        self.history = collections.deque(maxlen=HISTORY_LEN)

    def clear(self):
        self.history.clear()

    def push(self, norm_y: float):
        self.history.append(norm_y)

    def command(self, in_cooldown: bool):
        if in_cooldown or len(self.history) < HISTORY_LEN:
            return None
        velocity = abs((self.history[-1] - self.history[0]) / HISTORY_LEN)
        if velocity >= MAX_VELOCITY:
            return None
        recent = list(self.history)[-3:]
        if all(y < Y_UP_THRESH for y in recent):
            self.clear()
            return "UP"
        if all(y > Y_DOWN_THRESH for y in recent):
            self.clear()
            return "DOWN"
        return None

    @property
    def velocity(self):
        if len(self.history) < 2:
            return 0.0
        return abs((self.history[-1] - self.history[0]) / len(self.history))

    @property
    def current_y(self):
        return self.history[-1] if self.history else 0.0


# ─────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────

def main():
    ensure_model()

    cfg          = load_config()
    like_pos_raw = cfg.get("like_button")
    like_pos     = tuple(like_pos_raw) if like_pos_raw else None
    calibrating_until = 0.0

    cap = cv2.VideoCapture(CAM_INDEX)
    cap.set(cv2.CAP_PROP_FPS,         CAM_FPS)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  CAM_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAM_HEIGHT)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    if not cap.isOpened():
        print("[ERROR] Cannot open camera.")
        return

    pyautogui.FAILSAFE = True
    pyautogui.PAUSE    = 0.0

    opts = vision.FaceLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=vision.RunningMode.VIDEO,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
    )
    landmarker = vision.FaceLandmarker.create_from_options(opts)

    cv2.namedWindow("Eye-Gaze Controller", cv2.WINDOW_NORMAL)
    cv2.setWindowProperty("Eye-Gaze Controller", cv2.WND_PROP_TOPMOST, 1)
    cv2.resizeWindow("Eye-Gaze Controller", CAM_WIDTH, CAM_HEIGHT)

    blink       = BlinkFSM()
    gaze        = GazeFSM()
    ear_history = collections.deque(maxlen=4)

    last_action_time = 0.0
    action_text      = ""
    action_until     = 0.0

    def set_action(text, dur=1.5):
        nonlocal action_text, action_until
        action_text  = text
        action_until = time.time() + dur

    print("-" * 60)
    print("  Eye-Gaze Reel Controller  v3.0  -- RUNNING")
    print(f"  Gaze deadzone : UP < {Y_UP_THRESH:.2f} | DOWN > {Y_DOWN_THRESH:.2f}")
    if like_pos:
        print(f"  Like button   : loaded from config at {like_pos}")
    else:
        print("  Like button   : not calibrated  ->  press 'c' in-app")
    print("  Press 'q' to quit")
    print("-" * 60)

    while True:
        ret, frame = cap.read()
        if not ret:
            continue

        frame  = cv2.flip(frame, 1)
        fh, fw = frame.shape[:2]
        now    = time.time()

        frame_ts_ms = int(time.monotonic() * 1000)
        rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        res    = landmarker.detect_for_video(mp_img, frame_ts_ms)

        cd_rem = max(0.0, COOLDOWN_SEC - (now - last_action_time))
        in_cd  = cd_rem > 0
        avg_ear = 0.0

        # Complete calibration when countdown ends
        if like_pos == "calibrating" and now >= calibrating_until:
            pos      = pyautogui.position()
            like_pos = (pos.x, pos.y)
            save_config({"like_button": list(like_pos)})
            print(f"[SETUP] Like button saved at {like_pos}")
            set_action("LIKE BUTTON CALIBRATED!", 2.5)

        if res.face_landmarks:
            lm = res.face_landmarks[0]

            # EAR (4-frame smoothed)
            r_ear = compute_ear(lm, fw, fh, R_EAR)
            l_ear = compute_ear(lm, fw, fh, L_EAR)
            ear_history.append((r_ear + l_ear) / 2.0)
            avg_ear = sum(ear_history) / len(ear_history)

            # Draw iris dots
            for idx in range(468, 478):
                cv2.circle(frame,
                           (int(lm[idx].x * fw), int(lm[idx].y * fh)),
                           3, (0, 220, 255), -1, cv2.LINE_AA)

            # Clear gaze history on full blink
            if avg_ear < EAR_BLINK_THRESH:
                gaze.clear()

            # Run blink FSM
            event = blink.update(avg_ear, now)

            if event == "LONG_BLINK":
                pyautogui.click()
                last_action_time = now
                set_action("  PAUSE / PLAY  ", 1.5)
                print("[ACTION] Long blink -> Pause/Play")

            elif event == "DOUBLE_BLINK":
                if like_pos and like_pos != "calibrating":
                    origin = pyautogui.position()
                    pyautogui.click(x=like_pos[0], y=like_pos[1])
                    pyautogui.moveTo(origin.x, origin.y, duration=0)
                    set_action("  LIKED!  ", 1.5)
                    print("[ACTION] Double blink -> Liked")
                else:
                    set_action("! Press 'c' to calibrate Like button !", 2.0)
                    print("[WARNING] Double blink -> Like not calibrated")

            # Gaze tracking (only when eyes are open and settled)
            if not blink.gaze_blocked and now >= blink.post_blink_until:
                r_y = get_norm_y(lm, R_INNER, R_OUTER, R_IRIS, fw, fh)
                l_y = get_norm_y(lm, L_INNER, L_OUTER, L_IRIS, fw, fh)
                gaze.push((r_y + l_y) / 2.0)

                cmd = gaze.command(in_cd)
                if cmd == "UP":
                    pyautogui.scroll(-SCROLL_AMOUNT)
                    last_action_time = now
                    set_action("  NEXT REEL  ", 1.2)
                    print(f"[ACTION] Look UP  (y={gaze.current_y:+.3f}) -> Next reel")
                elif cmd == "DOWN":
                    pyautogui.scroll(SCROLL_AMOUNT)
                    last_action_time = now
                    set_action("  PREV REEL  ", 1.2)
                    print(f"[ACTION] Look DOWN (y={gaze.current_y:+.3f}) -> Prev reel")
            else:
                gaze.clear()

        else:
            gaze.clear()
            ear_history.clear()

        # ── HUD ──
        ov = frame.copy()
        cv2.rectangle(ov, (0, 0), (fw, 110), (10, 10, 10), -1)
        cv2.addWeighted(ov, 0.70, frame, 0.30, 0, frame)

        norm_y   = gaze.current_y
        velocity = gaze.velocity

        yc = (80, 255, 80) if norm_y < Y_UP_THRESH else \
             (50, 165, 255) if norm_y > Y_DOWN_THRESH else (180, 180, 180)
        vc = (50, 50, 255) if velocity >= MAX_VELOCITY else (80, 255, 80)
        ec = (50, 50, 255) if avg_ear < EAR_PAUSE_THRESH else (180, 180, 180)

        cv2.putText(frame, f"Gaze Y: {norm_y:+.3f}  dead={Y_UP_THRESH}/{Y_DOWN_THRESH:+.2f}",
                    (12, 26), FONT, 0.48, yc, 1, cv2.LINE_AA)
        cv2.putText(frame, f"Speed:  {velocity:.4f}  max={MAX_VELOCITY}",
                    (12, 50), FONT, 0.48, vc, 1, cv2.LINE_AA)
        cv2.putText(frame, f"EAR:    {avg_ear:.3f}  close<{EAR_PAUSE_THRESH}",
                    (12, 74), FONT, 0.48, ec, 1, cv2.LINE_AA)

        if like_pos and like_pos != "calibrating":
            lk_text = f"Like: ({like_pos[0]},{like_pos[1]})  [c]=recalibrate"
            lk_col  = (80, 255, 80)
        elif like_pos == "calibrating":
            rem     = max(0.0, calibrating_until - now)
            lk_text = f"Move mouse to Like button...  {rem:.1f}s"
            lk_col  = (50, 200, 255)
        else:
            lk_text = "Like not set  ->  press 'c' to calibrate"
            lk_col  = (80, 80, 255)

        cv2.putText(frame, lk_text, (12, 98), FONT, 0.44, lk_col, 1, cv2.LINE_AA)

        if now < action_until:
            cv2.putText(frame, action_text, (12, 140),
                        FONT, 0.80, (30, 220, 255), 2, cv2.LINE_AA)

        if in_cd:
            bw = int((cd_rem / COOLDOWN_SEC) * (fw - 24))
            cv2.rectangle(frame, (12, fh - 14), (12 + bw, fh - 6),
                          (0, 80, 220), -1, cv2.LINE_AA)

        cv2.imshow("Eye-Gaze Controller", frame)

        key = cv2.waitKey(1) & 0xFF
        if key in (ord('q'), ord('Q')):
            print("[EXIT]")
            break
        elif key in (ord('c'), ord('C')):
            calibrating_until = now + 3.0
            like_pos          = "calibrating"
            set_action("MOVE MOUSE TO LIKE BUTTON  (3s)...", 3.0)
            print("[SETUP] Calibration started. Move mouse to Like button.")

    landmarker.close()
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
