"""
Seed initial test records for Attendance Email Notification System into MongoDB Atlas.
Creates:
1. Priya (role: employee, employeeId: "1", managerId: "2", managerName: "Ravi")
2. Ravi (role: manager, employeeId: "2")
3. Admin account (role: admin, employeeId: "3")
"""
import sys
from pathlib import Path
from datetime import datetime

_APP_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _APP_DIR.parent
_ROOT_DIR = _BACKEND_DIR.parent
for _p in [str(_APP_DIR), str(_BACKEND_DIR), str(_ROOT_DIR)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from backend.database import users_collection


def seed():
    if users_collection is None:
        print("[SEED ERROR] MongoDB Atlas connection unavailable.")
        return

    # 1. Seed / Update Ravi (Manager)
    ravi = users_collection.find_one({"email": "ravi.manager@example.com"})
    if not ravi:
        ravi_doc = {
            "id": "2",
            "employeeId": "2",
            "employee_id": "2",
            "name": "Ravi",
            "email": "ravi.manager@example.com",
            "role": "manager",
            "department": "Engineering",
            "phone": "+91 9876543210",
            "active": True,
            "joinDate": datetime.utcnow().strftime("%Y-%m-%d"),
        }
        users_collection.insert_one(ravi_doc)
        print("[SEED] Created Manager: Ravi (ID: 2) in MongoDB Atlas")
    else:
        print(f"[SEED] Manager Ravi already exists in MongoDB Atlas")

    # 2. Seed / Update Priya (Employee) with managerId = 2
    priya = users_collection.find_one({"email": "priya.employee@example.com"})
    if not priya:
        priya_doc = {
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
            "joinDate": datetime.utcnow().strftime("%Y-%m-%d"),
        }
        users_collection.insert_one(priya_doc)
        print("[SEED] Created Employee: Priya (ID: 1, Manager: Ravi) in MongoDB Atlas")
    else:
        users_collection.update_one(
            {"_id": priya["_id"]},
            {"$set": {"managerId": "2", "manager_id": "2", "managerName": "Ravi"}}
        )
        print(f"[SEED] Employee Priya already exists in MongoDB Atlas")

    # 3. Seed / Update Admin
    admin = users_collection.find_one({"email": "admin@example.com"})
    if not admin:
        admin_doc = {
            "id": "3",
            "employeeId": "3",
            "employee_id": "3",
            "name": "Admin account",
            "email": "admin@example.com",
            "role": "admin",
            "department": "System Administration",
            "phone": "+91 9876543212",
            "active": True,
            "joinDate": datetime.utcnow().strftime("%Y-%m-%d"),
        }
        users_collection.insert_one(admin_doc)
        print("[SEED] Created Admin: Admin account (ID: 3) in MongoDB Atlas")
    else:
        print(f"[SEED] Admin already exists in MongoDB Atlas")

    print("[SEED] MongoDB Atlas initial user seeding completed successfully!")


if __name__ == "__main__":
    seed()
