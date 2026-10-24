export type UserRole = 'admin' | 'manager' | 'employee';

export interface User {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  role: UserRole;
  department: string;
  phone: string;
  managerId?: string;
  managerName?: string;
  avatarUrl?: string;
  faceRegistered?: boolean;
  faceVector?: string;
  faceImageBase64?: string;
  joinDate: string;
  active: boolean;
  title?: string;
}

export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'On Leave' | 'Half Day Leave' | 'Working' | 'In Progress' | 'Present — Flexible Shift' | 'Present — Half Day Leave';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string; // YYYY-MM-DD or formatted "Oct 10, 2026"
  checkIn?: string; // e.g. "09:12 AM"
  checkOut?: string; // e.g. "06:10 PM"
  hoursWorked?: string; // e.g. "8h 58m"
  targetHoursPerDay?: number;
  halfDayLeave?: boolean;
  leavePeriod?: 'Morning' | 'Afternoon' | null;
  status: AttendanceStatus;
  verifiedBy: 'Face + GPS' | 'Manual Override' | 'Biometric';
  locationName: string;
  distanceMeters: number;
  withinRadius: boolean;
  livenessVerified: boolean;
  managerName?: string;
  notes?: string;
}

export type LeaveType = 'Casual Leave' | 'Sick Leave' | 'Personal' | 'Earned Leave' | 'Maternity/Paternity';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  daysCount: number;
  halfDayPeriod?: 'Morning' | 'Afternoon';
  reason: string;
  status: LeaveStatus;
  requestedAt: string;
  managerId: string;
  managerName: string;
  reviewedAt?: string;
  reviewRemarks?: string;
}

export interface ApprovalAudit {
  id: string;
  employeeId: string;
  employeeName: string;
  requestType: string;
  decision: 'Approved' | 'Rejected';
  managerId: string;
  managerName: string;
  date: string;
  time: string;
  reason: string;
  remarks?: string;
}

export interface OfficeLocation {
  id?: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  allowedRadiusMeters: number;
  /** Office geofence box corners — attendance allowed ONLY inside this polygon. */
  geofencePolygon?: { lat: number; lng: number }[];
  isActive?: boolean;
}

export interface SmartHoursConfig {
  expectedHoursPerDay: number;
  graceCheckInMinutes: number; // e.g. 15 minutes
  standardStartTime: string; // "11:25 AM"
  standardEndTime?: string; // "07:25 PM"
  inTime?: string; // "11:25 AM"
  outTime?: string; // "07:25 PM"
  flexibleWindowMinutes: number; // 180 min
}
