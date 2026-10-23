"""
FastAPI Routes for Employee Portal:
- Employee Dashboard Overview
- Biometric Attendance Verification (Check-in & Check-out)
- Attendance History & Monthly Aggregates
- Leave Application & Tracking
- Smart Hours Dynamic Shift Calculation
"""

import base64
import cv2
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Response, status

from backend.database import (
    users_collection,
    attendance_collection,
    leave_requests_collection,
    settings_collection,
    employees_collection,
    email_notifications_collection,
)
from backend.models.employee_portal import (
    MarkAttendanceRequest,
    ApplyLeaveRequest,
    SmartHoursSimulationRequest,
    FaceDetectRequest,
)
from backend.services.face_detector import decode_image, detect_faces, crop_face
from backend.services.timezone import india_now

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


def verify_geofence_internal(latitude: float, longitude: float):
    """
    Validates GPS coordinates against the one configured office location.
    Attendance is allowed within the configured radius of its coordinates.
    """
    settings_doc = settings_collection.find_one({"key": "global_settings"}) if settings_collection is not None else None
    office_locations = settings_doc.get("officeLocations") if settings_doc else []
    loc = office_locations[0] if isinstance(office_locations, list) and office_locations else (
        settings_doc.get("officeLocation") if settings_doc else None
    )
    if not loc:
        return False, 0, "Office Campus", 0

    from backend.services.geofence import haversine_meters

    loc_name = loc.get("name", "Office Location")
    loc_radius = int(loc.get("allowedRadiusMeters", 1000))
    loc_lat = float(loc.get("lat", 11.270377))
    loc_lng = float(loc.get("lng", 77.603522))
    dist = round(haversine_meters(latitude, longitude, loc_lat, loc_lng))

    if loc.get("isActive") is False:
        return False, dist, loc_name, loc_radius

    return dist <= loc_radius, dist, loc_name, loc_radius


# ── 1. Mark Attendance (Face + GPS Check-in / Check-out) ──────────────────────

@router.post("/attendance/mark")
async def mark_employee_attendance(payload: MarkAttendanceRequest):
    """
    Records Face + GPS verified attendance check-in or check-out in MongoDB Atlas.
    """
    try:
        if attendance_collection is None:
            raise HTTPException(status_code=503, detail="Database connection unavailable")
        if settings_collection is None:
            raise HTTPException(status_code=503, detail="Smart-hours settings database unavailable")
        settings_doc = settings_collection.find_one({"key": "global_settings"})
        if settings_doc is None:
            raise HTTPException(status_code=503, detail="Smart-hours settings are not configured")

        # 1. Lookup employee in users
        emp = users_collection.find_one({
            "$or": [{"employeeId": payload.employeeId}, {"id": payload.employeeId}]
        }) if users_collection is not None else None

        if not emp:
            raise HTTPException(status_code=404, detail=f"Employee '{payload.employeeId}' not found.")

        if payload.latitude is None or payload.longitude is None:
            raise HTTPException(
                status_code=400,
                detail="GPS coordinates are required to mark attendance at the configured office.",
            )
        is_valid, dist, loc_name, allowed_radius = verify_geofence_internal(payload.latitude, payload.longitude)
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Outside the configured office geofence: your GPS position "
                    f"({payload.latitude:.6f}, {payload.longitude:.6f}) is {dist}m from "
                    f"{loc_name} (allowed radius: {allowed_radius}m)."
                ),
            )
        payload.distanceMeters = dist
        payload.withinRadius = True
        payload.locationName = loc_name

        if not payload.livenessVerified:
            raise HTTPException(
                status_code=400,
                detail="Liveness verification failed: face-presence check could not be validated.",
            )

        # 2.5 Biometric Facial Verification Check
        if payload.faceImageBase64:
            from backend.services.face_detector import decode_image, detect_faces, crop_face
            from backend.services.face_landmark import align_face
            from backend.services import face_recognition as fr_service
            import base64

            stored_emb = None
            emp_key = payload.employeeId.strip()
            lookup_query = {
                "$or": [
                    {"employeeId": emp_key},
                    {"employee_id": emp_key},
                    {"id": emp_key},
                    {"email": emp_key},
                    {"employeeId": {"$regex": f"^{emp_key}$", "$options": "i"}},
                    {"employee_id": {"$regex": f"^{emp_key}$", "$options": "i"}},
                ]
            }
            if employees_collection is not None:
                edoc = employees_collection.find_one(lookup_query)
                if edoc:
                    stored_emb = edoc.get("face_embedding") or edoc.get("faceEmbedding")
            if not stored_emb and users_collection is not None:
                udoc = users_collection.find_one(lookup_query)
                if udoc:
                    stored_emb = udoc.get("faceEmbedding") or udoc.get("face_embedding") or udoc.get("faceVector")

            raw_img = payload.faceImageBase64.strip()
            payload_b64 = raw_img.split(",", 1)[1] if "," in raw_img else raw_img
            payload_b64 = payload_b64.replace(" ", "+")
            missing_pad = len(payload_b64) % 4
            if missing_pad:
                payload_b64 += "=" * (4 - missing_pad)

            try:
                img_bytes = base64.b64decode(payload_b64)
            except Exception:
                img_bytes = b""

            img_bgr = decode_image(img_bytes) if img_bytes else None
            if img_bgr is not None:
                dets = detect_faces(img_bgr)
                if not dets:
                    raise HTTPException(
                        status_code=400,
                        detail="No human face visible in attendance verification snapshot. Please align your face inside camera viewport.",
                    )
                best_det = max(dets, key=lambda d: d.get("confidence", 0.9))
                aligned_face = align_face(img_bgr, best_det["box"])
                if aligned_face is not None:
                    rgb_face = aligned_face
                else:
                    crop = crop_face(img_bgr, best_det["box"])
                    rgb_face = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB) if (crop is not None and crop.size > 0) else cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

                live_emb = fr_service.get_face_embedding(rgb_face)
                if live_emb is None:
                    live_emb = fr_service.get_face_embedding(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))

                if stored_emb and isinstance(stored_emb, list) and len(stored_emb) > 0:
                    if live_emb is not None:
                        sim = fr_service.compute_similarity(live_emb, stored_emb)
                        is_match_res, _ = fr_service.is_match(live_emb, stored_emb, threshold=0.50)
                        if not is_match_res or sim < 0.50:
                            bgr_face = cv2.cvtColor(rgb_face, cv2.COLOR_RGB2BGR)
                            alt_emb = fr_service.get_face_embedding(bgr_face)
                            if alt_emb is not None:
                                alt_sim = fr_service.compute_similarity(alt_emb, stored_emb)
                                alt_match, _ = fr_service.is_match(alt_emb, stored_emb, threshold=0.50)
                                if alt_match or alt_sim >= 0.50:
                                    is_match_res = True
                                    sim = alt_sim
                        if not is_match_res or sim < 0.50:
                            raise HTTPException(
                                status_code=403,
                                detail=f"This is not your face. Face biometric ({round(sim*100)}%) does not match registered profile.",
                            )
                elif live_emb is not None:
                    # Auto-enroll face biometrics into database profile if not previously enrolled
                    emb_list = live_emb.tolist() if hasattr(live_emb, "tolist") else list(live_emb)
                    data_url = f"data:image/jpeg;base64,{payload_b64}"
                    try:
                        if users_collection is not None:
                            users_collection.update_many(
                                lookup_query,
                                {"$set": {"faceEmbedding": emb_list, "face_embedding": emb_list, "faceRegistered": True, "avatar": data_url}},
                            )
                        if employees_collection is not None:
                            employees_collection.update_many(
                                lookup_query,
                                {"$set": {"face_embedding": emb_list, "faceEmbedding": emb_list, "faceRegistered": True}},
                            )
                    except Exception as e_reg:
                        logger.warning(f"Could not auto-enroll face in mark_attendance: {e_reg}")

        # 3. Format current time
        now = india_now()
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
            check_in_time = (existing.get("checkIn") if existing else None) or smart_cfg.get("inTime") or smart_cfg.get("standardStartTime") or "11:25 AM"
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
                "locationName": payload.locationName or loc_name,
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

            email_notification = {"status": "not_attempted", "recipient": None}
            try:
                from backend.app.email_service import (
                    queue_checkout_summary_email,
                    process_pending_emails,
                )

                email_notification = queue_checkout_summary_email(
                    employee=emp,
                    attendance_date=now.date(),
                    check_in=check_in_time,
                    check_out=formatted_time,
                    shift=shift,
                    smart_config=smart_cfg,
                    arrival_status=arrival["arrivalStatus"],
                    final_status=final_status,
                )
                event_key = email_notification.get("event_key")
                if event_key and email_notification.get("status") in ("pending", "failed"):
                    process_pending_emails(event_key=event_key)
                    queued_email = email_notifications_collection.find_one({"event_key": event_key})
                    if queued_email:
                        email_notification["status"] = str(queued_email.get("status", "pending"))
                        if email_notification["status"] == "failed":
                            email_notification["detail"] = "SMTP delivery failed. Check backend email logs."
            except Exception:
                logger.exception("[Portal] Could not send employee checkout summary email")
                email_notification = {
                    "status": "error",
                    "recipient": email_notification.get("recipient"),
                    "detail": "Checkout was recorded, but the summary email could not be processed.",
                }
            if email_notification.get("status") == "missing_email":
                email_notification["detail"] = "No employee email address is registered."
            elif email_notification.get("status") == "sent":
                email_notification["detail"] = "Checkout summary sent to the employee."
            elif email_notification.get("status") in ("pending", "sending"):
                email_notification["detail"] = "Checkout summary is queued for the employee."

            return {
                "success": True,
                "message": f"Check-out successfully recorded at {formatted_time}! Logged {hours_worked} worked. Status: {final_status}.",
                "record": _clean_doc(updated_doc),
                "emailNotification": email_notification,
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
                "locationName": payload.locationName or loc_name,
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
                from backend.app.email_service import queue_attendance_emails, process_pending_emails

                queue_attendance_emails(
                    employee=emp,
                    status="present",
                    attendance_date=now.date(),
                    check_in=now,
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
    Verifies biometrics against registered profile if employeeId is provided.
    """
    try:
        # 1. Retrieve raw base64 frame from payload
        raw_b64 = (payload.imageBase64 or payload.faceImageBase64 or payload.image or "").strip()
        if not raw_b64:
            return {
                "faceDetected": False,
                "faceMatched": False,
                "count": 0,
                "message": "Empty camera frame received. Please ensure your webcam is connected.",
            }

        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1].strip()

        # Sanitize spaces and ensure correct base64 padding
        raw_b64 = raw_b64.replace(" ", "+")
        missing_pad = len(raw_b64) % 4
        if missing_pad:
            raw_b64 += "=" * (4 - missing_pad)

        try:
            image_bytes = base64.b64decode(raw_b64)
        except Exception as b64_err:
            logger.warning(f"Base64 decode error: {b64_err}")
            return {
                "faceDetected": False,
                "faceMatched": False,
                "count": 0,
                "message": "Corrupted camera frame data received.",
            }

        if len(image_bytes) == 0:
            return {
                "faceDetected": False,
                "faceMatched": False,
                "count": 0,
                "message": "Empty frame received",
            }

        image_bgr = decode_image(image_bytes)
        if image_bgr is None or image_bgr.size == 0:
            return {
                "faceDetected": False,
                "faceMatched": False,
                "count": 0,
                "message": "Unable to decode video frame",
            }

        # 2. Detect human face in the camera frame
        detections = detect_faces(image_bgr)
        if not detections:
            return {
                "faceDetected": False,
                "faceMatched": False,
                "count": 0,
                "message": "No human face detected. Please position your face inside the camera view.",
            }

        best = max(detections, key=lambda d: d.get("confidence", 0.9))
        box = best["box"]  # (x, y, w, h)

        face_matched = True
        match_confidence = float(best.get("confidence", 0.95))
        status_msg = "Human face detected successfully"

        # 3. If employeeId provided, verify against registered database face embedding
        if payload.employeeId:
            emp_clean = payload.employeeId.strip()
            stored_emb = None
            query = {
                "$or": [
                    {"employeeId": emp_clean},
                    {"employee_id": emp_clean},
                    {"id": emp_clean},
                    {"email": emp_clean},
                    {"employeeId": {"$regex": f"^{emp_clean}$", "$options": "i"}},
                    {"employee_id": {"$regex": f"^{emp_clean}$", "$options": "i"}},
                ]
            }

            if employees_collection is not None:
                edoc = employees_collection.find_one(query)
                if edoc:
                    stored_emb = edoc.get("face_embedding") or edoc.get("faceEmbedding")

            if not stored_emb and users_collection is not None:
                udoc = users_collection.find_one(query)
                if udoc:
                    stored_emb = udoc.get("faceEmbedding") or udoc.get("face_embedding") or udoc.get("faceVector")

            from backend.services.face_landmark import align_face
            from backend.services import face_recognition as fr_service
            from backend.services.face_detector import crop_face

            # Prepare RGB face for embedding
            aligned = align_face(image_bgr, box)
            if aligned is not None:
                rgb_face = aligned
            else:
                crop = crop_face(image_bgr, box, padding=0.2)
                if crop is not None and crop.size > 0:
                    rgb_face = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                else:
                    rgb_face = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

            live_emb = fr_service.get_face_embedding(rgb_face)
            if live_emb is None:
                live_emb = fr_service.get_face_embedding(cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB))

            if stored_emb and isinstance(stored_emb, list) and len(stored_emb) > 0:
                if live_emb is not None:
                    similarity = fr_service.compute_similarity(live_emb, stored_emb)
                    is_match_res, _ = fr_service.is_match(live_emb, stored_emb, threshold=0.50)

                    # Backwards compatibility: test if stored_emb was computed with swapped color channels
                    if not is_match_res or similarity < 0.50:
                        bgr_face = cv2.cvtColor(rgb_face, cv2.COLOR_RGB2BGR)
                        alt_emb = fr_service.get_face_embedding(bgr_face)
                        if alt_emb is not None:
                            alt_sim = fr_service.compute_similarity(alt_emb, stored_emb)
                            alt_match, _ = fr_service.is_match(alt_emb, stored_emb, threshold=0.50)
                            if alt_match or alt_sim >= 0.50:
                                similarity = alt_sim
                                is_match_res = True

                    match_confidence = float(similarity)
                    if not is_match_res or similarity < 0.50:
                        face_matched = False
                        status_msg = f"This is not your face. Face biometric ({round(similarity*100)}%) does not match registered profile."
                    else:
                        face_matched = True
                        status_msg = f"Identity verified & matched with enrolled profile ({round(similarity*100)}% match)."
                else:
                    face_matched = False
                    status_msg = "Could not compute biometric signature from live face."
            else:
                # No prior face enrolled in DB: auto-enroll this live face if valid
                if live_emb is not None:
                    emb_list = live_emb.tolist() if hasattr(live_emb, "tolist") else list(live_emb)
                    data_url = f"data:image/jpeg;base64,{raw_b64}"
                    try:
                        if users_collection is not None:
                            users_collection.update_many(
                                query,
                                {"$set": {"faceEmbedding": emb_list, "face_embedding": emb_list, "faceRegistered": True, "avatar": data_url}},
                            )
                        if employees_collection is not None:
                            employees_collection.update_many(
                                query,
                                {"$set": {"face_embedding": emb_list, "faceEmbedding": emb_list, "faceRegistered": True}},
                            )
                        logger.info(f"Auto-enrolled face biometrics for {emp_clean}")
                    except Exception as enroll_err:
                        logger.warning(f"Auto-enroll error: {enroll_err}")
                    face_matched = True
                    match_confidence = float(best.get("confidence", 0.95))
                    status_msg = "Face biometrics registered and verified successfully!"
                else:
                    face_matched = True
                    status_msg = "Human face detected successfully"

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
            "confidence": round(match_confidence, 4),
            "message": status_msg,
        }
    except Exception as e:
        logger.exception("Face detection processing error")
        return {
            "faceDetected": False,
            "faceMatched": False,
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

        now = india_now()
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
        today_str = india_now().strftime("%Y-%m-%d")
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
        office_locations = [office_location]

        return {
            "employeeId": employee_id,
            "todayRecord": _clean_doc(today_rec) if today_rec else None,
            "attendanceRate": attendance_rate,
            "totalTrackedDays": len(all_recs),
            "recentLeaves": [_clean_doc(l) for l in recent_leaves],
            "officeLocation": office_location,
            "officeLocations": office_locations or [office_location],
        }
    except Exception as e:
        logger.exception("Failed to fetch employee dashboard")
        raise HTTPException(status_code=500, detail=str(e))


# ── 5. Smart Working Hours Dynamic Shift Calculations ─────────────────────────

@router.get("/smart-hours/{employee_id}")
async def get_smart_hours_calculation(
    response: Response,
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
        if settings_collection is None:
            raise HTTPException(status_code=503, detail="Smart-hours settings database unavailable")
        settings_doc = settings_collection.find_one({"key": "global_settings"})
        if settings_doc is None:
            raise HTTPException(status_code=503, detail="Smart-hours settings are not configured")
        cfg = get_smart_config(settings_doc)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        target_h = int(cfg.get("expectedHoursPerDay", 8))

        today_str = india_now().strftime("%Y-%m-%d")
        today_rec = attendance_collection.find_one({
            "$or": [{"employeeId": employee_id}, {"employee_id": employee_id}],
            "date": today_str,
        }) if attendance_collection is not None else None

        std_in_default = str(cfg.get("inTime") or cfg.get("standardStartTime") or "11:25 AM")
        std_out_default = str(cfg.get("outTime") or cfg.get("standardEndTime") or "07:25 PM")
        persisted_in = (today_rec.get("checkIn") if today_rec else None) or std_in_default
        persisted_out = today_rec.get("checkOut") if today_rec else None
        # Actual progress: persisted check-in/out vs wall-clock now.
        now_str = india_now().strftime("%I:%M %p")
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
            "inTime": std_in_default,
            "outTime": std_out_default,
            "workedTime": today_rec.get("hoursWorked") if today_rec and today_rec.get("checkOut") else actual["workedStr"],
            "remainingTime": actual["remainingStr"],
            "completionPercent": actual["completionPct"],
            "targetHoursPerDay": target_h,
            "smartPolicy": (
                f"Flexible {int(cfg.get('flexibleWindowMinutes', 180)) // 60}-hour window "
                f"with {target_h} full working hours enforcement "
                f"(Shift: {std_in_default} to {std_out_default}, +{cfg.get('graceCheckInMinutes', 15)}m grace)"
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
