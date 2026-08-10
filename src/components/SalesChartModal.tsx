import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, TrendingUp, MapPin, ShoppingBag, DollarSign, Filter, Users, Sparkles, CheckCircle2, BarChart2, ChevronDown, Check, Calendar } from 'lucide-react';
import {
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ShopeeOrder } from '../types';
import { getStateFromAddress, MALAYSIAN_STATES } from '../utils/addressHelper';
import { inferBuyerRace, ALL_RACES, BuyerRace } from '../utils/raceHelper';

interface SalesChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: ShopeeOrder[];
  theme?: 'dark' | 'light';
  initialTab?: 'overview' | 'location' | 'trend' | 'status';
}

export const SalesChartModal: React.FC<SalesChartModalProps> = ({
  isOpen,
  onClose,
  orders,
  theme = 'dark',
}) => {
  if (!isOpen) return null;

  const isLight = theme === 'light';
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('All');
  const [selectedRaceFilter, setSelectedRaceFilter] = useState<string>('All');

  // Custom Dropdown Open States inside modal
  const [isStateOpen, setIsStateOpen] = useState(false);
  const [isRaceOpen, setIsRaceOpen] = useState(false);

  const stateRef = useRef<HTMLDivElement>(null);
  const raceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (stateRef.current && !stateRef.current.contains(e.target as Node)) setIsStateOpen(false);
      if (raceRef.current && !raceRef.current.contains(e.target as Node)) setIsRaceOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter orders by selected state & race inside modal
  const modalOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedStateFilter !== 'All') {
        const state = getStateFromAddress(o.shippingAddress);
        if (state !== selectedStateFilter) return false;
      }
      if (selectedRaceFilter !== 'All') {
        const race = inferBuyerRace(o);
        if (race !== selectedRaceFilter) return false;
      }
      return true;
    });
  }, [orders, selectedStateFilter, selectedRaceFilter]);

  // Overall Totals
  const totalRevenue = useMemo(() => modalOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0), [modalOrders]);
  const totalOrders = modalOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // 1. Prepare Adaptive Timeline Data & Title based on selected date range & granularity
  const { chartData, titleLabel, granularityLabel } = useMemo(() => {
    if (!modalOrders || modalOrders.length === 0) {
      return {
        chartData: [],
        titleLabel: 'Daily Revenue Trajectory & Order Volume',
        granularityLabel: 'Daily',
      };
    }

    // Parse all dates and find min/max
    const datesWithTime = modalOrders
      .map((o) => {
        const full = o.orderDate || '2026-07-22 12:00:00';
        const d = new Date(full.replace(' ', 'T'));
        const datePart = full.split(' ')[0];
        return {
          order: o,
          full,
          datePart,
          timestamp: isNaN(d.getTime()) ? new Date('2026-07-22T12:00:00').getTime() : d.getTime(),
          dateObj: isNaN(d.getTime()) ? new Date('2026-07-22T12:00:00') : d,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    const uniqueDates: string[] = Array.from(new Set(datesWithTime.map((d) => d.datePart))).sort() as string[];
    const minTime = datesWithTime[0].timestamp;
    const maxTime = datesWithTime[datesWithTime.length - 1].timestamp;
    const spanInDays = (maxTime - minTime) / (1000 * 3600 * 24);

    // A) Single Day -> HOURLY
    if (uniqueDates.length === 1 || spanInDays <= 1.0) {
      const singleDateStr: string = uniqueDates[0] || '2026-07-22';
      let formattedDay = singleDateStr;
      try {
        const d = new Date(singleDateStr);
        if (!isNaN(d.getTime())) {
          formattedDay = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        }
      } catch (e) {}

      // Bucket into 2-hour slots throughout the day (00:00 - 22:00)
      const hourlyMap: Record<number, { displayDate: string; revenue: number; ordersCount: number }> = {};
      for (let h = 0; h < 24; h += 2) {
        const label = `${h.toString().padStart(2, '0')}:00`;
        hourlyMap[h] = { displayDate: label, revenue: 0, ordersCount: 0 };
      }

      datesWithTime.forEach((item) => {
        const h = item.dateObj.getHours();
        const bucket = Math.floor(h / 2) * 2;
        if (!hourlyMap[bucket]) {
          hourlyMap[bucket] = { displayDate: `${bucket.toString().padStart(2, '0')}:00`, revenue: 0, ordersCount: 0 };
        }
        hourlyMap[bucket].revenue += item.order.totalAmount || 0;
        hourlyMap[bucket].ordersCount += 1;
      });

      const result = Object.keys(hourlyMap)
        .map(Number)
        .sort((a, b) => a - b)
        .map((h) => hourlyMap[h]);

      return {
        chartData: result,
        titleLabel: `Hourly Revenue Trajectory (${formattedDay})`,
        granularityLabel: 'Hourly',
      };
    }

    // B) 2 to 60 days -> DAILY (DD MMM) - Standard Daily view
    if (uniqueDates.length <= 60 || spanInDays <= 60) {
      const dayMap: Record<
        string,
        { sortKey: string; displayDate: string; revenue: number; ordersCount: number }
      > = {};

      datesWithTime.forEach((item) => {
        const dateStr = item.datePart;
        let formattedLabel = dateStr;
        try {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            formattedLabel = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          }
        } catch (e) {}

        if (!dayMap[dateStr]) {
          dayMap[dateStr] = {
            sortKey: dateStr,
            displayDate: formattedLabel,
            revenue: 0,
            ordersCount: 0,
          };
        }
        dayMap[dateStr].revenue += item.order.totalAmount || 0;
        dayMap[dateStr].ordersCount += 1;
      });

      const result = Object.values(dayMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

      return {
        chartData: result,
        titleLabel: 'Daily Revenue Trajectory & Order Volume',
        granularityLabel: 'Daily',
      };
    }

    // D) More than 60 days up to 3 years -> MONTHLY (MMM YYYY)
    if (spanInDays <= 1095) {
      const monthMap: Record<
        string,
        { sortKey: string; displayDate: string; revenue: number; ordersCount: number }
      > = {};

      datesWithTime.forEach((item) => {
        const monthKey = item.datePart.slice(0, 7); // YYYY-MM
        let formattedLabel = monthKey;
        try {
          const d = new Date(`${monthKey}-01`);
          if (!isNaN(d.getTime())) {
            formattedLabel = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
          }
        } catch (e) {}

        if (!monthMap[monthKey]) {
          monthMap[monthKey] = {
            sortKey: monthKey,
            displayDate: formattedLabel,
            revenue: 0,
            ordersCount: 0,
          };
        }
        monthMap[monthKey].revenue += item.order.totalAmount || 0;
        monthMap[monthKey].ordersCount += 1;
      });

      const result = Object.values(monthMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

      return {
        chartData: result,
        titleLabel: 'Monthly Revenue Trajectory & Order Volume',
        granularityLabel: 'Monthly',
      };
    }

    // E) More than 3 years -> YEARLY (YYYY)
    const yearMap: Record<
      string,
      { sortKey: string; displayDate: string; revenue: number; ordersCount: number }
    > = {};

    datesWithTime.forEach((item) => {
      const yearKey = item.datePart.slice(0, 4); // YYYY

      if (!yearMap[yearKey]) {
        yearMap[yearKey] = {
          sortKey: yearKey,
          displayDate: yearKey,
          revenue: 0,
          ordersCount: 0,
        };
      }
      yearMap[yearKey].revenue += item.order.totalAmount || 0;
      yearMap[yearKey].ordersCount += 1;
    });

    const result = Object.values(yearMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    return {
      chartData: result,
      titleLabel: 'Yearly Revenue Trajectory & Order Volume',
      granularityLabel: 'Yearly',
    };
  }, [modalOrders]);

  // Max revenue for scaling chart domain
  const maxRevenueInChart = useMemo(() => {
    if (chartData.length === 0) return 100;
    const maxVal = Math.max(...chartData.map((d) => d.revenue));
    return maxVal > 0 ? Math.ceil(maxVal * 1.2) : 100;
  }, [chartData]);

  // Max order count for right YAxis
  const maxOrderCountInChart = useMemo(() => {
    if (chartData.length === 0) return 5;
    const maxVal = Math.max(...chartData.map((d) => d.ordersCount));
    return maxVal > 0 ? Math.ceil(maxVal * 1.3) : 5;
  }, [chartData]);

  // 2. Sales Demographics by Malaysian State
  const stateStats = useMemo(() => {
    const stats: Record<string, { revenue: number; count: number }> = {};
    modalOrders.forEach((o) => {
      const state = getStateFromAddress(o.shippingAddress);
      if (!stats[state]) {
        stats[state] = { revenue: 0, count: 0 };
      }
      stats[state].revenue += o.totalAmount || 0;
      stats[state].count += 1;
    });

    const totalAllRevenue = modalOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    return Object.entries(stats)
      .map(([state, data]) => ({
        state,
        revenue: data.revenue,
        count: data.count,
        percentRevenue: totalAllRevenue > 0 ? (data.revenue / totalAllRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [modalOrders]);

  // 3. AI Demographics by Buyer Race / Ethnicity
  const raceStats = useMemo(() => {
    const stats: Record<BuyerRace, { revenue: number; count: number }> = {
      Malay: { revenue: 0, count: 0 },
      Chinese: { revenue: 0, count: 0 },
      Indian: { revenue: 0, count: 0 },
      'Others / Unassigned': { revenue: 0, count: 0 },
    };

    modalOrders.forEach((o) => {
      const race = inferBuyerRace(o);
      stats[race].revenue += o.totalAmount || 0;
      stats[race].count += 1;
    });

    const totalAllRevenue = modalOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    return (Object.keys(stats) as BuyerRace[])
      .map((raceKey) => ({
        race: raceKey,
        revenue: stats[raceKey].revenue,
        count: stats[raceKey].count,
        percentRevenue: totalAllRevenue > 0 ? (stats[raceKey].revenue / totalAllRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [modalOrders]);

  // Unique States list for dropdown
  const uniqueStatesInDataset = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => set.add(getStateFromAddress(o.shippingAddress)));
    return Array.from(set).sort();
  }, [orders]);

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const rowData = payload[0]?.payload;
      const rev = rowData?.revenue ?? 0;
      const count = rowData?.ordersCount ?? 0;

      return (
        <div
          className={`p-3.5 rounded-2xl border shadow-2xl backdrop-blur-md text-xs font-sans space-y-1 ${
            isLight
              ? 'bg-white/95 border-amber-300 text-slate-900 shadow-amber-900/10'
              : 'bg-[#181818]/95 border-[#E9CE79]/40 text-zinc-100'
          }`}
        >
          <p className="font-mono font-bold border-b pb-1 border-zinc-700/40 text-[#a68212]">{label}</p>
          <div className="flex items-center gap-2 pt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E9CE79]" />
            <span className="font-medium">Total Revenue:</span>
            <span className="font-extrabold text-[#E9CE79]">
              RM {Number(rev).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="font-medium">Order Count:</span>
            <span className="font-bold text-emerald-400">{Math.round(count)} Orders</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className={`relative w-full max-w-5xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all ${
          isLight
            ? 'bg-white border-zinc-200 text-slate-900 shadow-slate-400/20'
            : 'bg-[#121212] border-[#E9CE79]/30 text-zinc-100 shadow-black/80'
        }`}
      >
        {/* Modal Top Header */}
        <div
          className={`px-5 py-4 sm:px-6 sm:py-5 border-b flex items-center justify-between gap-4 shrink-0 ${
            isLight ? 'bg-slate-50 border-zinc-200' : 'bg-[#181818] border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E9CE79]/20 border border-[#E9CE79]/40 flex items-center justify-center text-[#a68212] shrink-0">
              <BarChart2 className="w-5 h-5 text-[#a68212]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                Store Analytics &amp; Demographics Dashboard
              </h2>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Revenue Line + Order Volume Combo Chart &amp; Geographic &amp; Buyer Ethnicity Insights
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer shrink-0"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Filter Dropdowns Bar matching usual custom dropdown menu UI */}
        <div
          className={`px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 relative z-30 ${
            isLight ? 'bg-slate-100/80 border-zinc-200' : 'bg-[#151515] border-zinc-800'
          }`}
        >
          <div className="flex flex-wrap items-center gap-3">
            {/* Custom Styled State Location Dropdown Menu */}
            <div className="relative" ref={stateRef}>
              <button
                type="button"
                onClick={() => setIsStateOpen(!isStateOpen)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all cursor-pointer ${
                  selectedStateFilter !== 'All'
                    ? 'bg-[#E9CE79] text-[#0e0e0e] border-[#E9CE79]'
                    : isLight
                    ? 'bg-white border-zinc-300 text-slate-800 hover:border-[#a68212]'
                    : 'bg-[#202020] border-zinc-700 text-zinc-100 hover:border-[#E9CE79]'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-[#a68212]" />
                <span>{selectedStateFilter === 'All' ? 'All States (Malaysia Wide)' : selectedStateFilter}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#a68212] transition-transform ${isStateOpen ? 'rotate-180' : ''}`} />
              </button>

              {isStateOpen && (
                <div
                  className={`absolute left-0 top-full mt-1.5 w-60 max-h-56 overflow-y-auto rounded-2xl border shadow-2xl z-50 p-1.5 space-y-1 animate-fadeIn ${
                    isLight ? 'bg-white border-amber-300 text-slate-900 shadow-xl' : 'bg-[#181818] border-[#E9CE79]/50 text-zinc-100 shadow-black/90'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStateFilter('All');
                      setIsStateOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      selectedStateFilter === 'All'
                        ? 'bg-[#E9CE79] text-[#0e0e0e]'
                        : isLight
                        ? 'hover:bg-slate-100 text-slate-700'
                        : 'hover:bg-[#252525] text-zinc-300'
                    }`}
                  >
                    <span>All States (Malaysia Wide)</span>
                    {selectedStateFilter === 'All' && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                  </button>

                  {uniqueStatesInDataset.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        setSelectedStateFilter(st);
                        setIsStateOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        selectedStateFilter === st
                          ? 'bg-[#E9CE79] text-[#0e0e0e]'
                          : isLight
                          ? 'hover:bg-slate-100 text-slate-700'
                          : 'hover:bg-[#252525] text-zinc-300'
                      }`}
                    >
                      <span>{st}</span>
                      {selectedStateFilter === st && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Styled Buyer Race Dropdown Menu */}
            <div className="relative" ref={raceRef}>
              <button
                type="button"
                onClick={() => setIsRaceOpen(!isRaceOpen)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all cursor-pointer ${
                  selectedRaceFilter !== 'All'
                    ? 'bg-[#E9CE79] text-[#0e0e0e] border-[#E9CE79]'
                    : isLight
                    ? 'bg-white border-zinc-300 text-slate-800 hover:border-[#a68212]'
                    : 'bg-[#202020] border-zinc-700 text-zinc-100 hover:border-[#E9CE79]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#a68212]" />
                <span>{selectedRaceFilter === 'All' ? 'All Ethnicity Groups' : selectedRaceFilter}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#a68212] transition-transform ${isRaceOpen ? 'rotate-180' : ''}`} />
              </button>

              {isRaceOpen && (
                <div
                  className={`absolute left-0 top-full mt-1.5 w-56 max-h-56 overflow-y-auto rounded-2xl border shadow-2xl z-50 p-1.5 space-y-1 animate-fadeIn ${
                    isLight ? 'bg-white border-amber-300 text-slate-900 shadow-xl' : 'bg-[#181818] border-[#E9CE79]/50 text-zinc-100 shadow-black/90'
                  }`}
                >
                  {['All', 'Malay', 'Chinese', 'Indian', 'Others / Unassigned'].map((rc) => (
                    <button
                      key={rc}
                      type="button"
                      onClick={() => {
                        setSelectedRaceFilter(rc);
                        setIsRaceOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                        selectedRaceFilter === rc
                          ? 'bg-[#E9CE79] text-[#0e0e0e]'
                          : isLight
                          ? 'hover:bg-slate-100 text-slate-700'
                          : 'hover:bg-[#252525] text-zinc-300'
                      }`}
                    >
                      <span>{rc === 'All' ? 'All Ethnicity Groups' : rc}</span>
                      {selectedRaceFilter === rc && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="text-xs font-mono font-bold text-[#a68212] flex items-center gap-2">
            <span>Filtered: {totalOrders} Orders</span>
            <span>•</span>
            <span>Total: RM {totalRevenue.toFixed(2)}</span>
          </div>
        </div>

        {/* Modal Main Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Key Metrics Summary Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`p-3.5 rounded-2xl border ${isLight ? 'bg-slate-50 border-zinc-200' : 'bg-[#181818] border-zinc-800'}`}>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider block ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Revenue (RM)
              </span>
              <span className={`text-lg sm:text-xl font-black mt-0.5 block ${isLight ? 'text-slate-900' : 'text-amber-300'}`}>
                RM {totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className={`p-3.5 rounded-2xl border ${isLight ? 'bg-slate-50 border-zinc-200' : 'bg-[#181818] border-zinc-800'}`}>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider block ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Order Volume
              </span>
              <span className={`text-lg sm:text-xl font-black mt-0.5 block ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {totalOrders} Orders
              </span>
            </div>

            <div className={`p-3.5 rounded-2xl border ${isLight ? 'bg-slate-50 border-zinc-200' : 'bg-[#181818] border-zinc-800'}`}>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider block ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Avg Ticket Size
              </span>
              <span className={`text-lg sm:text-xl font-black mt-0.5 block ${isLight ? 'text-slate-900' : 'text-white'}`}>
                RM {avgOrderValue.toFixed(2)}
              </span>
            </div>

            <div className={`p-3.5 rounded-2xl border ${isLight ? 'bg-slate-50 border-zinc-200' : 'bg-[#181818] border-zinc-800'}`}>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider block ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Top Demographic
              </span>
              <span className={`text-sm sm:text-base font-black truncate mt-1 block ${isLight ? 'text-[#7a5e0b]' : 'text-[#E9CE79]'}`}>
                {raceStats[0]?.race || 'N/A'} ({raceStats[0]?.count || 0})
              </span>
            </div>
          </div>

          {/* POLISHED DYNAMIC COMBINATION LINE + COLUMN CHART */}
          <div className={`p-5 rounded-3xl border ${isLight ? 'bg-slate-50 border-zinc-200' : 'bg-[#161616] border-zinc-800'}`}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#a68212]" />
                <h3 className={`font-black text-sm sm:text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {titleLabel}
                </h3>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                  isLight
                    ? 'bg-amber-100 text-[#7a5e0b] border-amber-300'
                    : 'bg-[#E9CE79]/20 text-[#E9CE79] border-[#E9CE79]/30'
                }`}>
                  {granularityLabel}
                </span>
              </div>
              <span className={`text-xs font-semibold font-mono px-3 py-1 rounded-full border ${
                isLight
                  ? 'bg-amber-100 text-[#7a5e0b] border-amber-300'
                  : 'text-[#a68212] bg-[#E9CE79]/15 border-[#E9CE79]/30'
              }`}>
                Gold Curve = Revenue (RM) | Emerald Bar = Order Count
              </span>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 15, right: 25, bottom: 25, left: 15 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isLight ? '#d97706' : '#E9CE79'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={isLight ? '#d97706' : '#E9CE79'} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e2e8f0' : '#262626'} />
                  <XAxis
                    dataKey="displayDate"
                    stroke={isLight ? '#475569' : '#a1a1aa'}
                    tick={{ fontSize: 11, fontWeight: 700 }}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    stroke={isLight ? '#7a5e0b' : '#E9CE79'}
                    tick={{ fontSize: 11, fontWeight: 700 }}
                    tickFormatter={(val) => `RM ${val}`}
                    domain={[0, (dataMax: number) => Math.ceil((dataMax * 1.15) / 50) * 50 || 500]}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#10b981"
                    domain={[0, (dataMax: number) => Math.max(5, Math.ceil(dataMax * 1.25))]}
                    allowDecimals={false}
                    tick={{ fontSize: 11, fontWeight: 700 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12, fontWeight: 700 }} />

                  <Bar
                    yAxisId="right"
                    dataKey="ordersCount"
                    name="Orders Count"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={32}
                  />

                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    fill="url(#revenueGrad)"
                    stroke="none"
                    legendType="none"
                  />

                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue (RM)"
                    stroke={isLight ? '#b45309' : '#E9CE79'}
                    strokeWidth={3.5}
                    dot={{ r: 5, fill: isLight ? '#b45309' : '#E9CE79', stroke: isLight ? '#ffffff' : '#0e0e0e', strokeWidth: 2 }}
                    activeDot={{ r: 8, fill: '#ffffff', stroke: isLight ? '#b45309' : '#E9CE79', strokeWidth: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TWO COLUMN GRID: STATE & BUYER RACE DEMOGRAPHICS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 1. Malaysian State Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#a68212]" />
                  <h3 className={`font-black text-sm sm:text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    State Locations Breakdown
                  </h3>
                </div>
                <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                  Top Regions
                </span>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {stateStats.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic p-3">No orders found for the active filter.</p>
                ) : (
                  stateStats.map((item, idx) => (
                    <div
                      key={item.state}
                      className={`p-3 rounded-2xl border transition-all ${
                        isLight ? 'bg-slate-50 border-zinc-200' : 'bg-[#161616] border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <span className="font-bold flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-[#E9CE79]/20 flex items-center justify-center text-[#a68212] text-[10px] font-black">
                            #{idx + 1}
                          </span>
                          {item.state}
                        </span>
                        <span className={`font-extrabold font-mono ${isLight ? 'text-[#7a5e0b]' : 'text-[#E9CE79]'}`}>
                          RM {item.revenue.toFixed(2)} ({item.count} orders)
                        </span>
                      </div>

                      <div className={`w-full h-2 rounded-full overflow-hidden ${isLight ? 'bg-zinc-200' : 'bg-zinc-800'}`}>
                        <div
                          className={`h-2 rounded-full ${isLight ? 'bg-amber-600' : 'bg-[#E9CE79]'}`}
                          style={{ width: `${Math.max(4, item.percentRevenue)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. AI Buyer Race & Ethnicity Demographics */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#a68212]" />
                  <h3 className={`font-black text-sm sm:text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    AI Buyer Ethnicity &amp; Race Analysis
                  </h3>
                </div>
                <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                  Inferred from Names
                </span>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {raceStats.map((item) => {
                  let barColor = isLight ? 'bg-amber-600' : 'bg-[#E9CE79]';
                  if (item.race === 'Malay') barColor = 'bg-emerald-600';
                  if (item.race === 'Chinese') barColor = isLight ? 'bg-amber-600' : 'bg-amber-400';
                  if (item.race === 'Indian') barColor = 'bg-sky-600';

                  return (
                    <div
                      key={item.race}
                      className={`p-3 rounded-2xl border transition-all ${
                        isLight ? 'bg-slate-50 border-zinc-200' : 'bg-[#161616] border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <span className="font-bold flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${barColor}`} />
                          {item.race}
                        </span>
                        <span className={`font-extrabold font-mono ${isLight ? 'text-[#7a5e0b]' : 'text-[#E9CE79]'}`}>
                          RM {item.revenue.toFixed(2)} ({item.count} buyers)
                        </span>
                      </div>

                      <div className={`w-full h-2 rounded-full overflow-hidden ${isLight ? 'bg-zinc-200' : 'bg-zinc-800'}`}>
                        <div
                          className={`h-2 rounded-full ${barColor}`}
                          style={{ width: `${Math.max(4, item.percentRevenue)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`px-5 py-3.5 border-t flex items-center justify-between shrink-0 ${
            isLight ? 'bg-slate-50 border-zinc-200' : 'bg-[#181818] border-zinc-800'
          }`}
        >
          <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
            Real-time multi-dimensional sales chart &amp; demographic analytics
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-[#E9CE79] hover:bg-[#f3dc8d] text-[#0e0e0e] transition-all cursor-pointer active:scale-95"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
