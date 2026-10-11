"""
Main FastAPI Application Entry Point.
Attendance Monitoring System — Smart Approval Based Face Attendance.
"""
import logging
import sys
from pathlib import Path
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Ensure project root directory is in sys.path
_ROOT_DIR = Path(__file__).resolve().parent.parent
if str(_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(_ROOT_DIR))

from backend.config import API_TITLE, API_DESCRIPTION, API_VERSION
from backend.routes import employee as employee_router
from backend.routes import attendance as attendance_router
from backend.routes import auth as auth_router
from backend.routes import admin as admin_router
from backend.routes import employee_portal as employee_portal_router
from backend.routes import manager as manager_router
from backend.routes import reports as reports_router

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title=API_TITLE,
    description=API_DESCRIPTION,
    version=API_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS — allow frontend served on same host ─────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Restrict in production
    allow_credentials=True,
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

# ── Serve frontend static files ───────────────────────────────────────────────
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
css_dir = os.path.join(FRONTEND_DIR, "css")
js_dir = os.path.join(FRONTEND_DIR, "js")
dist_dir = os.path.join(FRONTEND_DIR, "dist")

if os.path.isdir(css_dir):
    app.mount("/static", StaticFiles(directory=css_dir), name="css")
if os.path.isdir(js_dir):
    app.mount("/js", StaticFiles(directory=js_dir), name="js")
if os.path.isdir(dist_dir):
    app.mount("/dist", StaticFiles(directory=dist_dir), name="dist")

index_file = os.path.join(FRONTEND_DIR, "index.html")
if os.path.isfile(index_file):
    @app.get("/", include_in_schema=False)
    async def serve_index():
        return FileResponse(index_file)

    @app.get("/{page}.html", include_in_schema=False)
    async def serve_page(page: str):
        path = os.path.join(FRONTEND_DIR, f"{page}.html")
        if os.path.isfile(path):
            return FileResponse(path)
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Page not found")

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
    return {
        "status": "running",
        "api": API_TITLE,
        "version": API_VERSION,
        "database_connected": db_connected,
    }


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

