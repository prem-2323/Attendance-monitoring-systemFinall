"""
Demo script to test absence alert email to premkalai2006@gmail.com via MongoDB Atlas & Gmail SMTP.
"""
import os
import sys
from pathlib import Path
from datetime import datetime, date
from zoneinfo import ZoneInfo
from dotenv import load_dotenv

_ROOT_DIR = Path(__file__).resolve().parent
for _p in [str(_ROOT_DIR)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

load_dotenv()

from backend.database import users_collection, attendance_collection, email_notifications_collection
from backend.app.email_service import send_email, queue_attendance_emails, process_pending_emails

def run_absence_demo():
    recipient = "premkalai2006@gmail.com"
    today = date.today()
    today_str = today.strftime("%d %B %Y")
    cutoff = os.getenv("ATTENDANCE_CUTOFF", "09:30 AM")

    print("=" * 65)
    print("DEMO: EMPLOYEE NOT MARKING ATTENDANCE (ABSENCE NOTIFICATION)")
    print("=" * 65)
    print(f"Target Recipient : {recipient}")
    print(f"Work Date        : {today_str}")
    print(f"Cutoff Deadline  : {cutoff}")
    print(f"SMTP Sender      : {os.getenv('SMTP_USERNAME')}")
    print(f"SMTP Host:Port   : {os.getenv('SMTP_HOST')}:{os.getenv('SMTP_PORT')}")
    print("=" * 65)

    # 1. Prepare Employee Document
    employee_demo = {
        "employeeId": "EMP001",
        "name": "Prem",
        "email": recipient,
        "role": "employee",
        "managerName": "Operations Manager",
        "active": True,
    }

    # 2. Queue Absence Notification into MongoDB Atlas
    print("\n[Step 1] Queuing absence notification in MongoDB Atlas...")
    queue_attendance_emails(
        employee=employee_demo,
        status="absent",
        attendance_date=today,
        check_in=None,
    )

    # 3. Direct SMTP send test
    print("[Step 2] Sending live email via Gmail SMTP...")
    subject = "Attendance Alert – Marked Absent"
    body = (
        f"Subject: Attendance Alert – Marked Absent\n\n"
        f"Dear Prem,\n\n"
        f"You have been marked Absent for {today_str} as no check-in was recorded before the attendance deadline ({cutoff}).\n\n"
        f"Employee ID: EMP001\n"
        f"Date: {today_str}\n"
        f"Status: Absent\n\n"
        f"If this is an error or you arrived late, please submit your check-in immediately or contact HR/Admin.\n\n"
        f"Regards,\n"
        f"Attendance Monitoring System"
    )

    try:
        send_email(recipient=recipient, subject=subject, body=body)
        print("\n[SUCCESS] Absence email was successfully delivered to premkalai2006@gmail.com!")
    except Exception as e:
        print(f"\n[SMTP Authentication Notice] {e}")
        print("\n" + "-" * 65)
        print("WHY THIS HAPPENED:")
        print("Your .env has: SMTP_PASSWORD=23-Sep-06prem")
        print("Google DOES NOT accept standard account passwords for SMTP.")
        print("Google requires a 16-character 'App Password' generated from your account.")
        print("-" * 65)


if __name__ == "__main__":
    run_absence_demo()
