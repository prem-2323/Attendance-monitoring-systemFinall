"""
Attendance Check-in and Inspection Endpoints.
Operates exclusively with MongoDB Atlas collections.
"""
import sys
from pathlib import Path
from datetime import datetime
from typing import Union, List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

_APP_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _APP_DIR.parent
_ROOT_DIR = _BACKEND_DIR.parent
for _p in [str(_APP_DIR), str(_BACKEND_DIR), str(_ROOT_DIR)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from backend.database import (
    users_collection,
    employees_collection,
    attendance_collection,
    email_notifications_collection,
)
from backend.app.email_service import queue_attendance_emails, process_pending_emails
from backend.services.timezone import india_now, india_timestamp, format_time_to_india_12h

router = APIRouter(prefix="/attendance", tags=["Attendance"])
class CheckInRequest(BaseModel):
    employee_id: Union[int, str] = Field(..., description="Employee ID or Code to check in")


def _clean_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    d = dict(doc)
    if "_id" in d:
        d["_id"] = str(d["_id"])
    if "checkIn" in d and d["checkIn"]:
        d["checkIn"] = format_time_to_india_12h(str(d["checkIn"]))
    if "checkOut" in d and d["checkOut"]:
        d["checkOut"] = format_time_to_india_12h(str(d["checkOut"]))
    if "time" in d and d["time"]:
        d["time"] = format_time_to_india_12h(str(d["time"]))
    return d


@router.post("/check-in", summary="Record employee check-in and queue notifications in MongoDB Atlas")
def check_in(payload: CheckInRequest):
    """
    Check in an active employee using MongoDB Atlas.
    - Idempotent: rejects duplicate check-ins on the same day.
    - Late check-in: if previously marked absent, updates to present.
    - Triggers notifications to Employee, Manager, and Admin via MongoDB Atlas queue.
    """
    if users_collection is None or attendance_collection is None:
        raise HTTPException(status_code=503, detail="MongoDB Atlas database connection unavailable")

    target_id_str = str(payload.employee_id).strip()

    # 1. Lookup active employee in MongoDB Atlas (users_collection or employees_collection)
    employee = users_collection.find_one({
        "$or": [
            {"employeeId": target_id_str},
            {"employee_id": target_id_str},
            {"id": target_id_str},
            {"email": target_id_str},
        ],
        "active": {"$ne": False},
    })

    if not employee and employees_collection is not None:
        employee = employees_collection.find_one({
            "$or": [
                {"employee_id": target_id_str},
                {"employeeId": target_id_str},
            ]
        })

    if not employee:
        raise HTTPException(status_code=404, detail="Active employee not found")

    emp_id = str(employee.get("employeeId") or employee.get("employee_id") or target_id_str)
    emp_name = str(employee.get("name") or employee.get("full_name") or "Employee")

    now = india_now()
    today_str = now.date().isoformat()

    # 2. Check for existing attendance record for today in MongoDB Atlas
    existing = attendance_collection.find_one({
        "$or": [
            {"employeeId": emp_id},
            {"employee_id": emp_id},
            {"employeeId": target_id_str},
            {"employee_id": target_id_str},
        ],
        "date": today_str,
    })

    if existing:
        current_status = str(existing.get("status", "")).lower()

        # Late check-in: if marked absent earlier, update record to present
        if current_status == "absent":
            attendance_collection.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "status": "present",
                        "check_in": now.isoformat(),
                        "checkIn": now.strftime("%I:%M %p"),
                        "updated_at": india_timestamp(now),
                    }
                },
            )

            queue_attendance_emails(
                employee=employee,
                status="present",
                attendance_date=now.date(),
                check_in=now,
            )
            process_pending_emails()

            return {
                "message": "Late check-in recorded; attendance updated",
                "employee_id": payload.employee_id,
                "date": today_str,
                "status": "present",
                "check_in": now.isoformat(),
            }

        return {
            "message": "Attendance already recorded",
            "employee_id": payload.employee_id,
            "date": today_str,
            "status": existing.get("status", "present"),
        }

    # 3. Create new attendance record in MongoDB Atlas
    att_doc = {
        "employeeId": emp_id,
        "employee_id": emp_id,
        "employeeName": emp_name,
        "name": emp_name,
        "department": employee.get("department", "General"),
        "date": today_str,
        "status": "present",
        "checkIn": now.strftime("%I:%M %p"),
        "check_in": now.isoformat(),
        "verifiedBy": "Check-In API",
        "created_at": india_timestamp(now),
    }

    attendance_collection.insert_one(att_doc)

    # 4. Queue and process notifications in MongoDB Atlas
    queue_attendance_emails(
        employee=employee,
        status="present",
        attendance_date=now.date(),
        check_in=now,
    )
    process_pending_emails()

    return {
        "message": "Attendance recorded",
        "employee_id": payload.employee_id,
        "employee_name": emp_name,
        "date": today_str,
        "status": "present",
        "check_in": now.isoformat(),
    }


# ── Inspection Endpoints for Verification & Diagnostics ──────────────────────

@router.get("/notifications", summary="Inspect email notifications queue in MongoDB Atlas")
def list_email_notifications(status: Optional[str] = None, limit: int = 50):
    if email_notifications_collection is None:
        return []
    query = {"status": status} if status else {}
    records = list(
        email_notifications_collection.find(query).sort("created_at", -1).limit(limit)
    )
    return [_clean_doc(r) for r in records]


@router.get("/records", summary="List attendance records in MongoDB Atlas")
def list_attendance_records(date: Optional[str] = None, limit: int = 50):
    if attendance_collection is None:
        return []
    query = {"date": date} if date else {}
    records = list(
        attendance_collection.find(query).sort("created_at", -1).limit(limit)
    )
    return [_clean_doc(r) for r in records]


@router.get("/employees", summary="List configured employees in MongoDB Atlas")
def list_employees():
    if users_collection is None:
        return []
    records = list(users_collection.find({}, {"password": 0, "password_hash": 0}).limit(100))
    return [_clean_doc(r) for r in records]


@router.post("/process-emails", summary="Process queued email deliveries")
def trigger_process_emails(retry_failed: bool = Query(
    False,
    description="Reset failed notifications so they can be retried after SMTP settings are fixed",
)):
    if email_notifications_collection is None:
        raise HTTPException(status_code=503, detail="Email notification database is unavailable.")
    if retry_failed:
        email_notifications_collection.update_many(
            {"status": "failed"},
            {"$set": {"status": "pending", "attempts": 0, "last_error": None}},
        )
    result = process_pending_emails()
    return {
        "message": "Email queue processing finished.",
        "retryFailed": retry_failed,
        **result,
    }


@router.post("/check-absent", summary="Manually trigger scheduled absence checker in MongoDB Atlas")
def trigger_absence_check(force: bool = Query(False, description="Bypass cutoff time check")):
    from backend.app.absence_scheduler import mark_absent_employees
    mark_absent_employees(force=force)
    return {"message": "Absence check completed in MongoDB Atlas"}
