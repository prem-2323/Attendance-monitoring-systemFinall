"""Canonical application timezone helpers."""
from datetime import datetime, timezone, timedelta
import logging
from typing import Iterable, Optional

# Indian Standard Time (IST) is UTC+05:30, constant year-round (no DST).
# We use timedelta(hours=5, minutes=30) so time calculations never fail or fallback to UTC
# even on minimal Linux containers, Render VMs, or Windows environments.
INDIA_OFFSET = timedelta(hours=5, minutes=30)
try:
    from zoneinfo import ZoneInfo
    INDIA_TZ = ZoneInfo("Asia/Kolkata")
except Exception:
    INDIA_TZ = timezone(INDIA_OFFSET, name="Asia/Kolkata")


class IndiaTimeFormatter(logging.Formatter):
    """Format backend log timestamps using Indian Standard Time."""

    def formatTime(self, record, datefmt=None):
        timestamp = datetime.fromtimestamp(record.created, timezone.utc).astimezone(INDIA_TZ)
        return timestamp.strftime(datefmt or "%Y-%m-%d %I:%M:%S %p %z")


def india_now() -> datetime:
    """
    Return the current time as a timezone-aware Indian Standard Time (UTC+05:30) value.
    Explicitly retrieves the UTC instant from the host clock and converts to IST.
    """
    return datetime.now(timezone.utc).astimezone(INDIA_TZ)


def india_time_24h(value: Optional[datetime] = None) -> str:
    """Return 24-hour Indian Standard Time (e.g. '09:26', '17:30')."""
    value = value or india_now()
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc).astimezone(INDIA_TZ)
    else:
        value = value.astimezone(INDIA_TZ)
    return value.strftime("%H:%M")


def india_time_12h(value: Optional[datetime] = None) -> str:
    """Return 12-hour Indian Standard Time with AM/PM (e.g. '09:26 AM', '05:30 PM')."""
    value = value or india_now()
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc).astimezone(INDIA_TZ)
    else:
        value = value.astimezone(INDIA_TZ)
    return value.strftime("%I:%M %p")


def india_timestamp(value: datetime | None = None) -> str:
    """Serialize a timestamp with an explicit Indian Standard Time offset (+05:30)."""
    value = value or india_now()
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc).astimezone(INDIA_TZ)
    else:
        value = value.astimezone(INDIA_TZ)
    return value.isoformat(timespec="milliseconds")


def parse_india_timestamp(value: datetime | str) -> datetime:
    """Parse a persisted timestamp and normalize it to Indian Standard Time."""
    if isinstance(value, str):
        s = value.strip()
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        value = datetime.fromisoformat(s)
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(INDIA_TZ)


def format_time_to_india_12h(val: Optional[str]) -> Optional[str]:
    """
    Normalize any time or ISO string into standard 12-hour Indian Time with AM/PM (e.g. '09:26 AM', '05:30 PM').
    Handles:
      - 12-hour AM/PM: '09:26 AM', '05:30 PM', '11:25 AM'
      - Legacy UTC strings (e.g. '03:56 AM', '04:00 AM', '03:15 AM') produced by UTC servers:
        adds 5h 30m offset to yield the true IST time ('09:26 AM', '09:30 AM', '08:45 AM').
      - 24-hour time: '09:26', '17:30', '14:30:00' -> '09:26 AM', '05:30 PM', '02:30 PM'
      - ISO datetime: '2026-10-28T03:56:00Z' -> converts UTC to IST -> '09:26 AM'
    """
    if not val or not isinstance(val, str):
        return None
    s = val.strip()
    if not s or s in ("--", "-"):
        return None

    # 1. Check ISO datetime first (e.g. '2026-10-28T03:56:00.000Z' or '+05:30')
    if "T" in s or s.endswith("Z"):
        try:
            ist_dt = parse_india_timestamp(s)
            return ist_dt.strftime("%I:%M %p")
        except Exception:
            pass

    # 2. Check 12-hour AM/PM (e.g. '03:56 AM', '09:26 AM', '05:30 PM')
    for fmt in ("%I:%M %p", "%I:%M%p", "%I:%M:%S %p"):
        try:
            dt = datetime.strptime(s.upper(), fmt)
            # If time is in the 00:00 to 04:59 AM range, it was recorded by a UTC container
            if dt.hour < 5:
                # Add 5 hours 30 mins to convert UTC to IST
                total_m = dt.hour * 60 + dt.minute + 330
                h24 = (total_m // 60) % 24
                m = total_m % 60
                ampm = "AM" if h24 < 12 else "PM"
                h12 = h24 % 12
                if h12 == 0:
                    h12 = 12
                return f"{h12:02d}:{m:02d} {ampm}"
            return dt.strftime("%I:%M %p")
        except ValueError:
            pass

    # 3. Check 24-hour HH:MM or HH:MM:SS
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            dt = datetime.strptime(s, fmt)
            if dt.hour < 5:
                total_m = dt.hour * 60 + dt.minute + 330
                h24 = (total_m // 60) % 24
                m = total_m % 60
                ampm = "AM" if h24 < 12 else "PM"
                h12 = h24 % 12
                if h12 == 0:
                    h12 = 12
                return f"{h12:02d}:{m:02d} {ampm}"
            ampm = "AM" if dt.hour < 12 else "PM"
            h12 = dt.hour % 12
            if h12 == 0:
                h12 = 12
            return f"{h12:02d}:{dt.minute:02d} {ampm}"
        except ValueError:
            pass

    return s


def format_time_to_india_24h(val: Optional[str]) -> Optional[str]:
    """Normalize any time into standard 24-hour Indian Time (e.g. '09:26', '17:30')."""
    if not val:
        return None
    val12 = format_time_to_india_12h(val)
    if not val12:
        return None
    try:
        dt = datetime.strptime(val12, "%I:%M %p")
        return dt.strftime("%H:%M")
    except Exception:
        return val12


def migrate_datetime_fields_to_ist_strings(collection, fields: Iterable[str]) -> int:
    """Convert legacy BSON date values in selected fields to explicit IST strings."""
    migrated = 0
    for field in fields:
        old_dates = collection.find(
            {field: {"$type": "date"}},
            {"_id": 1, field: 1},
        )
        for document in old_dates:
            value = document.get(field)
            if value is None:
                continue
            result = collection.update_one(
                {"_id": document["_id"]},
                {"$set": {field: india_timestamp(value)}},
            )
            migrated += result.modified_count
    return migrated

