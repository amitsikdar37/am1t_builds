"""
touch_engine.py
===============
High-Precision Multi-Anchor Thumb Engagement Switch Engine.

Evaluates an exhaustive bone-to-bone 2D proximity matrix between BOTH the Thumb Tip (LM4)
and Thumb Mid-Joint (LM3) against ALL FOUR joints of the Index Finger Ray (LM5-8).
Ensures effortless, 100% reliable mouse activation without requiring rigid hand posture.
"""
import math
import numpy as np
import config

class TouchEngine:
    def __init__(self):
        self.touch_threshold = config.THUMB_ENGAGEMENT_DIST
        
        # State tracking
        self.is_engaged      = False
        self.engage_counter  = 0
        self.disengage_count = 0
        self.smoothed_dist   = None

    def adjust_threshold(self, delta: float) -> float:
        """Live interactive calibration of thumb gap threshold."""
        self.touch_threshold = max(0.025, min(0.160, self.touch_threshold + delta))
        return self.touch_threshold

    def analyze_hand(self, lm_list, frame_w: int, frame_h: int) -> dict:
        """
        Compute multi-anchor bone-to-bone distance matrix between thumb and index ray.
        Returns telemetry dictionary with ultra-responsive state switching.
        """
        # Pixel space coordinates for UI HUD and aiming
        lm4_px  = np.array([lm_list[4].x  * frame_w, lm_list[4].y  * frame_h], dtype=np.float64)
        lm5_px  = np.array([lm_list[5].x  * frame_w, lm_list[5].y  * frame_h], dtype=np.float64)
        lm6_px  = np.array([lm_list[6].x  * frame_w, lm_list[6].y  * frame_h], dtype=np.float64)
        lm7_px  = np.array([lm_list[7].x  * frame_w, lm_list[7].y  * frame_h], dtype=np.float64)
        lm8_px  = np.array([lm_list[8].x  * frame_w, lm_list[8].y  * frame_h], dtype=np.float64)
        lm12_px = np.array([lm_list[12].x * frame_w, lm_list[12].y * frame_h], dtype=np.float64)

        # ----------------------------------------------------------------------
        # 1. MULTI-ANCHOR BONE PROXIMITY MATRIX (LM3/LM4 vs LM5/LM6/LM7/LM8)
        # ----------------------------------------------------------------------
        # We test both Thumb Tip (LM4) and Thumb IP Joint (LM3) against the entire index finger
        thumb_anchors = [3, 4]
        index_ray     = [5, 6, 7, 8]
        
        min_dist = 999.0
        for t_idx in thumb_anchors:
            tx = lm_list[t_idx].x
            ty = lm_list[t_idx].y
            for idx in index_ray:
                ix = lm_list[idx].x
                iy = lm_list[idx].y
                d = math.hypot(tx - ix, ty - iy)
                if d < min_dist:
                    min_dist = d

        # Fast 80/20 response smoothing for instant snap switching without lag
        if self.smoothed_dist is None:
            self.smoothed_dist = min_dist
        else:
            self.smoothed_dist = 0.82 * min_dist + 0.18 * self.smoothed_dist

        # Hysteresis state switching: gap LESS than threshold = ACTIVE / ENGAGED!
        if not self.is_engaged and self.smoothed_dist < self.touch_threshold:
            self.engage_counter += 1
            self.disengage_count = 0
            if self.engage_counter >= config.SWITCH_CONFIRM_FRAMES:
                self.is_engaged = True
        elif self.is_engaged and self.smoothed_dist > (self.touch_threshold + 0.008):
            self.disengage_count += 1
            self.engage_counter = 0
            if self.disengage_count >= config.SWITCH_CONFIRM_FRAMES:
                self.is_engaged = False

        # ----------------------------------------------------------------------
        # 2. TWO-FINGER DISTANCE (FOR SCROLLING)
        # ----------------------------------------------------------------------
        two_finger_dist_norm = math.sqrt((lm_list[8].x - lm_list[12].x)**2 + 
                                         (lm_list[8].y - lm_list[12].y)**2)

        return {
            'is_engaged': self.is_engaged,
            'metric': self.smoothed_dist,
            'threshold': self.touch_threshold,
            'index_tip': (lm8_px[0], lm8_px[1]),
            'thumb_tip': (lm4_px[0], lm4_px[1]),
            'middle_tip': (lm12_px[0], lm12_px[1]),
            'two_finger_dist': two_finger_dist_norm,
            'is_two_finger_gesture': two_finger_dist_norm < config.TWO_FINGER_TOGEHTER_NORM,
        }
