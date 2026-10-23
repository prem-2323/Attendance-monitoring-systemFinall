"""
FastAPI Routes for Manager Portal:
- Manager Overview Dashboard
- Team Directory & Performance Rates
- Leave Review & Smart Approvals (persisting to Atlas and approval audit logs)
- Direct Report Attendance Track Record Analysis
"""

import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status

from backend.database import (
    users_collection,
    attendance_collection,
    leave_requests_collection,
    approval_audits_collection,
)
from backend.models.manager import ReviewLeavePayload
from backend.services.timezone import india_now

logger = logging.getLogger("manager_portal_routes")
router = APIRouter(tags=["Manager Portal"])


def _clean_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Helper to sanitize MongoDB documents."""
    if not doc:
        return {}
    cleaned = dict(doc)
    if "_id" in cleaned:
        cleaned["_id"] = str(cleaned["_id"])
    cleaned.pop("password_hash", None)
    return cleaned


def _resolve_manager(manager_id: str) -> Optional[Dict[str, Any]]:
    """Look up manager by user id, employeeId, or email."""
    if users_collection is None:
        return None
    return users_collection.find_one({
        "$or": [
            {"id": manager_id},
            {"employeeId": manager_id},
            {"email": manager_id},
        ]
    })


def _team_employee_ids(mgr_id_val: str, mgr_employee_id: str, mgr_name: str, mgr_dept: str) -> List[str]:
    """EmployeeIds of direct reports (same team logic as /employees endpoint)."""
    if users_collection is None:
        return []
    try:
        emp_query: Dict[str, Any] = {"role": "employee"}
        emp_query["$or"] = [
            {"managerId": mgr_id_val},
            {"managerId": mgr_employee_id},
            {"managerName": mgr_name},
            {"department": mgr_dept},
        ]
        employees = list(users_collection.find(emp_query))
        return [e.get("employeeId") for e in employees if e.get("employeeId")]
    except Exception:
        return []


def _team_leave_or(mgr_id_val: str, mgr_employee_id: str, mgr_name: str,
                   mgr_dept: str, team_emp_ids: List[str]) -> List[Dict[str, Any]]:
    """OR clauses so leaves show even when managerId/managerName were empty at apply time."""
    or_clauses: List[Dict[str, Any]] = [
        {"managerId": mgr_id_val},
        {"managerName": mgr_name},
        {"department": mgr_dept},
    ]
    if mgr_employee_id and mgr_employee_id != mgr_id_val:
        or_clauses.append({"managerId": mgr_employee_id})
    if team_emp_ids:
        or_clauses.append({"employeeId": {"$in": team_emp_ids}})
    return or_clauses


# ── 1. Manager Overview Dashboard ─────────────────────────────────────────────

@router.get("/dashboard/{manager_id}")
async def get_manager_dashboard(manager_id: str):
    """
    Returns supervising overview: team metrics, counts (present, absent, on leave, late),
    pending approvals count, and today's team roster.
    """
    try:
        manager = _resolve_manager(manager_id)
        mgr_name = manager.get("name") if manager else manager_id
        mgr_id_val = manager.get("id") if manager else manager_id
        mgr_employee_id = manager.get("employeeId") if manager else manager_id
        mgr_dept = manager.get("department", "Engineering") if manager else "Engineering"

        # 1. Query direct reports
        emp_query: Dict[str, Any] = {"role": "employee"}
        if manager_id.lower() != "all" and manager_id.lower() != "user-admin":
            emp_query["$or"] = [
                {"managerId": mgr_id_val},
                {"managerId": mgr_employee_id},
                {"managerName": mgr_name},
                {"department": mgr_dept},
            ]

        employees = list(users_collection.find(emp_query)) if users_collection is not None else []
        total_team_count = len(employees)
        emp_ids = [e.get("employeeId") for e in employees if e.get("employeeId")]

        # 2. Today's attendance for team
        today_str = india_now().strftime("%Y-%m-%d")
        att_query: Dict[str, Any] = {
            "date": today_str,
            "$or": [{"employeeId": {"$in": emp_ids}}, {"employee_id": {"$in": emp_ids}}],
        } if emp_ids else {"date": today_str}

        today_records = list(attendance_collection.find(att_query)) if attendance_collection is not None else []

        from backend.services.smart_hours import count_statuses as _count_today
        _tc = _count_today(today_records)
        present_count = _tc["presentDays"]
        late_count = _tc["lateDays"]
        on_leave_count = _tc["leaveDays"]
        in_progress_count = _tc["inProgressDays"]

        absent_count = max(0, total_team_count - (present_count + late_count + on_leave_count + in_progress_count))

        # 3. Pending leave requests count
        # Include department + team employeeIds so leaves with empty
        # managerId/managerName (common when employee registered without
        # assigning a manager) still surface for the manager.
        leave_query: Dict[str, Any] = {"status": "Pending"}
        if manager_id.lower() != "all" and manager_id.lower() != "user-admin":
            if manager is None:
                # Unresolved manager id (e.g. stale localStorage id):
                # don't over-filter — count team/dept leaves only.
                team_ids = emp_ids
                or_clauses: List[Dict[str, Any]] = [{"department": mgr_dept}]
                if team_ids:
                    or_clauses.append({"employeeId": {"$in": team_ids}})
                leave_query["$or"] = or_clauses
            else:
                leave_query["$or"] = _team_leave_or(
                    mgr_id_val, mgr_employee_id, mgr_name, mgr_dept, emp_ids
                )

        pending_leaves_count = leave_requests_collection.count_documents(leave_query) if leave_requests_collection is not None else 0

        return {
            "managerId": manager_id,
            "managerName": mgr_name,
            "department": mgr_dept,
            "totalTeamCount": total_team_count,
            "presentCount": present_count,
            "absentCount": absent_count,
            "onLeaveCount": on_leave_count,
            "lateCount": late_count,
            "inProgressCount": in_progress_count,
            "pendingLeavesCount": pending_leaves_count,
            "teamTodayAttendance": [_clean_doc(r) for r in today_records],
        }
    except Exception as e:
        logger.exception("Failed to query manager dashboard")
        raise HTTPException(status_code=500, detail=str(e))


# ── 2. Team Directory with Dynamic Attendance Rates ───────────────────────────

@router.get("/employees/{manager_id}")
async def get_manager_team_employees(manager_id: str):
    """
    Returns direct report employees under this manager, complete with dynamic attendance rates
    computed directly from attendance logs in MongoDB Atlas.
    """
    try:
        manager = _resolve_manager(manager_id)
        mgr_name = manager.get("name") if manager else manager_id
        mgr_id_val = manager.get("id") if manager else manager_id
        mgr_employee_id = manager.get("employeeId") if manager else manager_id
        mgr_dept = manager.get("department", "Engineering") if manager else "Engineering"

        emp_query: Dict[str, Any] = {"role": "employee"}
        if manager_id.lower() != "all" and manager_id.lower() != "user-admin":
            emp_query["$or"] = [
                {"managerId": mgr_id_val},
                {"managerId": mgr_employee_id},
                {"managerName": mgr_name},
                {"department": mgr_dept},
            ]

        employees = list(users_collection.find(emp_query)) if users_collection is not None else []

        enriched_team = []
        for emp in employees:
            c_emp = _clean_doc(emp)
            emp_id = c_emp.get("employeeId")

            # Calculate individual dynamic attendance rate (flexible + in-progress count as attending)
            if attendance_collection is not None and emp_id:
                history_recs = list(attendance_collection.find({
                    "$or": [{"employeeId": emp_id}, {"employee_id": emp_id}]
                }))
                from backend.services.smart_hours import count_statuses as _count_one
                _oc = _count_one(history_recs)
                tot_c = max(1, _oc["totalDays"])
                att_rate = _oc["attendancePercentage"]
            else:
                att_rate = 95.0

            c_emp["attendanceRate"] = att_rate
            enriched_team.append(c_emp)

        return enriched_team
    except Exception as e:
        logger.exception("Failed to query manager team")
        raise HTTPException(status_code=500, detail=str(e))


# ── 3. Team Leave Requests ───────────────────────────────────────────────────

@router.get("/leaves/{manager_id}")
async def get_manager_team_leaves(
    manager_id: str,
    status_filter: Optional[str] = Query(None, alias="status")
):
    """
    Fetches team leave requests pending approval or reviewed history from MongoDB Atlas.
    """
    try:
        manager = _resolve_manager(manager_id)
        mgr_name = manager.get("name") if manager else manager_id
        mgr_id_val = manager.get("id") if manager else manager_id
        mgr_employee_id = manager.get("employeeId") if manager else manager_id
        mgr_dept = manager.get("department", "Engineering") if manager else "Engineering"

        leave_query: Dict[str, Any] = {}
        if manager_id.lower() != "all" and manager_id.lower() != "user-admin":
            if manager is None:
                # Unresolved manager (stale id): fall back to department +
                # status only instead of returning zero rows.
                logger.warning(f"Manager '{manager_id}' not found in users; using department fallback")
                team_ids = _team_employee_ids(manager_id, manager_id, manager_id, mgr_dept)
                or_clauses: List[Dict[str, Any]] = [{"department": mgr_dept}]
                if team_ids:
                    or_clauses.append({"employeeId": {"$in": team_ids}})
                leave_query["$or"] = or_clauses
            else:
                team_ids = _team_employee_ids(mgr_id_val, mgr_employee_id, mgr_name, mgr_dept)
                leave_query["$or"] = _team_leave_or(
                    mgr_id_val, mgr_employee_id, mgr_name, mgr_dept, team_ids
                )

        if isinstance(status_filter, str) and status_filter and status_filter != "All":
            leave_query["status"] = status_filter

        leaves = list(leave_requests_collection.find(leave_query).sort("requestedAt", -1)) if leave_requests_collection is not None else []
        clean_leaves = [_clean_doc(l) for l in leaves]

        pending_count = sum(1 for l in clean_leaves if l.get("status") == "Pending")
        reviewed_count = sum(1 for l in clean_leaves if l.get("status") != "Pending")

        return {
            "managerId": manager_id,
            "leaveRequests": clean_leaves,
            "pendingCount": pending_count,
            "reviewedCount": reviewed_count,
        }
    except Exception as e:
        logger.exception("Failed to query team leave requests")
        raise HTTPException(status_code=500, detail=str(e))


# ── 4. Smart Leave Review & Audit Log Synchronization ─────────────────────────

@router.post("/leave/review")
async def review_leave_request(payload: ReviewLeavePayload):
    """
    Records managerial approval or rejection in MongoDB Atlas `leave_requests`,
    appends an immutable record into `approval_audits`, and updates `attendance`
    if the approved leave applies to today.
    """
    try:
        if leave_requests_collection is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        # 1. Lookup leave request
        leave_doc = leave_requests_collection.find_one({"id": payload.requestId})
        if not leave_doc:
            raise HTTPException(status_code=404, detail=f"Leave request '{payload.requestId}' not found")

        now = india_now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%I:%M %p")
        mgr_name = payload.managerName or leave_doc.get("managerName", "Manager")

        # 2. Update leave request document
        updated_leave = {
            "status": payload.decision,
            "reviewedAt": f"{date_str} {now.strftime('%H:%M')}",
            "reviewRemarks": payload.remarks or (
                "Approved after reviewing historical punctuality."
                if payload.decision == "Approved"
                else "Declined due to team schedule overlap."
            ),
            "managerName": mgr_name,
        }

        leave_requests_collection.update_one(
            {"id": payload.requestId},
            {"$set": updated_leave}
        )

        merged_leave = {**leave_doc, **updated_leave}

        # 3. Synchronize immutable record in approval_audits_collection
        if approval_audits_collection is not None:
            audit_entry = {
                "id": f"audit-{int(now.timestamp() * 1000)}",
                "employeeId": leave_doc.get("employeeId", ""),
                "employeeName": leave_doc.get("employeeName", "Employee"),
                "requestType": f"{leave_doc.get('leaveType', 'Leave')} ({leave_doc.get('daysCount', 1)} days: {leave_doc.get('fromDate')})",
                "decision": payload.decision,
                "managerId": payload.managerId or leave_doc.get("managerId", ""),
                "managerName": mgr_name,
                "date": date_str,
                "time": time_str,
                "reason": leave_doc.get("reason", "Personal request"),
                "remarks": updated_leave["reviewRemarks"],
            }
            approval_audits_collection.insert_one(audit_entry)

        # 4. If approved and covers today, reflect 'On Leave' in today's attendance
        from_date = leave_doc.get("fromDate", "")
        to_date = leave_doc.get("toDate", "")
        if payload.decision == "Approved" and from_date <= date_str <= to_date:
            if attendance_collection is not None:
                attendance_collection.update_one(
                    {
                        "$or": [
                            {"employeeId": leave_doc.get("employeeId")},
                            {"employee_id": leave_doc.get("employeeId")},
                        ],
                        "date": date_str,
                    },
                    {
                        "$set": {
                            "status": "On Leave",
                            "notes": f"Approved {leave_doc.get('leaveType', 'Leave')}",
                        }
                    },
                    upsert=False
                )

        return {
            "success": True,
            "message": f"Leave request for {leave_doc.get('employeeName')} has been {payload.decision.lower()} successfully.",
            "leaveRequest": _clean_doc(merged_leave),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to review leave request")
        raise HTTPException(status_code=500, detail=str(e))


# ── 5. Employee History Track Record Analysis ─────────────────────────────────

@router.get("/employee-history/{employee_id}")
async def get_manager_employee_history(employee_id: str):
    """
    Returns full attendance track record for modal inspection by manager before making leave decisions.
    """
    try:
        if attendance_collection is None:
            return {"records": [], "stats": {}}

        records = list(attendance_collection.find({
            "$or": [{"employeeId": employee_id}, {"employee_id": employee_id}]
        }).sort("date", -1))

        clean_records = [_clean_doc(r) for r in records]

        from backend.services.smart_hours import count_statuses as _count_hist
        _hc = _count_hist(clean_records)

        return {
            "employeeId": employee_id,
            "records": clean_records,
            "stats": {
                "totalDays": len(clean_records),
                "presentDays": _hc["presentDays"],
                "lateDays": _hc["lateDays"],
                "absentDays": _hc["absentDays"],
                "leaveDays": _hc["leaveDays"],
                "inProgressDays": _hc["inProgressDays"],
                "flexibleShiftDays": _hc["flexibleShiftDays"],
                "attendancePercentage": _hc["attendancePercentage"],
            },
        }
    except Exception as e:
        logger.exception("Failed to query employee attendance analysis")
        raise HTTPException(status_code=500, detail=str(e))
