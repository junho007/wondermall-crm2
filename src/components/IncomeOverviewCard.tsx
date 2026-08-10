import React, { useState, useMemo } from 'react';
import { ShopeeOrder } from '../types';
import { calculateNetIncome } from '../utils/csvHelper';
import { Info, Clock, ChevronDown, ChevronUp, Wallet } from 'lucide-react';

interface IncomeOverviewCardProps {
  orders: ShopeeOrder[];
}

export const IncomeOverviewCard: React.FC<IncomeOverviewCardProps> = ({ orders }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Helper to get MYT Date strings
  const metrics = useMemo(() => {
    // Current time in MYT (UTC+8)
    const nowMs = Date.now() + 8 * 3600 * 1000;
    const nowMyt = new Date(nowMs);
    const currentYear = nowMyt.getUTCFullYear();
    const currentMonthStr = `${currentYear}-${String(nowMyt.getUTCMonth() + 1).padStart(2, '0')}`;

    // Get start of week (Monday) in MYT
    const dayOfWeek = nowMyt.getUTCDay(); // 0 is Sun, 1 is Mon
    const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeekMs = nowMs - daysToMon * 24 * 3600 * 1000;
    const startOfWeekDate = new Date(startOfWeekMs);
    const startOfWeekStr = `${startOfWeekDate.getUTCFullYear()}-${String(startOfWeekDate.getUTCMonth() + 1).padStart(2, '0')}-${String(startOfWeekDate.getUTCDate()).padStart(2, '0')}`;

    let pendingAmt = 0;
    let releasedThisWeek = 0;
    let releasedThisMonth = 0;
    let releasedTotal = 0;

    orders.forEach((o) => {
      const status = o.orderStatus;
      const netEscrow = calculateNetIncome(o);

      if (status === 'Cancelled') return;

      if (status === 'Completed') {
        releasedTotal += netEscrow;

        // Use deliveryTime / shipTime / orderDate for release date calculation
        const relDateStr = (o.deliveryTime || o.shipTime || o.orderDate || '').substring(0, 10);

        if (relDateStr) {
          if (relDateStr.startsWith(currentMonthStr)) {
            releasedThisMonth += netEscrow;
          }
          if (relDateStr >= startOfWeekStr) {
            releasedThisWeek += netEscrow;
          }
        }
      } else {
        // Unpaid or In Transit (Pending escrow held by Shopee)
        pendingAmt += netEscrow;
      }
    });

    return {
      pendingAmt,
      releasedThisWeek,
      releasedThisMonth,
      releasedTotal,
    };
  }, [orders]);

  const fmt = (num: number) => `RM ${num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden animate-fadeIn space-y-0">
      {/* Header Banner with Expand / Collapse Toggle */}
      <div className="bg-blue-50/90 border-b border-blue-100 px-4 py-2.5 text-xs text-blue-900 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-medium">
            <strong className="font-extrabold">Income Overview:</strong> No adjustment will be included in the numbers below. Download income report for adjustment details.
          </span>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-blue-800 border border-blue-200 text-xs font-bold transition-all cursor-pointer shadow-2xs ml-auto"
        >
          <Wallet className="w-3.5 h-3.5 text-blue-600" />
          <span>{isExpanded ? 'Hide Income Overview' : 'Show Income Overview'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />}
        </button>
      </div>

      {/* Overview Numbers Grid (Collapsible) */}
      {isExpanded && (
        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-6 items-center animate-fadeIn">
          {/* Pending Card (Left Side) */}
          <div className="md:col-span-5 border-r-0 md:border-r border-slate-200 pr-0 md:pr-6 space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending (Escrow Unreleased)</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight pt-1">
              {fmt(metrics.pendingAmt)}
            </div>
            <p className="text-[11px] text-slate-400 font-medium pt-0.5">
              Escrow held by Shopee awaiting buyer order completion &amp; payout release
            </p>
          </div>

          {/* Released Cards (Right Side) */}
          <div className="md:col-span-7 grid grid-cols-3 gap-3">
            {/* Released This Week */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider block">This Week</span>
              <span className="text-sm sm:text-base font-black text-emerald-700 font-mono block">
                {fmt(metrics.releasedThisWeek)}
              </span>
            </div>

            {/* Released This Month */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider block">This Month</span>
              <span className="text-sm sm:text-base font-black text-emerald-700 font-mono block">
                {fmt(metrics.releasedThisMonth)}
              </span>
            </div>

            {/* Total Released */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider block">Total Released</span>
              <span className="text-sm sm:text-base font-black text-slate-900 font-mono block">
                {fmt(metrics.releasedTotal)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
