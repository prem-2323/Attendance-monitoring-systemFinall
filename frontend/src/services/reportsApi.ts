import { AttendanceRecord } from '../types';

import { apiFetch } from './apiConfig';

const API_BASE = '/api/reports';

export interface ReportFilterParams {
  department?: string;
  employeeId?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
}

export interface ReportAggregates {
  totalEmployees: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  leaveCount: number;
  inProgressCount?: number;
  flexibleShiftCount?: number;
  totalRecords: number;
  avgAttendance: number;
}

export interface ReportResponse {
  success: boolean;
  filters: ReportFilterParams;
  aggregates: ReportAggregates;
  records: AttendanceRecord[];
}

export const reportsApi = {
  /**
   * Fetch live dynamic report metrics and records from MongoDB Atlas
   */
  getAnalytics: async (params?: ReportFilterParams): Promise<ReportResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.department && params.department !== 'All') {
      searchParams.append('department', params.department);
    } else {
      searchParams.append('department', 'All');
    }

    if (params?.employeeId && params.employeeId !== 'All') {
      searchParams.append('employeeId', params.employeeId);
    } else {
      searchParams.append('employeeId', 'All');
    }

    if (params?.fromDate) {
      searchParams.append('fromDate', params.fromDate);
    }
    if (params?.toDate) {
      searchParams.append('toDate', params.toDate);
    }

    if (params?.status && params.status !== 'All') {
      searchParams.append('status', params.status);
    } else {
      searchParams.append('status', 'All');
    }

    const queryStr = searchParams.toString();
    const endpoint = `/analytics${queryStr ? `?${queryStr}` : ''}`;
    const res = await apiFetch(endpoint);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to fetch attendance reports from MongoDB Atlas');
    }
    return data;
  },
};
