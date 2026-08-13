import React from 'react';
import {
  RefreshCw,
  User,
  LayoutDashboard,
  ShoppingCart,
  Users,
  Wallet,
  Settings,
  Trophy,
  MessageSquare,
} from 'lucide-react';
import { UserRole } from '../types';
import { ActiveTab } from './Sidebar';

interface HeaderProps {
  activeTab: ActiveTab;
  activeTabTitle: string;
  onOpenTeamMembersModal?: () => void;
  onSyncData: () => void;
  isSyncing: boolean;
  lastSyncedTime: string;
  onOpenApiSettings?: () => void;
  userRole?: UserRole;
  onSwitchRole?: () => void;
}

const tabIcons: Record<ActiveTab, React.ElementType> = {
  overview: LayoutDashboard,
  orders: ShoppingCart,
  customers: Users,
  topRankings: Trophy,
  financial: Wallet,
  sms: MessageSquare,
  settings: Settings,
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
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
  const IconComponent = tabIcons[activeTab] || LayoutDashboard;

  return (
    <header className="w-full bg-white border-b border-slate-100 px-4 sm:px-6 py-2.5 flex items-center justify-between">
      {/* Active Tab Icon & Title (Clean Header) */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100/80 flex items-center justify-center shrink-0">
          <IconComponent className="w-5 h-5 text-blue-600" />
        </div>
        <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight leading-tight">
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

        {/* Last Synced Time Info */}
        <div className="hidden lg:flex flex-col items-end text-right">
          <span className="text-[11px] font-semibold text-slate-500">
            Updated: <span className="text-slate-700 font-mono font-bold">{lastSyncedTime}</span>
          </span>
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
