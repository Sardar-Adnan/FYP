# test_health_predictor.py
"""Quick test for the health predictor module."""
import os
import sys

# Add the Django project to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'OldCareBackEnd.settings')

from monitoring.utils.health_predictor import predict_health_risk

# Test with sample data
user_profile = {
    'age': 65,
    'gender': 'male',
    'height': 170,
    'weight': 75
}

vitals = {
    'systolic': 130,
    'diastolic': 85,
    'heart_rate': 72
}

print("Testing health predictor...")
result = predict_health_risk(user_profile, vitals)
print(f"Result: {result}")
