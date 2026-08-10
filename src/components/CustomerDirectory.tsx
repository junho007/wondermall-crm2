import React, { useState, useMemo } from 'react';
import { Users, Search, Phone, MapPin, Download, ShoppingBag, ShieldCheck, UserCheck, Calendar, Eye, FileText, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ShopeeOrder } from '../types';
import { getStateFromAddress } from '../utils/addressHelper';
import { inferBuyerRace } from '../utils/raceHelper';
import { isCancelledOrder } from '../utils/csvHelper';
import { OrderDetailsModal } from './OrderDetailsModal';
import { CustomDropdown, OptionItem } from './CustomDropdown';

interface CustomerDirectoryProps {
  orders: ShopeeOrder[];
  onSelectOrder?: (order: ShopeeOrder) => void;
}

export const CustomerDirectory: React.FC<CustomerDirectoryProps> = ({ orders, onSelectOrder }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('All');
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

  // Aggregate customer records from orders list
  const customers = useMemo(() => {
    const customerMap = new Map<string, {
      username: string;
      name: string;
      phone: string;
      address: string;
      state: string;
      race: string;
      orderCount: number;
      totalSpent: number;
      lastOrderDate: string;
      purchasedItems: Set<string>;
    }>();

    orders.forEach((o) => {
      const usernameKey = (o.buyerUsername || 'Guest Customer').toLowerCase().trim();
      const nameVal = o.buyerName || o.recipientName || o.buyerUsername || 'Shopee Customer';
      const phoneVal = o.buyerPhone || o.recipientPhone || 'N/A';
      const addressVal = o.shippingAddress || 'N/A';
      const stateVal = getStateFromAddress(addressVal);
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
      } else {
        const itemSet = new Set<string>();
        if (o.productName) itemSet.add(o.productName);
        customerMap.set(usernameKey, {
          username: o.buyerUsername || 'Guest',
          name: nameVal,
          phone: phoneVal,
          address: addressVal,
          state: stateVal,
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
      if (selectedState !== 'All' && c.state !== selectedState) return false;
      if (selectedRace !== 'All' && c.race !== selectedRace) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchUser = c.username.toLowerCase().includes(q);
        const matchName = c.name.toLowerCase().includes(q);
        const matchPhone = c.phone.toLowerCase().includes(q);
        const matchAddr = c.address.toLowerCase().includes(q);
        const matchState = c.state.toLowerCase().includes(q);
        return matchUser || matchName || matchPhone || matchAddr || matchState;
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
  }, [customers, searchQuery, selectedState, selectedRace, sortConfig]);

  // Export Customer List to CSV
  const handleExportCustomersCSV = () => {
    const csvRows = [
      ['Buyer Username', 'Buyer Name', 'Phone Number', 'State', 'Ethnicity', 'Full Address', 'Total Orders', 'Lifetime Value (RM)', 'Last Order Date'].join(','),
      ...filteredCustomers.map((c) => [
        `"${c.username.replace(/"/g, '""')}"`,
        `"${c.name.replace(/"/g, '""')}"`,
        `"${c.phone.replace(/"/g, '""')}"`,
        `"${c.state.replace(/"/g, '""')}"`,
        `"${c.race.replace(/"/g, '""')}"`,
        `"${c.address.replace(/"/g, '""')}"`,
        c.orderCount,
        c.totalSpent.toFixed(2),
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

  const statesList = [
    'All',
    'Kuala Lumpur',
    'Selangor',
    'Johor',
    'Pulau Pinang',
    'Perak',
    'Kedah',
    'Melaka',
    'Negeri Sembilan',
    'Pahang',
    'Kelantan',
    'Terengganu',
    'Sabah',
    'Sarawak',
  ];

  return (
    <div className="space-y-4 w-full">
      {/* Filter Bar with Standard UI Dropdown Controls & Export Button */}
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

        {/* State / Region Dropdown */}
        <CustomDropdown
          label="State"
          icon={<MapPin className="w-3.5 h-3.5" />}
          options={statesList.map((st) => ({
            value: st,
            label: st === 'All' ? 'All States (Malaysia)' : st,
          }))}
          value={selectedState}
          onChange={setSelectedState}
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

      {/* Customers Data Table */}
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
                <th onClick={() => handleSort('state')} className="py-2.5 px-3 cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>State / Location</span>
                    {renderSortIcon('state')}
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
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    No customer records found matching search filters.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c, idx) => {
                  const customerOrders = orders.filter(
                    (o) => (o.buyerUsername || '').toLowerCase().trim() === c.username.toLowerCase().trim()
                  );
                  const latestOrder = customerOrders[0] || null;

                  return (
                    <tr
                      key={idx}
                      onClick={() => {
                        if (latestOrder) {
                          if (onSelectOrder) onSelectOrder(latestOrder);
                          else setInspectOrder(latestOrder);
                        }
                      }}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{c.name}</div>
                          <div className="text-[11px] text-blue-600 font-mono font-semibold">@{c.username}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-slate-800">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.phone}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-800">
                          <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="font-bold">{c.state}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{c.address}</div>
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
                        RM {c.totalSpent.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {c.lastOrderDate || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (latestOrder) {
                              if (onSelectOrder) onSelectOrder(latestOrder);
                              else setInspectOrder(latestOrder);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect Order</span>
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

      {/* Internal Modal Fallback if onSelectOrder is not passed */}
      {inspectOrder && (
        <OrderDetailsModal
          order={inspectOrder}
          onClose={() => setInspectOrder(null)}
        />
      )}
    </div>
  );
};
