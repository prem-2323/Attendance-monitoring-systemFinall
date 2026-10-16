import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Filter,
  CheckCircle,
  Calendar,
  Building,
  User,
  Users,
  Check,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Skeleton, SkeletonTable } from './Skeleton';
import { reportsApi, ReportAggregates } from '../../services/reportsApi';
import { AttendanceRecord } from '../../types';

export const ReportsView: React.FC = () => {
  const { allAttendance, users, officeLocation, refreshAttendance, refreshUsers } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [department, setDepartment] = useState('All');
  const [employeeFilter, setEmployeeFilter] = useState('All');
  const [fromDate, setFromDate] = useState(firstDayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [statusFilter, setStatusFilter] = useState('All');
  const [reportGenerated, setReportGenerated] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const [aggregates, setAggregates] = useState<ReportAggregates>({
    totalEmployees: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    leaveCount: 0,
    totalRecords: 0,
    avgAttendance: 100.0,
  });
  const [reportRecords, setReportRecords] = useState<AttendanceRecord[]>([]);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const res = await reportsApi.getAnalytics({
        department,
        employeeId: employeeFilter,
        fromDate,
        toDate,
        status: statusFilter,
      });
      if (res?.success) {
        setAggregates(res.aggregates);
        setReportRecords(res.records || []);
        setReportGenerated(true);
      }
    } catch (err) {
      console.warn('[ReportsView] Error loading reports from Atlas:', err);
      // Fallback dynamic calculation from context
      const filtered = allAttendance.filter((rec) => {
        const matchesDept = department === 'All' || rec.department === department;
        const matchesEmp = employeeFilter === 'All' || rec.employeeId === employeeFilter;
        const matchesStatus = statusFilter === 'All' || rec.status === statusFilter;
        const matchesFrom = !fromDate || rec.date >= fromDate;
        const matchesTo = !toDate || rec.date <= toDate;
        return matchesDept && matchesEmp && matchesStatus && matchesFrom && matchesTo;
      });
      setReportRecords(filtered);
      let pCount = 0;
      let lCount = 0;
      let aCount = 0;
      let lvCount = 0;
      let ipCount = 0;
      filtered.forEach((r) => {
        if (r.status === 'Present' || r.status === 'Working' || (r.status as string) === 'Present — Flexible Shift') pCount++;
        else if (r.status === 'Late') lCount++;
        else if ((r.status as string) === 'In Progress') ipCount++;
        else if (r.status === 'Absent') aCount++;
        else if (r.status === 'On Leave') lvCount++;
      });
      const totRecs = filtered.length;
      const deptUsers = users.filter(
        (u) => u.role === 'employee' && (department === 'All' || u.department === department)
      );
      setAggregates({
        totalEmployees: deptUsers.length || 1,
        presentCount: pCount,
        lateCount: lCount,
        absentCount: aCount,
        leaveCount: lvCount,
        totalRecords: totRecs,
        avgAttendance:
          totRecs > 0 ? Math.round(((pCount + lCount + ipCount) / totRecs) * 1000) / 10 : 100.0,
      });
      setReportGenerated(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, []);

  const handleRefresh = async () => {
    await Promise.all([refreshAttendance(), refreshUsers()]);
    await loadReportData();
  };

  const handleGenerateReport = (e: React.FormEvent) => {
    e.preventDefault();
    loadReportData();
  };

  const exportExcelCSV = () => {
    const headers = ['Record ID', 'Date', 'Employee ID', 'Name', 'Department', 'Check-In', 'Check-Out', 'Hours', 'Status', 'Verification'];
    const rows = reportRecords.map((r) => [
      r.id,
      r.date,
      r.employeeId,
      `"${r.employeeName}"`,
      `"${r.department}"`,
      r.checkIn || '',
      r.checkOut || '',
      r.hoursWorked || '',
      r.status,
      `"${r.locationName} (${r.distanceMeters}m)"`,
    ]);

    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `Attendance_Report_${fromDate}_to_${toDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header matching Section 12 */}
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Attendance Reports & Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            Enterprise attendance intelligence, CSV exports, and printable compliance audits.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer transition-colors"
            title="Refresh report data"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={exportExcelCSV}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export Excel / CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Download PDF / Print</span>
          </button>
        </div>
      </div>

      {/* Report Filter Section matching Section 12 */}
      <form
        onSubmit={handleGenerateReport}
        className="no-print rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow space-y-4"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Filter Parameters
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 shadow-xs"
            >
              <option value="All">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Product & Operations">Product & Operations</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Employee</label>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 shadow-xs"
            >
              <option value="All">All Employees</option>
              {users
                .filter((u) => u.role === 'employee')
                .map((e) => (
                  <option key={e.id} value={e.employeeId}>
                    {e.name} ({e.employeeId})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1.5">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 shadow-xs"
            >
              <option value="All">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="On Leave">Leave</option>
              <option value="Absent">Absent</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
          >
            Generate Report
          </button>
        </div>
      </form>

      {/* Generated Report Content matching Section 12 */}
      {reportGenerated && (
        isLoading ? (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Skeleton KPI Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow space-y-2">
                  <Skeleton className="h-3.5 w-20 rounded-md" />
                  <Skeleton className="h-7 w-16 rounded-md" />
                  <Skeleton className="h-2.5 w-14 rounded-md" />
                </div>
              ))}
            </div>

            {/* Skeleton Table */}
            <SkeletonTable rows={6} cols={6} hasFilterBar={false} />
          </div>
        ) : (
        <div className="space-y-6">
          {/* KPI Cards dynamically computed from MongoDB Atlas */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total Employees
              </span>
              <span className="text-2xl font-bold text-slate-900 mt-2 block">
                {aggregates.totalEmployees}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Headcount</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block">
                Average Attendance
              </span>
              <span className="text-2xl font-bold text-emerald-600 mt-2 block">
                {aggregates.avgAttendance}%
              </span>
              <span className="text-[11px] text-emerald-700 mt-1 block">Live compliance</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">
                Present
              </span>
              <span className="text-2xl font-bold text-emerald-700 mt-2 block">
                {aggregates.presentCount}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Verified on site</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
              <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider block">
                Absent
              </span>
              <span className="text-2xl font-bold text-rose-600 mt-2 block">
                {aggregates.absentCount}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Unexcused</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider block">
                Leave
              </span>
              <span className="text-2xl font-bold text-blue-600 mt-2 block">
                {aggregates.leaveCount}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Approved</span>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider block">
                Late
              </span>
              <span className="text-2xl font-bold text-amber-600 mt-2 block">
                {aggregates.lateCount}
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Flex adjusted</span>
            </div>
          </div>

          {/* Table of filtered records */}
          <div className="rounded-2xl border border-slate-200/80 bg-white saas-card-shadow overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Attendance Register Records</h3>
                <p className="text-xs text-slate-500 mt-0.5">Filtered period: {fromDate || 'All'} to {toDate || 'All'} · Facility: {officeLocation.name}</p>
              </div>
              <span className="text-xs text-slate-400 mt-1 sm:mt-0">Showing {reportRecords.length} records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                  <tr>
                    <th className="px-6 py-3.5">Date</th>
                    <th className="px-6 py-3.5">Employee</th>
                    <th className="px-6 py-3.5">Check-in</th>
                    <th className="px-6 py-3.5">Check-out</th>
                    <th className="px-6 py-3.5">Hours</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                        No attendance records found in MongoDB Atlas matching the specified parameters.
                      </td>
                    </tr>
                  ) : (
                    reportRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-900">{r.date}</td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{r.employeeName}</div>
                          <div className="text-[11px] text-slate-400 font-normal">{r.employeeId} · {r.department}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{r.checkIn || '—'}</td>
                        <td className="px-6 py-4 text-slate-700">{r.checkOut || '—'}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900">{r.hoursWorked || '—'}</td>
                        <td className="px-6 py-4">
                          <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800">
                            {r.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span>{r.withinRadius ? 'Face + Office GPS ✓' : 'Manual / Leave'}</span>
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

        )
      )}
    </div>
  );
};
