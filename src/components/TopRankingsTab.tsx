import React, { useMemo, useState } from 'react';
import { Trophy, Crown, Flame, Award, ShoppingBag, UserCheck, MapPin, Search, TrendingUp, Sparkles, Filter } from 'lucide-react';
import { ShopeeOrder, UserRole } from '../types';
import { getStateFromAddress } from '../utils/addressHelper';
import { inferBuyerRace } from '../utils/raceHelper';
import { maskCustomerName, maskUsername, maskPhone, maskPrice } from '../utils/maskHelper';

interface TopRankingsTabProps {
  orders: ShopeeOrder[];
  userRole?: UserRole;
}

export const TopRankingsTab: React.FC<TopRankingsTabProps> = ({ orders, userRole = 'admin' }) => {
  // Top Products Aggregation
  const topProducts = useMemo(() => {
    const map = new Map<string, { productName: string; units: number; gmv: number; completedCount: number }>();

    orders.forEach((o) => {
      if (o.orderStatus === 'Cancelled') return;
      const key = o.productName.trim();
      const existing = map.get(key) || { productName: key, units: 0, gmv: 0, completedCount: 0 };
      const qty = o.quantity || 1;
      const amt = o.totalAmount || 0;

      map.set(key, {
        productName: key,
        units: existing.units + qty,
        gmv: existing.gmv + amt,
        completedCount: existing.completedCount + (o.orderStatus === 'Completed' ? 1 : 0),
      });
    });

    const list = Array.from(map.values());
    list.sort((a, b) => b.gmv - a.gmv);
    return list.slice(0, 5); // Strictly Top 5
  }, [orders]);

  const totalStoreGMV = useMemo(() => {
    return orders.filter((o) => o.orderStatus !== 'Cancelled').reduce((acc, o) => acc + (o.totalAmount || 0), 0);
  }, [orders]);

  // Top Customer Spenders Aggregation
  const topSpenders = useMemo(() => {
    const map = new Map<
      string,
      {
        username: string;
        buyerName: string;
        totalSpent: number;
        completedSpent: number;
        orderCount: number;
        state: string;
        race: string;
        phone: string;
      }
    >();

    orders.forEach((o) => {
      if (o.orderStatus === 'Cancelled') return;
      const username = (o.buyerUsername || 'Customer').trim();
      const key = username.toLowerCase();
      const existing = map.get(key) || {
        username: o.buyerUsername,
        buyerName: o.buyerName || o.recipientName || o.buyerUsername,
        totalSpent: 0,
        completedSpent: 0,
        orderCount: 0,
        state: getStateFromAddress(o.shippingAddress),
        race: inferBuyerRace(o),
        phone: o.buyerPhone || o.recipientPhone || 'N/A',
      };

      const amt = o.totalAmount || 0;
      const isCompleted = o.orderStatus === 'Completed';

      map.set(key, {
        ...existing,
        buyerName: o.buyerName || o.recipientName || existing.buyerName,
        totalSpent: existing.totalSpent + amt,
        completedSpent: existing.completedSpent + (isCompleted ? amt : 0),
        orderCount: existing.orderCount + 1,
        state: existing.state !== 'Other' ? existing.state : getStateFromAddress(o.shippingAddress),
      });
    });

    const list = Array.from(map.values());
    list.sort((a, b) => b.totalSpent - a.totalSpent);
    return list.slice(0, 5); // Strictly Top 5
  }, [orders]);

  // Top Frequent Buyers (Sorted strictly by Order Count descending - Strictly Top 5)
  const topFrequentBuyers = useMemo(() => {
    const map = new Map<
      string,
      {
        username: string;
        buyerName: string;
        totalSpent: number;
        orderCount: number;
        state: string;
      }
    >();

    orders.forEach((o) => {
      if (o.orderStatus === 'Cancelled') return;
      const username = (o.buyerUsername || 'Customer').trim();
      const key = username.toLowerCase();
      const existing = map.get(key) || {
        username: o.buyerUsername,
        buyerName: o.buyerName || o.recipientName || o.buyerUsername,
        totalSpent: 0,
        orderCount: 0,
        state: getStateFromAddress(o.shippingAddress),
      };

      map.set(key, {
        ...existing,
        totalSpent: existing.totalSpent + (o.totalAmount || 0),
        orderCount: existing.orderCount + 1,
        state: existing.state !== 'Other' ? existing.state : getStateFromAddress(o.shippingAddress),
      });
    });

    const list = Array.from(map.values());
    list.sort((a, b) => b.orderCount - a.orderCount || b.totalSpent - a.totalSpent);
    return list.slice(0, 5); // Strictly Top 5
  }, [orders]);

  // Category Breakdown
  const categoryBreakdown = useMemo(() => {
    const categories = ['Mobile Legends', 'PUBG Mobile', 'Steam Wallet', 'Roblox', 'Genshin Impact', 'Razer Gold', 'Valorant'];
    const map = new Map<string, { name: string; gmv: number; count: number }>();

    categories.forEach((cat) => map.set(cat, { name: cat, gmv: 0, count: 0 }));
    map.set('Other Games', { name: 'Other Games', gmv: 0, count: 0 });

    orders.forEach((o) => {
      if (o.orderStatus === 'Cancelled') return;
      let matched = false;
      for (const cat of categories) {
        if (o.productName.toLowerCase().includes(cat.toLowerCase())) {
          const item = map.get(cat)!;
          item.gmv += o.totalAmount || 0;
          item.count += 1;
          matched = true;
          break;
        }
      }
      if (!matched) {
        const item = map.get('Other Games')!;
        item.gmv += o.totalAmount || 0;
        item.count += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.gmv - a.gmv);
  }, [orders]);

  // State Breakdown
  const stateBreakdown = useMemo(() => {
    const map = new Map<string, { state: string; gmv: number; count: number }>();

    orders.forEach((o) => {
      if (o.orderStatus === 'Cancelled') return;
      const state = getStateFromAddress(o.shippingAddress);
      const existing = map.get(state) || { state, gmv: 0, count: 0 };
      map.set(state, {
        state,
        gmv: existing.gmv + (o.totalAmount || 0),
        count: existing.count + 1,
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, 8);
  }, [orders]);

  const topProductLeader = topProducts[0];
  const topSpenderLeader = topSpenders[0];

  return (
    <div className="space-y-6">
      {/* Header Banner - Clean Light Theme */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                Top Products &amp; Customer Spenders Analytics
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                  REAL-TIME LEADERBOARD
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Deep analysis of top-performing digital assets, highest lifetime value buyers, and category revenue distribution.
              </p>
            </div>
          </div>
        </div>

        {/* Quick KPI Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* #1 Bestseller */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-500" /> #1 Top Product
              </span>
              <p className="text-xs font-extrabold text-slate-900 truncate mt-1">
                {topProductLeader ? topProductLeader.productName : 'N/A'}
              </p>
              <p className="text-[11px] font-mono font-bold text-blue-700 mt-0.5">
                RM {(topProductLeader?.gmv || 0).toFixed(2)} ({topProductLeader?.units || 0} sold)
              </p>
            </div>
          </div>

          {/* #1 Top Spender */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-amber-500" /> #1 VIP Customer
              </span>
              <p className="text-xs font-extrabold text-slate-900 truncate mt-1">
                @{topSpenderLeader ? topSpenderLeader.username : 'N/A'}
              </p>
              <p className="text-[11px] font-mono font-bold text-emerald-700 mt-0.5">
                RM {(topSpenderLeader?.totalSpent || 0).toFixed(2)} ({topSpenderLeader?.orderCount || 0} orders)
              </p>
            </div>
          </div>

          {/* Top 5 Share of Sales */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" /> Top 5 Concentration
              </span>
              <p className="text-sm font-black font-mono text-slate-900 mt-1">
                {totalStoreGMV > 0
                  ? (
                      ((topProducts.slice(0, 5).reduce((acc, p) => acc + p.gmv, 0) / totalStoreGMV) * 100).toFixed(1)
                    )
                  : '0'}%
              </p>
              <p className="text-[10px] text-slate-500">Revenue from top 5 items</p>
            </div>
          </div>

          {/* Active Spenders */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Total Unique Buyers
              </span>
              <p className="text-sm font-black text-slate-900 mt-1 font-mono">{topSpenders.length}</p>
              <p className="text-[10px] text-slate-500">Repeat &amp; new buyers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Top Products vs Top Spenders vs Top Frequent Buyers (Strictly Top 5 Each) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Top Selling Digital Products Card (Top 5 Only) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Top 5 Selling Products
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-black border border-blue-200">
              TOP 5 RANKED
            </span>
          </div>

          {/* Products Ranked List */}
          <div className="space-y-3">
            {topProducts.map((prod, idx) => {
              const sharePct = totalStoreGMV > 0 ? (prod.gmv / totalStoreGMV) * 100 : 0;
              const rank = idx + 1;

              return (
                <div
                  key={prod.productName}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-blue-50/40 transition-colors space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {/* Rank Medal */}
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 mt-0.5 ${
                          rank === 1
                            ? 'bg-amber-400 text-slate-950 shadow-xs'
                            : rank === 2
                            ? 'bg-slate-300 text-slate-900'
                            : rank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-slate-900 leading-snug break-words" title={prod.productName}>
                          {prod.productName}
                        </h4>
                        <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                          {prod.units} unit(s) sold
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-sm text-slate-900">
                        RM {prod.gmv.toFixed(2)}
                      </div>
                      <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 inline-block mt-0.5">
                        {sharePct.toFixed(1)}% revenue
                      </div>
                    </div>
                  </div>

                  {/* Revenue Progress Bar */}
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        rank === 1 ? 'bg-amber-500' : rank === 2 ? 'bg-blue-600' : 'bg-slate-600'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(6, sharePct * 3))}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {topProducts.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">No completed orders recorded yet.</div>
            )}
          </div>
        </div>

        {/* 2. Top Customer Spenders Card (LTV RM - Top 5 Only) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Top 5 Customer Spenders (LTV)
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-black border border-amber-200">
              TOP 5 RANKED
            </span>
          </div>

          {/* Customer Spenders Ranked List */}
          <div className="space-y-3">
            {topSpenders.map((spender, idx) => {
              const rank = idx + 1;
              const isVipGold = spender.totalSpent >= 200;
              const isVipPlatinum = spender.totalSpent >= 500;

              return (
                <div
                  key={spender.username}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-amber-50/30 transition-colors space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 mt-0.5 ${
                          rank === 1
                            ? 'bg-amber-400 text-slate-950 shadow-xs'
                            : rank === 2
                            ? 'bg-slate-300 text-slate-900'
                            : rank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {rank}
                      </span>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs text-slate-900">
                            @{maskUsername(spender.username, userRole)}
                          </span>
                          {isVipPlatinum ? (
                            <span className="px-1.5 py-0.2 text-[9px] font-black rounded bg-purple-100 text-purple-800 border border-purple-300">
                              PLATINUM VIP
                            </span>
                          ) : isVipGold ? (
                            <span className="px-1.5 py-0.2 text-[9px] font-black rounded bg-amber-100 text-amber-800 border border-amber-300">
                              GOLD VIP
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-700 font-bold">
                          {maskCustomerName(spender.buyerName, userRole)}
                        </div>
                        {/* Location Badge - Clean, uncropped */}
                        <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-bold text-[10px] border border-blue-200 flex items-center gap-1 shrink-0">
                            <MapPin className="w-3 h-3 text-blue-600" />
                            <span>{spender.state}</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono font-medium">
                            {maskPhone(spender.phone, userRole)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-sm text-emerald-700">
                        {maskPrice(spender.totalSpent, userRole, (v) => `RM ${v.toFixed(2)}`)}
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                        {spender.orderCount} order(s)
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {topSpenders.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">No customer spenders recorded yet.</div>
            )}
          </div>
        </div>

        {/* 3. Top Frequent Buyers Card (Top 5 Only) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Top 5 Frequent Buyers
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 text-[10px] font-black border border-sky-200">
              BY ORDERS
            </span>
          </div>

          {/* Frequent Buyers Ranked List */}
          <div className="space-y-3">
            {topFrequentBuyers.map((buyer, idx) => {
              const rank = idx + 1;

              return (
                <div
                  key={`freq-${buyer.username}`}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-sky-50/30 transition-colors space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shrink-0 mt-0.5 ${
                          rank === 1
                            ? 'bg-blue-600 text-white shadow-xs'
                            : rank === 2
                            ? 'bg-slate-300 text-slate-900'
                            : rank === 3
                            ? 'bg-sky-500 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {rank}
                      </span>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="font-extrabold text-xs text-slate-900">
                          @{buyer.username}
                        </div>
                        <div className="text-xs text-slate-700 font-bold">
                          {buyer.buyerName}
                        </div>
                        {/* Location Badge - Clean, uncropped */}
                        <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-bold text-[10px] border border-slate-300 flex items-center gap-1 shrink-0">
                            <MapPin className="w-3 h-3 text-slate-600" />
                            <span>{buyer.state}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                        {buyer.orderCount} Orders
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 mt-1">
                        RM {buyer.totalSpent.toFixed(2)} total
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {topFrequentBuyers.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">No repeat buyers recorded yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* Category & Regional Distribution Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Revenue Share */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Digital Product Category Distribution
          </h3>

          <div className="space-y-2.5 pt-1">
            {categoryBreakdown.map((cat) => {
              const pct = totalStoreGMV > 0 ? (cat.gmv / totalStoreGMV) * 100 : 0;
              return (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-800 font-bold">{cat.name}</span>
                    <span className="font-mono font-bold text-slate-900">
                      RM {cat.gmv.toFixed(2)} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Regional State Rankings */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            Top Malaysian States Revenue Performance
          </h3>

          <div className="space-y-2.5 pt-1">
            {stateBreakdown.map((st) => {
              const pct = totalStoreGMV > 0 ? (st.gmv / totalStoreGMV) * 100 : 0;
              return (
                <div key={st.state} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-800 font-bold">{st.state}</span>
                    <span className="font-mono font-bold text-slate-900">
                      RM {st.gmv.toFixed(2)} ({st.count} orders)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
