"""
FastAPI Application Entry Point for Attendance Email Notification System.
Operates exclusively on MongoDB Atlas.
"""
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

_APP_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _APP_DIR.parent
_ROOT_DIR = _BACKEND_DIR.parent
for _p in [str(_APP_DIR), str(_BACKEND_DIR), str(_ROOT_DIR)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from backend.database import client
from backend.app.attendance import router as attendance_router
from backend.app.absence_scheduler import start_scheduler, scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background absence scheduler
    start_scheduler()
    yield
    # Gracefully shut down scheduler
    if scheduler.running:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="Employee Attendance Monitoring System",
    description="Attendance Email Notification System with duplicate protection & absence scheduler (MongoDB Atlas)",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(attendance_router)


@app.get("/health", tags=["System"])
def health():
    db_ok = False
    if client:
        try:
            client.admin.command("ping")
            db_ok = True
        except Exception:
            pass
    return {"status": "ok", "database": "mongodb_atlas", "connected": db_ok}
