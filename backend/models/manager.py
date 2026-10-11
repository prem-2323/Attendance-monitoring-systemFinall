from typing import Optional, Literal
from pydantic import BaseModel, Field


class ReviewLeavePayload(BaseModel):
    requestId: str = Field(..., description="ID of the leave application")
    decision: Literal["Approved", "Rejected"] = Field(..., description="Decision from manager")
    managerId: Optional[str] = Field(None, description="Manager ID performing the review")
    managerName: Optional[str] = Field(None, description="Manager name performing the review")
    remarks: Optional[str] = Field(None, description="Manager review notes or rationale")


class ManagerDashboardResponse(BaseModel):
    managerId: str
    managerName: str
    department: str
    totalTeamCount: int
    presentCount: int
    absentCount: int
    onLeaveCount: int
    lateCount: int
    pendingLeavesCount: int
