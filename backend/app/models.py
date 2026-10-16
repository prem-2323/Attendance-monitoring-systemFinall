"""
Pydantic Models and MongoDB Document Schemas.
Operates exclusively with MongoDB Atlas.
"""
from typing import Optional, Union, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, Field


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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    sent_at: Optional[datetime] = None


class AttendanceRecordDoc(BaseModel):
    employee_id: str
    employeeId: str
    name: str
    date: str
    status: str
    check_in: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
