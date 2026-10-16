"""
MongoDB Atlas database connection and collection references.
Only MongoDB Atlas is used across the system.
"""
import sys
from pathlib import Path

_APP_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _APP_DIR.parent
_ROOT_DIR = _BACKEND_DIR.parent
for _p in [str(_APP_DIR), str(_BACKEND_DIR), str(_ROOT_DIR)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from backend.database import (
    client,
    db,
    users_collection,
    employees_collection,
    attendance_collection,
    approval_collection,
    email_notifications_collection,
    settings_collection,
)


def get_db():
    """Yield or return MongoDB database instance."""
    return db
