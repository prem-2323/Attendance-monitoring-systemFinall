import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Clock,
  Shield,
  Save,
  RotateCcw,
  CheckCircle2,
  Sun,
  Moon,
  Timer,
  Sparkles,
  Calendar,
  AlertCircle,
  RefreshCw,
  Building,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { OfficeLocation } from '../../types';
import { DEFAULT_OFFICE } from '../../data/mockData';

// Helper: Convert 12-hour string ("11:25 AM" or "07:25 PM") to 24-hour string ("11:25" or "19:25")
const time12To24 = (t: string): string => {
  if (!t) return '11:25';
  const clean = t.trim().toUpperCase();
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return '11:25';
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = match[3];
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
};

// Helper: Convert 24-hour string ("19:25" or "11:25") to 12-hour string ("07:25 PM" or "11:25 AM")
const time24To12 = (t: string): string => {
  if (!t) return '11:25 AM';
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10) || 0;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
};

// Helper: Parse time into minutes from midnight
const timeToMinutes = (t: string): number => {
  const t24 = time12To24(t);
  const [h, m] = t24.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Helper: Calculate duration between in-time and out-time
const calcDurationHours = (inStr: string, outStr: string): number => {
  const inM = timeToMinutes(inStr);
  const outM = timeToMinutes(outStr);
  let diff = outM - inM;
  if (diff <= 0) diff += 24 * 60; // handles overnight shifts
  return Math.round((diff / 60) * 10) / 10;
};

// Helper: Calculate on-time cutoff time based on in-time + grace minutes
const calcCutoffTime = (inStr: string, graceMins: number): string => {
  const inM = timeToMinutes(inStr);
  const cutoffM = (inM + (Number(graceMins) || 0)) % (24 * 60);
  const h24 = Math.floor(cutoffM / 60);
  const m = cutoffM % 60;
  return time24To12(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
};

// Helper: Add hours to in-time to generate out-time
const addHoursToInTime = (inStr: string, hours: number): string => {
  const inM = timeToMinutes(inStr);
  const totalM = (inM + Math.round(Number(hours) * 60)) % (24 * 60);
  const h24 = Math.floor(totalM / 60);
  const m = totalM % 60;
  return time24To12(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
};

const PRESET_SHIFTS = [
  { label: 'Standard Corporate', inTime: '09:00 AM', outTime: '05:00 PM', hours: 8 },
  { label: 'Morning Flex', inTime: '10:00 AM', outTime: '06:00 PM', hours: 8 },
  { label: 'Core Office Shift', inTime: '11:25 AM', outTime: '07:25 PM', hours: 8 },
  { label: 'Afternoon Shift', inTime: '01:00 PM', outTime: '09:00 PM', hours: 8 },
];

export const AdminSettings: React.FC = () => {
  const {
    officeLocation,
    officeLocations,
    updateOfficeLocations,
    smartHoursConfig,
    updateSmartHoursConfig,
    refreshSettings,
    resetAllData,
  } = useApp();

  const [locations, setLocations] = useState<OfficeLocation[]>(() => {
    return [officeLocations?.[0] || officeLocation || DEFAULT_OFFICE];
  });

  // Shift In-Time & Out-Time Working Hours State
  const [inTime, setInTime] = useState<string>(
    smartHoursConfig?.inTime || smartHoursConfig?.standardStartTime || '11:25 AM'
  );
  const [outTime, setOutTime] = useState<string>(
    smartHoursConfig?.outTime || smartHoursConfig?.standardEndTime || '07:25 PM'
  );
  const [graceMinutes, setGraceMinutes] = useState<number>(
    smartHoursConfig?.graceCheckInMinutes ?? 15
  );
  const [expectedHours, setExpectedHours] = useState<number>(
    smartHoursConfig?.expectedHoursPerDay ?? 8
  );
  const [flexibleMinutes, setFlexibleMinutes] = useState<number>(
    smartHoursConfig?.flexibleWindowMinutes ?? 180
  );

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [successDetail, setSuccessDetail] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Synchronize state when office location or smart hours change in AppContext
  useEffect(() => {
    if (officeLocations && officeLocations.length > 0) {
      setLocations([officeLocations[0]]);
    }
  }, [officeLocations]);

  const curLoc: OfficeLocation = locations[0] || officeLocation || DEFAULT_OFFICE;

  const updateCurLoc = (field: keyof OfficeLocation, value: any) => {
    setLocations((prev) => {
      const location = prev[0] || DEFAULT_OFFICE;
      return [{ ...location, [field]: value }];
    });
  };

  const updatePolygonCorner = (index: number, field: 'lat' | 'lng', value: number) => {
    const polygon = [...(curLoc.geofencePolygon || [])];
    polygon[index] = { ...polygon[index], [field]: value };
    updateCurLoc('geofencePolygon', polygon);
  };

  useEffect(() => {
    if (smartHoursConfig) {
      const liveIn = smartHoursConfig.inTime || smartHoursConfig.standardStartTime;
      const liveOut = smartHoursConfig.outTime || smartHoursConfig.standardEndTime;
      if (liveIn) setInTime(liveIn);
      if (liveOut) setOutTime(liveOut);
      if (smartHoursConfig.graceCheckInMinutes !== undefined) {
        setGraceMinutes(smartHoursConfig.graceCheckInMinutes);
      }
      if (smartHoursConfig.expectedHoursPerDay !== undefined) {
        setExpectedHours(smartHoursConfig.expectedHoursPerDay);
      }
      if (smartHoursConfig.flexibleWindowMinutes !== undefined) {
        setFlexibleMinutes(smartHoursConfig.flexibleWindowMinutes);
      }
    }
  }, [smartHoursConfig]);

  // Handlers for In-Time / Out-Time time inputs
  const handleInTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val24 = e.target.value;
    if (val24) {
      const val12 = time24To12(val24);
      setInTime(val12);
    }
  };

  const handleOutTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val24 = e.target.value;
    if (val24) {
      const val12 = time24To12(val24);
      setOutTime(val12);
    }
  };

  const handleSyncOutTimeFromHours = () => {
    const computedOut = addHoursToInTime(inTime, expectedHours);
    setOutTime(computedOut);
  };

  const handleRecalculateHoursFromTimes = () => {
    const dur = calcDurationHours(inTime, outTime);
    setExpectedHours(dur);
  };

  const applyPresetShift = (preset: typeof PRESET_SHIFTS[0]) => {
    setInTime(preset.inTime);
    setOutTime(preset.outTime);
    setExpectedHours(preset.hours);
  };

  const handleConfirmReset = async () => {
    await resetAllData();
    setShowResetConfirm(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Keep the canonical office setting and the locations list in sync.
      await updateOfficeLocations([curLoc]);

      // 2. Persist In-Time, Out-Time, and Smart Hours policy in MongoDB Atlas
      await updateSmartHoursConfig({
        inTime,
        outTime,
        standardStartTime: inTime,
        standardEndTime: outTime,
        expectedHoursPerDay: Number(expectedHours),
        graceCheckInMinutes: Number(graceMinutes),
        flexibleWindowMinutes: Number(flexibleMinutes),
      });

      // 3. Refresh live settings to guarantee UI-wide synchronicity
      await refreshSettings();

      setSuccessDetail(`Shift timings (${inTime} – ${outTime}) & the office location persisted to database.`);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err: any) {
      console.error('Failed to persist settings:', err);
      alert('Error updating settings: ' + (err?.message || 'Database connection error'));
    } finally {
      setIsSaving(false);
    }
  };

  const computedCutoff = calcCutoffTime(inTime, graceMinutes);
  const liveDuration = calcDurationHours(inTime, outTime);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              System, Shift Timings & Geofence Settings
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
              <Sparkles className="h-3 w-3 text-blue-500" />
              Live Atlas Sync
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Configure official employee arrival In-Time, departure Out-Time, grace cutoffs, and GPS office geofencing boundaries.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 border border-emerald-300 shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <div>
              <span className="block font-bold">Settings Saved!</span>
              {successDetail && <span className="block text-[10px] font-normal text-emerald-700">{successDetail}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Live policy summary — sourced from MongoDB Atlas */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            <MapPin className="h-3.5 w-3.5" /> Office
          </div>
          <div className="mt-1.5 text-sm font-bold text-slate-900">
            {officeLocation?.name || curLoc.name || 'Head Office Block'}
          </div>
          <div className="text-[11px] text-slate-500">
            {officeLocation?.allowedRadiusMeters ?? curLoc.allowedRadiusMeters ?? 1000} m geofence radius
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-blue-800">
            <Clock className="h-3.5 w-3.5" /> Work Start
          </div>
          <div className="mt-1.5 text-sm font-bold text-slate-900">
            {smartHoursConfig?.inTime || inTime}
          </div>
          <div className="text-[11px] text-slate-500">
            Grace {graceMinutes} min · cutoff {computedCutoff}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-700">
            <Timer className="h-3.5 w-3.5" /> Shift
          </div>
          <div className="mt-1.5 text-sm font-bold text-slate-900">{inTime} – {outTime}</div>
          <div className="text-[11px] text-slate-500">
            {liveDuration}h expected · {expectedHours}h target
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* ── SECTION 1: SHIFT IN-TIME & OUT-TIME (SMART WORKING HOURS) ────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Shift In-Time & Out-Time Schedule Settings
                </h2>
                <p className="text-[11px] text-slate-500">
                  Defines expected shift check-in and checkout timings enforced across the attendance system.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>Shift Duration:</span>
              <span className="font-bold text-slate-800">{liveDuration} Hours</span>
            </div>
          </div>

          {/* Quick Shift Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Quick Shift Presets
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESET_SHIFTS.map((preset) => {
                const isActive = inTime === preset.inTime && outTime === preset.outTime;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPresetShift(preset)}
                    className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                      isActive
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-100 shadow-xs'
                        : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:border-slate-300 hover:bg-slate-100/70'
                    }`}
                  >
                    <span className="text-[11px] font-bold">{preset.label}</span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {preset.inTime} – {preset.outTime}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* In-Time & Out-Time Primary Controls */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* IN-TIME INPUT */}
            <div className="rounded-xl border border-slate-200 bg-linear-to-b from-amber-50/30 to-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <Sun className="h-4 w-4 text-amber-600" />
                  <span>Office Shift In-Time (Start Time)</span>
                </div>
                <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-800">
                  {inTime}
                </span>
              </div>

              <div>
                <label
                  htmlFor="admin-in-time-input"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Select Check-in Time (24h Picker)
                </label>
                <div className="relative">
                  <input
                    id="admin-in-time-input"
                    type="time"
                    value={time12To24(inTime)}
                    onChange={handleInTimeChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-900 shadow-xs focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                <span>On-time arrival threshold:</span>
                <span className="font-semibold text-emerald-700">Until {computedCutoff}</span>
              </div>
            </div>

            {/* OUT-TIME INPUT */}
            <div className="rounded-xl border border-slate-200 bg-linear-to-b from-indigo-50/30 to-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                  <Moon className="h-4 w-4 text-indigo-600" />
                  <span>Office Shift Out-Time (End Time)</span>
                </div>
                <span className="rounded-md bg-indigo-100 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-800">
                  {outTime}
                </span>
              </div>

              <div>
                <label
                  htmlFor="admin-out-time-input"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Select Check-out Time (24h Picker)
                </label>
                <div className="relative">
                  <input
                    id="admin-out-time-input"
                    type="time"
                    value={time12To24(outTime)}
                    onChange={handleOutTimeChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-medium text-slate-900 shadow-xs focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                <span>Calculated shift length:</span>
                <button
                  type="button"
                  onClick={handleSyncOutTimeFromHours}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                  title="Align out-time exactly to in-time + expected hours"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Sync +{expectedHours}h ({addHoursToInTime(inTime, expectedHours)})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Additional Working Hours Parameters */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
            <div>
              <label
                htmlFor="admin-grace-minutes-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Grace Check-in Window
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="admin-grace-minutes-input"
                  type="number"
                  min={0}
                  max={120}
                  step={1}
                  value={graceMinutes}
                  onChange={(e) => setGraceMinutes(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <span className="text-xs text-slate-500 font-medium">min</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Cutoff deadline: <strong>{computedCutoff}</strong>
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="admin-expected-hours-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Expected Daily Work Hours
                </label>
                <button
                  type="button"
                  onClick={handleRecalculateHoursFromTimes}
                  className="text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  Calc from shift ({liveDuration}h)
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="admin-expected-hours-input"
                  type="number"
                  min={1}
                  max={24}
                  step={0.5}
                  value={expectedHours}
                  onChange={(e) => setExpectedHours(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <span className="text-xs text-slate-500 font-medium">hours</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Target workday required for Present status
              </p>
            </div>

            <div>
              <label
                htmlFor="admin-flex-window-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Flexible Shift Window
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="admin-flex-window-input"
                  type="number"
                  min={0}
                  max={480}
                  step={15}
                  value={flexibleMinutes}
                  onChange={(e) => setFlexibleMinutes(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <span className="text-xs text-slate-500 font-medium">min</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                {(flexibleMinutes / 60).toFixed(1)}h flex window after grace
              </p>
            </div>
          </div>

          {/* Live Shift Intelligence Preview Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2">
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold">
                <Timer className="h-3.5 w-3.5 text-blue-600" />
                <span>Scheduled Shift</span>
              </div>
              <div className="text-lg font-bold text-slate-900 mt-1">
                {inTime} – {outTime}
              </div>
              <span className="text-[10px] text-blue-700 font-medium mt-0.5 block">
                {liveDuration} hours shift span
              </span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                <span>On-time Arrival Deadline</span>
              </div>
              <div className="text-lg font-bold text-slate-900 mt-1">
                {computedCutoff}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Includes {graceMinutes} min grace period
              </span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <span>Smart Flexible Policy</span>
              </div>
              <div className="text-lg font-bold text-emerald-600 mt-1">
                Active & Enforced
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Full {expectedHours}h worked = Present
              </span>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: OFFICE GPS LOCATION ───────────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Office GPS Geofence
                </h2>
                <p className="text-[11px] text-slate-500">
                  Configure the single office location where employees can check in or out.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Office Geofence Active
              </span>
            </div>
          </div>

          {/* Single office location editor */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/20 p-4 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-blue-100 pb-3">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-900">
                  Office Location: {curLoc.name || 'Office'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Campus / Facility Name
                </label>
                <input
                  type="text"
                  value={curLoc.name || ''}
                  onChange={(e) => updateCurLoc('name', e.target.value)}
                  placeholder="Office name"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Allowed Geofence Radius (Meters)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={20}
                    max={5000}
                    step={10}
                    value={curLoc.allowedRadiusMeters ?? 1000}
                    onChange={(e) => updateCurLoc('allowedRadiusMeters', Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                  <span className="text-xs text-slate-500 font-medium shrink-0">meters</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Physical Street Address
              </label>
              <input
                type="text"
                value={curLoc.address || ''}
                onChange={(e) => updateCurLoc('address', e.target.value)}
                placeholder="Street address, city, state"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Center Latitude (°N)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={curLoc.lat ?? 0}
                  onChange={(e) => updateCurLoc('lat', Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Center Longitude (°E)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={curLoc.lng ?? 0}
                  onChange={(e) => updateCurLoc('lng', Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-emerald-900">Attendance Boundary Coordinates</div>
                  <p className="mt-0.5 text-[11px] text-emerald-800">
                    Enter the latitude and longitude for each boundary corner. Attendance is accepted inside this boundary only.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateCurLoc('geofencePolygon', [
                    ...(curLoc.geofencePolygon || []),
                    { lat: curLoc.lat, lng: curLoc.lng },
                  ])}
                  className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  Add coordinate
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(curLoc.geofencePolygon || []).map((corner, index) => (
                  <div key={index} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white p-2">
                    <span className="shrink-0 text-[10px] font-semibold text-slate-600">Corner {index + 1}</span>
                    <input
                      aria-label={`Corner ${index + 1} latitude`}
                      type="number"
                      step="0.000001"
                      value={corner.lat}
                      onChange={(e) => updatePolygonCorner(index, 'lat', Number(e.target.value))}
                      className="min-w-0 w-full rounded border border-slate-200 px-2 py-1 font-mono text-[10px]"
                      placeholder="Latitude"
                    />
                    <input
                      aria-label={`Corner ${index + 1} longitude`}
                      type="number"
                      step="0.000001"
                      value={corner.lng}
                      onChange={(e) => updatePolygonCorner(index, 'lng', Number(e.target.value))}
                      className="min-w-0 w-full rounded border border-slate-200 px-2 py-1 font-mono text-[10px]"
                      placeholder="Longitude"
                    />
                    {(curLoc.geofencePolygon?.length || 0) > 3 && (
                      <button
                        type="button"
                        aria-label={`Remove corner ${index + 1}`}
                        onClick={() => updateCurLoc(
                          'geofencePolygon',
                          (curLoc.geofencePolygon || []).filter((_, cornerIndex) => cornerIndex !== index)
                        )}
                        className="shrink-0 rounded px-1.5 py-1 text-[10px] text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-emerald-800">
                Center latitude/longitude and radius are used only when no polygon is configured.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            Attendance can be marked only at <strong>{curLoc.name || 'this office location'}</strong>.
          </div>
        </div>

        {/* ── SECTION 3: BIOMETRIC ENGINE PARAMETERS ───────────────────────────── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Biometric Verification Engine</h2>
              <p className="text-[11px] text-slate-500">
                Facial recognition threshold and anti-spoofing liveness parameters.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
              <span className="font-semibold text-slate-800 block">Face Match Confidence Threshold</span>
              <p className="text-slate-500 text-[11px] mt-0.5">Minimum cosine similarity required for 1:N match</p>
              <div className="font-bold text-slate-900 text-base mt-1 font-mono">98.5% (Strict)</div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
              <span className="font-semibold text-slate-800 block">Liveness Detection Mode</span>
              <p className="text-slate-500 text-[11px] mt-0.5">Active face-presence anti-spoof verification</p>
              <div className="font-bold text-emerald-600 text-base mt-1">Automatic Eye & Face Mesh</div>
            </div>
          </div>
        </div>

        {/* Save button and reset */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-5">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset System Database</span>
          </button>

          <button
            id="admin-save-settings-btn"
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-7 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Saving Settings...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save Configuration</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-600 mb-2">
              <AlertCircle className="h-5 w-5" />
              <h3 className="text-sm font-bold text-slate-900">Reset System Data</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Reset database to initial clean state? All live attendance records and leaves will be cleared, and settings will be restored to defaults.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
              >
                Yes, Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
