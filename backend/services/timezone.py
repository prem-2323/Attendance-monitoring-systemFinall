"""Canonical application timezone helpers."""
from datetime import datetime, timezone
import logging
from typing import Iterable
from zoneinfo import ZoneInfo

INDIA_TZ = ZoneInfo("Asia/Kolkata")


class IndiaTimeFormatter(logging.Formatter):
    """Format backend log timestamps using Indian Standard Time."""

    def formatTime(self, record, datefmt=None):
        timestamp = datetime.fromtimestamp(record.created, INDIA_TZ)
        return timestamp.strftime(datefmt or "%Y-%m-%d %H:%M:%S %z")


def india_now() -> datetime:
    """Return the current time as a timezone-aware Indian Standard Time value."""
    return datetime.now(INDIA_TZ)


def india_timestamp(value: datetime | None = None) -> str:
    """Serialize a timestamp with an explicit Indian Standard Time offset."""
    value = value or india_now()
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(INDIA_TZ).isoformat(timespec="milliseconds")


def parse_india_timestamp(value: datetime | str) -> datetime:
    """Parse a persisted timestamp and normalize it to Indian Standard Time."""
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(INDIA_TZ)


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
