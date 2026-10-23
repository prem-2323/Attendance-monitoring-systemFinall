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
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status

from backend.database import (
    users_collection,
    attendance_collection,
    approval_audits_collection,
    settings_collection,
    employees_collection,
    seed_initial_users,
    seed_initial_settings,
    seed_initial_attendance,
    seed_initial_audits,
)
from backend.services.face_detector import extract_face_embedding_from_b64
from backend.models.admin import (
    AddEmployeeAdminRequest,
    AddManagerAdminRequest,
    AttendanceOverrideRequest,
    OfficeSettingsUpdateRequest,
    SmartHoursUpdateRequest,
    OfficeLocationsUpdateRequest,
    LocationItem,
)
from backend.services.timezone import india_now

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

        # 2. Today's date in Indian Standard Time
        today_str = india_now().strftime("%Y-%m-%d")
        
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

        from backend.services.smart_hours import count_statuses as _count_statuses
        _counts = _count_statuses(today_records)
        present_count = _counts["presentDays"]
        late_count = _counts["lateDays"]
        on_leave_count = _counts["leaveDays"]
        absent_count = _counts["absentDays"]
        in_progress_count = _counts["inProgressDays"]

        # Any employee without a marked record is Absent — but In Progress
        # shifts are attending, never absent.
        untracked = max(0, total_employees - (present_count + late_count + on_leave_count + absent_count + in_progress_count))
        absent_count += untracked

        total_tracked = max(1, present_count + late_count + on_leave_count + absent_count + in_progress_count)
        present_pct = round(((present_count + late_count + in_progress_count) / total_tracked) * 100)

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
            "inProgressCount": in_progress_count,
            "flexibleShiftDays": _counts.get("flexibleShiftDays", 0),
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

        # Extract face embedding from faceImageBase64 or avatarUrl
        raw_b64 = (payload.faceImageBase64 or "").strip()
        if not raw_b64 and payload.avatarUrl and payload.avatarUrl.startswith("data:image"):
            raw_b64 = payload.avatarUrl.strip()

        face_embedding, clean_avatar = extract_face_embedding_from_b64(raw_b64)
        has_face = face_embedding is not None or bool(payload.faceRegistered)
        final_avatar = clean_avatar or payload.avatarUrl or ""

        # Check existing employee ID or email
        existing_emp = users_collection.find_one({
            "$or": [
                {"employeeId": payload.employeeId.strip()},
                {"email": payload.email.strip().lower()},
            ]
        })
        if existing_emp:
            # Idempotent sync: update fields and return existing record without 400 error
            update_fields = {
                "name": payload.name.strip(),
                "phone": payload.phone or existing_emp.get("phone", "+91 "),
                "department": payload.department or existing_emp.get("department", "Engineering"),
                "managerName": payload.managerName or existing_emp.get("managerName", ""),
                "faceRegistered": has_face,
                "faceVector": f"VEC-128-{payload.employeeId.strip()}" if has_face else existing_emp.get("faceVector"),
            }
            if final_avatar:
                update_fields["avatarUrl"] = final_avatar
            if face_embedding is not None:
                update_fields["faceEmbedding"] = face_embedding

            users_collection.update_one({"_id": existing_emp["_id"]}, {"$set": update_fields})
            if employees_collection is not None:
                emp_sync = {
                    "employee_id": payload.employeeId.strip(),
                    "name": payload.name.strip(),
                }
                if face_embedding is not None:
                    emp_sync["face_embedding"] = face_embedding
                    emp_sync["face_image"] = final_avatar
                employees_collection.update_one(
                    {"employee_id": payload.employeeId.strip()},
                    {"$set": emp_sync},
                    upsert=True,
                )
            updated_emp = users_collection.find_one({"_id": existing_emp["_id"]})
            logger.info(f"[Admin] Employee '{payload.employeeId}' synced with face biometrics successfully.")
            return _clean_doc(updated_emp or existing_emp)

        now = india_now()
        new_id = f"user-emp-{int(now.timestamp() * 1000) % 1000000}"
        from backend.services.auth_service import hash_password
        default_pw = hash_password("password123")

        new_doc = {
            "id": new_id,
            "name": payload.name.strip(),
            "employeeId": payload.employeeId.strip(),
            "email": payload.email.strip().lower(),
            "phone": payload.phone or "+91 ",
            "department": payload.department or "Engineering",
            "managerName": payload.managerName or "",
            "role": payload.role or "employee",
            "avatarUrl": final_avatar,
            "faceRegistered": has_face,
            "faceVector": f"VEC-128-{payload.employeeId.strip()}" if has_face else None,
            "joinDate": now.strftime("%Y-%m-%d"),
            "created_at": now,
            "active": True,
            "title": f"Staff {payload.department}",
            "password_hash": default_pw,
        }
        if face_embedding is not None:
            new_doc["faceEmbedding"] = face_embedding

        users_collection.insert_one(new_doc)
        if employees_collection is not None:
            emp_sync = {
                "employee_id": payload.employeeId.strip(),
                "name": payload.name.strip(),
                "created_at": india_now(),
            }
            if face_embedding is not None:
                emp_sync["face_embedding"] = face_embedding
                emp_sync["face_image"] = final_avatar
            employees_collection.update_one(
                {"employee_id": payload.employeeId.strip()},
                {"$set": emp_sync},
                upsert=True,
            )

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
            update_fields = {
                "name": payload.name.strip(),
                "phone": payload.phone or existing_mgr.get("phone", "+91 "),
                "department": payload.department or existing_mgr.get("department", "Engineering"),
                "title": payload.title or existing_mgr.get("title", "Department Operations Director"),
            }
            if payload.avatarUrl:
                update_fields["avatarUrl"] = payload.avatarUrl
            users_collection.update_one({"_id": existing_mgr["_id"]}, {"$set": update_fields})
            updated_mgr = users_collection.find_one({"_id": existing_mgr["_id"]})
            logger.info(f"[Admin] Manager '{payload.employeeId}' synced successfully in MongoDB.")
            return _clean_doc(updated_mgr or existing_mgr)

        now = india_now()
        new_id = f"user-mgr-{int(now.timestamp() * 1000) % 1000000}"
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
            "avatarUrl": payload.avatarUrl or "",
            "faceRegistered": payload.faceRegistered if payload.faceRegistered is not None else True,
            "joinDate": now.strftime("%Y-%m-%d"),
            "created_at": now,
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
            today_str = india_now().strftime("%Y-%m-%d")
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
        manager_name = emp.get("managerName", "System Administrator") if emp else "System Administrator"

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
            "id": f"audit-{int(india_now().timestamp() * 1000)}",
            "employeeId": payload.employeeId,
            "employeeName": emp_name,
            "requestType": f"Manual Attendance Regularization ({payload.status})",
            "decision": "Approved",
            "managerId": "user-admin",
            "managerName": "System Administrator",
            "date": india_now().strftime("%Y-%m-%d"),
            "time": india_now().strftime("%I:%M %p"),
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
    Retrieves global office geofencing coordinates, shift in-time/out-time, and smart hours policy from MongoDB Atlas.
    """
    try:
        from backend.services.geofence import get_configured_polygon
        from backend.config import OFFICE_RADIUS_METERS
        from backend.services.smart_hours import get_smart_config
        _box = get_configured_polygon()
        default_settings = {
            "officeLocation": {
                "id": "loc-1",
                "name": "Head Office Block",
                "address": "Office Campus Premises, Tamil Nadu",
                "lat": sum(p[0] for p in _box) / len(_box),
                "lng": sum(p[1] for p in _box) / len(_box),
                "allowedRadiusMeters": OFFICE_RADIUS_METERS,
                "geofencePolygon": [{"lat": lat, "lng": lng} for lat, lng in _box],
                "isActive": True,
            },
            "geofencePolygon": [{"lat": lat, "lng": lng} for lat, lng in _box],
            "smartHoursConfig": {
                "expectedHoursPerDay": 8,
                "graceCheckInMinutes": 15,
                "standardStartTime": "11:25 AM",
                "standardEndTime": "07:25 PM",
                "inTime": "11:25 AM",
                "outTime": "07:25 PM",
                "flexibleWindowMinutes": 180,
            },
            "inTime": "11:25 AM",
            "outTime": "07:25 PM",
        }
        default_settings["officeLocations"] = [default_settings["officeLocation"]]
        default_settings["locations"] = default_settings["officeLocations"]

        if settings_collection is None:
            return default_settings

        doc = settings_collection.find_one({"key": "global_settings"})
        if not doc:
            settings_collection.insert_one({"key": "global_settings", **default_settings})
            return default_settings

        smart_cfg = get_smart_config(doc)
        in_time = smart_cfg.get("inTime") or smart_cfg.get("standardStartTime") or doc.get("inTime") or "11:25 AM"
        out_time = smart_cfg.get("outTime") or smart_cfg.get("standardEndTime") or doc.get("outTime") or "07:25 PM"

        # Use the first saved location as the single canonical office.
        office_locations = doc.get("officeLocations")
        if not office_locations or not isinstance(office_locations, list) or len(office_locations) == 0:
            primary = doc.get("officeLocation", default_settings["officeLocation"])
            office_locations = [
                {
                    **default_settings["officeLocation"],
                    **primary,
                    "geofencePolygon": primary.get(
                        "geofencePolygon",
                        doc.get("geofencePolygon", default_settings["geofencePolygon"]),
                    ),
                    "isActive": True,
                },
            ]

        primary_location = dict(office_locations[0] or {})
        primary_location.setdefault("id", "loc-1")
        primary_location["isActive"] = True
        primary_location.setdefault("allowedRadiusMeters", 1000)
        if primary_location.get("geofencePolygon") is None:
            primary_location["geofencePolygon"] = doc.get(
                "geofencePolygon", default_settings["geofencePolygon"]
            )
        office_locations = [primary_location]

        return {
            "officeLocation": primary_location,
            "officeLocations": office_locations,
            "locations": office_locations,
            "geofencePolygon": primary_location["geofencePolygon"],
            "smartHoursConfig": smart_cfg,
            "inTime": in_time,
            "outTime": out_time,
        }
    except Exception as e:
        logger.exception("Failed to get settings")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings/locations")
async def get_office_locations():
    """
    Fetch the single configured office location.
    """
    try:
        if settings_collection is None:
            raise HTTPException(status_code=503, detail="Database unavailable")
        settings_data = await get_settings()
        return {
            "success": True,
            "locations": settings_data.get("officeLocations", []),
            "officeLocations": settings_data.get("officeLocations", []),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get office locations")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings/locations")
async def update_office_locations(payload: OfficeLocationsUpdateRequest):
    """
    Updates the single office location in MongoDB Atlas.
    """
    try:
        if settings_collection is None:
            raise HTTPException(status_code=503, detail="Database unavailable")
        if len(payload.locations) != 1:
            raise HTTPException(status_code=422, detail="Exactly one office location must be configured.")

        loc = payload.locations[0]
        polygon = [
            {"lat": float(p["lat"]), "lng": float(p["lng"])}
            for p in (loc.geofencePolygon or [])
            if isinstance(p, dict) and "lat" in p and "lng" in p
        ]
        if polygon and len(polygon) < 3:
            raise HTTPException(status_code=422, detail="A geofence polygon must contain at least three coordinates.")
        primary_loc = {
            "id": loc.id or "loc-1",
            "name": loc.name or "Office",
            "address": loc.address or "Office Campus Premises",
            "lat": float(loc.lat),
            "lng": float(loc.lng),
            "allowedRadiusMeters": int(loc.allowedRadiusMeters or 1000),
            "isActive": True,
            "geofencePolygon": polygon,
        }
        clean_locs = [primary_loc]

        set_fields: Dict[str, Any] = {
            "officeLocations": clean_locs,
            "officeLocation": primary_loc,
            "geofencePolygon": primary_loc["geofencePolygon"],
        }

        settings_collection.update_one(
            {"key": "global_settings"},
            {"$set": set_fields},
            upsert=True,
        )

        return {
            "success": True,
            "locations": clean_locs,
            "officeLocations": clean_locs,
            "officeLocation": primary_loc,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update office locations")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings/smart-hours")
async def get_smart_hours_settings():
    """
    Direct endpoint to fetch current smart hours policy and configured in-time/out-time.
    """
    try:
        from backend.services.smart_hours import get_smart_config, DEFAULT_SMART_CONFIG
        if settings_collection is None:
            return {"success": True, "smartHoursConfig": DEFAULT_SMART_CONFIG, "inTime": "11:25 AM", "outTime": "07:25 PM"}
        doc = settings_collection.find_one({"key": "global_settings"})
        smart_cfg = get_smart_config(doc)
        return {
            "success": True,
            "smartHoursConfig": smart_cfg,
            "inTime": smart_cfg.get("inTime", "11:25 AM"),
            "outTime": smart_cfg.get("outTime", "07:25 PM"),
        }
    except Exception as e:
        logger.exception("Failed to get smart hours settings")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings/office")
async def update_office_settings(payload: OfficeSettingsUpdateRequest):
    """
    Updates office geofence coordinates, allowed distance threshold, and multi-locations in MongoDB Atlas.
    """
    try:
        if settings_collection is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        existing = settings_collection.find_one({"key": "global_settings"}) or {}
        existing_locs = existing.get("officeLocations") or []
        base_primary = existing_locs[0] if existing_locs else (existing.get("officeLocation") or {})

        clean_poly = [
            {"lat": float(p["lat"]), "lng": float(p["lng"])}
            for p in (payload.geofencePolygon or [])
            if isinstance(p, dict) and "lat" in p and "lng" in p
        ]
        if payload.geofencePolygon is None:
            clean_poly = (
                base_primary.get("geofencePolygon")
                if base_primary.get("geofencePolygon") is not None
                else existing.get("geofencePolygon", [])
            )
        elif clean_poly and len(clean_poly) < 3:
            raise HTTPException(status_code=422, detail="A geofence polygon must contain at least three coordinates.")

        update_dict = {
            "id": base_primary.get("id", "loc-1"),
            "name": payload.name or base_primary.get("name", "Head Office Block"),
            "address": payload.address or base_primary.get("address", "Office Campus Premises, Tamil Nadu"),
            "lat": float(payload.lat if payload.lat is not None else base_primary.get("lat", 11.27037707675975)),
            "lng": float(payload.lng if payload.lng is not None else base_primary.get("lng", 77.60352284059195)),
            "allowedRadiusMeters": int(
                payload.allowedRadiusMeters
                if payload.allowedRadiusMeters is not None
                else base_primary.get("allowedRadiusMeters", 1000)
            ),
            "geofencePolygon": clean_poly,
            "isActive": True,
        }

        set_dict: Dict[str, Any] = {
            "officeLocation": update_dict,
            "geofencePolygon": clean_poly,
        }

        set_dict["officeLocations"] = [update_dict]

        # If inTime or outTime provided in office update payload, persist them
        if payload.inTime:
            set_dict["inTime"] = payload.inTime.strip()
            set_dict["smartHoursConfig.inTime"] = payload.inTime.strip()
            set_dict["smartHoursConfig.standardStartTime"] = payload.inTime.strip()
        if payload.outTime:
            set_dict["outTime"] = payload.outTime.strip()
            set_dict["smartHoursConfig.outTime"] = payload.outTime.strip()
            set_dict["smartHoursConfig.standardEndTime"] = payload.outTime.strip()

        # If a full locations list was passed, it becomes the source of truth.
        in_locs = payload.locations or payload.officeLocations
        if in_locs:
            if len(in_locs) != 1:
                raise HTTPException(status_code=422, detail="Exactly one office location must be configured.")
            clean_locs = []
            for i, loc in enumerate(in_locs):
                clean_locs.append({
                    "id": loc.id or f"loc-{i + 1}",
                    "name": loc.name or f"Location {i + 1}",
                    "address": loc.address or "Office Campus Premises",
                    "lat": float(loc.lat),
                    "lng": float(loc.lng),
                    "allowedRadiusMeters": int(loc.allowedRadiusMeters or 1000),
                    "isActive": True,
                    "geofencePolygon": [
                        {"lat": float(p["lat"]), "lng": float(p["lng"])}
                        for p in (loc.geofencePolygon or [])
                        if isinstance(p, dict) and "lat" in p and "lng" in p
                    ],
                })
            set_dict["officeLocations"] = clean_locs
            set_dict["officeLocation"] = clean_locs[0]
            if clean_locs[0].get("geofencePolygon"):
                set_dict["geofencePolygon"] = clean_locs[0]["geofencePolygon"]

        settings_collection.update_one(
            {"key": "global_settings"},
            {"$set": set_dict},
            upsert=True,
        )

        return {
            "success": True,
            "officeLocation": set_dict["officeLocation"],
            "officeLocations": set_dict["officeLocations"],
            "locations": set_dict["officeLocations"],
            "geofencePolygon": set_dict.get("geofencePolygon", clean_poly),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update office settings")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings/smart-hours")
async def update_smart_hours_settings(payload: SmartHoursUpdateRequest):
    """
    Updates smart hours policy parameters including In-Time and Out-Time in MongoDB Atlas.
    """
    try:
        if settings_collection is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        from backend.services.smart_hours import parse_time_to_minutes, minutes_to_time_str
        existing = settings_collection.find_one({"key": "global_settings"}) or {}
        current = existing.get("smartHoursConfig", {}) if isinstance(existing, dict) else {}

        # Resolve In-Time (from payload.inTime or payload.standardStartTime or current)
        std_in = payload.inTime or payload.standardStartTime or current.get("inTime") or current.get("standardStartTime") or existing.get("inTime") or "11:25 AM"
        if not isinstance(std_in, str) or parse_time_to_minutes(std_in) is None:
            std_in = "11:25 AM"
        std_in = std_in.strip()

        # Resolve Out-Time (from payload.outTime or payload.standardEndTime or current)
        std_out = payload.outTime or payload.standardEndTime or current.get("outTime") or current.get("standardEndTime") or existing.get("outTime")
        if not isinstance(std_out, str) or parse_time_to_minutes(std_out) is None:
            std_out = None

        # Resolve expectedHoursPerDay
        exp = payload.expectedHoursPerDay
        if exp is None:
            # If both inTime and outTime are known, compute duration
            if std_in and std_out:
                in_m = parse_time_to_minutes(std_in)
                out_m = parse_time_to_minutes(std_out)
                if in_m is not None and out_m is not None:
                    diff = out_m - in_m
                    if diff < 0:
                        diff += 24 * 60
                    exp = round(diff / 60.0, 1)
            if exp is None:
                exp = current.get("expectedHoursPerDay", 8)

        try:
            exp = max(1.0, min(24.0, float(exp)))
        except (TypeError, ValueError):
            exp = 8.0

        # If Out-Time was not provided, auto-calculate from inTime + exp hours
        if not std_out:
            in_m = parse_time_to_minutes(std_in) or (11 * 60 + 25)
            out_m = in_m + int(round(exp * 60))
            std_out = minutes_to_time_str(out_m)
        std_out = std_out.strip()

        grace = payload.graceCheckInMinutes
        if grace is None:
            grace = current.get("graceCheckInMinutes", 15)
        try:
            grace = max(0, min(180, int(grace)))
        except (TypeError, ValueError):
            grace = 15

        flex = payload.flexibleWindowMinutes
        if flex is None:
            flex = current.get("flexibleWindowMinutes", 180)
        try:
            flex = max(0, min(720, int(flex)))
        except (TypeError, ValueError):
            flex = 180

        update_dict = {
            "expectedHoursPerDay": exp,
            "graceCheckInMinutes": grace,
            "standardStartTime": std_in,
            "standardEndTime": std_out,
            "inTime": std_in,
            "outTime": std_out,
            "flexibleWindowMinutes": flex,
        }

        # Persist both within smartHoursConfig and at root of global_settings document
        settings_collection.update_one(
            {"key": "global_settings"},
            {
                "$set": {
                    "smartHoursConfig": update_dict,
                    "inTime": std_in,
                    "outTime": std_out,
                }
            },
            upsert=True,
        )

        return {
            "success": True,
            "smartHoursConfig": update_dict,
            "inTime": std_in,
            "outTime": std_out,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update smart hours settings")
        raise HTTPException(status_code=500, detail=str(e))


# ── 7. Reset / Reseed Database ────────────────────────────────────────────────

@router.post("/reset")
async def reset_database():
    """
    Resets MongoDB Atlas collections to clean state with default enterprise system settings.
    """
    try:
        from backend.database import leave_requests_collection
        if users_collection is not None:
            users_collection.delete_many({})
            seed_initial_users()
        if attendance_collection is not None:
            attendance_collection.delete_many({})
        if approval_audits_collection is not None:
            approval_audits_collection.delete_many({})
        if leave_requests_collection is not None:
            leave_requests_collection.delete_many({})
        if settings_collection is not None:
            settings_collection.delete_many({})
            seed_initial_settings()

        return {"success": True, "message": "MongoDB Atlas successfully reset to clean database with enterprise default settings."}
    except Exception as e:
        logger.exception("Failed to reset database")
        raise HTTPException(status_code=500, detail=str(e))
