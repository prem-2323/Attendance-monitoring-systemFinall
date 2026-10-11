"""
Admin API Pydantic Models.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class AddEmployeeAdminRequest(BaseModel):
    name: str = Field(..., min_length=1)
    employeeId: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)
    phone: Optional[str] = "+91 "
    department: Optional[str] = "Engineering"
    managerName: Optional[str] = None
    role: Optional[str] = "employee"
    avatarUrl: Optional[str] = None
    faceRegistered: Optional[bool] = False
    faceVector: Optional[str] = None


class AddManagerAdminRequest(BaseModel):
    name: str = Field(..., min_length=1)
    employeeId: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)
    phone: Optional[str] = "+91 "
    department: Optional[str] = "Engineering"
    title: Optional[str] = "Engineering Operations Director"
    avatarUrl: Optional[str] = None
    faceRegistered: Optional[bool] = True


class AttendanceOverrideRequest(BaseModel):
    employeeId: str = Field(...)
    date: str = Field(...)
    status: str = Field(...)
    reason: str = Field(...)
    checkIn: Optional[str] = "09:00 AM"
    checkOut: Optional[str] = "06:00 PM"


class OfficeSettingsUpdateRequest(BaseModel):
    name: Optional[str] = "Chennai Tech Park (HQ)"
    address: Optional[str] = "Block B, OMR Cyber Corridor, Chennai, TN 600096"
    lat: Optional[float] = 12.9815
    lng: Optional[float] = 80.218
    allowedRadiusMeters: Optional[int] = 150


class SmartHoursUpdateRequest(BaseModel):
    expectedHoursPerDay: Optional[int] = 8
    graceCheckInMinutes: Optional[int] = 15
    standardStartTime: Optional[str] = "09:00 AM"
    flexibleWindowMinutes: Optional[int] = 180
