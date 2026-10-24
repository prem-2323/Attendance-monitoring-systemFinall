"""
Pydantic Models for Employee Portal:
- Attendance Marking (Check-in, Check-out, Face + GPS)
- Leave Applications (Casual, Sick, Personal, Earned)
- Smart Hours Shift Calculations
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class MarkAttendanceRequest(BaseModel):
    employeeId: str = Field(..., min_length=1)
    isCheckOut: bool = False
    distanceMeters: float = 0.0
    withinRadius: bool = True
    livenessVerified: bool = True
    locationName: Optional[str] = "Head Office Block"
    faceVector: Optional[str] = None
    faceImageBase64: Optional[str] = None
    # Live GPS fix — when supplied, the server enforces the office
    # geofence BOX (point-in-polygon) instead of the legacy radius check.
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ApplyLeaveRequest(BaseModel):
    employeeId: str = Field(..., min_length=1)
    leaveType: str = Field(..., min_length=2)
    fromDate: str = Field(...)
    toDate: str = Field(...)
    halfDayPeriod: Optional[str] = None
    reason: str = Field(..., min_length=3)


class SmartHoursSimulationRequest(BaseModel):
    employeeId: str = Field(..., min_length=1)
    simulatedCheckIn: Optional[str] = "11:25 AM"
    simulatedCurrentTime: Optional[str] = "05:00 PM"


class FaceDetectRequest(BaseModel):
    imageBase64: Optional[str] = Field(None, description="Base64 encoded JPEG/PNG frame from webcam")
    faceImageBase64: Optional[str] = None
    image: Optional[str] = None
    employeeId: Optional[str] = None
