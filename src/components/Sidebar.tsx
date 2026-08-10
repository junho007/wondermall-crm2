import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Wallet,
  Settings,
  Trophy,
  PanelLeftClose,
  PanelLeftOpen,
  Lock,
  Type,
  User,
  MessageSquare,
} from 'lucide-react';
import { WonderMallLogo } from './WonderMallLogo';

import { UserRole } from '../types';

export type ActiveTab = 'overview' | 'orders' | 'customers' | 'topRankings' | 'financial' | 'sms' | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  ordersCount: number;
  customersCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onLockDashboard: () => void;
  onOpenTeamMembersModal?: () => void;
  fontSizeScale: 'normal' | 'large' | 'xlarge';
  setFontSizeScale: (scale: 'normal' | 'large' | 'xlarge') => void;
  userRole?: UserRole;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  ordersCount,
  customersCount,
  isCollapsed,
  onToggleCollapse,
  onLockDashboard,
  onOpenTeamMembersModal,
  fontSizeScale,
  setFontSizeScale,
  userRole = 'admin',
}) => {
  const allNavItems = [
    {
      id: 'overview' as ActiveTab,
      label: 'Store Overview',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'topRankings' as ActiveTab,
      label: 'Top Rankings & Analytics',
      icon: Trophy,
      badge: 'TOP',
    },
    {
      id: 'customers' as ActiveTab,
      label: 'Customer Directory',
      icon: Users,
      badge: customersCount > 0 ? customersCount.toLocaleString() : null,
    },
    {
      id: 'orders' as ActiveTab,
      label: 'Order Management',
      icon: ShoppingCart,
      badge: ordersCount > 0 ? ordersCount.toLocaleString() : null,
    },
    {
      id: 'financial' as ActiveTab,
      label: 'Financial & Escrow',
      icon: Wallet,
      badge: null,
    },
    {
      id: 'sms' as ActiveTab,
      label: 'SMS & WhatsApp Marketing',
      icon: MessageSquare,
      badge: 'HOT',
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Settings & System Tools',
      icon: Settings,
      badge: null,
    },
  ];

  // Role-Based Filtering
  // Accountant: Hide SMS Marketing, Top Ranking, Customer Directory
  // CS: Hide Financial
  // Admin: Full access
  const navItems = allNavItems.filter((item) => {
    if (userRole === 'accountant') {
      if (['sms', 'topRankings', 'customers'].includes(item.id)) return false;
    } else if (userRole === 'cs') {
      if (item.id === 'financial') return false;
    }
    return true;
  });

  return (
    <aside
      className={`bg-[#1e293b] text-slate-100 flex flex-col shrink-0 h-screen fixed top-0 left-0 select-none shadow-xl transition-all duration-300 z-30 overflow-hidden ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand & Logo Header with Collapse Toggle - Clean & Unblocked */}
      <div className="h-14 px-3 border-b border-slate-700/60 bg-[#0f172a]/40 flex items-center justify-between shrink-0 overflow-hidden">
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-2.5 shrink-0">
              <WonderMallLogo size="sm" />
            </div>

            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Collapse Sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="w-full flex items-center justify-center">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white transition-colors cursor-pointer"
              title="Expand Sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation Menu Links */}
      <nav className="flex-1 px-3 py-4 space-y-3.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div key={item.id} className="relative group">
              <button
                onClick={() => setActiveTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-3.5 py-3'
                } rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white hover:scale-102'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!isCollapsed && item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      item.id === 'topRankings'
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : isActive
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>

              {/* Floating Tooltip Hover Effect when Minimized */}
              {isCollapsed && (
                <div className="fixed left-16 mt-[-30px] ml-3 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold whitespace-nowrap shadow-xl border border-slate-700 pointer-events-none opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 z-50 flex items-center gap-2">
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-blue-600 text-white uppercase">
                      {item.badge}
                    </span>
                  )}
                  {/* Tooltip Arrow */}
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900 border-l border-b border-slate-700 rotate-45" />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Footer Options (Team Member Sessions / Lock Screen) */}
      <div className="p-2 border-t border-slate-700/60 bg-[#0f172a]/60 shrink-0 overflow-hidden">
        {/* Bottom Row: Team Member Sessions & Lock Dashboard */}
        <div className={`flex items-center gap-1.5 ${isCollapsed ? 'flex-col' : 'flex-row'}`}>
          {onOpenTeamMembersModal && (
            <button
              type="button"
              onClick={onOpenTeamMembersModal}
              title="Team Member Sessions"
              className={`w-full flex items-center justify-center ${
                isCollapsed ? 'py-1.5 px-0' : 'flex-1 gap-1.5 py-1.5 px-2'
              } rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer`}
            >
              <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              {!isCollapsed && <span className="truncate">Staff Sessions</span>}
            </button>
          )}

          <button
            type="button"
            onClick={onLockDashboard}
            title="Lock Dashboard"
            className={`w-full flex items-center justify-center ${
              isCollapsed ? 'py-1.5 px-0' : 'flex-1 gap-1.5 py-1.5 px-2'
            } rounded-md bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold border border-rose-800/40 transition-colors cursor-pointer`}
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span className="truncate">Lock</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};
