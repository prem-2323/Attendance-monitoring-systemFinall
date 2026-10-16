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
approval_audits_collection     = db["approval_audits"]      if db is not None else None
leave_requests_collection      = db["leave_requests"]       if db is not None else None
email_notifications_collection = db["email_notifications"]  if db is not None else None

def seed_initial_users():
    """No-op: Seed user data removed. All user accounts are created dynamically through live registration."""
    pass

def seed_initial_settings():
    """Seed default geofence office box location and smart hours in MongoDB Atlas."""
    if settings_collection is None:
        return
    try:
        from backend.services.geofence import get_configured_polygon, polygon_centroid
        from backend.config import OFFICE_NAME, OFFICE_ADDRESS, OFFICE_RADIUS_METERS
        box = get_configured_polygon()
        c_lat, c_lng = polygon_centroid(box)
        existing = settings_collection.find_one({"key": "global_settings"})
        if existing is None:
            doc = {
                "key": "global_settings",
                "officeLocation": {
                    "name": OFFICE_NAME,
                    "address": OFFICE_ADDRESS,
                    "lat": c_lat,
                    "lng": c_lng,
                    "allowedRadiusMeters": OFFICE_RADIUS_METERS,
                },
                "geofencePolygon": [{"lat": lat, "lng": lng} for lat, lng in box],
                "smartHoursConfig": {
                    "expectedHoursPerDay": 8,
                    "graceCheckInMinutes": 15,
                    "standardStartTime": "09:00 AM",
                    "flexibleWindowMinutes": 180,
                },
            }
            settings_collection.insert_one(doc)
            print("[DB] Office geofence box settings seeded into MongoDB Atlas.")
        elif not existing.get("geofencePolygon"):
            # Backfill the box on existing deployments without touching admin edits.
            settings_collection.update_one(
                {"key": "global_settings"},
                {"$set": {"geofencePolygon": [{"lat": lat, "lng": lng} for lat, lng in box]}},
            )
            print("[DB] Office geofence box backfilled into existing settings.")
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
        if email_notifications_collection is not None:
            email_notifications_collection.create_index(
                [("event_key", ASCENDING)], unique=True, name="notification_event_key_unique"
            )
            email_notifications_collection.create_index(
                [("status", ASCENDING)], name="notification_status"
            )
        print("[DB] Indexes ensured.")
        seed_initial_users()
        seed_initial_settings()
    except Exception as idx_err:
        print(f"[DB] Index note: {idx_err}")


