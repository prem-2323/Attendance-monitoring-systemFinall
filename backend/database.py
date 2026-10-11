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
                    "avatarUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80",
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
                    "avatarUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80",
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
                    "avatarUrl": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&h=256&q=80",
                    "faceRegistered": True,
                    "joinDate": "2023-06-01",
                    "active": True,
                    "title": "Head of Product Design",
                    "password_hash": default_pw_hash,
                },
                {
                    "id": "user-emp-1",
                    "name": "John Doe",
                    "email": "john.doe@company.com",
                    "employeeId": "EMP001",
                    "role": "employee",
                    "department": "Engineering",
                    "phone": "+91 97910 11223",
                    "managerId": "user-mgr-1",
                    "managerName": "Kumar Verma",
                    "avatarUrl": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=80",
                    "faceRegistered": True,
                    "joinDate": "2024-02-15",
                    "active": True,
                    "title": "Senior Frontend Engineer",
                    "password_hash": default_pw_hash,
                },
                {
                    "id": "user-emp-2",
                    "name": "Ravi Teja",
                    "email": "ravi.teja@company.com",
                    "employeeId": "EMP002",
                    "role": "employee",
                    "department": "Engineering",
                    "phone": "+91 98412 33445",
                    "managerId": "user-mgr-1",
                    "managerName": "Kumar Verma",
                    "avatarUrl": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=256&h=256&q=80",
                    "faceRegistered": True,
                    "joinDate": "2024-05-20",
                    "active": True,
                    "title": "Backend Systems Engineer",
                    "password_hash": default_pw_hash,
                },
                {
                    "id": "user-emp-3",
                    "name": "Anu Radha",
                    "email": "anu.radha@company.com",
                    "employeeId": "EMP003",
                    "role": "employee",
                    "department": "Product & Operations",
                    "phone": "+91 99620 44556",
                    "managerId": "user-mgr-2",
                    "managerName": "Priya Sundaram",
                    "avatarUrl": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&h=256&q=80",
                    "faceRegistered": True,
                    "joinDate": "2024-03-01",
                    "active": True,
                    "title": "UX Architect",
                    "password_hash": default_pw_hash,
                },
            ]
            users_collection.insert_many(seed_data)
            print("[DB] Initial users seeded into MongoDB Atlas.")
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
    """Seed initial today and historical attendance in MongoDB Atlas if empty."""
    if attendance_collection is None:
        return
    try:
        if attendance_collection.count_documents({}) == 0:
            initial_records = [
                {
                    "id": "att-today-1",
                    "employeeId": "EMP001",
                    "employeeName": "John Doe",
                    "department": "Engineering",
                    "date": "2026-10-10",
                    "checkIn": "09:12 AM",
                    "checkOut": None,
                    "hoursWorked": "5h 42m",
                    "status": "Present",
                    "verifiedBy": "Face + GPS",
                    "locationName": "Chennai Tech Park (HQ)",
                    "distanceMeters": 38,
                    "withinRadius": True,
                    "livenessVerified": True,
                    "managerName": "Kumar Verma",
                },
                {
                    "id": "att-today-2",
                    "employeeId": "EMP002",
                    "employeeName": "Ravi Teja",
                    "department": "Engineering",
                    "date": "2026-10-10",
                    "checkIn": "12:02 PM",
                    "checkOut": None,
                    "hoursWorked": "2h 52m",
                    "status": "Working",
                    "verifiedBy": "Face + GPS",
                    "locationName": "Chennai Tech Park (HQ)",
                    "distanceMeters": 45,
                    "withinRadius": True,
                    "livenessVerified": True,
                    "managerName": "Kumar Verma",
                    "notes": "Smart Working Hours shift: Arrived 12:02 PM, expected checkout 08:02 PM",
                },
                {
                    "id": "att-today-3",
                    "employeeId": "EMP003",
                    "employeeName": "Anu Radha",
                    "department": "Product & Operations",
                    "date": "2026-10-10",
                    "checkIn": None,
                    "checkOut": None,
                    "hoursWorked": "0h",
                    "status": "On Leave",
                    "verifiedBy": "Manual Override",
                    "locationName": "Out of Office",
                    "distanceMeters": 0,
                    "withinRadius": False,
                    "livenessVerified": False,
                    "managerName": "Priya Sundaram",
                    "notes": "Approved Casual Leave (Family ceremony)",
                },
                {
                    "id": "att-today-4",
                    "employeeId": "EMP004",
                    "employeeName": "Amit Patel",
                    "department": "Product & Operations",
                    "date": "2026-10-10",
                    "checkIn": None,
                    "checkOut": None,
                    "hoursWorked": "0h",
                    "status": "Absent",
                    "verifiedBy": "Face + GPS",
                    "locationName": "No Signal",
                    "distanceMeters": 0,
                    "withinRadius": False,
                    "livenessVerified": False,
                    "managerName": "Priya Sundaram",
                },
                {
                    "id": "att-today-5",
                    "employeeId": "EMP005",
                    "employeeName": "Sarah Connor",
                    "department": "Engineering",
                    "date": "2026-10-10",
                    "checkIn": "09:05 AM",
                    "checkOut": "06:10 PM",
                    "hoursWorked": "9h 05m",
                    "status": "Present",
                    "verifiedBy": "Face + GPS",
                    "locationName": "Chennai Tech Park (HQ)",
                    "distanceMeters": 22,
                    "withinRadius": True,
                    "livenessVerified": True,
                    "managerName": "Kumar Verma",
                },
                # Historical entries
                {
                    "id": "att-hist-1",
                    "employeeId": "EMP001",
                    "employeeName": "John Doe",
                    "department": "Engineering",
                    "date": "2026-10-09",
                    "checkIn": "09:08 AM",
                    "checkOut": "06:14 PM",
                    "hoursWorked": "9h 06m",
                    "status": "Present",
                    "verifiedBy": "Face + GPS",
                    "locationName": "Chennai Tech Park (HQ)",
                    "distanceMeters": 32,
                    "withinRadius": True,
                    "livenessVerified": True,
                    "managerName": "Kumar Verma",
                },
                {
                    "id": "att-hist-2",
                    "employeeId": "EMP002",
                    "employeeName": "Ravi Teja",
                    "department": "Engineering",
                    "date": "2026-10-09",
                    "checkIn": "09:45 AM",
                    "checkOut": "06:45 PM",
                    "hoursWorked": "9h 00m",
                    "status": "Late",
                    "verifiedBy": "Face + GPS",
                    "locationName": "Chennai Tech Park (HQ)",
                    "distanceMeters": 41,
                    "withinRadius": True,
                    "livenessVerified": True,
                    "managerName": "Kumar Verma",
                },
            ]
            for rec in initial_records:
                rec["employee_id"] = rec["employeeId"]
            attendance_collection.insert_many(initial_records)
            print("[DB] Initial attendance seeded into MongoDB Atlas.")
    except Exception as e:
        print(f"[DB] Attendance seed note: {e}")

def seed_initial_audits():
    """Seed initial managerial approval audits in MongoDB Atlas if empty."""
    if approval_audits_collection is None:
        return
    try:
        if approval_audits_collection.count_documents({}) == 0:
            initial_audits = [
                {
                    "id": "audit-1",
                    "employeeId": "EMP003",
                    "employeeName": "Anu Radha",
                    "requestType": "Casual Leave (1 Day)",
                    "decision": "Approved",
                    "managerId": "user-mgr-2",
                    "managerName": "Priya Sundaram",
                    "date": "2026-10-08",
                    "time": "11:20 AM",
                    "reason": "Family ceremony Bangalore",
                    "remarks": "Approved. Design sprint deliverables completed.",
                },
                {
                    "id": "audit-2",
                    "employeeId": "EMP006",
                    "employeeName": "Vikram Singhania",
                    "requestType": "Personal Leave (1 Day)",
                    "decision": "Rejected",
                    "managerId": "user-mgr-1",
                    "managerName": "Kumar Verma",
                    "date": "2026-10-08",
                    "time": "09:10 AM",
                    "reason": "Festival travel without advance notice",
                    "remarks": "Rejected due to quarterly server release on that date.",
                },
                {
                    "id": "audit-3",
                    "employeeId": "EMP004",
                    "employeeName": "Amit Patel",
                    "requestType": "Casual Leave (1 Day)",
                    "decision": "Approved",
                    "managerId": "user-mgr-2",
                    "managerName": "Priya Sundaram",
                    "date": "2026-10-04",
                    "time": "10:15 AM",
                    "reason": "Passport renewal regional office",
                    "remarks": "Approved. Official appointment confirmed.",
                },
                {
                    "id": "audit-4",
                    "employeeId": "EMP001",
                    "employeeName": "John Doe",
                    "requestType": "Manual Attendance Regularization",
                    "decision": "Approved",
                    "managerId": "user-admin",
                    "managerName": "Rajesh Sharma",
                    "date": "2026-10-02",
                    "time": "02:45 PM",
                    "reason": "Hardware card terminal timeout at entrance",
                    "remarks": "Verified manual check-in override.",
                },
            ]
            approval_audits_collection.insert_many(initial_audits)
            print("[DB] Initial approval audits seeded into MongoDB Atlas.")
    except Exception as e:
        print(f"[DB] Audits seed note: {e}")

def seed_initial_leave_requests():
    """Seed initial leave requests in MongoDB Atlas if empty."""
    if leave_requests_collection is None:
        return
    try:
        if leave_requests_collection.count_documents({}) == 0:
            initial_leaves = [
                {
                    "id": "leave-1",
                    "employeeId": "EMP001",
                    "employeeName": "John Doe",
                    "employeeEmail": "john.doe@company.com",
                    "department": "Engineering",
                    "leaveType": "Casual Leave",
                    "fromDate": "2026-10-15",
                    "toDate": "2026-10-16",
                    "daysCount": 2,
                    "reason": "Personal family event in native town, need to travel on Thursday evening.",
                    "status": "Pending",
                    "requestedAt": "2026-10-09 14:30",
                    "managerId": "user-mgr-1",
                    "managerName": "Kumar Verma",
                },
                {
                    "id": "leave-2",
                    "employeeId": "EMP002",
                    "employeeName": "Ravi Teja",
                    "employeeEmail": "ravi.teja@company.com",
                    "department": "Engineering",
                    "leaveType": "Sick Leave",
                    "fromDate": "2026-10-12",
                    "toDate": "2026-10-12",
                    "daysCount": 1,
                    "reason": "Severe viral flu and scheduled follow-up with doctor.",
                    "status": "Pending",
                    "requestedAt": "2026-10-10 08:15",
                    "managerId": "user-mgr-1",
                    "managerName": "Kumar Verma",
                },
                {
                    "id": "leave-3",
                    "employeeId": "EMP003",
                    "employeeName": "Anu Radha",
                    "employeeEmail": "anu.radha@company.com",
                    "department": "Product & Operations",
                    "leaveType": "Casual Leave",
                    "fromDate": "2026-10-10",
                    "toDate": "2026-10-10",
                    "daysCount": 1,
                    "reason": "Attending cousin wedding ceremony in Bangalore.",
                    "status": "Approved",
                    "requestedAt": "2026-10-07 10:00",
                    "managerId": "user-mgr-2",
                    "managerName": "Priya Sundaram",
                    "reviewedAt": "2026-10-08 11:20",
                    "reviewRemarks": "Approved. UX sprint handoff complete with design team.",
                },
                {
                    "id": "leave-4",
                    "employeeId": "EMP006",
                    "employeeName": "Vikram Singhania",
                    "employeeEmail": "vikram.s@company.com",
                    "department": "Engineering",
                    "leaveType": "Personal",
                    "fromDate": "2026-10-08",
                    "toDate": "2026-10-08",
                    "daysCount": 1,
                    "reason": "Festival travel without advance notice during critical release.",
                    "status": "Rejected",
                    "requestedAt": "2026-10-07 17:45",
                    "managerId": "user-mgr-1",
                    "managerName": "Kumar Verma",
                    "reviewedAt": "2026-10-08 09:10",
                    "reviewRemarks": "Rejected due to quarterly server migration on that date.",
                },
                {
                    "id": "leave-5",
                    "employeeId": "EMP004",
                    "employeeName": "Amit Patel",
                    "employeeEmail": "amit.patel@company.com",
                    "department": "Product & Operations",
                    "leaveType": "Casual Leave",
                    "fromDate": "2026-10-05",
                    "toDate": "2026-10-05",
                    "daysCount": 1,
                    "reason": "Urgent passport renewal appointment at regional passport office.",
                    "status": "Approved",
                    "requestedAt": "2026-10-03 16:00",
                    "managerId": "user-mgr-2",
                    "managerName": "Priya Sundaram",
                    "reviewedAt": "2026-10-04 10:15",
                    "reviewRemarks": "Approved. Official appointment receipt verified.",
                },
            ]
            leave_requests_collection.insert_many(initial_leaves)
            print("[DB] Initial leave requests seeded into MongoDB Atlas.")
    except Exception as e:
        print(f"[DB] Leave seed note: {e}")

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
        seed_initial_attendance()
        seed_initial_audits()
        seed_initial_leave_requests()
    except Exception as idx_err:
        print(f"[DB] Index note: {idx_err}")


