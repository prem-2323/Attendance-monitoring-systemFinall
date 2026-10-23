import {
  User,
  AttendanceRecord,
  ApprovalAudit,
  OfficeLocation,
  SmartHoursConfig,
  AttendanceStatus,
} from '../types';

import { apiFetch } from './apiConfig';

const API_BASE = '/api/admin';

export interface DashboardStatsResponse {
  todayDate: string;
  totalEmployeesCount: number;
  presentCount: number;
  lateCount: number;
  onLeaveCount: number;
  absentCount: number;
  presentPct: number;
  departmentBreakdown: Record<string, number>;
  recentActivities: Array<{
    employee: string;
    activity: string;
    time: string;
    type: string;
    tagColor: string;
  }>;
}

export interface AddEmployeePayload {
  name: string;
  employeeId: string;
  email: string;
  phone?: string;
  department?: string;
  managerName?: string;
  role?: string;
  avatarUrl?: string;
  faceRegistered?: boolean;
  faceVector?: string;
  faceImageBase64?: string;
}

export interface AddManagerPayload {
  name: string;
  employeeId: string;
  email: string;
  phone?: string;
  department?: string;
  title?: string;
  avatarUrl?: string;
  faceRegistered?: boolean;
}

export interface AttendanceOverridePayload {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  reason: string;
  checkIn?: string;
  checkOut?: string;
}

export const adminApi = {
  /**
   * Get real-time stats and recent activities for admin dashboard
   */
  async getDashboardStats(): Promise<DashboardStatsResponse> {
    const res = await apiFetch(`${API_BASE}/dashboard/stats`);
    if (!res.ok) {
      throw new Error(`Failed to fetch dashboard stats: ${res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Fetch all employees from MongoDB Atlas
   */
  async getEmployees(): Promise<User[]> {
    const res = await apiFetch(`${API_BASE}/employees`);
    if (!res.ok) {
      throw new Error(`Failed to fetch employees: ${res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Create new employee with facial biometric registration
   */
  async createEmployee(payload: AddEmployeePayload): Promise<User> {
    const res = await apiFetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to create employee');
    }
    return data;
  },

  /**
   * Delete employee from MongoDB Atlas
   */
  async deleteEmployee(identifier: string): Promise<{ success: boolean; message: string }> {
    const res = await apiFetch(`${API_BASE}/employees/${encodeURIComponent(identifier)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to delete employee');
    }
    return data;
  },

  /**
   * Fetch all managers from MongoDB Atlas
   */
  async getManagers(): Promise<User[]> {
    const res = await apiFetch(`${API_BASE}/managers`);
    if (!res.ok) {
      throw new Error(`Failed to fetch managers: ${res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Provision a new department manager
   */
  async createManager(payload: AddManagerPayload): Promise<User> {
    const res = await apiFetch(`${API_BASE}/managers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to create manager');
    }
    return data;
  },

  /**
   * Delete manager from MongoDB Atlas
   */
  async deleteManager(identifier: string): Promise<{ success: boolean; message: string }> {
    const res = await apiFetch(`${API_BASE}/managers/${encodeURIComponent(identifier)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to delete manager');
    }
    return data;
  },

  /**
   * Fetch attendance records (supports mode: 'today', 'history', or all)
   */
  async getAttendance(params?: {
    mode?: 'today' | 'history';
    date?: string;
    employeeId?: string;
    status?: string;
    department?: string;
  }): Promise<AttendanceRecord[]> {
    const query = new URLSearchParams();
    if (params?.mode) query.append('mode', params.mode);
    if (params?.date) query.append('date', params.date);
    if (params?.employeeId && params.employeeId !== 'All') query.append('employeeId', params.employeeId);
    if (params?.status && params.status !== 'All') query.append('status', params.status);
    if (params?.department && params.department !== 'All') query.append('department', params.department);

    const qs = query.toString();
    const res = await apiFetch(`${API_BASE}/attendance${qs ? `?${qs}` : ''}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch attendance: ${res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Regularize attendance record & log audit entry
   */
  async overrideAttendance(payload: AttendanceOverridePayload): Promise<{
    success: boolean;
    message: string;
    record: AttendanceRecord;
    audit: ApprovalAudit;
  }> {
    const res = await apiFetch(`${API_BASE}/attendance/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to regularize attendance');
    }
    return data;
  },

  /**
   * Fetch approval audit trail logs
   */
  async getApprovalAudits(): Promise<ApprovalAudit[]> {
    const res = await apiFetch(`${API_BASE}/audits`);
    if (!res.ok) {
      throw new Error(`Failed to fetch approval audits: ${res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Fetch office geofence & smart hours settings
   */
  async getSettings(): Promise<{
    officeLocation: OfficeLocation;
    officeLocations?: OfficeLocation[];
    locations?: OfficeLocation[];
    smartHoursConfig: SmartHoursConfig;
    inTime?: string;
    outTime?: string;
  }> {
    const res = await apiFetch(`${API_BASE}/settings`);
    if (!res.ok) {
      throw new Error(`Failed to fetch settings: ${res.statusText}`);
    }
    return await res.json();
  },

  /**
   * Update office GPS location & radius
   */
  async updateOfficeSettings(location: Partial<OfficeLocation> & { locations?: OfficeLocation[] }): Promise<OfficeLocation> {
    const res = await apiFetch(`${API_BASE}/settings/office`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(location),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to update office settings');
    }
    return data.officeLocation;
  },

  /**
   * Update all office locations (Location 1, 2, 3, 4)
   */
  async updateOfficeLocations(locations: OfficeLocation[]): Promise<OfficeLocation[]> {
    const res = await apiFetch(`${API_BASE}/settings/locations`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to update office locations');
    }
    return data.locations || data.officeLocations;
  },

  /**
   * Update smart hours policy
   */
  async updateSmartHoursSettings(config: Partial<SmartHoursConfig>): Promise<SmartHoursConfig> {
    const res = await apiFetch(`${API_BASE}/settings/smart-hours`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to update smart hours');
    }
    return data.smartHoursConfig;
  },

  /**
   * Reset MongoDB Atlas data to baseline seed
   */
  async resetDatabase(): Promise<{ success: boolean; message: string }> {
    const res = await apiFetch(`${API_BASE}/reset`, {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Failed to reset database');
    }
    return data;
  },
};
