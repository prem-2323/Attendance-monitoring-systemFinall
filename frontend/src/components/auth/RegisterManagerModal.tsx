import React, { useState } from 'react';
import { X, UserCheck, AlertCircle, Building, Mail, Phone, Users, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface RegisterManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisteredSuccess?: (email: string) => void;
}

export const RegisterManagerModal: React.FC<RegisterManagerModalProps> = ({
  isOpen,
  onClose,
  onRegisteredSuccess,
}) => {
  const { addManager, login, users } = useApp();
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState(`MGR00${users.filter((u) => u.role === 'manager').length + 1}`);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [department, setDepartment] = useState('Engineering');
  const [title, setTitle] = useState('Engineering Lead');
  const [password, setPassword] = useState('');
  const [autoLogin, setAutoLogin] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim() || !email.trim() || !employeeId.trim()) {
      setErrorMsg('Please complete all required manager profile fields.');
      return;
    }

    // Check if email exists
    const existing = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (existing) {
      setErrorMsg('This corporate email is already registered in the system.');
      return;
    }

    const newMgr = addManager({
      name: name.trim(),
      employeeId: employeeId.trim(),
      email: email.trim(),
      phone: phone.trim(),
      department,
      title: title.trim(),
    });

    if (autoLogin) {
      login(newMgr.email);
    } else if (onRegisteredSuccess) {
      onRegisteredSuccess(newMgr.email);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="my-8 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-xs border border-blue-200/60">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Manager Registration</h3>
              <p className="text-xs text-slate-500">Department supervision & smart approval governance</p>
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
          <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-3 text-xs text-blue-900 flex items-start gap-2">
            <Building className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Supervisory Role:</span>
              <p className="text-[11px] text-blue-800 mt-0.5">
                Managers review direct report employee check-ins, evaluate shift punctuality, and make informed leave approvals backed by algorithmic attendance recommendations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Manager Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vikram Rathore"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Manager ID *
              </label>
              <input
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. MGR003"
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
                placeholder="manager@company.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Contact Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98402 33445"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Assigned Department *
              </label>
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  if (e.target.value === 'Engineering') setTitle('Engineering Lead');
                  else if (e.target.value === 'Product & Operations') setTitle('Product Operations Lead');
                  else if (e.target.value === 'Quality Assurance') setTitle('QA Team Lead');
                  else setTitle('Department Head');
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              >
                <option value="Engineering">Engineering</option>
                <option value="Product & Operations">Product & Operations</option>
                <option value="Quality Assurance">Quality Assurance</option>
                <option value="Human Resources">Human Resources</option>
                <option value="Sales & Marketing">Sales & Marketing</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Designation / Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Engineering Lead"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
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
              id="mgr-auto-login"
              checked={autoLogin}
              onChange={(e) => setAutoLogin(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <label htmlFor="mgr-auto-login" className="text-xs text-slate-600 cursor-pointer">
              Automatically sign in to Manager Dashboard after registration
            </label>
          </div>

          {/* Capabilities */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1">
            <span className="font-semibold text-slate-900 block">Manager Permissions:</span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="rounded bg-white px-2 py-0.5 border border-slate-200 text-slate-700">Team Attendance Dashboard</span>
              <span className="rounded bg-white px-2 py-0.5 border border-slate-200 text-slate-700">Smart Leave Approvals</span>
              <span className="rounded bg-white px-2 py-0.5 border border-slate-200 text-slate-700">Attendance History Inspection</span>
              <span className="rounded bg-white px-2 py-0.5 border border-slate-200 text-slate-700">Direct Reports Directory</span>
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
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs cursor-pointer transition-colors"
            >
              <UserCheck className="h-4 w-4" />
              <span>Register Manager</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
