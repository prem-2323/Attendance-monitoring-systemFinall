"""
Local MongoDB connection and collection references.
"""
from pymongo import MongoClient, ASCENDING
from backend.config import MONGODB_URI, DATABASE_NAME

client = None
db     = None

# Keep the server importable when MongoDB is unavailable; routes can report
# that the database is not connected.
try:
    client = MongoClient(
        MONGODB_URI,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        socketTimeoutMS=5000,
    )
    # Light connectivity check — will raise if URI is invalid or unreachable
    client.admin.command("ping")
    db = client[DATABASE_NAME]
    print(f"[DB] Connected to MongoDB — database: {DATABASE_NAME}")
except Exception as e:
    print(
        f"[DB] WARNING: Could not connect to real MongoDB on 27017: {type(e).__name__}: {e}\n"
        "     Falling back to in-memory mongomock database."
    )
    try:
        import mongomock
        client = mongomock.MongoClient()
        db = client[DATABASE_NAME]
        print(f"[DB] Connected to in-memory mongomock database: {DATABASE_NAME}")
    except Exception as mock_err:
        print(f"[DB] mongomock error: {mock_err}")
        client = None
        db     = None

# Collections (None when not connected — routes will return 503)
employees_collection       = db["employees"]        if db is not None else None
attendance_collection      = db["attendance"]       if db is not None else None
approval_collection        = db["approval_requests"] if db is not None else None
users_collection           = db["users"]            if db is not None else None
reset_tokens_collection    = db["reset_tokens"]     if db is not None else None
settings_collection        = db["settings"]         if db is not None else None
approval_audits_collection = db["approval_audits"]  if db is not None else None
leave_requests_collection  = db["leave_requests"]   if db is not None else None

def seed_initial_users():
    """Seed initial corporate users into MongoDB if users collection is empty."""
    if users_collection is None:
        return
    try:
        if users_collection.count_documents({}) == 0:
            from backend.services.auth_service import hash_password
            default_pw_hash = hash_password("password123")
            seed_data = [
                {
                    "id": "user-admin",
                    "name": "Rajesh Sharma",
                    "email": "admin@company.com",
                    "employeeId": "ADM001",
                    "role": "admin",
                    "department": "Executive Operations",
                    "phone": "+91 98765 43210",
                    "avatarUrl": "",
                    "faceRegistered": True,
                    "joinDate": "2023-01-15",
                    "active": True,
                    "title": "Chief Operations Administrator",
                    "password_hash": default_pw_hash,
                },
                {
                    "id": "user-mgr-1",
                    "name": "Kumar Verma",
                    "email": "kumar.verma@company.com",
                    "employeeId": "MGR001",
                    "role": "manager",
                    "department": "Engineering",
                    "phone": "+91 98401 23456",
                    "avatarUrl": "",
                    "faceRegistered": True,
                    "joinDate": "2023-04-10",
                    "active": True,
                    "title": "Engineering Director",
                    "password_hash": default_pw_hash,
                },
                {
                    "id": "user-mgr-2",
                    "name": "Priya Sundaram",
                    "email": "priya.s@company.com",
                    "employeeId": "MGR002",
                    "role": "manager",
                    "department": "Product & Operations",
                    "phone": "+91 98841 87654",
                    "avatarUrl": "",
                    "faceRegistered": True,
                    "joinDate": "2023-06-01",
                    "active": True,
                    "title": "Head of Product Design",
                    "password_hash": default_pw_hash,
                },
            ]
            users_collection.insert_many(seed_data)
            print("[DB] Initial administrative accounts seeded into MongoDB Atlas.")
    except Exception as seed_err:
        print(f"[DB] Seed note: {seed_err}")

def seed_initial_settings():
    """Seed default geofence office location and smart hours in MongoDB Atlas."""
    if settings_collection is None:
        return
    try:
        if settings_collection.count_documents({}) == 0:
            doc = {
                "key": "global_settings",
                "officeLocation": {
                    "name": "Chennai Tech Park (HQ)",
                    "address": "Block B, OMR Cyber Corridor, Chennai, TN 600096",
                    "lat": 12.9815,
                    "lng": 80.218,
                    "allowedRadiusMeters": 150,
                },
                "smartHoursConfig": {
                    "expectedHoursPerDay": 8,
                    "graceCheckInMinutes": 15,
                    "standardStartTime": "09:00 AM",
                    "flexibleWindowMinutes": 180,
                },
            }
            settings_collection.insert_one(doc)
            print("[DB] Initial settings seeded into MongoDB Atlas.")
    except Exception as e:
        print(f"[DB] Settings seed note: {e}")

def seed_initial_attendance():
    """No-op: Mock attendance data removed. All records are created dynamically through live portal actions."""
    pass


def seed_initial_audits():
    """No-op: Mock approval audits removed. Audit logs are created dynamically through manager/admin approvals."""
    pass


def seed_initial_leave_requests():
    """No-op: Mock leave requests removed. Applications are submitted dynamically by employees."""
    pass


# Create indexes only when connected
if db is not None:
    try:
        employees_collection.create_index(
            [("employee_id", ASCENDING)], unique=True, name="employee_id_unique"
        )
        attendance_collection.create_index(
            [("employeeId", ASCENDING), ("date", ASCENDING)],
            name="attendance_empid_date",
        )
        approval_collection.create_index(
            [("attendance_id", ASCENDING)], name="approval_attendance_id"
        )
        users_collection.create_index(
            [("email", ASCENDING)], unique=True, name="user_email_unique"
        )
        users_collection.create_index(
            [("employeeId", ASCENDING)], unique=True, name="user_employee_id_unique"
        )
        reset_tokens_collection.create_index(
            [("identifier", ASCENDING)], name="reset_tokens_identifier"
        )
        approval_audits_collection.create_index(
            [("date", ASCENDING)], name="audit_date"
        )
        leave_requests_collection.create_index(
            [("employeeId", ASCENDING), ("fromDate", ASCENDING)], name="leave_empid_date"
        )
        print("[DB] Indexes ensured.")
        seed_initial_users()
        seed_initial_settings()
    except Exception as idx_err:
        print(f"[DB] Index note: {idx_err}")


