import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Eye,
  Trash2,
  Edit,
  ShieldAlert,
  CheckCircle2,
  X,
  Phone,
  Mail,
  ScanFace,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';
import { Skeleton } from '../common/Skeleton';

interface AdminEmployeesProps {
  onNavigateAddEmployee: () => void;
}

export const AdminEmployees: React.FC<AdminEmployeesProps> = ({ onNavigateAddEmployee }) => {
  const { users, deleteEmployee, refreshUsers } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [managerFilter, setManagerFilter] = useState('All');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [deptFilter, managerFilter]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await refreshUsers();
    setIsLoading(false);
  };

  const employeeList = users.filter((u) => u.role === 'employee');

  const filteredEmployees = employeeList.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === 'All' || emp.department === deptFilter;
    const matchesManager = managerFilter === 'All' || emp.managerName === managerFilter;
    return matchesSearch && matchesDept && matchesManager;
  });

  const [employeeToDelete, setEmployeeToDelete] = useState<{ id: string; name: string } | null>(null);

  const confirmDelete = async () => {
    if (employeeToDelete) {
      await deleteEmployee(employeeToDelete.id);
      setEmployeeToDelete(null);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setEmployeeToDelete({ id, name });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Employee Management
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            Directory of corporate employees, assigned managerial hierarchies, and facial biometric registrations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
            title="Refresh employees list"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={onNavigateAddEmployee}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 rounded-2xl border border-slate-200/80 bg-white p-4 saas-card-shadow">
        <div className="relative sm:col-span-2">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Employee ID, Name, or Email..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          >
            <option value="All">All Departments</option>
            {Array.from(new Set(employeeList.map((e) => e.department).filter(Boolean))).map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 px-3.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          >
            <option value="All">All Managers</option>
            {Array.from(new Set(users.filter((u) => u.role === 'manager').map((m) => m.name).filter(Boolean))).map((mgr) => (
              <option key={mgr} value={mgr}>
                {mgr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Employee Table matching Section 4 */}
      <div className="rounded-2xl border border-slate-200/80 bg-white saas-card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-3.5">Employee ID</th>
                <th className="px-6 py-3.5">Name</th>
                <th className="px-6 py-3.5">Email</th>
                <th className="px-6 py-3.5">Manager</th>
                <th className="px-6 py-3.5">Biometrics</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-2.5 w-16" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-24 rounded-md" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-5 w-16 rounded-md" /></td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Skeleton className="h-7 w-7 rounded-lg" />
                        <Skeleton className="h-7 w-7 rounded-lg" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-xs text-slate-400">
                    No employees found matching current filter.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {emp.employeeId}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-3">
                        <img
                          src={emp.avatarUrl}
                          alt={emp.name}
                          className="h-8 w-8 rounded-xl object-cover ring-1 ring-slate-200"
                        />
                        <div>
                          <div>{emp.name}</div>
                          <div className="text-[11px] text-slate-400 font-normal">{emp.department}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {emp.email}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {emp.managerName || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4">
                      {emp.faceRegistered ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Enrolled ✓</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-amber-600">
                          Pending Scan
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1">
                      <button
                        onClick={() => setSelectedUser(emp)}
                        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="View Profile"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDelete(emp.id, emp.name)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete Employee"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 text-xs text-slate-500">
          <span>Showing {filteredEmployees.length} of {employeeList.length} employees</span>
          <span>Security Compliance: ISO/IEC 30107-3 Liveness Ready</span>
        </div>
      </div>

      {/* View Profile Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Employee Profile Information</h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-col items-center text-center">
              <img
                src={selectedUser.avatarUrl}
                alt={selectedUser.name}
                className="h-20 w-20 rounded-2xl object-cover ring-2 ring-slate-100"
              />
              <h4 className="mt-3 text-base font-bold text-slate-900">{selectedUser.name}</h4>
              <p className="text-xs text-slate-500">{selectedUser.employeeId} · {selectedUser.department}</p>
              <div className="mt-2">
                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md font-semibold border border-emerald-200/80">
                  {selectedUser.faceRegistered ? 'Biometric Face Enrolled' : 'Face Biometrics Pending'}
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-2.5 rounded-xl bg-slate-50 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="text-slate-900 font-medium">{selectedUser.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phone:</span>
                <span className="text-slate-900 font-medium">{selectedUser.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reporting Manager:</span>
                <span className="font-semibold text-slate-900">{selectedUser.managerName || 'None'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date of Joining:</span>
                <span className="text-slate-900 font-medium">{selectedUser.joinDate}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedUser(null)}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {employeeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900">Confirm Deactivation</h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to deactivate and remove employee <strong className="text-slate-900">{employeeToDelete.name}</strong>? This action will archive their profile.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEmployeeToDelete(null)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
              >
                Yes, Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
