# views.py
import os
import json
import tempfile
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt

from .utils.ppg_fingertip import estimate_bpm_from_fingertip_video, PPGConfig
from .utils.health_predictor import predict_health_risk


@csrf_exempt
def upload_fingertip_video(request):
    """
    Process fingertip video to extract vitals and predict health risk.
    
    POST params:
    - video: The video file (multipart)
    - user_id: Optional user ID for fetching profile (for prediction)
    - age, gender, height, weight: Optional profile data for prediction
    """
    if request.method != "POST":
        print(f"[DEBUG] Method was {request.method}, not POST.")
        return HttpResponseBadRequest("POST only. Send a multipart form with a file field named video")

    file = request.FILES.get("video")
    if not file:
        print(f"[DEBUG] FILES keys: {request.FILES.keys()}")
        print(f"[DEBUG] POST keys: {request.POST.keys()}")
        return HttpResponseBadRequest("Missing file field video")

    # persist to a temp file so OpenCV can read it
    suffix = os.path.splitext(file.name)[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        for chunk in file.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        cfg = PPGConfig(
            window_sec=float(request.POST.get("window_sec", 12.0)),
            hop_sec=float(request.POST.get("hop_sec", 6.0)),
            min_bpm=float(request.POST.get("min_bpm", 40.0)),
            max_bpm=float(request.POST.get("max_bpm", 180.0)),
            target_fs=float(request.POST.get("target_fs", 30.0)),
        )
        result = estimate_bpm_from_fingertip_video(tmp_path, cfg)
        
        vitals = {
            "heart_rate": result.get("heart_rate", 0.0),
            "systolic": result.get("systolic", 0.0),
            "diastolic": result.get("diastolic", 0.0),
        }
        
        # Get user profile data for prediction (from request or defaults)
        user_profile = {
            "age": int(request.POST.get("age", 65)),
            "gender": request.POST.get("gender", ""),
            "height": int(request.POST.get("height", 0)) or None,
            "weight": int(request.POST.get("weight", 0)) or None,
        }
        
        # Predict health risk
        prediction = predict_health_risk(user_profile, vitals)
        
        response_data = {
            **vitals,
            "health_risk": prediction.get("risk_score"),
            "risk_label": prediction.get("risk_label"),
        }
        
        return JsonResponse({"ok": True, "result": response_data})
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


@csrf_exempt
def predict_health(request):
    """
    Standalone health prediction endpoint.
    
    POST JSON body:
    {
        "user_profile": {"age": 65, "gender": "male", "height": 170, "weight": 75},
        "vitals": {"systolic": 130, "diastolic": 85, "heart_rate": 72}
    }
    """
    if request.method != "POST":
        return HttpResponseBadRequest("POST only with JSON body")
    
    try:
        data = json.loads(request.body)
        user_profile = data.get("user_profile", {})
        vitals = data.get("vitals", {})
        
        if not vitals.get("systolic") or not vitals.get("diastolic"):
            return JsonResponse({"ok": False, "error": "Missing vitals data"}, status=400)
        
        prediction = predict_health_risk(user_profile, vitals)
        
        return JsonResponse({"ok": True, "prediction": prediction})
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)

