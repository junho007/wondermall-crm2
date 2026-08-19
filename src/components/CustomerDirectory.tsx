import React, { useState, useMemo } from 'react';
import { Users, Search, Phone, MapPin, Download, ShoppingBag, ShieldCheck, UserCheck, Calendar, Eye, FileText, ArrowUpDown, ArrowUp, ArrowDown, X, Globe } from 'lucide-react';
import { ShopeeOrder, UserRole } from '../types';
import { inferBuyerRace } from '../utils/raceHelper';
import { isCancelledOrder, isMaskedString } from '../utils/csvHelper';
import { OrderDetailsModal } from './OrderDetailsModal';
import { CustomDropdown } from './CustomDropdown';
import { maskCustomerName, maskUsername, maskPhone, maskAddress, maskPrice } from '../utils/maskHelper';

interface CustomerDirectoryProps {
  orders: ShopeeOrder[];
  onSelectOrder?: (order: ShopeeOrder) => void;
  userRole?: UserRole;
}

export const CustomerDirectory: React.FC<CustomerDirectoryProps> = ({ orders, userRole = 'admin' }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [selectedRace, setSelectedRace] = useState('All');
  const [inspectOrder, setInspectOrder] = useState<ShopeeOrder | null>(null);
  const [selectedCustomerUser, setSelectedCustomerUser] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; order: 'asc' | 'desc' }>({
    key: 'lastOrderDate',
    order: 'desc',
  });

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      order: prev.key === key ? (prev.order === 'asc' ? 'desc' : 'asc') : 'desc',
    }));
  };

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

  const countriesList = ['All', 'Malaysia', 'Singapore', 'China', 'Indonesia'];

  // Infer country from address or default to Malaysia
  const inferCountry = (addressStr: string): string => {
    const lower = (addressStr || '').toLowerCase();
    if (lower.includes('singapore') || lower.includes('sg')) return 'Singapore';
    if (lower.includes('china') || lower.includes('cn')) return 'China';
    if (lower.includes('indonesia') || lower.includes('id')) return 'Indonesia';
    return 'Malaysia';
  };

  // Aggregate customer records from orders list
  const customers = useMemo(() => {
    const customerMap = new Map<string, {
      username: string;
      name: string;
      phone: string;
      address: string;
      country: string;
      race: string;
      orderCount: number;
      totalSpent: number;
      lastOrderDate: string;
      purchasedItems: Set<string>;
    }>();

    orders.forEach((o) => {
      const usernameKey = (o.buyerUsername || 'Guest Customer').toLowerCase().trim().replace(/^@+/, '');
      const rawName = o.buyerName || o.recipientName || '';
      const nameVal = !isMaskedString(rawName) ? rawName : (o.buyerName || o.recipientName || o.buyerUsername || 'Shopee Customer');
      const phoneVal = o.buyerPhone || o.recipientPhone || 'N/A';
      const addressVal = o.shippingAddress || 'N/A';
      const countryVal = inferCountry(addressVal);
      const raceVal = inferBuyerRace(o);
      const isCancelled = isCancelledOrder(o);
      const amt = isCancelled ? 0 : (o.totalAmount || 0);
      const dateVal = o.orderDate || '';

      if (customerMap.has(usernameKey)) {
        const existing = customerMap.get(usernameKey)!;
        existing.orderCount += 1;
        existing.totalSpent += amt;
        if (o.productName) existing.purchasedItems.add(o.productName);
        if (dateVal && dateVal > existing.lastOrderDate) {
          existing.lastOrderDate = dateVal;
        }

        // Upgrade to unmasked real name and ethnicity if available
        if (!isMaskedString(o.buyerName)) {
          existing.name = o.buyerName;
          existing.race = inferBuyerRace(o);
        } else if (!isMaskedString(o.recipientName) && isMaskedString(existing.name)) {
          existing.name = o.recipientName;
          existing.race = inferBuyerRace(o);
        }

        // Upgrade to unmasked real phone if available
        if (!isMaskedString(o.buyerPhone) && o.buyerPhone !== 'N/A') {
          existing.phone = o.buyerPhone;
        } else if (!isMaskedString(o.recipientPhone) && o.recipientPhone !== 'N/A' && isMaskedString(existing.phone)) {
          existing.phone = o.recipientPhone;
        }

        // Upgrade to unmasked address and country if available
        if (!isMaskedString(o.shippingAddress) && o.shippingAddress !== 'N/A' && (isMaskedString(existing.address) || existing.address === 'N/A')) {
          existing.address = o.shippingAddress;
          existing.country = inferCountry(o.shippingAddress);
        }

        // Upgrade username if clean
        if (!isMaskedString(o.buyerUsername) && isMaskedString(existing.username)) {
          existing.username = o.buyerUsername.replace(/^@+/, '');
        }
      } else {
        const itemSet = new Set<string>();
        if (o.productName) itemSet.add(o.productName);
        customerMap.set(usernameKey, {
          username: (o.buyerUsername || 'Guest').replace(/^@+/, ''),
          name: nameVal,
          phone: phoneVal,
          address: addressVal,
          country: countryVal,
          race: raceVal,
          orderCount: 1,
          totalSpent: amt,
          lastOrderDate: dateVal,
          purchasedItems: itemSet,
        });
      }
    });

    return Array.from(customerMap.values()).sort((a, b) => {
      const timeA = a.lastOrderDate ? new Date(a.lastOrderDate.replace(' ', 'T')).getTime() || 0 : 0;
      const timeB = b.lastOrderDate ? new Date(b.lastOrderDate.replace(' ', 'T')).getTime() || 0 : 0;
      return timeB - timeA;
    });
  }, [orders]);

  // Filter & Sort Customers
  const filteredCustomers = useMemo(() => {
    const filtered = customers.filter((c) => {
      if (selectedCountry !== 'All' && c.country !== selectedCountry) return false;
      if (selectedRace !== 'All' && c.race !== selectedRace) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchUser = c.username.toLowerCase().includes(q);
        const matchName = c.name.toLowerCase().includes(q);
        const matchPhone = c.phone.toLowerCase().includes(q);
        const matchAddr = c.address.toLowerCase().includes(q);
        const matchCountry = c.country.toLowerCase().includes(q);
        return matchUser || matchName || matchPhone || matchAddr || matchCountry;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      let valA: any = a[sortConfig.key as keyof typeof a];
      let valB: any = b[sortConfig.key as keyof typeof b];

      if (sortConfig.key === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortConfig.key === 'lastOrderDate') {
        valA = a.lastOrderDate ? new Date(a.lastOrderDate.replace(' ', 'T')).getTime() || 0 : 0;
        valB = b.lastOrderDate ? new Date(b.lastOrderDate.replace(' ', 'T')).getTime() || 0 : 0;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortConfig.order === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA || '').toLowerCase();
      const strB = String(valB || '').toLowerCase();
      return strA < strB
        ? sortConfig.order === 'asc' ? -1 : 1
        : strA > strB
        ? sortConfig.order === 'asc' ? 1 : -1
        : 0;
    });
  }, [customers, searchQuery, selectedCountry, selectedRace, sortConfig]);

  // Active Selected Customer & Customer Orders List
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerUser) return null;
    const target = selectedCustomerUser.toLowerCase().trim().replace(/^@+/, '');
    return customers.find((c) => c.username.toLowerCase().trim().replace(/^@+/, '') === target) || null;
  }, [customers, selectedCustomerUser]);

  const selectedCustomerOrders = useMemo(() => {
    if (!selectedCustomerUser) return [];
    const target = selectedCustomerUser.toLowerCase().trim().replace(/^@+/, '');
    return orders
      .filter((o) => (o.buyerUsername || '').toLowerCase().trim().replace(/^@+/, '') === target)
      .sort((a, b) => {
        const timeA = a.orderDate ? new Date(a.orderDate.replace(' ', 'T')).getTime() || 0 : 0;
        const timeB = b.orderDate ? new Date(b.orderDate.replace(' ', 'T')).getTime() || 0 : 0;
        return timeB - timeA;
      });
  }, [orders, selectedCustomerUser]);

  // Export Customer List to CSV
  const handleExportCustomersCSV = () => {
    const csvRows = [
      ['Buyer Username', 'Buyer Name', 'Phone Number', 'Country', 'Ethnicity', 'Full Address', 'Total Orders', 'Lifetime Value (RM)', 'Last Order Date'].join(','),
      ...filteredCustomers.map((c) => [
        `"${maskUsername(c.username, userRole).replace(/"/g, '""')}"`,
        `"${maskCustomerName(c.name, userRole).replace(/"/g, '""')}"`,
        `"${maskPhone(c.phone, userRole).replace(/"/g, '""')}"`,
        `"${c.country.replace(/"/g, '""')}"`,
        `"${c.race.replace(/"/g, '""')}"`,
        `"${maskAddress(c.address, userRole).replace(/"/g, '""')}"`,
        c.orderCount,
        maskPrice(c.totalSpent, userRole, (val) => val.toFixed(2)),
        `"${c.lastOrderDate}"`,
      ].join(',')),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `shopee_customers_directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 w-full">
      {/* Filter Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer username, name, phone, address..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs font-semibold bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
          />
        </div>

        {/* Country Dropdown */}
        <CustomDropdown
          label="Country"
          icon={<Globe className="w-3.5 h-3.5" />}
          options={countriesList.map((ct) => ({
            value: ct,
            label: ct === 'All' ? 'All Countries' : ct,
          }))}
          value={selectedCountry}
          onChange={setSelectedCountry}
        />

        {/* Ethnicity Dropdown */}
        <CustomDropdown
          label="Ethnicity"
          icon={<UserCheck className="w-3.5 h-3.5" />}
          options={[
            { value: 'All', label: 'All Ethnicities' },
            { value: 'Malay', label: 'Malay' },
            { value: 'Chinese', label: 'Chinese' },
            { value: 'Indian', label: 'Indian' },
            { value: 'Bumiputera Sabah/Sarawak', label: 'Bumiputera Sabah/Sarawak' },
            { value: 'Other', label: 'Other' },
          ]}
          value={selectedRace}
          onChange={setSelectedRace}
        />

        <div className="flex items-center gap-3 ml-auto flex-wrap">
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
            Matched Records: <strong className="text-blue-700 font-extrabold">{filteredCustomers.length}</strong>
          </span>

          <button
            type="button"
            onClick={handleExportCustomersCSV}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Customer Directory CSV</span>
          </button>
        </div>
      </div>

      {/* Customers Data Table (NO ACTION COLUMN) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                <th onClick={() => handleSort('name')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>Buyer Profile</span>
                    {renderSortIcon('name')}
                  </div>
                </th>
                <th onClick={() => handleSort('phone')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>Contact Phone</span>
                    {renderSortIcon('phone')}
                  </div>
                </th>
                <th onClick={() => handleSort('country')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>Country / Location</span>
                    {renderSortIcon('country')}
                  </div>
                </th>
                <th onClick={() => handleSort('race')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>Ethnicity</span>
                    {renderSortIcon('race')}
                  </div>
                </th>
                <th onClick={() => handleSort('orderCount')} className="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Total Orders</span>
                    {renderSortIcon('orderCount')}
                  </div>
                </th>
                <th onClick={() => handleSort('totalSpent')} className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Lifetime Spent (LTV)</span>
                    {renderSortIcon('totalSpent')}
                  </div>
                </th>
                <th onClick={() => handleSort('lastOrderDate')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>Last Order</span>
                    {renderSortIcon('lastOrderDate')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    No customer records found matching search filters.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c, idx) => {
                  const maskedName = maskCustomerName(c.name, userRole);
                  const maskedUser = maskUsername(c.username, userRole);
                  const maskedPh = maskPhone(c.phone, userRole);
                  const maskedAddr = maskAddress(c.address, userRole);
                  const maskedLtv = maskPrice(c.totalSpent, userRole, (val) => `RM ${val.toFixed(2)}`);

                  return (
                    <tr
                      key={idx}
                      onClick={() => setSelectedCustomerUser(c.username)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{maskedName}</div>
                          <div className="text-[11px] text-blue-600 font-mono font-semibold">@{maskedUser}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-slate-800">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{maskedPh}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-800">
                          <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="font-bold">{c.country}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{maskedAddr}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {c.race}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">
                        {c.orderCount}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 font-mono">
                        {maskedLtv}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {c.lastOrderDate || 'N/A'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CUSTOMER PROFILE & ORDERS HISTORY MODAL */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-3xl rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 aspect-square shrink-0 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                      Customer Profile: {maskCustomerName(selectedCustomer.name, userRole)}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300 font-mono">
                      @{maskUsername(selectedCustomer.username, userRole)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Shopee Buyer Record &bull; {selectedCustomer.orderCount} Total Order{selectedCustomer.orderCount > 1 ? 's' : ''} Placed
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomerUser(null)}
                className="p-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Customer Info Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span>Buyer Overview &amp; Contact Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Buyer Full Name</span>
                    <span className="font-bold text-slate-900 text-sm">{maskCustomerName(selectedCustomer.name, userRole)}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact Phone</span>
                    <span className="font-bold font-mono text-slate-900 text-sm">{maskPhone(selectedCustomer.phone, userRole)}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Ethnicity</span>
                    <span className="font-bold text-slate-900">{selectedCustomer.race}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Country</span>
                    <span className="font-bold text-slate-900">{selectedCustomer.country}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 sm:col-span-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Shipping Address</span>
                    <span className="font-medium text-slate-800 line-clamp-2">{maskAddress(selectedCustomer.address, userRole)}</span>
                  </div>
                </div>

                {/* Customer LTV & Orders Metrics Summary */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200 text-center">
                  <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
                    <span className="text-[10px] uppercase font-extrabold text-blue-700 block">Total Orders</span>
                    <span className="text-base font-black text-blue-950">{selectedCustomer.orderCount}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] uppercase font-extrabold text-emerald-700 block">Lifetime Spent (LTV)</span>
                    <span className="text-base font-black font-mono text-emerald-950">{maskPrice(selectedCustomer.totalSpent, userRole, (val) => `RM ${val.toFixed(2)}`)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-100 border border-slate-200">
                    <span className="text-[10px] uppercase font-extrabold text-slate-600 block">Last Order Date</span>
                    <span className="text-xs font-bold font-mono text-slate-800">{selectedCustomer.lastOrderDate || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* All Orders Table List (NO ACTION COLUMN, Shorter Product Column with Hover) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                    <span>All Orders for this Customer ({selectedCustomerOrders.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                    Click any order row to inspect full order breakdown
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl bg-white shadow-2xs relative">
                  <div className="overflow-visible">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                          <th className="py-2.5 px-3">Order SN / ID</th>
                          <th className="py-2.5 px-3">Order Date</th>
                          <th className="py-2.5 px-3 max-w-[150px]">Product Item</th>
                          <th className="py-2.5 px-3 text-right">Total Amount</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {selectedCustomerOrders.map((ord, idx) => {
                          const statusStyle =
                            ord.orderStatus === 'Completed'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                              : ord.orderStatus === 'Cancelled'
                              ? 'bg-rose-50 text-rose-800 border-rose-300 font-bold'
                              : ord.orderStatus === 'Unpaid'
                              ? 'bg-amber-50 text-amber-800 border-amber-300 font-bold'
                              : 'bg-slate-100 text-slate-800 border-slate-300';

                          return (
                            <tr
                              key={idx}
                              onClick={() => setInspectOrder(ord)}
                              className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                            >
                              <td className="py-3 px-3">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setInspectOrder(ord);
                                  }}
                                  className="font-mono text-blue-600 font-bold hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                                  title="Click to view order details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>{ord.orderSn}</span>
                                </button>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                                {ord.orderDate || 'N/A'}
                              </td>
                              <td className="py-3 px-3 max-w-[180px] relative group/prod">
                                <div className="font-bold text-slate-900 truncate cursor-pointer hover:text-blue-700 transition-colors">
                                  {ord.productName}
                                </div>
                                {/* Hover Preview Tooltip matching Order Management */}
                                <div className="absolute left-0 bottom-full mb-1.5 z-50 hidden group-hover/prod:block w-72 sm:w-80 p-3 bg-white text-slate-900 text-xs rounded-xl shadow-2xl border border-slate-200/90 pointer-events-none leading-snug whitespace-normal ring-1 ring-slate-900/5">
                                  <div className="text-[10px] text-blue-600 font-extrabold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <ShoppingBag className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span>FULL PRODUCT NAME</span>
                                  </div>
                                  <div className="font-bold text-slate-900 break-words">{ord.productName}</div>
                                </div>
                                {ord.channel && (
                                  <span className="text-[10px] text-slate-400 font-medium block">
                                    Channel: {ord.channel}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-black font-mono text-emerald-600 whitespace-nowrap">
                                {maskPrice(ord.totalAmount, userRole, (val) => `RM ${val.toFixed(2)}`)}
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] border uppercase ${statusStyle}`}>
                                  {ord.orderStatus || 'Completed'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-INSPECTOR: Order Details Modal with Back button */}
      {inspectOrder && (
        <OrderDetailsModal
          order={inspectOrder}
          onClose={() => setInspectOrder(null)}
          onBack={() => setInspectOrder(null)}
          backLabel="Back"
          userRole={userRole}
        />
      )}
    </div>
  );
};
