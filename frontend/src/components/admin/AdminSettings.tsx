import React, { useState } from 'react';
import {
  Settings,
  MapPin,
  Clock,
  Shield,
  Save,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AdminSettings: React.FC = () => {
  const { officeLocation, updateOfficeLocation, resetAllData } = useApp();

  const [name, setName] = useState(officeLocation.name);
  const [address, setAddress] = useState(officeLocation.address);
  const [lat, setLat] = useState(officeLocation.lat);
  const [lng, setLng] = useState(officeLocation.lng);
  const [radius, setRadius] = useState(officeLocation.allowedRadiusMeters);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleConfirmReset = async () => {
    await resetAllData();
    setShowResetConfirm(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateOfficeLocation({
      name,
      address,
      lat: Number(lat),
      lng: Number(lng),
      allowedRadiusMeters: Number(radius),
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            System & Geofence Settings
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Configure office coordinates, GPS tolerance radius, shift working hours, and biometric thresholds.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-4 w-4" />
            <span>Settings Saved!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Geofencing Office Radius */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <MapPin className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">Office GPS Geofencing Boundaries</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Office / Campus Facility Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
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
                  max={2000}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <span className="text-xs text-slate-500 font-medium">meters</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Physical Street Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Latitude (°N)
              </label>
              <input
                type="number"
                step="0.000001"
                value={lat}
                onChange={(e) => setLat(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Longitude (°E)
              </label>
              <input
                type="number"
                step="0.000001"
                value={lng}
                onChange={(e) => setLng(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Office geofence box corners (from OFFICE_GEOFENCE_POLYGON env) */}
          <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-3.5">
            <div className="text-xs font-bold text-emerald-900">
              Office Geofence Box — attendance allowed ONLY inside
            </div>
            <p className="mt-0.5 text-[11px] text-emerald-800">
              Corners are configured in the env file (OFFICE_GEOFENCE_POLYGON). The server re-checks every check-in against this box.
            </p>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {(officeLocation.geofencePolygon ?? []).map((c, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-700"
                >
                  Corner {i + 1}: {c.lat.toFixed(6)}, {c.lng.toFixed(6)}
                </div>
              ))}
              {(!officeLocation.geofencePolygon || officeLocation.geofencePolygon.length === 0) && (
                <div className="text-[11px] text-slate-500">
                  Box corners load from the server on next refresh.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Working Hours & Shift Rules */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Smart Working Hours Policy</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80">
              <span className="font-semibold text-slate-700 block">Expected Shift Duration</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">8.0 Hours</span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Flexible arrival supported</span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80">
              <span className="font-semibold text-slate-700 block">Standard On-time Cutoff</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">09:15 AM</span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">15 min grace window</span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80">
              <span className="font-semibold text-slate-700 block">Smart Flexible Shift</span>
              <span className="text-xl font-bold text-emerald-600 mt-1 block">Enabled</span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Check-in at 12:00 PM requires checkout at 08:00 PM</span>
            </div>
          </div>
        </div>

        {/* Biometrics & Liveness */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 saas-card-shadow space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Shield className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Biometric Verification Engine</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div className="space-y-1">
              <span className="font-semibold text-slate-800">Face Match Confidence Threshold</span>
              <p className="text-slate-500 text-[11px]">Minimum cosine distance required for 1:N match</p>
              <div className="font-bold text-slate-900 text-sm">98.5%</div>
            </div>

            <div className="space-y-1">
              <span className="font-semibold text-slate-800">Liveness Detection Mode</span>
              <p className="text-slate-500 text-[11px]">Passive blink verification + head movement</p>
              <div className="font-bold text-emerald-600 text-sm">Active (3 Challenges)</div>
            </div>
          </div>
        </div>

        {/* Save button and reset */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Demo Database</span>
          </button>

          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900">Reset System Data</h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Reset entire database to clean state? All attendance records, audit logs, and temporary leaves will be cleared.
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
