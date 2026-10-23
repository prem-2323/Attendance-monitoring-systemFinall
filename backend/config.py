"""
Configuration settings for the Attendance Monitoring System.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB Configuration
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
DATABASE_NAME = os.getenv("DATABASE_NAME", "attendance-monitoring-system")

# Office GPS Geofence Box (polygon — attendance allowed ONLY inside this box).
# Format: "lat,lng;lat,lng;..." corners in order around the premises.
OFFICE_NAME = os.getenv("OFFICE_NAME", "Head Office Block")
OFFICE_ADDRESS = os.getenv("OFFICE_ADDRESS", "Office Campus Premises, Tamil Nadu")
OFFICE_LAT = float(os.getenv("OFFICE_LAT", "11.27037707675975"))
OFFICE_LNG = float(os.getenv("OFFICE_LNG", "77.60352284059195"))
OFFICE_RADIUS_METERS = int(os.getenv("OFFICE_RADIUS_METERS", "1000"))
OFFICE_GEOFENCE_POLYGON = os.getenv(
    "OFFICE_GEOFENCE_POLYGON",
    "11.270872464050166,77.60414913913843;11.269939620797608,77.60419457796888;"
    "11.26989802898974,77.60290714443924;11.270798193201482,77.60284050082124",
)

# Face Recognition Configuration
FACE_MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.55"))  # Lower = stricter
FACE_CONFIDENCE_THRESHOLD = float(os.getenv("FACE_CONFIDENCE_THRESHOLD", "0.85"))

# Attendance Rules
WORK_START_HOUR = int(os.getenv("WORK_START_HOUR", "11"))    # 11:25 AM
WORK_START_MINUTE = int(os.getenv("WORK_START_MINUTE", "25"))
LATE_THRESHOLD_MINUTES = int(os.getenv("LATE_THRESHOLD_MINUTES", "15"))  # 15 min grace

# API Configuration
API_TITLE = "Attendance Monitoring System"
API_DESCRIPTION = "Smart Approval Based Face Attendance System"
API_VERSION = "1.0.0"

# ── Deployment / CORS ────────────────────────────────────────────────────────
# ENVIRONMENT=production makes a failed MongoDB connection fatal instead of
# silently falling back to an in-memory database.
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()

# Comma-separated frontend origins. Vercel production + preview URLs are also
# accepted through CORS_ORIGIN_REGEX by default.
CORS_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

# Optional single frontend URL (convenience for Render/Vercel setup).
FRONTEND_URL = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
if FRONTEND_URL and FRONTEND_URL not in CORS_ORIGINS:
    CORS_ORIGINS.append(FRONTEND_URL)

# Matches https://<project>.vercel.app and preview deployments.
CORS_ORIGIN_REGEX = os.getenv(
    "CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app"
).strip() or None
