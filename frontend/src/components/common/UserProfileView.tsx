import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Mail,
  Phone,
  Building,
  Calendar,
  CheckCircle2,
  ScanFace,
  KeyRound,
  RotateCcw,
  Check,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Skeleton, SkeletonAvatar } from './Skeleton';

export const UserProfileView: React.FC = () => {
  const { currentUser } = useApp();
  const [phone, setPhone] = useState(currentUser?.phone || '+91 97910 11223');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 450);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Profile & Credentials
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            Corporate workforce identity details, biometric face enrolment, and reporting structure.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer transition-colors self-start sm:self-auto"
          title="Refresh profile details"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 saas-card-shadow space-y-8 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-slate-100 pb-8 text-center sm:text-left">
            <SkeletonAvatar size="xl" className="rounded-2xl" />
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-36 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
              <Skeleton className="h-3.5 w-48 rounded-md" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-5 w-28 rounded-md" />
                <Skeleton className="h-5 w-36 rounded-md" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Skeleton className="h-4 w-32 rounded-md" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
          </div>

          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 saas-card-shadow space-y-8">
        {/* Top Profile Card matching Section 13 */}
        <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-slate-100 pb-8 text-center sm:text-left">
          <div className="relative">
            <img
              src={currentUser?.avatarUrl}
              alt={currentUser?.name}
              className="h-24 w-24 rounded-2xl object-cover ring-2 ring-slate-100 shadow-sm"
            />
            <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
              <Check className="h-4 w-4 stroke-3" />
            </div>
          </div>

          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h2 className="text-xl font-bold text-slate-900">{currentUser?.name}</h2>
              <span className="rounded-md bg-slate-900 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-white">
                {currentUser?.role}
              </span>
            </div>
            <p className="text-sm text-slate-500 font-normal">
              Employee ID: <span className="font-semibold text-slate-700">{currentUser?.employeeId}</span> · Department: <span className="font-semibold text-slate-700">{currentUser?.department}</span>
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 border border-emerald-200/80">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Face Biometrics: Enrolled ✓</span>
              </span>
              <span className="rounded-md bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 border border-blue-200/80">
                Standard Shift: 8.0 Hours Flexible
              </span>
            </div>
          </div>
        </div>

        {/* Profile Details Form matching Section 13 */}
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Corporate Email</label>
              <input
                type="text"
                disabled
                value={currentUser?.email}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-600 text-xs shadow-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Contact Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 text-xs focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Assigned Manager</label>
              <input
                type="text"
                disabled
                value={currentUser?.managerName || 'Chief Operations Administrator'}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-600 text-xs shadow-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Date Joined</label>
              <input
                type="text"
                disabled
                value={currentUser?.joinDate || '2024-02-15'}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-slate-600 text-xs shadow-xs"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
            >
              {savedSuccess ? 'Profile Updated ✓' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Biometric Digital Pass Details matching Section 13 */}
        <div className="rounded-2xl bg-slate-50/70 p-5 border border-slate-200/80 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Biometric Digital Pass Details</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed font-normal">
            Digital Identity Pass Token: <span className="font-semibold text-slate-700">AMS-2026-BIO-{currentUser?.employeeId}</span> · Status: Active & Enrolled for Chennai Tech Park (HQ) Campus Geofence Access.
          </p>
        </div>
      </div>
      )}
    </div>
  );
};
