"""
MongoDB Atlas connection and collection references.
"""
import os
from pymongo import MongoClient, ASCENDING
from backend.config import MONGODB_URI, DATABASE_NAME, ENVIRONMENT

client = None
db     = None

# In development, fall back to mongomock if Atlas is unavailable. In
# production (ENVIRONMENT=production), fail fast so data never silently
# disappears into an in-memory database.
try:
    client = MongoClient(
        MONGODB_URI,
        # Atlas DNS/TLS negotiation can take longer than 5s on cold starts.
        # A too-short timeout silently drops the app onto mongomock, which
        # makes settings/attendance look like they were never saved.
        serverSelectionTimeoutMS=20000,
        connectTimeoutMS=20000,
        socketTimeoutMS=20000,
    )
    # Light connectivity check — will raise if URI is invalid or unreachable
    client.admin.command("ping")
    db = client[DATABASE_NAME]
    print(f"[DB] Connected to MongoDB — database: {DATABASE_NAME}")
except Exception as e:
    allow_mock = os.getenv("ALLOW_MONGOMOCK_FALLBACK", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    if ENVIRONMENT in ("production", "prod") and not allow_mock:
        raise RuntimeError(
            "MongoDB Atlas connection failed in production. "
            "Check MONGODB_URI, DATABASE_NAME, and Atlas Network Access "
            "(allow 0.0.0.0/0 or your Render egress IPs)."
        ) from e

    print(
        f"[DB] WARNING: Could not connect to MongoDB: {type(e).__name__}: {e}\n"
        "     Falling back to in-memory mongomock database "
        "(development only)."
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
        polygon_corners = [{"lat": lat, "lng": lng} for lat, lng in box]

        default_locations = [{
            "id": "loc-1",
            "name": "Office",
            "address": OFFICE_ADDRESS,
            "lat": c_lat,
            "lng": c_lng,
            "allowedRadiusMeters": OFFICE_RADIUS_METERS,
            "geofencePolygon": polygon_corners,
            "isActive": True,
        }]

        existing = settings_collection.find_one({"key": "global_settings"})
        if existing is None:
            doc = {
                "key": "global_settings",
                "officeLocation": default_locations[0],
                "officeLocations": default_locations,
                "geofencePolygon": polygon_corners,
                "smartHoursConfig": {
                    "expectedHoursPerDay": 8,
                    "graceCheckInMinutes": 15,
                    "standardStartTime": "11:25 AM",
                    "standardEndTime": "07:25 PM",
                    "inTime": "11:25 AM",
                    "outTime": "07:25 PM",
                    "flexibleWindowMinutes": 180,
                },
                "inTime": "11:25 AM",
                "outTime": "07:25 PM",
            }
            settings_collection.insert_one(doc)
            print("[DB] Office location and shift settings seeded into MongoDB Atlas.")
        elif not existing.get("geofencePolygon"):
            # Backfill the box on existing deployments without touching admin edits.
            settings_collection.update_one(
                {"key": "global_settings"},
                {"$set": {"geofencePolygon": polygon_corners}},
            )
            print("[DB] Office geofence box backfilled into existing settings.")

        if existing is not None:
            existing_locs = existing.get("officeLocations")
            cur_primary = (
                existing_locs[0]
                if isinstance(existing_locs, list) and existing_locs
                else existing.get("officeLocation") or {}
            )
            primary = {**default_locations[0], **cur_primary}
            primary["id"] = "loc-1"
            primary["isActive"] = True
            primary["geofencePolygon"] = (
                primary.get("geofencePolygon")
                or existing.get("geofencePolygon")
                or polygon_corners
            )
            settings_collection.update_one(
                {"key": "global_settings"},
                {"$set": {
                    "officeLocation": primary,
                    "officeLocations": [primary],
                    "geofencePolygon": primary["geofencePolygon"],
                }},
            )
            print("[DB] Existing office settings migrated to one location.")

        # Migrate legacy default shift timings (09:00 AM + 15 min grace or
        # 10:55 AM + 5 min grace) to the current policy (11:25 AM + 15 min
        # grace = 11:40 AM on-time cutoff), and ensure inTime & outTime are present.
        if existing is not None:
            smart = existing.get("smartHoursConfig") or {}
            start_val = str(smart.get("standardStartTime") or smart.get("inTime") or "11:25 AM").strip()
            end_val = str(smart.get("standardEndTime") or smart.get("outTime") or "07:25 PM").strip()
            try:
                grace_val = int(smart.get("graceCheckInMinutes", 15))
            except (TypeError, ValueError):
                grace_val = 15
            is_legacy_0900 = start_val.upper() in ("09:00 AM", "9:00 AM") and grace_val == 15
            is_legacy_1055 = start_val.upper() == "10:55 AM" and grace_val == 5
            if is_legacy_0900 or is_legacy_1055:
                start_val = "11:25 AM"
                end_val = "07:25 PM"
                grace_val = 15

            updates_to_apply = {}
            if smart.get("standardStartTime") != start_val:
                updates_to_apply["smartHoursConfig.standardStartTime"] = start_val
            if smart.get("inTime") != start_val:
                updates_to_apply["smartHoursConfig.inTime"] = start_val
            if smart.get("standardEndTime") != end_val:
                updates_to_apply["smartHoursConfig.standardEndTime"] = end_val
            if smart.get("outTime") != end_val:
                updates_to_apply["smartHoursConfig.outTime"] = end_val
            if existing.get("inTime") != start_val:
                updates_to_apply["inTime"] = start_val
            if existing.get("outTime") != end_val:
                updates_to_apply["outTime"] = end_val
            if smart.get("graceCheckInMinutes") != grace_val:
                updates_to_apply["smartHoursConfig.graceCheckInMinutes"] = grace_val

            if updates_to_apply:
                settings_collection.update_one(
                    {"key": "global_settings"},
                    {"$set": updates_to_apply},
                )
                print(f"[DB] Settings synchronized with inTime: {start_val}, outTime: {end_val}.")

        # Keep both legacy and list settings aligned with the one office location.
        doc = settings_collection.find_one({"key": "global_settings"})
        if doc:
            locs = doc.get("officeLocations") or []
            if locs:
                primary = dict(locs[0])
                primary["id"] = "loc-1"
                primary["isActive"] = True
                primary.setdefault("allowedRadiusMeters", OFFICE_RADIUS_METERS)
                if not primary.get("geofencePolygon"):
                    primary["geofencePolygon"] = polygon_corners
                if doc.get("officeLocation") != primary or len(locs) != 1:
                    settings_collection.update_one(
                        {"key": "global_settings"},
                        {"$set": {
                            "officeLocation": primary,
                            "officeLocations": [primary],
                            "geofencePolygon": primary["geofencePolygon"],
                        }},
                    )
            if not doc.get("geofencePolygon"):
                settings_collection.update_one(
                    {"key": "global_settings"},
                    {"$set": {"geofencePolygon": polygon_corners}},
                )
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

