import React, { useState, useEffect, useRef } from 'react';
import { Lock, KeyRound, ShieldCheck, Eye, EyeOff, ArrowRight, AlertCircle, Settings, Check, User, Monitor, ChevronDown } from 'lucide-react';
import { WonderMallLogo } from './WonderMallLogo';

export const STAFF_COLLEAGUES = ['Gio', 'Billy', 'Grace', 'Fennie', 'Junaidah', 'Boey', 'Jun'];

interface PasswordGateProps {
  onAuthenticated: () => void;
  theme?: 'dark' | 'light';
}

function getDeviceSignature() {
  if (typeof window === 'undefined') {
    return { deviceName: 'Workstation Device', os: 'Desktop', browser: 'Browser' };
  }
  const ua = navigator.userAgent;
  let os = 'Workstation';
  if (ua.includes('Win')) os = 'Windows PC';
  else if (ua.includes('Mac')) os = 'Mac Workstation';
  else if (ua.includes('Android')) os = 'Android Device';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS Device';
  else if (ua.includes('Linux')) os = 'Linux Terminal';

  let browser = 'Browser';
  if (ua.includes('Edg/')) browser = 'MS Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Firefox';

  const screenRes = `${window.screen.width}x${window.screen.height}`;
  return {
    deviceName: `${os} • ${browser} (${screenRes})`,
    os,
    browser,
  };
}

export const PasswordGate: React.FC<PasswordGateProps> = ({ onAuthenticated, theme = 'dark' }) => {
  const isLight = theme === 'light';

  // Get stored custom password or default to 'gio988'
  const getStoredPassword = () => localStorage.getItem('wm_dashboard_password') || 'gio988';

  const [colleagueName, setColleagueName] = useState(() => {
    const saved = localStorage.getItem('wm_colleague_name');
    if (saved && STAFF_COLLEAGUES.includes(saved)) return saved;
    return STAFF_COLLEAGUES[0];
  });
  const [isColleagueDropdownOpen, setIsColleagueDropdownOpen] = useState(false);
  const colleagueDropdownRef = useRef<HTMLDivElement>(null);

  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [deviceSig, setDeviceSig] = useState({ deviceName: '', os: '', browser: '' });

  // Custom password change state
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [oldPassInput, setOldPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [changePassSuccess, setChangePassSuccess] = useState(false);
  const [changePassError, setChangePassError] = useState<string | null>(null);

  useEffect(() => {
    setDeviceSig(getDeviceSignature());

    const handleClickOutside = (event: MouseEvent) => {
      if (colleagueDropdownRef.current && !colleagueDropdownRef.current.contains(event.target as Node)) {
        setIsColleagueDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const adminPassword = getStoredPassword(); // default 'gio988'
    const trimmedInput = inputPassword.trim();

    let authenticatedRole: 'admin' | 'accountant' | 'cs' | null = null;
    let roleTitle = '';

    if (trimmedInput === adminPassword || trimmedInput === 'gio988') {
      authenticatedRole = 'admin';
      roleTitle = 'Admin / Manager';
    } else if (trimmedInput === 'acc988') {
      authenticatedRole = 'accountant';
      roleTitle = 'Accountant';
    } else if (trimmedInput === 'cs988') {
      authenticatedRole = 'cs';
      roleTitle = 'Customer Service & Marketing';
    }

    if (authenticatedRole) {
      setIsSuccess(true);
      setErrorMsg(null);

      const finalColleagueName = colleagueName.trim() || 'Team Colleague';
      localStorage.setItem('wm_colleague_name', finalColleagueName);
      sessionStorage.setItem('wm_colleague_name', finalColleagueName);

      localStorage.setItem('wm_user_role', authenticatedRole);
      sessionStorage.setItem('wm_user_role', authenticatedRole);

      localStorage.setItem('wm_device_info', deviceSig.deviceName);
      sessionStorage.setItem('wm_device_info', deviceSig.deviceName);

      sessionStorage.setItem('wm_dashboard_authenticated', 'true');

      // Post colleague session log to backend server so team members are recorded
      fetch('/api/colleagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colleagueName: `${finalColleagueName} (${roleTitle})`,
          deviceInfo: deviceSig.deviceName,
        }),
      }).catch((err) => console.warn('Colleague session logging warning:', err));

      setTimeout(() => {
        onAuthenticated();
      }, 400);
    } else {
      setErrorMsg('Incorrect access password for Admin, Accountant, or CS staff.');
      setInputPassword('');
    }
  };

  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError(null);
    setChangePassSuccess(false);

    const currentPass = getStoredPassword();

    if (oldPassInput !== currentPass) {
      setChangePassError('Current password is incorrect.');
      return;
    }

    if (!newPassInput || newPassInput.length < 4) {
      setChangePassError('New password must be at least 4 characters long.');
      return;
    }

    if (newPassInput !== confirmPassInput) {
      setChangePassError('New password and confirmation do not match.');
      return;
    }

    // Save new custom password
    localStorage.setItem('wm_dashboard_password', newPassInput);
    setChangePassSuccess(true);
    setOldPassInput('');
    setNewPassInput('');
    setConfirmPassInput('');

    setTimeout(() => {
      setIsChangingPass(false);
      setChangePassSuccess(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-all duration-300 bg-slate-950/80 backdrop-blur-md">
      {/* Glow effect background container */}
      <div className="absolute w-80 h-80 sm:w-96 sm:h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />

      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden transition-all duration-300">
        {/* Top Header Section */}
        <div className="p-6 sm:p-8 text-center border-b border-slate-800 bg-slate-900/60 relative">
          <div className="flex justify-center mb-3">
            <WonderMallLogo size="lg" />
          </div>

          <p className="text-xs sm:text-sm font-semibold mt-2 text-slate-400">
            Secure Analytics &amp; E-Commerce Management Portal
          </p>

          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Lock className="w-3.5 h-3.5" />
            Protected Dashboard Access
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {!isChangingPass ? (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Colleague Identification Fill Input Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300">
                  Colleague Name / Staff ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4 text-blue-400" />
                  </div>
                  <input
                    type="text"
                    value={colleagueName}
                    onChange={(e) => setColleagueName(e.target.value)}
                    placeholder="Enter staff ID / name..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/90 text-white text-xs font-extrabold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500 transition-all shadow-inner"
                  />
                </div>
              </div>


              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300">
                  Enter Access Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4 text-blue-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={inputPassword}
                    onChange={(e) => {
                      setInputPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Enter dashboard password..."
                    autoFocus
                    required
                    className={`w-full pl-10 pr-10 py-2.5 rounded-xl border text-xs font-semibold transition-all focus:outline-none ${
                      errorMsg
                        ? 'border-rose-500 bg-rose-500/10 text-rose-200'
                        : 'border-slate-700 bg-slate-800/80 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Device Detection Info Badge */}
              {deviceSig.deviceName && (
                <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-800/50 text-slate-400 flex items-center gap-2 text-[11px] font-mono">
                  <Monitor className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">Device: <strong className="text-slate-300">{deviceSig.deviceName}</strong></span>
                </div>
              )}

              {/* Error Alert */}
              {errorMsg && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Success Notification */}
              {isSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold animate-pulse">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Welcome {colleagueName || 'Colleague'}! Unlocking dashboard...</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSuccess}
                className={`w-full py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] ${
                  isSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 hover:shadow-blue-500/40'
                }`}
              >
                <span>Unlock Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* Change Password Form */
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <Settings className="w-4 h-4" />
                  Update Access Password
                </span>
                <button
                  type="button"
                  onClick={() => setIsChangingPass(false)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer font-bold"
                >
                  Back to Login
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-400">Current Password</label>
                <input
                  type="password"
                  value={oldPassInput}
                  onChange={(e) => setOldPassInput(e.target.value)}
                  placeholder="Enter current password..."
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-400">New Password</label>
                <input
                  type="password"
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  placeholder="Enter new password (min 4 chars)..."
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-400">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassInput}
                  onChange={(e) => setConfirmPassInput(e.target.value)}
                  placeholder="Confirm new password..."
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              {changePassError && (
                <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                  {changePassError}
                </div>
              )}

              {changePassSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Password changed successfully!</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangingPass(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-extrabold uppercase hover:bg-blue-500 cursor-pointer"
                >
                  Save Password
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
