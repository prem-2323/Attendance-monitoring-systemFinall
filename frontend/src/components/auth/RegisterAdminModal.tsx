import React, { useState } from 'react';
import { X, ShieldCheck, KeyRound, AlertCircle, ArrowRight, Lock, CheckCircle2, Wand2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/authApi';

interface RegisterAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisteredSuccess?: (email: string) => void;
}

export const RegisterAdminModal: React.FC<RegisterAdminModalProps> = ({
  isOpen,
  onClose,
  onRegisteredSuccess,
}) => {
  const { addAdmin, login, users } = useApp();
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState(`ADM00${users.filter((u) => u.role === 'admin').length + 1}`);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [department, setDepartment] = useState('System Administration');
  const [password, setPassword] = useState('');
  const [securityPasskey, setSecurityPasskey] = useState('AMS-ROOT-2026');
  const [autoLogin, setAutoLogin] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAutofill = () => {
    const n = users.filter((u) => u.role === 'admin').length + 1;
    setName('Ananya Iyer');
    setEmployeeId(`ADM00${n}`);
    setEmail(`admin.demo${n}@company.com`);
    setPhone('+91 98401 22334');
    setDepartment('System Administration');
    setPassword('password123');
    setSecurityPasskey('AMS-ROOT-2026');
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim() || !email.trim() || !employeeId.trim()) {
      setErrorMsg('Please complete all required administrative fields.');
      return;
    }

    if (securityPasskey.trim() !== 'AMS-ROOT-2026') {
      setErrorMsg('Invalid Administrator Passkey. Contact Root Security or use default AMS-ROOT-2026.');
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
        password: password.trim() || 'password123',
        securityPasskey: securityPasskey.trim(),
      });

      const newAdmin = res.user;
      addAdmin({
        name: newAdmin.name,
        employeeId: newAdmin.employeeId,
        email: newAdmin.email,
        phone: newAdmin.phone,
        department: newAdmin.department,
        title: newAdmin.title || 'System Administrator',
      });

      if (autoLogin) {
        login(newAdmin.email, undefined, newAdmin);
      } else if (onRegisteredSuccess) {
        onRegisteredSuccess(newAdmin.email);
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register administrator in MongoDB Atlas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="my-8 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Administrator Registration</h3>
              <p className="text-xs text-slate-500">Root-level workforce governance & surveillance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-500">New admin profile</span>
            <button
              type="button"
              onClick={handleAutofill}
              title="Autofill demo admin details"
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-slate-500 hover:text-slate-900 transition-all cursor-pointer"
            >
              <Wand2 className="h-3.5 w-3.5 text-amber-500" />
              Autofill demo data
            </button>
          </div>
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 text-xs text-amber-900 flex items-start gap-2">
            <KeyRound className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Security Requirement:</span>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Creating an administrator profile grants full system control over attendance logs, employee rosters, and office geofence coordinates. Master key is prefilled for project evaluation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Admin Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ananya Iyer"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Admin ID *
              </label>
              <input
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. ADM002"
                className="w-full font-semibold rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Corporate Email *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98401 22334"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              >
                <option value="System Administration">System Administration</option>
                <option value="Human Resources">Human Resources (HR Ops)</option>
                <option value="Executive Management">Executive Management</option>
                <option value="IT Operations">IT Operations & Security</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Admin Master Passkey *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={securityPasskey}
                  onChange={(e) => setSecurityPasskey(e.target.value)}
                  placeholder="AMS-ROOT-2026"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="admin-auto-login"
              checked={autoLogin}
              onChange={(e) => setAutoLogin(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <label htmlFor="admin-auto-login" className="text-xs text-slate-600 cursor-pointer">
              Automatically sign in to Admin Dashboard after registration
            </label>
          </div>

          {/* Privileges Badge */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1">
            <span className="font-semibold text-slate-900 block">Privileges Granted:</span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="rounded bg-white px-2 py-0.5 border border-slate-200 text-slate-700">Add/Remove Staff</span>
              <span className="rounded bg-white px-2 py-0.5 border border-slate-200 text-slate-700">Assign Managers</span>
              <span className="rounded bg-white px-2 py-0.5 border border-slate-200 text-slate-700">Geofence Coordinates</span>
              <span className="rounded bg-white px-2 py-0.5 border border-slate-200 text-slate-700">Approval Audits</span>
              <span className="rounded bg-white px-2 py-0.5 border border-slate-200 text-slate-700">CSV Export</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving to Atlas...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Register Administrator</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
