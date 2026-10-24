"""
Pydantic Models and MongoDB Document Schemas.
Operates exclusively with MongoDB Atlas.
"""
from typing import Optional, Union, Dict, Any
from pydantic import BaseModel, Field
from backend.services.timezone import india_timestamp


class CheckInRequest(BaseModel):
    employee_id: Union[int, str] = Field(..., description="Employee ID or Code")


class EmailNotificationDoc(BaseModel):
    event_key: str
    recipient: str
    subject: str
    body: str
    role: str
    status: str = "pending"  # pending, sending, sent, failed
    attempts: int = 0
    last_error: Optional[str] = None
    created_at: str = Field(default_factory=india_timestamp)
    sent_at: Optional[str] = None


class AttendanceRecordDoc(BaseModel):
    employee_id: str
    employeeId: str
    name: str
    date: str
    status: str
    check_in: Optional[str] = None
    created_at: str = Field(default_factory=india_timestamp)
