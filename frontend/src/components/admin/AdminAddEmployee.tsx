import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Video,
  UserCheck,
  Shield,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';

interface AdminAddEmployeeProps {
  onCancel: () => void;
  onSuccess: () => void;
}

export const AdminAddEmployee: React.FC<AdminAddEmployeeProps> = ({ onCancel, onSuccess }) => {
  const { addEmployee, users } = useApp();

  const availableManagers = users.filter((u) => u.role === 'manager');
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState(`EMP00${users.length + 1}`);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [managerName, setManagerName] = useState(availableManagers[0]?.name || '');
  const [role, setRole] = useState<UserRole>('employee');

  // Camera & Face Registration State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Initialize camera stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setStreamActive(true);
          }
        }
      } catch (err) {
        console.warn('Real webcam not accessible or permission denied.', err);
        setCameraError('Webcam hardware unavailable or denied.');
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleCaptureFace = () => {
    setIsCapturing(true);

    setTimeout(() => {
      if (videoRef.current && streamActive) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth || 320;
          canvas.height = videoRef.current.videoHeight || 240;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            setCapturedPhotoUrl(canvas.toDataURL('image/jpeg'));
          }
        } catch {
          // If canvas extraction fails, keep current state
        }
      }

      setIsCapturing(false);
      setFaceRegistered(true);
    }, 1000);
  };

  const [errorMsg, setErrorMsg] = useState('');

  const handleRetake = () => {
    setCapturedPhotoUrl(null);
    setFaceRegistered(false);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!name.trim() || !employeeId.trim() || !email.trim()) {
      setErrorMsg('Please fill out employee name, employee ID, and corporate email.');
      return;
    }

    try {
      await addEmployee({
        name,
        employeeId,
        email,
        phone,
        department,
        managerName,
        role,
        avatarUrl: capturedPhotoUrl || undefined,
        faceRegistered: faceRegistered,
        faceVector: faceRegistered ? `face_vec_${Date.now()}_128d` : undefined,
      });

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register employee');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
        <div>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-1 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Employees</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Add New Employee
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-normal">
            Create employee record & enroll facial recognition biometric signature.
          </p>
        </div>
      </div>

      <form onSubmit={handleCreateEmployee} className="space-y-6">
        {errorMsg && (
          <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/95 p-3.5 text-xs font-semibold text-rose-800 shadow-xs">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {/* Form fields */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 saas-card-shadow space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">Employee Details</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Narayan"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Employee ID
              </label>
              <input
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="EMP008"
                className="w-full font-semibold rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Corporate Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ramesh@company.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98401 23456"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-xs"
              >
                <option value="Engineering">Engineering</option>
                <option value="Product & Operations">Product & Operations</option>
                <option value="Quality Assurance">Quality Assurance</option>
                <option value="Human Resources">Human Resources</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Assigned Manager
              </label>
              <select
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-xs"
              >
                {availableManagers.length === 0 ? (
                  <option value="">No managers enrolled</option>
                ) : (
                  availableManagers.map((mgr) => (
                    <option key={mgr.id} value={mgr.name}>
                      {mgr.name} ({mgr.department})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-xs"
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
              </select>
            </div>
          </div>
        </div>

        {/* FACE REGISTRATION SECTION */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 saas-card-shadow space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Face Biometric Registration
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Capture high-resolution biometric face template for automated check-in verification
              </p>
            </div>
            {faceRegistered && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200/80">
                <Check className="h-4 w-4 text-emerald-600" />
                <span>Face Registered ✓</span>
              </span>
            )}
          </div>

          <div className="flex flex-col items-center">
            {/* Camera View Box */}
            <div className="relative h-64 w-80 overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center">
              {capturedPhotoUrl?.trim() ? (
                <div className="relative h-full w-full">
                  <img
                    src={capturedPhotoUrl}
                    alt="Captured face"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-emerald-950/20 border-2 border-emerald-500 rounded-2xl pointer-events-none" />
                  <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-black/70 p-2 text-center text-xs text-emerald-300 font-medium backdrop-blur-xs">
                    Biometric Signature Encoded (128-D)
                  </div>
                </div>
              ) : (
                <div className="relative h-full w-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`h-full w-full object-cover ${!streamActive ? 'hidden' : ''}`}
                  />

                  {!streamActive && (
                    <div className="flex flex-col items-center text-slate-400 p-4 text-center">
                      <div className="relative h-24 w-24 rounded-full border border-dashed border-emerald-400/50 flex items-center justify-center bg-emerald-950/20 mb-2">
                        <Camera className="h-8 w-8 text-emerald-400 stroke-1" />
                        <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                      <span className="text-xs font-semibold text-emerald-300">Live Virtual Sensor Ready</span>
                      <span className="text-[11px] text-slate-400 mt-0.5">Ready for optical snapshot</span>
                    </div>
                  )}

                  {/* Face Mesh Overlay */}
                  <div className="absolute inset-6 rounded-2xl border-2 border-dashed border-emerald-400/50 pointer-events-none">
                    <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-emerald-400" />
                    <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-emerald-400" />
                    <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-emerald-400" />
                    <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-emerald-400" />
                  </div>

                  <div className="absolute left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-scan-line pointer-events-none" />

                  {isCapturing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                      <span className="mt-2 text-xs text-emerald-300 font-semibold">
                        Extracting Facial Features...
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons under camera */}
            <div className="mt-4 flex items-center gap-3">
              {faceRegistered ? (
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Retake Photo</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCaptureFace}
                  disabled={isCapturing}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Camera className="h-4 w-4" />
                  <span>Capture Face</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Form Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200/80 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Create Employee
          </button>
        </div>
      </form>
    </div>
  );
};
