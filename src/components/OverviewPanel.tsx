import React, { useState, useMemo } from 'react';
import { ShoppingBag, TrendingUp, Crown, Calendar, Sparkles, BarChart2, Flame, Award } from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ShopeeOrder } from '../types';
import { StatsOverview } from './StatsOverview';

interface OverviewPanelProps {
  orders: ShopeeOrder[];
  filteredOrders: ShopeeOrder[];
  onOpenSmsTab: () => void;
  onOpenAnalyticsModal: (tab?: 'overview' | 'location' | 'trend' | 'status') => void;
  onSelectOrder?: (order: ShopeeOrder) => void;
}

export const OverviewPanel: React.FC<OverviewPanelProps> = ({
  orders,
  filteredOrders,
  onOpenSmsTab,
  onOpenAnalyticsModal,
}) => {
  const [chartGranularity, setChartGranularity] = useState<'day' | 'week' | 'month' | 'year'>('day');

  // Top 5 Selling Products Computation
  const topProducts = useMemo(() => {
    const map = new Map<string, { productName: string; units: number; gmv: number; completedCount: number }>();

    filteredOrders.forEach((o) => {
      if (o.orderStatus === 'Cancelled') return;
      const name = (o.productName || 'Digital Top-Up Product').trim();
      const existing = map.get(name) || { productName: name, units: 0, gmv: 0, completedCount: 0 };
      const qty = o.quantity || 1;
      const amt = o.totalAmount || 0;

      map.set(name, {
        productName: name,
        units: existing.units + qty,
        gmv: existing.gmv + amt,
        completedCount: existing.completedCount + (o.orderStatus === 'Completed' ? 1 : 0),
      });
    });

    const list = Array.from(map.values());
    list.sort((a, b) => b.units - a.units || b.gmv - a.gmv);
    return list.slice(0, 5); // Strictly top 5
  }, [filteredOrders]);

  const maxUnits = useMemo(() => {
    if (topProducts.length === 0) return 1;
    return Math.max(...topProducts.map((p) => p.units), 1);
  }, [topProducts]);

  // Sales Chart Data Computation (Day / Week / Month / Year)
  const salesChartData = useMemo(() => {
    const timeMap = new Map<string, { label: string; gmv: number; orderCount: number; sortKey: string }>();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    filteredOrders.forEach((o) => {
      if (o.orderStatus === 'Cancelled') return;
      const rawDate = o.orderDate || '2026-07-22 12:00:00';
      const datePart = rawDate.split(' ')[0]; // YYYY-MM-DD

      let key = datePart;
      let label = datePart;

      if (chartGranularity === 'year') {
        const yearPart = datePart.substring(0, 4);
        key = yearPart;
        label = yearPart;
      } else if (chartGranularity === 'month') {
        const monthPart = datePart.substring(0, 7); // YYYY-MM
        key = monthPart;
        const [y, m] = monthPart.split('-');
        const mIdx = parseInt(m, 10) - 1;
        label = `${monthNames[mIdx] || m} ${y}`;
      } else if (chartGranularity === 'week') {
        const d = new Date(datePart);
        if (!isNaN(d.getTime())) {
          const dayOfWeek = d.getDay();
          const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          const mon = new Date(d);
          mon.setDate(d.getDate() + diffToMon);
          const monY = mon.getFullYear();
          const monM = String(mon.getMonth() + 1).padStart(2, '0');
          const monD = String(mon.getDate()).padStart(2, '0');
          const weekStartStr = `${monY}-${monM}-${monD}`;
          key = `W-${weekStartStr}`;
          label = `Wk ${monD} ${monthNames[mon.getMonth()] || monM}`;
        } else {
          key = datePart;
          label = datePart;
        }
      } else {
        // Day view format e.g. "22 Jul"
        const [y, m, d] = datePart.split('-');
        const mIdx = parseInt(m, 10) - 1;
        label = `${d} ${monthNames[mIdx] || m}`;
      }

      const existing = timeMap.get(key) || { label, gmv: 0, orderCount: 0, sortKey: key };
      timeMap.set(key, {
        label,
        gmv: existing.gmv + (o.totalAmount || 0),
        orderCount: existing.orderCount + 1,
        sortKey: key,
      });
    });

    const result = Array.from(timeMap.values());
    result.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return result;
  }, [filteredOrders, chartGranularity]);

  const totalFilteredGMV = useMemo(() => {
    return filteredOrders.filter((o) => o.orderStatus !== 'Cancelled').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  }, [filteredOrders]);

  const granularityLabels = {
    day: 'Daily',
    week: 'Weekly',
    month: 'Monthly',
    year: 'Yearly',
  };

  return (
    <div className="space-y-6 w-full animate-fade-in">
      {/* 1. Primary Store Operations KPI Cards */}
      <StatsOverview
        orders={orders}
        filteredOrders={filteredOrders}
        onOpenSmsTab={onOpenSmsTab}
        onOpenAnalyticsModal={onOpenAnalyticsModal}
      />

      {/* 2. Main Visual Grid: Sales Trajectory Chart + Top 5 Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sales Chart Section (2 columns wide on lg) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold">
                <BarChart2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Sales GMV &amp; Order Volume Trend
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Revenue performance trajectory ({granularityLabels[chartGranularity]} breakdown)
                </p>
              </div>
            </div>

            {/* Granularity Dropdown Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">Grouping:</span>
              <select
                value={chartGranularity}
                onChange={(e) => setChartGranularity(e.target.value as 'day' | 'week' | 'month' | 'year')}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-extrabold rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs transition-all"
              >
                <option value="day">Daily Breakdown</option>
                <option value="week">Weekly Breakdown</option>
                <option value="month">Monthly Breakdown</option>
                <option value="year">Yearly Breakdown</option>
              </select>
            </div>
          </div>

          {/* Recharts Composed Chart */}
          <div className="h-72 w-full pt-2">
            {salesChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 font-medium text-xs">
                No order sales records available for this filter range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={salesChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                    tickFormatter={(v) => `RM${v}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#3b82f6', fontWeight: 700 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '12px',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'Sales GMV (RM)') return [`RM ${Number(value).toFixed(2)}`, 'Sales GMV'];
                      return [`${value} Orders`, 'Order Count'];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '10px' }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="gmv"
                    name="Sales GMV (RM)"
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="orderCount"
                    name="Orders Count"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top 5 Selling Products Section (1 column wide on lg) */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Top 5 Selling Products
                </h3>
              </div>
              <span className="text-[10px] font-extrabold uppercase bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                By Units Sold
              </span>
            </div>

            {/* List of Top 5 Products */}
            <div className="divide-y divide-slate-100 mt-2">
              {topProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                  No product sales data found.
                </div>
              ) : (
                topProducts.map((p, idx) => {
                  const rank = idx + 1;
                  const percent = Math.round((p.units / maxUnits) * 100);

                  let badgeBg = 'bg-slate-100 text-slate-600 border-slate-200';
                  if (rank === 1) badgeBg = 'bg-amber-100 text-amber-900 border-amber-300 font-black';
                  if (rank === 2) badgeBg = 'bg-slate-200 text-slate-800 border-slate-300 font-black';
                  if (rank === 3) badgeBg = 'bg-orange-100 text-orange-900 border-orange-300 font-black';

                  return (
                    <div key={p.productName} className="py-2.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center shrink-0 border mt-0.5 ${badgeBg}`}
                          >
                            {rank}
                          </span>
                          <span className="text-xs font-bold text-slate-800 truncate leading-snug">
                            {p.productName}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-black text-slate-900 font-mono">
                            {p.units} <span className="text-[10px] font-semibold text-slate-500">units</span>
                          </div>
                          <div className="text-[10px] font-bold text-emerald-700 font-mono">
                            RM {p.gmv.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            rank === 1 ? 'bg-amber-500' : rank === 2 ? 'bg-blue-500' : 'bg-slate-400'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-right">
            <button
              type="button"
              onClick={() => onOpenAnalyticsModal('overview')}
              className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View Deep Store Analytics Modal</span>
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
