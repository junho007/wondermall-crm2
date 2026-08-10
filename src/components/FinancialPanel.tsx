import React, { useState, useMemo } from 'react';
import { Wallet, DollarSign, ShieldCheck, Tag, Receipt, TrendingDown, ArrowDownRight, Eye, ArrowUpDown, ArrowUp, ArrowDown, ShoppingBag } from 'lucide-react';
import { ShopeeOrder, DatePreset, SortConfig, ColumnDefinition, UserRole } from '../types';
import { calculateNetIncome, getTimelineTimestamps, getOrInferChannel, isCancelledOrder } from '../utils/csvHelper';
import { maskCustomerName, maskUsername, maskPrice } from '../utils/maskHelper';
import { OrderDetailsModal } from './OrderDetailsModal';
import { StatusFilterTabs } from './StatusFilterTabs';

interface FinancialPanelProps {
  orders: ShopeeOrder[];
  columns?: ColumnDefinition[];
  onToggleColumn?: (key: string) => void;
  onResetColumns?: () => void;
  onSelectOrder?: (order: ShopeeOrder) => void;
  tableRowDensity?: 'compact' | 'comfortable' | 'spacious';
  currencyPrefix?: 'RM' | 'MYR' | 'PLAIN';
  csFinancialShield?: boolean;
  userRole?: UserRole;
}

export const FinancialPanel: React.FC<FinancialPanelProps> = ({
  orders,
  columns,
  onToggleColumn,
  onResetColumns,
  onSelectOrder,
  tableRowDensity = 'comfortable',
  currencyPrefix = 'RM',
  csFinancialShield = false,
  userRole = 'admin',
}) => {
  const [inspectOrder, setInspectOrder] = useState<ShopeeOrder | null>(null);

  // Dynamic Density Padding
  const cellPadding = useMemo(() => {
    if (tableRowDensity === 'compact') return 'py-1.5 px-3 text-xs';
    if (tableRowDensity === 'spacious') return 'py-4 px-5 text-xs';
    return 'py-2.5 px-4 text-xs'; // comfortable
  }, [tableRowDensity]);

  const headerPadding = useMemo(() => {
    if (tableRowDensity === 'compact') return 'py-2 px-3 text-xs';
    if (tableRowDensity === 'spacious') return 'py-4 px-5 text-xs';
    return 'py-3 px-4 text-xs'; // comfortable
  }, [tableRowDensity]);

  // Format Currency Helper
  const fmtCurr = (amount: number | undefined | null, isNegative = false) => {
    const val = (amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (currencyPrefix === 'MYR') return `${isNegative ? '- MYR ' : 'MYR '}${val}`;
    if (currencyPrefix === 'PLAIN') return `${isNegative ? '-' : ''}${val}`;
    return `${isNegative ? '- RM ' : 'RM '}${val}`;
  };

  // Column visibility flags
  const isOrderSnVisible = columns ? (columns.find((c) => c.key === 'orderSn')?.visible ?? true) : true;
  const isBuyerVisible = columns ? (columns.find((c) => c.key === 'buyerUsername')?.visible ?? true) : true;
  const isProductVisible = columns ? (columns.find((c) => c.key === 'productName')?.visible ?? true) : true;
  const isChannelVisible = columns ? (columns.find((c) => c.key === 'channel')?.visible ?? true) : true;
  const isDateVisible = columns ? (columns.find((c) => c.key === 'orderDate')?.visible ?? true) : true;
  const isGmvVisible = columns ? (columns.find((c) => c.key === 'totalAmount')?.visible ?? true) : true;
  const isVoucherVisible = columns ? (columns.find((c) => c.key === 'sellerVoucherDiscount')?.visible ?? true) : true;
  const isCommVisible = columns ? (columns.find((c) => c.key === 'commissionFee')?.visible ?? true) : true;
  const isTxnVisible = columns ? (columns.find((c) => c.key === 'transactionFee')?.visible ?? true) : true;
  const isSvcVisible = columns ? (columns.find((c) => c.key === 'serviceFee')?.visible ?? true) : true;
  const isAdsVisible = columns ? (columns.find((c) => c.key === 'adsEscrowFee')?.visible ?? true) : true;
  const isNetEscrowVisible = columns ? (columns.find((c) => c.key === 'escrowAmount')?.visible ?? true) : true;

  // Filters State
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['All']);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['All']);
  const [selectedStates, setSelectedStates] = useState<string[]>(['All']);
  const [selectedRaces, setSelectedRaces] = useState<string[]>(['All']);

  // Date Range Filter State
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Default Sort: Newest/latest order on top (orderDate desc)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'orderDate', order: 'desc' });

  const handleSelectDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const today = new Date();

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const dateStr = today.toISOString().split('T')[0];
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else if (preset === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const dateStr = y.toISOString().split('T')[0];
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else if (preset === 'last7') {
      const past = new Date(today);
      past.setDate(today.getDate() - 7);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'last30') {
      const past = new Date(today);
      past.setDate(today.getDate() - 30);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    }
  };

  const handleResetFilters = () => {
    setSelectedStatuses(['All']);
    setSearchQuery('');
    setSelectedCategories(['All']);
    setSelectedStates(['All']);
    setSelectedRaces(['All']);
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setSortConfig({ key: 'orderDate', order: 'desc' });
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { key, order: 'desc' };
    });
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter (multi-select)
      if (selectedStatuses.length > 0 && !selectedStatuses.includes('All')) {
        if (!selectedStatuses.includes(order.orderStatus)) return false;
      }

      // Category filter (multi-select)
      if (selectedCategories.length > 0 && !selectedCategories.includes('All')) {
        const prod = (order.productName || '').toLowerCase();
        const matches = selectedCategories.some((cat) => prod.includes(cat.toLowerCase()));
        if (!matches) return false;
      }

      // State filter (multi-select)
      if (selectedStates.length > 0 && !selectedStates.includes('All')) {
        const addr = (order.shippingAddress || '').toLowerCase();
        const matches = selectedStates.some((st) => addr.includes(st.toLowerCase()));
        if (!matches) return false;
      }

      if (startDate || endDate) {
        if (!order.orderDate) return false;
        const orderDateOnly = order.orderDate.substring(0, 10);
        if (startDate && orderDateOnly < startDate) return false;
        if (endDate && orderDateOnly > endDate) return false;
      }

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchSn = (order.orderSn || '').toLowerCase().includes(q);
        const matchUser = (order.buyerUsername || '').toLowerCase().includes(q);
        const matchName = (order.buyerName || order.recipientName || '').toLowerCase().includes(q);
        const matchProd = (order.productName || '').toLowerCase().includes(q);
        const matchPhone = (order.buyerPhone || '').toLowerCase().includes(q);

        if (!matchSn && !matchUser && !matchName && !matchProd && !matchPhone) {
          return false;
        }
      }

      return true;
    });
  }, [orders, selectedStatuses, selectedCategories, selectedStates, searchQuery, startDate, endDate]);

  // Sorted Orders (Default: Newest Order Date on top)
  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const key = sortConfig.key;

      if (key === 'orderDate' || key === 'shipTime' || key === 'deliveryTime') {
        const timeA = a[key] ? new Date(a[key]!.replace(' ', 'T')).getTime() || 0 : 0;
        const timeB = b[key] ? new Date(b[key]!.replace(' ', 'T')).getTime() || 0 : 0;
        if (timeA !== timeB) {
          return sortConfig.order === 'asc' ? timeA - timeB : timeB - timeA;
        }
      }

      if (key === 'netEscrow') {
        const valA = calculateNetIncome(a);
        const valB = calculateNetIncome(b);
        return sortConfig.order === 'asc' ? valA - valB : valB - valA;
      }

      let valA = a[key as keyof ShopeeOrder];
      let valB = b[key as keyof ShopeeOrder];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortConfig.order === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      if (strA < strB) return sortConfig.order === 'asc' ? -1 : 1;
      if (strA > strB) return sortConfig.order === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredOrders, sortConfig]);

  // KPI Calculations on Filtered Orders (excluding cancelled orders from revenue & fees)
  const activeFilteredOrders = useMemo(() => filteredOrders.filter((o) => !isCancelledOrder(o)), [filteredOrders]);
  const completedOrders = useMemo(() => filteredOrders.filter((o) => o.orderStatus === 'Completed'), [filteredOrders]);

  const totalGrossGMV = useMemo(() => activeFilteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0), [activeFilteredOrders]);
  const totalCompletedEscrow = useMemo(() => completedOrders.reduce((sum, o) => sum + calculateNetIncome(o), 0), [completedOrders]);
  const totalCommissionFees = useMemo(() => activeFilteredOrders.reduce((sum, o) => sum + (o.commissionFee || 0), 0), [activeFilteredOrders]);
  const totalTransactionFees = useMemo(() => activeFilteredOrders.reduce((sum, o) => sum + (o.transactionFee || 0), 0), [activeFilteredOrders]);
  const totalAdsFees = useMemo(() => activeFilteredOrders.reduce((sum, o) => sum + (o.adsEscrowFee || 0), 0), [activeFilteredOrders]);
  const totalSellerVouchers = useMemo(() => activeFilteredOrders.reduce((sum, o) => sum + (o.sellerVoucherDiscount || 0), 0), [activeFilteredOrders]);
  const totalServiceFees = useMemo(() => activeFilteredOrders.reduce((sum, o) => sum + (o.serviceFee || 0), 0), [activeFilteredOrders]);

  const pageTotalGmv = useMemo(() => {
    return sortedOrders.filter((o) => !isCancelledOrder(o)).reduce((sum, o) => {
      const gmv = (o.costOfGoodsSold && o.costOfGoodsSold > 0) ? o.costOfGoodsSold : (o.totalAmount || 0);
      return sum + gmv;
    }, 0);
  }, [sortedOrders]);

  const pageTotalNetEscrow = useMemo(() => {
    return sortedOrders.filter((o) => !isCancelledOrder(o)).reduce((sum, o) => sum + calculateNetIncome(o), 0);
  }, [sortedOrders]);

  const handleRowClick = (order: ShopeeOrder) => {
    if (onSelectOrder) {
      onSelectOrder(order);
    } else {
      setInspectOrder(order);
    }
  };

  const renderSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    }
    return sortConfig.order === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-600 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-600 font-bold" />
    );
  };

  return (
    <div className="space-y-4 w-full animate-fade-in">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Financial &amp; Escrow Payout Analytics
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Comprehensive breakdown of Shopee seller escrow payouts, vouchers &amp; rebates, platform fees, and net bank deposits.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Escrow Released */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Net Escrow Released</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {csFinancialShield ? '[ SHIELDED ]' : fmtCurr(totalCompletedEscrow)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Deposited to Wallet ({completedOrders.length} Completed Orders)
          </p>
        </div>

        {/* Commission & Service Fees */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Commission &amp; Service Fee</span>
            <Receipt className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2 font-mono">
            {fmtCurr(totalCommissionFees + totalServiceFees, true)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Comm ({fmtCurr(totalCommissionFees)}) + Service ({fmtCurr(totalServiceFees)})
          </p>
        </div>

        {/* Transaction Fees */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Payment Transaction Fee</span>
            <ArrowDownRight className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2 font-mono">
            {fmtCurr(totalTransactionFees, true)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Gateway &amp; Payment Processing Charges</p>
        </div>

        {/* Vouchers & Ads Escrow */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
            <span>Vouchers &amp; Ads Escrow</span>
            <Tag className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {fmtCurr(totalSellerVouchers + totalAdsFees)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Voucher ({fmtCurr(totalSellerVouchers)}) + Ads ({fmtCurr(totalAdsFees)})
          </p>
        </div>
      </div>

      {/* Filter & Search Bar Component */}
      <StatusFilterTabs
        orders={orders}
        selectedStatuses={selectedStatuses}
        onSelectStatuses={setSelectedStatuses}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategories={selectedCategories}
        onSelectCategories={setSelectedCategories}
        selectedStates={selectedStates}
        onSelectStates={setSelectedStates}
        selectedRaces={selectedRaces}
        onSelectRaces={setSelectedRaces}
        onResetFilters={handleResetFilters}
        filteredCount={filteredOrders.length}
        columns={columns}
        onToggleColumn={onToggleColumn}
        onResetColumns={onResetColumns}
        datePreset={datePreset}
        onSelectDatePreset={handleSelectDatePreset}
        startDate={startDate}
        endDate={endDate}
        onChangeStartDate={setStartDate}
        onChangeEndDate={setEndDate}
      />

      {/* Escrow Orders Table Breakdown */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden relative">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span>Escrow Settlement Audit History</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black">
              Default: Latest Order First
            </span>
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">
            Click any row to open full Order Details Inspector
          </span>
        </div>

        {/* STICKY TOP TABLE SUMMARY BAR */}
        <div className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-md border-b-2 border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 font-bold text-xs text-slate-800 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-slate-800 text-white text-[10px] uppercase font-black tracking-wider">
              PAGE TOTAL
            </span>
            <span className="text-slate-600 font-medium">
              Showing {sortedOrders.length} order{sortedOrders.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-extrabold block">Page Released Escrow:</span>
              <span className="text-sm font-black text-emerald-700 font-mono">
                {csFinancialShield ? '[ SHIELDED ]' : fmtCurr(pageTotalNetEscrow)}
              </span>
            </div>
            <div className="text-right bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-xs">
              <span className="text-[10px] uppercase tracking-wider text-blue-600 font-extrabold block">Page Gross Revenue (GMV):</span>
              <span className="text-base font-black text-slate-900 font-mono">
                {csFinancialShield ? '[ SHIELDED ]' : fmtCurr(pageTotalGmv)}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-medium text-slate-700">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-600">
                {isOrderSnVisible && (
                  <th onClick={() => handleSort('orderSn')} className={`${headerPadding} cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap`}>
                    <div className="flex items-center gap-1">
                      <span>Order SN</span>
                      {renderSortIcon('orderSn')}
                    </div>
                  </th>
                )}
                {isProductVisible && (
                  <th onClick={() => handleSort('productName')} className={`${headerPadding} cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap`}>
                    <div className="flex items-center gap-1">
                      <span>Product Name</span>
                      {renderSortIcon('productName')}
                    </div>
                  </th>
                )}
                {isChannelVisible && (
                  <th onClick={() => handleSort('channel')} className={`${headerPadding} cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap`}>
                    <div className="flex items-center gap-1">
                      <span>Channel</span>
                      {renderSortIcon('channel')}
                    </div>
                  </th>
                )}
                {isBuyerVisible && (
                  <th onClick={() => handleSort('buyerUsername')} className={`${headerPadding} cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap`}>
                    <div className="flex items-center gap-1">
                      <span>Buyer</span>
                      {renderSortIcon('buyerUsername')}
                    </div>
                  </th>
                )}
                {isDateVisible && (
                  <th onClick={() => handleSort('orderDate')} className={`${headerPadding} cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap`}>
                    <div className="flex items-center gap-1">
                      <span>Order Date</span>
                      {renderSortIcon('orderDate')}
                    </div>
                  </th>
                )}
                {isGmvVisible && (
                  <th onClick={() => handleSort('totalAmount')} className={`${headerPadding} text-right cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap`}>
                    <div className="flex items-center justify-end gap-1">
                      <span>GMV Subtotal</span>
                      {renderSortIcon('totalAmount')}
                    </div>
                  </th>
                )}
                {isVoucherVisible && (
                  <th onClick={() => handleSort('sellerVoucherDiscount')} className={`${headerPadding} text-right cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap`}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Vouchers</span>
                      {renderSortIcon('sellerVoucherDiscount')}
                    </div>
                  </th>
                )}
                {isCommVisible && (
                  <th onClick={() => handleSort('commissionFee')} className={`${headerPadding} text-right cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap`}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Comm Fee</span>
                      {renderSortIcon('commissionFee')}
                    </div>
                  </th>
                )}
                {isTxnVisible && (
                  <th onClick={() => handleSort('transactionFee')} className={`${headerPadding} text-right cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap`}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Txn Fee</span>
                      {renderSortIcon('transactionFee')}
                    </div>
                  </th>
                )}
                {isSvcVisible && (
                  <th onClick={() => handleSort('serviceFee')} className={`${headerPadding} text-right cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap`}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Svc Fee</span>
                      {renderSortIcon('serviceFee')}
                    </div>
                  </th>
                )}
                {isAdsVisible && (
                  <th onClick={() => handleSort('adsEscrowFee')} className={`${headerPadding} text-right cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap`}>
                    <div className="flex items-center justify-end gap-1">
                      <span>Ads Fee</span>
                      {renderSortIcon('adsEscrowFee')}
                    </div>
                  </th>
                )}
                {isNetEscrowVisible && (
                  <th onClick={() => handleSort('netEscrow')} className={`${headerPadding} text-right cursor-pointer hover:bg-slate-200/60 transition-colors whitespace-nowrap bg-emerald-50/50`}>
                    <div className="flex items-center justify-end gap-1 text-emerald-800 font-extrabold">
                      <span>Net Escrow</span>
                      {renderSortIcon('netEscrow')}
                    </div>
                  </th>
                )}
                <th className={`${headerPadding} text-center whitespace-nowrap`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400 font-medium italic">
                    No matching order escrow records found.
                  </td>
                </tr>
              ) : (
                sortedOrders.map((o) => {
                  const netEscrow = calculateNetIncome(o);
                  const rawBuyerName = o.buyerName || o.recipientName;
                  const rawUsername = o.buyerUsername || 'Shopee Customer';
                  const buyerName = maskCustomerName(rawBuyerName, userRole);
                  const username = maskUsername(rawUsername, userRole);
                  const gmv = (o.costOfGoodsSold && o.costOfGoodsSold > 0) ? o.costOfGoodsSold : (o.totalAmount || 0);

                  return (
                    <tr
                      key={o.orderSn || o.id}
                      onClick={() => handleRowClick(o)}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    >
                      {isOrderSnVisible && (
                        <td className={`${cellPadding} font-mono font-bold text-blue-700 whitespace-nowrap group-hover:underline`}>
                          {o.orderSn}
                        </td>
                      )}

                      {isProductVisible && (
                        <td className={`${cellPadding} max-w-[170px] relative group/prod font-bold text-slate-900`} title={o.productName}>
                          <div className="truncate cursor-pointer hover:text-blue-700 transition-colors">
                            {o.productName}
                          </div>
                          <div className="absolute left-0 top-full mt-1.5 z-50 hidden group-hover/prod:block w-72 sm:w-80 p-3 bg-white text-slate-900 text-xs rounded-xl shadow-2xl border border-slate-200/90 pointer-events-none leading-snug whitespace-normal ring-1 ring-slate-900/5">
                            <div className="text-[10px] text-blue-600 font-extrabold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                              <ShoppingBag className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>Full Product Name</span>
                            </div>
                            <div className="font-bold text-slate-900 break-words">{o.productName}</div>
                          </div>
                        </td>
                      )}

                      {isChannelVisible && (
                        <td className={`${cellPadding} whitespace-nowrap`}>
                          {(() => {
                            const ch = getOrInferChannel(o);
                            const badgeStyle =
                              ch === 'Lazada'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : ch === 'WCG2U'
                                ? 'bg-amber-100 text-amber-950 border-amber-300 font-extrabold'
                                : 'bg-orange-50 text-orange-700 border-orange-200';
                            return (
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeStyle}`}>
                                {ch}
                              </span>
                            );
                          })()}
                        </td>
                      )}

                      {isBuyerVisible && (
                        <td className={`${cellPadding} max-w-[140px] truncate`} title={buyerName && buyerName !== username ? `${username} (${buyerName})` : username}>
                          <div className="font-semibold text-slate-900 truncate">@{username}</div>
                          {buyerName && buyerName !== username && (
                            <div className="text-[10px] text-slate-500 font-normal truncate">{buyerName}</div>
                          )}
                        </td>
                      )}

                      {isDateVisible && (
                        <td className={`${cellPadding} font-mono text-[11px] text-slate-600 whitespace-nowrap`}>
                          {o.orderDate || 'N/A'}
                        </td>
                      )}

                      {isGmvVisible && (
                        <td className={`${cellPadding} text-right font-bold text-slate-900 font-mono whitespace-nowrap`}>
                          {fmtCurr(gmv)}
                        </td>
                      )}

                      {isVoucherVisible && (
                        <td className={`${cellPadding} text-right text-blue-600 font-mono whitespace-nowrap font-medium`}>
                          {fmtCurr(o.sellerVoucherDiscount, true)}
                        </td>
                      )}

                      {isCommVisible && (
                        <td className={`${cellPadding} text-right text-rose-600 font-mono whitespace-nowrap font-medium`}>
                          {fmtCurr(o.commissionFee, true)}
                        </td>
                      )}

                      {isTxnVisible && (
                        <td className={`${cellPadding} text-right text-amber-600 font-mono whitespace-nowrap font-medium`}>
                          {fmtCurr(o.transactionFee, true)}
                        </td>
                      )}

                      {isSvcVisible && (
                        <td className={`${cellPadding} text-right text-rose-700 font-mono whitespace-nowrap font-medium`}>
                          {fmtCurr(o.serviceFee, true)}
                        </td>
                      )}

                      {isAdsVisible && (
                        <td className={`${cellPadding} text-right text-purple-600 font-mono whitespace-nowrap font-medium`}>
                          {fmtCurr(o.adsEscrowFee, true)}
                        </td>
                      )}

                      {isNetEscrowVisible && (
                        <td className={`${cellPadding} text-right font-black text-emerald-700 font-mono text-sm whitespace-nowrap bg-emerald-50/30`}>
                          {csFinancialShield ? '[ SHIELDED ]' : fmtCurr(netEscrow)}
                        </td>
                      )}

                      <td className={`${cellPadding} text-center whitespace-nowrap`}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(o);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Internal Modal Fallback */}
      {inspectOrder && (
        <OrderDetailsModal
          order={inspectOrder}
          onClose={() => setInspectOrder(null)}
          userRole={userRole}
        />
      )}
    </div>
  );
};
