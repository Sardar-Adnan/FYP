---
description: How to start the entire OldCareApp project (n8n + Django backend + Expo app)
---

# Start OldCareApp Project

## Prerequisites
- Docker Desktop installed and running
- Python virtual environment at `d:\Final Year Project\BE\env`
- Node.js and npm installed
- Android device connected via USB (for `expo run:android`)

## Step 1: Find your WiFi IP
```powershell
ipconfig | Select-String "Wi-Fi" -Context 0,5 | Select-String "IPv4"
```
Update `d:\Final Year Project\OldCareApp\constants\config.ts` with your IP for:
- `VitalsConfig.API_BASE_URL` → `http://<YOUR_IP>:8000`
- `EmergencyConfig.N8N_WEBHOOK_URL` → `http://<YOUR_IP>:5678/webhook/fall-emergency`

Also update `WEBHOOK_URL` in `docker-compose.yml` → `http://<YOUR_IP>:5678/`

## Step 2: Start Docker Desktop (if not running)
```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
# Wait ~30 seconds for it to initialize
```

// turbo
## Step 3: Start n8n container
```powershell
docker compose up -d
```

## Step 4: Start Django backend
```powershell
& "d:\Final Year Project\BE\env\Scripts\python.exe" "d:\Final Year Project\BE\OldCareBackEnd\manage.py" runserver 0.0.0.0:8000
```
This runs in the background. Verify with:
```powershell
Invoke-WebRequest -Uri "http://localhost:8000/api/ppg/fingertip" -UseBasicParsing
```
Should return "POST only" (400 status) — that means it's working.

## Step 5: Start Expo app on Android
```powershell
npx expo run:android
```

## URLs
| Service | URL |
|---------|-----|
| n8n Dashboard | http://localhost:5678 |
| Django Backend | http://localhost:8000 |
| n8n Webhook (fall) | http://<YOUR_IP>:5678/webhook/fall-emergency |

## Stopping
```powershell
# Stop n8n
docker compose down

# Django: Ctrl+C in the terminal running manage.py
```
