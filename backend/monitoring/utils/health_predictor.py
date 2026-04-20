# health_predictor.py
"""
Health prediction using the trained XGBoost model.
Predicts cardiovascular disease risk based on user profile and vital signs.
"""

import os
import joblib
import numpy as np
from typing import Dict, Any, Optional

# Model paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "ml_models", "health_model.pkl")

# Default values for missing profile data (population averages)
DEFAULT_HEIGHT = 165  # cm
DEFAULT_WEIGHT = 70   # kg
DEFAULT_GENDER = 1    # 1=male, 2=female (model encoding)

# Lazy load the model
_model = None


def get_model():
    """Load the health prediction model (lazy loading)."""
    global _model
    if _model is None:
        if os.path.exists(MODEL_PATH):
            _model = joblib.load(MODEL_PATH)
            print(f"[HealthPredictor] Loaded model from {MODEL_PATH}")
        else:
            print(f"[HealthPredictor] WARNING: Model not found at {MODEL_PATH}")
    return _model


def predict_health_risk(
    user_profile: Dict[str, Any],
    current_vitals: Dict[str, Any],
    vitals_history: Optional[list] = None
) -> Dict[str, Any]:
    """
    Predict cardiovascular health risk.
    
    Args:
        user_profile: Dict with keys: age, gender, height, weight
        current_vitals: Dict with keys: systolic, diastolic, heart_rate
        vitals_history: Optional list of past vitals readings
        
    Returns:
        Dict with risk_score (0.0-1.0) and risk_label (low/moderate/high)
    """
    model = get_model()
    
    if model is None:
        # Fallback if model is not loaded
        return _rule_based_prediction(current_vitals)
    
    # Extract and encode features
    # Model expects: ['age', 'gender', 'height', 'weight', 'ap_hi', 'ap_lo']
    age = user_profile.get('age') or 65  # Default age if missing
    
    # Gender encoding: model trained with 1=male, 2=female
    gender_str = user_profile.get('gender', '')
    if gender_str == 'male':
        gender = 1
    elif gender_str == 'female':
        gender = 2
    else:
        gender = DEFAULT_GENDER
    
    height = user_profile.get('height') or DEFAULT_HEIGHT
    weight = user_profile.get('weight') or DEFAULT_WEIGHT
    ap_hi = current_vitals.get('systolic', 120)
    ap_lo = current_vitals.get('diastolic', 80)
    
    # Optional: smooth with historical averages
    if vitals_history and len(vitals_history) > 0:
        hist_sys = [v.get('systolic_bp', ap_hi) for v in vitals_history]
        hist_dia = [v.get('diastolic_bp', ap_lo) for v in vitals_history]
        # Use 70% current + 30% historical average
        ap_hi = 0.7 * ap_hi + 0.3 * np.mean(hist_sys)
        ap_lo = 0.7 * ap_lo + 0.3 * np.mean(hist_dia)
    
    # Create feature array
    features = np.array([[age, gender, height, weight, ap_hi, ap_lo]])
    
    try:
        # Get prediction probability
        if hasattr(model, 'predict_proba'):
            proba = model.predict_proba(features)[0]
            # Assuming binary classification: [P(healthy), P(at risk)]
            risk_score = float(proba[1]) if len(proba) > 1 else float(proba[0])
        else:
            # If no probability, use binary prediction
            pred = model.predict(features)[0]
            risk_score = 1.0 if pred == 1 else 0.0
        
        # Determine risk label from ML
        if risk_score >= 0.6:
            risk_label = "high"
        elif risk_score >= 0.3:
            risk_label = "moderate"
        else:
            risk_label = "low"
        
        # Apply clinical heart rate rules (ML model doesn't consider HR)
        heart_rate = current_vitals.get('heart_rate', 70)
        hr_warning = None
        
        # Extreme values → High risk
        if heart_rate < 40:
            # Severe bradycardia
            hr_warning = f"Dangerously low heart rate ({heart_rate} bpm)"
            risk_label = "high"
            risk_score = max(risk_score, 0.7)
        elif heart_rate > 120:
            # Significant tachycardia
            hr_warning = f"Dangerously high heart rate ({heart_rate} bpm)"
            risk_label = "high"
            risk_score = max(risk_score, 0.7)
        # Moderate concerns
        elif heart_rate < 50:
            # Bradycardia
            hr_warning = f"Low heart rate ({heart_rate} bpm)"
            if risk_label == "low":
                risk_label = "moderate"
                risk_score = max(risk_score, 0.35)
        elif heart_rate > 100:
            # Tachycardia
            hr_warning = f"High heart rate ({heart_rate} bpm)"
            if risk_label == "low":
                risk_label = "moderate"
                risk_score = max(risk_score, 0.35)
        elif heart_rate < 60:
            # Borderline slow
            hr_warning = f"Slightly low heart rate ({heart_rate} bpm)"
        
        result = {
            "risk_score": round(risk_score, 3),
            "risk_label": risk_label,
            "features_used": {
                "age": age,
                "gender": gender_str or "unknown",
                "height": height,
                "weight": weight,
                "systolic": round(ap_hi, 1),
                "diastolic": round(ap_lo, 1),
                "heart_rate": heart_rate,
            }
        }
        
        if hr_warning:
            result["hr_warning"] = hr_warning
        
        return result
        
    except Exception as e:
        print(f"[HealthPredictor] Model prediction error: {e}")
        return _rule_based_prediction(current_vitals)


def _rule_based_prediction(vitals: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fallback rule-based prediction if ML model is unavailable.
    Based on blood pressure classification guidelines.
    """
    systolic = vitals.get('systolic', 120)
    diastolic = vitals.get('diastolic', 80)
    
    # Simple BP-based risk assessment
    if systolic >= 140 or diastolic >= 90:
        risk_label = "high"
        risk_score = 0.75
    elif systolic >= 130 or diastolic >= 85:
        risk_label = "moderate"
        risk_score = 0.45
    elif systolic >= 120 or diastolic >= 80:
        risk_label = "moderate"
        risk_score = 0.35
    else:
        risk_label = "low"
        risk_score = 0.15
    
    return {
        "risk_score": risk_score,
        "risk_label": risk_label,
        "method": "rule_based"
    }
