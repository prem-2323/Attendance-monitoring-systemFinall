import React from 'react';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  UserCheck,
  CalendarCheck,
  CalendarDays,
  FileCheck2,
  FileSpreadsheet,
  Settings,
  LogOut,
  ScanFace,
  ClipboardList,
  Clock,
  ShieldCheck,
  Bell,
  User as UserIcon,
  ChevronDown,
  Building2,
  CheckSquare,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SafeImage } from './SafeImage';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const { currentUser, currentRole, logout, leaveRequests } = useApp();

  const pendingLeavesCount = leaveRequests.filter(
    (l) =>
      l.status === 'Pending' &&
      (currentRole === 'admin' || l.managerId === currentUser?.id)
  ).length;

  const handleNavClick = (tab: string) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const navItemClass = (tabName: string) => `
    flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all cursor-pointer
    ${
      currentTab === tabName
        ? 'bg-blue-50/80 text-blue-900 font-semibold shadow-xs'
        : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
    }
  `;

  const subNavItemClass = (tabName: string) => `
    flex items-center gap-2 pl-9 pr-3 py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer
    ${
      currentTab === tabName
        ? 'bg-blue-50/80 text-blue-900 font-semibold'
        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
    }
  `;

  const sectionLabelClass = 'px-3 pt-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider';

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200/80 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Workspace Brand / Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white font-bold shadow-xs">
              <span className="text-xs font-semibold">AM</span>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 capitalize leading-tight">
                {currentRole} Workspace
              </div>
              <div className="text-[11px] text-slate-400">
                Enterprise Cloud
              </div>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {/* ===================== ADMIN NAVIGATION ===================== */}
          {currentRole === 'admin' && (
            <>
              <div className={sectionLabelClass}>Overview</div>
              <button
                onClick={() => handleNavClick('admin-dashboard')}
                className={navItemClass('admin-dashboard')}
              >
                <LayoutDashboard className={`h-4 w-4 ${currentTab === 'admin-dashboard' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Dashboard</span>
              </button>

              <div className={sectionLabelClass}>Directory</div>
              {/* Employees */}
              <button
                onClick={() => handleNavClick('admin-employees')}
                className={navItemClass('admin-employees')}
              >
                <Users className={`h-4 w-4 ${currentTab === 'admin-employees' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>All Employees</span>
              </button>
              <button
                onClick={() => handleNavClick('admin-add-employee')}
                className={subNavItemClass('admin-add-employee')}
              >
                <span>+ Add Employee (Face)</span>
              </button>

              {/* Managers */}
              <button
                onClick={() => handleNavClick('admin-managers')}
                className={navItemClass('admin-managers')}
              >
                <UserCheck className={`h-4 w-4 ${currentTab === 'admin-managers' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Managers</span>
              </button>
              <button
                onClick={() => handleNavClick('admin-add-manager')}
                className={subNavItemClass('admin-add-manager')}
              >
                <span>+ Add Manager</span>
              </button>

              <div className={sectionLabelClass}>Monitoring</div>
              <button
                onClick={() => handleNavClick('admin-attendance-today')}
                className={navItemClass('admin-attendance-today')}
              >
                <CalendarCheck className={`h-4 w-4 ${currentTab === 'admin-attendance-today' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Today's Attendance</span>
              </button>

              <button
                onClick={() => handleNavClick('admin-attendance-history')}
                className={navItemClass('admin-attendance-history')}
              >
                <CalendarDays className={`h-4 w-4 ${currentTab === 'admin-attendance-history' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Attendance History</span>
              </button>

              <button
                onClick={() => handleNavClick('admin-leaves')}
                className={navItemClass('admin-leaves')}
              >
                <ClipboardList className={`h-4 w-4 ${currentTab === 'admin-leaves' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="flex-1 text-left">Leave Requests</span>
                {pendingLeavesCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
                    {pendingLeavesCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => handleNavClick('admin-approval-audit')}
                className={navItemClass('admin-approval-audit')}
              >
                <FileCheck2 className={`h-4 w-4 ${currentTab === 'admin-approval-audit' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Approval Audit</span>
              </button>

              <div className={sectionLabelClass}>Analytics & Settings</div>
              <button
                onClick={() => handleNavClick('admin-reports')}
                className={navItemClass('admin-reports')}
              >
                <FileSpreadsheet className={`h-4 w-4 ${currentTab === 'admin-reports' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Reports & Analytics</span>
              </button>

              <button
                onClick={() => handleNavClick('admin-settings')}
                className={navItemClass('admin-settings')}
              >
                <Settings className={`h-4 w-4 ${currentTab === 'admin-settings' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>System Settings</span>
              </button>
            </>
          )}

          {/* ===================== MANAGER NAVIGATION ===================== */}
          {currentRole === 'manager' && (
            <>
              <div className={sectionLabelClass}>Team Overview</div>
              <button
                onClick={() => handleNavClick('manager-dashboard')}
                className={navItemClass('manager-dashboard')}
              >
                <LayoutDashboard className={`h-4 w-4 ${currentTab === 'manager-dashboard' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => handleNavClick('manager-my-employees')}
                className={navItemClass('manager-my-employees')}
              >
                <Users className={`h-4 w-4 ${currentTab === 'manager-my-employees' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>My Employees</span>
              </button>

              <div className={sectionLabelClass}>Operations</div>
              <button
                onClick={() => handleNavClick('manager-attendance')}
                className={navItemClass('manager-attendance')}
              >
                <CalendarCheck className={`h-4 w-4 ${currentTab === 'manager-attendance' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Team Attendance</span>
              </button>

              <button
                onClick={() => handleNavClick('manager-leave-approval')}
                className={navItemClass('manager-leave-approval')}
              >
                <ClipboardList className={`h-4 w-4 ${currentTab === 'manager-leave-approval' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="flex-1 text-left">Leave Approvals</span>
                {pendingLeavesCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
                    {pendingLeavesCount}
                  </span>
                )}
              </button>

              <div className={sectionLabelClass}>Reports & Account</div>
              <button
                onClick={() => handleNavClick('manager-reports')}
                className={navItemClass('manager-reports')}
              >
                <FileSpreadsheet className={`h-4 w-4 ${currentTab === 'manager-reports' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Reports</span>
              </button>

              <button
                onClick={() => handleNavClick('manager-profile')}
                className={navItemClass('manager-profile')}
              >
                <UserIcon className={`h-4 w-4 ${currentTab === 'manager-profile' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Profile</span>
              </button>
            </>
          )}

          {/* ===================== EMPLOYEE NAVIGATION matching Section 15 ===================== */}
          {currentRole === 'employee' && (
            <>
              <div className={sectionLabelClass}>General</div>
              <button
                onClick={() => handleNavClick('emp-dashboard')}
                className={navItemClass('emp-dashboard')}
              >
                <LayoutDashboard className={`h-4 w-4 ${currentTab === 'emp-dashboard' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Dashboard</span>
              </button>

              {/* Primary Call to Action: Mark Attendance */}
              <div className="py-1">
                <button
                  onClick={() => handleNavClick('emp-mark-attendance')}
                  className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
                    currentTab === 'emp-mark-attendance'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/80 border border-emerald-200/50'
                  }`}
                >
                  <ScanFace className="h-4 w-4 text-emerald-600" />
                  <span>Mark Attendance</span>
                  <span className="ml-auto flex h-2 w-2 rounded-full bg-emerald-500" />
                </button>
              </div>

              <div className={sectionLabelClass}>Attendance & Shifts</div>
              <button
                onClick={() => handleNavClick('emp-attendance-history')}
                className={navItemClass('emp-attendance-history')}
              >
                <CalendarDays className={`h-4 w-4 ${currentTab === 'emp-attendance-history' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>My Attendance</span>
              </button>

              <button
                onClick={() => handleNavClick('emp-smart-hours')}
                className={navItemClass('emp-smart-hours')}
              >
                <Clock className={`h-4 w-4 ${currentTab === 'emp-smart-hours' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Smart Working Hours</span>
              </button>

              <div className={sectionLabelClass}>Leaves</div>
              <button
                onClick={() => handleNavClick('emp-apply-leave')}
                className={navItemClass('emp-apply-leave')}
              >
                <ClipboardList className={`h-4 w-4 ${currentTab === 'emp-apply-leave' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Apply Leave</span>
              </button>

              <button
                onClick={() => handleNavClick('emp-leave-status')}
                className={navItemClass('emp-leave-status')}
              >
                <CheckSquare className={`h-4 w-4 ${currentTab === 'emp-leave-status' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Leave Status</span>
              </button>

              <div className={sectionLabelClass}>Reports & Account</div>
              <button
                onClick={() => handleNavClick('emp-reports')}
                className={navItemClass('emp-reports')}
              >
                <FileSpreadsheet className={`h-4 w-4 ${currentTab === 'emp-reports' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>My Reports</span>
              </button>

              <button
                onClick={() => handleNavClick('emp-profile')}
                className={navItemClass('emp-profile')}
              >
                <UserIcon className={`h-4 w-4 ${currentTab === 'emp-profile' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>Profile</span>
              </button>
            </>
          )}
        </div>

        {/* Sidebar Footer with user badge & logout */}
        <div className="border-t border-slate-100 p-3 space-y-2">
          <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
            <div className="flex items-center gap-2.5">
              <SafeImage
                src={currentUser?.avatarUrl}
                alt={currentUser?.name ?? 'User'}
                className="h-8 w-8 rounded-lg object-cover ring-1 ring-slate-200"
                fallback={
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-bold text-white">
                    {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'U'}
                  </div>
                }
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {currentUser?.name}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {currentUser?.department}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
