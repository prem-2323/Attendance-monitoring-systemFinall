import React, { useState } from 'react';
import { X, KeyRound, CheckCircle2, ArrowRight } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'input' | 'sent' | 'reset'>('input');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [resetSuccess, setResetSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setStep('sent');
    }
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length >= 4) {
      setStep('reset');
    }
  };

  const handleResetComplete = (e: React.FormEvent) => {
    e.preventDefault();
    setResetSuccess(true);
    setTimeout(() => {
      setResetSuccess(false);
      onClose();
    }, 1500);
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

        {step === 'input' && (
          <form onSubmit={handleSendCode} className="mt-4 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Enter your corporate email or Employee ID. A security reset OTP token will be generated for identity verification.
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
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Send Reset Code
              </button>
            </div>
          </form>
        )}

        {step === 'sent' && (
          <form onSubmit={handleVerifyCode} className="mt-4 space-y-4">
            <div className="rounded-xl bg-blue-50 p-3.5 border border-blue-100 text-xs text-blue-900">
              Demo OTP Token dispatched to <strong>{email}</strong>: <span className="bg-blue-100 px-1.5 py-0.5 rounded font-bold">8421</span>
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
                placeholder="8421"
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
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Verify Code
              </button>
            </div>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleResetComplete} className="mt-4 space-y-4">
            {resetSuccess ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 animate-in fade-in">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>Password updated successfully! Redirecting to login...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Identity Verified. Set your new password:</span>
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
                  className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  Update Password & Return to Login
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
