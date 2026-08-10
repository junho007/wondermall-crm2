import React, { useState } from 'react';
import { X, Lock, KeyRound, ShieldCheck, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const getStoredPassword = () => localStorage.getItem('wm_dashboard_password') || 'gio988';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const currentPass = getStoredPassword();

    if (oldPassword !== currentPass) {
      setErrorMsg('Current password is incorrect. Please check and try again.');
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      setErrorMsg('New password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    // Save updated password in localStorage
    localStorage.setItem('wm_dashboard_password', newPassword);
    setSuccessMsg('Dashboard access password updated successfully!');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');

    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden transition-all ${
        isLight ? 'bg-white border-zinc-200 text-slate-900' : 'bg-[#141414] border-[#E9CE79]/40 text-zinc-100'
      }`}>
        {/* Modal Header */}
        <div className={`p-5 flex items-center justify-between border-b ${
          isLight ? 'bg-slate-50 border-zinc-200' : 'bg-[#1a1a1a] border-zinc-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-full bg-[#E9CE79]/20 text-[#a68212] border border-[#E9CE79]/40">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`font-black text-sm sm:text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Change Access Password
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Update security key for dashboard access
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isLight ? 'hover:bg-zinc-200 text-zinc-500' : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className={`block text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
              Current Password
            </label>
            <div className="relative">
              <input
                type={showOldPass ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password..."
                required
                className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl border text-xs font-medium focus:outline-none ${
                  isLight ? 'bg-slate-100 border-zinc-300 text-slate-900 focus:border-[#a68212]' : 'bg-[#1f1f1f] border-zinc-700 text-white focus:border-[#E9CE79]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowOldPass(!showOldPass)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-white cursor-pointer"
              >
                {showOldPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={`block text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 4 chars)..."
                required
                className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl border text-xs font-medium focus:outline-none ${
                  isLight ? 'bg-slate-100 border-zinc-300 text-slate-900 focus:border-[#a68212]' : 'bg-[#1f1f1f] border-zinc-700 text-white focus:border-[#E9CE79]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-white cursor-pointer"
              >
                {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={`block text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password..."
              required
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium focus:outline-none ${
                isLight ? 'bg-slate-100 border-zinc-300 text-slate-900 focus:border-[#a68212]' : 'bg-[#1f1f1f] border-zinc-700 text-white focus:border-[#E9CE79]'
              }`}
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isLight ? 'border-zinc-300 text-slate-700 hover:bg-slate-100' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-[#E9CE79] hover:bg-[#d8bd68] text-[#0e0e0e] text-xs font-extrabold uppercase tracking-wider shadow-md transition-all cursor-pointer"
            >
              Save Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
