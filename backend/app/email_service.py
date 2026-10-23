"""
Email Notification Service for Attendance Monitoring System.
Stores and tracks notifications exclusively in MongoDB Atlas.
"""
import os
import smtplib
import logging
from datetime import datetime, date
from email.message import EmailMessage
from typing import Optional, Dict, Any
from zoneinfo import ZoneInfo
from pymongo.errors import DuplicateKeyError

from backend.database import (
    users_collection,
    employees_collection,
    email_notifications_collection,
)

logger = logging.getLogger("email_service")
TZ_NAME = os.getenv("TIMEZONE", "Asia/Kolkata")
TZ = ZoneInfo(TZ_NAME)


def send_email(recipient: str, subject: str, body: str):
    """
    Send an email via Gmail SMTP (or configured SMTP server).
    """
    mail_from = os.environ.get("MAIL_FROM") or os.environ.get("SMTP_USERNAME") or "noreply@attendance.com"
    smtp_user = os.environ.get("SMTP_USERNAME", "").strip()
    smtp_pass = os.environ.get("SMTP_PASSWORD", "").strip().replace(" ", "")
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))

    if not smtp_user or smtp_user == "your-email@gmail.com" or not smtp_pass or smtp_pass == "your-16-character-app-password":
        raise ValueError(
            "SMTP credentials not configured. Please set valid SMTP_USERNAME and SMTP_PASSWORD in .env"
        )

    message = EmailMessage()
    message["From"] = mail_from
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)

    if smtp_port == 465:
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20) as smtp:
            smtp.login(smtp_user, smtp_pass)
            smtp.send_message(message)
    else:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(smtp_user, smtp_pass)
            smtp.send_message(message)

    logger.info(f"[Email] Successfully sent email to {recipient}: {subject}")


def queue_attendance_emails(
    employee: Dict[str, Any],
    status: str,
    attendance_date: date,
    check_in: Optional[datetime] = None,
):
    """
    Queue notifications for employee, admin(s), and manager into MongoDB Atlas.
    Guaranteed idempotent using unique event_key in MongoDB Atlas.
    """
    if email_notifications_collection is None:
        logger.warning("[Email] email_notifications_collection is not connected in MongoDB Atlas.")
        return

    emp_code = str(
        employee.get("employeeId")
        or employee.get("employee_id")
        or employee.get("id")
        or "EMP001"
    )
    emp_name = str(employee.get("name") or employee.get("full_name") or "Employee")
    emp_email = str(employee.get("email") or "").strip()

    cutoff_str = os.getenv("ATTENDANCE_CUTOFF", "11:40")
    date_str = attendance_date.strftime("%d %B %Y")

    if check_in:
        if check_in.tzinfo is None:
            check_in_local = check_in.replace(tzinfo=TZ)
        else:
            check_in_local = check_in.astimezone(TZ)
        time_str = check_in_local.strftime("%I:%M %p")
    else:
        time_str = "--"

    # 1. Fetch Manager from MongoDB Atlas users_collection
    manager = None
    manager_id = employee.get("managerId") or employee.get("manager_id")
    manager_name = employee.get("managerName")
    if users_collection is not None and (manager_id or manager_name):
        manager_query = {"$or": []}
        if manager_id:
            manager_query["$or"].extend([
                {"employeeId": str(manager_id)},
                {"employee_id": str(manager_id)},
                {"id": str(manager_id)},
            ])
        if manager_name:
            manager_query["$or"].append({"name": manager_name})
        manager = users_collection.find_one(manager_query)

    # 2. Fetch Admins from MongoDB Atlas users_collection
    admins = []
    if users_collection is not None:
        admins = list(
            users_collection.find({
                "role": "admin",
                "active": {"$ne": False},
            })
        )

    notifications_to_queue = []

    if status.lower() == "present":
        # --- Present: Employee Confirmation ---
        emp_subject = "Attendance Marked – Present"
        emp_body = (
            f"Subject: Attendance Marked – Present\n\n"
            f"Dear {emp_name},\n\n"
            f"Your attendance has been successfully recorded.\n\n"
            f"Employee ID: {emp_code}\n"
            f"Date: {date_str}\n"
            f"Check-in Time: {time_str}\n"
            f"Status: Present\n\n"
            f"Regards,\n"
            f"Attendance Monitoring System"
        )
        if emp_email:
            notifications_to_queue.append({
                "recipient": emp_email,
                "role": "employee",
                "subject": emp_subject,
                "body": emp_body,
            })

        # --- Present: Manager Notification ---
        if manager and manager.get("email"):
            mgr_name = manager.get("name", "Manager")
            mgr_subject = f"Team Attendance Notification: {emp_name} – Present"
            mgr_body = (
                f"Dear {mgr_name},\n\n"
                f"Your team member's attendance has been successfully recorded.\n\n"
                f"Employee: {emp_name}\n"
                f"Employee ID: {emp_code}\n"
                f"Date: {date_str}\n"
                f"Check-in Time: {time_str}\n"
                f"Status: Present\n\n"
                f"Regards,\n"
                f"Attendance Monitoring System"
            )
            notifications_to_queue.append({
                "recipient": manager["email"],
                "role": "manager",
                "subject": mgr_subject,
                "body": mgr_body,
            })

        # --- Present: Admin Update ---
        admin_subject = f"Attendance Update: {emp_name} – Present"
        admin_body = (
            f"Dear Admin,\n\n"
            f"Employee attendance has been successfully recorded.\n\n"
            f"Employee: {emp_name}\n"
            f"Employee ID: {emp_code}\n"
            f"Date: {date_str}\n"
            f"Check-in Time: {time_str}\n"
            f"Status: Present\n\n"
            f"Regards,\n"
            f"Attendance Monitoring System"
        )

        if admins:
            for adm in admins:
                if adm.get("email"):
                    notifications_to_queue.append({
                        "recipient": adm["email"],
                        "role": f"admin_{adm.get('employeeId', 'adm')}",
                        "subject": admin_subject,
                        "body": admin_body,
                    })
        else:
            fallback_admin = os.getenv("ADMIN_EMAIL") or os.getenv("MAIL_FROM")
            if fallback_admin and fallback_admin != "your-email@gmail.com":
                notifications_to_queue.append({
                    "recipient": fallback_admin,
                    "role": "admin_fallback",
                    "subject": admin_subject,
                    "body": admin_body,
                })

    elif status.lower() == "absent":
        # --- Absent: Employee Absence Alert ---
        emp_subject = "Attendance Alert – Marked Absent"
        emp_body = (
            f"Dear {emp_name},\n\n"
            f"You have been marked Absent for {date_str} as no check-in was recorded before the attendance deadline ({cutoff_str}).\n\n"
            f"Employee ID: {emp_code}\n"
            f"Date: {date_str}\n"
            f"Status: Absent\n\n"
            f"If this is an error or you arrived late, please submit your check-in immediately or contact HR/Admin.\n\n"
            f"Regards,\n"
            f"Attendance Monitoring System"
        )
        if emp_email:
            notifications_to_queue.append({
                "recipient": emp_email,
                "role": "employee",
                "subject": emp_subject,
                "body": emp_body,
            })

        # --- Absent: Manager Absence Alert ---
        if manager and manager.get("email"):
            mgr_name = manager.get("name", "Manager")
            mgr_subject = f"Team Absence Alert: {emp_name} – Absent"
            mgr_body = (
                f"Dear {mgr_name},\n\n"
                f"Your team member {emp_name} (ID: {emp_code}) has been marked Absent for {date_str} "
                f"after passing the cutoff deadline ({cutoff_str}).\n\n"
                f"Regards,\n"
                f"Attendance Monitoring System"
            )
            notifications_to_queue.append({
                "recipient": manager["email"],
                "role": "manager",
                "subject": mgr_subject,
                "body": mgr_body,
            })

        # --- Absent: Admin Absence Report ---
        admin_subject = f"Absence Report: {emp_name} – Absent"
        admin_body = (
            f"Dear Admin,\n\n"
            f"Employee {emp_name} (ID: {emp_code}) has been marked Absent for {date_str} "
            f"after the attendance deadline ({cutoff_str}).\n\n"
            f"Regards,\n"
            f"Attendance Monitoring System"
        )

        if admins:
            for adm in admins:
                if adm.get("email"):
                    notifications_to_queue.append({
                        "recipient": adm["email"],
                        "role": f"admin_{adm.get('employeeId', 'adm')}",
                        "subject": admin_subject,
                        "body": admin_body,
                    })
        else:
            fallback_admin = os.getenv("ADMIN_EMAIL") or os.getenv("MAIL_FROM")
            if fallback_admin and fallback_admin != "your-email@gmail.com":
                notifications_to_queue.append({
                    "recipient": fallback_admin,
                    "role": "admin_fallback",
                    "subject": admin_subject,
                    "body": admin_body,
                })

    # Persist notifications to MongoDB Atlas with unique event_key
    for item in notifications_to_queue:
        recipient = item["recipient"].strip()
        if not recipient:
            continue
        event_key = f"{attendance_date.isoformat()}:{emp_code}:{status.lower()}:{item['role']}:{recipient.lower()}"

        existing = email_notifications_collection.find_one({"event_key": event_key})
        if existing:
            continue

        doc = {
            "event_key": event_key,
            "recipient": recipient,
            "role": item["role"],
            "subject": item["subject"],
            "body": item["body"],
            "status": "pending",
            "attempts": 0,
            "last_error": None,
            "created_at": datetime.utcnow(),
            "sent_at": None,
        }

        try:
            email_notifications_collection.insert_one(doc)
            logger.info(f"[EmailQueue] Queued MongoDB Atlas notification {event_key}")
        except DuplicateKeyError:
            pass  # Already queued by another process
        except Exception as e:
            logger.error(f"[EmailQueue] Error queuing notification in MongoDB Atlas: {e}")


def process_pending_emails(limit: int = 50):
    """
    Send queued emails and retain failures for retry in MongoDB Atlas.
    """
    if email_notifications_collection is None:
        return

    cursor = email_notifications_collection.find(
        {
            "status": {"$in": ["pending", "failed"]},
            "attempts": {"$lt": 5},
        }
    ).limit(limit)

    notifications = list(cursor)

    for notif in notifications:
        notif_id = notif["_id"]
        # Claim notification atomically
        email_notifications_collection.update_one(
            {"_id": notif_id},
            {
                "$set": {"status": "sending"},
                "$inc": {"attempts": 1},
            },
        )

        attempts_now = notif.get("attempts", 0) + 1
        try:
            send_email(
                notif["recipient"],
                notif["subject"],
                notif["body"],
            )
            email_notifications_collection.update_one(
                {"_id": notif_id},
                {
                    "$set": {
                        "status": "sent",
                        "sent_at": datetime.utcnow(),
                        "last_error": None,
                    }
                },
            )
        except Exception as exc:
            err_msg = str(exc)[:1000]
            email_notifications_collection.update_one(
                {"_id": notif_id},
                {
                    "$set": {
                        "status": "failed",
                        "last_error": err_msg,
                    }
                },
            )
            logger.warning(
                f"[Email] Failed sending to {notif['recipient']} "
                f"(attempt {attempts_now}/5): {exc}"
            )
