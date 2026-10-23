import { AttendanceRecord, LeaveRequest, LeaveType } from '../types';

import { apiFetch } from './apiConfig';

const API_BASE = '/api/employee';

export interface MarkAttendancePayload {
  employeeId: string;
  isCheckOut?: boolean;
  distanceMeters: number;
  withinRadius: boolean;
  livenessVerified: boolean;
  locationName?: string;
  faceVector?: string;
  faceImageBase64?: string;
  /** Live GPS fix — server enforces the office geofence box from these. */
  latitude?: number | null;
  longitude?: number | null;
}

export interface ApplyLeavePayload {
  employeeId: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
}

export interface EmployeeHistoryResponse {
  employeeId: string;
  records: AttendanceRecord[];
  stats: {
    totalRecords: number;
    presentDays: number;
    lateDays: number;
    leaveDays: number;
    absentDays: number;
    inProgressDays?: number;
    flexibleShiftDays?: number;
    attendancePercentage: number;
  };
}

export interface EmployeeLeaveResponse {
  employeeId: string;
  leaveRequests: LeaveRequest[];
  quotas: {
    casualRemaining: number;
    sickRemaining: number;
    earnedRemaining: number;
    totalApprovedLeaves: number;
    pendingReviewCount: number;
  };
}

export interface EmployeeDashboardResponse {
  employeeId: string;
  todayRecord: AttendanceRecord | null;
  attendanceRate: number;
  totalTrackedDays: number;
  recentLeaves: LeaveRequest[];
  officeLocation: {
    name: string;
    allowedRadiusMeters: number;
    lat?: number;
    lng?: number;
    geofencePolygon?: { lat: number; lng: number }[];
  };
}

export interface SmartHoursResponse {
  employeeId: string;
  checkInTime: string;
  expectedCheckoutTime: string;
  workedTime: string;
  remainingTime: string;
  completionPercent: number;
  targetHoursPerDay: number;
  smartPolicy: string;
  dayStatus?: string;
  arrivalStatus?: string;
  isSimulated?: boolean;
  actual?: {
    checkIn: string;
    checkOut?: string | null;
    workedMinutes: number;
    remainingMinutes: number;
    meetsRequirement: boolean;
  };
  simulated?: {
    checkIn: string;
    anchorTime: string;
    workedTime: string;
    remainingTime: string;
    completionPercent: number;
    expectedCheckout: string;
    note: string;
  } | null;
  smartConfig?: {
    expectedHoursPerDay: number;
    graceCheckInMinutes: number;
    standardStartTime: string;
    flexibleWindowMinutes: number;
  };
}

export interface FaceDetectResponse {
  faceDetected: boolean;
  faceMatched?: boolean;
  count: number;
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence?: number;
  message: string;
}

export const employeeApi = {
  /**
   * Real-time webcam frame face detection via backend OpenCV/dlib engine
   */
  async detectFace(imageBase64: string, employeeId?: string): Promise<FaceDetectResponse> {
    try {
      const res = await apiFetch(`${API_BASE}/face/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, employeeId }),
      });
      if (!res.ok) {
        return { faceDetected: false, count: 0, message: 'Detection service unavailable' };
      }
      return await res.json();
    } catch {
      return { faceDetected: false, count: 0, message: 'Failed to contact face detector' };
    }
  },

  /**
   * Mark biometric check-in or check-out in MongoDB Atlas
   */
  async markAttendance(payload: MarkAttendancePayload): Promise<{
    success: boolean;
    message: string;
    record: AttendanceRecord;
  }> {
    const res = await apiFetch(`${API_BASE}/attendance/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to mark attendance');
    }
    return data;
  },

  /**
   * Fetch attendance history & computed monthly statistics from MongoDB Atlas
   */
  async getAttendanceHistory(
    employeeId: string,
    statusFilter?: string,
    month?: string
  ): Promise<EmployeeHistoryResponse> {
    const query = new URLSearchParams();
    if (statusFilter && statusFilter !== 'All') query.append('status', statusFilter);
    if (month) query.append('month', month);

    const qs = query.toString();
    const res = await apiFetch(`${API_BASE}/attendance/${encodeURIComponent(employeeId)}${qs ? `?${qs}` : ''}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch attendance history: ${res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Submit an electronic leave application to MongoDB Atlas
   */
  async applyLeave(payload: ApplyLeavePayload): Promise<{
    success: boolean;
    message: string;
    leaveRequest: LeaveRequest;
  }> {
    const res = await apiFetch(`${API_BASE}/leave/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to submit leave application');
    }
    return data;
  },

  /**
   * Retrieve employee leave records and remaining annual quotas
   */
  async getLeaveRequests(employeeId: string): Promise<EmployeeLeaveResponse> {
    const res = await apiFetch(`${API_BASE}/leave/${encodeURIComponent(employeeId)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch leave requests: ${res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Fetch employee dashboard metrics from MongoDB Atlas
   */
  async getDashboard(employeeId: string): Promise<EmployeeDashboardResponse> {
    const res = await apiFetch(`${API_BASE}/dashboard/${encodeURIComponent(employeeId)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch employee dashboard: ${res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Calculate dynamic shift metrics based on check-in time
   */
  async getSmartHours(
    employeeId: string,
    checkIn?: string,
    currentTime?: string
  ): Promise<SmartHoursResponse> {
    const query = new URLSearchParams();
    if (checkIn) query.append('checkIn', checkIn);
    if (currentTime) query.append('currentTime', currentTime);

    const qs = query.toString();
    const res = await apiFetch(`${API_BASE}/smart-hours/${encodeURIComponent(employeeId)}${qs ? `?${qs}` : ''}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch smart hours: ${res.statusText}`);
    }
    return await res.json();
  },
};
