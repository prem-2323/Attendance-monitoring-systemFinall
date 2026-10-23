"""
Scheduled Absence Checker for Attendance Monitoring System.
Operates exclusively with MongoDB Atlas collections.
"""
import os
import sys
import logging
from pathlib import Path
from datetime import datetime, time
from zoneinfo import ZoneInfo
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

_APP_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _APP_DIR.parent
_ROOT_DIR = _BACKEND_DIR.parent
for _p in [str(_APP_DIR), str(_BACKEND_DIR), str(_ROOT_DIR)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from backend.database import users_collection, attendance_collection
from backend.app.email_service import queue_attendance_emails, process_pending_emails

load_dotenv()
logger = logging.getLogger("absence_scheduler")

TZ_NAME = os.getenv("TIMEZONE", "Asia/Kolkata")
TZ = ZoneInfo(TZ_NAME)

scheduler = BackgroundScheduler(timezone=TZ)


def get_current_cutoff() -> time:
    """Retrieve cutoff time dynamically from MongoDB Atlas settings or environment."""
    try:
        from backend.database import settings_collection
        from backend.services.smart_hours import parse_time_to_minutes
        if settings_collection is not None:
            doc = settings_collection.find_one({"key": "global_settings"})
            if doc:
                smart = doc.get("smartHoursConfig") or {}
                start_str = smart.get("inTime") or smart.get("standardStartTime") or doc.get("inTime")
                grace_mins = int(smart.get("graceCheckInMinutes", 15))
                if start_str:
                    sm = parse_time_to_minutes(start_str)
                    if sm is not None:
                        cutoff_total = (sm + grace_mins) % (24 * 60)
                        return time(cutoff_total // 60, cutoff_total % 60)
    except Exception as e:
        logger.debug(f"[AbsenceChecker] Note fetching DB cutoff: {e}")

    cutoff_str = os.getenv("ATTENDANCE_CUTOFF", "11:40")
    try:
        return time.fromisoformat(cutoff_str)
    except Exception:
        return time(11, 40)


def mark_absent_employees(force: bool = False):
    """
    Check active employees in MongoDB Atlas at or after cutoff time.
    Mark employees without an attendance record as 'absent',
    and queue absence notifications for Employee, Manager, and Admin in MongoDB Atlas.
    """
    if users_collection is None or attendance_collection is None:
        logger.warning("[AbsenceChecker] MongoDB Atlas database connection unavailable")
        return

    now = datetime.now(TZ)
    cutoff = get_current_cutoff()

    # Do not mark anyone absent before the configured deadline unless forced
    if not force and now.time().replace(tzinfo=None) < cutoff:
        return

    today_str = now.date().isoformat()

    # Query active employees from MongoDB Atlas
    employees = list(
        users_collection.find({
            "role": "employee",
            "active": {"$ne": False},
        })
    )

    for employee in employees:
        emp_id = str(
            employee.get("employeeId")
            or employee.get("employee_id")
            or employee.get("id")
        )

        attendance = attendance_collection.find_one({
            "$or": [
                {"employeeId": emp_id},
                {"employee_id": emp_id},
            ],
            "date": today_str,
        })

        if attendance is None:
            new_att = {
                "employeeId": emp_id,
                "employee_id": emp_id,
                "employeeName": employee.get("name", "Employee"),
                "name": employee.get("name", "Employee"),
                "department": employee.get("department", "General"),
                "date": today_str,
                "status": "absent",
                "checkIn": None,
                "check_in": None,
                "created_at": datetime.utcnow(),
            }
            try:
                attendance_collection.insert_one(new_att)
                logger.info(
                    f"[AbsenceChecker] Marked {employee.get('name')} (ID: {emp_id}) absent for {today_str} in MongoDB Atlas"
                )
            except Exception as e:
                logger.warning(f"[AbsenceChecker] Note inserting absent record: {e}")

            queue_attendance_emails(
                employee=employee,
                status="absent",
                attendance_date=now.date(),
                check_in=None,
            )
            process_pending_emails()


def start_scheduler():
    """Start background scheduler if not already running."""
    if not scheduler.running:
        scheduler.add_job(
            mark_absent_employees,
            trigger="cron",
            hour="*",
            minute="*",
            id="daily_absence_checker",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        scheduler.start()
        logger.info("[Scheduler] Daily absence checker started (MongoDB Atlas).")
