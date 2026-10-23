# Attendance Monitoring System — Smart Approval Process

> AI-powered face recognition attendance system with 68-point landmark alignment, duplicate detection, and smart approval workflow.

## Deployment

- **Frontend:** Vercel (React + Vite)
- **Backend:** Render (FastAPI + Uvicorn)
- **Database:** MongoDB Atlas

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the complete step-by-step guide,
environment variables, CORS setup, and troubleshooting.

## Architecture

```
Employee Registration → Face Capture → SSD MobileNet V1 → 68 Landmarks → Face Embedding → MongoDB
Attendance Verification → Face Match → Smart Approval → Result UI
```

## Project Structure

```
attendance-monitoring-system/
├── backend/
│   ├── main.py                    ← FastAPI app entry point
│   ├── config.py                  ← Environment / CORS configuration
│   ├── database.py                ← MongoDB Atlas connection + seeding
│   ├── models/                    ← Pydantic request/response models
│   ├── routes/                    ← Auth, admin, manager, employee, reports APIs
│   ├── services/                  ← Face detection, embeddings, geofence, smart hours
│   └── app/                       ← Scheduler, email service, legacy compatibility
├── frontend/
│   ├── src/                       ← React + TypeScript application
│   ├── package.json
│   ├── vite.config.ts             ← Dev proxy: /api → 127.0.0.1:8000
│   └── vercel.json                ← SPA rewrite for frontend-root deployments
├── models/                        ← Face detection / landmark model files
├── requirements.txt               ← Python dependencies
├── build.sh                       ← Render build (pre-built dlib wheel)
├── render.yaml                    ← Render Blueprint
├── vercel.json                    ← Vercel build config (repo-root deployment)
├── DEPLOYMENT.md                  ← Vercel + Render deployment guide
├── .env.example                   ← Backend environment template
└── README.md
```

## Quick Start

### 1. Create Virtual Environment
```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
# source .venv/bin/activate
```

### 2. Install Backend Dependencies
```bash
pip install -r requirements.txt
pip install "face-recognition==1.3.0" --no-deps
```

> `dlib-bin` provides a pre-built wheel. On Windows/Linux, this avoids
> compiling dlib from source. See `build.sh` for the Render equivalent.

### 3. Configure Environment
Copy `.env.example` to `.env` and fill in your MongoDB Atlas and SMTP values:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
DATABASE_NAME=attendance-monitoring-system
```

MongoDB Atlas creates the database and collections on first write. Default
office/shift settings are seeded automatically.

### 4. Start the Backend
```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

- **API:** http://127.0.0.1:8000
- **API Docs:** http://127.0.0.1:8000/docs
- **Health:** http://127.0.0.1:8000/health

### 5. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**. The Vite dev server proxies `/api` to the
backend, so no frontend API URL is needed locally.

Or run both with the Windows launcher:

```bat
run_app.bat
```

## API Endpoints

Interactive OpenAPI documentation is available at `/docs`.

Main route prefixes:

| Prefix | Purpose |
|--------|---------|
| `/api/auth` | Login, registration, OTP password reset, profile |
| `/api/admin` | Employees, managers, attendance overrides, settings, audits |
| `/api/manager` | Team dashboard, employees, leave approvals |
| `/api/employee` | Dashboard, attendance marking/history, leaves, smart hours |
| `/api/reports` | Filtered attendance reports and analytics |
| `/health` | Render health check |
| `/docs` | Swagger UI |

The `/docs` page is always the authoritative, up-to-date endpoint list.

## Smart Approval Logic

| Condition | Result |
|-----------|--------|
| High confidence (≥80%) + On time | ✅ Auto-Approved |
| Confidence ≥65% (any time) | ⏳ Pending (Manager Review) |
| Low confidence (<65%) | ❌ Rejected |

## Face Processing Pipeline

```
Camera Image
     ↓
SSD MobileNet V1 (Face Detection)
     ↓
68-Point Landmark Detection (Alignment)
     ↓
Face Recognition Network (128-d Embedding)
     ↓
Cosine / Euclidean Distance Comparison
     ↓
Match / No Match
```

## Security Notes

- Employee ID alone never grants attendance — face verification is always required
- Face embeddings are stored, **not** raw images
- Duplicate attendance is blocked at database level (unique index)
- Manager approval endpoints should be protected by role-based auth in production
- Add liveness detection (anti-spoofing) before production deployment
- Protect `.env` — never commit to version control

## MongoDB Collections

**employees**
```json
{
  "employee_id": "EMP001",
  "name": "Dinesh",
  "face_embedding": [0.023, -0.124, ...],
  "created_at": "2026-10-10"
}
```

**attendance**
```json
{
  "employee_id": "EMP001",
  "name": "Dinesh",
  "date": "2026-10-10",
  "time": "09:12:45",
  "status": "Present",
  "approval_status": "Pending",
  "confidence": 0.923,
  "late": false
}
```

**approval_requests**
```json
{
  "attendance_id": "...",
  "employee_id": "EMP001",
  "status": "Pending",
  "approved_by": null,
  "reason": null
}
```
# Attendance-monitoring-systemFinall
