import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  UserRole,
  AttendanceRecord,
  LeaveRequest,
  ApprovalAudit,
  OfficeLocation,
  SmartHoursConfig,
  AttendanceStatus,
} from '../types';
import { DEFAULT_OFFICE, DEFAULT_OFFICE_LOCATIONS } from '../data/mockData';

import { authApi } from '../services/authApi';
import { adminApi } from '../services/adminApi';
import { employeeApi } from '../services/employeeApi';
import { managerApi } from '../services/managerApi';

interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  read: boolean;
}

interface AppContextType {
  currentUser: User | null;
  currentRole: UserRole | null;
  users: User[];
  todayAttendance: AttendanceRecord[];
  historicalAttendance: AttendanceRecord[];
  allAttendance: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  approvalAudits: ApprovalAudit[];
  officeLocation: OfficeLocation;
  officeLocations: OfficeLocation[];
  smartHoursConfig: SmartHoursConfig;
  notifications: AppNotification[];
  login: (emailOrEmpId: string, role?: UserRole, explicitUser?: User) => boolean;
  logout: () => void;
  switchRoleQuick: (role: UserRole) => void;
  refreshUsers: () => Promise<void>;
  refreshAttendance: () => Promise<void>;
  refreshApprovalAudits: () => Promise<void>;
  refreshLeaveRequests: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  addEmployee: (employeeData: Omit<User, 'id' | 'joinDate' | 'active'>) => Promise<User>;
  deleteEmployee: (id: string) => Promise<void>;
  addManager: (managerData: Omit<User, 'id' | 'role' | 'joinDate' | 'active'>) => Promise<User>;
  addAdmin: (adminData: Omit<User, 'id' | 'role' | 'joinDate' | 'active'>) => User;
  addRegisteredUserToState: (user: User) => void;
  overrideAttendanceRecord: (params: {
    employeeId: string;
    date: string;
    status: AttendanceStatus;
    reason: string;
    checkIn?: string;
    checkOut?: string;
  }) => Promise<{ success: boolean; message: string }>;
  registerFace: (employeeId: string, faceVector: string) => void;
  markAttendance: (params: {
    employeeId: string;
    isCheckOut?: boolean;
    distanceMeters: number;
    withinRadius: boolean;
    livenessVerified: boolean;
    faceImageBase64?: string;
    latitude?: number | null;
    longitude?: number | null;
  }) => Promise<{ success: boolean; message: string; record?: AttendanceRecord }>;
  applyLeave: (params: {
    employeeId: string;
    leaveType: LeaveRequest['leaveType'];
    fromDate: string;
    toDate: string;
    reason: string;
  }) => Promise<LeaveRequest>;
  reviewLeaveRequest: (
    requestId: string,
    decision: 'Approved' | 'Rejected',
    remarks?: string
  ) => Promise<{ success: boolean; message: string; leaveRequest?: LeaveRequest }>;
  updateOfficeLocation: (newLocation: Partial<OfficeLocation>) => Promise<void>;
  updateOfficeLocations: (locations: OfficeLocation[]) => Promise<OfficeLocation[]>;
  updateSmartHoursConfig: (config: Partial<SmartHoursConfig>) => Promise<SmartHoursConfig>;
  updateUserProfile: (payload: {
    employeeId: string;
    phone?: string;
    avatarUrl?: string;
    department?: string;
    name?: string;
  }) => Promise<{ success: boolean; message: string; user?: User }>;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Legacy storage keys to purge on boot to remove previous mock data from browser cache
const LEGACY_STORAGE_KEYS = [
  'smart_attend_user_v1',
  'smart_attend_users_v1',
  'smart_attend_today_v1',
  'smart_attend_history_v1',
  'smart_attend_leaves_v1',
  'smart_attend_audit_v1',
  'smart_attend_office_v1',
];

try {
  if (typeof window !== 'undefined' && window.localStorage) {
    LEGACY_STORAGE_KEYS.forEach((k) => window.localStorage.removeItem(k));
  }
} catch {
  // Ignore in restricted environments
}

const STORAGE_KEYS = {
  CURRENT_USER: 'smart_attend_user_v2',
  USERS: 'smart_attend_users_v2',
  TODAY_ATT: 'smart_attend_today_v2',
  HIST_ATT: 'smart_attend_history_v2',
  LEAVES: 'smart_attend_leaves_v2',
  AUDIT: 'smart_attend_audit_v2',
  OFFICE: 'smart_attend_office_v2',
  LOCATIONS: 'smart_attend_locations_v2',
};

// All records in MongoDB Atlas and state are live active records
const isRealRecord = (_empId?: string) => true;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!saved) return [];
    try {
      const parsed: User[] = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((u) => isRealRecord(u.employeeId)) : [];
    } catch {
      return [];
    }
  });

  // Fetch live users, attendance, audits, and settings directly from MongoDB Atlas on mount
  useEffect(() => {
    // 1. Live Users
    authApi.getAllUsers()
      .then((atlasUsers) => {
        if (Array.isArray(atlasUsers)) {
          setUsers(atlasUsers.filter((u) => isRealRecord(u.employeeId)));
        }
      })
      .catch((err) => console.warn('[AppContext] Could not fetch live Atlas users:', err));

    // 2. Live Today Attendance
    adminApi.getAttendance({ mode: 'today' })
      .then((todayRecs) => {
        if (Array.isArray(todayRecs)) {
          setTodayAttendance(todayRecs.filter((a) => isRealRecord(a.employeeId)));
        }
      })
      .catch((err) => console.warn('[AppContext] Could not fetch live today attendance:', err));

    // 3. Live Historical Attendance
    adminApi.getAttendance({ mode: 'history' })
      .then((histRecs) => {
        if (Array.isArray(histRecs)) {
          setHistoricalAttendance(histRecs.filter((a) => isRealRecord(a.employeeId)));
        }
      })
      .catch((err) => console.warn('[AppContext] Could not fetch live historical attendance:', err));

    // 4. Live Approval Audits
    adminApi.getApprovalAudits()
      .then((audits) => {
        if (Array.isArray(audits)) {
          setApprovalAudits(audits.filter((a) => isRealRecord(a.employeeId)));
        }
      })
      .catch((err) => console.warn('[AppContext] Could not fetch live audits:', err));

    // 5. Live Office & Smart Hours Settings
    adminApi.getSettings()
      .then((settings) => {
        if (settings?.officeLocations && Array.isArray(settings.officeLocations) && settings.officeLocations.length > 0) {
          setOfficeLocations(settings.officeLocations.slice(0, 1));
          setOfficeLocation(settings.officeLocation || settings.officeLocations[0]);
        } else if (settings?.officeLocation) {
          setOfficeLocation(settings.officeLocation);
        }
        if (settings?.smartHoursConfig) {
          const inT = settings.smartHoursConfig.inTime || settings.inTime || settings.smartHoursConfig.standardStartTime || '11:25 AM';
          const outT = settings.smartHoursConfig.outTime || settings.outTime || settings.smartHoursConfig.standardEndTime || '07:25 PM';
          setSmartHoursConfig({
            ...settings.smartHoursConfig,
            inTime: inT,
            outTime: outT,
            standardStartTime: inT,
            standardEndTime: outT,
          });
        }
      })
      .catch((err) => console.warn('[AppContext] Could not fetch live settings:', err));

    // 6. Live Leave Requests from MongoDB Atlas
    employeeApi.getLeaveRequests('all')
      .then((data) => {
        if (Array.isArray(data?.leaveRequests)) {
          setLeaveRequests(data.leaveRequests.filter((l) => isRealRecord(l.employeeId)));
        }
      })
      .catch((err) => console.warn('[AppContext] Could not fetch live leave requests:', err));
  }, []);

  const refreshUsers = async () => {
    try {
      const liveUsers = await authApi.getAllUsers();
      if (Array.isArray(liveUsers)) {
        setUsers(liveUsers.filter((u) => isRealRecord(u.employeeId)));
      }
    } catch (err) {
      console.warn('[AppContext] Failed to refresh users from Atlas:', err);
    }
  };

  const refreshAttendance = async () => {
    try {
      const [today, history] = await Promise.all([
        adminApi.getAttendance({ mode: 'today' }),
        adminApi.getAttendance({ mode: 'history' }),
      ]);
      if (Array.isArray(today)) setTodayAttendance(today.filter((a) => isRealRecord(a.employeeId)));
      if (Array.isArray(history)) setHistoricalAttendance(history.filter((a) => isRealRecord(a.employeeId)));
    } catch (err) {
      console.warn('[AppContext] Failed to refresh attendance:', err);
    }
  };

  const refreshApprovalAudits = async () => {
    try {
      const audits = await adminApi.getApprovalAudits();
      if (Array.isArray(audits)) setApprovalAudits(audits.filter((a) => isRealRecord(a.employeeId)));
    } catch (err) {
      console.warn('[AppContext] Failed to refresh audits:', err);
    }
  };

  const refreshLeaveRequests = async () => {
    try {
      const data = await employeeApi.getLeaveRequests('all');
      if (Array.isArray(data?.leaveRequests)) {
        setLeaveRequests(data.leaveRequests.filter((l) => isRealRecord(l.employeeId)));
      }
    } catch (err) {
      console.warn('[AppContext] Failed to refresh leave requests:', err);
    }
  };

  const refreshSettings = async () => {
    try {
      const settings = await adminApi.getSettings();
      if (settings?.officeLocations && Array.isArray(settings.officeLocations) && settings.officeLocations.length > 0) {
        setOfficeLocations(settings.officeLocations.slice(0, 1));
        setOfficeLocation(settings.officeLocation || settings.officeLocations[0]);
      } else if (settings?.officeLocation) {
        setOfficeLocation(settings.officeLocation);
      }
      if (settings?.smartHoursConfig) {
        const inT = settings.smartHoursConfig.inTime || settings.inTime || settings.smartHoursConfig.standardStartTime || '11:25 AM';
        const outT = settings.smartHoursConfig.outTime || settings.outTime || settings.smartHoursConfig.standardEndTime || '07:25 PM';
        setSmartHoursConfig({
          ...settings.smartHoursConfig,
          inTime: inT,
          outTime: outT,
          standardStartTime: inT,
          standardEndTime: outT,
        });
      }
    } catch (err) {
      console.warn('[AppContext] Failed to refresh settings:', err);
    }
  };

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u && isRealRecord(u.employeeId)) {
          return u;
        }
      } catch {
        return null;
      }
    }
    return null;
  });

  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TODAY_ATT);
    if (!saved) return [];
    try {
      const parsed: AttendanceRecord[] = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((a) => isRealRecord(a.employeeId)) : [];
    } catch {
      return [];
    }
  });

  const [historicalAttendance, setHistoricalAttendance] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.HIST_ATT);
    if (!saved) return [];
    try {
      const parsed: AttendanceRecord[] = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((a) => isRealRecord(a.employeeId)) : [];
    } catch {
      return [];
    }
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LEAVES);
    if (!saved) return [];
    try {
      const parsed: LeaveRequest[] = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((l) => isRealRecord(l.employeeId)) : [];
    } catch {
      return [];
    }
  });

  const [approvalAudits, setApprovalAudits] = useState<ApprovalAudit[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUDIT);
    if (!saved) return [];
    try {
      const parsed: ApprovalAudit[] = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((a) => isRealRecord(a.employeeId)) : [];
    } catch {
      return [];
    }
  });

  const [officeLocation, setOfficeLocation] = useState<OfficeLocation>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.OFFICE);
    return saved ? JSON.parse(saved) : DEFAULT_OFFICE;
  });

  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LOCATIONS);
    if (!saved) return DEFAULT_OFFICE_LOCATIONS;
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed.slice(0, 1) : DEFAULT_OFFICE_LOCATIONS;
    } catch {
      return DEFAULT_OFFICE_LOCATIONS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(officeLocations));
    } catch {}
  }, [officeLocations]);

  const [smartHoursConfig, setSmartHoursConfig] = useState<SmartHoursConfig>({
    expectedHoursPerDay: 8,
    graceCheckInMinutes: 15,
    standardStartTime: '11:25 AM',
    standardEndTime: '07:25 PM',
    inTime: '11:25 AM',
    outTime: '07:25 PM',
    flexibleWindowMinutes: 180,
  });

  const [notifications, setNotifications] = useState<AppNotification[]>([]);


  // Persist to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TODAY_ATT, JSON.stringify(todayAttendance));
  }, [todayAttendance]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HIST_ATT, JSON.stringify(historicalAttendance));
  }, [historicalAttendance]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LEAVES, JSON.stringify(leaveRequests));
  }, [leaveRequests]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(approvalAudits));
  }, [approvalAudits]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.OFFICE, JSON.stringify(officeLocation));
  }, [officeLocation]);

  const login = (emailOrEmpId: string, role?: UserRole, explicitUser?: User): boolean => {
    if (explicitUser) {
      setCurrentUser(explicitUser);
      setUsers((prev) => {
        const idx = prev.findIndex(
          (u) =>
            u.email.toLowerCase() === explicitUser.email.toLowerCase() ||
            u.employeeId.toLowerCase() === explicitUser.employeeId.toLowerCase()
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = explicitUser;
          return next;
        }
        return [explicitUser, ...prev];
      });
      return true;
    }

    const term = emailOrEmpId.trim().toLowerCase();
    let found = users.find(
      (u) =>
        u.email.toLowerCase() === term ||
        u.employeeId.toLowerCase() === term ||
        (role && u.role === role)
    );

    if (!found && role) {
      found = users.find((u) => u.role === role);
    }

    if (found) {
      setCurrentUser(found);
      return true;
    }

    // Fallback search
    const partialMatch = users.find((u) => u.email.toLowerCase().includes(term));
    if (partialMatch) {
      setCurrentUser(partialMatch);
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const switchRoleQuick = (role: UserRole) => {
    const target = users.find((u) => u.role === role);
    if (target) {
      setCurrentUser(target);
    }
  };

  const addEmployee = async (employeeData: Omit<User, 'id' | 'joinDate' | 'active'>): Promise<User> => {
    try {
      const created = await adminApi.createEmployee({
        name: employeeData.name,
        employeeId: employeeData.employeeId,
        email: employeeData.email,
        phone: employeeData.phone,
        department: employeeData.department,
        managerName: employeeData.managerName,
        role: employeeData.role,
        avatarUrl: employeeData.avatarUrl,
        faceRegistered: employeeData.faceRegistered,
        faceVector: employeeData.faceVector,
        faceImageBase64: employeeData.faceImageBase64 || employeeData.avatarUrl,
      });

      setUsers((prev) => [created, ...prev.filter((u) => u.employeeId !== created.employeeId)]);
      await refreshAttendance();

      return created;
    } catch (err: any) {
      console.warn('[AppContext] Backend createEmployee note:', err);
      const fallbackUser: User = {
        id: `user-emp-${Date.now().toString().slice(-4)}`,
        ...employeeData,
        role: (employeeData.role as UserRole) || 'employee',
        joinDate: new Date().toISOString().split('T')[0],
        active: true,
      };
      setUsers((prev) => [fallbackUser, ...prev.filter((u) => u.employeeId !== fallbackUser.employeeId)]);
      return fallbackUser;
    }
  };

  const deleteEmployee = async (id: string): Promise<void> => {
    const target = users.find((u) => u.id === id || u.employeeId === id);
    if (!target) return;
    try {
      await adminApi.deleteEmployee(target.employeeId || target.id);
    } catch (err) {
      console.warn('[AppContext] Failed to delete employee from backend:', err);
    }
    setUsers((prev) => prev.filter((u) => u.id !== id && u.employeeId !== id));
    setTodayAttendance((prev) => prev.filter((a) => a.employeeId !== target.employeeId));
  };

  const addManager = async (managerData: Omit<User, 'id' | 'role' | 'joinDate' | 'active'>): Promise<User> => {
    try {
      const created = await adminApi.createManager({
        name: managerData.name,
        employeeId: managerData.employeeId,
        email: managerData.email,
        phone: managerData.phone,
        department: managerData.department,
        title: managerData.title,
        avatarUrl: managerData.avatarUrl,
        faceRegistered: managerData.faceRegistered,
      });

      setUsers((prev) => [created, ...prev.filter((u) => u.employeeId !== created.employeeId)]);
      return created;
    } catch (err: any) {
      console.warn('[AppContext] Backend createManager note:', err);
      const fallbackMgr: User = {
        id: `user-mgr-${Date.now().toString().slice(-4)}`,
        ...managerData,
        role: 'manager',
        joinDate: new Date().toISOString().split('T')[0],
        active: true,
      };
      setUsers((prev) => [fallbackMgr, ...prev.filter((u) => u.employeeId !== fallbackMgr.employeeId)]);
      return fallbackMgr;
    }
  };


  const overrideAttendanceRecord = async (params: {
    employeeId: string;
    date: string;
    status: AttendanceStatus;
    reason: string;
    checkIn?: string;
    checkOut?: string;
  }): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await adminApi.overrideAttendance(params);
      await Promise.all([refreshAttendance(), refreshApprovalAudits()]);
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          title: 'Attendance Regularized',
          message: res.message,
          time: 'Just now',
          type: 'info',
          read: false,
        },
        ...prev,
      ]);
      return { success: true, message: res.message };
    } catch (err: any) {
      console.warn('[AppContext] Override attendance failed:', err);
      return { success: false, message: err?.message || 'Failed to apply override' };
    }
  };

  const addAdmin = (adminData: Omit<User, 'id' | 'role' | 'joinDate' | 'active'>): User => {
    const newId = `user-adm-${Date.now().toString().slice(-4)}`;
    const newAdmin: User = {
      ...adminData,
      id: newId,
      role: 'admin',
      joinDate: new Date().toISOString().split('T')[0],
      active: true,
      faceRegistered: adminData.faceRegistered ?? false,
      avatarUrl: adminData.avatarUrl?.trim() ? adminData.avatarUrl : undefined,
    };
    setUsers((prev) => [newAdmin, ...prev]);

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: 'New Administrator Registered',
        message: `${newAdmin.name} (${newAdmin.employeeId}) registered with administrative authority.`,
        time: 'Just now',
        type: 'info',
        read: false,
      },
      ...prev,
    ]);

    return newAdmin;
  };

  const addRegisteredUserToState = (newUser: User) => {
    setUsers((prev) => [
      newUser,
      ...prev.filter((u) => u.employeeId !== newUser.employeeId && u.email !== newUser.email),
    ]);
  };

  const registerFace = (employeeId: string, faceVector: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.employeeId === employeeId ? { ...u, faceRegistered: true, faceVector } : u
      )
    );
  };

  const markAttendance = async ({
    employeeId,
    isCheckOut = false,
    distanceMeters,
    withinRadius,
    livenessVerified,
    faceImageBase64,
    latitude,
    longitude,
  }: {
    employeeId: string;
    isCheckOut?: boolean;
    distanceMeters: number;
    withinRadius: boolean;
    livenessVerified: boolean;
    faceImageBase64?: string;
    latitude?: number | null;
    longitude?: number | null;
  }): Promise<{ success: boolean; message: string; record?: AttendanceRecord }> => {
    const emp = users.find((u) => u.employeeId === employeeId);
    if (!emp) {
      return { success: false, message: 'Employee not found' };
    }

    if (!withinRadius) {
      return {
        success: false,
        message: `Outside office geofence box: attendance can only be marked inside the ${officeLocation.name} premises. Move inside the office box and retry.`,
      };
    }

    if (!livenessVerified) {
      return {
        success: false,
        message: 'Liveness verification failed: face presence could not be validated.',
      };
    }

    try {
      const res = await employeeApi.markAttendance({
        employeeId,
        isCheckOut,
        distanceMeters,
        withinRadius,
        livenessVerified,
        faceImageBase64,
        latitude,
        longitude,
        locationName: officeLocation.name,
      });

      if (res && res.success && res.record) {
        setTodayAttendance((prev) => {
          const idx = prev.findIndex((r) => r.employeeId === employeeId);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = res.record;
            return copy;
          }
          return [res.record, ...prev];
        });

        setNotifications((prev) => [
          {
            id: `notif-${Date.now()}`,
            title: isCheckOut ? 'Check-out Logged' : 'Attendance Verified',
            message: `${emp.name} has ${isCheckOut ? 'checked out' : 'checked in'} successfully via Face + GPS (${Math.round(
              distanceMeters
            )}m) recorded in MongoDB Atlas.`,
            time: 'Just now',
            type: 'success',
            read: false,
          },
          ...prev,
        ]);

        return {
          success: true,
          message: res.message,
          record: res.record,
        };
      }
      return {
        success: false,
        message: res?.message || 'Attendance verification failed.',
      };
    } catch (err: any) {
      console.warn('[AppContext] Backend markAttendance error:', err);
      return {
        success: false,
        message: err?.message || 'Attendance verification failed.',
      };
    }
  };

  const applyLeave = async ({
    employeeId,
    leaveType,
    fromDate,
    toDate,
    reason,
  }: {
    employeeId: string;
    leaveType: LeaveRequest['leaveType'];
    fromDate: string;
    toDate: string;
    reason: string;
  }): Promise<LeaveRequest> => {
    const emp = users.find((u) => u.employeeId === employeeId);

    try {
      const res = await employeeApi.applyLeave({
        employeeId,
        leaveType,
        fromDate,
        toDate,
        reason,
      });

      if (res && res.leaveRequest) {
        setLeaveRequests((prev) => [res.leaveRequest, ...prev.filter((l) => l.id !== res.leaveRequest.id)]);

        setNotifications((prev) => [
          {
            id: `notif-${Date.now()}`,
            title: 'New Leave Request Submitted',
            message: `${emp?.name || employeeId} requested ${leaveType} (${fromDate} to ${toDate}) saved in MongoDB Atlas.`,
            time: 'Just now',
            type: 'warning',
            read: false,
          },
          ...prev,
        ]);

        return res.leaveRequest;
      }
      throw new Error('Failed to submit leave request to MongoDB Atlas');
    } catch (err: any) {
      console.warn('[AppContext] Backend applyLeave failed:', err);
      throw new Error(err?.message || 'Failed to submit leave request to MongoDB Atlas');
    }
  };


  const reviewLeaveRequest = async (
    requestId: string,
    decision: 'Approved' | 'Rejected',
    remarks?: string
  ): Promise<{ success: boolean; message: string; leaveRequest?: LeaveRequest }> => {
    try {
      const res = await managerApi.reviewLeave({
        requestId,
        decision,
        managerId: currentUser?.id,
        managerName: currentUser?.name,
        remarks,
      });

      if (res && res.leaveRequest) {
        setLeaveRequests((prev) =>
          prev.map((req) => (req.id === requestId ? res.leaveRequest : req))
        );

        await Promise.all([refreshApprovalAudits(), refreshAttendance(), refreshLeaveRequests()]);

        setNotifications((prev) => [
          {
            id: `notif-${Date.now()}`,
            title: `Leave ${decision}`,
            message: `${res.leaveRequest.employeeName}'s ${res.leaveRequest.leaveType} has been ${decision.toLowerCase()} by ${currentUser?.name || 'Manager'} and saved in MongoDB Atlas.`,
            time: 'Just now',
            type: decision === 'Approved' ? 'success' : 'alert',
            read: false,
          },
          ...prev,
        ]);

        return {
          success: true,
          message: res.message,
          leaveRequest: res.leaveRequest,
        };
      }
    } catch (err: any) {
      console.warn('[AppContext] Backend reviewLeave failed, using local fallback:', err);
    }

    let reviewedReq: LeaveRequest | undefined;

    setLeaveRequests((prev) =>
      prev.map((req) => {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (req.id === requestId) {
          reviewedReq = {
            ...req,
            status: decision,
            reviewedAt: `${dateStr} ${timeStr}`,
            reviewRemarks: remarks || (decision === 'Approved' ? 'Approved by manager.' : 'Request declined.'),
          };
          return reviewedReq;
        }
        return req;
      })
    );

    if (reviewedReq) {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      // Create Approval Audit entry immediately
      const newAudit: ApprovalAudit = {
        id: `audit-${Date.now()}`,
        employeeId: reviewedReq.employeeId,
        employeeName: reviewedReq.employeeName,
        requestType: `${reviewedReq.leaveType} (${reviewedReq.daysCount} days: ${reviewedReq.fromDate})`,
        decision,
        managerId: currentUser?.id || reviewedReq.managerId,
        managerName: currentUser?.name || reviewedReq.managerName,
        date: dateStr,
        time: timeStr,
        reason: reviewedReq.reason,
        remarks: remarks || (decision === 'Approved' ? 'Leave reviewed and approved.' : 'Declined.'),
      };

      setApprovalAudits((prev) => [newAudit, ...prev]);

      // If approved and applies to today, update today's status to 'On Leave'
      if (decision === 'Approved' && reviewedReq.fromDate <= dateStr && reviewedReq.toDate >= dateStr) {
        setTodayAttendance((prev) =>
          prev.map((rec) =>
            rec.employeeId === reviewedReq?.employeeId
              ? { ...rec, status: 'On Leave', notes: `Approved Leave: ${reviewedReq?.leaveType}` }
              : rec
          )
        );
      }

      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          title: `Leave ${decision}`,
          message: `${reviewedReq?.employeeName}'s ${reviewedReq?.leaveType} has been ${decision.toLowerCase()} by ${currentUser?.name || 'Manager'}.`,
          time: 'Just now',
          type: decision === 'Approved' ? 'success' : 'alert',
          read: false,
        },
        ...prev,
      ]);
    }

    return {
      success: true,
      message: `Leave ${decision.toLowerCase()}`,
      leaveRequest: reviewedReq,
    };
  };

  const updateOfficeLocation = async (newLocation: Partial<OfficeLocation>): Promise<void> => {
    try {
      const updated = await adminApi.updateOfficeSettings(newLocation);
      // Merge so optional fields (geofencePolygon/isActive/id) survive a
      // partial settings response instead of being wiped.
      const primary = { ...DEFAULT_OFFICE, ...newLocation, ...updated };
      setOfficeLocation(primary);
      setOfficeLocations([primary]);
    } catch (err) {
      console.warn('[AppContext] Failed to persist office settings to Atlas:', err);
      const primary = { ...DEFAULT_OFFICE, ...newLocation };
      setOfficeLocation(primary);
      setOfficeLocations([primary]);
    }
  };

  const updateOfficeLocations = async (locations: OfficeLocation[]): Promise<OfficeLocation[]> => {
    try {
      const singleLocation = locations.slice(0, 1);
      const updated = await adminApi.updateOfficeLocations(singleLocation);
      const primary = updated.slice(0, 1);
      setOfficeLocations(primary);
      if (primary.length > 0) {
        setOfficeLocation(primary[0]);
      }
      return primary;
    } catch (err) {
      console.warn('[AppContext] Failed to persist office locations to Atlas:', err);
      const singleLocation = locations.slice(0, 1);
      setOfficeLocations(singleLocation);
      if (singleLocation.length > 0) {
        setOfficeLocation(singleLocation[0]);
      }
      return singleLocation;
    }
  };

  const updateSmartHoursConfig = async (newConfig: Partial<SmartHoursConfig>): Promise<SmartHoursConfig> => {
    try {
      const updated = await adminApi.updateSmartHoursSettings(newConfig);
      const inT = updated.inTime || newConfig.inTime || updated.standardStartTime || '11:25 AM';
      const outT = updated.outTime || newConfig.outTime || updated.standardEndTime || '07:25 PM';
      const fullConfig: SmartHoursConfig = {
        ...updated,
        inTime: inT,
        outTime: outT,
        standardStartTime: inT,
        standardEndTime: outT,
      };
      setSmartHoursConfig(fullConfig);
      return fullConfig;
    } catch (err) {
      console.warn('[AppContext] Failed to persist smart hours settings to Atlas:', err);
      const fallback = { ...smartHoursConfig, ...newConfig } as SmartHoursConfig;
      setSmartHoursConfig(fallback);
      return fallback;
    }
  };

  const updateUserProfile = async (payload: {
    employeeId: string;
    phone?: string;
    avatarUrl?: string;
    department?: string;
    name?: string;
  }): Promise<{ success: boolean; message: string; user?: User }> => {
    try {
      const res = await authApi.updateProfile(payload);
      if (res?.user) {
        if (currentUser?.employeeId === payload.employeeId) {
          setCurrentUser(res.user);
        }
        setUsers((prev) => prev.map((u) => (u.employeeId === payload.employeeId ? res.user : u)));
        return {
          success: true,
          message: res.message || 'Profile updated successfully in MongoDB Atlas.',
          user: res.user,
        };
      }
    } catch (err: any) {
      console.warn('[AppContext] Failed to update profile in Atlas:', err);
    }

    // Local state fallback if offline
    let updatedLocalUser: User | undefined;
    if (currentUser?.employeeId === payload.employeeId) {
      updatedLocalUser = {
        ...currentUser,
        ...(payload.phone ? { phone: payload.phone } : {}),
        ...(payload.avatarUrl ? { avatarUrl: payload.avatarUrl } : {}),
        ...(payload.department ? { department: payload.department } : {}),
        ...(payload.name ? { name: payload.name } : {}),
      };
      setCurrentUser(updatedLocalUser);
    }
    setUsers((prev) =>
      prev.map((u) => {
        if (u.employeeId === payload.employeeId) {
          return {
            ...u,
            ...(payload.phone ? { phone: payload.phone } : {}),
            ...(payload.avatarUrl ? { avatarUrl: payload.avatarUrl } : {}),
            ...(payload.department ? { department: payload.department } : {}),
            ...(payload.name ? { name: payload.name } : {}),
          };
        }
        return u;
      })
    );
    return { success: true, message: 'Profile updated locally.', user: updatedLocalUser };
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const resetAllData = async (): Promise<void> => {
    try {
      await adminApi.resetDatabase();
    } catch (err) {
      console.warn('[AppContext] Backend database reset note:', err);
    }
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.TODAY_ATT);
    localStorage.removeItem(STORAGE_KEYS.HIST_ATT);
    localStorage.removeItem(STORAGE_KEYS.LEAVES);
    localStorage.removeItem(STORAGE_KEYS.AUDIT);
    localStorage.removeItem(STORAGE_KEYS.OFFICE);
    localStorage.removeItem(STORAGE_KEYS.LOCATIONS);
    await Promise.all([
      refreshUsers(),
      refreshAttendance(),
      refreshApprovalAudits(),
      refreshLeaveRequests(),
      refreshSettings(),
    ]);
    setCurrentUser(null);
  };

  const allAttendance = [...todayAttendance, ...historicalAttendance];

  return (
    <AppContext.Provider
      value={{
        currentUser,
        currentRole: currentUser?.role || null,
        users,
        todayAttendance,
        historicalAttendance,
        allAttendance,
        leaveRequests,
        approvalAudits,
        officeLocation,
        officeLocations,
        smartHoursConfig,
        notifications,
        login,
        logout,
        switchRoleQuick,
        refreshUsers,
        refreshAttendance,
        refreshApprovalAudits,
        refreshLeaveRequests,
        refreshSettings,
        addEmployee,
        deleteEmployee,
        addManager,
        addAdmin,
        addRegisteredUserToState,
        overrideAttendanceRecord,
        registerFace,
        markAttendance,
        applyLeave,
        reviewLeaveRequest,
        updateOfficeLocation,
        updateOfficeLocations,
        updateSmartHoursConfig,
        updateUserProfile,
        markNotificationRead,
        clearNotifications,
        resetAllData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
