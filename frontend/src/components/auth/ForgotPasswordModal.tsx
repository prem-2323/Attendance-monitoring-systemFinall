import React, { useState } from 'react';
import { X, KeyRound, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { authApi } from '../../services/authApi';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'input' | 'sent' | 'reset'>('input');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [dispatchedEmail, setDispatchedEmail] = useState('');
  const [liveOtp, setLiveOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const res = await authApi.requestForgotPasswordOtp(email.trim());
      setDispatchedEmail(res.email);
      setLiveOtp(res.code);
      setCode(res.code); // Prefill for quick evaluation
      setStep('sent');
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not find account in MongoDB Atlas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 4) {
      setErrorMsg('Please enter the 4-digit code.');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      await authApi.verifyResetCode(dispatchedEmail || email.trim(), code.trim());
      setStep('reset');
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid or expired OTP code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      setErrorMsg('Please enter a new password.');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      await authApi.resetPassword(dispatchedEmail || email.trim(), code.trim(), newPassword.trim());
      setResetSuccess(true);
      setTimeout(() => {
        setResetSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password in MongoDB Atlas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <KeyRound className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Reset System Password</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {step === 'input' && (
          <form onSubmit={handleSendCode} className="mt-4 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Enter your corporate email or Employee ID. A security reset OTP token will be generated in MongoDB Atlas for identity verification.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Corporate Email / Employee ID
              </label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. john.doe@company.com or EMP001"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Generating OTP...</span>
                  </>
                ) : (
                  <span>Send Reset Code</span>
                )}
              </button>
            </div>
          </form>
        )}

        {step === 'sent' && (
          <form onSubmit={handleVerifyCode} className="mt-4 space-y-4">
            <div className="rounded-xl bg-blue-50 p-3.5 border border-blue-100 text-xs text-blue-900">
              MongoDB Atlas OTP Token generated for <strong>{dispatchedEmail || email}</strong>:{' '}
              <span className="bg-blue-100 px-2 py-0.5 rounded font-mono font-bold text-blue-950">
                {liveOtp}
              </span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Enter 4-Digit Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={liveOtp || '8421'}
                className="w-full text-center tracking-widest text-base font-semibold rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('input')}
                className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify Code</span>
                )}
              </button>
            </div>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleResetComplete} className="mt-4 space-y-4">
            {resetSuccess ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 animate-in fade-in">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>Password updated successfully in MongoDB Atlas! Redirecting to login...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Identity Verified in MongoDB Atlas. Set your new password:</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    New Security Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <span>Update Password & Return to Login</span>
                  )}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
