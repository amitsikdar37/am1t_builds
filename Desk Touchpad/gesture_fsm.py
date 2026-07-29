"""
gesture_fsm.py
==============
Stateful Thumb Engagement Trackpad & Stationary Dwell-Click Finite State Machine.

Features:
- Anti-Flicker Glitch Rejection: automatically intercepts and discards impossible AI vision spikes.
- Restored Comfortable Sensitivity: 1.85x linear scaling for effortless targeting and navigation.
- Magnetic Dwell Target-Locking: cursor freezes steadily over buttons during click timer.
"""
import math
import time
import config
from filter_math import OneEuroPairFilter, apply_synchronous_deadzone

class TrackpadFSM:
    STATE_DEACTIVATED  = "THUMB OPEN (DEACTIVATED)"
    STATE_TRACKING     = "MOUSE ACTIVE & GLIDING"
    STATE_DWELL_CLICK  = "TARGET LOCKED -> DWELL CLICKING..."
    STATE_COOLDOWN     = "CLICK FIRED (COOLDOWN)"
    STATE_SCROLL       = "2-FINGER PAGE SCROLLING"

    def __init__(self, win_mouse):
        self.mouse         = win_mouse
        self.state         = self.STATE_DEACTIVATED
        self.filter        = OneEuroPairFilter(config.ONE_EURO_MIN_CUTOFF,
                                               config.ONE_EURO_BETA,
                                               config.ONE_EURO_DCAP)
        
        self.prev_finger_px = None
        self.prev_timestamp = None
        
        self.dwell_start_time = 0.0
        self.dwell_progress   = 0.0   
        self.last_click_time  = 0.0
        self.click_cooldown   = False
        self.post_click_dist  = 0.0
        self.cooldown_pos     = (0.0, 0.0)

        self.prev_scroll_y  = None

        self.last_event_msg = ""
        self.event_msg_time = 0.0

    def trigger_event_message(self, msg: str):
        self.last_event_msg = msg
        self.event_msg_time = time.time()

    def update(self, telemetry: dict) -> dict:
        """
        Main FSM iteration loop. Evaluates thumb switch status, executes glitch-free motion,
        and enforces magnetic Target-Locking during dwell click countdowns.
        """
        now        = time.time()
        is_engaged = telemetry['is_engaged']
        is_2f      = telemetry['is_two_finger_gesture']
        idx_tip    = telemetry['index_tip']
        mid_tip    = telemetry['middle_tip']

        if now - self.event_msg_time > 1.5:
            self.last_event_msg = ""

        self.dwell_progress = 0.0

        velocity = 0.0
        if self.prev_finger_px is not None:
            dx_raw = idx_tip[0] - self.prev_finger_px[0]
            dy_raw = idx_tip[1] - self.prev_finger_px[1]
            velocity = math.hypot(dx_raw, dy_raw)

        # ----------------------------------------------------------------------
        # HANDLE POST-CLICK COOLDOWN LOCKOUT
        # ----------------------------------------------------------------------
        if self.click_cooldown:
            dist_since_click = math.hypot(idx_tip[0] - self.cooldown_pos[0], idx_tip[1] - self.cooldown_pos[1])
            self.post_click_dist = max(self.post_click_dist, dist_since_click)
            
            if (now - self.last_click_time) >= config.DWELL_COOLDOWN_SEC or self.post_click_dist > config.DWELL_RESET_DIST_PX:
                self.click_cooldown = False
                self.dwell_start_time = now

        # ----------------------------------------------------------------------
        # STATE TRANSITIONS & STABLE TRACKING
        # ----------------------------------------------------------------------
        if not is_engaged:
            self.state = self.STATE_DEACTIVATED
            self.filter.reset()
            self.mouse.reset_residuals()
            self.prev_finger_px = idx_tip
            self.prev_scroll_y  = None

        elif is_2f and velocity > 2.5:
            self.state = self.STATE_SCROLL
            avg_y = (idx_tip[1] + mid_tip[1]) / 2.0
            if self.prev_scroll_y is not None:
                dy_scroll = (avg_y - self.prev_scroll_y) / 10.0
                if abs(dy_scroll) > 0.15:
                    self.mouse.scroll_vertical(-dy_scroll * config.SCROLL_SENSITIVITY_GAIN)
                    self.trigger_event_message("Scrolling...")
            self.prev_scroll_y  = avg_y
            self.prev_finger_px = idx_tip

        else:
            self.prev_scroll_y = None
            
            # 1. Active Dwell Target-Lock Countdown
            if self.state == self.STATE_DWELL_CLICK and not self.click_cooldown:
                if velocity <= config.DWELL_ESCAPE_VELOCITY_PX:
                    elapsed = now - self.dwell_start_time
                    self.dwell_progress = min(1.0, max(0.0, elapsed / config.DWELL_TIME_SEC))
                    
                    if elapsed >= config.DWELL_TIME_SEC:
                        self.mouse.click_left()
                        self.trigger_event_message("STATIONARY DWELL -> LEFT CLICK!")
                        self.last_click_time = now
                        self.click_cooldown  = True
                        self.cooldown_pos    = idx_tip
                        self.post_click_dist = 0.0
                        self.state           = self.STATE_COOLDOWN
                        self.dwell_progress  = 0.0
                        self.mouse.reset_residuals()
                    
                    # Cursor frozen still in place over button during countdown!
                    self.prev_timestamp = now
                    self.prev_finger_px = idx_tip
                    return {
                        'state_label': self.state,
                        'event_msg': self.last_event_msg,
                        'cursor_pos': self.mouse.get_position(),
                        'dwell_progress': self.dwell_progress,
                        'velocity': velocity
                    }
                else:
                    self.state = self.STATE_TRACKING
                    self.dwell_start_time = now

            # 2. Check for stationary standstill over a button to start Dwell Lock
            if velocity <= config.DWELL_ENTRY_VELOCITY_PX and not self.click_cooldown:
                self.state = self.STATE_DWELL_CLICK
                self.dwell_start_time = now
                self.mouse.reset_residuals()
            else:
                # 3. SMOOTH MOUSE GLIDING WITH ANTI-FLICKER GLITCH DEFLECTION
                self.state = self.STATE_TRACKING if not self.click_cooldown else self.STATE_COOLDOWN
                self.dwell_start_time = now
                self.dwell_progress = 0.0
                self.process_cursor_glide(idx_tip, now, velocity)

        self.prev_timestamp = now
        self.prev_finger_px = idx_tip

        return {
            'state_label': self.state,
            'event_msg': self.last_event_msg,
            'cursor_pos': self.mouse.get_position(),
            'dwell_progress': self.dwell_progress,
            'velocity': velocity
        }

    def process_cursor_glide(self, current_px: tuple[float, float], timestamp: float, raw_velocity: float):
        if self.prev_finger_px is None:
            return

        # 1. Anti-Flicker Glitch Clamp: if AI sensor emits an impossible 1-frame jump, ignore & discard!
        if raw_velocity > config.GLITCH_MAX_JUMP_PX:
            self.prev_finger_px = current_px
            return

        # 2. Stable One-Euro low-pass speed filtering
        smoothed_pos = self.filter(current_px, timestamp)
        clean_dx = smoothed_pos[0] - self.prev_finger_px[0]
        clean_dy = smoothed_pos[1] - self.prev_finger_px[1]
        
        # 3. Synchronous linear deadzone quantization
        sync_dx, sync_dy = apply_synchronous_deadzone(clean_dx, clean_dy, config.VELOCITY_DEADZONE_PX)
        
        # 4. Multiply by calm, controllable baseline sensitivities (1.85x)
        final_dx = sync_dx * config.TRACKPAD_SENSITIVITY_X
        final_dy = sync_dy * config.TRACKPAD_SENSITIVITY_Y
        
        self.mouse.move_relative(final_dx, final_dy)

    def force_reset_to_idle(self):
        self.mouse.release_all()
        self.state = self.STATE_DEACTIVATED
        self.filter.reset()
