import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  Eye,
  CreditCard,
  User,
  ShoppingBag,
  Clock,
  Send,
  CheckCircle2,
  MapPin,
  Download,
  FileSpreadsheet,
  BarChart3,
  Table as TableIcon,
} from 'lucide-react';
import { exportOrdersToCSV, exportOrdersToExcel, calculateNetIncome, getTimelineTimestamps, getOrInferChannel, isCancelledOrder } from '../utils/csvHelper';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ShopeeOrder, SortConfig, ColumnDefinition, UserRole } from '../types';
import { maskCustomerName, maskUsername, maskPrice } from '../utils/maskHelper';

interface DataTableProps {
  orders: ShopeeOrder[];
  allFilteredOrders?: ShopeeOrder[];
  columns: ColumnDefinition[];
  sortConfig: SortConfig;
  onSort: (key: string) => void;
  onSelectOrder: (order: ShopeeOrder) => void;
  searchQuery: string;
  tableRowDensity?: 'compact' | 'comfortable' | 'spacious';
  currencyPrefix?: 'RM' | 'MYR' | 'PLAIN';
  userRole?: UserRole;
}

export const DataTable: React.FC<DataTableProps> = ({
  orders,
  allFilteredOrders,
  columns,
  sortConfig,
  onSort,
  onSelectOrder,
  searchQuery,
  tableRowDensity = 'comfortable',
  currencyPrefix = 'RM',
  userRole = 'admin',
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  // Dynamic Density Padding
  const cellPadding = useMemo(() => {
    if (tableRowDensity === 'compact') return 'py-1 px-2 text-[11px]';
    if (tableRowDensity === 'spacious') return 'py-3.5 px-3.5 text-xs';
    return 'py-2 px-2.5 text-[11px]'; // comfortable
  }, [tableRowDensity]);

  const headerPadding = useMemo(() => {
    if (tableRowDensity === 'compact') return 'py-1.5 px-2 text-[10px]';
    if (tableRowDensity === 'spacious') return 'py-3.5 px-3.5 text-[10px]';
    return 'py-2.5 px-2.5 text-[10px]'; // comfortable
  }, [tableRowDensity]);

  // Format Currency Helper
  const fmtCurr = (amount: number | undefined | null, isNegative = false) => {
    const val = (amount || 0).toFixed(2);
    if (currencyPrefix === 'MYR') return `${isNegative ? '- MYR ' : 'MYR '}${val}`;
    if (currencyPrefix === 'PLAIN') return `${isNegative ? '-' : ''}${val}`;
    return `${isNegative ? '- RM ' : 'RM '}${val}`;
  };

  const handleCopy = (text: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const isOrderSnVisible = columns.find((c) => c.key === 'orderSn')?.visible ?? true;
  const visibleCols = columns.filter((c) => c.visible && c.key !== 'orderSn');

  // Search text highlighter
  const renderHighlightedText = (text: string) => {
    if (!searchQuery || !text) return text;
    const parts = text.toString().split(new RegExp(`(${searchQuery.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === searchQuery.toLowerCase() ? (
            <mark key={i} className="bg-amber-100 text-amber-900 px-0.5 rounded font-bold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  // Status badge with sharp readability
  const renderStatusBadge = (status: string) => {
    let style = 'bg-slate-100 text-slate-700 border-slate-300';
    let dotColor = 'bg-slate-400';

    if (status === 'Completed') {
      style = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
      dotColor = 'bg-emerald-500';
    } else if (status === 'Unpaid') {
      style = 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
      dotColor = 'bg-amber-500';
    } else if (status === 'In Transit') {
      style = 'bg-sky-50 text-sky-800 border-sky-300 font-bold';
      dotColor = 'bg-sky-500';
    } else if (status === 'Cancelled') {
      style = 'bg-rose-50 text-rose-800 border-rose-300 font-bold';
      dotColor = 'bg-rose-500';
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border ${style}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
        <span>{status}</span>
      </span>
    );
  };

  // Sort icon renderer
  const renderSortIcon = (colKey: string) => {
    if (sortConfig.key !== colKey) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />;
    }
    return sortConfig.order === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-600 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-600 font-bold" />
    );
  };

  // Filtered Summary totals across all matched orders for selected date / filters (Excluding cancelled orders from revenue)
  const sourceOrdersForTotals = allFilteredOrders || orders;

  const totalFilteredAmount = useMemo(() => {
    return sourceOrdersForTotals
      .filter((o) => !isCancelledOrder(o))
      .reduce((sum, o) => {
        const gmv = (o.costOfGoodsSold && o.costOfGoodsSold > 0) ? o.costOfGoodsSold : (o.totalAmount || 0);
        return sum + gmv;
      }, 0);
  }, [sourceOrdersForTotals]);

  const totalFilteredNetEscrow = useMemo(() => {
    return sourceOrdersForTotals
      .filter((o) => !isCancelledOrder(o))
      .reduce((sum, o) => sum + calculateNetIncome(o), 0);
  }, [sourceOrdersForTotals]);

  // Aggregate product data for chart view mode
  const productChartData = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    orders.forEach((o) => {
      const name = o.productName || 'Other Items';
      const amt = (o.costOfGoodsSold && o.costOfGoodsSold > 0) ? o.costOfGoodsSold : (o.totalAmount || 0);
      if (map.has(name)) {
        const item = map.get(name)!;
        item.total += amt;
        item.count += 1;
      } else {
        map.set(name, { name, total: amt, count: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [orders]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 space-y-0">
      {/* Table Toolbar Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 rounded-t-xl">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
            Order Master Register ({orders.length} Records)
          </h3>
        </div>

        {/* Action Controls Right */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Table / Chart Mode Switcher */}
          <div className="flex items-center bg-slate-200 p-0.5 rounded-lg border border-slate-300">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Data Grid</span>
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'chart' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Revenue Chart</span>
            </button>
          </div>

          {/* Quick Export Excel & CSV buttons */}
          <button
            onClick={() => exportOrdersToExcel(orders, `shopee_orders_${new Date().toISOString().slice(0, 10)}.xlsx`)}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            title="Download Excel Spreadsheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          <button
            onClick={() => exportOrdersToCSV(orders, `shopee_orders_${new Date().toISOString().slice(0, 10)}.csv`)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            title="Download CSV File"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Chart View Mode */}
      {viewMode === 'chart' ? (
        <div className="p-6 space-y-4">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Top Products Revenue Breakdown</h4>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productChartData} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} tickFormatter={(v) => `RM${v}`} />
                <RechartsTooltip
                  formatter={(val: any) => [`RM ${parseFloat(val).toFixed(2)}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', borderColor: '#cbd5e1' }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {productChartData.map((_, i) => (
                    <Cell key={i} fill={i % 2 === 0 ? '#2563eb' : '#0284c7'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        /* Table Grid View Mode */
        <div className="relative">
          {/* TABLE SUMMARY BAR */}
          <div className="bg-slate-100 border-b-2 border-slate-300 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 font-bold text-xs text-slate-900 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-slate-800 text-white text-[10px] uppercase font-black tracking-wider">
                FILTERED RANGE TOTAL
              </span>
              <span className="text-slate-700 font-semibold">
                Showing {orders.length} of {sourceOrdersForTotals.length} matched order{sourceOrdersForTotals.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex items-center gap-4 ml-auto">
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-extrabold block">RELEASED ESCROW:</span>
                <span className="text-sm font-black text-emerald-700 font-mono">{fmtCurr(totalFilteredNetEscrow)}</span>
              </div>
              <div className="text-right bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-xs">
                <span className="text-[10px] uppercase tracking-wider text-blue-600 font-extrabold block">GROSS REVENUE (GMV):</span>
                <span className="text-base font-black text-slate-900 font-mono">{fmtCurr(totalFilteredAmount)}</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                  {isOrderSnVisible && (
                    <th
                      onClick={() => onSort('orderSn')}
                      className={`${headerPadding} whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition-colors`}
                    >
                      <div className="flex items-center gap-1">
                        <span>Order SN</span>
                        {renderSortIcon('orderSn')}
                      </div>
                    </th>
                  )}

                  {visibleCols.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => onSort(col.key)}
                      className={`${headerPadding} whitespace-nowrap cursor-pointer hover:bg-slate-200/70 transition-colors`}
                    >
                      <div className="flex items-center gap-1">
                        <span>{col.label}</span>
                        {renderSortIcon(col.key)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-800">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={visibleCols.length + (isOrderSnVisible ? 1 : 0)} className="py-10 text-center text-slate-400 font-medium">
                      No matching order records found.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    return (
                      <tr
                        key={order.id || order.orderSn}
                        onClick={() => onSelectOrder(order)}
                        className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                      >
                        {/* Order SN Cell */}
                        {isOrderSnVisible && (
                          <td className={`${cellPadding} font-mono font-bold text-blue-700 whitespace-nowrap`}>
                            <div className="flex items-center gap-1.5">
                              <span>{renderHighlightedText(order.orderSn)}</span>
                              <button
                                onClick={(e) => handleCopy(order.orderSn, order.orderSn, e)}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition-opacity p-0.5"
                                title="Copy Order SN"
                              >
                                {copiedKey === order.orderSn ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>
                        )}

                        {/* Visible Dynamic Columns */}
                        {visibleCols.map((col) => {
                          if (col.key === 'buyerUsername') {
                            const username = order.buyerUsername || 'Shopee Customer';
                            const realName = order.buyerName || order.recipientName;
                            const maskedUser = maskUsername(username, userRole);
                            const maskedName = realName ? maskCustomerName(realName, userRole) : '';
                            return (
                              <td
                                key={col.key}
                                className={`${cellPadding} whitespace-nowrap max-w-[160px] truncate`}
                                title={maskedName && maskedName !== maskedUser ? `${maskedUser} (${maskedName})` : maskedUser}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <div className="truncate flex flex-col min-w-0 leading-tight">
                                    <span className="truncate font-semibold text-slate-900">{renderHighlightedText(maskedUser)}</span>
                                    {maskedName && maskedName !== maskedUser && (
                                      <span className="text-[10px] text-slate-500 font-normal truncate">
                                        {renderHighlightedText(maskedName)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            );
                          }

                          if (col.key === 'productName') {
                            return (
                              <td key={col.key} className={`${cellPadding} font-bold text-slate-900 max-w-[170px] relative group/prod`}>
                                <div className="truncate cursor-pointer hover:text-blue-700 transition-colors">
                                  {renderHighlightedText(order.productName)}
                                </div>
                                <div className="absolute left-0 top-full mt-1.5 z-50 hidden group-hover/prod:block w-72 sm:w-80 p-3 bg-white text-slate-900 text-xs rounded-xl shadow-2xl border border-slate-200/90 pointer-events-none leading-snug whitespace-normal ring-1 ring-slate-900/5">
                                  <div className="text-[10px] text-blue-600 font-extrabold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <ShoppingBag className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span>Full Product Name</span>
                                  </div>
                                  <div className="font-bold text-slate-900 break-words">{order.productName}</div>
                                </div>
                              </td>
                            );
                          }

                          if (col.key === 'channel') {
                            const ch = getOrInferChannel(order);
                            const badgeStyle =
                              ch === 'Lazada'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : ch === 'WCG2U'
                                ? 'bg-amber-100 text-amber-950 border-amber-300 font-extrabold'
                                : 'bg-orange-50 text-orange-700 border-orange-200';
                            return (
                              <td key={col.key} className={`${cellPadding} whitespace-nowrap`}>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeStyle}`}>
                                  {ch}
                                </span>
                              </td>
                            );
                          }

                          if (col.key === 'totalAmount') {
                            const gmv = (order.costOfGoodsSold && order.costOfGoodsSold > 0) ? order.costOfGoodsSold : (order.totalAmount || 0);
                            return (
                              <td
                                key={col.key}
                                className={`${cellPadding} font-extrabold text-slate-900 text-xs whitespace-nowrap font-mono`}
                                title={`GMV Subtotal: ${fmtCurr(gmv)}`}
                              >
                                {fmtCurr(gmv)}
                              </td>
                            );
                          }

                          if (col.key === 'sellerVoucherDiscount') {
                            return (
                              <td key={col.key} className={`${cellPadding} text-blue-600 font-mono text-xs whitespace-nowrap font-medium`}>
                                {fmtCurr(order.sellerVoucherDiscount, true)}
                              </td>
                            );
                          }

                          if (col.key === 'commissionFee') {
                            return (
                              <td key={col.key} className={`${cellPadding} text-rose-600 font-mono text-xs whitespace-nowrap font-medium`}>
                                {fmtCurr(order.commissionFee, true)}
                              </td>
                            );
                          }

                          if (col.key === 'transactionFee') {
                            return (
                              <td key={col.key} className={`${cellPadding} text-amber-600 font-mono text-xs whitespace-nowrap font-medium`}>
                                {fmtCurr(order.transactionFee, true)}
                              </td>
                            );
                          }

                          if (col.key === 'adsEscrowFee') {
                            return (
                              <td key={col.key} className={`${cellPadding} text-purple-600 font-mono text-xs whitespace-nowrap font-medium`}>
                                {fmtCurr(order.adsEscrowFee, true)}
                              </td>
                            );
                          }

                          if (col.key === 'escrowAmount') {
                            return (
                              <td key={col.key} className={`${cellPadding} font-extrabold text-emerald-700 whitespace-nowrap font-mono`}>
                                {fmtCurr(calculateNetIncome(order))}
                              </td>
                            );
                          }

                          if (col.key === 'orderStatus') {
                            return (
                              <td key={col.key} className={`${cellPadding} whitespace-nowrap`}>
                                {renderStatusBadge(order.orderStatus)}
                              </td>
                            );
                          }

                          if (col.key === 'orderDate') {
                            return (
                              <td key={col.key} className={`${cellPadding} whitespace-nowrap text-slate-600 font-mono`}>
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                                  <span>{order.orderDate || 'N/A'}</span>
                                </div>
                              </td>
                            );
                          }

                          if (col.key === 'shipTime') {
                            const timeline = getTimelineTimestamps(order);
                            return (
                              <td key={col.key} className={`${cellPadding} whitespace-nowrap font-mono`}>
                                <div className="flex items-center gap-1">
                                  <Send className="w-3 h-3 text-sky-500 shrink-0" />
                                  <span className="text-slate-800 font-bold">
                                    {timeline.shipTime}
                                  </span>
                                </div>
                              </td>
                            );
                          }

                          if (col.key === 'deliveryTime') {
                            const timeline = getTimelineTimestamps(order);
                            return (
                              <td key={col.key} className={`${cellPadding} whitespace-nowrap font-mono`}>
                                <div className="flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                  <span className="text-slate-800 font-bold">
                                    {timeline.deliveryTime}
                                  </span>
                                </div>
                              </td>
                            );
                          }

                          if (col.key === 'buyerRace') {
                            return (
                              <td key={col.key} className={`${cellPadding} whitespace-nowrap text-xs`}>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  {order.buyerRace || 'Malay'}
                                </span>
                              </td>
                            );
                          }

                          if (col.key === 'paymentMethod') {
                            return (
                              <td key={col.key} className={`${cellPadding} whitespace-nowrap text-xs font-semibold text-slate-700`}>
                                <div className="flex items-center gap-1">
                                  <CreditCard className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{order.paymentMethod || 'ShopeePay'}</span>
                                </div>
                              </td>
                            );
                          }

                          if (col.key === 'quantity') {
                            return (
                              <td key={col.key} className={`${cellPadding} text-center font-bold text-slate-900 font-mono`}>
                                {order.quantity || 1}
                              </td>
                            );
                          }

                          const rawVal = order[col.key];
                          return (
                            <td key={col.key} className={`${cellPadding} whitespace-nowrap text-slate-700`}>
                              {rawVal !== undefined && rawVal !== null ? String(rawVal) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
