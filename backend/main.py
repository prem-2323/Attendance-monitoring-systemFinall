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

# ── Legacy Route Rewrite Middleware ──────────────────────────────────────────
# Gracefully forwards legacy un-prefixed requests (/users, /settings, /leave/*, etc.)
# to their canonical /api/* routes to avoid 404s from older or cached frontends.
def _resolve_legacy_route(path: str):
    # Auth endpoints
    if path == "/users":
        return "/api/auth/users"
    if path == "/login":
        return "/api/auth/login"
    if path == "/auto-login" or path.startswith("/auto-login/"):
        return f"/api/auth{path}"
    if path.startswith("/register/"):
        return f"/api/auth{path}"
    if path.startswith("/forgot-password/"):
        return f"/api/auth{path}"
    if path == "/profile":
        return "/api/auth/profile"


    # Admin endpoints
    if path == "/audits":
        return "/api/admin/audits"
    if path == "/settings" or path.startswith("/settings/"):
        return f"/api/admin{path}"
    if path == "/dashboard/stats":
        return "/api/admin/dashboard/stats"
    if path == "/attendance/override":
        return "/api/admin/attendance/override"
    if path == "/reset":
        return "/api/admin/reset"
    if path == "/employees" or path.startswith("/employees/"):
        return f"/api/admin{path}"

    # Leave & Attendance endpoints
    if path == "/leave/review":
        return "/api/manager/leave/review"
    if path == "/leave/apply":
        return "/api/employee/leave/apply"
    if path.startswith("/leave/"):
        return f"/api/employee{path}"
    if path.startswith("/leaves/"):
        return f"/api/manager{path}"
    if path == "/face/detect":
        return "/api/employee/face/detect"
    if path == "/attendance/mark":
        return "/api/employee/attendance/mark"
    if path.startswith("/smart-hours/"):
        return f"/api/employee{path}"
    if path.startswith("/employee-history/"):
        return f"/api/manager{path}"

    # Reports
    if path == "/analytics" or path.startswith("/analytics/"):
        return f"/api/reports{path}"

    return None


class LegacyRouteRewriteMiddleware:
    """Pure ASGI middleware that rewrites un-prefixed legacy URL paths before routing."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if not path.startswith("/api/"):
                new_path = _resolve_legacy_route(path)
                if new_path:
                    scope["path"] = new_path
                    if "raw_path" in scope:
                        scope["raw_path"] = new_path.encode("ascii")
        await self.app(scope, receive, send)


app.add_middleware(LegacyRouteRewriteMiddleware)

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

# ── Direct Root-Level Compatibility Routes ────────────────────────────────────
# Registers unprefixed endpoints (/leave/{employee_id}, /users, /audits, /settings,
# /register/admin, etc.) directly on the router so they appear in app.routes
# and resolve natively without relying solely on ASGI rewriting.
from fastapi import APIRouter

root_compat = APIRouter(tags=["Root Compatibility"])

# Auth routes at root
root_compat.add_api_route("/register/admin", auth_router.register_admin, methods=["POST"], summary="Register admin (root alias)")
root_compat.add_api_route("/register/manager", auth_router.register_manager, methods=["POST"], summary="Register manager (root alias)")
root_compat.add_api_route("/register/employee", auth_router.register_employee, methods=["POST"], summary="Register employee (root alias)")
root_compat.add_api_route("/login", auth_router.login, methods=["POST"], summary="Login (root alias)")
root_compat.add_api_route("/auto-login", auth_router.auto_login, methods=["POST", "GET"], summary="Auto login (root alias)")
root_compat.add_api_route("/auto-login/{role}", auth_router.auto_login, methods=["POST", "GET"], summary="Auto login by role (root alias)")
root_compat.add_api_route("/forgot-password/request", auth_router.forgot_password_request, methods=["POST"], summary="Forgot password request (root alias)")

root_compat.add_api_route("/forgot-password/verify", auth_router.forgot_password_verify, methods=["POST"], summary="Forgot password verify (root alias)")
root_compat.add_api_route("/forgot-password/reset", auth_router.forgot_password_reset, methods=["POST"], summary="Forgot password reset (root alias)")
root_compat.add_api_route("/users", auth_router.get_all_users, methods=["GET"], summary="List users (root alias)")
root_compat.add_api_route("/managers", auth_router.get_managers, methods=["GET"], summary="List managers (root alias)")
root_compat.add_api_route("/profile", auth_router.update_profile, methods=["PUT"], summary="Update profile (root alias)")

# Admin routes at root
root_compat.add_api_route("/dashboard/stats", admin_router.get_dashboard_stats, methods=["GET"], summary="Dashboard stats (root alias)")
root_compat.add_api_route("/employees", admin_router.list_employees, methods=["GET"], summary="List employees (root alias)")
root_compat.add_api_route("/employees", admin_router.create_employee, methods=["POST"], summary="Add employee (root alias)")
root_compat.add_api_route("/employees/{identifier}", admin_router.delete_employee, methods=["DELETE"], summary="Delete employee (root alias)")
root_compat.add_api_route("/audits", admin_router.list_approval_audits, methods=["GET"], summary="List approval audits (root alias)")
root_compat.add_api_route("/settings", admin_router.get_settings, methods=["GET"], summary="Get settings (root alias)")
root_compat.add_api_route("/settings/office", admin_router.update_office_settings, methods=["PUT"], summary="Update office settings (root alias)")
root_compat.add_api_route("/settings/locations", admin_router.get_office_locations, methods=["GET"], summary="Get office locations (root alias)")
root_compat.add_api_route("/settings/locations", admin_router.update_office_locations, methods=["PUT"], summary="Update office locations (root alias)")
root_compat.add_api_route("/settings/smart-hours", admin_router.get_smart_hours_settings, methods=["GET"], summary="Get smart hours (root alias)")
root_compat.add_api_route("/settings/smart-hours", admin_router.update_smart_hours_settings, methods=["PUT"], summary="Update smart hours (root alias)")
root_compat.add_api_route("/attendance/override", admin_router.override_attendance, methods=["POST"], summary="Override attendance (root alias)")
root_compat.add_api_route("/reset", admin_router.reset_database, methods=["POST"], summary="Reset database (root alias)")

# Leave & Portal routes at root
root_compat.add_api_route("/leave/apply", employee_portal_router.apply_for_leave, methods=["POST"], summary="Apply for leave (root alias)")
root_compat.add_api_route("/leave/{employee_id}", employee_portal_router.get_employee_leave_requests, methods=["GET"], summary="Get leave requests (root alias)")
root_compat.add_api_route("/leaves/{manager_id}", manager_router.get_manager_team_leaves, methods=["GET"], summary="Get manager team leaves (root alias)")
root_compat.add_api_route("/leave/review", manager_router.review_leave_request, methods=["POST"], summary="Review leave (root alias)")
root_compat.add_api_route("/face/detect", employee_portal_router.detect_live_face, methods=["POST"], summary="Face detect (root alias)")
root_compat.add_api_route("/attendance/mark", employee_portal_router.mark_employee_attendance, methods=["POST"], summary="Mark attendance (root alias)")
root_compat.add_api_route("/smart-hours/{employee_id}", employee_portal_router.get_smart_hours_calculation, methods=["GET"], summary="Smart hours (root alias)")
root_compat.add_api_route("/employee-history/{employee_id}", manager_router.get_manager_employee_history, methods=["GET"], summary="Employee history (root alias)")

# Reports at root
root_compat.add_api_route("/analytics", reports_router.get_attendance_reports, methods=["GET"], summary="Attendance analytics (root alias)")

app.include_router(root_compat)


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

