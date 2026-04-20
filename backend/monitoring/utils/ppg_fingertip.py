# ppg_fingertip.py
"""
PPG Fingertip Video Processing Pipeline.

Orchestrates the extraction of heart rate and blood pressure estimates
from fingertip video recordings using modular signal processing components.
"""

from typing import Dict, Any

from .ppg_core import PPGConfig, extract_ppg_signal

# Re-export PPGConfig for backward compatibility
__all__ = ["estimate_bpm_from_fingertip_video", "PPGConfig"]
from .hr_estimation import estimate_heart_rate
from .bp_estimation import estimate_blood_pressure


def estimate_bpm_from_fingertip_video(
    video_path: str,
    cfg: PPGConfig = PPGConfig()
) -> Dict[str, Any]:
    """
    Process fingertip video to estimate heart rate and blood pressure.
    
    Args:
        video_path: Path to the fingertip video file
        cfg: PPG configuration parameters
        
    Returns:
        Dictionary containing:
        - times_sec: List of time points for BPM estimates
        - bpm_raw: Raw BPM estimates per window
        - bpm_smooth: Smoothed BPM estimates
        - confidence: Confidence scores per window
        - fs: Sampling frequency
        - window_sec: Window size in seconds
        - hop_sec: Hop size in seconds
        - systolic: Estimated systolic blood pressure
        - diastolic: Estimated diastolic blood pressure
        - heart_rate: Median heart rate in BPM
    """
    # Step 1: Extract and preprocess PPG signal from video
    filt, bright_arr, fs = extract_ppg_signal(video_path, cfg)
    
    # Step 2: Estimate heart rate
    hr_result = estimate_heart_rate(filt, bright_arr, fs, cfg)
    
    # Step 3: Estimate blood pressure using morphological features
    systolic, diastolic = estimate_blood_pressure(
        filt, 
        fs, 
        hr_result["heart_rate"]
    )
    
    # Step 4: Combine results
    return {
        "times_sec": hr_result["times_sec"],
        "bpm_raw": hr_result["bpm_raw"],
        "bpm_smooth": hr_result["bpm_smooth"],
        "confidence": hr_result["confidence"],
        "fs": fs,
        "window_sec": cfg.window_sec,
        "hop_sec": cfg.hop_sec,
        "systolic": systolic,
        "diastolic": diastolic,
        "heart_rate": hr_result["heart_rate"]
    }
