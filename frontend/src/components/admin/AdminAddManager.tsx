import React, { useState } from 'react';
import {
  UserCheck,
  UserPlus,
  ArrowLeft,
  Building,
  Mail,
  Phone,
  Shield,
  CheckCircle,
  Users,
  ScanFace,
  CheckSquare,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SafeImage } from '../common/SafeImage';

interface AdminAddManagerProps {
  onCancel: () => void;
  onSuccess: () => void;
}

export const AdminAddManager: React.FC<AdminAddManagerProps> = ({ onCancel, onSuccess }) => {
  const { addManager, users } = useApp();

  const nextMgrNum = users.filter((u) => u.role === 'manager').length + 1;
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState(`MGR00${nextMgrNum}`);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [title, setTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Selected subordinates to allocate
  const availableEmployees = users.filter((u) => u.role === 'employee');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  // Permissions checkboxes
  const [canApproveLeaves, setCanApproveLeaves] = useState(true);
  const [canOverrideAttendance, setCanOverrideAttendance] = useState(true);
  const [canViewAuditLogs, setCanViewAuditLogs] = useState(true);

  // Biometrics
  const [faceRegistered, setFaceRegistered] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const toggleEmployee = (empId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!name.trim() || !email.trim() || !employeeId.trim()) {
      setErrorMsg('Please fill out manager name, employee ID, and corporate email.');
      return;
    }

    try {
      await addManager({
        name,
        employeeId,
        email,
        phone,
        department,
        title,
        avatarUrl,
        faceRegistered,
      });

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register manager');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-2 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Managers</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Add New Manager
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            Provision department head credentials, delegate direct report team hierarchies, and assign approval authority.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMsg && (
          <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/95 p-3.5 text-xs font-semibold text-rose-800 shadow-xs">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Core Profile Information */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <UserCheck className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Manager Personal & Role Details</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Varma"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                Manager ID
              </label>
              <input
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="MGR003"
                className="w-full font-semibold rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Corporate Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ramesh.varma@company.com"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98401 23456"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Supervised Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                <option value="Engineering">Engineering</option>
                <option value="Product & Operations">Product & Operations</option>
                <option value="Quality Assurance">Quality Assurance</option>
                <option value="Human Resources">Human Resources</option>
                <option value="Executive Management">Executive Management</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Designation Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Engineering Lead / Senior Manager"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Managerial Delegations & Permissions */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Shield className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Approval Permissions & Authority</h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={canApproveLeaves}
                onChange={(e) => setCanApproveLeaves(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">Smart Leave Approval</span>
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  Inspect employee history and grant/deny leave requests.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={canOverrideAttendance}
                onChange={(e) => setCanOverrideAttendance(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">Shift Overrides</span>
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  Regularize flexible shift arrivals and manual timestamps.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={canViewAuditLogs}
                onChange={(e) => setCanViewAuditLogs(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">Team Audit Inspection</span>
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  View full team audit logs and export attendance reports.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Allocate Team Direct Reports */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Assign Direct Report Employees</h2>
            </div>
            <span className="text-xs font-semibold text-slate-600">
              {selectedEmployees.length} Selected
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Select employees to assign under this manager's hierarchy for leave approvals and daily shift monitoring:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
            {availableEmployees.map((emp) => {
              const isSelected = selectedEmployees.includes(emp.employeeId);
              return (
                <div
                  key={emp.id}
                  onClick={() => toggleEmployee(emp.employeeId)}
                  className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/70 text-indigo-950 font-semibold'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <SafeImage
                    src={emp.avatarUrl}
                    alt={emp.name}
                    className="h-6 w-6 rounded-full object-cover ring-1 ring-slate-200"
                    fallback={
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600">
                        {emp.name.slice(0, 2).toUpperCase()}
                      </div>
                    }
                  />
                  <div className="truncate">
                    <div className="text-xs truncate">{emp.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {emp.employeeId} · {emp.department}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Biometric Enrolment Status */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ScanFace className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Biometric Signature & Key Enrolment
              </h3>
              <p className="text-[11px] text-slate-500">
                128-D cryptographic vector profile auto-generated for corporate portal access.
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            <CheckCircle className="h-4 w-4" />
            <span>Active & Enrolled</span>
          </span>
        </div>

        {/* Buttons: [ CANCEL ] [ CREATE MANAGER ] */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            [ CANCEL ]
          </button>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            <span>[ CREATE MANAGER ]</span>
          </button>
        </div>
      </form>
    </div>
  );
};
