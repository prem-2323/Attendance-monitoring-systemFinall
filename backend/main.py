"""
Main FastAPI Application Entry Point.
Attendance Monitoring System — Smart Approval Based Face Attendance.
"""
import logging
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Ensure project root directory is in sys.path
_ROOT_DIR = Path(__file__).resolve().parent.parent
_BACKEND_DIR = Path(__file__).resolve().parent
for _p in [str(_ROOT_DIR), str(_BACKEND_DIR)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from contextlib import asynccontextmanager
from backend.config import (
    API_TITLE,
    API_DESCRIPTION,
    API_VERSION,
    CORS_ORIGINS,
    CORS_ORIGIN_REGEX,
    ENVIRONMENT,
)
from backend.routes import employee as employee_router
from backend.routes import attendance as attendance_router
from backend.routes import auth as auth_router
from backend.routes import admin as admin_router
from backend.routes import employee_portal as employee_portal_router
from backend.routes import manager as manager_router
from backend.routes import reports as reports_router
from backend.app.attendance import router as app_attendance_router

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Lifespan for Background Absence Scheduler ─────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background absence checker
    try:
        from backend.app.absence_scheduler import start_scheduler, scheduler
        start_scheduler()
        logger.info("[Scheduler] Scheduled absence checker active (MongoDB Atlas).")
    except Exception as e:
        logger.warning(f"[AppInit] Note starting absence scheduler: {e}")
    yield
    try:
        from backend.app.absence_scheduler import scheduler
        if scheduler.running:
            scheduler.shutdown(wait=False)
            logger.info("[Scheduler] Scheduler shut down.")
    except Exception:
        pass

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title=API_TITLE,
    description=API_DESCRIPTION,
    version=API_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS — Vercel frontend + local development ────────────────────────────────
# The frontend uses localStorage (no cookies), so credentials are disabled.
# Production Vercel origins are accepted via CORS_ORIGINS / CORS_ORIGIN_REGEX.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router.router, prefix="/api/auth")
app.include_router(auth_router.router, prefix="/auth")
app.include_router(admin_router.router, prefix="/api/admin")
app.include_router(admin_router.router, prefix="/admin")
app.include_router(employee_portal_router.router, prefix="/api/employee")
app.include_router(employee_portal_router.router, prefix="/employee-portal")
app.include_router(manager_router.router, prefix="/api/manager")
app.include_router(manager_router.router, prefix="/manager")
app.include_router(reports_router.router, prefix="/api/reports")
app.include_router(reports_router.router, prefix="/reports")
app.include_router(employee_router.router)
app.include_router(attendance_router.router)
app.include_router(app_attendance_router)


# ── Root ──────────────────────────────────────────────────────────────────────
# The React frontend is deployed separately on Vercel, so the backend root is
# just a small service-discovery response (Render health checks use /health).
@app.get("/", include_in_schema=False)
async def root():
    return {
        "message": f"{API_TITLE} API Running",
        "version": API_VERSION,
        "docs": "/docs",
        "health": "/health",
    }

# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    from backend.database import client
    db_connected = False
    if client:
        try:
            client.admin.command("ping")
            db_connected = True
        except Exception:
            pass

    payload = {
        "status": "running" if db_connected else "degraded",
        "api": API_TITLE,
        "version": API_VERSION,
        "database_connected": db_connected,
    }
    # Render uses this endpoint as its health check. In production, report a
    # non-200 status if Atlas is unreachable so the instance is restarted.
    if not db_connected and ENVIRONMENT in ("production", "prod"):
        return JSONResponse(status_code=503, content=payload)
    return payload


@app.get("/api", tags=["System"])
async def api_info():
    return {
        "message": f"{API_TITLE} API Running",
        "version": API_VERSION,
        "docs": "/docs",
        "endpoints": {
            "authentication": "/api/auth",
            "admin_management": "/api/admin",
            "manager_portal": "/api/manager",
            "employee_portal": "/api/employee",
            "reports_analytics": "/api/reports",
            "biometric_attendance": "/attendance/verify",
            "face_registration": "/employee/register",
        },
    }

