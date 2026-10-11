"""
Admin API Routes for the Attendance Monitoring System.
Handles:
- Admin Dashboard Stats & Activity Stream
- Employee Management (List, Add, Delete)
- Manager Management (List, Add, Delete)
- Attendance Management (Today, Historical, Filter by Date/Status)
- Attendance Regularization Override (Updates attendance & writes approval audit)
- Managerial Approval Audit Logs (Listing audit trail)
- Geofence & Smart Hours Office Settings (Get & Update)
- Database Re-seed / Reset
"""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status

from backend.database import (
    users_collection,
    attendance_collection,
    approval_audits_collection,
    settings_collection,
    seed_initial_users,
    seed_initial_settings,
    seed_initial_attendance,
    seed_initial_audits,
)
from backend.models.admin import (
    AddEmployeeAdminRequest,
    AddManagerAdminRequest,
    AttendanceOverrideRequest,
    OfficeSettingsUpdateRequest,
    SmartHoursUpdateRequest,
)

logger = logging.getLogger("admin_routes")
router = APIRouter(tags=["Admin"])


def _clean_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Helper to sanitize MongoDB document for JSON responses."""
    if not doc:
        return {}
    cleaned = dict(doc)
    if "_id" in cleaned:
        cleaned["_id"] = str(cleaned["_id"])
    cleaned.pop("password_hash", None)
    return cleaned


# ── 1. Admin Dashboard Stats & Recent Activities ──────────────────────────────

@router.get("/dashboard/stats")
async def get_dashboard_stats():
    """
    Returns real-time executive dashboard metrics:
    - Total employees, Present, Late, On Leave, Absent
    - Attendance Percentage
    - Department Breakdown
    - Live chronological activity logs
    """
    try:
        # 1. Total employees
        emp_filter = {"role": "employee", "active": True}
        total_employees = users_collection.count_documents(emp_filter) if users_collection is not None else 0

        # 2. Today's date (defaults to system current date '2026-10-10' or actual today)
        today_str = datetime.now().strftime("%Y-%m-%d")
        
        # Check if we have records for today_str, else fallback to latest date available in attendance
        today_query = {"date": today_str}
        today_count = attendance_collection.count_documents(today_query) if attendance_collection is not None else 0
        if today_count == 0 and attendance_collection is not None:
            # Check latest available date
            latest = attendance_collection.find_one(sort=[("date", -1)])
            if latest and "date" in latest:
                today_str = latest["date"]
                today_query = {"date": today_str}

        today_records = list(attendance_collection.find(today_query)) if attendance_collection is not None else []

        present_count = 0
        late_count = 0
        on_leave_count = 0
        absent_count = 0

        for r in today_records:
            st = r.get("status")
            if st in ["Present", "Working"]:
                present_count += 1
            elif st == "Late":
                late_count += 1
            elif st == "On Leave":
                on_leave_count += 1
            elif st == "Absent":
                absent_count += 1

        # Any employee without a marked record is marked as Absent by default
        untracked = max(0, total_employees - (present_count + late_count + on_leave_count + absent_count))
        absent_count += untracked

        total_tracked = max(1, present_count + late_count + on_leave_count + absent_count)
        present_pct = round(((present_count + late_count) / total_tracked) * 100)

        # 3. Department breakdown
        dept_counts: Dict[str, int] = {}
        if users_collection is not None:
            pipeline = [
                {"$match": {"role": "employee"}},
                {"$group": {"_id": "$department", "count": {"$sum": 1}}}
            ]
            for item in users_collection.aggregate(pipeline):
                dept_counts[item["_id"] or "Unassigned"] = item["count"]

        # 4. Recent activities generated from latest attendance and audits
        recent_activities = []
        if attendance_collection is not None:
            latest_att = list(attendance_collection.find({}).sort([("date", -1), ("_id", -1)]).limit(6))
            for item in latest_att:
                emp_name = item.get("employeeName", "Staff")
                emp_id = item.get("employeeId", "")
                st = item.get("status", "Present")
                check_in = item.get("checkIn")
                check_out = item.get("checkOut")

                if check_out:
                    recent_activities.append({
                        "employee": f"{emp_name} ({emp_id})",
                        "activity": f"Check-out ({item.get('hoursWorked', 'logged')})",
                        "time": check_out,
                        "type": "checkout",
                        "tagColor": "text-slate-700 bg-slate-100 border-slate-200/80",
                    })
                elif check_in:
                    recent_activities.append({
                        "employee": f"{emp_name} ({emp_id})",
                        "activity": f"Check-in via {item.get('verifiedBy', 'Face + GPS')}",
                        "time": check_in,
                        "type": "checkin",
                        "tagColor": "text-emerald-700 bg-emerald-50 border-emerald-200/80" if st == "Present" else "text-amber-700 bg-amber-50 border-amber-200/80",
                    })

        # Append recent audit logs if any
        if approval_audits_collection is not None:
            latest_audits = list(approval_audits_collection.find({}).sort([("date", -1), ("_id", -1)]).limit(3))
            for a in latest_audits:
                recent_activities.append({
                    "employee": f"{a.get('employeeName')} ({a.get('employeeId')})",
                    "activity": f"{a.get('requestType')} {a.get('decision')} by {a.get('managerName')}",
                    "time": a.get("time", "Recently"),
                    "type": "leave",
                    "tagColor": "text-blue-700 bg-blue-50 border-blue-200/80" if a.get("decision") == "Approved" else "text-rose-700 bg-rose-50 border-rose-200/80",
                })

        return {
            "todayDate": today_str,
            "totalEmployeesCount": total_employees,
            "presentCount": present_count,
            "lateCount": late_count,
            "onLeaveCount": on_leave_count,
            "absentCount": absent_count,
            "presentPct": present_pct,
            "departmentBreakdown": dept_counts,
            "recentActivities": recent_activities[:6],
        }
    except Exception as e:
        logger.exception("Failed to get dashboard stats")
        raise HTTPException(status_code=500, detail=str(e))


# ── 2. Employee Management ────────────────────────────────────────────────────

@router.get("/employees")
async def list_employees():
    """Returns all active employees from MongoDB Atlas."""
    try:
        if users_collection is None:
            return []
        cursor = users_collection.find({"role": "employee"}).sort("employeeId", 1)
        return [_clean_doc(u) for u in cursor]
    except Exception as e:
        logger.exception("Failed to list employees")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/employees", status_code=status.HTTP_201_CREATED)
async def create_employee(payload: AddEmployeeAdminRequest):
    """
    Registers a new employee into MongoDB Atlas with biometrics and corporate details.
    """
    try:
        if users_collection is None:
            raise HTTPException(status_code=503, detail="Database connection unavailable")

        # Check existing employee ID or email
        existing_emp = users_collection.find_one({
            "$or": [
                {"employeeId": payload.employeeId.strip()},
                {"email": payload.email.strip().lower()},
            ]
        })
        if existing_emp:
            raise HTTPException(
                status_code=400,
                detail=f"An employee with ID '{payload.employeeId}' or email '{payload.email}' already exists.",
            )

        new_id = f"user-emp-{int(datetime.now().timestamp() * 1000) % 1000000}"
        from backend.services.auth_service import hash_password
        default_pw = hash_password("password123")

        new_doc = {
            "id": new_id,
            "name": payload.name.strip(),
            "employeeId": payload.employeeId.strip(),
            "email": payload.email.strip().lower(),
            "phone": payload.phone or "+91 ",
            "department": payload.department or "Engineering",
            "managerName": payload.managerName or "Kumar Verma",
            "role": payload.role or "employee",
            "avatarUrl": payload.avatarUrl or "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80",
            "faceRegistered": payload.faceRegistered or False,
            "faceVector": payload.faceVector or (f"face_vec_{int(datetime.now().timestamp())}_128d" if payload.faceRegistered else None),
            "joinDate": datetime.now().strftime("%Y-%m-%d"),
            "active": True,
            "title": f"Staff {payload.department}",
            "password_hash": default_pw,
        }

        users_collection.insert_one(new_doc)

        # Also initialize an Absent record for today in attendance collection
        if attendance_collection is not None:
            today_str = datetime.now().strftime("%Y-%m-%d")
            existing_today = attendance_collection.find_one({
                "employeeId": payload.employeeId.strip(),
                "date": today_str,
            })
            if not existing_today:
                attendance_collection.insert_one({
                    "id": f"att-today-{int(datetime.now().timestamp() * 1000)}",
                    "employee_id": payload.employeeId.strip(),
                    "employeeId": payload.employeeId.strip(),
                    "employeeName": payload.name.strip(),
                    "department": payload.department or "Engineering",
                    "date": today_str,
                    "status": "Absent",
                    "verifiedBy": "Face + GPS",
                    "locationName": "Pending Check-in",
                    "distanceMeters": 0,
                    "withinRadius": False,
                    "livenessVerified": False,
                    "managerName": payload.managerName,
                })

        return _clean_doc(new_doc)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to create employee")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/employees/{identifier}")
async def delete_employee(identifier: str):
    """Deletes an employee from MongoDB Atlas by id or employeeId."""
    try:
        if users_collection is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        result = users_collection.delete_one({
            "$or": [{"id": identifier}, {"employeeId": identifier}],
            "role": "employee",
        })
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Employee not found")

        # Also remove today's attendance record
        if attendance_collection is not None:
            attendance_collection.delete_many({"employeeId": identifier})

        return {"success": True, "message": f"Employee '{identifier}' removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete employee")
        raise HTTPException(status_code=500, detail=str(e))


# ── 3. Manager Management ─────────────────────────────────────────────────────

@router.get("/managers")
async def list_managers():
    """Returns all department heads and managers from MongoDB Atlas."""
    try:
        if users_collection is None:
            return []
        cursor = users_collection.find({"role": "manager"}).sort("employeeId", 1)
        return [_clean_doc(u) for u in cursor]
    except Exception as e:
        logger.exception("Failed to list managers")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/managers", status_code=status.HTTP_201_CREATED)
async def create_manager(payload: AddManagerAdminRequest):
    """Provisions a new department manager with approval rights."""
    try:
        if users_collection is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        existing_mgr = users_collection.find_one({
            "$or": [
                {"employeeId": payload.employeeId.strip()},
                {"email": payload.email.strip().lower()},
            ]
        })
        if existing_mgr:
            raise HTTPException(
                status_code=400,
                detail=f"A user with ID '{payload.employeeId}' or email '{payload.email}' already exists.",
            )

        new_id = f"user-mgr-{int(datetime.now().timestamp() * 1000) % 1000000}"
        from backend.services.auth_service import hash_password
        default_pw = hash_password("password123")

        new_doc = {
            "id": new_id,
            "name": payload.name.strip(),
            "employeeId": payload.employeeId.strip(),
            "email": payload.email.strip().lower(),
            "phone": payload.phone or "+91 ",
            "department": payload.department or "Engineering",
            "role": "manager",
            "title": payload.title or "Department Operations Director",
            "avatarUrl": payload.avatarUrl or "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80",
            "faceRegistered": payload.faceRegistered if payload.faceRegistered is not None else True,
            "joinDate": datetime.now().strftime("%Y-%m-%d"),
            "active": True,
            "password_hash": default_pw,
        }

        users_collection.insert_one(new_doc)
        return _clean_doc(new_doc)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to create manager")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/managers/{identifier}")
async def delete_manager(identifier: str):
    """Deletes a manager by id or employeeId."""
    try:
        if users_collection is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        result = users_collection.delete_one({
            "$or": [{"id": identifier}, {"employeeId": identifier}],
            "role": "manager",
        })
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Manager not found")

        return {"success": True, "message": f"Manager '{identifier}' deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete manager")
        raise HTTPException(status_code=500, detail=str(e))


# ── 4. Attendance Management & Regularization Override ────────────────────────

@router.get("/attendance")
async def list_attendance(
    mode: Optional[str] = Query(None, description="'today', 'history', or all"),
    date: Optional[str] = None,
    employeeId: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    department: Optional[str] = None,
):
    """
    Queries attendance records from MongoDB Atlas with flexible filtering.
    """
    try:
        if attendance_collection is None:
            return []

        query: Dict[str, Any] = {}
        if employeeId and employeeId != "All":
            query["employeeId"] = employeeId
        if status_filter and status_filter != "All":
            query["status"] = status_filter
        if department and department != "All":
            query["department"] = department
        if date:
            query["date"] = date

        # If mode is today and no explicit date given
        if mode == "today" and not date:
            # Look up latest date or today's date
            today_str = datetime.now().strftime("%Y-%m-%d")
            if attendance_collection.count_documents({"date": today_str}) > 0:
                query["date"] = today_str
            else:
                latest = attendance_collection.find_one(sort=[("date", -1)])
                if latest and "date" in latest:
                    query["date"] = latest["date"]

        cursor = attendance_collection.find(query).sort([("date", -1), ("checkIn", -1)])
        return [_clean_doc(rec) for rec in cursor]
    except Exception as e:
        logger.exception("Failed to query attendance")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/attendance/override")
async def override_attendance(payload: AttendanceOverrideRequest):
    """
    Applies an administrative attendance regularization override.
    Upserts the record in MongoDB Atlas attendance collection AND
    records an entry in the approval audits collection.
    """
    try:
        if attendance_collection is None or approval_audits_collection is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        # Find employee info
        emp = users_collection.find_one({"employeeId": payload.employeeId}) if users_collection is not None else None
        emp_name = emp.get("name", payload.employeeId) if emp else payload.employeeId
        emp_dept = emp.get("department", "Engineering") if emp else "Engineering"
        manager_name = emp.get("managerName", "Rajesh Sharma (Admin)") if emp else "Rajesh Sharma (Admin)"

        record_id = f"att-override-{payload.employeeId}-{payload.date.replace('-', '')}"
        updated_record = {
            "id": record_id,
            "employee_id": payload.employeeId,
            "employeeId": payload.employeeId,
            "employeeName": emp_name,
            "department": emp_dept,
            "date": payload.date,
            "status": payload.status,
            "checkIn": payload.checkIn if payload.status in ["Present", "Working", "Late"] else None,
            "checkOut": payload.checkOut if payload.status in ["Present", "Working"] else None,
            "hoursWorked": "8h 00m" if payload.status in ["Present", "Working"] else ("7h 15m" if payload.status == "Late" else "0h"),
            "verifiedBy": "Manual Override",
            "locationName": "Admin Regularized",
            "distanceMeters": 0,
            "withinRadius": True,
            "livenessVerified": True,
            "managerName": manager_name,
            "notes": f"Admin Regularization Override: {payload.reason}",
        }

        # Upsert in attendance collection
        attendance_collection.update_one(
            {"$or": [{"employeeId": payload.employeeId}, {"employee_id": payload.employeeId}], "date": payload.date},
            {"$set": updated_record},
            upsert=True,
        )

        # Log into approval audit collection
        audit_entry = {
            "id": f"audit-{int(datetime.now().timestamp() * 1000)}",
            "employeeId": payload.employeeId,
            "employeeName": emp_name,
            "requestType": f"Manual Attendance Regularization ({payload.status})",
            "decision": "Approved",
            "managerId": "user-admin",
            "managerName": "Rajesh Sharma (Admin)",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": datetime.now().strftime("%I:%M %p"),
            "reason": payload.reason,
            "remarks": f"Admin override for {payload.date} set to {payload.status}.",
        }
        approval_audits_collection.insert_one(audit_entry)

        return {
            "success": True,
            "message": f"Attendance successfully regularized for {emp_name} on {payload.date} as {payload.status}.",
            "record": _clean_doc(updated_record),
            "audit": _clean_doc(audit_entry),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to override attendance")
        raise HTTPException(status_code=500, detail=str(e))


# ── 5. Managerial Approval Audit Logs ─────────────────────────────────────────

@router.get("/audits")
async def list_approval_audits():
    """
    Fetches the immutable managerial approval audit trail logs from MongoDB Atlas.
    """
    try:
        if approval_audits_collection is None:
            return []
        cursor = approval_audits_collection.find({}).sort([("date", -1), ("_id", -1)])
        return [_clean_doc(a) for a in cursor]
    except Exception as e:
        logger.exception("Failed to fetch approval audits")
        raise HTTPException(status_code=500, detail=str(e))


# ── 6. Office Settings & Geofencing ───────────────────────────────────────────

@router.get("/settings")
async def get_settings():
    """
    Retrieves global office geofencing coordinates and smart hours policy from MongoDB Atlas.
    """
    try:
        default_settings = {
            "officeLocation": {
                "name": "Chennai Tech Park (HQ)",
                "address": "Block B, OMR Cyber Corridor, Chennai, TN 600096",
                "lat": 12.9815,
                "lng": 80.218,
                "allowedRadiusMeters": 150,
            },
            "smartHoursConfig": {
                "expectedHoursPerDay": 8,
                "graceCheckInMinutes": 15,
                "standardStartTime": "09:00 AM",
                "flexibleWindowMinutes": 180,
            },
        }

        if settings_collection is None:
            return default_settings

        doc = settings_collection.find_one({"key": "global_settings"})
        if not doc:
            settings_collection.insert_one({"key": "global_settings", **default_settings})
            return default_settings

        return {
            "officeLocation": doc.get("officeLocation", default_settings["officeLocation"]),
            "smartHoursConfig": doc.get("smartHoursConfig", default_settings["smartHoursConfig"]),
        }
    except Exception as e:
        logger.exception("Failed to get settings")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings/office")
async def update_office_settings(payload: OfficeSettingsUpdateRequest):
    """
    Updates the office geofence coordinates and allowed distance threshold in MongoDB Atlas.
    """
    try:
        if settings_collection is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        update_dict = {
            "name": payload.name,
            "address": payload.address,
            "lat": payload.lat,
            "lng": payload.lng,
            "allowedRadiusMeters": payload.allowedRadiusMeters,
        }

        settings_collection.update_one(
            {"key": "global_settings"},
            {"$set": {"officeLocation": update_dict}},
            upsert=True,
        )

        return {"success": True, "officeLocation": update_dict}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update office settings")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings/smart-hours")
async def update_smart_hours_settings(payload: SmartHoursUpdateRequest):
    """
    Updates smart hours policy parameters.
    """
    try:
        if settings_collection is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        update_dict = {
            "expectedHoursPerDay": payload.expectedHoursPerDay,
            "graceCheckInMinutes": payload.graceCheckInMinutes,
            "standardStartTime": payload.standardStartTime,
            "flexibleWindowMinutes": payload.flexibleWindowMinutes,
        }

        settings_collection.update_one(
            {"key": "global_settings"},
            {"$set": {"smartHoursConfig": update_dict}},
            upsert=True,
        )

        return {"success": True, "smartHoursConfig": update_dict}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update smart hours settings")
        raise HTTPException(status_code=500, detail=str(e))


# ── 7. Reset / Reseed Database ────────────────────────────────────────────────

@router.post("/reset")
async def reset_database():
    """
    Resets MongoDB Atlas collections and reseeds baseline enterprise dataset.
    """
    try:
        if users_collection is not None:
            users_collection.delete_many({})
            seed_initial_users()
        if attendance_collection is not None:
            attendance_collection.delete_many({})
            seed_initial_attendance()
        if approval_audits_collection is not None:
            approval_audits_collection.delete_many({})
            seed_initial_audits()
        if settings_collection is not None:
            settings_collection.delete_many({})
            seed_initial_settings()

        return {"success": True, "message": "MongoDB Atlas successfully reset and re-seeded with enterprise defaults."}
    except Exception as e:
        logger.exception("Failed to reset database")
        raise HTTPException(status_code=500, detail=str(e))
