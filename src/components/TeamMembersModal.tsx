import React, { useState, useEffect } from 'react';
import { X, Users, RefreshCw, Monitor, Clock, ShieldCheck, UserCheck, Award } from 'lucide-react';
import { UserRole } from '../types';

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
}

export const TeamMembersModal: React.FC<TeamMembersModalProps> = ({
  isOpen,
  onClose,
  theme = 'light',
  userRole = 'admin',
}) => {
  if (!isOpen) return null;
  const isLight = theme === 'light';

  const [sessions, setSessions] = useState<ColleagueSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const roleLabel =
    userRole === 'accountant'
      ? 'Accountant'
      : userRole === 'cs'
      ? 'CS & Marketing'
      : 'Admin / Manager';

  const roleBadgeStyle =
    userRole === 'accountant'
      ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
      : userRole === 'cs'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : 'bg-amber-100 text-amber-900 border-amber-300';

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
    fetchSessions();
  }, [isOpen]);

  const activeColleague = (typeof window !== 'undefined' && (sessionStorage.getItem('wm_colleague_name') || localStorage.getItem('wm_colleague_name'))) || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all flex flex-col max-h-[85vh] ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#121212] border-[#E9CE79]/30 text-zinc-100 shadow-[0_0_50px_rgba(233,206,121,0.1)]'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
            isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-[#181818] border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isLight ? 'bg-blue-50 border border-blue-200 text-blue-600' : 'bg-[#E9CE79]/20 border border-[#E9CE79]/40 text-[#a68212]'
            }`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`font-extrabold text-sm sm:text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Team Member Backend Sessions
              </h2>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Logged-in staff, active devices &amp; session history
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSessions}
              disabled={isLoading}
              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                isLight ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
              title="Refresh Team Sessions"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                isLight ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className={`p-3.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
            isLight ? 'bg-blue-50/60 border-blue-200 text-blue-900' : 'bg-[#E9CE79]/10 border-[#E9CE79]/30 text-[#E9CE79]'
          }`}>
            <span className="flex items-center gap-2 font-bold">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Current Session Staff ID: <strong className="text-blue-950 font-black">{activeColleague || 'Active Staff User'}</strong></span>
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${roleBadgeStyle}`}>
                <Award className="w-3 h-3" />
                <span>{roleLabel}</span>
              </span>
              <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Active Session
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
              Recent Staff Logins ({sessions.length})
            </h3>

            {isLoading && sessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 animate-pulse font-medium">
                Loading team member session logs...
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 italic border rounded-xl border-slate-200 border-dashed bg-slate-50/50">
                No external staff login records yet. Login history will appear here automatically when colleagues enter the dashboard.
              </div>
            ) : (
              sessions.map((sess) => {
                const isCurrent = sess.colleagueName === activeColleague;
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
                        ? isLight
                          ? 'bg-blue-50/40 border-blue-200 shadow-2xs'
                          : 'bg-[#E9CE79]/10 border-[#E9CE79]/40'
                        : isLight
                        ? 'bg-slate-50/70 border-slate-200 hover:bg-slate-50'
                        : 'bg-[#181818] border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className={`w-4 h-4 ${isCurrent ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className={`text-xs font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                          {sess.colleagueName}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                            You
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
                      <span className={`truncate text-[11px] ${isLight ? 'text-slate-600 font-semibold' : 'text-zinc-400'}`}>
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
        <div
          className={`px-6 py-3.5 border-t flex items-center justify-between shrink-0 ${
            isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-[#181818] border-zinc-800'
          }`}
        >
          <span className={`text-xs font-bold ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
            WonderMall Multi-User Access Audit Log
          </span>
          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-2 rounded-xl text-xs font-extrabold uppercase transition-all cursor-pointer shadow-xs ${
              isLight
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-[#E9CE79] text-[#0e0e0e] hover:bg-[#d8bd68]'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
