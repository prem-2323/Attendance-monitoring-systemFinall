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
WORK_START_HOUR = int(os.getenv("WORK_START_HOUR", "9"))    # 9:00 AM
WORK_START_MINUTE = int(os.getenv("WORK_START_MINUTE", "0"))
LATE_THRESHOLD_MINUTES = int(os.getenv("LATE_THRESHOLD_MINUTES", "30"))  # 30 min grace

# API Configuration
API_TITLE = "Attendance Monitoring System"
API_DESCRIPTION = "Smart Approval Based Face Attendance System"
API_VERSION = "1.0.0"
