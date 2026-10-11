import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  CalendarCheck,
  ClipboardList,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  CalendarDays,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Skeleton, SkeletonStatsGrid, SkeletonTable } from '../common/Skeleton';
import { managerApi, ManagerDashboardData } from '../../services/managerApi';

interface ManagerDashboardProps {
  onNavigate: (tab: string) => void;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ onNavigate }) => {
  const { currentUser, users, todayAttendance, leaveRequests, refreshAttendance, refreshLeaveRequests } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [liveDashboard, setLiveDashboard] = useState<ManagerDashboardData | null>(null);

  const managerId = currentUser?.id || currentUser?.employeeId || '';

  const fetchDashboard = async () => {
    if (!managerId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await managerApi.getDashboard(managerId);
      if (data) {
        setLiveDashboard(data);
      }
    } catch (err) {
      console.warn('Could not fetch manager dashboard from Atlas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [managerId]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await Promise.all([refreshAttendance(), refreshLeaveRequests(), fetchDashboard()]);
  };

  // Direct reports fallback from AppContext
  const myEmployees = users.filter(
    (u) =>
      u.role === 'employee' &&
      (u.managerId === currentUser?.id || u.managerName === currentUser?.name || u.department === currentUser?.department)
  );

  const myEmployeeIds = myEmployees.map((e) => e.employeeId);
  const myTeamToday = liveDashboard?.teamTodayAttendance || todayAttendance.filter((a) => myEmployeeIds.includes(a.employeeId));

  const totalTeamCount = liveDashboard?.totalTeamCount ?? myEmployees.length;
  const presentCount = liveDashboard?.presentCount ?? myTeamToday.filter(
    (a) => a.status === 'Present' || a.status === 'Working'
  ).length;
  const lateCount = liveDashboard?.lateCount ?? myTeamToday.filter((a) => a.status === 'Late').length;
  const onLeaveCount = liveDashboard?.onLeaveCount ?? myTeamToday.filter((a) => a.status === 'On Leave').length;
  const absentCount = liveDashboard?.absentCount ?? Math.max(0, totalTeamCount - (presentCount + lateCount + onLeaveCount));

  // Pending leaves for my team
  const pendingLeavesCount = liveDashboard?.pendingLeavesCount ?? leaveRequests.filter(
    (l) => (l.managerId === currentUser?.id || l.managerName === currentUser?.name) && l.status === 'Pending'
  ).length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Greeting Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Manager Overview: {currentUser?.name || 'Manager'} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            Supervising {currentUser?.department || 'Engineering'} Department · Live MongoDB Atlas roster synchronization active.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
            title="Refresh team overview"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {pendingLeavesCount > 0 && (
            <button
              onClick={() => onNavigate('manager-leave-approval')}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-600 transition-colors cursor-pointer"
            >
              <ClipboardList className="h-4 w-4" />
              <span>{pendingLeavesCount} Leave Approvals Pending</span>
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div>
            <div className="mb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
              My Team Performance
            </div>
            <SkeletonStatsGrid count={5} cols="grid-cols-2 sm:grid-cols-5" />
          </div>
          <SkeletonTable rows={4} cols={6} />
        </div>
      ) : (
        <>
          {/* Team Metric Cards */}
          <div>
            <div className="mb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
              My Team Performance
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Total Team
                </span>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {totalTeamCount}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">Direct reports</div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block">
                  Present
                </span>
                <div className="mt-2 text-2xl font-bold text-emerald-600">
                  {presentCount}
                </div>
                <div className="mt-1 text-[11px] text-emerald-700">Checked in</div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
                <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider block">
                  Absent
                </span>
                <div className="mt-2 text-2xl font-bold text-rose-600">
                  {absentCount}
                </div>
                <div className="mt-1 text-[11px] text-rose-600">No arrival logged</div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider block">
                  On Leave
                </span>
                <div className="mt-2 text-2xl font-bold text-blue-600">
                  {onLeaveCount}
                </div>
                <div className="mt-1 text-[11px] text-blue-700">Approved leaves</div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider block">
                  Late
                </span>
                <div className="mt-2 text-2xl font-bold text-amber-600">
                  {lateCount}
                </div>
                <div className="mt-1 text-[11px] text-amber-700">Past grace cutoff</div>
              </div>
            </div>
          </div>

          {/* Today's Team Attendance Table */}
          <div className="rounded-2xl border border-slate-200/80 bg-white saas-card-shadow overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Today's Team Attendance</h2>
                <p className="text-xs text-slate-500 mt-0.5">Live roster for {currentUser?.department || 'Engineering'}</p>
              </div>
              <button
                onClick={() => onNavigate('manager-attendance')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer self-start sm:self-auto"
              >
                View Full Team History →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                  <tr>
                    <th className="px-6 py-3.5">Employee</th>
                    <th className="px-6 py-3.5">Check-in</th>
                    <th className="px-6 py-3.5">Check-out</th>
                    <th className="px-6 py-3.5">Working Hours</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Shift Policy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myTeamToday.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-xs text-slate-400">
                        No active team attendance records for today.
                      </td>
                    </tr>
                  ) : (
                    myTeamToday.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{rec.employeeName}</div>
                          <div className="text-[11px] text-slate-400 font-normal">
                            {rec.employeeId} · {rec.department}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          {rec.checkIn || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          {rec.checkOut || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {rec.hoursWorked || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                              rec.status === 'Present'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                                : rec.status === 'Working'
                                ? 'bg-blue-50 text-blue-700 border-blue-200/80'
                                : rec.status === 'Late'
                                ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                                : rec.status === 'On Leave'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                                : 'bg-rose-50 text-rose-700 border-rose-200/80'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-xs text-slate-500">
                          {rec.status === 'Present' || rec.status === 'Working' ? (
                            <span className="text-emerald-600 font-semibold">On Track (8h)</span>
                          ) : (
                            <span>Standard Shift</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Smart Leave Approval Highlight Banner */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Smart Leave Approval Process</h3>
              <p className="text-xs text-slate-500 mt-1">
                Review your team's past 30-day punctuality, late arrivals, and absence history before making leave decisions.
              </p>
            </div>
            <button
              onClick={() => onNavigate('manager-leave-approval')}
              className="shrink-0 flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <span>Open Smart Approvals</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
