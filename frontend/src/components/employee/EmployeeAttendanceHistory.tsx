import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Check,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AttendanceRecord, AttendanceStatus } from '../../types';
import { Skeleton } from '../common/Skeleton';
import { employeeApi } from '../../services/employeeApi';
import { formatIndiaClock, formatIndiaDate, getIndiaDateString } from '../../utils/dateTime';
import { downloadCsv } from '../../utils/csv';

export const EmployeeAttendanceHistory: React.FC = () => {
  const { currentUser, todayAttendance, historicalAttendance, refreshAttendance } = useApp();
  const [currentYear, currentMonth] = getIndiaDateString().split('-').map(Number);

  const availableMonths = [
    { label: 'All Records', prefix: '' },
    ...[0, 1, 2, 3, 4, 5].map((i) => {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthDate = new Date(`${prefix}-15T12:00:00+05:30`);
      return {
        label: formatIndiaDate(monthDate, { month: 'long', year: 'numeric' }),
        prefix,
      };
    }),
  ];

  const [selectedMonth, setSelectedMonth] = useState(availableMonths[1]?.label || 'All Records');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [liveRecords, setLiveRecords] = useState<AttendanceRecord[] | null>(null);
  const [liveStats, setLiveStats] = useState<{
    presentDays: number;
    lateDays: number;
    leaveDays: number;
    absentDays: number;
    inProgressDays?: number;
    flexibleShiftDays?: number;
    attendancePercentage: number;
  } | null>(null);

  const empId = currentUser?.employeeId || '';

  const fetchHistory = async () => {
    if (!empId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const matched = availableMonths.find((m) => m.label === selectedMonth);
      const monthPrefix = matched ? matched.prefix : '';
      const res = await employeeApi.getAttendanceHistory(empId, statusFilter, monthPrefix);
      if (res && res.records) {
        setLiveRecords(res.records);
        if (res.stats) {
          setLiveStats({
            presentDays: res.stats.presentDays,
            lateDays: res.stats.lateDays,
            leaveDays: res.stats.leaveDays,
            absentDays: res.stats.absentDays,
            attendancePercentage: res.stats.attendancePercentage,
          });
        }
      }
    } catch (err) {
      console.warn('Could not fetch live history from MongoDB Atlas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [empId, selectedMonth, statusFilter]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await Promise.all([refreshAttendance(), fetchHistory()]);
  };

  // Merge today's record and historical records for fallback
  const todayRec = todayAttendance.find((a) => a.employeeId === empId);
  const myHistory = historicalAttendance.filter((a) => a.employeeId === empId);
  const fallbackRecords = [...(todayRec ? [todayRec] : []), ...myHistory];

  const allRecords = liveRecords !== null ? liveRecords : fallbackRecords;

  const selectedMonthPrefix = availableMonths.find((month) => month.label === selectedMonth)?.prefix || '';
  const filteredRecords = allRecords.filter((rec) => {
    const matchesStatus = statusFilter === 'All' || rec.status === statusFilter;
    const matchesMonth = !selectedMonthPrefix || rec.date.startsWith(selectedMonthPrefix);
    return matchesStatus && matchesMonth;
  });

  // Calculate statistics: flexible shift counts as present; in-progress never absent.
  const FLEX = 'Present — Flexible Shift';
  const INPROG = 'In Progress';
  const isPresentLike = (s: string) => s === 'Present' || s === 'Working' || s === FLEX || s === 'Present — Half Day Leave';
  const presentDays = liveStats?.presentDays ?? allRecords.filter((a) => isPresentLike(a.status)).length;
  const lateDays = liveStats?.lateDays ?? allRecords.filter((a) => a.status === 'Late').length;
  const leaveDays = liveStats?.leaveDays ?? allRecords.filter((a) => a.status === 'On Leave' || a.status === 'Half Day Leave').length;
  const absentDays = liveStats?.absentDays ?? allRecords.filter((a) => a.status === 'Absent').length;
  const inProgressDays = liveStats?.inProgressDays ?? allRecords.filter((a) => a.status === INPROG).length;
  const flexibleDays = liveStats?.flexibleShiftDays ?? allRecords.filter((a) => a.status === FLEX).length;
  const totalDays = Math.max(1, presentDays + lateDays + leaveDays + absentDays + inProgressDays);
  const attendancePercentage = liveStats?.attendancePercentage ?? (Math.round(((presentDays + lateDays + inProgressDays) / totalDays) * 1000) / 10);

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'Present':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      case 'Present — Flexible Shift':
        return 'bg-teal-50 text-teal-700 border-teal-200/80';
      case 'Present — Half Day Leave':
        return 'bg-teal-50 text-teal-700 border-teal-200/80';
      case 'Half Day Leave':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/80';
      case 'In Progress':
        return 'bg-sky-50 text-sky-700 border-sky-200/80';
      case 'Working':
        return 'bg-blue-50 text-blue-700 border-blue-200/80';
      case 'Late':
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
      case 'On Leave':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/80';
      case 'Absent':
        return 'bg-rose-50 text-rose-700 border-rose-200/80';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200/80';
    }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Check-in', 'Check-out', 'Hours', 'Status', 'Verification'];
    const rows = filteredRecords.map((r) => [
      r.date || '',
      formatIndiaClock(r.checkIn) || '--',
      formatIndiaClock(r.checkOut) || '--',
      r.hoursWorked || '--',
      r.status,
      r.notes || 'Face + Office GPS Verified',
    ]);
    const monthFileName = selectedMonthPrefix || 'all_records';
    downloadCsv(`My_Attendance_${currentUser?.employeeId || empId}_${monthFileName}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            My Attendance
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            Monthly working log, attendance verification and smart-hours history from MongoDB Atlas.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer transition-colors"
            title="Refresh attendance records"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-xs focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            {availableMonths.map((m) => (
              <option key={m.label} value={m.label}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleExportCSV}
            disabled={isLoading || filteredRecords.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Monthly Attendance Rating & KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        {/* Monthly Attendance Rating Hero Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow flex items-center gap-4 sm:col-span-2">
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            {isLoading ? (
              <Skeleton className="h-6 w-12 rounded-md" />
            ) : (
              <span className="text-xl font-extrabold">{attendancePercentage}%</span>
            )}
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 mt-0.5">
              Rating
            </span>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Monthly Attendance
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {attendancePercentage >= 90 ? 'Excellent Standing' : attendancePercentage >= 75 ? 'Good Standing' : 'Needs Regularization'}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Fulfilling standard corporate shift requirements
            </p>
          </div>
        </div>

        {/* Compact KPI Card: Present */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 saas-card-shadow text-left">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Present
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {isLoading ? <Skeleton className="h-7 w-10" /> : presentDays}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">On-time + flex-shift days{flexibleDays > 0 ? ` (flex: ${flexibleDays})` : ''}{inProgressDays > 0 ? ` · in progress: ${inProgressDays}` : ''}</div>
        </div>

        {/* Compact KPI Card: Late */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 saas-card-shadow text-left">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Late
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {isLoading ? <Skeleton className="h-7 w-10" /> : lateDays}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Adjusted flex shift</div>
        </div>

        {/* Compact KPI Card: Leave & Absent */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 saas-card-shadow text-left">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Leave / Absent
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {isLoading ? <Skeleton className="h-7 w-16" /> : `${leaveDays} / ${absentDays}`}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Approved / Unexcused</div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white saas-card-shadow overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-900">{selectedMonth} Attendance Log</h2>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Present — Flexible Shift">Present — Flexible Shift</option>
              <option value="Present — Half Day Leave">Present — Half Day Leave</option>
              <option value="In Progress">In Progress</option>
              <option value="Working">Working</option>
              <option value="Late">Late</option>
              <option value="On Leave">Leave</option>
              <option value="Half Day Leave">Half Day Leave</option>
              <option value="Absent">Absent</option>
            </select>
          </div>
        </div>

        {/* Horizontally Scrollable Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Check-In</th>
                <th className="px-6 py-3.5">Check-Out</th>
                <th className="px-6 py-3.5">Hours</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-14" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-md" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton className="h-5 w-32 rounded-md ml-auto" /></td>
                  </tr>
                ))
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-xs text-slate-400">
                    No attendance records found for this period.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {item.date}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {formatIndiaClock(item.checkIn) || <span className="text-slate-300">--</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {formatIndiaClock(item.checkOut) || <span className="text-slate-300">--</span>}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {item.hoursWorked || <span className="text-slate-300">--</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold border ${getStatusBadge(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-100">
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span>{item.verifiedBy || 'Face + Office GPS'}</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
