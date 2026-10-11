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
import {
  DEFAULT_OFFICE,
  INITIAL_USERS,
  INITIAL_TODAY_ATTENDANCE,
  INITIAL_HISTORICAL_ATTENDANCE,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_APPROVAL_AUDIT,
} from '../data/mockData';

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
  smartHoursConfig: SmartHoursConfig;
  notifications: AppNotification[];
  login: (emailOrEmpId: string, role?: UserRole) => boolean;
  logout: () => void;
  switchRoleQuick: (role: UserRole) => void;
  addEmployee: (employeeData: Omit<User, 'id' | 'joinDate' | 'active'>) => User;
  deleteEmployee: (id: string) => void;
  addManager: (managerData: Omit<User, 'id' | 'role' | 'joinDate' | 'active'>) => User;
  addAdmin: (adminData: Omit<User, 'id' | 'role' | 'joinDate' | 'active'>) => User;
  registerFace: (employeeId: string, faceVector: string) => void;
  markAttendance: (params: {
    employeeId: string;
    isCheckOut?: boolean;
    distanceMeters: number;
    withinRadius: boolean;
    livenessVerified: boolean;
  }) => { success: boolean; message: string; record?: AttendanceRecord };
  applyLeave: (params: {
    employeeId: string;
    leaveType: LeaveRequest['leaveType'];
    fromDate: string;
    toDate: string;
    reason: string;
  }) => LeaveRequest;
  reviewLeaveRequest: (requestId: string, decision: 'Approved' | 'Rejected', remarks?: string) => void;
  updateOfficeLocation: (newLocation: Partial<OfficeLocation>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  resetAllData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  CURRENT_USER: 'smart_attend_user_v1',
  USERS: 'smart_attend_users_v1',
  TODAY_ATT: 'smart_attend_today_v1',
  HIST_ATT: 'smart_attend_history_v1',
  LEAVES: 'smart_attend_leaves_v1',
  AUDIT: 'smart_attend_audit_v1',
  OFFICE: 'smart_attend_office_v1',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    // Default to admin on first load or fallback
    return null;
  });

  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TODAY_ATT);
    return saved ? JSON.parse(saved) : INITIAL_TODAY_ATTENDANCE;
  });

  const [historicalAttendance, setHistoricalAttendance] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.HIST_ATT);
    return saved ? JSON.parse(saved) : INITIAL_HISTORICAL_ATTENDANCE;
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LEAVES);
    return saved ? JSON.parse(saved) : INITIAL_LEAVE_REQUESTS;
  });

  const [approvalAudits, setApprovalAudits] = useState<ApprovalAudit[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUDIT);
    return saved ? JSON.parse(saved) : INITIAL_APPROVAL_AUDIT;
  });

  const [officeLocation, setOfficeLocation] = useState<OfficeLocation>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.OFFICE);
    return saved ? JSON.parse(saved) : DEFAULT_OFFICE;
  });

  const [smartHoursConfig] = useState<SmartHoursConfig>({
    expectedHoursPerDay: 8,
    graceCheckInMinutes: 15,
    standardStartTime: '09:00 AM',
    flexibleWindowMinutes: 180,
  });

  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'notif-1',
      title: 'Smart Biometric Update',
      message: 'Office geofencing threshold verified at 150m radius.',
      time: '10 min ago',
      type: 'info',
      read: false,
    },
    {
      id: 'notif-2',
      title: 'New Leave Request',
      message: 'John Doe requested Casual Leave for Oct 15-16.',
      time: '1 hour ago',
      type: 'warning',
      read: false,
    },
  ]);

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

  const login = (emailOrEmpId: string, role?: UserRole): boolean => {
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

  const addEmployee = (employeeData: Omit<User, 'id' | 'joinDate' | 'active'>): User => {
    const newId = `user-emp-${Date.now().toString().slice(-4)}`;
    const newEmp: User = {
      ...employeeData,
      id: newId,
      joinDate: '2026-10-10',
      active: true,
      avatarUrl:
        employeeData.avatarUrl ||
        `https://images.unsplash.com/photo-${1534528741775 + (users.length % 5)}?auto=format&fit=crop&w=256&h=256&q=80`,
    };
    setUsers((prev) => [newEmp, ...prev]);

    // Also add to today's absent list until marked
    const newRecord: AttendanceRecord = {
      id: `att-today-${Date.now()}`,
      employeeId: newEmp.employeeId,
      employeeName: newEmp.name,
      department: newEmp.department,
      date: '2026-10-10',
      status: 'Absent',
      verifiedBy: 'Face + GPS',
      locationName: 'Pending Check-in',
      distanceMeters: 0,
      withinRadius: false,
      livenessVerified: false,
      managerName: newEmp.managerName,
    };
    setTodayAttendance((prev) => [...prev, newRecord]);

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: 'New Employee Added',
        message: `${newEmp.name} (${newEmp.employeeId}) has been registered with face biometric embedding.`,
        time: 'Just now',
        type: 'success',
        read: false,
      },
      ...prev,
    ]);

    return newEmp;
  };

  const deleteEmployee = (id: string) => {
    const target = users.find((u) => u.id === id);
    if (!target) return;
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setTodayAttendance((prev) => prev.filter((a) => a.employeeId !== target.employeeId));
  };

  const addManager = (managerData: Omit<User, 'id' | 'role' | 'joinDate' | 'active'>): User => {
    const newId = `user-mgr-${Date.now().toString().slice(-4)}`;
    const newMgr: User = {
      ...managerData,
      id: newId,
      role: 'manager',
      joinDate: '2026-10-10',
      active: true,
      faceRegistered: managerData.faceRegistered ?? false,
      avatarUrl:
        managerData.avatarUrl ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
    };
    setUsers((prev) => [newMgr, ...prev]);
    return newMgr;
  };

  const addAdmin = (adminData: Omit<User, 'id' | 'role' | 'joinDate' | 'active'>): User => {
    const newId = `user-adm-${Date.now().toString().slice(-4)}`;
    const newAdmin: User = {
      ...adminData,
      id: newId,
      role: 'admin',
      joinDate: '2026-10-10',
      active: true,
      faceRegistered: adminData.faceRegistered ?? false,
      avatarUrl:
        adminData.avatarUrl ||
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80',
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

  const registerFace = (employeeId: string, faceVector: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.employeeId === employeeId ? { ...u, faceRegistered: true, faceVector } : u
      )
    );
  };

  const markAttendance = ({
    employeeId,
    isCheckOut = false,
    distanceMeters,
    withinRadius,
    livenessVerified,
  }: {
    employeeId: string;
    isCheckOut?: boolean;
    distanceMeters: number;
    withinRadius: boolean;
    livenessVerified: boolean;
  }): { success: boolean; message: string; record?: AttendanceRecord } => {
    const emp = users.find((u) => u.employeeId === employeeId);
    if (!emp) {
      return { success: false, message: 'Employee not found' };
    }

    if (!withinRadius) {
      return {
        success: false,
        message: `GPS check failed: Current distance is ${Math.round(
          distanceMeters
        )}m, exceeding office geofence limit of ${officeLocation.allowedRadiusMeters}m.`,
      };
    }

    if (!livenessVerified) {
      return {
        success: false,
        message: 'Liveness detection failed: Passive facial movement/blink could not be validated.',
      };
    }

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedTime = `${String(formattedHours).padStart(2, '0')}:${String(minutes).padStart(
      2,
      '0'
    )} ${ampm}`;

    // Status evaluation: If checkin is after 09:15 AM
    let newStatus: AttendanceStatus = 'Present';
    if (!isCheckOut) {
      if (hours > 9 || (hours === 9 && minutes > 15)) {
        newStatus = 'Late';
      }
    }

    let updatedRecord: AttendanceRecord;

    setTodayAttendance((prev) => {
      const existingIndex = prev.findIndex((r) => r.employeeId === employeeId);
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        if (isCheckOut) {
          updatedRecord = {
            ...existing,
            checkOut: formattedTime,
            hoursWorked: existing.checkIn ? '8h 15m' : '4h 00m',
            status: existing.status === 'Absent' ? 'Present' : existing.status,
            withinRadius: true,
            distanceMeters,
            livenessVerified: true,
          };
        } else {
          updatedRecord = {
            ...existing,
            checkIn: formattedTime,
            status: newStatus,
            withinRadius: true,
            distanceMeters,
            livenessVerified: true,
          };
        }
        const copy = [...prev];
        copy[existingIndex] = updatedRecord;
        return copy;
      } else {
        updatedRecord = {
          id: `att-today-${Date.now()}`,
          employeeId: emp.employeeId,
          employeeName: emp.name,
          department: emp.department,
          date: '2026-10-10',
          checkIn: formattedTime,
          status: newStatus,
          verifiedBy: 'Face + GPS',
          locationName: officeLocation.name,
          distanceMeters: Math.round(distanceMeters),
          withinRadius: true,
          livenessVerified: true,
          managerName: emp.managerName,
        };
        return [updatedRecord, ...prev];
      }
    });

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: isCheckOut ? 'Check-out Logged' : 'Attendance Verified',
        message: `${emp.name} has ${isCheckOut ? 'checked out' : 'checked in'} successfully via Face + GPS (${Math.round(
          distanceMeters
        )}m).`,
        time: 'Just now',
        type: 'success',
        read: false,
      },
      ...prev,
    ]);

    return {
      success: true,
      message: isCheckOut
        ? `Check-out recorded at ${formattedTime}!`
        : `Attendance marked successfully at ${formattedTime}! Status: ${newStatus}`,
      record: updatedRecord!,
    };
  };

  const applyLeave = ({
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
  }): LeaveRequest => {
    const emp = users.find((u) => u.employeeId === employeeId);
    const newLeave: LeaveRequest = {
      id: `leave-${Date.now()}`,
      employeeId,
      employeeName: emp?.name || 'Employee',
      employeeEmail: emp?.email || 'employee@company.com',
      department: emp?.department || 'Engineering',
      leaveType,
      fromDate,
      toDate,
      daysCount: Math.max(1, Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 || 1),
      reason,
      status: 'Pending',
      requestedAt: '2026-10-10 10:15',
      managerId: emp?.managerId || 'user-mgr-1',
      managerName: emp?.managerName || 'Kumar Verma',
    };

    setLeaveRequests((prev) => [newLeave, ...prev]);

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: 'New Leave Request Submitted',
        message: `${emp?.name} requested ${leaveType} (${fromDate} to ${toDate}). Waiting for manager approval.`,
        time: 'Just now',
        type: 'warning',
        read: false,
      },
      ...prev,
    ]);

    return newLeave;
  };

  const reviewLeaveRequest = (requestId: string, decision: 'Approved' | 'Rejected', remarks?: string) => {
    let reviewedReq: LeaveRequest | undefined;

    setLeaveRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          reviewedReq = {
            ...req,
            status: decision,
            reviewedAt: '2026-10-10 10:30',
            reviewRemarks: remarks || (decision === 'Approved' ? 'Approved by manager.' : 'Request declined due to schedule conflict.'),
          };
          return reviewedReq;
        }
        return req;
      })
    );

    if (reviewedReq) {
      // Create Approval Audit entry immediately
      const newAudit: ApprovalAudit = {
        id: `audit-${Date.now()}`,
        employeeId: reviewedReq.employeeId,
        employeeName: reviewedReq.employeeName,
        requestType: `${reviewedReq.leaveType} (${reviewedReq.daysCount} days: ${reviewedReq.fromDate})`,
        decision,
        managerId: currentUser?.id || reviewedReq.managerId,
        managerName: currentUser?.name || reviewedReq.managerName,
        date: '2026-10-10',
        time: '10:30 AM',
        reason: reviewedReq.reason,
        remarks: remarks || (decision === 'Approved' ? 'Smart Attendance history reviewed. Approved.' : 'Declined.'),
      };

      setApprovalAudits((prev) => [newAudit, ...prev]);

      // If approved and applies to today, update today's status to 'On Leave'
      if (decision === 'Approved' && reviewedReq.fromDate <= '2026-10-10' && reviewedReq.toDate >= '2026-10-10') {
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
  };

  const updateOfficeLocation = (newLocation: Partial<OfficeLocation>) => {
    setOfficeLocation((prev) => ({ ...prev, ...newLocation }));
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const resetAllData = () => {
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.TODAY_ATT);
    localStorage.removeItem(STORAGE_KEYS.HIST_ATT);
    localStorage.removeItem(STORAGE_KEYS.LEAVES);
    localStorage.removeItem(STORAGE_KEYS.AUDIT);
    localStorage.removeItem(STORAGE_KEYS.OFFICE);
    setUsers(INITIAL_USERS);
    setCurrentUser(null);
    setTodayAttendance(INITIAL_TODAY_ATTENDANCE);
    setHistoricalAttendance(INITIAL_HISTORICAL_ATTENDANCE);
    setLeaveRequests(INITIAL_LEAVE_REQUESTS);
    setApprovalAudits(INITIAL_APPROVAL_AUDIT);
    setOfficeLocation(DEFAULT_OFFICE);
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
        smartHoursConfig,
        notifications,
        login,
        logout,
        switchRoleQuick,
        addEmployee,
        deleteEmployee,
        addManager,
        addAdmin,
        registerFace,
        markAttendance,
        applyLeave,
        reviewLeaveRequest,
        updateOfficeLocation,
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
