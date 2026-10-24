import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
  PlusCircle,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LeaveStatus, LeaveRequest } from '../../types';
import { Skeleton } from '../common/Skeleton';
import { employeeApi } from '../../services/employeeApi';

interface EmployeeLeaveStatusProps {
  onApplyNew: () => void;
}

export const EmployeeLeaveStatus: React.FC<EmployeeLeaveStatusProps> = ({ onApplyNew }) => {
  const { currentUser, leaveRequests, refreshLeaveRequests } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [liveLeaves, setLiveLeaves] = useState<LeaveRequest[] | null>(null);

  const empId = currentUser?.employeeId || '';

  const fetchLeaves = async () => {
    if (!empId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await employeeApi.getLeaveRequests(empId);
      if (res && res.leaveRequests) {
        setLiveLeaves(res.leaveRequests);
      }
    } catch (err) {
      console.warn('Could not fetch leave requests from MongoDB Atlas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [empId]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await Promise.all([refreshLeaveRequests(), fetchLeaves()]);
  };

  const fallbackLeaves = leaveRequests.filter((l) => l.employeeId === empId);
  const myLeaves = liveLeaves !== null ? liveLeaves : fallbackLeaves;

  const getStatusBadge = (status: LeaveStatus) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/80">
            <Check className="h-3.5 w-3.5 stroke-3 text-emerald-600" />
            <span>Approved</span>
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200/80">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <span>Pending Review</span>
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200/80">
            <XCircle className="h-3.5 w-3.5 text-rose-600" />
            <span>Rejected</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Leave Status
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            Real-time managerial review status and historical leave records from MongoDB Atlas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
            title="Refresh leave requests"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={onApplyNew}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Apply New Leave</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white saas-card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-4">Date Range</th>
                <th className="px-6 py-4">Leave Type</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Manager</th>
                <th className="px-6 py-4">Reason & Manager Response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-2.5 w-14" />
                      </div>
                    </td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-md" /></td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-48" />
                    </td>
                  </tr>
                ))
              ) : myLeaves.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-xs text-slate-400 font-normal">
                    No leave requests found. Click "Apply New Leave" above to create one.
                  </td>
                </tr>
              ) : (
                myLeaves.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      <div>{item.fromDate} to {item.toDate}</div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        {item.halfDayPeriod ? `Half day (${item.halfDayPeriod})` : `${item.daysCount} Day${item.daysCount > 1 ? 's' : ''}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {item.halfDayPeriod ? `${item.leaveType} · Half Day` : item.leaveType}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{item.managerName}</div>
                      <div className="text-[11px] text-slate-400">Reporting Lead</div>
                    </td>
                    <td className="px-6 py-4 max-w-sm">
                      <div className="text-slate-700 italic">"{item.reason}"</div>
                      {item.reviewRemarks && (
                        <div className="mt-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 border border-slate-100 font-normal">
                          <span className="font-semibold text-slate-800">Manager Note:</span> {item.reviewRemarks}
                        </div>
                      )}
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
