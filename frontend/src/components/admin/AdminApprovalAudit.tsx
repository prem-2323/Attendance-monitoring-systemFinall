import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Shield,
  Download,
  Clock,
  User,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getIndiaDateString } from '../../utils/dateTime';
import { Skeleton } from '../common/Skeleton';

export const AdminApprovalAudit: React.FC = () => {
  const { approvalAudits, refreshApprovalAudits } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<'All' | 'Approved' | 'Rejected'>('All');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [decisionFilter]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await refreshApprovalAudits();
    setIsLoading(false);
  };

  const filteredAudits = approvalAudits.filter((audit) => {
    const matchesSearch =
      audit.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      audit.managerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      audit.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDecision = decisionFilter === 'All' || audit.decision === decisionFilter;
    return matchesSearch && matchesDecision;
  });

  const exportAuditLogCSV = () => {
    const headers = ['Audit ID', 'Employee', 'Request Type', 'Decision', 'Manager', 'Date', 'Time', 'Employee Reason', 'Manager Remarks'];
    const rows = filteredAudits.map((a) => [
      a.id,
      `"${a.employeeName} (${a.employeeId})"`,
      `"${a.requestType}"`,
      a.decision,
      `"${a.managerName}"`,
      a.date,
      a.time,
      `"${a.reason}"`,
      `"${a.remarks || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Approval_Audit_Log_${getIndiaDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Approval Audit Trail
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            Immutable managerial audit trail: track who approved or rejected leave requests, timestamps, and justifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            title="Refresh audit log"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={exportAuditLogCSV}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Audit Log (CSV)</span>
          </button>
        </div>
      </div>

      {/* Audit Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Audited Actions
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {isLoading ? <Skeleton className="h-8 w-14" /> : approvalAudits.length}
          </div>
          <div className="text-xs text-slate-400 mt-1">Recorded in secure log store</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
            Manager Approvals
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            {isLoading ? <Skeleton className="h-8 w-14" /> : approvalAudits.filter((a) => a.decision === 'Approved').length}
          </div>
          <div className="text-xs text-emerald-700 mt-1">Validated against attendance history</div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 saas-card-shadow">
          <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">
            Manager Rejections
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2">
            {isLoading ? <Skeleton className="h-8 w-14" /> : approvalAudits.filter((a) => a.decision === 'Rejected').length}
          </div>
          <div className="text-xs text-rose-600 mt-1">Declined with manager rationale</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <div className="relative sm:col-span-2">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Employee, Manager, or reason..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none"
          />
        </div>

        <div>
          <select
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value as any)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 px-3 text-xs text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
          >
            <option value="All">All Decisions</option>
            <option value="Approved">Approved Only</option>
            <option value="Rejected">Rejected Only</option>
          </select>
        </div>
      </div>

      {/* Table matching Section 16 format */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Request</th>
                <th className="px-5 py-3.5">Decision</th>
                <th className="px-5 py-3.5">Manager</th>
                <th className="px-5 py-3.5">Date & Time</th>
                <th className="px-5 py-3.5">Reason & Manager Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-5 py-3.5"><Skeleton className="h-6 w-20 rounded-md" /></td>
                    <td className="px-5 py-3.5"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-5 py-3.5"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        <Skeleton className="h-3.5 w-44" />
                        <Skeleton className="h-2.5 w-32" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredAudits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-xs text-slate-400">
                    No approval audit records match criteria.
                  </td>
                </tr>
              ) : (
                filteredAudits.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      <div>{item.employeeName}</div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        {item.employeeId}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 font-medium">
                      {item.requestType}
                    </td>
                    <td className="px-5 py-3.5">
                      {item.decision === 'Approved' ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Approved</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                          <XCircle className="h-3 w-3" />
                          <span>Rejected</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{item.managerName}</div>
                      <div className="text-[11px] text-slate-400">Manager Sign-off</div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 font-medium">
                      <div>{item.date}</div>
                      <div className="text-[11px] text-slate-400">{item.time}</div>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="text-slate-800 text-[11px]">"{item.reason}"</div>
                      {item.remarks && (
                        <div className="mt-1 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                          Manager note: {item.remarks}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs text-slate-500 flex justify-between items-center">
          <span>Enterprise Audit Trail Compliant with SOC2 & ISO 27001 Access Tracking</span>
          <span className="text-[11px] font-medium text-slate-500">Live Records: {filteredAudits.length}</span>
        </div>
      </div>
    </div>
  );
};
