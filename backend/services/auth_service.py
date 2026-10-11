"""
Authentication and security helper services.
"""
import hashlib
import os
import random
from datetime import datetime, timedelta
from typing import Optional, Dict, Any


def hash_password(password: str, salt: Optional[str] = None) -> str:
    """Hash password using salted SHA-256."""
    if not salt:
        salt = os.urandom(16).hex()
    hashed = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
    return f"{salt}${hashed}"


def verify_password(plain_password: str, stored_hash: Optional[str]) -> bool:
    """Verify plain password against stored salted hash or plain fallback."""
    if not stored_hash:
        return False
    if "$" not in stored_hash:
        # Direct comparison fallback
        return stored_hash == plain_password
    try:
        salt, expected_hash = stored_hash.split("$", 1)
        actual_hash = hashlib.sha256((salt + plain_password).encode("utf-8")).hexdigest()
        return actual_hash == expected_hash
    except Exception:
        return False


def generate_otp() -> str:
    """Generate 4-digit numeric OTP code."""
    return f"{random.randint(1000, 9999)}"


def serialize_user(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Serialize MongoDB user document for frontend consumption."""
    user = dict(doc)
    user.pop("_id", None)
    user.pop("password_hash", None)
    
    # Ensure expected keys exist
    if "employeeId" not in user and "employee_id" in user:
        user["employeeId"] = user["employee_id"]
    if "id" not in user:
        user["id"] = user.get("employeeId", f"user-{os.urandom(4).hex()}")
    if "active" not in user:
        user["active"] = True
    if "joinDate" not in user:
        user["joinDate"] = user.get("created_at", "2026-10-10")
    if "faceRegistered" not in user:
        user["faceRegistered"] = False
        
    return user
