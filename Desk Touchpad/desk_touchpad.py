"""
desk_touchpad.py
================
Main Application Entrypoint for Desk Touchpad.
Transforms your desk table into a precision laptop trackpad via smartphone camera.

Features:
- Pure Thumb Engagement Trackpad Switch (Thumb touched = Active, Open = Deactivated).
- Stationary Dwell-Clicking ("Stay still for a moment to click") with live AR countdown ring.
- Zero-latency threaded webcam capture & One-Euro jitter-free tracking.
- Interactive AR Gauge bar on right side to monitor thumb switch gap.

Usage:
    python desk_touchpad.py
    
Hotkeys:
    [UP] / [W]   : Adjust Thumb Engagement gap threshold UP (easier activation)
    [DOWN] / [S] : Adjust Thumb Engagement gap threshold DOWN (require tighter pinch)
    [ESC] or [Q] : Quit & cleanly release all mouse locks
"""
import os
import time
import urllib.request
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks.python import vision as mp_vision
from mediapipe.tasks.python.vision import HandLandmarker, HandLandmarkerOptions
from mediapipe.tasks.python.vision import RunningMode

import config
from win_mouse import WinMouseController
from camera_stream import AsyncVideoCapture, select_camera_interactive
from touch_engine import TouchEngine
from gesture_fsm import TrackpadFSM


def ensure_model_exists() -> None:
    if not os.path.exists(config.MODEL_PATH):
        print(f"[Desk Touchpad] Downloading AI hand landmark model to {config.MODEL_PATH}...")
        urllib.request.urlretrieve(config.MODEL_URL, config.MODEL_PATH)
        print("[Desk Touchpad] Model download complete!")


def draw_ar_overlay(frame: np.ndarray, telemetry: dict, fsm_state: dict, fps: float, w: int, h: int) -> None:
    """Render high-tech Augmented Reality feedback overlay, Dwell ring, and thumb gauge."""
    is_engaged = telemetry.get('is_engaged', False)
    idx_tip    = telemetry.get('index_tip', (0, 0))
    thumb_tip  = telemetry.get('thumb_tip', (0, 0))
    metric     = telemetry.get('metric', 0.0)
    thresh     = telemetry.get('threshold', config.THUMB_ENGAGEMENT_DIST)
    
    state_lbl  = fsm_state.get('state_label', "DEACTIVATED")
    event_msg  = fsm_state.get('event_msg', "")
    cur_pos    = fsm_state.get('cursor_pos', (0, 0))
    dwell_prog = fsm_state.get('dwell_progress', 0.0)
    velocity   = fsm_state.get('velocity', 0.0)

    # --------------------------------------------------------------------------
    # 1. FINGERTIP CROSSHAIR & ANIMATED DWELL COUNTDOWN RING
    # --------------------------------------------------------------------------
    p_idx = (int(idx_tip[0]), int(idx_tip[1]))
    p_thm = (int(thumb_tip[0]), int(thumb_tip[1]))
    
    ring_col = config.COL_THUMB_ENGAGED if is_engaged else config.COL_THUMB_OPEN
    if dwell_prog > 0.0:
        ring_col = config.COL_DWELL_RING

    # Draw connection line between thumb and index when approaching
    if metric < (thresh + 0.05):
        line_col = config.COL_THUMB_ENGAGED if is_engaged else (100, 100, 200)
        cv2.line(frame, p_idx, p_thm, line_col, 2, cv2.LINE_AA)

    r = 24 if is_engaged else 16
    cv2.circle(frame, p_idx, r, ring_col, 2, cv2.LINE_AA)
    cv2.circle(frame, p_idx, 4, ring_col, -1, cv2.LINE_AA)
    cv2.circle(frame, p_thm, 10, ring_col, 2, cv2.LINE_AA)

    # If stationary dwell countdown is active, draw animated expanding progress arc!
    if dwell_prog > 0.0:
        end_angle = int(360 * dwell_prog)
        # Draw bold cyan countdown arc around index fingertip
        cv2.ellipse(frame, p_idx, (r + 8, r + 8), -90, 0, end_angle, config.COL_CLICK_PULSE, 4, cv2.LINE_AA)
        cv2.putText(frame, f"{int(dwell_prog*100)}%", (p_idx[0] + 28, p_idx[1] - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, config.COL_CLICK_PULSE, 2, cv2.LINE_AA)

    # --------------------------------------------------------------------------
    # 2. SEMI-TRANSPARENT TELEMETRY HUD PANEL (TOP-LEFT)
    # --------------------------------------------------------------------------
    panel_w, panel_h = 470, 215
    overlay = frame.copy()
    cv2.rectangle(overlay, (10, 10), (10 + panel_w, 10 + panel_h), config.COL_BG_DARK, -1)
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
    cv2.rectangle(frame, (10, 10), (10 + panel_w, 10 + panel_h), ring_col, 2, cv2.LINE_AA)

    status_col = config.COL_THUMB_ENGAGED if is_engaged else config.COL_THUMB_OPEN
    status_txt = "[ACTIVE] THUMB TOUCHED TO INDEX" if is_engaged else "[PAUSED] THUMB OPEN / DEACTIVATED"

    rows = [
        (f"DESK TOUCHPAD - THUMB SWITCH  |  FPS: {fps:4.1f}", config.COL_TEXT_LIGHT, 0.53, 2),
        (f"Status : {status_txt}", status_col, 0.50, 2),
        (f"State  : {state_lbl}", ring_col, 0.51, 2),
        (f"Speed  : {velocity:5.1f} px/f  (Dwell click at < {config.DWELL_ENTRY_VELOCITY_PX})", config.COL_TEXT_LIGHT, 0.46, 1),
        (f"Thumb  : Gap={metric:.3f}  (Activate when < {thresh:.3f})", config.COL_TEXT_LIGHT, 0.46, 1),
        (f"Cursor : X={cur_pos[0]}, Y={cur_pos[1]} on Windows Screen", config.COL_TEXT_LIGHT, 0.46, 1),
    ]

    for i, (txt, col, scale, thick) in enumerate(rows):
        cv2.putText(frame, txt, (22, 40 + i * 27),
                    cv2.FONT_HERSHEY_SIMPLEX, scale, col, thick, cv2.LINE_AA)

    # --------------------------------------------------------------------------
    # 3. LIVE VISUAL THUMB GAP GAUGE (RIGHT EDGE)
    # --------------------------------------------------------------------------
    gx = w - 95
    gy = 40
    gh = int(h * 0.65)
    gw = 40

    cv2.rectangle(overlay, (gx - 12, gy - 25), (gx + gw + 45, gy + gh + 40), config.COL_BG_DARK, -1)
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
    cv2.rectangle(frame, (gx, gy), (gx + gw, gy + gh), (90, 90, 90), 2, cv2.LINE_AA)
    
    cv2.putText(frame, "TOUCHED", (gx - 7, gy - 9), cv2.FONT_HERSHEY_SIMPLEX, 0.44, config.COL_THUMB_ENGAGED, 2, cv2.LINE_AA)
    cv2.putText(frame, "OPEN", (gx + 3, gy + gh + 22), cv2.FONT_HERSHEY_SIMPLEX, 0.45, config.COL_THUMB_OPEN, 2, cv2.LINE_AA)

    # Map thumb gap distance onto gauge height (0 = top/touched 0.020, 1 = bottom/open 0.140)
    m_min, m_max = 0.140, 0.020

    norm_thresh = (thresh - m_min) / (m_max - m_min + 1e-6)
    norm_val    = (metric - m_min) / (m_max - m_min + 1e-6)

    norm_thresh = max(0.05, min(0.95, norm_thresh))
    norm_val    = max(0.01, min(0.99, norm_val))

    py_thresh = gy + gh - int(norm_thresh * gh)
    py_val    = gy + gh - int(norm_val * gh)

    fill_col = config.COL_THUMB_ENGAGED if is_engaged else config.COL_THUMB_OPEN
    cv2.rectangle(frame, (gx + 2, py_val), (gx + gw - 2, gy + gh - 2), fill_col, -1)

    cv2.line(frame, (gx - 10, py_thresh), (gx + gw + 10, py_thresh), (0, 215, 255), 3, cv2.LINE_AA)
    cv2.putText(frame, "<- LINE", (gx + gw + 12, py_thresh + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.46, (0, 215, 255), 2, cv2.LINE_AA)

    # --------------------------------------------------------------------------
    # 4. POPUP EVENT BANNER (TAPS & CLICKS)
    # --------------------------------------------------------------------------
    if event_msg:
        txt_size = cv2.getTextSize(event_msg, cv2.FONT_HERSHEY_SIMPLEX, 0.80, 2)[0]
        bx = (w - txt_size[0]) // 2
        by = h - 75
        cv2.rectangle(frame, (bx - 18, by - 30), (bx + txt_size[0] + 18, by + 12), config.COL_BG_DARK, -1)
        cv2.putText(frame, event_msg, (bx, by), cv2.FONT_HERSHEY_SIMPLEX, 0.80, config.COL_CLICK_PULSE, 2, cv2.LINE_AA)

    # --------------------------------------------------------------------------
    # 5. BOTTOM HOTKEY ADVISORY BAR
    # --------------------------------------------------------------------------
    bar_txt = "Hotkeys: [UP/DOWN Arrow or W/S] Tune Thumb Gap Threshold Line  |  [Q / ESC] Quit"
    cv2.putText(frame, bar_txt, (18, h - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.51, (220, 220, 220), 1, cv2.LINE_AA)


def main() -> None:
    print("==========================================================")
    print("    ANTIGRAVITY DESK TOUCHPAD - THUMB SWITCH & DWELL      ")
    print("==========================================================")
    ensure_model_exists()

    chosen_idx = select_camera_interactive(max_test_index=4)
    async_cam  = AsyncVideoCapture(chosen_idx, config.DEFAULT_CAPTURE_WIDTH, config.DEFAULT_CAPTURE_HEIGHT, config.DEFAULT_CAPTURE_FPS)
    
    win_mouse  = WinMouseController()
    touch_eng  = TouchEngine()
    gesture    = TrackpadFSM(win_mouse)
    
    options = HandLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=config.MODEL_PATH),
        running_mode=RunningMode.IMAGE,
        num_hands=1,
        min_hand_detection_confidence=0.35,
        min_hand_presence_confidence=0.35,
        min_tracking_confidence=0.35,
    )
    detector = HandLandmarker.create_from_options(options)
    clahe    = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))

    window_title = "Desk Touchpad - Thumb Engagement & Stationary Dwell Click"
    cv2.namedWindow(window_title, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_title, 1160, 650)

    prev_tick = cv2.getTickCount()
    fps       = 0.0
    print("[Desk Touchpad] Running! Touch thumb to index finger to move mouse; stay still to click!")

    try:
        while True:
            ret, frame = async_cam.read_latest()
            if not ret or frame is None:
                time.sleep(0.005)
                continue

            frame = cv2.flip(frame, 1)
            fh, fw = frame.shape[:2]

            tick = cv2.getTickCount()
            fps  = cv2.getTickFrequency() / max(tick - prev_tick, 1)
            prev_tick = tick

            lab     = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            l_eq    = clahe.apply(l)
            enhanced = cv2.cvtColor(cv2.merge([l_eq, a, b]), cv2.COLOR_LAB2BGR)

            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB,
                                data=cv2.cvtColor(enhanced, cv2.COLOR_BGR2RGB))
            result = detector.detect(mp_image)

            if result.hand_landmarks and len(result.hand_landmarks) > 0:
                lm_list = result.hand_landmarks[0]
                
                for lm in lm_list:
                    pt = (int(lm.x * fw), int(lm.y * fh))
                    cv2.circle(frame, pt, 2, config.COL_PALM_ANCHOR, -1, cv2.LINE_AA)

                telemetry = touch_eng.analyze_hand(lm_list, fw, fh)
                fsm_state = gesture.update(telemetry)
                draw_ar_overlay(frame, telemetry, fsm_state, fps, fw, fh)
            else:
                gesture.force_reset_to_idle()
                cv2.putText(frame, "Waiting for hand in desktop camera view...", (fw // 2 - 200, fh // 2),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.75, (150, 150, 255), 2, cv2.LINE_AA)

            cv2.imshow(window_title, frame)

            key = cv2.waitKey(1) & 0xFF
            if key in (27, ord('q'), ord('Q')):
                print("[Desk Touchpad] Quit command received. Terminating...")
                break
            elif key == 82 or key == 249 or key == ord('w') or key == ord('W'):
                new_th = touch_eng.adjust_threshold(0.003)
                gesture.trigger_event_message(f"Threshold LINE RAISED: {new_th:+.3f}")
            elif key == 84 or key == 250 or key == ord('s') or key == ord('S'):
                new_th = touch_eng.adjust_threshold(-0.003)
                gesture.trigger_event_message(f"Threshold LINE LOWERED: {new_th:+.3f}")

    except KeyboardInterrupt:
        print("[Desk Touchpad] KeyboardInterrupt caught.")
    finally:
        win_mouse.release_all()
        async_cam.release()
        detector.close()
        cv2.destroyAllWindows()
        print("[Desk Touchpad] Clean shutdown complete. Mouse released.")


if __name__ == "__main__":
    main()
