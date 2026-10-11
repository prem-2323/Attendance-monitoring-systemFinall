import React, { useState, useEffect } from 'react';
import { UserCheck, UserPlus, Mail, Phone, Building, Users, X, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SafeImage } from '../common/SafeImage';
import { SkeletonRosterGrid } from '../common/Skeleton';

interface AdminManagersProps {
  onNavigateAddManager?: () => void;
}

export const AdminManagers: React.FC<AdminManagersProps> = ({ onNavigateAddManager }) => {
  const { users, addManager, refreshUsers } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState(`MGR00${users.filter((u) => u.role === 'manager').length + 1}`);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    await refreshUsers();
    setIsLoading(false);
  };

  const managers = users.filter((u) => u.role === 'manager');

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    await addManager({
      name,
      employeeId,
      email,
      phone,
      department,
      title,
      faceRegistered: true,
    });

    setShowAddModal(false);
    setName('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Managers Management
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Department heads authorized to approve/reject attendance leaves and oversee staff shifts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
            title="Refresh managers"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => {
              if (onNavigateAddManager) onNavigateAddManager();
              else setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>+ Add Manager</span>
          </button>
        </div>
      </div>

      {/* Managers Cards Grid */}
      {isLoading ? (
        <SkeletonRosterGrid count={3} />
      ) : managers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <Users className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">No managers found</h3>
          <p className="mt-1 text-xs text-slate-400">Enrolled department managers will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {managers.map((mgr) => {
          const teamMembers = users.filter(
            (u) => u.role === 'employee' && (u.managerId === mgr.id || u.managerName === mgr.name)
          );

          return (
            <div
              key={mgr.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <SafeImage
                      src={mgr.avatarUrl}
                      alt={mgr.name}
                      className="h-12 w-12 rounded-full object-cover ring-2 ring-slate-100"
                      fallback={
                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-sm ring-2 ring-slate-100">
                          {mgr.name.slice(0, 2).toUpperCase()}
                        </div>
                      }
                    />
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{mgr.name}</h3>
                      <div className="text-[11px] font-medium text-slate-500">{mgr.employeeId}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200/80">
                    MANAGER
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    <span>{mgr.department} · {mgr.title || 'Lead'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[11px] text-slate-600">{mgr.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{mgr.phone}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-3 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Users className="h-3.5 w-3.5" />
                  <span>Assigned Direct Reports:</span>
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {teamMembers.length} Employees
                </span>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Add Manager Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add New Department Manager</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Varma"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Manager ID</label>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full font-semibold rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@company.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Product & Operations">Product & Operations</option>
                  <option value="Quality Assurance">Quality Assurance</option>
                  <option value="Human Resources">Human Resources</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Create Manager
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
