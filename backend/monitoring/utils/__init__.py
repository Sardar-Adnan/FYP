# __init__.py
"""
PPG Signal Processing Utilities.

Modules:
- ppg_core: Video preprocessing and signal extraction
- hr_estimation: Heart rate estimation from PPG signals
- bp_estimation: Blood pressure estimation using morphological features
- ppg_fingertip: Main orchestrator for complete vital signs estimation
"""

from .ppg_fingertip import estimate_bpm_from_fingertip_video
from .ppg_core import PPGConfig

__all__ = [
    "estimate_bpm_from_fingertip_video",
    "PPGConfig",
]
