"""
Authentication Pydantic Models.
"""
from typing import Optional
from pydantic import BaseModel, Field


class AdminRegisterRequest(BaseModel):
    name: str = Field(..., min_length=1)
    employeeId: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)
    phone: Optional[str] = "+91 "
    department: Optional[str] = "System Administration"
    password: Optional[str] = "password123"
    securityPasskey: str = Field(...)
    avatarUrl: Optional[str] = None


class ManagerRegisterRequest(BaseModel):
    name: str = Field(..., min_length=1)
    employeeId: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)
    phone: Optional[str] = "+91 "
    department: Optional[str] = "Engineering"
    title: Optional[str] = "Engineering Lead"
    password: Optional[str] = "password123"
    avatarUrl: Optional[str] = None


class EmployeeRegisterRequest(BaseModel):
    name: str = Field(..., min_length=1)
    employeeId: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)
    phone: Optional[str] = "+91 "
    department: Optional[str] = "Engineering"
    managerId: Optional[str] = None
    managerName: Optional[str] = None
    password: Optional[str] = "password123"
    faceRegistered: Optional[bool] = False
    faceVector: Optional[str] = None
    avatarUrl: Optional[str] = None
    faceImageBase64: Optional[str] = None


class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=1)
    password: Optional[str] = None
    role: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    identifier: str = Field(..., min_length=1)


class VerifyResetCodeRequest(BaseModel):
    identifier: str = Field(..., min_length=1)
    code: str = Field(..., min_length=4)


class ResetPasswordRequest(BaseModel):
    identifier: str = Field(..., min_length=1)
    code: str = Field(..., min_length=4)
    newPassword: str = Field(..., min_length=4)


class ProfileUpdateRequest(BaseModel):
    employeeId: str = Field(..., min_length=1)
    phone: Optional[str] = None
    avatarUrl: Optional[str] = None
    department: Optional[str] = None
    name: Optional[str] = None



class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    employeeId: str
    role: str
    department: str
    phone: str
    managerId: Optional[str] = None
    managerName: Optional[str] = None
    avatarUrl: Optional[str] = None
    faceRegistered: Optional[bool] = False
    faceVector: Optional[str] = None
    joinDate: str
    active: bool
    title: Optional[str] = None
