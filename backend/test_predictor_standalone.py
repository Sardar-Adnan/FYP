# test_predictor_standalone.py
"""Standalone test - imports health_predictor directly."""
import os
import sys

# Add paths
sys.path.insert(0, r"D:\Final Year Project\BE\OldCareBackEnd")
sys.path.insert(0, r"D:\Final Year Project\BE\OldCareBackEnd\monitoring\utils")

# Import directly from the file (not the package)
import importlib.util

spec = importlib.util.spec_from_file_location(
    "health_predictor", 
    r"D:\Final Year Project\BE\OldCareBackEnd\monitoring\utils\health_predictor.py"
)
hp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hp)

# Test data
user_profile = {'age': 65, 'gender': 'male', 'height': 170, 'weight': 75}
vitals = {'systolic': 130, 'diastolic': 85}

print("Testing health predictor...")
result = hp.predict_health_risk(user_profile, vitals)
print(f"Result: {result}")
