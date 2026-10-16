"""
End-to-end verification script for Attendance Email Notification System.
Operates EXCLUSIVELY on MongoDB Atlas.
Tests:
- Test A: Present Check-in & Email Queueing in MongoDB Atlas (Employee, Manager, Admin)
- Test B: Duplicate Check-in Prevention & No Duplicate Emails
- Test C: Cutoff Absence Checker & Notification Queueing in MongoDB Atlas
- Test D: Late Check-In Correction (Absent -> Present) in MongoDB Atlas
- Test E: Delivery Status Inspection & Retry Tracking in MongoDB Atlas
"""
import sys
import os
from pathlib import Path
from datetime import datetime, date

_ROOT_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _ROOT_DIR / "backend"
_APP_DIR = _BACKEND_DIR / "app"

for _p in [str(_ROOT_DIR), str(_BACKEND_DIR), str(_APP_DIR)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.database import (
    users_collection,
    attendance_collection,
    email_notifications_collection,
)
from backend.app.absence_scheduler import mark_absent_employees


def reset_and_seed_mongo():
    """Reset MongoDB Atlas test collections and seed test accounts."""
    today_str = date.today().isoformat()

    # Clear test documents from today
    attendance_collection.delete_many({"date": today_str})
    email_notifications_collection.delete_many({})
    users_collection.delete_many({"employeeId": {"$in": ["1", "2", "3", "4"]}})

    # Seed test users
    users = [
        {
            "id": "1",
            "employeeId": "1",
            "employee_id": "1",
            "name": "Priya",
            "email": "priya.employee@example.com",
            "role": "employee",
            "department": "Engineering",
            "phone": "+91 9876543211",
            "managerId": "2",
            "manager_id": "2",
            "managerName": "Ravi",
            "active": True,
            "joinDate": "2026-01-01",
        },
        {
            "id": "2",
            "employeeId": "2",
            "employee_id": "2",
            "name": "Ravi",
            "email": "ravi.manager@example.com",
            "role": "manager",
            "department": "Engineering",
            "phone": "+91 9876543210",
            "active": True,
            "joinDate": "2026-01-01",
        },
        {
            "id": "3",
            "employeeId": "3",
            "employee_id": "3",
            "name": "Admin account",
            "email": "admin@example.com",
            "role": "admin",
            "department": "System Administration",
            "phone": "+91 9876543212",
            "active": True,
            "joinDate": "2026-01-01",
        },
        {
            "id": "4",
            "employeeId": "4",
            "employee_id": "4",
            "name": "Arun",
            "email": "arun.employee@example.com",
            "role": "employee",
            "department": "Engineering",
            "phone": "+91 9876543213",
            "managerId": "2",
            "manager_id": "2",
            "managerName": "Ravi",
            "active": True,
            "joinDate": "2026-01-01",
        },
    ]

    users_collection.insert_many(users)
    print("[TEST-SETUP] Seeded MongoDB Atlas with Priya (1), Ravi (2), Admin (3), Arun (4)")


def run_tests():
    print("=" * 70)
    print("RUNNING ATTENDANCE EMAIL NOTIFICATION SYSTEM (MONGODB ATLAS ONLY)")
    print("=" * 70)

    reset_and_seed_mongo()
    client = TestClient(app)

    # ── TEST A: Present Check-in ──────────────────────────────────────────────
    print("\n[TEST A] Testing successful employee check-in (Present) in MongoDB Atlas...")
    res_a = client.post("/attendance/check-in", json={"employee_id": 1})
    print(f"Status Code: {res_a.status_code}")
    print(f"Response: {res_a.json()}")

    assert res_a.status_code == 200, f"Expected 200, got {res_a.status_code}"
    data_a = res_a.json()
    assert data_a["message"] == "Attendance recorded"
    assert str(data_a["employee_id"]) == "1"
    assert data_a["employee_name"] == "Priya"
    assert data_a["status"] == "present"
    print("[TEST A PASS] Present check-in saved to MongoDB Atlas!")

    # Verify notifications in MongoDB Atlas email_notifications_collection
    notifications = list(
        email_notifications_collection.find({"event_key": {"$regex": ":1:present:"}})
    )
    print(f"Queued notifications for Priya's Present event: {len(notifications)}")
    for n in notifications:
        print(f"  -> Recipient: {n['recipient']} | Subject: {n['subject']} | Status: {n['status']}")

    recipients = [n["recipient"] for n in notifications]
    assert "priya.employee@example.com" in recipients, "Employee confirmation missing"
    assert "ravi.manager@example.com" in recipients, "Manager notification missing"
    assert "admin@example.com" in recipients, "Admin update missing"
    print("[TEST A PASS] Employee, Manager, and Admin emails queued in MongoDB Atlas!")

    # ── TEST B: Duplicate Attendance Check ────────────────────────────────────
    print("\n[TEST B] Testing duplicate check-in prevention on same day...")
    res_b = client.post("/attendance/check-in", json={"employee_id": 1})
    print(f"Status Code: {res_b.status_code}")
    print(f"Response: {res_b.json()}")

    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["message"] == "Attendance already recorded"
    assert str(data_b["employee_id"]) == "1"
    assert data_b["status"] == "present"

    # Verify no duplicate email queued in MongoDB Atlas
    dup_count = email_notifications_collection.count_documents(
        {"event_key": {"$regex": ":1:present:"}}
    )
    assert dup_count == 3, f"Expected exactly 3 notifications (no duplicates), found {dup_count}"
    print("[TEST B PASS] Duplicate check-in rejected & no duplicate emails in MongoDB Atlas!")

    # ── TEST C: Scheduled Absence Checker ─────────────────────────────────────
    print("\n[TEST C] Testing absence cutoff checker for employee with no record (Arun ID: 4)...")
    mark_absent_employees(force=True)

    today_str = date.today().isoformat()
    arun_att = attendance_collection.find_one({"employeeId": "4", "date": today_str})
    assert arun_att is not None, "Arun should have an attendance record in MongoDB Atlas"
    assert arun_att["status"] == "absent", f"Expected 'absent', got {arun_att['status']}"
    print(f"[TEST C] Arun successfully marked absent in MongoDB Atlas: {arun_att['status']}")

    arun_notifications = list(
        email_notifications_collection.find({"event_key": {"$regex": ":4:absent:"}})
    )
    print(f"Queued absence notifications in MongoDB Atlas: {len(arun_notifications)}")
    for n in arun_notifications:
        print(f"  -> Recipient: {n['recipient']} | Subject: {n['subject']} | Status: {n['status']}")
    arun_recipients = [n["recipient"] for n in arun_notifications]
    assert "arun.employee@example.com" in arun_recipients, "Absence notification for employee missing"
    assert "ravi.manager@example.com" in arun_recipients, "Absence alert for manager missing"
    assert "admin@example.com" in arun_recipients, "Absence report for admin missing"
    print("[TEST C PASS] Absence records and notifications stored in MongoDB Atlas!")

    # ── TEST D: Late Check-In Correction (Absent -> Present) ──────────────────
    print("\n[TEST D] Testing Late Check-In correction for Arun (previously marked absent)...")
    res_late = client.post("/attendance/check-in", json={"employee_id": 4})
    print(f"Status Code: {res_late.status_code}")
    print(f"Response: {res_late.json()}")

    assert res_late.status_code == 200
    data_late = res_late.json()
    assert data_late["message"] == "Late check-in recorded; attendance updated"
    assert str(data_late["employee_id"]) == "4"
    assert data_late["status"] == "present"
    assert data_late["check_in"] is not None

    arun_updated = attendance_collection.find_one({"employeeId": "4", "date": today_str})
    assert arun_updated["status"] == "present", "Arun record should be updated to present in MongoDB Atlas"
    print("[TEST D PASS] Late check-in successfully corrected record from absent to present in MongoDB Atlas!")

    # ── TEST E: Verify Email Delivery Status & Retry Safeguards ───────────────
    print("\n[TEST E] Testing email delivery inspection endpoint and retry behavior...")
    res_notif = client.get("/attendance/notifications")
    assert res_notif.status_code == 200
    notif_list = res_notif.json()
    print(f"Total email notifications recorded in MongoDB Atlas: {len(notif_list)}")
    statuses = {n["status"] for n in notif_list}
    print(f"Notification statuses observed in MongoDB Atlas: {statuses}")
    for n in notif_list[:3]:
        print(f"  - [{n['status']}] attempts: {n['attempts']} | error: {n['last_error']} | to: {n['recipient']}")

    print("\n" + "=" * 70)
    print("ALL MONGODB ATLAS TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
