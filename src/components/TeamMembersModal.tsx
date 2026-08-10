import React, { useState, useEffect } from 'react';
import { X, Users, RefreshCw, Monitor, Clock, ShieldCheck, UserCheck, Award, KeyRound, Eye, EyeOff, Trash2, RotateCcw, User, UserPlus } from 'lucide-react';
import { UserRole } from '../types';
import {
  getDepartmentPasswords,
  saveDepartmentPasswords,
  DEFAULT_DEPARTMENT_PASSWORDS,
  getStaffPasswords,
  deleteStaffPassword,
  StaffPasswordEntry
} from '../utils/maskHelper';

interface ColleagueSession {
  id: string;
  colleagueName: string;
  deviceInfo: string;
  loginTime: string;
}

interface TeamMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
  userRole?: UserRole;
  onOpenChangePassword?: () => void;
}

export const TeamMembersModal: React.FC<TeamMembersModalProps> = ({
  isOpen,
  onClose,
  theme = 'light',
  userRole = 'admin',
  onOpenChangePassword,
}) => {
  const [sessions, setSessions] = useState<ColleagueSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deptPasswords, setDeptPasswords] = useState<Record<UserRole, string>>(() => getDepartmentPasswords());
  const [staffPasswords, setStaffPasswords] = useState<StaffPasswordEntry[]>([]);
  const [showPass, setShowPass] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/colleagues');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.warn('Failed to fetch team sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
      setDeptPasswords(getDepartmentPasswords());
      setStaffPasswords(getStaffPasswords());
    }
  }, [isOpen]);

  const handleDeleteStaffPass = (id: string) => {
    deleteStaffPassword(id);
    setStaffPasswords(getStaffPasswords());
  };

  if (!isOpen) return null;
  const isLight = theme === 'light';

  const roleLabel =
    userRole === 'accountant'
      ? 'Accountant'
      : userRole === 'cs'
      ? 'Customer Service'
      : userRole === 'marketing'
      ? 'Marketing Team'
      : 'Admin / Manager';

  const roleBadgeStyle =
    userRole === 'accountant'
      ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
      : userRole === 'cs'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : userRole === 'marketing'
      ? 'bg-purple-100 text-purple-800 border-purple-300'
      : 'bg-amber-100 text-amber-900 border-amber-300';

  const activeColleague = (typeof window !== 'undefined' && (sessionStorage.getItem('wm_colleague_name') || localStorage.getItem('wm_colleague_name'))) || '';

  const handleResetRolePassword = (r: UserRole) => {
    const updated = {
      ...deptPasswords,
      [r]: DEFAULT_DEPARTMENT_PASSWORDS[r],
    };
    saveDepartmentPasswords(updated);
    setDeptPasswords(updated);
    setResetNotice(`Password for ${r.toUpperCase()} reset to default (${DEFAULT_DEPARTMENT_PASSWORDS[r]})`);
    setTimeout(() => setResetNotice(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900">
                Team Access &amp; Active Staff Sessions
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Logged-in staff, device signatures, and access control settings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSessions}
              disabled={isLoading}
              className="p-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
              title="Refresh Team Sessions"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer shrink-0"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Active Session Overview Card */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-bold text-blue-900">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Active Colleague: <strong className="text-blue-950 font-black">{activeColleague || 'Active Staff Member'}</strong></span>
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${roleBadgeStyle}`}>
                <Award className="w-3 h-3" />
                <span>{roleLabel}</span>
              </span>
              <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Online Session
              </span>
            </div>
          </div>

          {/* ADMIN DEPARTMENT PASSWORDS MANAGEMENT & SECURITY RECOVERY */}
          {userRole === 'admin' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                  <span>Department Access Passwords (Admin Control)</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {showPass ? <EyeOff className="w-3.5 h-3.5 text-blue-600" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{showPass ? 'Hide Keys' : 'View Passwords'}</span>
                </button>
              </div>

              {resetNotice && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  {resetNotice}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {(['admin', 'accountant', 'cs', 'marketing'] as UserRole[]).map((r) => {
                  const passVal = deptPasswords[r] || DEFAULT_DEPARTMENT_PASSWORDS[r];
                  const title =
                    r === 'admin'
                      ? 'Admin / Manager'
                      : r === 'accountant'
                      ? 'Accountant'
                      : r === 'cs'
                      ? 'Customer Service'
                      : 'Marketing Team';

                  return (
                    <div key={r} className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-extrabold text-slate-400 block">{title}</span>
                        <span className="font-mono font-bold text-slate-900">
                          {showPass ? passVal : '••••••••'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleResetRolePassword(r)}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold border border-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Reset password to default key"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Individual Staff Member Credentials */}
              <div className="pt-3 border-t border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>Individual Staff Member Passwords ({staffPasswords.length})</span>
                  </span>
                </div>

                {staffPasswords.length === 0 ? (
                  <div className="p-3 rounded-lg bg-white border border-slate-200 text-center text-xs text-slate-400 italic">
                    No individual staff password overrides set yet. Staff can set custom passwords in Change Password.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {staffPasswords.map((sp) => (
                      <div key={sp.id} className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                            {sp.staffName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 truncate">{sp.staffName}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-200">
                                {sp.role}
                              </span>
                            </div>
                            <span className="font-mono font-bold text-slate-600 text-[11px] block">
                              {showPass ? sp.password : '••••••••'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteStaffPass(sp.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove custom staff password"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Change My Password Action Button */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-100/80 border border-slate-200">
            <div>
              <span className="text-xs font-extrabold text-slate-900 block">Manage My Password</span>
              <span className="text-[11px] text-slate-500 font-medium">Update your current department access key</span>
            </div>
            {onOpenChangePassword && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenChangePassword();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Change Password</span>
              </button>
            )}
          </div>

          {/* Staff Sessions Log List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Recent Staff Logins &amp; Devices ({sessions.length})
            </h3>

            {isLoading && sessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 animate-pulse font-medium">
                Loading team member session records...
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 italic border rounded-xl border-slate-200 border-dashed bg-slate-50">
                No external staff login records yet. Records appear when colleagues login to the dashboard.
              </div>
            ) : (
              sessions.map((sess) => {
                const isCurrent = sess.colleagueName.includes(activeColleague);
                const formattedTime = new Date(sess.loginTime).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <div
                    key={sess.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col gap-2 ${
                      isCurrent
                        ? 'bg-blue-50/50 border-blue-200 shadow-2xs'
                        : 'bg-slate-50/70 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className={`w-4 h-4 ${isCurrent ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className="text-xs font-extrabold text-slate-900">
                          {sess.colleagueName}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 font-medium">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{formattedTime}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono pl-6">
                      <Monitor className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate text-[11px] text-slate-600 font-semibold">
                        {sess.deviceInfo}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-slate-500">
            WonderMall Multi-Department Access System
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-extrabold uppercase transition-all cursor-pointer shadow-xs bg-blue-600 text-white hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
