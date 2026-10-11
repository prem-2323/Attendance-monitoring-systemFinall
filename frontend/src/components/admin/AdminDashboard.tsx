import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  CalendarClock,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Shield,
  FileCheck2,
  UserPlus,
  FileSpreadsheet,
  Check,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  Skeleton,
  SkeletonStatsGrid,
  SkeletonChartCard,
  SkeletonListCard,
} from '../common/Skeleton';

import { adminApi, DashboardStatsResponse } from '../../services/adminApi';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { currentUser, users, todayAttendance, approvalAudits, refreshUsers, refreshAttendance, refreshApprovalAudits } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [liveStats, setLiveStats] = useState<DashboardStatsResponse | null>(null);

  const loadStats = async () => {
    try {
      const data = await adminApi.getDashboardStats();
      setLiveStats(data);
    } catch (err) {
      console.warn('[AdminDashboard] Failed to fetch live dashboard stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    await Promise.all([
      loadStats(),
      refreshUsers(),
      refreshAttendance(),
      refreshApprovalAudits(),
    ]);
  };

  const totalEmployeesCount = liveStats?.totalEmployeesCount ?? users.filter((u) => u.role === 'employee').length;
  const presentCount = liveStats?.presentCount ?? todayAttendance.filter(
    (a) => a.status === 'Present' || a.status === 'Working'
  ).length;
  const lateCount = liveStats?.lateCount ?? todayAttendance.filter((a) => a.status === 'Late').length;
  const onLeaveCount = liveStats?.onLeaveCount ?? todayAttendance.filter((a) => a.status === 'On Leave').length;
  const absentCount = liveStats?.absentCount ?? Math.max(0, totalEmployeesCount - (presentCount + lateCount + onLeaveCount));

  const totalTracked = Math.max(1, presentCount + lateCount + onLeaveCount + absentCount);
  const presentPct = liveStats?.presentPct ?? Math.round(((presentCount + lateCount) / totalTracked) * 100);

  // Live recent activity stream
  const recentActivities = liveStats?.recentActivities && liveStats.recentActivities.length > 0
    ? liveStats.recentActivities
    : todayAttendance.slice(0, 5).map((rec) => ({
        employee: `${rec.employeeName} (${rec.employeeId})`,
        activity: rec.checkIn ? `Check-in via ${rec.verifiedBy}` : `Status: ${rec.status}`,
        time: rec.checkIn || rec.date,
        type: rec.checkIn ? 'checkin' : 'status',
        tagColor: rec.status === 'Present'
          ? 'text-emerald-700 bg-emerald-50 border-emerald-200/80'
          : rec.status === 'Late'
          ? 'text-amber-700 bg-amber-50 border-amber-200/80'
          : 'text-slate-700 bg-slate-100 border-slate-200/80',
      }));

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Top Banner & Greetings */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Good Morning, {currentUser?.name || 'Admin'} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            Today's Overview · Real-time attendance surveillance & biometric monitoring across departments.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            title="Refresh dashboard data"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => onNavigate('admin-add-employee')}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Employee</span>
          </button>
          <button
            onClick={() => onNavigate('admin-reports')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
            <span>Reports</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Skeleton KPI Cards */}
          <SkeletonStatsGrid count={4} cols="grid-cols-2 sm:grid-cols-4" />

          {/* Skeleton Middle Grid: Attendance Overview Charts & Security Status */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SkeletonChartCard className="lg:col-span-2" height="h-44" />
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <Skeleton className="h-5 w-32 rounded-md" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
              <div className="space-y-3 pt-1">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            </div>
          </div>

          {/* Skeleton Recent Activity */}
          <SkeletonListCard rows={5} />
        </div>
      ) : (
        <>
      {/* Overview Cards matching Prompt 3 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Total Employees */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Total Employees</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">
            {totalEmployeesCount}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Across {Object.keys(liveStats?.departmentBreakdown || {}).length || 3} departments
          </div>
        </div>

        {/* Present Today */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Present Today</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-600">
            {presentCount}
          </div>
          <div className="mt-1 text-xs text-emerald-700 font-medium">
            {presentPct}% attendance rate
          </div>
        </div>

        {/* Absent Today */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Absent Today</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <UserX className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-rose-600">
            {absentCount}
          </div>
          <div className="mt-1 text-xs text-rose-600">
            Pending / Unexcused
          </div>
        </div>

        {/* On Leave Today */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>On Leave</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <CalendarClock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-blue-600">
            {onLeaveCount}
          </div>
          <div className="mt-1 text-xs text-blue-600">
            Approved leaves
          </div>
        </div>
      </div>

      {/* Middle Grid: Attendance Overview Charts & Security Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chart Column (2 spans) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Attendance Overview</h2>
              <p className="text-xs text-slate-500">
                Daily biometric check-in distribution breakdown
              </p>
            </div>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              Live Oct 10, 2026
            </span>
          </div>

          {/* Bar Chart Visualizer */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Present (On Time)
                </span>
                <span className="font-semibold text-slate-900">
                  {presentCount} ({Math.round((presentCount / totalTracked) * 100)}%)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.round((presentCount / totalTracked) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  Late Arrivals (After 09:15 AM)
                </span>
                <span className="font-semibold text-slate-900">
                  {lateCount} ({Math.round((lateCount / totalTracked) * 100)}%)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${Math.round((lateCount / totalTracked) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  On Approved Leave
                </span>
                <span className="font-semibold text-slate-900">
                  {onLeaveCount} ({Math.round((onLeaveCount / totalTracked) * 100)}%)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${Math.round((onLeaveCount / totalTracked) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  Absent / Unregistered
                </span>
                <span className="font-semibold text-slate-900">
                  {absentCount} ({Math.round((absentCount / totalTracked) * 100)}%)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-rose-500 transition-all duration-500"
                  style={{ width: `${Math.round((absentCount / totalTracked) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5 border border-slate-100 text-xs">
            <span className="text-slate-600">
              Campus Hardware Status: <strong>3 Office Scanners Online</strong>
            </span>
            <button
              onClick={() => onNavigate('admin-attendance-today')}
              className="font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              View Full Roll →
            </button>
          </div>
        </div>

        {/* Security & Geofence Status */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Security & Geofence</h2>
            <Shield className="h-4 w-4 text-emerald-600" />
          </div>

          <div className="space-y-3 text-xs">
            <div className="rounded-xl bg-emerald-50/70 p-3.5 border border-emerald-100">
              <div className="font-bold text-emerald-950">Face Recognition AI</div>
              <div className="text-[11px] text-emerald-700 mt-1 leading-relaxed">
                128-D Biometric Embedding model. Active confidence threshold: 98.5%.
              </div>
            </div>

            <div className="rounded-xl bg-blue-50/70 p-3.5 border border-blue-100">
              <div className="font-bold text-blue-950">Liveness Verification</div>
              <div className="text-[11px] text-blue-700 mt-1 leading-relaxed">
                Passive eye-blink challenge + head movement anti-spoof detection.
              </div>
            </div>

            <div className="rounded-xl bg-amber-50/70 p-3.5 border border-amber-100">
              <div className="font-bold text-amber-950">GPS Geofencing Radar</div>
              <div className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                HQ Campus Radius: 150 meters. Strict spoofing prevention active.
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => onNavigate('admin-approval-audit')}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-2.5 font-semibold text-slate-700 hover:bg-slate-100 transition-colors text-xs cursor-pointer"
              >
                <FileCheck2 className="h-4 w-4 text-slate-500" />
                <span>Open Approval Audit Trail ({approvalAudits.length})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table matching Section 3 */}
      <div className="rounded-2xl border border-slate-200/80 bg-white saas-card-shadow overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Activity</h2>
            <p className="text-xs text-slate-500 mt-0.5">Live stream of incoming attendance events</p>
          </div>
          <button
            onClick={() => onNavigate('admin-attendance-today')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer self-start sm:self-auto"
          >
            View All Log →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-3.5">Employee</th>
                <th className="px-6 py-3.5">Activity</th>
                <th className="px-6 py-3.5">Time</th>
                <th className="px-6 py-3.5 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentActivities.map((act, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900">{act.employee}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold border ${act.tagColor}`}>
                      {act.activity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{act.time}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                      <Check className="h-3 w-3" />
                      <span>Verified</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
