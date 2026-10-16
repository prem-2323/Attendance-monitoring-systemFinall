"""Smart-hours integration tests (pure logic + endpoint with mongomock)."""
import asyncio
import sys
sys.path.insert(0, ".")

from backend.services.smart_hours import (
    get_smart_config, classify_arrival, compute_shift, finalize_status,
    count_statuses, STATUS_FLEX, STATUS_IN_PROGRESS,
)

PASS = []
FAIL = []

def check(name, cond, extra=""):
    if cond:
        PASS.append(name)
        print(f"PASS {name} {extra}")
    else:
        FAIL.append(name)
        print(f"FAIL {name} {extra}")

# 1. Dynamic config defaults + validation
cfg = get_smart_config(None)
check("defaults", cfg["expectedHoursPerDay"] == 8 and cfg["graceCheckInMinutes"] == 15, str(cfg))
bad = get_smart_config({"smartHoursConfig": {"expectedHoursPerDay": 99, "graceCheckInMinutes": -5,
                                             "standardStartTime": "nonsense", "flexibleWindowMinutes": 9999}})
check("validation-clamp", bad["expectedHoursPerDay"] == 24 and bad["graceCheckInMinutes"] == 0
      and bad["standardStartTime"] == "09:00 AM" and bad["flexibleWindowMinutes"] == 720, str(bad))
custom = get_smart_config({"smartHoursConfig": {"expectedHoursPerDay": 6, "graceCheckInMinutes": 10,
                                                "standardStartTime": "10:00 AM", "flexibleWindowMinutes": 60}})
check("custom-read", custom["expectedHoursPerDay"] == 6 and custom["standardStartTime"] == "10:00 AM", str(custom))

# 2. Arrival classification
check("early-ontime", classify_arrival("08:30 AM", cfg)["arrivalStatus"] == "On Time")
check("normal-ontime", classify_arrival("09:12 AM", cfg)["arrivalStatus"] == "On Time")
check("late-arrival", classify_arrival("01:13 PM", cfg)["arrivalLate"] is True)

# 3. Shift math: 01:13 PM + 8h = 09:13 PM
s = compute_shift("01:13 PM", "09:13 PM", cfg)
check("8h-expected", s["expectedCheckout"] == "09:13 PM", s["expectedCheckout"])
check("8h-meets", s["meetsRequirement"] and s["workedMinutes"] == 480, str(s))
s2 = compute_shift("01:13 PM", "05:00 PM", cfg)
check("sim-partial", not s2["meetsRequirement"] and s2["workedMinutes"] == 227, str(s2))
# overnight
s3 = compute_shift("10:00 PM", "06:00 AM", cfg)
check("overnight", s3["workedMinutes"] == 480 and s3["meetsRequirement"], str(s3))
# missing checkout
s4 = compute_shift("01:13 PM", None, cfg)
check("missing-checkout", not s4["meetsRequirement"] and not s4["hasCheckout"], str(s4))

# 4. Finalize: late arrival + full hours -> flexible; incomplete -> Late; in-progress
st, _ = finalize_status("01:13 PM", "09:13 PM", cfg)
check("late-completed-flex", st == STATUS_FLEX, st)
st2, _ = finalize_status("01:13 PM", "05:00 PM", cfg)
check("late-incomplete-late", st2 == "Late", st2)
st3, _ = finalize_status("09:00 AM", None, cfg)
check("no-checkout-inprogress", st3 == STATUS_IN_PROGRESS, st3)
st4, _ = finalize_status("09:00 AM", "05:00 PM", cfg)
check("ontime-completed-present", st4 == "Present", st4)
st5, _ = finalize_status("09:00 AM", "11:00 AM", cfg)
check("ontime-early-late", st5 == "Late", st5)

# 5. Counters: flexible counts as present; in-progress never absent
recs = [{"status": "Present"}, {"status": STATUS_FLEX}, {"status": "Late"},
        {"status": STATUS_IN_PROGRESS}, {"status": "Absent"}, {"status": "On Leave"}]
c = count_statuses(recs)
check("counter-present", c["presentDays"] == 2, str(c))
check("counter-inprog", c["inProgressDays"] == 1 and c["absentDays"] == 1, str(c))
check("counter-pct", c["attendancePercentage"] == round((2 + 1 + 1) / 6 * 100, 1), str(c))

# 6. Endpoint integration with mongomock (mark + smart-hours + history consistency)
import mongomock
import backend.routes.employee_portal as ep

mockdb = mongomock.MongoClient()["t"]
ep.users_collection = mockdb["users"]
ep.attendance_collection = mockdb["att"]
ep.leave_requests_collection = mockdb["lv"]
ep.settings_collection = mockdb["st"]
ep.employees_collection = mockdb["emp"]
ep.settings_collection.insert_one({"key": "global_settings",
    "officeLocation": {"name": "Head Office Block", "allowedRadiusMeters": 100000},
    "geofencePolygon": [{"lat": 11.27, "lng": 77.60}, {"lat": 11.27, "lng": 77.61},
                        {"lat": 11.28, "lng": 77.61}, {"lat": 11.28, "lng": 77.60}],
    "smartHoursConfig": {"expectedHoursPerDay": 8, "graceCheckInMinutes": 15,
                         "standardStartTime": "09:00 AM", "flexibleWindowMinutes": 180}})
ep.users_collection.insert_one({"employeeId": "EMP900", "id": "u1", "name": "Test",
                                "department": "Engineering", "managerName": ""})

from backend.models.employee_portal import MarkAttendanceRequest

async def flow():
    # check-in -> In Progress (seed checkIn directly to control time)
    ep.attendance_collection.insert_one({"employeeId": "EMP900", "employee_id": "EMP900",
        "date": __import__("datetime").datetime.now().strftime("%Y-%m-%d"),
        "checkIn": "01:13 PM", "status": STATUS_IN_PROGRESS, "hoursWorked": "--", "id": "a1"})
    # smart-hours actual (no sim params) reflects persisted 01:13 PM
    sh = await ep.get_smart_hours_calculation("EMP900", None, None)
    ok_actual = sh["checkInTime"] == "01:13 PM" and sh["expectedCheckoutTime"] == "09:13 PM" \
        and sh["targetHoursPerDay"] == 8 and sh["isSimulated"] is False
    check("endpoint-actual", ok_actual, f"{sh['checkInTime']}->{sh['expectedCheckoutTime']}")
    # simulated preview must not change top-level actuals
    sh2 = await ep.get_smart_hours_calculation("EMP900", "08:30 AM", "05:00 PM")
    check("endpoint-sim-flag", sh2["isSimulated"] is True and sh2["checkInTime"] == "01:13 PM"
          and sh2["simulated"] is not None, f"top={sh2['checkInTime']} sim={sh2['simulated']['checkIn']}")
    doc = ep.attendance_collection.find_one({"employeeId": "EMP900"})
    check("sim-no-persist", doc["checkIn"] == "01:13 PM" and doc["status"] == STATUS_IN_PROGRESS, str(doc.get("status")))
    # finalize logic for full shift
    st, _ = finalize_status("01:13 PM", "09:13 PM", get_smart_config(
        ep.settings_collection.find_one({"key": "global_settings"})))
    check("endpoint-finalize", st == STATUS_FLEX, st)
    # history consistency after simulated completion update
    ep.attendance_collection.update_one({"employeeId": "EMP900"},
        {"$set": {"checkOut": "09:13 PM", "hoursWorked": "8h 00m", "status": STATUS_FLEX}})
    hist = await ep.get_employee_attendance_history("EMP900", None, None)
    check("history-flex-present", hist["stats"]["presentDays"] == 1 and hist["stats"]["lateDays"] == 0,
          str(hist["stats"]))

asyncio.run(flow())

print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
sys.exit(1 if FAIL else 0)
