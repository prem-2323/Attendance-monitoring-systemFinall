import { User, AttendanceRecord, LeaveRequest, ApprovalAudit, OfficeLocation } from '../types';

/**
 * Enterprise Office Geofence BOX Configuration.
 * Attendance is allowed ONLY inside this polygon (see OFFICE_GEOFENCE_POLYGON env).
 * Live parameters are loaded dynamically from MongoDB Atlas settings.
 */
export const DEFAULT_OFFICE: OfficeLocation = {
  name: 'Head Office Block',
  address: 'Office Campus Premises, Tamil Nadu',
  lat: 11.144035200242794,
  lng: 77.32559123601078,
  allowedRadiusMeters: 150,
  geofencePolygon: [
    { lat: 11.144113653811853, lng: 77.32556489217428 },
    { lat: 11.14405891876983, lng: 77.32565787042074 },
    { lat: 11.143960395668193, lng: 77.32561572028234 },
    { lat: 11.144007832721298, lng: 77.32552646116577 },
  ],
};

// All mock dummy records removed — live data is retrieved dynamically from MongoDB Atlas
export const INITIAL_USERS: User[] = [];
export const INITIAL_TODAY_ATTENDANCE: AttendanceRecord[] = [];
export const INITIAL_HISTORICAL_ATTENDANCE: AttendanceRecord[] = [];
export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [];
export const INITIAL_APPROVAL_AUDIT: ApprovalAudit[] = [];
