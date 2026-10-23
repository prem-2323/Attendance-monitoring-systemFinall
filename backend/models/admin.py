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
    checkIn: Optional[str] = "11:25 AM"
    checkOut: Optional[str] = "06:00 PM"


class LocationItem(BaseModel):
    id: Optional[str] = None
    name: str = "Office"
    address: Optional[str] = "Office Campus Premises"
    lat: float = 11.270377
    lng: float = 77.603522
    allowedRadiusMeters: int = 1000
    geofencePolygon: Optional[List[Dict[str, float]]] = None
    isActive: Optional[bool] = True


class OfficeLocationsUpdateRequest(BaseModel):
    locations: List[LocationItem]


class OfficeSettingsUpdateRequest(BaseModel):
    # All fields are optional so a partial update (e.g. only radius or only
    # in-time) never resets untouched settings back to hardcoded defaults.
    name: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    allowedRadiusMeters: Optional[int] = None
    geofencePolygon: Optional[List[Dict[str, float]]] = None
    inTime: Optional[str] = None
    outTime: Optional[str] = None
    locations: Optional[List[LocationItem]] = None
    officeLocations: Optional[List[LocationItem]] = None



class SmartHoursUpdateRequest(BaseModel):
    expectedHoursPerDay: Optional[float] = None
    graceCheckInMinutes: Optional[int] = None
    standardStartTime: Optional[str] = None
    standardEndTime: Optional[str] = None
    inTime: Optional[str] = None
    outTime: Optional[str] = None
    flexibleWindowMinutes: Optional[int] = None
