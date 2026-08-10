import React from 'react';
import { Trophy, Award, Crown, Medal, Flame } from 'lucide-react';
import { ShopeeOrder } from '../types';

interface AnalyticsPanelProps {
  orders: ShopeeOrder[];
  theme?: 'dark' | 'light';
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ orders, theme = 'dark' }) => {
  if (!orders || orders.length === 0) return null;
  const isLight = theme === 'light';

  // Compute Top Products
  const productStats: Record<string, { count: number; total: number }> = {};
  orders.forEach((o) => {
    const name = o.productName.trim();
    if (!productStats[name]) {
      productStats[name] = { count: 0, total: 0 };
    }
    productStats[name].count += o.quantity || 1;
    productStats[name].total += o.totalAmount || 0;
  });

  const topProducts = Object.entries(productStats)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Compute Top Spenders (Buyers)
  const buyerStats: Record<string, { count: number; total: number }> = {};
  orders.forEach((o) => {
    const buyer = o.buyerUsername.trim();
    if (!buyerStats[buyer]) {
      buyerStats[buyer] = { count: 0, total: 0 };
    }
    buyerStats[buyer].count += 1;
    buyerStats[buyer].total += o.totalAmount || 0;
  });

  const topBuyers = Object.entries(buyerStats)
    .map(([username, data]) => ({ username, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Helper function to return rank privilege styles and icons
  const getRankConfig = (rankIndex: number) => {
    if (isLight) {
      switch (rankIndex) {
        case 0:
          return {
            cardStyle: 'bg-amber-50/90 border-amber-300 text-slate-900',
            badgeStyle: 'bg-amber-400 text-slate-950 font-black border border-amber-300',
            titleStyle: 'text-slate-900 font-extrabold',
            amountStyle: 'text-[#9e7a0e] font-black text-sm sm:text-base',
            icon: <Crown className="w-3.5 h-3.5 text-slate-950" />,
            rankLabel: '#1',
          };
        case 1:
          return {
            cardStyle: 'bg-slate-50 border-slate-300',
            badgeStyle: 'bg-slate-300 text-slate-950 font-black border border-slate-200',
            titleStyle: 'text-slate-900 font-bold',
            amountStyle: 'text-slate-800 font-bold text-sm sm:text-base',
            icon: <Medal className="w-3.5 h-3.5 text-slate-950" />,
            rankLabel: '#2',
          };
        case 2:
          return {
            cardStyle: 'bg-amber-50/50 border-amber-200',
            badgeStyle: 'bg-amber-600 text-amber-50 font-black border border-amber-500',
            titleStyle: 'text-slate-900 font-bold',
            amountStyle: 'text-[#9e7a0e] font-bold text-sm sm:text-base',
            icon: <Medal className="w-3.5 h-3.5 text-amber-50" />,
            rankLabel: '#3',
          };
        case 3:
          return {
            cardStyle: 'bg-sky-50/80 border-sky-300',
            badgeStyle: 'bg-sky-500 text-white font-black border border-sky-400',
            titleStyle: 'text-slate-900 font-bold',
            amountStyle: 'text-sky-800 font-bold text-sm sm:text-base',
            icon: <Flame className="w-3.5 h-3.5 text-white" />,
            rankLabel: '#4',
          };
        case 4:
        default:
          return {
            cardStyle: 'bg-slate-50/60 border-zinc-200',
            badgeStyle: 'bg-zinc-300 text-zinc-800 font-bold border border-zinc-200',
            titleStyle: 'text-slate-800 font-semibold',
            amountStyle: 'text-slate-800 font-bold text-sm sm:text-base',
            icon: null,
            rankLabel: '#5',
          };
      }
    }

    switch (rankIndex) {
      case 0: // Rank #1 - Gold Privilege
        return {
          cardStyle: 'bg-amber-950/40 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10',
          badgeStyle: 'bg-amber-400 text-[#0e0e0e] font-black border border-amber-300 shadow-sm',
          titleStyle: 'text-amber-200 font-extrabold',
          amountStyle: 'text-amber-300 font-black text-sm sm:text-base',
          icon: <Crown className="w-3.5 h-3.5 text-[#0e0e0e]" />,
          rankLabel: '#1',
        };
      case 1: // Rank #2 - Silver Privilege
        return {
          cardStyle: 'bg-slate-800/60 border-slate-300/60 shadow-sm',
          badgeStyle: 'bg-slate-200 text-[#0e0e0e] font-black border border-slate-100',
          titleStyle: 'text-slate-100 font-bold',
          amountStyle: 'text-slate-200 font-bold text-sm sm:text-base',
          icon: <Medal className="w-3.5 h-3.5 text-[#0e0e0e]" />,
          rankLabel: '#2',
        };
      case 2: // Rank #3 - Bronze Privilege
        return {
          cardStyle: 'bg-amber-950/30 border-amber-700/70',
          badgeStyle: 'bg-amber-700 text-amber-100 font-black border border-amber-600',
          titleStyle: 'text-amber-200/90 font-bold',
          amountStyle: 'text-amber-300 font-bold text-sm sm:text-base',
          icon: <Medal className="w-3.5 h-3.5 text-amber-100" />,
          rankLabel: '#3',
        };
      case 3: // Rank #4 - Blue Privilege
        return {
          cardStyle: 'bg-sky-950/50 border-sky-500/40',
          badgeStyle: 'bg-sky-500 text-slate-950 font-black border border-sky-400',
          titleStyle: 'text-sky-200 font-bold',
          amountStyle: 'text-sky-300 font-bold text-sm sm:text-base',
          icon: <Flame className="w-3.5 h-3.5 text-slate-950" />,
          rankLabel: '#4',
        };
      case 4: // Rank #5 - Standard Tier
      default:
        return {
          cardStyle: 'bg-zinc-900/60 border-zinc-800/80',
          badgeStyle: 'bg-zinc-700 text-zinc-200 font-bold border border-zinc-600',
          titleStyle: 'text-zinc-300 font-semibold',
          amountStyle: 'text-zinc-300 font-bold text-sm sm:text-base',
          icon: null,
          rankLabel: '#5',
        };
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
      {/* Top Performing Game Top-Ups & Vouchers Card */}
      <div className={`rounded-2xl p-4 sm:p-5 space-y-3.5 border ${
        isLight ? 'bg-white border-zinc-200 text-slate-900' : 'glass-card border-[#E9CE79]/20 text-zinc-100 shadow-xl'
      }`}>
        <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-zinc-200' : 'border-zinc-800'}`}>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#E9CE79]" />
            <h3 className={`text-xs sm:text-sm font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Top Selling Digital Products
            </h3>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
            isLight
              ? 'text-[#7a5e0b] bg-amber-100 border-amber-300'
              : 'text-[#E9CE79] bg-[#E9CE79]/15 border-[#E9CE79]/30'
          }`}>
            Top Selling Vouchers &amp; Games
          </span>
        </div>

        <div className="space-y-2.5">
          {topProducts.map((prod, idx) => {
            const rank = getRankConfig(idx);

            return (
              <div
                key={prod.name}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm transition-all ${rank.cardStyle}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shrink-0 ${rank.badgeStyle}`}>
                    {rank.icon}
                    <span>{rank.rankLabel}</span>
                  </span>
                  <span className={`truncate ${rank.titleStyle}`}>{prod.name}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className={rank.amountStyle}>
                    RM {prod.total.toFixed(2)}
                  </div>
                  <div className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>{prod.count} Order(s)</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Customer Spenders Leaderboard Card */}
      <div className={`rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5 border ${
        isLight ? 'bg-white border-zinc-200 text-slate-900' : 'glass-card border-[#E9CE79]/20 text-zinc-100'
      }`}>
        <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-zinc-200' : 'border-zinc-800'}`}>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#E9CE79]" />
            <h3 className={`text-xs sm:text-sm font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Top Customer Spenders
            </h3>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
            isLight
              ? 'text-[#7a5e0b] bg-amber-100 border-amber-300'
              : 'text-[#E9CE79] bg-[#E9CE79]/15 border-[#E9CE79]/30'
          }`}>
            Buyer Leaderboard
          </span>
        </div>

        <div className="space-y-2.5">
          {topBuyers.map((buyer, idx) => {
            const rank = getRankConfig(idx);

            return (
              <div
                key={buyer.username}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm transition-all ${rank.cardStyle}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shrink-0 ${rank.badgeStyle}`}>
                    {rank.icon}
                    <span>{rank.rankLabel}</span>
                  </span>
                  <span className={`truncate ${rank.titleStyle}`}>
                    {buyer.username}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className={rank.amountStyle}>
                    RM {buyer.total.toFixed(2)}
                  </div>
                  <div className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>{buyer.count} Checkout(s)</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

