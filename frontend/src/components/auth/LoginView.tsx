import React, { useState } from 'react';
import {
  ShieldCheck,
  UserCheck,
  User as UserIcon,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Building,
  KeyRound,
  ScanFace,
  MapPin,
  CheckCircle2,
  UserPlus,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/authApi';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { RegisterModal } from './RegisterModal';
import { RegisterAdminModal } from './RegisterAdminModal';
import { RegisterManagerModal } from './RegisterManagerModal';
import { RegisterEmployeeModal } from './RegisterEmployeeModal';
import { UserRole } from '../../types';


export const LoginView: React.FC = () => {
  const { login, users } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoLoggingRole, setAutoLoggingRole] = useState<UserRole | null>(null);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');

  // Modals
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [registerRole, setRegisterRole] = useState<UserRole | null>(null);

  const handleAutoLogin = async (role: 'admin' | 'manager' | 'employee') => {
    setErrorMsg('');
    setSuccessMsg('');
    setAutoLoggingRole(role);

    try {
      const res = await authApi.autoLogin(role);
      if (res.user) {
        setSuccessMsg(`Auto-login successful: Welcome back, ${res.user.name}!`);
        login(res.user.email, role, res.user);
      } else {
        throw new Error(`Auto-login failed: No user returned for role '${role}'.`);
      }
    } catch (err: any) {
      // Graceful fallback to local user in context if network glitch
      const fallbackUser = users.find((u) => u.role === role);
      if (fallbackUser) {
        setSuccessMsg(`Auto-login active: ${fallbackUser.name} (${role}).`);
        login(fallbackUser.email, role, fallbackUser);
      } else {
        setErrorMsg(err.message || `Auto-login failed for ${role}. Please check connection.`);
      }
    } finally {
      setAutoLoggingRole(null);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setErrorMsg('Please enter both your Email/ID and password.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      const res = await authApi.login(identifier.trim(), password.trim());
      if (res.user) {
        login(res.user.email, undefined, res.user);
      } else {
        setErrorMsg('Invalid credentials. Check Email or Employee ID.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid credentials. Check Email or Employee ID.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisteredSuccess = (newEmail: string) => {
    setIdentifier(newEmail);

    setAuthTab('login');
    setSuccessMsg(`Account registered successfully in MongoDB Atlas for ${newEmail}. You can sign in.`);
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-900/[0.02] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.12),rgba(255,255,255,0))] bg-slate-100/90">
      {/* Split Layout: Left Column Hero Showcase (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-slate-950 p-12 text-white relative overflow-hidden">
        {/* Subtle radial ambient gradients */}
        <div className="absolute top-0 -left-20 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -right-20 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />

        {/* Brand header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-950 font-bold shadow-sm">
            <span className="text-sm font-semibold tracking-tight">AMS</span>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white">
              AttendanceOS
            </h1>
            <p className="text-xs text-slate-400">
              Enterprise Workforce Verification
            </p>
          </div>
        </div>

        {/* Center illustration & value proposition */}
        <div className="relative z-10 my-auto py-8 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
            <span>Next-Gen Workforce Security Platform</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl leading-tight">
            Attendance Monitoring Through Smart Approval Process
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed font-normal">
            Automate daily check-ins with multi-factor facial biometrics, automatic face-presence verification, and GPS office geofencing — backed by fair flexible-hours shift logic.
          </p>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-xs">
              <div className="flex items-center gap-2.5 text-emerald-400 font-semibold text-xs">
                <ScanFace className="h-4 w-4" />
                <span>Facial AI Biometrics</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 leading-normal">
                128-D vector representation with automatic face-presence check.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-xs">
              <div className="flex items-center gap-2.5 text-blue-400 font-semibold text-xs">
                <MapPin className="h-4 w-4" />
                <span>GPS Geofence Box</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 leading-normal">
                Polygon premises boundary — attendance only inside the office box.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-xs">
              <div className="flex items-center gap-2.5 text-amber-400 font-semibold text-xs">
                <CheckCircle2 className="h-4 w-4" />
                <span>Smart Approvals</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 leading-normal">
                Manager recommendations based on attendance percentage.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-xs">
              <div className="flex items-center gap-2.5 text-purple-400 font-semibold text-xs">
                <Building className="h-4 w-4" />
                <span>Shift Duration</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 leading-normal">
                Fair 8-hour requirement accounting for late arrivals.
              </p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 pt-6 border-t border-white/10">
          <span>Enterprise Edition v4.2</span>
          <span>SOC2 Type II Certified</span>
        </div>
      </div>

      {/* Split Layout: Right Column Authentication Box */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          {/* Header */}
          <div className="text-left mb-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white font-bold mb-4 lg:hidden">
              <span className="text-sm">AMS</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {authTab === 'login' ? 'Welcome back' : 'Choose Account Type'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              {authTab === 'login'
                ? 'Sign in to your corporate workforce portal'
                : 'Dedicated registration workflows for Admins, Managers, and Employees'}
            </p>
          </div>

          {/* Navigation Pill Switcher: Sign In vs Register */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6 border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setAuthTab('login');
                setErrorMsg('');
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
                authTab === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab('register');
                setErrorMsg('');
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
                authTab === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Create Account (Register)
            </button>
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ===================== TAB 1: SIGN IN ===================== */}
          {authTab === 'login' && (
            <>
              {/* Instant 1-Click Auto-Login Card */}
              <div className="mb-5 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-blue-50/40 to-slate-50 p-3.5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-indigo-600 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                      1-Click Auto-Login
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    MongoDB Atlas
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mb-2.5">
                  Instant zero-password access with verified database accounts:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {/* Admin Auto-Login Button */}
                  <button
                    type="button"
                    disabled={autoLoggingRole !== null || isSubmitting}
                    onClick={() => handleAutoLogin('admin')}
                    className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-900/15 bg-white text-slate-900 hover:bg-slate-900 hover:text-white transition-all shadow-xs cursor-pointer group disabled:opacity-50"
                  >
                    {autoLoggingRole === 'admin' ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900 group-hover:border-white border-t-transparent my-0.5" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 text-slate-900 group-hover:text-emerald-400 group-hover:scale-110 transition-transform" />
                    )}
                    <span className="text-[11px] font-bold mt-1">Admin</span>
                    <span className="text-[9px] text-slate-500 group-hover:text-slate-300">Auto-Login</span>
                  </button>

                  {/* Manager Auto-Login Button */}
                  <button
                    type="button"
                    disabled={autoLoggingRole !== null || isSubmitting}
                    onClick={() => handleAutoLogin('manager')}
                    className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-blue-200 bg-white text-blue-900 hover:bg-blue-600 hover:text-white transition-all shadow-xs cursor-pointer group disabled:opacity-50"
                  >
                    {autoLoggingRole === 'manager' ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 group-hover:border-white border-t-transparent my-0.5" />
                    ) : (
                      <UserCheck className="h-4 w-4 text-blue-600 group-hover:text-white group-hover:scale-110 transition-transform" />
                    )}
                    <span className="text-[11px] font-bold mt-1">Manager</span>
                    <span className="text-[9px] text-slate-500 group-hover:text-blue-100">Auto-Login</span>
                  </button>

                  {/* Employee Auto-Login Button */}
                  <button
                    type="button"
                    disabled={autoLoggingRole !== null || isSubmitting}
                    onClick={() => handleAutoLogin('employee')}
                    className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-600 hover:text-white transition-all shadow-xs cursor-pointer group disabled:opacity-50"
                  >
                    {autoLoggingRole === 'employee' ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 group-hover:border-white border-t-transparent my-0.5" />
                    ) : (
                      <UserIcon className="h-4 w-4 text-emerald-600 group-hover:text-white group-hover:scale-110 transition-transform" />
                    )}
                    <span className="text-[11px] font-bold mt-1">Employee</span>
                    <span className="text-[9px] text-slate-500 group-hover:text-emerald-100">Auto-Login</span>
                  </button>
                </div>
              </div>

              <div className="relative my-3 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative inline-block bg-white px-2 text-[10px] uppercase font-semibold text-slate-400">
                  Or Sign In Manually
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {errorMsg && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-rose-50 p-3.5 text-xs text-rose-700 border border-rose-200/80">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email Address or Employee ID
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. employee ID or name@company.com"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-xs"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-xs hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign in to Dashboard</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Dedicated Registration Links by Role */}
              <div className="mt-6 border-t border-slate-200/80 pt-5">
                <div className="text-center text-xs text-slate-500 mb-3">
                  Need a new account? Register separately:
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegisterRole('admin')}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white p-2.5 text-center hover:border-slate-400 hover:bg-slate-50 transition-all cursor-pointer shadow-xs group"
                  >
                    <ShieldCheck className="h-4 w-4 text-slate-900 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-bold text-slate-900">Admin</span>
                    <span className="text-[10px] text-slate-400">Register</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegisterRole('manager')}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border border-blue-200 bg-blue-50/40 p-2.5 text-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer shadow-xs group"
                  >
                    <UserCheck className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-bold text-blue-900">Manager</span>
                    <span className="text-[10px] text-blue-600">Register</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegisterRole('employee')}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50/40 p-2.5 text-center hover:border-emerald-400 hover:bg-emerald-50 transition-all cursor-pointer shadow-xs group"
                  >
                    <UserPlus className="h-4 w-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-bold text-emerald-900">Employee</span>
                    <span className="text-[10px] text-emerald-600">Register</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ===================== TAB 2: SEPARATE REGISTRATION VIEW ===================== */}
          {authTab === 'register' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              {/* Admin Registration Card */}
              <div
                onClick={() => setRegisterRole('admin')}
                className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4.5 hover:border-slate-900 hover:shadow-md transition-all cursor-pointer saas-card-shadow"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
                    <ShieldCheck className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 group-hover:text-slate-950 flex items-center gap-2">
                      <span>Register as Admin</span>
                      <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">Root</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Total system control, employee/manager rosters, geofencing & audit trails
                    </p>
                  </div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors shrink-0 ml-2">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>

              {/* Manager Registration Card */}
              <div
                onClick={() => setRegisterRole('manager')}
                className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4.5 hover:border-blue-600 hover:shadow-md transition-all cursor-pointer saas-card-shadow"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 shadow-xs">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 group-hover:text-blue-700 flex items-center gap-2">
                      <span>Register as Manager</span>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">Supervisory</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Department management, team shift monitoring & smart leave approvals
                    </p>
                  </div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0 ml-2">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>

              {/* Employee Registration Card */}
              <div
                onClick={() => setRegisterRole('employee')}
                className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4.5 hover:border-emerald-600 hover:shadow-md transition-all cursor-pointer saas-card-shadow"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 shadow-xs">
                    <UserPlus className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 flex items-center gap-2">
                      <span>Register as Employee</span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Biometric</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Facial enrollment, GPS check-ins, flexible shift tracking & leave requests
                    </p>
                  </div>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0 ml-2">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>

              <div className="pt-3 text-center">
                <button
                  type="button"
                  onClick={() => setAuthTab('login')}
                  className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  Already have an account? <span className="font-semibold text-blue-600">Sign In</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>


      <ForgotPasswordModal isOpen={showForgotModal} onClose={() => setShowForgotModal(false)} />
      
      {/* Dedicated Role Registration Modals */}
      <RegisterAdminModal
        isOpen={registerRole === 'admin'}
        onClose={() => setRegisterRole(null)}
        onRegisteredSuccess={handleRegisteredSuccess}
      />
      <RegisterManagerModal
        isOpen={registerRole === 'manager'}
        onClose={() => setRegisterRole(null)}
        onRegisteredSuccess={handleRegisteredSuccess}
      />
      <RegisterEmployeeModal
        isOpen={registerRole === 'employee'}
        onClose={() => setRegisterRole(null)}
        onRegisteredSuccess={handleRegisteredSuccess}
      />
    </div>
  );
};
