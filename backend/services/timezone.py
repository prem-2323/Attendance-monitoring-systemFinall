"""Canonical application timezone helpers."""
from datetime import datetime
from zoneinfo import ZoneInfo

INDIA_TZ = ZoneInfo("Asia/Kolkata")


def india_now() -> datetime:
    """Return the current time as a timezone-aware Indian Standard Time value."""
    return datetime.now(INDIA_TZ)
