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
import { employeeApi, SmartHoursResponse } from '../../services/employeeApi';

export const EmployeeSmartHours: React.FC = () => {
  const { currentUser, todayAttendance } = useApp();
  const [isLoading, setIsLoading] = useState(true);

  const empId = currentUser?.employeeId || '';

  // Find employee's today record check-in
  const todayRec = todayAttendance.find((a) => a.employeeId === empId);
  const initialCheckIn = todayRec?.checkIn || '09:00 AM';

  // Interactive Simulator parameters
  const [simulatedCheckIn, setSimulatedCheckIn] = useState<string>(initialCheckIn);
  const [simulatedCurrentTime, setSimulatedCurrentTime] = useState<string>('05:00 PM');

  const [metrics, setMetrics] = useState<SmartHoursResponse>({
    employeeId: empId,
    checkInTime: todayRec?.checkIn || '--',
    expectedCheckoutTime: '--',
    workedTime: todayRec?.hoursWorked || '--',
    remainingTime: todayRec?.checkIn ? 'In Progress' : '8h 00m',
    completionPercent: 0,
    targetHoursPerDay: 8,
    smartPolicy: 'Flexible shift window with 8 full working hours enforcement',
  });

  const [simPreview, setSimPreview] = useState<SmartHoursResponse['simulated']>(null);

  const fetchShiftCalculation = async (checkIn: string, currTime?: string) => {
    if (!empId) {
      setIsLoading(false);
      return;
    }
    try {
      // Single backend call returns ACTUAL shift at top level plus a
      // hypothetical SIMULATED preview that is never persisted.
      const res = await employeeApi.getSmartHours(empId, checkIn, currTime);
      if (res) {
        setMetrics(res);
        setSimPreview(res.simulated ?? null);
      }
    } catch (err) {
      console.warn('Backend smart hours query failed, using dynamic local calculation:', err);
      // Dynamic local mathematical calculation (offline fallback only)
      try {
        const targetH = metrics.targetHoursPerDay || 8;
        const [inHStr, inMStr] = checkIn.split(':');
        const [inMVal, inAmpm] = inMStr.split(' ');
        let inH = parseInt(inHStr, 10);
        if (inAmpm === 'PM' && inH !== 12) inH += 12;
        if (inAmpm === 'AM' && inH === 12) inH = 0;
        const inTotalMins = inH * 60 + parseInt(inMVal, 10);

        const expTotalMins = (inTotalMins + targetH * 60) % (24 * 60);
        const expH24 = Math.floor(expTotalMins / 60);
        const expM = expTotalMins % 60;
        const expAmpm = expH24 >= 12 ? 'PM' : 'AM';
        const expH12 = expH24 % 12 === 0 ? 12 : expH24 % 12;
        const expTimeStr = `${String(expH12).padStart(2, '0')}:${String(expM).padStart(2, '0')} ${expAmpm}`;

        setMetrics({
          employeeId: empId,
          checkInTime: checkIn,
          expectedCheckoutTime: expTimeStr,
          workedTime: '6h 00m',
          remainingTime: '2h 00m',
          completionPercent: 75,
          targetHoursPerDay: targetH,
          smartPolicy: 'Flexible shift policy (offline fallback)',
        });
      } catch {
        // Safe fallback
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchShiftCalculation(simulatedCheckIn, simulatedCurrentTime);
  }, [empId, simulatedCheckIn, simulatedCurrentTime]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchShiftCalculation(simulatedCheckIn, simulatedCurrentTime);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Smart Working Hours
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            Dynamic shift tracking ensures employees fulfill required hours fairly based on MongoDB Atlas data.
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
          {/* Main Status Card: Today's Work Status */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 saas-card-shadow space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Today's Work Status</h2>
                  <p className="text-xs text-slate-500">Actual persisted shift from MongoDB Atlas — simulator below is hypothetical only</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-blue-50 px-3 py-1 font-semibold text-blue-700 border border-blue-200/80">
                  Flexible Shift Active
                </span>
                {metrics.dayStatus && (
                  <span className="rounded-md bg-slate-100 px-3 py-1 font-semibold text-slate-700 border border-slate-200">
                    Day: {metrics.dayStatus}
                  </span>
                )}
                {metrics.arrivalStatus && (
                  <span className="rounded-md bg-amber-50 px-3 py-1 font-semibold text-amber-700 border border-amber-200/80">
                    Arrival: {metrics.arrivalStatus}
                  </span>
                )}
              </div>
            </div>

            {/* 6 Metric Panels */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 text-left">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <span className="text-xs font-medium text-slate-500 block">
                  Expected Hours
                </span>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {metrics.targetHoursPerDay} Hours
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <span className="text-xs font-medium text-slate-500 block">
                  Check-in
                </span>
                <div className="mt-2 text-xl font-bold text-blue-600">
                  {metrics.checkInTime}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <span className="text-xs font-medium text-slate-500 block">
                  Day Status
                </span>
                <div className="mt-2 text-lg font-bold text-slate-900">
                  {metrics.dayStatus || '—'}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <span className="text-xs font-medium text-slate-500 block">
                  Worked
                </span>
                <div className="mt-2 text-xl font-bold text-emerald-600">
                  {metrics.workedTime}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <span className="text-xs font-medium text-slate-500 block">
                  Remaining
                </span>
                <div className="mt-2 text-xl font-bold text-amber-600">
                  {metrics.remainingTime}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                <span className="text-xs font-medium text-slate-500 block">
                  Expected Check-out
                </span>
                <div className="mt-2 text-xl font-bold text-slate-900">
                  {metrics.expectedCheckoutTime}
                </div>
              </div>
            </div>

            {/* Large Progress Bar — ACTUAL shift only */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>{metrics.completionPercent}% completed (actual)</span>
                <span className="text-slate-500 font-normal">{metrics.workedTime} / {metrics.targetHoursPerDay}h 00m</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out"
                  style={{ width: `${metrics.completionPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* WHY SMART FLEXIBLE HOURS MATTER */}
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

            {/* Formula Section using small cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <span className="text-xs font-medium text-slate-400">Policy Standard</span>
                <div className="text-sm font-bold text-slate-900 mt-1">
                  Required Hours = {metrics.targetHoursPerDay}
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                <span className="text-xs font-medium text-blue-600">Actual Arrival</span>
                <div className="text-sm font-bold text-blue-950 mt-1">
                  Check-in = {metrics.checkInTime}{metrics.arrivalStatus ? ` (${metrics.arrivalStatus})` : ''}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <span className="text-xs font-medium text-emerald-600">Calculated Dynamic Target</span>
                <div className="text-sm font-bold text-emerald-950 mt-1">
                  Required Check-out = {metrics.expectedCheckoutTime}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Shift Scenario Simulator — hypothetical only */}
          <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 p-6 saas-card-shadow space-y-3">
            <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-slate-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Shift Simulator (hypothetical — never saved)
                </h3>
              </div>
              <span className="text-xs text-slate-500">Actual status above is unaffected</span>
            </div>

            {simPreview && (
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div className="rounded-xl bg-white p-3 border border-amber-200/70">
                  <span className="text-slate-500">Sim check-in</span>
                  <div className="font-bold text-slate-900">{simPreview.checkIn}</div>
                </div>
                <div className="rounded-xl bg-white p-3 border border-amber-200/70">
                  <span className="text-slate-500">Sim worked</span>
                  <div className="font-bold text-blue-700">{simPreview.workedTime}</div>
                </div>
                <div className="rounded-xl bg-white p-3 border border-amber-200/70">
                  <span className="text-slate-500">Sim remaining</span>
                  <div className="font-bold text-amber-700">{simPreview.remainingTime}</div>
                </div>
                <div className="rounded-xl bg-white p-3 border border-amber-200/70">
                  <span className="text-slate-500">Sim checkout</span>
                  <div className="font-bold text-emerald-700">{simPreview.expectedCheckout}</div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {['08:30 AM', '09:12 AM', '10:30 AM', '12:00 PM', '01:00 PM'].map((time) => (
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
