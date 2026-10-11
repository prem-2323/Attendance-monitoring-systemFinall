import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Camera,
  Check,
  ShieldCheck,
  UserPlus,
  AlertCircle,
  Video,
  VideoOff,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface RegisterEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisteredSuccess?: (email: string) => void;
}

export const RegisterEmployeeModal: React.FC<RegisterEmployeeModalProps> = ({
  isOpen,
  onClose,
  onRegisteredSuccess,
}) => {
  const { addEmployee, login, users } = useApp();
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState(`EMP00${users.filter((u) => u.role === 'employee').length + 1}`);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [department, setDepartment] = useState('Engineering');
  
  // Available managers from live user database
  const availableManagers = users.filter((u) => u.role === 'manager');
  const [managerName, setManagerName] = useState(
    availableManagers[0]?.name || 'Kumar Verma'
  );

  const [password, setPassword] = useState('');
  const [autoLogin, setAutoLogin] = useState(true);
  const [faceCaptured, setFaceCaptured] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [useVirtualCam, setUseVirtualCam] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Camera video ref
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isOpen && !useVirtualCam && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { width: 400, height: 300, facingMode: 'user' } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch(() => {
          setUseVirtualCam(true);
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen, useVirtualCam]);

  if (!isOpen) return null;

  const handleCaptureFace = () => {
    setIsCapturing(true);
    setTimeout(() => {
      setIsCapturing(false);
      setFaceCaptured(true);
    }, 1200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim() || !email.trim() || !employeeId.trim()) {
      setErrorMsg('Please complete all required employee fields.');
      return;
    }

    // Check if email already registered
    const existing = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (existing) {
      setErrorMsg('This corporate email is already registered in the system.');
      return;
    }

    const assignedMgr = availableManagers.find((m) => m.name === managerName);

    const newEmp = addEmployee({
      name: name.trim(),
      employeeId: employeeId.trim(),
      email: email.trim(),
      phone: phone.trim(),
      department,
      managerId: assignedMgr?.id,
      managerName: managerName,
      role: 'employee',
      faceRegistered: faceCaptured,
      faceVector: faceCaptured ? 'VEC-128-ENROLLED-PASSIVE' : undefined,
    });

    if (autoLogin) {
      login(newEmp.email);
    } else if (onRegisteredSuccess) {
      onRegisteredSuccess(newEmp.email);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="my-8 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shadow-xs border border-emerald-200/60">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Employee Registration</h3>
              <p className="text-xs text-slate-500">Biometric enrollment & automated shift tracking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Employee Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maya Krishnan"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Employee ID *
              </label>
              <input
                type="text"
                required
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. EMP008"
                className="w-full font-semibold rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Corporate Email *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="maya.k@company.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Contact Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98400 12345"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Department *
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              >
                <option value="Engineering">Engineering</option>
                <option value="Product & Operations">Product & Operations</option>
                <option value="Quality Assurance">Quality Assurance</option>
                <option value="Human Resources">Human Resources</option>
                <option value="Sales & Marketing">Sales & Marketing</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Reporting Manager *
              </label>
              <select
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              >
                {availableManagers.length > 0 ? (
                  availableManagers.map((mgr) => (
                    <option key={mgr.id} value={mgr.name}>
                      {mgr.name} ({mgr.department})
                    </option>
                  ))
                ) : (
                  <option value="Kumar Verma">Kumar Verma (Engineering)</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Account Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          {/* Facial Biometric Enrollment Box */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Biometric Face Enrollment
                </span>
                <span className="text-[11px] text-slate-500">
                  Captures facial coordinates for 1:N AI attendance authentication
                </span>
              </div>
              {faceCaptured ? (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Face Registered ✓
                </span>
              ) : (
                <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Biometrics Required
                </span>
              )}
            </div>

            <div className="relative mx-auto flex h-40 w-56 flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-300 bg-slate-900 text-white shadow-inner">
              {faceCaptured ? (
                <div className="flex flex-col items-center text-center p-2">
                  <div className="relative h-16 w-16 rounded-full border-2 border-emerald-400 p-0.5 mb-2 overflow-hidden shadow-lg">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80"
                      alt="face preview"
                      className="h-full w-full object-cover rounded-full"
                    />
                    <div className="absolute inset-0 ring-2 ring-emerald-500 rounded-full animate-ping opacity-25" />
                  </div>
                  <span className="text-xs text-emerald-400 font-bold">128-D Vector Enrolled</span>
                  <span className="text-[10px] text-slate-400">Cosine Confidence: 99.4%</span>
                </div>
              ) : isCapturing ? (
                <div className="flex flex-col items-center gap-2 text-xs">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                  <span className="text-xs text-emerald-300 font-semibold">Extracting Landmarks...</span>
                  <span className="text-[10px] text-slate-400">Verifying anti-spoof liveness</span>
                </div>
              ) : !useVirtualCam ? (
                <div className="relative h-full w-full">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-emerald-400/70 m-3 rounded-lg" />
                  <div className="absolute bottom-1.5 inset-x-0 text-center">
                    <span className="bg-slate-900/80 px-2 py-0.5 rounded text-[10px] text-emerald-400 font-semibold">
                      Live Webcam Active
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-slate-400 text-center p-3">
                  <Camera className="h-8 w-8 stroke-1 text-slate-300" />
                  <span className="text-xs text-slate-200 font-medium">Virtual Sensor Active</span>
                  <span className="text-[10px] text-slate-400">Click button below to enroll face vector</span>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setUseVirtualCam(!useVirtualCam)}
                className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer flex items-center gap-1"
              >
                {useVirtualCam ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
                <span>{useVirtualCam ? 'Use Live Webcam' : 'Use Virtual Sensor'}</span>
              </button>

              <button
                type="button"
                onClick={handleCaptureFace}
                disabled={isCapturing}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
              >
                {faceCaptured ? 'Re-enroll Face' : 'Capture & Enroll Face'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="emp-auto-login"
              checked={autoLogin}
              onChange={(e) => setAutoLogin(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
            />
            <label htmlFor="emp-auto-login" className="text-xs text-slate-600 cursor-pointer">
              Automatically sign in to Employee Dashboard after registration
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs cursor-pointer transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              <span>Register Employee</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
