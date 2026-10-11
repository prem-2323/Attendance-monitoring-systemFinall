import { User, AttendanceRecord, LeaveRequest, ApprovalAudit, OfficeLocation } from '../types';

/**
 * Enterprise Default Office Geofence Configuration.
 * Live parameters are loaded dynamically from MongoDB Atlas settings.
 */
export const DEFAULT_OFFICE: OfficeLocation = {
  name: 'Chennai Tech Park (HQ)',
  address: 'Block B, OMR Cyber Corridor, Chennai, TN 600096',
  lat: 12.9815,
  lng: 80.218,
  allowedRadiusMeters: 150,
};

// All mock dummy records removed — live data is retrieved dynamically from MongoDB Atlas
export const INITIAL_USERS: User[] = [];
export const INITIAL_TODAY_ATTENDANCE: AttendanceRecord[] = [];
export const INITIAL_HISTORICAL_ATTENDANCE: AttendanceRecord[] = [];
export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [];
export const INITIAL_APPROVAL_AUDIT: ApprovalAudit[] = [];
