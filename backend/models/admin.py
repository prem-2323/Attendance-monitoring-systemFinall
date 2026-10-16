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
    faceImageBase64: Optional[str] = None


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
    name: Optional[str] = "Head Office Block"
    address: Optional[str] = "Office Campus Premises, Tamil Nadu"
    lat: Optional[float] = 11.27037707675975
    lng: Optional[float] = 77.60352284059195
    allowedRadiusMeters: Optional[int] = 1000
    geofencePolygon: Optional[List[Dict[str, float]]] = None


class SmartHoursUpdateRequest(BaseModel):
    expectedHoursPerDay: Optional[int] = None
    graceCheckInMinutes: Optional[int] = None
    standardStartTime: Optional[str] = None
    flexibleWindowMinutes: Optional[int] = None
