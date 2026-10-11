import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  Eye,
  Calendar,
  User,
  Clock,
  X,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LeaveRequest, AttendanceRecord } from '../../types';
import { Skeleton } from '../common/Skeleton';

export const ManagerLeaveApproval: React.FC = () => {
  const {
    currentUser,
    leaveRequests,
    reviewLeaveRequest,
    historicalAttendance,
    todayAttendance,
    users,
  } = useApp();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [remarksInput, setRemarksInput] = useState<{ [reqId: string]: string }>({});
  const [filterTab, setFilterTab] = useState<'pending' | 'reviewed'>('pending');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [filterTab]);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 450);
  };

  // Filter requests relevant to this manager or all if admin
  const teamLeaves = leaveRequests.filter(
    (l) => currentUser?.role === 'admin' || l.managerId === currentUser?.id
  );

  const pendingRequests = teamLeaves.filter((l) => l.status === 'Pending');
  const reviewedRequests = teamLeaves.filter((l) => l.status !== 'Pending');

  const displayedRequests = filterTab === 'pending' ? pendingRequests : reviewedRequests;

  // Selected employee attendance history
  const selectedEmployee = users.find((u) => u.employeeId === selectedEmployeeId);
  const employeeAttendanceHistory = [
    ...todayAttendance,
    ...historicalAttendance,
  ].filter((a) => a.employeeId === selectedEmployeeId);

  // Compute stats for modal
  const totalDays = employeeAttendanceHistory.length || 1;
  const presentDays = employeeAttendanceHistory.filter(
    (a) => a.status === 'Present' || a.status === 'Working'
  ).length;
  const lateDays = employeeAttendanceHistory.filter((a) => a.status === 'Late').length;
  const absentDays = employeeAttendanceHistory.filter((a) => a.status === 'Absent').length;
  const attendancePct = Math.round(((presentDays + lateDays) / Math.max(1, totalDays)) * 100);

  const handleDecision = (requestId: string, decision: 'Approved' | 'Rejected') => {
    const remark = remarksInput[requestId] || '';
    reviewLeaveRequest(requestId, decision, remark);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Leave Requests & Smart Approvals
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            Inspect employee attendance history and punctuality track record before approving team leave.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
            title="Refresh leave requests"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Tab switch */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-xs">
            <button
              onClick={() => setFilterTab('pending')}
              className={`rounded-lg px-4 py-1.5 font-semibold transition-all cursor-pointer ${
                filterTab === 'pending'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending ({pendingRequests.length})
            </button>
            <button
              onClick={() => setFilterTab('reviewed')}
              className={`rounded-lg px-4 py-1.5 font-semibold transition-all cursor-pointer ${
                filterTab === 'reviewed'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              History ({reviewedRequests.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Leave Request Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow space-y-4 animate-pulse"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32 rounded-md" />
                    <Skeleton className="h-3 w-24 rounded-md" />
                  </div>
                </div>
                <Skeleton className="h-6 w-24 rounded-md" />
              </div>
              <div className="space-y-2 border-y border-slate-100 py-3">
                <Skeleton className="h-3.5 w-3/4 rounded-md" />
                <Skeleton className="h-3.5 w-1/2 rounded-md" />
              </div>
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-8 w-28 rounded-xl" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20 rounded-xl" />
                  <Skeleton className="h-8 w-20 rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : displayedRequests.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center saas-card-shadow">
          <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">
            {filterTab === 'pending' ? 'No pending leave requests' : 'No reviewed requests found'}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            All team leave requests are currently up to date.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {displayedRequests.map((req) => (
            <div
              key={req.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow transition-shadow hover:shadow-md"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                {/* Employee and Request Details */}
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-700 text-xs">
                      {req.employeeName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{req.employeeName}</h3>
                      <div className="text-xs text-slate-500 font-normal">
                        {req.employeeId} · {req.department}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                      {req.leaveType}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{req.fromDate} to {req.toDate} ({req.daysCount} Day{req.daysCount > 1 ? 's' : ''})</span>
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-400">Requested: {req.requestedAt}</span>
                  </div>

                  {/* Reason Block */}
                  <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-100 text-xs text-slate-700">
                    <span className="font-semibold text-slate-900 block mb-1">Reason:</span>
                    <p className="italic">"{req.reason}"</p>
                  </div>
                </div>

                {/* Status Badge */}
                <div>
                  {req.status === 'Pending' ? (
                    <span className="rounded-md bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200/80">
                      Pending Approval
                    </span>
                  ) : req.status === 'Approved' ? (
                    <span className="rounded-md bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/80 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5 text-emerald-600" /> Approved
                    </span>
                  ) : (
                    <span className="rounded-md bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 border border-rose-200/80">
                      Rejected
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons matching Section 7 */}
              {req.status === 'Pending' && (
                <div className="mt-5 border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="w-full sm:w-1/2">
                    <input
                      type="text"
                      placeholder="Optional manager comments or remarks..."
                      value={remarksInput[req.id] || ''}
                      onChange={(e) =>
                        setRemarksInput((prev) => ({ ...prev, [req.id]: e.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* View Attendance button */}
                    <button
                      type="button"
                      onClick={() => setSelectedEmployeeId(req.employeeId)}
                      className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View Attendance</span>
                    </button>

                    {/* Approve Button */}
                    <button
                      type="button"
                      onClick={() => handleDecision(req.id, 'Approved')}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer shadow-xs"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Approve</span>
                    </button>

                    {/* Reject Button */}
                    <button
                      type="button"
                      onClick={() => handleDecision(req.id, 'Rejected')}
                      className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Reviewed Note */}
              {req.status !== 'Pending' && (
                <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500 flex items-center justify-between">
                  <span>Reviewed by {req.managerName} on {req.reviewedAt || '2026-10-08'}</span>
                  {req.reviewRemarks && (
                    <span className="text-slate-700 font-medium">Note: "{req.reviewRemarks}"</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SMART ATTENDANCE HISTORY INSPECTION MODAL */}
      {selectedEmployeeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Attendance Record Analysis: {selectedEmployee?.name || selectedEmployeeId}
                </h3>
                <p className="text-xs text-slate-500 font-normal">
                  Employee ID: {selectedEmployeeId} · Department: {selectedEmployee?.department}
                </p>
              </div>
              <button
                onClick={() => setSelectedEmployeeId(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Smart Approval Insight Banner */}
            <div className="mt-4 rounded-xl bg-blue-50/70 border border-blue-200/80 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                    Smart Approval Decision Matrix
                  </h4>
                  <p className="text-xs text-blue-900 mt-1 leading-relaxed">
                    Employee holds a strong attendance percentage of <strong>{attendancePct}%</strong>.
                    Punctuality track record indicates <strong>{presentDays} on-time days</strong> and only{' '}
                    <strong>{lateDays} late arrival(s)</strong> over the recorded monitoring period.
                  </p>
                </div>
              </div>
            </div>

            {/* Attendance Score Cards */}
            <div className="mt-4 grid grid-cols-4 gap-3 text-center">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rating</div>
                <div className="text-xl font-bold text-emerald-600 mt-1">
                  {attendancePct}%
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Present</div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {presentDays}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Late</div>
                <div className="text-xl font-bold text-amber-600 mt-1">
                  {lateDays}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Absent</div>
                <div className="text-xl font-bold text-rose-600 mt-1">
                  {absentDays}
                </div>
              </div>
            </div>

            {/* History Table */}
            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
                Recent Daily Check-in Log (October 2026)
              </h4>
              <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Check-in</th>
                      <th className="px-4 py-3">Check-out</th>
                      <th className="px-4 py-3">Hours</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employeeAttendanceHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-medium text-slate-900">{h.date}</td>
                        <td className="px-4 py-2.5 text-slate-700">
                          {h.checkIn || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">
                          {h.checkOut || '—'}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">
                          {h.hoursWorked || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                              h.status === 'Present'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                : h.status === 'Late'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                                : h.status === 'On Leave'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Close Modal button */}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEmployeeId(null)}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Close Attendance Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
