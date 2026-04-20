# ppg_core.py
"""
Core PPG signal preprocessing utilities.
Shared functions for video-to-signal extraction and filtering.
"""

import cv2
import numpy as np
from dataclasses import dataclass
from typing import Tuple, List
from scipy.signal import butter, filtfilt


@dataclass
class PPGConfig:
    """Configuration parameters for PPG signal processing."""
    window_sec: float = 12.0
    hop_sec: float = 6.0
    min_bpm: float = 40.0
    max_bpm: float = 180.0
    base_low_hz: float = 0.7
    base_high_hz: float = 4.0
    target_fs: float = 30.0
    max_step_bpm: float = 12.0
    saturation_threshold: float = 0.25


def bandpass(sig: np.ndarray, fs: float, low_hz: float, high_hz: float, order: int = 4) -> np.ndarray:
    """Apply Butterworth bandpass filter."""
    # filtfilt requires len(sig) > padlen (3 * max(len(a), len(b)) i.e. 3*(2*order+1))
    min_len = 3 * (2 * order + 1) + 1  # 28 for order=4
    if len(sig) < min_len:
        # Signal too short to filter safely — return zero-mean signal as-is
        return sig - np.mean(sig)
    b, a = butter(order, [low_hz / (fs / 2), high_hz / (fs / 2)], btype="band")
    return filtfilt(b, a, sig)


def detrend_ma(sig: np.ndarray, fs: float, win_sec: float = 1.2) -> np.ndarray:
    """Remove slow baseline drift using moving average subtraction."""
    win = max(3, int(fs * win_sec))
    win += 1 - (win % 2)  # Ensure odd window size
    if win >= len(sig):
        return sig - np.mean(sig)
    ma = np.convolve(sig, np.ones(win) / win, mode="same")
    return sig - ma


def hampel(x: np.ndarray, k: int = 9, nsig: float = 3.0) -> np.ndarray:
    """Hampel filter for removing impulsive artifacts."""
    x = x.astype(float).copy()
    n = len(x)
    for i in range(n):
        j0, j1 = max(0, i - k), min(n, i + k + 1)
        med = np.median(x[j0:j1])
        mad = np.median(np.abs(x[j0:j1] - med)) + 1e-9
        if abs(x[i] - med) > nsig * 1.4826 * mad:
            x[i] = med
    return x


def resample_even(y: np.ndarray, t: np.ndarray, fs_target: float) -> Tuple[np.ndarray, np.ndarray, float]:
    """Resample signal to fixed sampling rate."""
    t0, t1 = float(t[0]), float(t[-1])
    if t1 <= t0:
        return y, t, 1.0 / np.median(np.diff(t))
    t_even = np.arange(t0, t1, 1.0 / fs_target)
    y_even = np.interp(t_even, t, y)
    return y_even, t_even, fs_target


def extract_ppg_signal(video_path: str, cfg: PPGConfig = PPGConfig()) -> Tuple[np.ndarray, np.ndarray, float]:
    """
    Extract PPG signal from fingertip video.
    
    Returns:
        filt: Filtered PPG signal
        bright_arr: Brightness array for confidence estimation
        fs: Sampling frequency
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError("Could not open video")

    red_trace: List[float] = []
    green_trace: List[float] = []
    sat_list: List[float] = []
    bright_list: List[float] = []
    time_list: List[float] = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        ts_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
        time_list.append(ts_ms / 1000.0 if ts_ms and ts_ms > 0 else (len(time_list) / max(1.0, cap.get(cv2.CAP_PROP_FPS) or 30.0)))

        red = frame[:, :, 2].astype(np.float64)
        green = frame[:, :, 1].astype(np.float64)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        sat = float(np.mean(gray >= 250))
        mean_v = float(np.mean(gray))
        sat_list.append(sat)
        bright_list.append(mean_v)

        red_trace.append(float(np.mean(red)))
        green_trace.append(float(np.mean(green)))

    cap.release()

    # Need enough frames to survive resampling + windowing.
    # At 30 fps, 12-sec window = 360 samples. We require at least ~5 seconds of usable video.
    min_frames = 30  # absolute minimum to extract any signal
    if len(red_trace) < min_frames:
        raise RuntimeError(
            f"Video too short: got {len(red_trace)} frames, need at least {min_frames}. "
            f"Please record for the full {12} seconds with your finger covering the camera."
        )

    red_trace = np.asarray(red_trace, dtype=np.float64)
    green_trace = np.asarray(green_trace, dtype=np.float64)
    t = np.asarray(time_list, dtype=np.float64)

    # Resample to fixed rate
    red_trace, t_even, fs = resample_even(red_trace, t, fs_target=cfg.target_fs)
    green_trace = np.interp(t_even, t, green_trace)
    sat_arr = np.interp(t_even, t, np.asarray(sat_list, dtype=np.float64))
    bright_arr = np.interp(t_even, t, np.asarray(bright_list, dtype=np.float64))

    # Fix heavy saturation by interpolation
    bad = sat_arr > cfg.saturation_threshold
    if np.any(bad) and np.any(~bad):
        idx = np.arange(len(red_trace))
        red_trace[bad] = np.interp(idx[bad], idx[~bad], red_trace[~bad])
        green_trace[bad] = np.interp(idx[bad], idx[~bad], green_trace[~bad])

    # Red-green blend based on saturation
    mix = 0.85 if float(np.mean(sat_arr)) < 0.05 else 0.70
    ppg = mix * red_trace + (1.0 - mix) * green_trace

    # Remove impulsive artifacts
    ppg = hampel(ppg, k=9, nsig=3.0)

    # Detrend and bandpass filter
    detr = detrend_ma(ppg, fs=fs, win_sec=1.2)
    filt = bandpass(detr, fs=fs, low_hz=cfg.base_low_hz, high_hz=cfg.base_high_hz, order=4)

    return filt, bright_arr, fs
