import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LeaveType } from '../../types';
import { employeeApi } from '../../services/employeeApi';
import { getIndiaDateOffsetString } from '../../utils/dateTime';

interface EmployeeApplyLeaveProps {
  onNavigateStatus: () => void;
}

export const EmployeeApplyLeave: React.FC<EmployeeApplyLeaveProps> = ({ onNavigateStatus }) => {
  const { currentUser, applyLeave } = useApp();

  const [leaveType, setLeaveType] = useState<LeaveType>('Casual Leave');
  const [fromDate, setFromDate] = useState(() => getIndiaDateOffsetString(1));
  const [toDate, setToDate] = useState(() => getIndiaDateOffsetString(2));
  const [reason, setReason] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Live dynamic quotas from MongoDB Atlas
  const [quotas, setQuotas] = useState({
    casualRemaining: 12,
    sickRemaining: 10,
    earnedRemaining: 15,
  });

  const empId = currentUser?.employeeId || '';

  useEffect(() => {
    if (!empId) return;
    employeeApi.getLeaveRequests(empId)
      .then((res) => {
        if (res?.quotas) {
          setQuotas({
            casualRemaining: res.quotas.casualRemaining,
            sickRemaining: res.quotas.sickRemaining,
            earnedRemaining: res.quotas.earnedRemaining,
          });
        }
      })
      .catch((err) => {
        console.warn('Could not fetch dynamic quotas:', err);
      });
  }, [empId, submittedSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await applyLeave({
        employeeId: currentUser.employeeId,
        leaveType,
        fromDate,
        toDate,
        reason,
      });
      setSubmittedSuccess(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit leave request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-4 text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Apply for Leave
        </h1>
        <p className="mt-1 text-sm text-slate-500 font-normal">
          Submit electronic leave request directly for managerial attendance history review.
        </p>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/95 p-3.5 text-xs font-medium text-rose-800 shadow-xs">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span className="flex-1 font-semibold">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="rounded-md bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-800 hover:bg-rose-200 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {submittedSuccess ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-8 text-center space-y-4 saas-card-shadow animate-in fade-in duration-200">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-emerald-950">
            Leave Request Submitted
          </h2>
          <p className="text-sm text-emerald-800 max-w-md mx-auto leading-relaxed">
            Your application for <strong>{leaveType}</strong> from <strong>{fromDate}</strong> to <strong>{toDate}</strong> has been saved in MongoDB Atlas and forwarded to <strong>{currentUser?.managerName || 'Manager'}</strong>.
          </p>
          <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setSubmittedSuccess(false)}
              className="rounded-xl border border-emerald-300 bg-white px-5 py-2.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 cursor-pointer transition-colors"
            >
              Apply Another
            </button>
            <button
              type="button"
              onClick={onNavigateStatus}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>View Leave Status</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 saas-card-shadow space-y-5">
          {/* Dynamic Annual Quotas calculated from MongoDB Atlas */}
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
              Available Annual Quotas
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/60">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Casual</span>
                <span className="text-lg font-bold text-slate-900 block mt-0.5">{quotas.casualRemaining} Remaining</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/60">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Sick</span>
                <span className="text-lg font-bold text-slate-900 block mt-0.5">{quotas.sickRemaining} Remaining</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/60">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Earned</span>
                <span className="text-lg font-bold text-slate-900 block mt-0.5">{quotas.earnedRemaining} Remaining</span>
              </div>
            </div>
          </div>

          {/* Leave Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Leave Type
            </label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-xs"
            >
              <option value="Casual Leave">Casual Leave</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Personal">Personal Leave</option>
              <option value="Earned Leave">Earned Leave</option>
              <option value="Maternity/Paternity">Maternity/Paternity</option>
            </select>
          </div>

          {/* Date Range: From / To */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                From Date
              </label>
              <input
                type="date"
                required
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                To Date
              </label>
              <input
                type="date"
                required
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-xs"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Reason for Leave
            </label>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State clear purpose of leave..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-xs"
            />
          </div>

          {/* Submit button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-xs hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                  <span>Submitting to Atlas...</span>
                </>
              ) : (
                <span>Submit Leave Request</span>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
