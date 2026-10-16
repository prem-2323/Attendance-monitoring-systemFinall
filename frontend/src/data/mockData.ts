import { User, AttendanceRecord, LeaveRequest, ApprovalAudit, OfficeLocation } from '../types';

/**
 * Enterprise Office Geofence BOX Configuration.
 * Attendance is allowed ONLY inside this polygon (see OFFICE_GEOFENCE_POLYGON env).
 * Live parameters are loaded dynamically from MongoDB Atlas settings.
 */
export const DEFAULT_OFFICE: OfficeLocation = {
  name: 'Head Office Block',
  address: 'Office Campus Premises, Tamil Nadu',
  lat: 11.27037707675975,
  lng: 77.60352284059195,
  allowedRadiusMeters: Number((import.meta as any)?.env?.VITE_OFFICE_RADIUS_METERS || 1000),
  geofencePolygon: [
    { lat: 11.270872464050166, lng: 77.60414913913843 },
    { lat: 11.269939620797608, lng: 77.60419457796888 },
    { lat: 11.26989802898974, lng: 77.60290714443924 },
    { lat: 11.270798193201482, lng: 77.60284050082124 },
  ],
};

// All mock dummy records removed — live data is retrieved dynamically from MongoDB Atlas
export const INITIAL_USERS: User[] = [];
export const INITIAL_TODAY_ATTENDANCE: AttendanceRecord[] = [];
export const INITIAL_HISTORICAL_ATTENDANCE: AttendanceRecord[] = [];
export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [];
export const INITIAL_APPROVAL_AUDIT: ApprovalAudit[] = [];
