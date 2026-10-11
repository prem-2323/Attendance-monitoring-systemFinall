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
    locationName: Optional[str] = "Chennai Tech Park (HQ)"
    faceVector: Optional[str] = None


class ApplyLeaveRequest(BaseModel):
    employeeId: str = Field(..., min_length=1)
    leaveType: str = Field(..., min_length=2)
    fromDate: str = Field(...)
    toDate: str = Field(...)
    reason: str = Field(..., min_length=3)


class SmartHoursSimulationRequest(BaseModel):
    employeeId: str = Field(..., min_length=1)
    simulatedCheckIn: Optional[str] = "09:00 AM"
    simulatedCurrentTime: Optional[str] = "05:00 PM"
