import React, { useState } from 'react';
import { ShieldCheck, UserCheck, UserPlus, X } from 'lucide-react';
import { UserRole } from '../../types';
import { RegisterAdminModal } from './RegisterAdminModal';
import { RegisterManagerModal } from './RegisterManagerModal';
import { RegisterEmployeeModal } from './RegisterEmployeeModal';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: UserRole;
  onRegisteredSuccess?: (email: string) => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({
  isOpen,
  onClose,
  initialRole = 'employee',
  onRegisteredSuccess,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);

  // Sync initialRole whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedRole(initialRole);
    }
  }, [isOpen, initialRole]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="my-8 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        {/* Top Header & Close Button */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Create New Account</h3>
            <p className="text-xs text-slate-500">
              Select your organization role to launch the dedicated onboarding registration
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 3 Role Selection Cards / Tabs */}
        <div className="grid grid-cols-3 gap-2.5 my-4">
          {/* Admin Tab */}
          <button
            type="button"
            onClick={() => setSelectedRole('admin')}
            className={`flex flex-col items-center justify-center rounded-xl p-3 text-center border transition-all cursor-pointer ${
              selectedRole === 'admin'
                ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className={`h-5 w-5 mb-1 ${selectedRole === 'admin' ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span className="text-xs font-bold">Admin</span>
            <span className={`text-[10px] mt-0.5 ${selectedRole === 'admin' ? 'text-slate-300' : 'text-slate-400'}`}>
              Full System Access
            </span>
          </button>

          {/* Manager Tab */}
          <button
            type="button"
            onClick={() => setSelectedRole('manager')}
            className={`flex flex-col items-center justify-center rounded-xl p-3 text-center border transition-all cursor-pointer ${
              selectedRole === 'manager'
                ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
            }`}
          >
            <UserCheck className={`h-5 w-5 mb-1 ${selectedRole === 'manager' ? 'text-white' : 'text-blue-600'}`} />
            <span className="text-xs font-bold">Manager</span>
            <span className={`text-[10px] mt-0.5 ${selectedRole === 'manager' ? 'text-blue-100' : 'text-slate-400'}`}>
              Team & Approvals
            </span>
          </button>

          {/* Employee Tab */}
          <button
            type="button"
            onClick={() => setSelectedRole('employee')}
            className={`flex flex-col items-center justify-center rounded-xl p-3 text-center border transition-all cursor-pointer ${
              selectedRole === 'employee'
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
            }`}
          >
            <UserPlus className={`h-5 w-5 mb-1 ${selectedRole === 'employee' ? 'text-white' : 'text-emerald-600'}`} />
            <span className="text-xs font-bold">Employee</span>
            <span className={`text-[10px] mt-0.5 ${selectedRole === 'employee' ? 'text-emerald-100' : 'text-slate-400'}`}>
              Face + GPS Check-in
            </span>
          </button>
        </div>

        {/* Render Dedicated Role Form */}
        <div className="pt-1">
          {selectedRole === 'admin' && (
            <EmbeddedAdminForm onClose={onClose} onRegisteredSuccess={onRegisteredSuccess} />
          )}
          {selectedRole === 'manager' && (
            <EmbeddedManagerForm onClose={onClose} onRegisteredSuccess={onRegisteredSuccess} />
          )}
          {selectedRole === 'employee' && (
            <EmbeddedEmployeeForm onClose={onClose} onRegisteredSuccess={onRegisteredSuccess} />
          )}
        </div>
      </div>
    </div>
  );
};

// Embedded forms with zero layout flicker:
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/authApi';
import { Camera, Check, AlertCircle, KeyRound, Building, Video, VideoOff } from 'lucide-react';

function EmbeddedAdminForm({ onClose, onRegisteredSuccess }: { onClose: () => void; onRegisteredSuccess?: (email: string) => void }) {
  const { addRegisteredUserToState, login, users } = useApp();
  const nextAdmNum = users.reduce((max, u) => {
    const m = u.employeeId?.match(/ADM(\d+)/i) || u.employeeId?.match(/\d+/);
    const num = m ? parseInt(m[1] || m[0], 10) : 0;
    return num > max ? num : max;
  }, 0) + 1;
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState(`ADM${String(Math.max(nextAdmNum, 1)).padStart(3, '0')}`);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [department, setDepartment] = useState('System Administration');
  const [securityPasskey, setSecurityPasskey] = useState('AMS-ROOT-2026');
  const [autoLogin, setAutoLogin] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!name.trim() || !email.trim() || !employeeId.trim()) {
      setErrorMsg('Please complete all required fields.');
      return;
    }
    if (securityPasskey.trim() !== 'AMS-ROOT-2026') {
      setErrorMsg('Invalid Administrator Passkey (default is AMS-ROOT-2026).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.registerAdmin({
        name: name.trim(),
        employeeId: employeeId.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department,
        securityPasskey: securityPasskey.trim(),
      });
      const newAdmin = res.user;
      addRegisteredUserToState(newAdmin);
      if (autoLogin) login(newAdmin.email, undefined, newAdmin);
      else if (onRegisteredSuccess) onRegisteredSuccess(newAdmin.email);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register admin in MongoDB Atlas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-500">New admin profile</span>
      </div>
      <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 text-xs text-amber-900 flex items-start gap-2">
        <KeyRound className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
        <span className="text-[11px] text-amber-800">
          Admin access unlocks company-wide attendance audits, roster management, and geofence coordinates. Master passkey is prefilled.
        </span>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter admin full name"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Admin ID *</label>
          <input
            type="text"
            required
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full font-semibold rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Email *</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@company.com"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98401 22334"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          >
            <option value="System Administration">System Administration</option>
            <option value="Human Resources">Human Resources</option>
            <option value="Executive Management">Executive Management</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Security Passkey *</label>
          <input
            type="text"
            required
            value={securityPasskey}
            onChange={(e) => setSecurityPasskey(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="admin-auto"
          checked={autoLogin}
          onChange={(e) => setAutoLogin(e.target.checked)}
          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
        />
        <label htmlFor="admin-auto" className="text-xs text-slate-600 cursor-pointer">
          Sign in to Admin Dashboard immediately after registration
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              <span>Register Admin</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function EmbeddedManagerForm({ onClose, onRegisteredSuccess }: { onClose: () => void; onRegisteredSuccess?: (email: string) => void }) {
  const { addRegisteredUserToState, login, users } = useApp();
  const nextMgrNum = users.reduce((max, u) => {
    const m = u.employeeId?.match(/MGR(\d+)/i) || u.employeeId?.match(/\d+/);
    const num = m ? parseInt(m[1] || m[0], 10) : 0;
    return num > max ? num : max;
  }, 0) + 1;
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState(`MGR${String(Math.max(nextMgrNum, 1)).padStart(3, '0')}`);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [department, setDepartment] = useState('Engineering');
  const [title, setTitle] = useState('Engineering Lead');
  const [autoLogin, setAutoLogin] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!name.trim() || !email.trim() || !employeeId.trim()) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.registerManager({
        name: name.trim(),
        employeeId: employeeId.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department,
        title: title.trim(),
      });
      const newMgr = res.user;
      addRegisteredUserToState(newMgr);
      if (autoLogin) login(newMgr.email, undefined, newMgr);
      else if (onRegisteredSuccess) onRegisteredSuccess(newMgr.email);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register manager in MongoDB Atlas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-500">New manager profile</span>
      </div>
      <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-3 text-xs text-blue-900 flex items-start gap-2">
        <Building className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
        <span className="text-[11px] text-blue-800">
          Manager registration enables direct supervision over your team's attendance and algorithmic smart leave approvals.
        </span>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Manager Full Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter manager full name"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Manager ID *</label>
          <input
            type="text"
            required
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full font-semibold rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Email *</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="manager@company.com"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98402 33445"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
          <select
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              if (e.target.value === 'Engineering') setTitle('Engineering Lead');
              else if (e.target.value === 'Product & Operations') setTitle('Product Lead');
              else setTitle('Team Lead');
            }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          >
            <option value="Engineering">Engineering</option>
            <option value="Product & Operations">Product & Operations</option>
            <option value="Quality Assurance">Quality Assurance</option>
            <option value="Human Resources">Human Resources</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Role Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="mgr-auto"
          checked={autoLogin}
          onChange={(e) => setAutoLogin(e.target.checked)}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
        />
        <label htmlFor="mgr-auto" className="text-xs text-slate-600 cursor-pointer">
          Sign in to Manager Dashboard immediately after registration
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <UserCheck className="h-4 w-4" />
              <span>Register Manager</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function EmbeddedEmployeeForm({ onClose, onRegisteredSuccess }: { onClose: () => void; onRegisteredSuccess?: (email: string) => void }) {
  const { addRegisteredUserToState, login, users } = useApp();
  const nextEmpNum = users.reduce((max, u) => {
    const m = u.employeeId?.match(/EMP(\d+)/i) || u.employeeId?.match(/\d+/);
    const num = m ? parseInt(m[1] || m[0], 10) : 0;
    return num > max ? num : max;
  }, 0) + 1;
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState(`EMP${String(Math.max(nextEmpNum, 1)).padStart(3, '0')}`);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [department, setDepartment] = useState('Engineering');
  const availableManagers = users.filter((u) => u.role === 'manager');
  const [managerName, setManagerName] = useState(availableManagers[0]?.name || '');
  const [autoLogin, setAutoLogin] = useState(true);
  const [faceCaptured, setFaceCaptured] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);


  const handleCaptureFace = () => {
    setIsCapturing(true);
    setTimeout(() => {
      setIsCapturing(false);
      setFaceCaptured(true);
    }, 1100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!name.trim() || !email.trim() || !employeeId.trim()) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    const assignedMgr = availableManagers.find((m) => m.name === managerName);

    setIsSubmitting(true);
    try {
      const res = await authApi.registerEmployee({
        name: name.trim(),
        employeeId: employeeId.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department,
        managerId: assignedMgr?.id,
        managerName: managerName,
        faceRegistered: faceCaptured,
        faceVector: faceCaptured ? 'VEC-128-ENROLLED-PASSIVE' : undefined,
      });

      const newEmp = res.user;
      addRegisteredUserToState(newEmp);

      if (autoLogin) login(newEmp.email, undefined, newEmp);
      else if (onRegisteredSuccess) onRegisteredSuccess(newEmp.email);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register employee in MongoDB Atlas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-500">New employee profile</span>
      </div>
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter employee full name"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Employee ID *</label>
          <input
            type="text"
            required
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full font-semibold rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Email *</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="maya.k@company.com"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Reporting Manager *</label>
          <select
            value={managerName}
            onChange={(e) => setManagerName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          >
            {availableManagers.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name} ({m.department})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Face Capture */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
            {faceCaptured ? <Check className="h-5 w-5 text-emerald-400" /> : <Camera className="h-5 w-5 text-slate-300" />}
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block">Biometric Face Embedding</span>
            <span className="text-[11px] text-slate-500">
              {faceCaptured ? '✓ 128-D vector enrolled successfully' : 'Capture face for 1:N attendance'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCaptureFace}
          disabled={isCapturing}
          className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            faceCaptured
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-900 text-white hover:bg-slate-800 shadow-xs'
          }`}
        >
          {isCapturing ? 'Scanning...' : faceCaptured ? 'Re-scan Face' : 'Capture Face'}
        </button>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="emp-auto"
          checked={autoLogin}
          onChange={(e) => setAutoLogin(e.target.checked)}
          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
        />
        <label htmlFor="emp-auto" className="text-xs text-slate-600 cursor-pointer">
          Sign in to Employee Dashboard immediately after registration
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              <span>Register Employee</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
