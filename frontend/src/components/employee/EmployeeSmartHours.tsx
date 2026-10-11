import React, { useState, useEffect } from 'react';
import {
  Clock,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Info,
  Sliders,
  Check,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Skeleton } from '../common/Skeleton';

export const EmployeeSmartHours: React.FC = () => {
  const { currentUser } = useApp();
  const [isLoading, setIsLoading] = useState(true);

  // Interactive Simulator parameters
  const [simulatedCheckIn, setSimulatedCheckIn] = useState('12:00 PM');
  const [simulatedCurrentTime, setSimulatedCurrentTime] = useState('07:15 PM');

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

  const calculateShiftMetrics = (checkIn: string) => {
    if (checkIn === '12:00 PM') {
      return {
        worked: '7h 15m',
        remaining: '45 minutes',
        expectedCheckout: '08:00 PM',
        completionPercent: 90,
      };
    }
    if (checkIn === '09:12 AM') {
      return {
        worked: '5h 42m',
        remaining: '2h 18m',
        expectedCheckout: '05:12 PM',
        completionPercent: 71,
      };
    }
    if (checkIn === '10:30 AM') {
      return {
        worked: '4h 20m',
        remaining: '3h 40m',
        expectedCheckout: '06:30 PM',
        completionPercent: 54,
      };
    }
    return {
      worked: '6h 00m',
      remaining: '2h 00m',
      expectedCheckout: '07:00 PM',
      completionPercent: 75,
    };
  };

  const metrics = calculateShiftMetrics(simulatedCheckIn);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header matching Section 9 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Smart Working Hours
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            Dynamic shift tracking ensures employees fulfill required hours fairly.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          title="Refresh shift calculations"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 saas-card-shadow space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-40 rounded-md" />
                <Skeleton className="h-3 w-56 rounded-md" />
              </div>
              <Skeleton className="h-6 w-32 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-2">
                  <Skeleton className="h-3 w-20 rounded-md" />
                  <Skeleton className="h-6 w-16 rounded-md" />
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-2">
              <Skeleton className="h-3.5 w-full rounded-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24 rounded-md" />
                <Skeleton className="h-3 w-20 rounded-md" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow space-y-4">
            <Skeleton className="h-4 w-40 rounded-md" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          </div>
        </div>
      ) : (
        <>
      {/* Main Status Card: Today's Work Status matching Section 9 */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 saas-card-shadow space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Today's Work Status</h2>
              <p className="text-xs text-slate-500">Calculated based on smart check-in timestamp</p>
            </div>
          </div>
          <span className="rounded-md bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80 self-start sm:self-auto">
            Flexible Shift Active
          </span>
        </div>

        {/* 6 Metric Panels matching Section 9 */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 text-left">
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <span className="text-xs font-medium text-slate-500 block">
              Expected Hours
            </span>
            <div className="mt-2 text-xl font-bold text-slate-900">
              8 Hours
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <span className="text-xs font-medium text-slate-500 block">
              Check-in
            </span>
            <div className="mt-2 text-xl font-bold text-blue-600">
              {simulatedCheckIn}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <span className="text-xs font-medium text-slate-500 block">
              Current Time
            </span>
            <div className="mt-2 text-xl font-bold text-slate-900">
              {simulatedCurrentTime}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <span className="text-xs font-medium text-slate-500 block">
              Worked
            </span>
            <div className="mt-2 text-xl font-bold text-emerald-600">
              {metrics.worked}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <span className="text-xs font-medium text-slate-500 block">
              Remaining
            </span>
            <div className="mt-2 text-xl font-bold text-amber-600">
              {metrics.remaining}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <span className="text-xs font-medium text-slate-500 block">
              Expected Check-out
            </span>
            <div className="mt-2 text-xl font-bold text-slate-900">
              {metrics.expectedCheckout}
            </div>
          </div>
        </div>

        {/* Large Progress Bar matching Section 9: e.g. 90% completed */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>{metrics.completionPercent}% completed</span>
            <span className="text-slate-500 font-normal">{metrics.worked} / 8h 00m</span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out"
              style={{ width: `${metrics.completionPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* WHY SMART FLEXIBLE HOURS MATTER matching Section 9 */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 saas-card-shadow space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Clock className="h-4 w-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Why Smart Flexible Hours Matter
          </h3>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed font-normal">
          Traditional clock systems penalize employees who arrive at 12:00 PM with an automatic half-day absence.
          Our smart flexible shift policy dynamically adapts the required checkout threshold so that employees are not penalized as long as they complete their expected 8 working hours.
        </p>

        {/* Formula Section using small cards matching Section 9 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <span className="text-xs font-medium text-slate-400">Policy Standard</span>
            <div className="text-sm font-bold text-slate-900 mt-1">
              Required Hours = 8
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
            <span className="text-xs font-medium text-blue-600">Actual Arrival</span>
            <div className="text-sm font-bold text-blue-950 mt-1">
              Check-in = 12:00 PM
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <span className="text-xs font-medium text-emerald-600">Adjusted Expectation</span>
            <div className="text-sm font-bold text-emerald-950 mt-1">
              Required Check-out = 08:00 PM
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Shift Scenario Simulator */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-slate-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Arrival Scenario Simulator
            </h3>
          </div>
          <span className="text-xs text-slate-400">Click a time to simulate dynamic adjustment</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {['09:12 AM', '10:30 AM', '12:00 PM', '01:00 PM'].map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => setSimulatedCheckIn(time)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                simulatedCheckIn === time
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Arrival at {time}
            </button>
          ))}
        </div>
      </div>
        </>
      )}
    </div>
  );
};
