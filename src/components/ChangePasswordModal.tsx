import React, { useState, useEffect } from 'react';
import { X, Lock, ShieldCheck, Check, AlertCircle, Eye, EyeOff, KeyRound, Award, User } from 'lucide-react';
import { UserRole } from '../types';
import { getDepartmentPasswords, saveDepartmentPasswords, saveStaffPassword } from '../utils/maskHelper';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: UserRole;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  userRole = 'admin',
}) => {
  const [targetRole, setTargetRole] = useState<UserRole>(userRole);
  const [staffName, setStaffName] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setTargetRole(userRole);
    const activeColleague = (typeof window !== 'undefined' && (sessionStorage.getItem('wm_colleague_name') || localStorage.getItem('wm_colleague_name'))) || '';
    setStaffName(activeColleague || '');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [isOpen, userRole]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const allPasswords = getDepartmentPasswords();
    const currentPass = allPasswords[targetRole] || 'gio988';

    if (oldPassword !== currentPass && userRole !== 'admin') {
      setErrorMsg(`Current password for ${targetRole.toUpperCase()} is incorrect.`);
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

    // Save updated department password & individual staff password
    const updated = {
      ...allPasswords,
      [targetRole]: newPassword,
    };
    saveDepartmentPasswords(updated);

    if (staffName.trim()) {
      saveStaffPassword(staffName, targetRole, newPassword);
    }

    setSuccessMsg(`Access password for ${targetRole.toUpperCase()} department updated successfully!`);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');

    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 1500);
  };

  const getRoleLabel = (r: UserRole) => {
    switch (r) {
      case 'accountant':
        return 'Accountant';
      case 'cs':
        return 'Customer Service';
      case 'marketing':
        return 'Marketing Team';
      case 'admin':
      default:
        return 'Admin / Manager';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Change Access Password
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Update login credentials for department access
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer shrink-0"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Target Role Selector */}
          {userRole === 'admin' ? (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Select Department
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['admin', 'accountant', 'cs', 'marketing'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTargetRole(r)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2 cursor-pointer ${
                      targetRole === r
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{getRoleLabel(r)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Updating password for: <strong>{getRoleLabel(targetRole)}</strong></span>
            </div>
          )}

          {/* Staff Name Input Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-blue-600" /> Staff Name / Colleague Identifier
            </label>
            <input
              type="text"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="e.g. Grace, Boey, Gio..."
              required
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>
          {userRole !== 'admin' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showOldPass ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter current password..."
                  required
                  className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPass(!showOldPass)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* New Password Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 4 chars)..."
                required
                className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password..."
              required
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold uppercase tracking-wider shadow-xs transition-all cursor-pointer"
            >
              Save Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
