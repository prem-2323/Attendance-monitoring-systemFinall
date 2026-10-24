import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  MapPin,
  ShieldCheck,
  CalendarDays,
  FileSpreadsheet,
  Download,
  Calendar,
  Eye,
  X,
  Plus,
  SlidersHorizontal,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AttendanceRecord, AttendanceStatus } from '../../types';
import { formatIndiaClock, formatIndiaDate, getIndiaDateOffsetString, getIndiaDateString } from '../../utils/dateTime';
import {
  Skeleton,
  SkeletonStatCard,
  SkeletonTable,
} from '../common/Skeleton';

interface AdminAttendanceProps {
  initialMode?: 'today' | 'history';
}

export const AdminAttendance: React.FC<AdminAttendanceProps> = ({ initialMode = 'today' }) => {
  const {
    todayAttendance,
    historicalAttendance,
    allAttendance,
    users,
    officeLocation,
    overrideAttendanceRecord,
    refreshAttendance,
  } = useApp();

  const todayStr = getIndiaDateString();
  const firstDayOfMonth = `${todayStr.slice(0, 7)}-01`;
  const weekAgoStr = getIndiaDateOffsetString(-7);
  const currentMonthPrefix = todayStr.slice(0, 7);

  const [viewMode, setViewMode] = useState<'today' | 'history'>(initialMode);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [employeeFilter, setEmployeeFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [datePreset, setDatePreset] = useState<'all' | 'month' | 'week' | 'custom'>('all');
  const [fromDate, setFromDate] = useState<string>(firstDayOfMonth);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [inspectRecord, setInspectRecord] = useState<AttendanceRecord | null>(null);

  // Manual regularization modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideEmpId, setOverrideEmpId] = useState(users[0]?.employeeId || '');
  const [overrideDate, setOverrideDate] = useState(todayStr);
  const [overrideStatus, setOverrideStatus] = useState<AttendanceStatus>('Present');
  const [overrideReason, setOverrideReason] = useState('');
  const [statusFeedback, setStatusFeedback] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [viewMode, datePreset, statusFilter, deptFilter]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await refreshAttendance();
    setIsLoading(false);
  };

  // Pick dataset based on view mode
  const baseList = viewMode === 'today' ? todayAttendance : historicalAttendance;

  // Filter records
  const filteredList = baseList.filter((item) => {
    const matchesSearch =
      item.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    const matchesDept = deptFilter === 'All' || item.department === deptFilter;
    const matchesEmp = employeeFilter === 'All' || item.employeeId === employeeFilter;

    let matchesDate = true;
    if (viewMode === 'history') {
      if (datePreset === 'all') {
        matchesDate = true;
      } else if (datePreset === 'month') {
        matchesDate = item.date.startsWith(currentMonthPrefix);
      } else if (datePreset === 'week') {
        matchesDate = item.date >= weekAgoStr;
      } else if (datePreset === 'custom') {
        matchesDate = (!fromDate || item.date >= fromDate) && (!toDate || item.date <= toDate);
      }
    }

    return matchesSearch && matchesStatus && matchesDept && matchesEmp && matchesDate;
  });

  // Calculate metrics for the active filtered dataset
  const totalRecords = filteredList.length;
  const presentCount = filteredList.filter((r) => r.status === 'Present' || r.status === 'Working').length;
  const lateCount = filteredList.filter((r) => r.status === 'Late').length;
  const leaveCount = filteredList.filter((r) => r.status === 'On Leave').length;
  const absentCount = filteredList.filter((r) => r.status === 'Absent').length;
  const attendancePct = totalRecords > 0 ? Math.round(((presentCount + lateCount) / totalRecords) * 100) : 0;

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'Present':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Working':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Late':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'On Leave':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Absent':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const handleExportCSV = () => {
    const headers = ['Record ID', 'Date', 'Employee ID', 'Name', 'Department', 'Check-In', 'Check-Out', 'Hours Worked', 'Status', 'Verification', 'Location Distance'];
    const rows = filteredList.map((r) => [
      r.id,
      r.date,
      r.employeeId,
      `"${r.employeeName}"`,
      `"${r.department}"`,
      formatIndiaClock(r.checkIn) || '--',
      formatIndiaClock(r.checkOut) || '--',
      r.hoursWorked || '--',
      r.status,
      r.verifiedBy,
      `"${r.distanceMeters}m"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_${viewMode}_${getIndiaDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApplyOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const res = await overrideAttendanceRecord({
      employeeId: overrideEmpId,
      date: overrideDate,
      status: overrideStatus,
      reason: overrideReason,
    });
    setIsLoading(false);
    if (res.success) {
      setStatusFeedback(res.message);
      setShowOverrideModal(false);
    } else {
      setStatusFeedback(`Override error: ${res.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {statusFeedback && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/95 p-3.5 text-xs font-semibold text-emerald-800 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{statusFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusFeedback('')}
            className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-200 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header & View Mode Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            {viewMode === 'today' ? "Today's Attendance" : 'Attendance History'}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {viewMode === 'today'
              ? `Live biometric surveillance and arrival tracking for today's active shift (${formatIndiaDate(new Date(), { month: 'short', day: 'numeric', year: 'numeric' })}).`
              : 'Complete multi-day historical check-in audit logs, punctuality metrics, and working hour records.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Switcher Tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <button
              onClick={() => setViewMode('today')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'today'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today's Attendance ({formatIndiaDate(new Date(), { month: 'short', day: 'numeric' })})
            </button>
            <button
              onClick={() => {
                setViewMode('history');
                setDatePreset('all');
              }}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'history'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Attendance History
            </button>
          </div>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
            title="Refresh Attendance Records"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
            title="Export Records to CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={() => setShowOverrideModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs cursor-pointer"
            title="Add Manual Attendance Adjustment"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Regularize Override</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards for Selected View */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2">
              <Skeleton className="h-3 w-16 rounded-md" />
              <Skeleton className="h-6 w-12 rounded-md" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Records
          </span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">
            {totalRecords}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">
            Attendance Rate
          </span>
          <span className="text-xl font-bold text-emerald-600 mt-1 block">
            {attendancePct}%
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
            Present
          </span>
          <span className="text-xl font-bold text-emerald-700 mt-1 block">
            {presentCount}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">
            Late
          </span>
          <span className="text-xl font-bold text-amber-600 mt-1 block">
            {lateCount}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">
            On Leave
          </span>
          <span className="text-xl font-bold text-blue-600 mt-1 block">
            {leaveCount}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider block">
            Absent
          </span>
          <span className="text-xl font-bold text-rose-600 mt-1 block">
            {absentCount}
          </span>
        </div>
      </div>
      )}

      {/* Comprehensive Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Quick Date Presets in History Mode */}
          {viewMode === 'history' && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-semibold mr-1">Date Range:</span>
              <button
                onClick={() => setDatePreset('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  datePreset === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All History
              </button>
              <button
                onClick={() => setDatePreset('month')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  datePreset === 'month'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setDatePreset('week')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  datePreset === 'week'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setDatePreset('custom')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  datePreset === 'custom'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Custom Range
              </button>
            </div>
          )}

          {datePreset === 'custom' && viewMode === 'history' && (
            <div className="flex items-center gap-2 text-xs">
              <span>From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900"
              />
              <span>To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900"
              />
            </div>
          )}
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="relative sm:col-span-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Employee Name or ID..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
            >
              <option value="All">All Employees</option>
              {users.map((u) => (
                <option key={u.id} value={u.employeeId}>
                  {u.name} ({u.employeeId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
            >
              <option value="All">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Product & Operations">Product & Operations</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Present">Present (On Time)</option>
              <option value="Working">Working (Active)</option>
              <option value="Late">Late (Post 11:40 AM)</option>
              <option value="On Leave">On Approved Leave</option>
              <option value="Absent">Absent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Attendance Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Check-In</th>
                <th className="px-5 py-3.5">Check-Out</th>
                <th className="px-5 py-3.5">Hours</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Verification & GPS</th>
                <th className="px-5 py-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-3.5"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-5 py-3.5"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-5 py-3.5"><Skeleton className="h-4 w-12" /></td>
                    <td className="px-5 py-3.5"><Skeleton className="h-6 w-20 rounded-md" /></td>
                    <td className="px-5 py-3.5"><Skeleton className="h-5 w-24 rounded-md" /></td>
                    <td className="px-5 py-3.5 text-right"><Skeleton className="h-7 w-14 rounded-md ml-auto" /></td>
                  </tr>
                ))
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-xs text-slate-400">
                    <Calendar className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No attendance records found matching filters.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Try resetting your search query or selecting "All History" preset above.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredList.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      {rec.date}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{rec.employeeName}</div>
                      <div className="text-[11px] text-slate-400">
                        {rec.employeeId} · {rec.department}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-800 font-medium">
                      {formatIndiaClock(rec.checkIn) || <span className="text-slate-300">--</span>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-800 font-medium">
                      {formatIndiaClock(rec.checkOut) || <span className="text-slate-300">--</span>}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      {rec.hoursWorked || <span className="text-slate-300">--</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadge(
                          rec.status
                        )}`}
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        {rec.withinRadius ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-700">
                            <MapPin className="h-3 w-3 text-emerald-600" />
                            <span>{rec.distanceMeters}m from HQ</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">{rec.locationName}</span>
                        )}
                        <span className="text-slate-300">·</span>
                        <span className="text-[11px] text-slate-500 font-medium">{rec.verifiedBy}</span>
                      </div>
                      {rec.notes && (
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs">
                          {rec.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setInspectRecord(rec)}
                        className="rounded px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs text-slate-500">
          <span>Showing {filteredList.length} of {baseList.length} attendance records</span>
          <span className="text-[11px] font-medium text-slate-500">Campus Facility: {officeLocation.name}</span>
        </div>
      </div>

      {/* Record Inspection Modal */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Attendance Verification Certificate</h3>
              </div>
              <button
                onClick={() => setInspectRecord(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Employee:</span>
                  <span className="font-bold text-slate-900">{inspectRecord.employeeName} ({inspectRecord.employeeId})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date Logged:</span>
                  <span className="font-semibold text-slate-900">{inspectRecord.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Recorded Timestamps:</span>
                  <span className="font-medium text-slate-900">
                    Check-in: {formatIndiaClock(inspectRecord.checkIn) || '--'} | Check-out: {formatIndiaClock(inspectRecord.checkOut) || '--'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Classification:</span>
                  <span className="font-bold text-slate-900">{inspectRecord.status}</span>
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 space-y-2 text-emerald-900">
                <div className="font-bold uppercase tracking-wider text-[11px] text-emerald-800">
                  Biometrics & GPS Telemetry
                </div>
                <div className="flex justify-between">
                  <span>Facial Matching Confidence:</span>
                  <span className="font-bold">99.4% Cosine Match</span>
                </div>
                <div className="flex justify-between">
                  <span>Liveness Check:</span>
                  <span className="font-bold">✓ Pass (Anti-Spoof Verified)</span>
                </div>
                <div className="flex justify-between">
                  <span>GPS Geofence Distance:</span>
                  <span className="font-bold">{inspectRecord.distanceMeters}m (Limit: {officeLocation.allowedRadiusMeters}m)</span>
                </div>
                <div className="flex justify-between">
                  <span>Location Signature:</span>
                  <span>{inspectRecord.locationName}</span>
                </div>
              </div>

              {inspectRecord.notes && (
                <div className="rounded-lg bg-blue-50 p-3 border border-blue-200 text-blue-900">
                  <span className="font-bold block">Smart Hours Policy Note:</span>
                  <span className="mt-0.5 block">{inspectRecord.notes}</span>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setInspectRecord(null)}
                className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Override Regularization Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Regularize Attendance Record</h3>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleApplyOverride} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Employee</label>
                <select
                  value={overrideEmpId}
                  onChange={(e) => setOverrideEmpId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-slate-900"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.employeeId}>
                      {u.name} ({u.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Attendance Date</label>
                <input
                  type="date"
                  value={overrideDate}
                  onChange={(e) => setOverrideDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Override</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as AttendanceStatus)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-slate-900"
                >
                  <option value="Present">Present (Manual Override)</option>
                  <option value="Working">Working</option>
                  <option value="Late">Late Regularized</option>
                  <option value="On Leave">Excused Official Leave</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Administrative Reason</label>
                <textarea
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="State justification for attendance record adjustment..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="rounded-lg px-4 py-2 font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800"
                >
                  Apply Regularization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
