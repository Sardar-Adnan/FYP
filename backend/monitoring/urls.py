from django.urls import path
from .views import upload_fingertip_video, predict_health

urlpatterns = [
    path("api/ppg/fingertip", upload_fingertip_video),
    path("api/predict/health", predict_health),
]

