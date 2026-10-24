"""Smart Working Hours policy service.

Single source of truth for flexible-shift calculations.
Reads policy from MongoDB Atlas `global_settings.smartHoursConfig`
with safe validated defaults.
"""
from datetime import datetime
from typing import Dict, Any, Optional, Tuple

DEFAULT_SMART_CONFIG: Dict[str, Any] = {
    "expectedHoursPerDay": 8,
    "graceCheckInMinutes": 15,
    "standardStartTime": "11:25 AM",
    "standardEndTime": "07:25 PM",
    "inTime": "11:25 AM",
    "outTime": "07:25 PM",
    "flexibleWindowMinutes": 180,
}

STATUS_PRESENT = "Present"
STATUS_FLEX = "Present \u2014 Flexible Shift"
STATUS_HALF_DAY = "Present \u2014 Half Day Leave"
STATUS_IN_PROGRESS = "In Progress"
STATUS_LATE = "Late"

PRESENT_LIKE = ("Present", "Working", STATUS_FLEX, STATUS_HALF_DAY)


def get_smart_config(settings_doc: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Merge Atlas smartHoursConfig over safe defaults with validation."""
    cfg = dict(DEFAULT_SMART_CONFIG)
    if settings_doc:
        raw = settings_doc.get("smartHoursConfig") or {}
        if isinstance(raw, dict):
            for k in cfg:
                if raw.get(k) is not None:
                    cfg[k] = raw[k]

    # Synchronize inTime and standardStartTime
    std_in = None
    if settings_doc:
        raw = settings_doc.get("smartHoursConfig") or {}
        std_in = raw.get("inTime") or raw.get("standardStartTime") or settings_doc.get("inTime")
    if not std_in or parse_time_to_minutes(str(std_in)) is None:
        std_in = cfg.get("standardStartTime", "11:25 AM")
    std_in = str(std_in).strip()
    cfg["standardStartTime"] = std_in
    cfg["inTime"] = std_in

    # Validate
    try:
        exp = float(cfg.get("expectedHoursPerDay", 8))
    except (TypeError, ValueError):
        exp = 8.0
    cfg["expectedHoursPerDay"] = max(1.0, min(24.0, exp))
    try:
        grace = int(cfg.get("graceCheckInMinutes", 15))
    except (TypeError, ValueError):
        grace = 15
    cfg["graceCheckInMinutes"] = max(0, min(180, grace))
    try:
        flex = int(cfg.get("flexibleWindowMinutes", 180))
    except (TypeError, ValueError):
        flex = 180
    cfg["flexibleWindowMinutes"] = max(0, min(720, flex))

    # Synchronize outTime and standardEndTime
    std_out = None
    if settings_doc:
        raw = settings_doc.get("smartHoursConfig") or {}
        std_out = raw.get("outTime") or raw.get("standardEndTime") or settings_doc.get("outTime")
    if not std_out or parse_time_to_minutes(str(std_out)) is None:
        in_m = parse_time_to_minutes(std_in) or (11 * 60 + 25)
        calc_out_m = in_m + int(round(cfg["expectedHoursPerDay"] * 60))
        std_out = minutes_to_time_str(calc_out_m)
    std_out = str(std_out).strip()
    cfg["standardEndTime"] = std_out
    cfg["outTime"] = std_out

    return cfg


def get_smart_config_from_db() -> Dict[str, Any]:
    """Load live policy from Atlas (safe when DB unavailable)."""
    try:
        from backend.database import settings_collection
        if settings_collection is None:
            return dict(DEFAULT_SMART_CONFIG)
        doc = settings_collection.find_one({"key": "global_settings"})
        return get_smart_config(doc)
    except Exception:
        return dict(DEFAULT_SMART_CONFIG)


def parse_time_to_minutes(t: Optional[str]) -> Optional[int]:
    """Parse '01:13 PM' -> minutes since midnight. None when missing/invalid."""
    if not t or not isinstance(t, str):
        return None
    s = t.strip()
    if s in ("--", "-", ""):
        return None
    for fmt in ("%I:%M %p", "%I:%M%p", "%H:%M"):
        try:
            dt = datetime.strptime(s.upper().replace("  ", " "), fmt)
            return dt.hour * 60 + dt.minute
        except ValueError:
            continue
    return None


def minutes_to_time_str(total_minutes: int) -> str:
    total_minutes = total_minutes % (24 * 60)
    h24 = total_minutes // 60
    m = total_minutes % 60
    ampm = "AM" if h24 < 12 else "PM"
    h12 = h24 % 12
    if h12 == 0:
        h12 = 12
    return f"{h12:02d}:{m:02d} {ampm}"


def minutes_to_duration_str(total_minutes: int) -> str:
    total_minutes = max(0, int(total_minutes))
    return f"{total_minutes // 60}h {total_minutes % 60:02d}m"


def classify_arrival(check_in_str: Optional[str], cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Punctuality of arrival only (never the final daily status)."""
    std_str = str(cfg.get("inTime") or cfg.get("standardStartTime") or "11:25 AM")
    std_min = parse_time_to_minutes(std_str) or (11 * 60 + 25)
    grace = int(cfg.get("graceCheckInMinutes", 15))
    flex = int(cfg.get("flexibleWindowMinutes", 180))
    ci_min = parse_time_to_minutes(check_in_str)
    if ci_min is None:
        return {"arrivalStatus": "Unknown", "arrivalLate": False,
                "withinGrace": False, "withinFlex": False, "lateMinutes": 0}
    late_min = ci_min - std_min
    within_grace = late_min <= grace
    within_flex = late_min <= (grace + flex)
    return {
        "arrivalStatus": "On Time" if within_grace else "Late Arrival",
        "arrivalLate": late_min > grace,
        "withinGrace": within_grace,
        "withinFlex": within_flex,
        "lateMinutes": max(0, late_min),
    }


def compute_shift(check_in_str: Optional[str], check_out_str: Optional[str],
                  cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Actual shift math from persisted check-in/out (handles overnight)."""
    target_min = int(round(float(cfg.get("expectedHoursPerDay", 8)) * 60))
    ci_min = parse_time_to_minutes(check_in_str)
    co_min = parse_time_to_minutes(check_out_str)
    default_out = cfg.get("outTime") or cfg.get("standardEndTime") or "--"
    expected_checkout = minutes_to_time_str(ci_min + target_min) if ci_min is not None else default_out
    if ci_min is None or co_min is None:
        return {
            "targetMinutes": target_min,
            "expectedCheckout": expected_checkout,
            "workedMinutes": 0,
            "workedStr": "--" if co_min is None else "0h 00m",
            "remainingMinutes": target_min,
            "remainingStr": minutes_to_duration_str(target_min),
            "completionPct": 0,
            "meetsRequirement": False,
            "hasCheckout": co_min is not None,
        }
    worked = co_min - ci_min
    if worked < 0:
        worked += 24 * 60  # overnight
    remaining = max(0, target_min - worked)
    completion = min(100, round((worked / target_min) * 100)) if target_min else 0
    return {
        "targetMinutes": target_min,
        "expectedCheckout": expected_checkout,
        "workedMinutes": worked,
        "workedStr": minutes_to_duration_str(worked),
        "remainingMinutes": remaining,
        "remainingStr": minutes_to_duration_str(remaining) if remaining else "0h 00m",
        "completionPct": completion,
        "meetsRequirement": worked >= target_min,
        "hasCheckout": True,
    }


def finalize_status(check_in_str: Optional[str], check_out_str: Optional[str],
                     cfg: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    """Final daily status from actual hours (never from simulated time).

    - No checkout yet -> In Progress (never Absent mid-shift).
    - Meets target + on-time arrival -> Present.
    - Meets target + late arrival + flex enabled -> Present — Flexible Shift.
    - Meets target + late arrival + flex disabled -> Late.
    - Below target at checkout -> Late (policy fallback, never auto-Present).
    """
    arrival = classify_arrival(check_in_str, cfg)
    shift = compute_shift(check_in_str, check_out_str, cfg)
    if not shift["hasCheckout"]:
        return STATUS_IN_PROGRESS, {"arrival": arrival, "shift": shift}
    if shift["meetsRequirement"]:
        if cfg.get("halfDayLeaveActive"):
            return STATUS_HALF_DAY, {"arrival": arrival, "shift": shift}
        if not arrival["arrivalLate"]:
            return STATUS_PRESENT, {"arrival": arrival, "shift": shift}
        if int(cfg.get("flexibleWindowMinutes", 0)) > 0 and arrival["withinFlex"]:
            return STATUS_FLEX, {"arrival": arrival, "shift": shift}
        # Late arrival outside flex window still completed hours -> flexible
        # only when flex policy enabled at all (example 01:13 PM case).
        if int(cfg.get("flexibleWindowMinutes", 0)) > 0:
            return STATUS_FLEX, {"arrival": arrival, "shift": shift}
        return STATUS_LATE, {"arrival": arrival, "shift": shift}
    return STATUS_LATE, {"arrival": arrival, "shift": shift}


def is_present_like(status: Optional[str]) -> bool:
    return status in PRESENT_LIKE or status == STATUS_IN_PROGRESS


def count_statuses(records) -> Dict[str, int]:
    """Consistent counters used by history, dashboard, reports, manager."""
    present = late = leave = absent = inprog = flex = 0
    for r in records:
        st = (r.get("status") if isinstance(r, dict) else getattr(r, "status", None))
        if st in ("Present", "Working", STATUS_HALF_DAY):
            present += 1
        elif st == STATUS_FLEX:
            present += 1
            flex += 1
        elif st == STATUS_IN_PROGRESS:
            inprog += 1
        elif st == "Late":
            late += 1
        elif st in ("On Leave", "Half Day Leave"):
            leave += 1
        elif st == "Absent":
            absent += 1
    total = present + late + leave + absent + inprog
    denom = max(1, total)
    # In-progress staff are on premises: count as attending, never absent.
    pct = round(((present + late + inprog) / denom) * 100, 1)
    return {
        "presentDays": present,
        "lateDays": late,
        "leaveDays": leave,
        "absentDays": absent,
        "inProgressDays": inprog,
        "flexibleShiftDays": flex,
        "totalDays": total,
        "attendancePercentage": pct,
    }
