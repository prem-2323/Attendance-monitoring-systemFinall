"""
Clean database initialization script for Attendance Monitoring System.
Mock data removed — all user accounts and attendance records are registered dynamically.
"""
import sys
from pathlib import Path

_APP_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _APP_DIR.parent
_ROOT_DIR = _BACKEND_DIR.parent
for _p in [str(_APP_DIR), str(_BACKEND_DIR), str(_ROOT_DIR)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from backend.database import seed_initial_settings


def seed():
    """Seeds only default office geofence locations and global shift hours into MongoDB Atlas."""
    seed_initial_settings()
    print("[SEED] Clean system settings initialized. Mock user data removed.")


if __name__ == "__main__":
    seed()
