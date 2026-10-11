import React, { useState, useEffect } from 'react';
import { Users, Mail, Phone, Calendar, CheckCircle2, Search, Eye, Check, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';
import { SkeletonRosterGrid } from '../common/Skeleton';
import { managerApi } from '../../services/managerApi';

export const ManagerEmployees: React.FC = () => {
  const { currentUser, users, todayAttendance, historicalAttendance, refreshUsers } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [liveTeam, setLiveTeam] = useState<User[] | null>(null);

  const managerId = currentUser?.id || currentUser?.employeeId || 'user-mgr-1';

  const fetchTeam = async () => {
    setIsLoading(true);
    try {
      const data = await managerApi.getTeamEmployees(managerId);
      if (data && data.length > 0) {
        setLiveTeam(data);
      }
    } catch (err) {
      console.warn('Could not fetch team directory from Atlas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [managerId]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await Promise.all([refreshUsers(), fetchTeam()]);
  };

  // Fallback to local users if liveTeam not yet loaded
  const fallbackTeam = users.filter(
    (u) =>
      u.role === 'employee' &&
      (u.managerId === currentUser?.id || u.managerName === currentUser?.name || u.department === currentUser?.department)
  );

  const myTeam = liveTeam !== null ? liveTeam : fallbackTeam;

  const filteredTeam = myTeam.filter(
    (e) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            My Team Directory
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            Employees under your direct reporting supervision in {currentUser?.department || 'Engineering'}.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          title="Refresh team directory"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative rounded-2xl border border-slate-200/80 bg-white p-3 saas-card-shadow">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-6 text-slate-400">
          <Search className="h-4 w-4" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter team members by name, email, or employee ID..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Team Cards Grid */}
      {isLoading ? (
        <SkeletonRosterGrid count={myTeam.length || 3} />
      ) : filteredTeam.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center saas-card-shadow">
          <Users className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">No team members found</h3>
          <p className="mt-1 text-xs text-slate-400">Try modifying your search criteria or adding direct reports.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTeam.map((emp) => {
            // Dynamic rate from server or calculate fallback
            let attRate = (emp as any).attendanceRate;
            if (attRate === undefined) {
              const empAttendance = [...todayAttendance, ...historicalAttendance].filter(
                (a) => a.employeeId === emp.employeeId
              );
              const presentCount = empAttendance.filter(
                (a) => a.status === 'Present' || a.status === 'Working' || a.status === 'Late'
              ).length;
              const totalDays = Math.max(1, empAttendance.length);
              attRate = Math.round((presentCount / totalDays) * 100);
            }

            return (
              <div
                key={emp.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow flex flex-col justify-between saas-card-hover"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={emp.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80'}
                        alt={emp.name}
                        className="h-12 w-12 rounded-xl object-cover ring-2 ring-slate-100"
                      />
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{emp.name}</h3>
                        <div className="text-xs text-slate-400">{emp.employeeId}</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/80">
                      {attRate}% Rate
                    </span>
                  </div>

                  <div className="mt-5 space-y-2.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{emp.phone || '--'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>Joined: {emp.joinDate || '2026-10-10'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-3.5 flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Face Biometrics {emp.faceRegistered ? 'Enrolled' : 'Pending'}</span>
                  </span>
                  <span className="font-semibold text-slate-900">
                    {emp.title || 'Engineer'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
