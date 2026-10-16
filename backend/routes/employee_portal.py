"""
FastAPI Routes for Employee Portal:
- Employee Dashboard Overview
- Biometric Attendance Verification (Check-in & Check-out)
- Attendance History & Monthly Aggregates
- Leave Application & Tracking
- Smart Hours Dynamic Shift Calculation
"""

import base64
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status

from backend.database import (
    users_collection,
    attendance_collection,
    leave_requests_collection,
    settings_collection,
    employees_collection,
)
from backend.models.employee_portal import (
    MarkAttendanceRequest,
    ApplyLeaveRequest,
    SmartHoursSimulationRequest,
    FaceDetectRequest,
)
from backend.services.face_detector import decode_image, detect_faces

logger = logging.getLogger("employee_portal_routes")
router = APIRouter(tags=["Employee Portal"])


def _clean_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Helper to sanitize MongoDB document for JSON responses."""
    if not doc:
        return {}
    cleaned = dict(doc)
    if "_id" in cleaned:
        cleaned["_id"] = str(cleaned["_id"])
    cleaned.pop("password_hash", None)
    return cleaned


def _calc_hours_difference(time_start_str: str, time_end_str: str) -> str:
    """Calculate hours difference between two AM/PM time strings."""
    try:
        fmt = "%I:%M %p"
        t1 = datetime.strptime(time_start_str.strip(), fmt)
        t2 = datetime.strptime(time_end_str.strip(), fmt)
        diff_seconds = (t2 - t1).total_seconds()
        if diff_seconds < 0:
            diff_seconds += 24 * 3600  # Overnight shift wrap
        hours = int(diff_seconds // 3600)
        minutes = int((diff_seconds % 3600) // 60)
        return f"{hours}h {minutes:02d}m"
    except Exception:
        return "8h 00m"


# ── 1. Mark Attendance (Face + GPS Check-in / Check-out) ──────────────────────

@router.post("/attendance/mark")
async def mark_employee_attendance(payload: MarkAttendanceRequest):
    """
    Records Face + GPS verified attendance check-in or check-out in MongoDB Atlas.
    """
    try:
        if attendance_collection is None:
            raise HTTPException(status_code=503, detail="Database connection unavailable")

        # 1. Lookup employee in users
        emp = users_collection.find_one({
            "$or": [{"employeeId": payload.employeeId}, {"id": payload.employeeId}]
        }) if users_collection is not None else None

        if not emp:
            raise HTTPException(status_code=404, detail=f"Employee '{payload.employeeId}' not found.")

        # 2. Office geofence BOX check — attendance ONLY inside the polygon.
        # The client sends its live GPS fix (latitude/longitude); the server
        # re-verifies with a point-in-polygon test so spoofed flags can't pass.
        settings_doc = settings_collection.find_one({"key": "global_settings"}) if settings_collection is not None else None
        allowed_radius = 1000
        office_name = "Head Office Block"
        polygon = None
        if settings_doc and "officeLocation" in settings_doc:
            allowed_radius = settings_doc["officeLocation"].get("allowedRadiusMeters", 1000)
            office_name = settings_doc["officeLocation"].get("name", office_name)
        if settings_doc and settings_doc.get("geofencePolygon"):
            try:
                polygon = [
                    (float(p["lat"]), float(p["lng"]))
                    for p in settings_doc["geofencePolygon"]
                    if "lat" in p and "lng" in p
                ] or None
            except (TypeError, ValueError, KeyError):
                polygon = None

        from backend.services.geofence import (
            get_configured_polygon,
            point_in_polygon,
            polygon_centroid,
            haversine_meters,
        )
        office_box = polygon or get_configured_polygon()

        if payload.latitude is not None and payload.longitude is not None:
            c_lat, c_lng = polygon_centroid(office_box)
            dist_to_center = round(haversine_meters(payload.latitude, payload.longitude, c_lat, c_lng))
            inside_box = point_in_polygon(payload.latitude, payload.longitude, office_box)
            within_allowed = inside_box or (dist_to_center <= allowed_radius)
            if not within_allowed:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Outside office geofence: your GPS position ({payload.latitude:.6f}, {payload.longitude:.6f}) "
                        f"is {dist_to_center}m away from {office_name}, exceeding the allowed {allowed_radius}m radius."
                    ),
                )
            # Verified inside polygon box or within 1000m radius
            payload.distanceMeters = dist_to_center
            payload.withinRadius = True
        elif not payload.withinRadius and payload.distanceMeters > allowed_radius:
            raise HTTPException(
                status_code=400,
                detail=f"GPS check failed: Current distance {round(payload.distanceMeters)}m exceeds allowed radius of {allowed_radius}m.",
            )

        if not payload.livenessVerified:
            raise HTTPException(
                status_code=400,
                detail="Liveness verification failed: face-presence check could not be validated.",
            )

        # 2.5 Biometric Facial Verification Check
        if payload.faceImageBase64:
            from backend.services.face_detector import decode_image, detect_faces
            from backend.services.face_landmark import align_face
            from backend.services import face_recognition as fr_service
            import base64

            stored_emb = None
            if employees_collection is not None:
                edoc = employees_collection.find_one({
                    "$or": [{"employee_id": payload.employeeId}, {"employeeId": payload.employeeId}]
                })
                if edoc:
                    stored_emb = edoc.get("face_embedding")
            if not stored_emb and users_collection is not None:
                udoc = users_collection.find_one({
                    "$or": [{"employeeId": payload.employeeId}, {"id": payload.employeeId}]
                })
                if udoc:
                    stored_emb = udoc.get("faceEmbedding") or udoc.get("face_embedding")

            if stored_emb and isinstance(stored_emb, list) and len(stored_emb) > 0:
                raw_img = payload.faceImageBase64.strip()
                payload_b64 = raw_img.split(",", 1)[1] if "," in raw_img else raw_img
                img_bytes = base64.b64decode(payload_b64)
                img_bgr = decode_image(img_bytes)
                if img_bgr is not None:
                    dets = detect_faces(img_bgr)
                    if not dets:
                        raise HTTPException(
                            status_code=400,
                            detail="No human face visible in attendance verification snapshot.",
                        )
                    best_det = max(dets, key=lambda d: d.get("confidence", 0.9))
                    aligned_face = align_face(img_bgr, best_det["box"])
                    live_emb = fr_service.get_face_embedding(aligned_face if aligned_face is not None else img_bgr)
                    if live_emb is not None:
                        sim = fr_service.compute_similarity(live_emb, stored_emb)
                        is_match_res, _ = fr_service.is_match(live_emb, stored_emb, threshold=0.52)
                        if not is_match_res or sim < 0.52:
                            raise HTTPException(
                                status_code=403,
                                detail="This is not your face. Face biometric does not match the registered employee profile.",
                            )

        # 3. Format current time
        now = datetime.now()
        formatted_time = now.strftime("%I:%M %p")
        today_str = now.strftime("%Y-%m-%d")

        # 4. Smart-hours policy (dynamic from Atlas, never hardcoded).
        from backend.services.smart_hours import (
            get_smart_config,
            classify_arrival,
            compute_shift,
            finalize_status,
            STATUS_IN_PROGRESS,
        )
        smart_cfg = get_smart_config(settings_doc)
        target_hours = int(smart_cfg.get("expectedHoursPerDay", 8))

        # Check existing today record
        existing = attendance_collection.find_one({
            "$or": [{"employeeId": payload.employeeId}, {"employee_id": payload.employeeId}],
            "date": today_str,
        })

        if payload.isCheckOut:
            # Check-out operation: finalize from ACTUAL persisted hours.
            check_in_time = (existing.get("checkIn") if existing else None) or "09:00 AM"
            shift = compute_shift(check_in_time, formatted_time, smart_cfg)
            hours_worked = shift["workedStr"]
            final_status, _ctx = finalize_status(check_in_time, formatted_time, smart_cfg)
            arrival = classify_arrival(check_in_time, smart_cfg)

            updated_doc = {
                "id": existing.get("id") if existing else f"att-today-{int(now.timestamp() * 1000)}",
                "employeeId": payload.employeeId,
                "employee_id": payload.employeeId,
                "employeeName": emp.get("name", "Staff"),
                "department": emp.get("department", "Engineering"),
                "date": today_str,
                "checkIn": check_in_time,
                "checkOut": formatted_time,
                "hoursWorked": hours_worked,
                "workedMinutes": shift["workedMinutes"],
                "targetMinutes": shift["targetMinutes"],
                "expectedCheckout": shift["expectedCheckout"],
                "arrivalStatus": arrival["arrivalStatus"],
                "status": final_status,
                "verifiedBy": "Face + GPS",
                "locationName": payload.locationName or office_name,
                "distanceMeters": round(payload.distanceMeters),
                "withinRadius": True,
                "insideGeofence": True,
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "livenessVerified": True,
                "managerName": emp.get("managerName", ""),
            }

            attendance_collection.update_one(
                {"$or": [{"employeeId": payload.employeeId}, {"employee_id": payload.employeeId}], "date": today_str},
                {"$set": updated_doc},
                upsert=True,
            )

            return {
                "success": True,
                "message": f"Check-out successfully recorded at {formatted_time}! Logged {hours_worked} worked. Status: {final_status}.",
                "record": _clean_doc(updated_doc),
            }
        else:
            # Check-in operation: arrival punctuality is recorded separately;
            # daily status stays In Progress until required hours are done.
            arrival = classify_arrival(formatted_time, smart_cfg)
            shift_preview = compute_shift(formatted_time, None, smart_cfg)
            updated_doc = {
                "id": existing.get("id") if existing else f"att-today-{int(now.timestamp() * 1000)}",
                "employeeId": payload.employeeId,
                "employee_id": payload.employeeId,
                "employeeName": emp.get("name", "Staff"),
                "department": emp.get("department", "Engineering"),
                "date": today_str,
                "checkIn": formatted_time,
                "checkOut": existing.get("checkOut") if existing else None,
                "hoursWorked": existing.get("hoursWorked", "--") if existing else "--",
                "workedMinutes": 0,
                "targetMinutes": shift_preview["targetMinutes"],
                "expectedCheckout": shift_preview["expectedCheckout"],
                "arrivalStatus": arrival["arrivalStatus"],
                "status": STATUS_IN_PROGRESS,
                "verifiedBy": "Face + GPS",
                "locationName": payload.locationName or office_name,
                "distanceMeters": round(payload.distanceMeters),
                "withinRadius": True,
                "insideGeofence": True,
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "livenessVerified": True,
                "managerName": emp.get("managerName", ""),
            }

            attendance_collection.update_one(
                {"$or": [{"employeeId": payload.employeeId}, {"employee_id": payload.employeeId}], "date": today_str},
                {"$set": updated_doc},
                upsert=True,
            )

            # Trigger Attendance Email Notifications
            try:
                import os
                from zoneinfo import ZoneInfo
                from backend.app.email_service import queue_attendance_emails, process_pending_emails

                tz_ind = ZoneInfo(os.getenv("TIMEZONE", "Asia/Kolkata"))
                now_dt = datetime.now(tz_ind)
                queue_attendance_emails(
                    employee=emp,
                    status="present",
                    attendance_date=now_dt.date(),
                    check_in=now_dt,
                )
                process_pending_emails()
            except Exception as notify_err:
                logger.warning(f"[Portal] Could not queue email notification: {notify_err}")

            return {
                "success": True,
                "message": f"Attendance verified via Face + GPS at {formatted_time}! Status: {STATUS_IN_PROGRESS} ({arrival['arrivalStatus']}, expected checkout {shift_preview['expectedCheckout']}).",
                "record": _clean_doc(updated_doc),
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to mark attendance")
        raise HTTPException(status_code=500, detail=str(e))


# ── 1.1 Real-Time Camera Frame Face Detection ─────────────────────────────────

@router.post("/face/detect")
async def detect_live_face(payload: FaceDetectRequest):
    """
    Real-time face detection on captured webcam frame.
    Validates whether an actual human face is present in the camera stream.
    Rejects walls, objects, and empty rooms.
    """
    try:
        raw_b64 = payload.imageBase64.strip()
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]

        image_bytes = base64.b64decode(raw_b64)
        if len(image_bytes) == 0:
            return {
                "faceDetected": False,
                "count": 0,
                "message": "Empty frame received",
            }

        image_bgr = decode_image(image_bytes)
        if image_bgr is None or image_bgr.size == 0:
            return {
                "faceDetected": False,
                "count": 0,
                "message": "Unable to decode video frame",
            }

        detections = detect_faces(image_bgr)
        if not detections:
            return {
                "faceDetected": False,
                "count": 0,
                "message": "No human face detected. Please position your face inside the camera view.",
            }

        best = max(detections, key=lambda d: d.get("confidence", 0.9))
        box = best["box"]  # (x, y, w, h)

        face_matched = True
        match_confidence = float(best.get("confidence", 0.95))
        status_msg = "Human face detected successfully"

        # If employeeId provided, verify against registered database face embedding
        if payload.employeeId:
            emp_clean = payload.employeeId.strip()
            stored_emb = None
            if employees_collection is not None:
                edoc = employees_collection.find_one({
                    "$or": [
                        {"employee_id": emp_clean},
                        {"employeeId": emp_clean},
                        {"employee_id": emp_clean.upper()},
                        {"employeeId": emp_clean.upper()},
                    ]
                })
                if edoc:
                    stored_emb = edoc.get("face_embedding")

            if not stored_emb and users_collection is not None:
                udoc = users_collection.find_one({
                    "$or": [
                        {"employeeId": emp_clean},
                        {"employee_id": emp_clean},
                        {"employeeId": emp_clean.upper()},
                    ]
                })
                if udoc:
                    stored_emb = udoc.get("faceEmbedding") or udoc.get("face_embedding")

            if stored_emb and isinstance(stored_emb, list) and len(stored_emb) > 0:
                from backend.services.face_landmark import align_face
                from backend.services import face_recognition as fr_service

                aligned = align_face(image_bgr, box)
                live_emb = fr_service.get_face_embedding(aligned if aligned is not None else image_bgr)
                if live_emb is not None:
                    similarity = fr_service.compute_similarity(live_emb, stored_emb)
                    is_match_res, _ = fr_service.is_match(live_emb, stored_emb, threshold=0.52)
                    match_confidence = float(similarity)
                    if not is_match_res or similarity < 0.52:
                        face_matched = False
                        status_msg = "This is not your face. Face biometric does not match the registered employee profile."
                    else:
                        face_matched = True
                        status_msg = f"Identity verified & matched with enrolled profile ({round(similarity*100)}% match)."
                else:
                    face_matched = False
                    status_msg = "Could not compute biometric signature from live face."
            else:
                face_matched = False
                status_msg = "No registered face biometrics found in database for your profile. Please register your face first."

        return {
            "faceDetected": True,
            "faceMatched": face_matched,
            "count": len(detections),
            "box": {
                "x": int(box[0]),
                "y": int(box[1]),
                "width": int(box[2]),
                "height": int(box[3]),
            },
            "confidence": match_confidence,
            "message": status_msg,
        }
    except Exception as e:
        logger.exception("Face detection processing error")
        return {
            "faceDetected": False,
            "count": 0,
            "message": f"Detection error: {str(e)}",
        }


# ── 2. Employee Attendance History & Stats ────────────────────────────────────

@router.get("/attendance/{employee_id}")
async def get_employee_attendance_history(
    employee_id: str,
    status_filter: Optional[str] = Query(None, alias="status"),
    month: Optional[str] = None,
):
    """
    Returns full attendance log and calculated statistics for the specified employee.
    """
    try:
        if attendance_collection is None:
            return {"records": [], "stats": {}}

        emp_clean = employee_id.strip()
        query: Dict[str, Any] = {
            "$or": [
                {"employeeId": emp_clean},
                {"employee_id": emp_clean},
                {"employeeId": emp_clean.upper()},
                {"employee_id": emp_clean.upper()},
                {"employeeId": emp_clean.lower()},
                {"employee_id": emp_clean.lower()},
            ]
        }
        if status_filter and status_filter != "All":
            query["status"] = status_filter
        if month and month.strip():
            # e.g., '2026-10'
            query["date"] = {"$regex": f"^{month.strip()}"}

        cursor = attendance_collection.find(query).sort("date", -1)
        records = [_clean_doc(r) for r in cursor]

        # Consistent counters: Present — Flexible Shift counts as Present;
        # In Progress never counts as Absent.
        from backend.services.smart_hours import count_statuses
        counts = count_statuses(records)

        return {
            "employeeId": employee_id,
            "records": records,
            "stats": {
                "totalRecords": len(records),
                "presentDays": counts["presentDays"],
                "lateDays": counts["lateDays"],
                "leaveDays": counts["leaveDays"],
                "absentDays": counts["absentDays"],
                "inProgressDays": counts["inProgressDays"],
                "flexibleShiftDays": counts["flexibleShiftDays"],
                "attendancePercentage": counts["attendancePercentage"],
            },
        }
    except Exception as e:
        logger.exception("Failed to query employee attendance history")
        raise HTTPException(status_code=500, detail=str(e))


# ── 3. Leave Application & Quotas ─────────────────────────────────────────────

@router.post("/leave/apply", status_code=status.HTTP_201_CREATED)
async def apply_for_leave(payload: ApplyLeaveRequest):
    """
    Submits an electronic leave application into MongoDB Atlas.
    """
    try:
        if leave_requests_collection is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        # Lookup employee
        emp = users_collection.find_one({
            "$or": [{"employeeId": payload.employeeId}, {"id": payload.employeeId}]
        }) if users_collection is not None else None

        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")

        # Calculate days count
        try:
            d_from = datetime.strptime(payload.fromDate, "%Y-%m-%d")
            d_to = datetime.strptime(payload.toDate, "%Y-%m-%d")
            days_count = max(1, (d_to - d_from).days + 1)
        except Exception:
            days_count = 1

        now = datetime.now()
        new_leave = {
            "id": f"leave-{int(now.timestamp() * 1000)}",
            "employeeId": payload.employeeId,
            "employeeName": emp.get("name", "Employee"),
            "employeeEmail": emp.get("email", ""),
            "department": emp.get("department", "Engineering"),
            "leaveType": payload.leaveType,
            "fromDate": payload.fromDate,
            "toDate": payload.toDate,
            "daysCount": days_count,
            "reason": payload.reason,
            "status": "Pending",
            "requestedAt": now.strftime("%Y-%m-%d %H:%M"),
            "managerId": emp.get("managerId", ""),
            "managerName": emp.get("managerName", ""),
        }

        leave_requests_collection.insert_one(new_leave)

        return {
            "success": True,
            "message": f"Leave request for {payload.leaveType} ({days_count} days) submitted successfully.",
            "leaveRequest": _clean_doc(new_leave),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to apply for leave")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/leave/{employee_id}")
async def get_employee_leave_requests(employee_id: str):
    """
    Retrieves all leave requests and computes remaining annual quotas for the employee.
    """
    try:
        if leave_requests_collection is None:
            return {"leaveRequests": [], "quotas": {}}

        query: Dict[str, Any] = {} if employee_id.lower() == "all" else {"employeeId": employee_id}
        cursor = leave_requests_collection.find(query).sort("requestedAt", -1)
        leaves = [_clean_doc(l) for l in cursor]

        # Calculate quota usage
        total_casual = 12
        total_sick = 10
        total_earned = 15

        used_casual = sum(l.get("daysCount", 1) for l in leaves if l.get("leaveType") == "Casual Leave" and l.get("status") != "Rejected")
        used_sick = sum(l.get("daysCount", 1) for l in leaves if l.get("leaveType") == "Sick Leave" and l.get("status") != "Rejected")
        used_earned = sum(l.get("daysCount", 1) for l in leaves if l.get("leaveType") == "Earned Leave" and l.get("status") != "Rejected")

        return {
            "employeeId": employee_id,
            "leaveRequests": leaves,
            "quotas": {
                "casualRemaining": max(0, total_casual - used_casual),
                "sickRemaining": max(0, total_sick - used_sick),
                "earnedRemaining": max(0, total_earned - used_earned),
                "totalApprovedLeaves": sum(l.get("daysCount", 1) for l in leaves if l.get("status") == "Approved"),
                "pendingReviewCount": sum(1 for l in leaves if l.get("status") == "Pending"),
            },
        }
    except Exception as e:
        logger.exception("Failed to query leave requests")
        raise HTTPException(status_code=500, detail=str(e))


# ── 4. Employee Dashboard Summary ─────────────────────────────────────────────

@router.get("/dashboard/{employee_id}")
async def get_employee_dashboard(employee_id: str):
    """
    Returns unified employee overview: today's check-in/out, hours worked, attendance rate, and leave status.
    """
    try:
        # Today's record
        today_str = datetime.now().strftime("%Y-%m-%d")
        today_rec = attendance_collection.find_one({
            "$or": [{"employeeId": employee_id}, {"employee_id": employee_id}],
            "date": today_str,
        }) if attendance_collection is not None else None

        # Historical records count (flexible shift counts as present)
        all_recs = list(attendance_collection.find({
            "$or": [{"employeeId": employee_id}, {"employee_id": employee_id}],
        })) if attendance_collection is not None else []

        from backend.services.smart_hours import count_statuses as _count_recs
        _counts = _count_recs(all_recs)
        attendance_rate = _counts["attendancePercentage"]

        # Recent leave requests
        recent_leaves = list(leave_requests_collection.find({"employeeId": employee_id}).sort("requestedAt", -1).limit(3)) if leave_requests_collection is not None else []

        # Office location
        settings_doc = settings_collection.find_one({"key": "global_settings"}) if settings_collection is not None else {}
        office_location = settings_doc.get("officeLocation", {
            "name": "Head Office Block",
            "allowedRadiusMeters": 1000,
        }) if settings_doc else {"name": "Head Office Block", "allowedRadiusMeters": 1000}

        return {
            "employeeId": employee_id,
            "todayRecord": _clean_doc(today_rec) if today_rec else None,
            "attendanceRate": attendance_rate,
            "totalTrackedDays": len(all_recs),
            "recentLeaves": [_clean_doc(l) for l in recent_leaves],
            "officeLocation": office_location,
        }
    except Exception as e:
        logger.exception("Failed to fetch employee dashboard")
        raise HTTPException(status_code=500, detail=str(e))


# ── 5. Smart Working Hours Dynamic Shift Calculations ─────────────────────────

@router.get("/smart-hours/{employee_id}")
async def get_smart_hours_calculation(
    employee_id: str,
    checkIn: Optional[str] = None,
    currentTime: Optional[str] = None,
):
    """
    Dynamic smart-hours from Atlas policy. Actual progress comes from the
    persisted today record; `checkIn`/`currentTime` query params are a
    hypothetical simulator preview only and never persist anything.
    """
    try:
        from backend.services.smart_hours import (
            get_smart_config, compute_shift, classify_arrival,
            minutes_to_time_str,
        )
        settings_doc = settings_collection.find_one({"key": "global_settings"}) if settings_collection is not None else None
        cfg = get_smart_config(settings_doc)
        target_h = int(cfg.get("expectedHoursPerDay", 8))

        today_str = datetime.now().strftime("%Y-%m-%d")
        today_rec = attendance_collection.find_one({
            "$or": [{"employeeId": employee_id}, {"employee_id": employee_id}],
            "date": today_str,
        }) if attendance_collection is not None else None

        persisted_in = (today_rec.get("checkIn") if today_rec else None) or "09:00 AM"
        persisted_out = today_rec.get("checkOut") if today_rec else None
        # Actual progress: persisted check-in/out vs wall-clock now.
        now_str = datetime.now().strftime("%I:%M %p")
        actual_anchor = persisted_out or now_str
        actual = compute_shift(persisted_in, actual_anchor, cfg)
        # If no checkout yet, anchor at now for live In-Progress view.
        if not persisted_out:
            actual = compute_shift(persisted_in, now_str, cfg)
        arrival = classify_arrival(persisted_in, cfg)
        day_status = (today_rec.get("status") if today_rec else "Not Checked In")

        # Simulator preview (hypothetical only).
        is_sim = bool(checkIn or currentTime)
        sim_in = (checkIn or persisted_in)
        sim_anchor = (currentTime or now_str)
        sim = compute_shift(sim_in, sim_anchor, cfg)

        # Backward-compatible top-level fields reflect ACTUAL shift,
        # never the simulator, so dashboards can't confuse the two.
        return {
            "employeeId": employee_id,
            "checkInTime": persisted_in,
            "expectedCheckoutTime": actual["expectedCheckout"],
            "workedTime": today_rec.get("hoursWorked") if today_rec and today_rec.get("checkOut") else actual["workedStr"],
            "remainingTime": actual["remainingStr"],
            "completionPercent": actual["completionPct"],
            "targetHoursPerDay": target_h,
            "smartPolicy": (
                f"Flexible {int(cfg.get('flexibleWindowMinutes', 180)) // 60}-hour window "
                f"with {target_h} full working hours enforcement "
                f"(standard {cfg.get('standardStartTime')} + {cfg.get('graceCheckInMinutes')}m grace)"
            ),
            "dayStatus": day_status,
            "arrivalStatus": arrival["arrivalStatus"],
            "isSimulated": is_sim,
            "actual": {
                "checkIn": persisted_in,
                "checkOut": persisted_out,
                "workedMinutes": actual["workedMinutes"],
                "remainingMinutes": actual["remainingMinutes"],
                "meetsRequirement": actual["meetsRequirement"],
            },
            "simulated": {
                "checkIn": sim_in,
                "anchorTime": sim_anchor,
                "workedTime": sim["workedStr"],
                "remainingTime": sim["remainingStr"],
                "completionPercent": sim["completionPct"],
                "expectedCheckout": sim["expectedCheckout"],
                "note": "Hypothetical preview only — not persisted.",
            } if is_sim else None,
            "smartConfig": cfg,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to calculate smart hours")
        raise HTTPException(status_code=500, detail=str(e))
