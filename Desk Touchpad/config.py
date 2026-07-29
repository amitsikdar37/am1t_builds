"""
config.py
=========
Centralized configuration for Smooth & Stable Thumb Engagement Trackpad.
Restores comfortable baseline sensitivity, solid anti-jitter damping, and glitch rejection.
"""
import os
import cv2

# ==============================================================================
# 1. CAMERA & MODEL CONFIGURATION
# ==============================================================================
DEFAULT_CAPTURE_WIDTH  = 1280
DEFAULT_CAPTURE_HEIGHT = 720
DEFAULT_CAPTURE_FPS    = 30

MODEL_DIR  = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "hand_landmarker.task")
MODEL_URL  = ("https://storage.googleapis.com/mediapipe-models/"
              "hand_landmarker/hand_landmarker/float16/latest/"
              "hand_landmarker.task")

# ==============================================================================
# 2. THUMB ENGAGEMENT SWITCH (MULTI-ANCHOR MATRIX)
# ==============================================================================
THUMB_ENGAGEMENT_DIST = 0.070  # Below this = MOUSE ACTIVE; Above = PAUSED
SWITCH_CONFIRM_FRAMES = 1      # Instantaneous 1-frame switching response

# ==============================================================================
# 3. STATIONARY DWELL-CLICKING ("STAY STILL TO CLICK & TARGET LOCK")
# ==============================================================================
DWELL_TIME_SEC           = 0.360  # Comfortable 360ms dwell duration for crisp clicking
DWELL_ENTRY_VELOCITY_PX  = 2.8    # Velocity below which hand is stationary over a button
DWELL_ESCAPE_VELOCITY_PX = 4.8    # Velocity required to break out of a dwell target lock
DWELL_COOLDOWN_SEC       = 0.700  # Cooldown time after a click before another dwell can begin
DWELL_RESET_DIST_PX      = 14.0   # Must slide cursor at least 14px after clicking to rearm dwell

# ==============================================================================
# 4. MOUSE TRACKING, COMFORTABLE SENSITIVITY & GLITCH REJECTION
# ==============================================================================
TRACKPAD_SENSITIVITY_X = 1.85 # Restored calm, controllable baseline horizontal sensitivity
TRACKPAD_SENSITIVITY_Y = 1.85 # Restored calm, controllable baseline vertical sensitivity

# Anti-Jitter resting velocity deadzone (pixels/frame)
VELOCITY_DEADZONE_PX   = 2.2

# Anti-Flicker Glitch Rejection Threshold (pixels/frame)
# Discards absurd single-frame teleporting spikes caused by artificial camera noise
GLITCH_MAX_JUMP_PX     = 35.0

# ==============================================================================
# 5. ONE-EURO ADAPTIVE SPEED FILTER (PROVEN STABILITY)
# ==============================================================================
# Proven, balanced defaults (cutoff=0.20, beta=0.12) to completely eliminate flicking
ONE_EURO_MIN_CUTOFF = 0.20   
ONE_EURO_BETA       = 0.12   
ONE_EURO_DCAP       = 1.0    

# Two-Finger Scrolling (Index LM8 + Middle LM12 touched together)
TWO_FINGER_TOGEHTER_NORM = 0.045  
SCROLL_SENSITIVITY_GAIN  = 4.5    

# ==============================================================================
# 6. AR HUD RENDERING PALETTE (BGR COLORS)
# ==============================================================================
COL_BG_DARK       = (18,  18,  18)
COL_TEXT_LIGHT    = (245, 245, 245)
COL_THUMB_OPEN    = (60,  130, 255)   # Coral / Orange-Red when mouse deactivated
COL_THUMB_ENGAGED = (40,  245, 110)   # Neon Green when thumb touched & mouse moving
COL_DWELL_RING    = (0,   220, 255)   # Cyan / Gold animated progress ring during standstill
COL_CLICK_PULSE   = (0,   255, 255)   # Yellow flash upon firing left click
COL_SCROLL_MODE   = (255, 160, 20)    # Aqua for two-finger scrolling
COL_PALM_ANCHOR   = (120, 120, 120)   # Subdued grey for skeleton lines
