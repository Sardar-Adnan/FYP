# hr_estimation.py
"""
Heart Rate (BPM) estimation from PPG signals.
Uses both FFT and peak detection methods with confidence weighting.
"""

import numpy as np
from typing import Tuple, Dict, Any, List
from scipy.signal import welch, find_peaks, medfilt

from .ppg_core import PPGConfig, bandpass


def bpm_from_fft(sig: np.ndarray, fs: float, min_bpm: float, max_bpm: float) -> Tuple[float, float]:
    """Estimate BPM using FFT with parabolic interpolation."""
    f, pxx = welch(sig, fs=fs, nperseg=min(int(4 * fs), len(sig)))
    mask = (f >= min_bpm / 60.0) & (f <= max_bpm / 60.0)
    if not np.any(mask):
        return np.nan, 0.0
    f_band, p_band = f[mask], pxx[mask]
    i = int(np.argmax(p_band))
    if 0 < i < len(p_band) - 1:
        y0, y1, y2 = p_band[i - 1], p_band[i], p_band[i + 1]
        denom = (y0 - 2 * y1 + y2) + 1e-12
        delta = 0.5 * (y0 - y2) / denom
        f_peak = f_band[i] + delta * (f_band[1] - f_band[0])
    else:
        f_peak = f_band[i]
    bpm = 60.0 * f_peak
    snr = float(p_band[i] / (np.median(p_band) + 1e-12))
    return bpm, snr


def bpm_from_peaks(sig: np.ndarray, fs: float, min_bpm: float, max_bpm: float, snr: float = 2.0) -> float:
    """Estimate BPM from peak-to-peak intervals."""
    min_dist = int(fs * 60.0 / max_bpm)
    scale = np.median(np.abs(sig - np.median(sig))) + 1e-9
    prom = (0.5 if snr < 2.0 else 0.8) * scale
    peaks, _ = find_peaks(sig, distance=min_dist, prominence=prom)
    if len(peaks) < 2:
        return np.nan
    rr = np.diff(peaks) / fs
    rr = rr[(rr >= 60.0 / max_bpm) & (rr <= 60.0 / min_bpm)]
    if len(rr) == 0:
        return np.nan
    return 60.0 / np.mean(rr)


def smooth_bpm(series: np.ndarray, k: int = 5) -> np.ndarray:
    """Apply median filter to smooth BPM series."""
    if len(series) < k:
        return series.astype(float)
    return medfilt(series.astype(float), kernel_size=k)


def adaptive_band(sig: np.ndarray, fs: float, bpm_hint: float, width_bpm: float = 35.0) -> np.ndarray:
    """Apply adaptive bandpass filter centered around BPM hint."""
    low = max(30.0, bpm_hint - width_bpm) / 60.0
    high = min(200.0, bpm_hint + width_bpm) / 60.0
    return bandpass(sig, fs, low, high, order=4)


def gated_update(prev: float, new: float, conf: float, max_step_bpm: float) -> float:
    """Apply continuity gating to BPM updates."""
    if np.isnan(prev):
        return new
    if np.isnan(new):
        return prev
    step = new - prev
    limit = max_step_bpm if conf < 0.7 else max_step_bpm * 2.0
    if abs(step) > limit:
        return prev + np.sign(step) * limit
    return new


def estimate_heart_rate(
    filt: np.ndarray,
    bright_arr: np.ndarray,
    fs: float,
    cfg: PPGConfig = PPGConfig()
) -> Dict[str, Any]:
    """
    Estimate heart rate from filtered PPG signal.
    
    Args:
        filt: Filtered PPG signal from ppg_core.extract_ppg_signal()
        bright_arr: Brightness array for confidence estimation
        fs: Sampling frequency
        cfg: PPG configuration
        
    Returns:
        Dictionary with times, bpm_raw, bpm_smooth, confidence, and heart_rate
    """
    win = int(cfg.window_sec * fs)
    hop = int(cfg.hop_sec * fs)
    
    # Gracefully shrink window if signal is shorter than configured window
    if len(filt) < win:
        win = len(filt)
        hop = max(1, win // 2)  # Use half-window hop for short signals

    times: List[float] = []
    bpm_raw: List[float] = []
    conf: List[float] = []
    last_bpm = np.nan

    for start in range(0, len(filt) - win + 1, hop):
        seg = filt[start:start + win]
        seg = (seg - np.mean(seg)) / (np.std(seg) + 1e-9)
        
        if np.std(seg) < 1e-3:
            times.append((start + win / 2) / fs)
            bpm_raw.append(np.nan)
            conf.append(0.0)
            continue

        # Adaptive focus around the last BPM when available
        seg_proc = seg if np.isnan(last_bpm) else adaptive_band(seg, fs, bpm_hint=last_bpm, width_bpm=35.0)

        b_fft, snr = bpm_from_fft(seg_proc, fs, cfg.min_bpm, cfg.max_bpm)
        b_pk = bpm_from_peaks(seg_proc, fs, cfg.min_bpm, cfg.max_bpm, snr=snr)

        if np.isnan(b_pk) and np.isnan(b_fft):
            bpm = np.nan
            c = 0.0
        else:
            if np.isnan(b_pk):
                bpm = b_fft
            elif np.isnan(b_fft):
                bpm = b_pk
            else:
                w = max(0.0, min(1.0, (snr - 1.0) / 4.0))
                bpm = w * b_fft + (1.0 - w) * b_pk

            # Exposure/brightness jitter penalty
            br = bright_arr[max(0, start):start + win]
            br_jitter = np.std(br) / (np.mean(br) + 1e-9)
            light_score = 1.0 / (1.0 + 10.0 * br_jitter)
            c = float(np.clip(((snr - 1.0) / 4.0) * light_score, 0.0, 1.0))

            # Continuity gate
            bpm = gated_update(last_bpm, bpm, c, cfg.max_step_bpm)

        last_bpm = bpm if not np.isnan(bpm) else last_bpm
        times.append((start + win / 2) / fs)
        bpm_raw.append(bpm)
        conf.append(c)

    bpm_raw_arr = np.asarray(bpm_raw, dtype=float)
    conf_arr = np.asarray(conf, dtype=float)

    keep = conf_arr >= max(0.25, np.nanmedian(conf_arr) * 0.7)
    bpm_raw_arr[~keep] = np.nan
    bpm_smooth = bpm_raw_arr.copy()
    good = ~np.isnan(bpm_raw_arr)
    
    if np.any(good):
        bpm_smooth[good] = smooth_bpm(bpm_raw_arr[good], k=5)

    heart_rate = float(np.nanmedian(bpm_smooth)) if np.any(good) else 0.0

    return {
        "times_sec": np.asarray(times, dtype=float).tolist(),
        "bpm_raw": bpm_raw_arr.tolist(),
        "bpm_smooth": bpm_smooth.tolist(),
        "confidence": conf_arr.tolist(),
        "heart_rate": heart_rate
    }
