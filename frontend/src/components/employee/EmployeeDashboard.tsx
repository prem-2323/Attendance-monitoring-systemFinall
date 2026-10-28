import React, { useState, useEffect } from 'react';
import {
  ScanFace,
  CalendarCheck,
  Clock,
  ClipboardList,
  CheckCircle2,
  MapPin,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  CalendarDays,
  FileCheck2,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatIndiaClock } from '../../utils/dateTime';
import {
  Skeleton,
  SkeletonStatsGrid,
} from '../common/Skeleton';
import { employeeApi, EmployeeDashboardResponse, SmartHoursResponse } from '../../services/employeeApi';

interface EmployeeDashboardProps {
  onNavigate: (tab: string) => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ onNavigate }) => {
  const {
    currentUser,
    todayAttendance,
    historicalAttendance,
    refreshAttendance,
    smartHoursConfig,
  } = useApp();

  const [isLoading, setIsLoading] = useState(true);
  const [liveDashboard, setLiveDashboard] = useState<EmployeeDashboardResponse | null>(null);
  const [liveSmartHours, setLiveSmartHours] = useState<SmartHoursResponse | null>(null);

  const empId = currentUser?.employeeId || '';

  const fetchDashboardData = async (showLoading = true) => {
    if (!empId) {
      setIsLoading(false);
      return;
    }
    if (showLoading) setIsLoading(true);
    try {
      const [dash, smart] = await Promise.all([
        employeeApi.getDashboard(empId),
        employeeApi.getSmartHours(empId),
      ]);
      setLiveDashboard(dash);
      setLiveSmartHours(smart);
    } catch (err) {
      console.warn('Could not fetch employee dashboard from Atlas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    if (!empId) return;
    const refreshTimer = window.setInterval(() => {
      void fetchDashboardData(false);
    }, 30000);
    return () => window.clearInterval(refreshTimer);
  }, [empId]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await Promise.all([refreshAttendance(), fetchDashboardData()]);
  };

  // Find employee's today record from Atlas or AppContext
  const todayRecord = liveDashboard?.todayRecord || todayAttendance.find((a) => a.employeeId === empId);

  // Historical records calculation fallback
  const myHistory = historicalAttendance.filter((a) => a.employeeId === empId);
  const allMyRecords = [...(todayRecord ? [todayRecord] : []), ...myHistory];

  const totalDays = Math.max(1, liveDashboard?.totalTrackedDays || allMyRecords.length);
  const FLEX_S = 'Present — Flexible Shift';
  const INPROG_S = 'In Progress';
  const presentCount = allMyRecords.filter(
    (a) => a.status === 'Present' || a.status === 'Working' || (a.status as string) === FLEX_S || a.status === 'Present — Half Day Leave'
  ).length;
  const inProgressCount = allMyRecords.filter((a) => (a.status as string) === INPROG_S).length;
  const lateCount = allMyRecords.filter((a) => a.status === 'Late').length;
  const attendanceRate = liveDashboard?.attendanceRate ?? (allMyRecords.length > 0 ? (Math.round(((presentCount + lateCount + inProgressCount) / totalDays) * 1000) / 10) : 0);

  const checkInTime = formatIndiaClock(todayRecord?.checkIn) || '--';
  const checkOutTime = formatIndiaClock(todayRecord?.checkOut) || '--';
  const hoursWorked = todayRecord?.hoursWorked || (liveSmartHours?.workedTime && checkInTime !== '--' ? liveSmartHours.workedTime : '--');
  const remainingTime = liveSmartHours?.remainingTime || (checkInTime !== '--' ? 'Pending' : '--');
  const liveShiftConfig = liveSmartHours?.smartConfig || smartHoursConfig;
  const requiredHours = liveSmartHours?.targetHoursPerDay ?? liveShiftConfig.expectedHoursPerDay;
  const requiredMinutes = Math.round(requiredHours * 60);
  const requiredDuration = `${Math.floor(requiredMinutes / 60)}h ${String(requiredMinutes % 60).padStart(2, '0')}m`;
  const expectedCheckout = checkInTime !== '--'
    ? (formatIndiaClock(liveSmartHours?.expectedCheckoutTime) || formatIndiaClock(liveShiftConfig.outTime) || '--')
    : (formatIndiaClock(liveShiftConfig.outTime) || '--');
  const completionPercent = checkInTime !== '--' ? (liveSmartHours?.completionPercent || 0) : 0;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Top Welcome Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Good morning, {currentUser?.name?.split(' ')[0] || 'Employee'} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            {currentUser?.department} · Employee ID: <span className="font-semibold text-slate-700">{currentUser?.employeeId}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
            title="Refresh dashboard stats"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Mark attendance action */}
          <button
            onClick={() => onNavigate('emp-mark-attendance')}
            className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 hover:shadow-md transition-all cursor-pointer group shrink-0"
          >
            <ScanFace className="h-4 w-4 text-emerald-100 transition-transform group-hover:scale-110" />
            <span>Mark Attendance</span>
            <ArrowRight className="h-4 w-4 text-emerald-200 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-8 animate-in fade-in duration-200">
          <SkeletonStatsGrid count={4} cols="grid-cols-2 lg:grid-cols-4" />

          {/* Skeleton Smart Hours Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-48 rounded-md" />
                <Skeleton className="h-3 w-64 rounded-md" />
              </div>
              <Skeleton className="h-4 w-28 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-20 rounded-md" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
              ))}
            </div>
            <Skeleton className="h-3 w-full rounded-full" />
          </div>

          {/* Skeleton 3 Action Cards */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow space-y-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-5 w-36 rounded-md" />
                <Skeleton className="h-3.5 w-full rounded-md" />
                <Skeleton className="h-3.5 w-2/3 rounded-md" />
                <Skeleton className="h-4 w-24 rounded-md pt-2" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 4-Column Statistics KPI Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* CHECK IN */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>Check In</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                {checkInTime}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                {checkInTime !== '--' ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Face + GPS Verified</span>
                  </>
                ) : (
                  <span className="text-amber-600 font-medium">Pending today</span>
                )}
              </div>
            </div>

            {/* CHECK OUT */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>Check Out</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                {checkOutTime}
              </div>
              <div className="mt-2 text-xs font-normal text-slate-400">
                {checkOutTime === '--'
                  ? (checkInTime !== '--'
                      ? `Expected ~${expectedCheckout}`
                      : `Shift: ${liveShiftConfig.inTime} – ${liveShiftConfig.outTime}`)
                  : 'Shift completed'}
              </div>
            </div>

            {/* WORKING TIME */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>Working Time</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                {hoursWorked}
              </div>
              <div className="mt-2 text-xs font-normal text-slate-500">
                Target: {Number(requiredHours).toFixed(1)} Hours
              </div>
            </div>

            {/* ATTENDANCE */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <span>Attendance</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                {attendanceRate}%
              </div>
              <div className="mt-2 text-xs font-medium text-emerald-600">
                On-time rating
              </div>
            </div>
          </div>

          {/* SMART WORKING HOURS CARD */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Today's Work & Smart Flexible Policy
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dynamic shift calculation computed from MongoDB Atlas logs
                </p>
              </div>
              <button
                onClick={() => onNavigate('emp-smart-hours')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer self-start sm:self-auto"
              >
                <span>View Full Breakdown</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 text-left">
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500">Expected Shift</span>
                <div className="text-base font-bold text-slate-900">{requiredHours} Hours</div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500">Check-in</span>
                <div className="text-base font-bold text-slate-900">{checkInTime}</div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500">Time Worked</span>
                <div className="text-base font-bold text-blue-600">{hoursWorked}</div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500">Remaining</span>
                <div className="text-base font-bold text-amber-600">{checkInTime !== '--' ? remainingTime : requiredDuration}</div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500">Expected Check-out</span>
                <div className="text-base font-bold text-emerald-600">{expectedCheckout}</div>
              </div>
            </div>

            {/* Dynamic Progress Bar */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between text-xs font-medium text-slate-600">
                <span>{completionPercent}% shift completed</span>
                <span className="text-slate-400">Target: {Number(requiredHours).toFixed(1)}h</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* QUICK ACTION CARDS */}
          <div>
            <div className="mb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
              Quick Actions
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Card 1: Mark Attendance */}
              <div
                onClick={() => onNavigate('emp-mark-attendance')}
                className="group rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow saas-card-hover cursor-pointer"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                  <ScanFace className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                  Mark Attendance
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed font-normal">
                  Verify identity through face scan and GPS office box check.
                </p>
                <div className="mt-4 flex items-center text-xs font-semibold text-emerald-600 group-hover:text-emerald-700">
                  <span>Start verification</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>

              {/* Card 2: My Attendance History */}
              <div
                onClick={() => onNavigate('emp-attendance-history')}
                className="group rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow saas-card-hover cursor-pointer"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                  My Attendance History
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed font-normal">
                  Review monthly check-in logs, punctuality metrics, and hours recorded.
                </p>
                <div className="mt-4 flex items-center text-xs font-semibold text-blue-600 group-hover:text-blue-700">
                  <span>View logs & export</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>

              {/* Card 3: Apply for Leave */}
              <div
                onClick={() => onNavigate('emp-apply-leave')}
                className="group rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow saas-card-hover cursor-pointer"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                  Apply for Leave
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed font-normal">
                  Submit casual, sick, or personal leave requests directly for smart managerial review.
                </p>
                <div className="mt-4 flex items-center text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
                  <span>Submit request</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
