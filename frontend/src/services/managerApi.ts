import { User, AttendanceRecord, LeaveRequest } from '../types';

import { apiFetch } from './apiConfig';

const API_BASE = '/api/manager';

export interface ManagerDashboardData {
  managerId: string;
  managerName: string;
  department: string;
  totalTeamCount: number;
  presentCount: number;
  absentCount: number;
  onLeaveCount: number;
  lateCount: number;
  pendingLeavesCount: number;
  teamTodayAttendance: AttendanceRecord[];
}

export interface ReviewLeavePayload {
  requestId: string;
  decision: 'Approved' | 'Rejected';
  managerId?: string;
  managerName?: string;
  remarks?: string;
}

export interface EmployeeAttendanceAnalysis {
  employeeId: string;
  records: AttendanceRecord[];
  stats: {
    totalDays: number;
    presentDays: number;
    lateDays: number;
    absentDays: number;
    leaveDays: number;
    attendancePercentage: number;
  };
}

export const managerApi = {
  /**
   * Fetches real-time team attendance summary for the manager from MongoDB Atlas
   */
  async getDashboard(managerId: string): Promise<ManagerDashboardData> {
    const res = await apiFetch(`/dashboard/${encodeURIComponent(managerId)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch manager dashboard: ${res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Fetches direct report employees under this manager with real calculated attendance rates
   */
  async getTeamEmployees(managerId: string): Promise<User[]> {
    const res = await apiFetch(`/employees/${encodeURIComponent(managerId)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch team directory: ${res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Fetches leave applications submitted by the manager's team
   */
  async getTeamLeaves(
    managerId: string,
    statusFilter?: string
  ): Promise<{
    managerId: string;
    leaveRequests: LeaveRequest[];
    pendingCount: number;
    reviewedCount: number;
  }> {
    const query = new URLSearchParams();
    if (statusFilter && statusFilter !== 'All') query.append('status', statusFilter);
    const qs = query.toString();

    const res = await apiFetch(`/leaves/${encodeURIComponent(managerId)}${qs ? `?${qs}` : ''}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch team leave requests: ${res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Persists leave decision (Approved / Rejected) into Atlas and synchronizes approval audit log
   */
  async reviewLeave(payload: ReviewLeavePayload): Promise<{
    success: boolean;
    message: string;
    leaveRequest: LeaveRequest;
  }> {
    const res = await apiFetch('/leave/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to review leave request');
    }
    return data;
  },

  /**
   * Queries employee attendance track record for modal inspection
   */
  async getEmployeeHistory(employeeId: string): Promise<EmployeeAttendanceAnalysis> {
    const res = await apiFetch(`/employee-history/${encodeURIComponent(employeeId)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch employee attendance analysis: ${res.statusText}`);
    }
    return await res.json();
  },
};
