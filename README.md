# OldCare - Comprehensive Suite

This repository contains the complete codebase for the OldCare Final Year Project, including the mobile application, backend server, and infrastructure configuration.

## Project Structure

- **`mobile-app/`**: React Native / Expo application for elderly and caregiver users.
- **`backend/`**: Django REST Framework server for processing PPG signals, managing users, and health predictions.
- **`docker-compose.yml`**: Docker configuration for running supporting infrastructure (like n8n).

## Getting Started

### 1. Mobile App
```bash
cd mobile-app
npm install
npx expo start
```

### 2. Backend
```bash
cd backend
pip install -r requirements.txt # Coming soon
python manage.py runserver
```

### 3. Infrastructure (n8n)
```bash
docker-compose up -d
```

## Contributing
Please refer to the documentation in each subdirectory for specific setup instructions.
