# bp_estimation.py
"""
Blood Pressure estimation using morphological PPG features.
Uses research-validated RT, FT, and Width extraction from individual pulses.
"""

import numpy as np
from typing import Tuple
from pathlib import Path
from scipy.signal import find_peaks


def extract_morph_features(sig: np.ndarray, fs: float) -> Tuple[float, float, float]:
    """
    Extract morphological features from PPG signal pulses.
    
    Segments the signal at valleys (pulse onsets) and calculates:
    - RT (Rising Time): Time from valley to peak
    - FT (Falling Time): Time from peak to next valley
    - Width: Pulse width at 50% amplitude
    
    Args:
        sig: Filtered PPG signal
        fs: Sampling frequency
        
    Returns:
        Tuple of (RT_median, FT_median, Width_median)
    """
    # Find valleys (pulse onsets) - invert signal to find minima
    # distance=0.35*fs supports up to ~170 BPM
    valleys, _ = find_peaks(-sig, distance=int(fs * 0.35))
    
    rt_list, ft_list, width_list = [], [], []
    
    for i in range(len(valleys) - 1):
        pulse = sig[valleys[i]:valleys[i + 1]]
        
        # Skip very short pulses (noise or artifacts)
        # Min 300ms pulse supports up to ~200 BPM
        if len(pulse) < int(fs * 0.3):
            continue
        
        peak_idx = np.argmax(pulse)
        
        # Rising Time (RT): valley to peak
        rt = peak_idx / fs
        
        # Falling Time (FT): peak to next valley
        ft = (len(pulse) - peak_idx) / fs
        
        # Pulse Width at 50% amplitude
        peak_val = pulse[peak_idx]
        half_max = peak_val * 0.5
        above_half = np.where(pulse >= half_max)[0]
        
        if len(above_half) >= 2:
            # Use first and last crossing points for robustness
            width = (above_half[-1] - above_half[0]) / fs
        else:
            width = 0
        
        rt_list.append(rt)
        ft_list.append(ft)
        width_list.append(width)
    
    # Return medians for robustness, or fallback to dataset medians
    if not rt_list:
        return 0.15, 0.35, 0.20
    
    return (
        float(np.median(rt_list)),
        float(np.median(ft_list)),
        float(np.median(width_list))
    )


def estimate_blood_pressure(
    filt: np.ndarray,
    fs: float,
    heart_rate: float
) -> Tuple[float, float]:
    """
    Estimate blood pressure using morphological features and trained ML model.
    
    Args:
        filt: Filtered PPG signal from ppg_core.extract_ppg_signal()
        fs: Sampling frequency
        heart_rate: Estimated heart rate in BPM
        
    Returns:
        Tuple of (systolic_bp, diastolic_bp)
    """
    try:
        import joblib
        
        # Model paths relative to this file
        # This file: monitoring/utils/bp_estimation.py
        # Models: monitoring/ml_models/
        base_dir = Path(__file__).resolve().parent.parent
        model_path = base_dir / "ml_models" / "bp_regressor.joblib"
        scaler_path = base_dir / "ml_models" / "bp_scaler.joblib"
        
        if not model_path.exists():
            print(f"Warning: BP model not found at {model_path}")
            return 0.0, 0.0
        
        if not scaler_path.exists():
            print(f"Warning: BP scaler not found at {scaler_path}")
            return 0.0, 0.0
        
        # Load model and scaler
        model = joblib.load(model_path)
        scaler = joblib.load(scaler_path)
        
        # Extract morphological features
        rt_med, ft_med, width_med = extract_morph_features(filt, fs)
        
        # Use provided heart rate or fallback
        hr_val = heart_rate if heart_rate > 0 else 75.0
        
        # Feature vector: [RT_med, FT_med, Width_med, HR]
        features = np.array([[rt_med, ft_med, width_med, hr_val]])
        
        # Apply feature weighting as per training pipeline
        # RT * 1.3, FT * 1.5, Width * 1.0, HR * 1.0
        features_weighted = features * np.array([1.3, 1.5, 1.0, 1.0])
        
        # Scale and predict
        features_scaled = scaler.transform(features_weighted)
        pred = model.predict(features_scaled)
        
        # Extract SBP and DBP from prediction
        if pred.ndim == 1:
            if len(pred) >= 2:
                return float(pred[0]), float(pred[1])
            else:
                return float(pred[0]), 80.0
        elif pred.ndim == 2:
            return float(pred[0][0]), float(pred[0][1])
        else:
            return 120.0, 80.0
            
    except Exception as e:
        print(f"BP estimation failed: {e}")
        return 0.0, 0.0
