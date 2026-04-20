# test_ppg.py - Test script for ppg_fingertip.py
"""
This script tests the PPG analysis on a fingertip video.

Usage:
  1. With a real video:     python test_ppg.py path/to/your/video.mp4
  2. With synthetic video:  python test_ppg.py --synthetic
  
To record a real fingertip video:
  - Open your phone's camera
  - Turn on the flashlight
  - Place your fingertip gently over the camera lens
  - Record for 15-30 seconds
  - Transfer the video to this folder
"""

import sys
import os
import numpy as np

# Add the parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.ppg_fingertip import estimate_bpm_from_fingertip_video
from utils.ppg_core import PPGConfig


def create_synthetic_video(output_path: str, duration_sec: float = 15.0, fps: float = 30.0, heart_rate_bpm: float = 72.0):
    """
    Create a synthetic fingertip video with a simulated PPG signal.
    This is useful for testing the algorithm without a real video.
    """
    import cv2
    
    num_frames = int(duration_sec * fps)
    width, height = 320, 240
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    # Simulate PPG signal (heart rate creates color oscillations)
    heart_freq = heart_rate_bpm / 60.0  # Hz
    
    for i in range(num_frames):
        t = i / fps
        
        # Simulate PPG oscillation (sinusoidal for simplicity)
        # Real PPG has more complex waveform, but sine works for testing
        ppg_signal = np.sin(2 * np.pi * heart_freq * t)
        
        # Add some noise and breathing artifact (~0.25 Hz)
        breathing = 0.1 * np.sin(2 * np.pi * 0.25 * t)
        noise = 0.05 * np.random.randn()
        ppg_signal = ppg_signal + breathing + noise
        
        # Map PPG signal to red channel intensity (simulating blood volume changes)
        # Real fingertip videos have red values around 200-255 with ~1-5% modulation
        base_red = 220
        red_value = int(np.clip(base_red + 15 * ppg_signal, 180, 255))
        
        # Create a reddish frame (like a real fingertip covering camera)
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:, :, 2] = red_value          # Red channel (BGR format)
        frame[:, :, 1] = int(red_value * 0.3)  # Some green
        frame[:, :, 0] = int(red_value * 0.1)  # Little blue
        
        # Add slight spatial variation for realism
        noise_spatial = np.random.randint(-5, 5, (height, width), dtype=np.int16)
        frame[:, :, 2] = np.clip(frame[:, :, 2].astype(np.int16) + noise_spatial, 0, 255).astype(np.uint8)
        
        out.write(frame)
    
    out.release()
    print(f"✓ Created synthetic video: {output_path}")
    print(f"  Duration: {duration_sec}s, FPS: {fps}, Simulated HR: {heart_rate_bpm} BPM")
    return output_path


def test_ppg(video_path: str):
    """Run PPG analysis on the given video and print results."""
    print("\n" + "="*60)
    print("PPG Fingertip Analysis Test")
    print("="*60)
    print(f"Video: {video_path}")
    print("-"*60)
    
    try:
        # Run the analysis
        config = PPGConfig()
        result = estimate_bpm_from_fingertip_video(video_path, cfg=config)
        
        # Display results
        print("\n📊 RESULTS:")
        print("-"*40)
        print(f"  ❤️  Heart Rate:     {result['heart_rate']:.1f} BPM")
        print(f"  🩸 Systolic BP:    {result['systolic']:.0f} mmHg")
        print(f"  🩸 Diastolic BP:   {result['diastolic']:.0f} mmHg")
        print("-"*40)
        
        print(f"\n📈 Analysis Details:")
        print(f"  • Sampling Rate:   {result['fs']:.1f} Hz")
        print(f"  • Window Size:     {result['window_sec']}s")
        print(f"  • Hop Size:        {result['hop_sec']}s")
        print(f"  • Windows Analyzed: {len(result['times_sec'])}")
        
        # Show per-window results
        print(f"\n📉 Per-Window BPM (smoothed):")
        for i, (t, bpm, conf) in enumerate(zip(result['times_sec'], result['bpm_smooth'], result['confidence'])):
            conf_bar = "█" * int(conf * 10) + "░" * (10 - int(conf * 10))
            bpm_str = f"{bpm:.1f}" if not np.isnan(bpm) else "N/A"
            print(f"    t={t:5.1f}s | BPM: {bpm_str:>6} | Confidence: [{conf_bar}] {conf:.2f}")
        
        print("\n" + "="*60)
        print("✅ Test completed successfully!")
        print("="*60)
        
        return result
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        print("\nNo video path provided. Use --synthetic to create a test video.")
        sys.exit(1)
    
    arg = sys.argv[1]
    
    if arg == "--synthetic":
        # Create and test with synthetic video
        synthetic_path = os.path.join(os.path.dirname(__file__), "synthetic_fingertip.mp4")
        
        # Optional: specify heart rate for synthetic video
        hr = float(sys.argv[2]) if len(sys.argv) > 2 else 75.0
        
        create_synthetic_video(synthetic_path, duration_sec=20.0, fps=30.0, heart_rate_bpm=hr)
        test_ppg(synthetic_path)
    else:
        # Test with provided video
        if not os.path.exists(arg):
            print(f"❌ Error: Video file not found: {arg}")
            sys.exit(1)
        test_ppg(arg)
