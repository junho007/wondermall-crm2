import React from 'react';
import { RefreshCw, User, ShieldCheck, Key, Clock, ShieldAlert, Award } from 'lucide-react';
import { UserRole } from '../types';

interface HeaderProps {
  activeTabTitle: string;
  onOpenTeamMembersModal?: () => void;
  onSyncData: () => void;
  isSyncing: boolean;
  lastSyncedTime: string;
  onOpenApiSettings?: () => void;
  userRole?: UserRole;
  onSwitchRole?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTabTitle,
  onOpenTeamMembersModal,
  onSyncData,
  isSyncing,
  lastSyncedTime,
  onOpenApiSettings,
  userRole = 'admin',
  onSwitchRole,
}) => {
  const colleagueName = (typeof window !== 'undefined' && (sessionStorage.getItem('wm_colleague_name') || localStorage.getItem('wm_colleague_name'))) || '';

  return (
    <header className="w-full bg-white border-b border-slate-100 px-4 sm:px-6 py-2.5 flex items-center justify-between">
      {/* Page Title & Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
          <span>WCG Digital Admin</span>
          <span>/</span>
          <span className="text-blue-600 font-bold">{activeTabTitle}</span>
        </div>
        <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-tight mt-0.5">
          {activeTabTitle}
        </h1>
      </div>

      {/* Header Right Actions */}
      <div className="flex items-center gap-2.5">
        {/* Logged in Staff Badge */}
        {colleagueName && (
          <button
            type="button"
            onClick={onOpenTeamMembersModal}
            className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs hover:scale-105"
            title={`Staff Member: ${colleagueName}`}
          >
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span className="truncate max-w-[120px]">{colleagueName}</span>
          </button>
        )}

        {/* Scheduled Auto-Sync Info */}
        <div className="hidden lg:flex flex-col items-end text-right">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-600" /> Auto-Sync: 8AM &amp; 8PM MYT
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Updated: {lastSyncedTime}</span>
        </div>

        {/* Prominent Top-Right Refresh Button */}
        <button
          type="button"
          onClick={onSyncData}
          disabled={isSyncing}
          className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          title="Refresh store orders from Shopee & Lazada APIs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>
    </header>
  );
};
