import React, { useState, useEffect } from 'react';
import {
  Bell,
  MapPin,
  Clock,
  LogOut,
  RotateCcw,
  Menu,
  ChevronDown,
  User as UserIcon,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface HeaderProps {
  onToggleMobileSidebar?: () => void;
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileSidebar, activeTab }) => {
  const {
    currentUser,
    logout,
    officeLocation,
    notifications,
    markNotificationRead,
    clearNotifications,
    resetAllData,
  } = useApp();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTime(
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-md">
      {/* Left branding & mobile menu toggle */}
      <div className="flex items-center gap-3.5">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden cursor-pointer transition-colors"
            aria-label="Toggle Navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 text-white font-extrabold shadow-sm ring-1 ring-slate-900/10">
            <span className="text-xs tracking-tight">AMS</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 tracking-tight">
                Smart Attendance
              </span>
              <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 sm:inline">
                Enterprise
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 capitalize hidden sm:block">
              {activeTab ? activeTab.toLowerCase() : 'Dashboard'}
            </div>
          </div>
        </div>
      </div>

      {/* Center status: live time & office geofence status */}
      <div className="hidden items-center gap-2.5 lg:flex">
        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100/70 px-3 py-1.5 rounded-xl border border-slate-200/60 shadow-2xs">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          <span className="font-semibold text-slate-700">{currentTime || '10:08 AM'}</span>
        </div>

        <div className="flex items-center gap-2 text-xs bg-emerald-50/90 text-emerald-800 px-3.5 py-1.5 rounded-xl border border-emerald-200/80 shadow-2xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <MapPin className="h-3.5 w-3.5 text-emerald-600" />
          <span className="font-bold text-emerald-950">{officeLocation.name}</span>
          <span className="text-emerald-700 font-medium text-[11px]">(office box geofence active)</span>
        </div>
      </div>

      {/* Right controls: notifications & user profile */}
      <div className="flex items-center gap-2">
        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifMenu(!showNotifMenu);
              setShowUserMenu(false);
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all cursor-pointer shadow-2xs"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2.5">
                <span className="text-xs font-bold text-slate-900">Notifications ({notifications.length})</span>
                <button
                  onClick={clearNotifications}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {notifications.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">No new notifications</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      className={`cursor-pointer rounded-xl p-3 text-xs transition-colors ${
                        n.read
                          ? 'bg-slate-50 text-slate-500'
                          : 'bg-blue-50/60 border border-blue-100/70 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{n.title}</span>
                        <span className="text-[10px] text-slate-400">{n.time}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User profile dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifMenu(false);
            }}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white py-1.5 pl-2 pr-3 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
          >
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser?.name}
                className="h-7 w-7 rounded-lg object-cover ring-1 ring-slate-200"
              />
            ) : (
              <div className="h-7 w-7 rounded-lg bg-slate-900 text-white font-bold text-[11px] flex items-center justify-center">
                {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'U'}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-slate-900 leading-tight">
                {currentUser?.name || 'Authorized User'}
              </div>
              <div className="text-[11px] text-slate-500 capitalize">
                {currentUser?.role || 'Guest'}
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-0.5" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2.5 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900">{currentUser?.name}</p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{currentUser?.email}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 capitalize">
                    {currentUser?.role}
                  </span>
                  <span className="text-[10px] text-slate-400">ID: {currentUser?.employeeId}</span>
                </div>
              </div>

              <div className="pt-2 space-y-1">
                <button
                  onClick={() => {
                    resetAllData();
                    setShowUserMenu(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                  <span>Reset System Data</span>
                </button>

                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
