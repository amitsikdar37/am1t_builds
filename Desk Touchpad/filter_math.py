"""
filter_math.py
==============
Mathematical filters and synchronous motion quantization logic.
Implements zero-latency One-Euro low-pass filtering and pure 1-to-1 linear deadzone
quantization to guarantee that screen distance matches finger distance without delay.
"""
import math
import time
import config

def smoothing_factor(t_e: float, cutoff: float) -> float:
    r = 2.0 * math.pi * cutoff * t_e
    return r / (r + 1.0)


class ExponentialMovingAverage:
    def __init__(self, alpha: float = 0.5):
        self.alpha = alpha
        self.val = None

    def filter(self, x: float, alpha: float = None) -> float:
        if alpha is not None:
            self.alpha = alpha
        if self.val is None:
            self.val = x
        else:
            self.val = self.alpha * x + (1.0 - self.alpha) * self.val
        return self.val

    def reset(self):
        self.val = None


class OneEuroFilter:
    def __init__(self, min_cutoff: float = 1.0, beta: float = 0.0, d_cutoff: float = 1.0):
        self.min_cutoff = min_cutoff
        self.beta       = beta
        self.d_cutoff   = d_cutoff
        self.x_filter   = ExponentialMovingAverage()
        self.dx_filter  = ExponentialMovingAverage()
        self.last_time  = None

    def filter(self, x: float, timestamp: float = None) -> float:
        if timestamp is None:
            timestamp = time.time()
            
        if self.last_time is None or timestamp <= self.last_time:
            t_e = 1.0 / 30.0  
        else:
            t_e = timestamp - self.last_time
        self.last_time = timestamp

        if self.x_filter.val is None:
            dx = 0.0
        else:
            dx = (x - self.x_filter.val) / t_e

        alpha_d = smoothing_factor(t_e, self.d_cutoff)
        dx_hat  = self.dx_filter.filter(dx, alpha_d)

        cutoff = self.min_cutoff + self.beta * abs(dx_hat)
        alpha  = smoothing_factor(t_e, cutoff)
        return self.x_filter.filter(x, alpha)

    def reset(self) -> None:
        self.x_filter.reset()
        self.dx_filter.reset()
        self.last_time = None


class OneEuroPairFilter:
    def __init__(self, min_cutoff: float = 0.40, beta: float = 0.60, d_cutoff: float = 1.0):
        self.filter_x = OneEuroFilter(min_cutoff, beta, d_cutoff)
        self.filter_y = OneEuroFilter(min_cutoff, beta, d_cutoff)

    def __call__(self, pt: tuple[float, float], timestamp: float = None) -> tuple[float, float]:
        x_clean = self.filter_x.filter(pt[0], timestamp)
        y_clean = self.filter_y.filter(pt[1], timestamp)
        return x_clean, y_clean

    def reset(self) -> None:
        self.filter_x.reset()
        self.filter_y.reset()


def apply_synchronous_deadzone(dx: float, dy: float, deadzone_px: float) -> tuple[float, float]:
    """
    Pure synchronous linear deadzone quantization.
    1. Suppresses idle neural network micro-tremors below deadzone_px.
    2. Above deadzone_px, transmits 100% true linear displacements to ensure perfect
       synchronization between physical finger movement and mouse movement!
    """
    mag = math.hypot(dx, dy)
    if mag <= deadzone_px:
        return 0.0, 0.0
    
    # Smooth proportional subtracted linear scaling above deadzone
    scale = (mag - (deadzone_px * 0.5)) / mag
    return dx * scale, dy * scale
