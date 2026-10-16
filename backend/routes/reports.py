"""
Reports & Analytics API Router for the Attendance Monitoring System.
Queries MongoDB Atlas attendance and user collections to compute real-time dynamic aggregates:
- Department & Employee-level filtering
- Date-range aggregation (From Date, To Date)
- Status distribution (Present, Late, Absent, On Leave)
- Dynamic Attendance % calculation
- Detailed matching records for Table view, CSV/Excel export, and PDF printable audits
"""

import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status

from backend.database import (
    attendance_collection,
    users_collection,
)

logger = logging.getLogger("reports_routes")
router = APIRouter(tags=["Reports & Analytics"])


def _clean_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Helper to sanitize MongoDB document for JSON responses."""
    if not doc:
        return {}
    cleaned = dict(doc)
    if "_id" in cleaned:
        cleaned["_id"] = str(cleaned["_id"])
    cleaned.pop("password_hash", None)
    return cleaned


@router.get("/analytics", summary="Get comprehensive attendance analytics & report aggregates from MongoDB Atlas")
@router.get("", summary="Get attendance report data")
async def get_attendance_reports(
    department: str = Query("All", description="Filter by department or 'All'"),
    employeeId: str = Query("All", description="Filter by employeeId or 'All'"),
    fromDate: Optional[str] = Query(None, description="Start date in YYYY-MM-DD"),
    toDate: Optional[str] = Query(None, description="End date in YYYY-MM-DD"),
    status: str = Query("All", description="Filter by attendance status or 'All'"),
):
    """
    Computes real-time dynamic attendance report metrics from MongoDB Atlas:
    - Filters by department, employee, date range, and status
    - Computes presentCount, lateCount, absentCount, leaveCount, and avgAttendance
    - Returns matching list of attendance records
    """
    if attendance_collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MongoDB database is not connected.",
        )

    # 1. Build filter query
    query: Dict[str, Any] = {}

    if department and department != "All":
        query["department"] = department

    if employeeId and employeeId != "All":
        query["employeeId"] = employeeId

    if status and status != "All":
        query["status"] = status

    date_filter: Dict[str, Any] = {}
    if fromDate:
        date_filter["$gte"] = fromDate
    if toDate:
        date_filter["$lte"] = toDate
    if date_filter:
        query["date"] = date_filter

    try:
        # Fetch matching attendance records
        cursor = attendance_collection.find(query).sort([("date", -1), ("employeeName", 1)])
        raw_records = list(cursor)
        records = [_clean_doc(r) for r in raw_records]

        # Calculate counts (flexible shift counts as present; in-progress never absent)
        from backend.services.smart_hours import count_statuses as _count_statuses
        _counts = _count_statuses(records)
        present_count = _counts["presentDays"]
        late_count = _counts["lateDays"]
        leave_count = _counts["leaveDays"]
        absent_count = _counts["absentDays"]
        in_progress_count = _counts["inProgressDays"]
        flexible_count = _counts["flexibleShiftDays"]

        total_records = len(records)

        # Attendance rate includes flexible + in-progress as attending.
        avg_attendance = _counts["attendancePercentage"] if total_records > 0 else 100.0

        # Calculate total employees matching department
        emp_filter: Dict[str, Any] = {"role": "employee", "active": True}
        if department and department != "All":
            emp_filter["department"] = department
        if employeeId and employeeId != "All":
            emp_filter["employeeId"] = employeeId

        if users_collection is not None:
            total_employees = users_collection.count_documents(emp_filter)
            # If 0 (e.g. employeeId was specified or distinct users in records), fallback
            if total_employees == 0 and records:
                unique_emps = {r.get("employeeId") for r in records if r.get("employeeId")}
                total_employees = len(unique_emps)
            elif total_employees == 0:
                total_employees = users_collection.count_documents({"role": "employee"})
        else:
            total_employees = len({r.get("employeeId") for r in records if r.get("employeeId")})

        return {
            "success": True,
            "filters": {
                "department": department,
                "employeeId": employeeId,
                "fromDate": fromDate,
                "toDate": toDate,
                "status": status,
            },
            "aggregates": {
                "totalEmployees": total_employees,
                "presentCount": present_count,
                "lateCount": late_count,
                "absentCount": absent_count,
                "leaveCount": leave_count,
                "inProgressCount": in_progress_count,
                "flexibleShiftCount": flexible_count,
                "totalRecords": total_records,
                "avgAttendance": avg_attendance,
            },
            "records": records,
        }

    except Exception as e:
        logger.error(f"[Reports] Error fetching reports analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate reports analytics: {str(e)}",
        )
