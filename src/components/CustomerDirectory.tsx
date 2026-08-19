import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Search,
  Phone,
  MapPin,
  Download,
  ShoppingBag,
  ShieldCheck,
  UserCheck,
  Calendar,
  Eye,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Globe,
  TrendingUp,
  MessageSquare,
  MessageCircle,
  Send,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react';
import { ShopeeOrder, UserRole } from '../types';
import { inferBuyerRace } from '../utils/raceHelper';
import { isCancelledOrder, isMaskedString } from '../utils/csvHelper';
import { OrderDetailsModal } from './OrderDetailsModal';
import { CustomDropdown } from './CustomDropdown';
import { maskCustomerName, maskUsername, maskPhone, maskAddress, maskPrice } from '../utils/maskHelper';

export interface CustomerSmsLog {
  id: string;
  recipientPhone: string;
  recipientName?: string;
  buyerUsername?: string;
  messageText: string;
  senderId?: string;
  sentTime: string;
  status: 'DELIVERED' | 'SENT_SIMULATED' | 'FAILED' | 'WHATSAPP_LAUNCHED' | string;
  channel?: 'SMS' | 'WHATSAPP' | 'OMNICHANNEL';
}

interface CustomerDirectoryProps {
  orders: ShopeeOrder[];
  onSelectOrder?: (order: ShopeeOrder) => void;
  userRole?: UserRole;
  onOpenSmsTab?: () => void;
}

const formatWhatsAppPhone = (rawPhone: string): string => {
  if (!rawPhone) return '';
  let cleaned = rawPhone.replace(/[^\d]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '60' + cleaned.substring(1);
  } else if (!cleaned.startsWith('60') && cleaned.length >= 9) {
    cleaned = '60' + cleaned;
  }
  return cleaned;
};

export const CustomerDirectory: React.FC<CustomerDirectoryProps> = ({
  orders,
  userRole = 'admin',
  onOpenSmsTab,
}) => {
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem('wm_customer_overview_expanded_v1');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('All');
  const [selectedRace, setSelectedRace] = useState('All');
  const [inspectOrder, setInspectOrder] = useState<ShopeeOrder | null>(null);
  const [selectedCustomerUser, setSelectedCustomerUser] = useState<string | null>(null);
  const [allSmsLogs, setAllSmsLogs] = useState<CustomerSmsLog[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; order: 'asc' | 'desc' }>({
    key: 'successfulOrderCount',
    order: 'desc',
  });

  const handleToggleOverview = () => {
    setIsOverviewExpanded((prev: boolean) => {
      const next = !prev;
      try {
        localStorage.setItem('wm_customer_overview_expanded_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Load SMS and WhatsApp outreach history logs
  useEffect(() => {
    try {
      const localSms: CustomerSmsLog[] = JSON.parse(localStorage.getItem('wm_movider_sms_logs') || '[]');
      const localWa: CustomerSmsLog[] = JSON.parse(localStorage.getItem('wm_whatsapp_logs') || '[]');
      const map = new Map<string, CustomerSmsLog>();
      [...localWa, ...localSms].forEach((l) => {
        if (l && l.id) map.set(l.id, l);
      });
      setAllSmsLogs(Array.from(map.values()));

      // Fetch backend API logs if available
      fetch('/api/send-sms?action=logs')
        .then((res) => res.json())
        .then((data) => {
          if (data && Array.isArray(data.logs)) {
            const mergedMap = new Map<string, CustomerSmsLog>();
            [...localWa, ...localSms, ...data.logs].forEach((l) => {
              if (l && l.id) mergedMap.set(l.id, l);
            });
            setAllSmsLogs(Array.from(mergedMap.values()));
          }
        })
        .catch(() => {});
    } catch {
      // ignore
    }
  }, [selectedCustomerUser]);

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
      successfulOrderCount: number;
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
      const isCancelled = isCancelledOrder(o) || o.orderStatus === 'Cancelled';
      const isSuccess = o.orderStatus === 'Completed';
      const amt = isCancelled ? 0 : (o.totalAmount || 0);
      const dateVal = o.orderDate || '';

      if (customerMap.has(usernameKey)) {
        const existing = customerMap.get(usernameKey)!;
        existing.orderCount += 1;
        if (isSuccess) {
          existing.successfulOrderCount += 1;
        }
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
          successfulOrderCount: isSuccess ? 1 : 0,
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

  // Customer Acquisition Overview Metrics (This Week, This Month, Total)
  const overviewMetrics = useMemo(() => {
    // Current time in MYT (UTC+8)
    const nowMs = Date.now() + 8 * 3600 * 1000;
    const nowMyt = new Date(nowMs);
    const currentYear = nowMyt.getUTCFullYear();
    const currentMonthStr = `${currentYear}-${String(nowMyt.getUTCMonth() + 1).padStart(2, '0')}`;

    // Monday of current week in MYT
    const dayOfWeek = nowMyt.getUTCDay(); // 0 = Sun, 1 = Mon
    const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeekMs = nowMs - daysToMon * 24 * 3600 * 1000;
    const startOfWeekDate = new Date(startOfWeekMs);
    const startOfWeekStr = `${startOfWeekDate.getUTCFullYear()}-${String(startOfWeekDate.getUTCMonth() + 1).padStart(2, '0')}-${String(startOfWeekDate.getUTCDate()).padStart(2, '0')}`;

    const thisWeekCustomerSet = new Set<string>();
    const thisMonthCustomerSet = new Set<string>();
    let totalLtvSum = 0;
    let repeatCustomerCount = 0;

    customers.forEach((c) => {
      totalLtvSum += c.totalSpent;
      if (c.successfulOrderCount > 1 || c.orderCount > 1) {
        repeatCustomerCount += 1;
      }
    });

    orders.forEach((o) => {
      const userKey = (o.buyerUsername || o.buyerPhone || o.recipientName || '').toLowerCase().trim().replace(/^@+/, '');
      if (!userKey) return;
      const datePart = (o.orderDate || '').substring(0, 10);
      if (datePart) {
        if (datePart.startsWith(currentMonthStr)) {
          thisMonthCustomerSet.add(userKey);
        }
        if (datePart >= startOfWeekStr) {
          thisWeekCustomerSet.add(userKey);
        }
      }
    });

    const totalCustCount = customers.length;
    const repeatRate = totalCustCount > 0 ? ((repeatCustomerCount / totalCustCount) * 100).toFixed(1) : '0.0';

    return {
      thisWeekCount: thisWeekCustomerSet.size,
      thisMonthCount: thisMonthCustomerSet.size,
      totalCount: totalCustCount,
      repeatCustomerCount,
      repeatRate,
      totalLtvSum,
      currentMonthLabel: nowMyt.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }),
      currentWeekLabel: `Since Mon (${startOfWeekStr})`,
    };
  }, [customers, orders]);

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

  // Filter SMS and WhatsApp outreach logs specifically for selectedCustomer
  const customerOutreachLogs = useMemo(() => {
    if (!selectedCustomer) return [];
    const custCleanPhone = (selectedCustomer.phone || '').replace(/\D/g, '');
    const custNormUser = (selectedCustomer.username || '').toLowerCase().trim().replace(/^@+/, '');
    const custNormName = (selectedCustomer.name || '').toLowerCase().trim();

    return allSmsLogs.filter((l) => {
      const logPhone = (l.recipientPhone || '').replace(/\D/g, '');
      if (custCleanPhone && logPhone && (logPhone.endsWith(custCleanPhone.slice(-8)) || custCleanPhone.endsWith(logPhone.slice(-8)))) {
        return true;
      }
      if (l.buyerUsername && custNormUser) {
        const logUser = l.buyerUsername.toLowerCase().trim().replace(/^@+/, '');
        if (logUser === custNormUser) return true;
      }
      if (l.recipientName && custNormName) {
        const logName = l.recipientName.toLowerCase().trim();
        if (logName === custNormName) return true;
      }
      return false;
    }).sort((a, b) => {
      const timeA = new Date(a.sentTime).getTime() || 0;
      const timeB = new Date(b.sentTime).getTime() || 0;
      return timeB - timeA;
    });
  }, [selectedCustomer, allSmsLogs]);

  // Direct WhatsApp Launcher from Profile
  const handleDirectWhatsAppChat = (customer: { name: string; phone: string; username: string }) => {
    const waPhone = formatWhatsAppPhone(customer.phone);
    if (!waPhone || waPhone.length < 8) {
      alert('Invalid or missing phone number for WhatsApp.');
      return;
    }
    const defaultText = `Hi ${customer.name || customer.username}, thank you for your order with WCGMall! How may we assist you today?`;
    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(defaultText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    // Record locally into whatsapp logs
    const newLog: CustomerSmsLog = {
      id: `wa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipientPhone: customer.phone,
      recipientName: customer.name,
      buyerUsername: customer.username,
      messageText: defaultText,
      senderId: 'WHATSAPP_WEB',
      sentTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
      status: 'WHATSAPP_LAUNCHED',
      channel: 'WHATSAPP',
    };

    const currentWaLogs = JSON.parse(localStorage.getItem('wm_whatsapp_logs') || '[]');
    const updatedWaLogs = [newLog, ...currentWaLogs];
    localStorage.setItem('wm_whatsapp_logs', JSON.stringify(updatedWaLogs));
    setAllSmsLogs((prev) => [newLog, ...prev]);
  };

  // Export Customer List to CSV
  const handleExportCustomersCSV = () => {
    const csvRows = [
      ['Buyer Username', 'Buyer Name', 'Phone Number', 'Country', 'Ethnicity', 'Full Address', 'Successful Orders', 'Total Placed', 'Lifetime Value (RM)', 'Last Order Date'].join(','),
      ...filteredCustomers.map((c) => [
        `"${maskUsername(c.username, userRole).replace(/"/g, '""')}"`,
        `"${maskCustomerName(c.name, userRole).replace(/"/g, '""')}"`,
        `"${maskPhone(c.phone, userRole).replace(/"/g, '""')}"`,
        `"${c.country.replace(/"/g, '""')}"`,
        `"${c.race.replace(/"/g, '""')}"`,
        `"${maskAddress(c.address, userRole).replace(/"/g, '""')}"`,
        c.successfulOrderCount,
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
      {/* 1. Collapsible Customer Base & Acquisition Overview Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden animate-fadeIn space-y-0">
        <div className="bg-blue-50/90 border-b border-blue-100 px-4 py-2.5 text-xs text-blue-900 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="font-medium">
              <strong className="font-extrabold">Customer Overview:</strong> Real-time buyer acquisition, active customers this week &amp; month, and repeat customer retention rate.
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleOverview}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-blue-800 border border-blue-200 text-xs font-bold transition-all cursor-pointer shadow-2xs ml-auto"
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>{isOverviewExpanded ? 'Hide Customer Overview' : 'Show Customer Overview'}</span>
            {isOverviewExpanded ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />}
          </button>
        </div>

        {isOverviewExpanded && (
          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
            {/* Card 1: Active This Week */}
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-blue-800 uppercase tracking-wider block">Customers This Week</span>
                <span className="text-2xl font-black text-blue-950 block mt-0.5">{overviewMetrics.thisWeekCount}</span>
                <span className="text-[10px] text-blue-600 font-semibold">{overviewMetrics.currentWeekLabel}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Calendar className="w-5 h-5" />
              </div>
            </div>

            {/* Card 2: Active This Month */}
            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-indigo-800 uppercase tracking-wider block">Customers This Month</span>
                <span className="text-2xl font-black text-indigo-950 block mt-0.5">{overviewMetrics.thisMonthCount}</span>
                <span className="text-[10px] text-indigo-600 font-semibold">{overviewMetrics.currentMonthLabel}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            {/* Card 3: Total Customers */}
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider block">Total Customers</span>
                <span className="text-2xl font-black text-emerald-950 block mt-0.5">{overviewMetrics.totalCount}</span>
                <span className="text-[10px] text-emerald-700 font-semibold">All-time unique buyers</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Users className="w-5 h-5" />
              </div>
            </div>

            {/* Card 4: Repeat Buyers Retention */}
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wider block">Repeat Buyers</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl font-black text-amber-950">{overviewMetrics.repeatCustomerCount}</span>
                  <span className="text-xs font-bold text-amber-700 font-mono">({overviewMetrics.repeatRate}%)</span>
                </div>
                <span className="text-[10px] text-amber-700 font-semibold">&gt;1 orders placed</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Filter Bar */}
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
            { value: 'Others', label: 'Others' },
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

      {/* 3. Customers Data Table (Shows SUCCESSFUL ORDERS) */}
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
                <th onClick={() => handleSort('successfulOrderCount')} className="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Successful Orders</span>
                    {renderSortIcon('successfulOrderCount')}
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
                        {c.successfulOrderCount}
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

      {/* 4. CUSTOMER PROFILE MODAL (Shows Successful Orders, Total Orders, & Outreach History) */}
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
                    Shopee Buyer Record &bull; <strong className="text-emerald-700 font-bold">{selectedCustomer.successfulOrderCount} Successful</strong> ({selectedCustomer.orderCount} Total Placed)
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
              {/* Customer Contact & Profile Overview */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
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

                {/* 4 Metrics Summary Grid: Successful Orders, Total Placed, LTV, Last Order */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 text-center">
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-[10px] uppercase font-extrabold text-emerald-700 block">Successful Orders</span>
                    <span className="text-base sm:text-lg font-black text-emerald-950">{selectedCustomer.successfulOrderCount}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                    <span className="text-[10px] uppercase font-extrabold text-blue-700 block">Total Placed</span>
                    <span className="text-base sm:text-lg font-black text-blue-950">{selectedCustomer.orderCount}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200">
                    <span className="text-[10px] uppercase font-extrabold text-slate-700 block">Lifetime Spent (LTV)</span>
                    <span className="text-base sm:text-lg font-black font-mono text-emerald-900">{maskPrice(selectedCustomer.totalSpent, userRole, (val) => `RM ${val.toFixed(2)}`)}</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200">
                    <span className="text-[10px] uppercase font-extrabold text-slate-600 block">Last Order Date</span>
                    <span className="text-xs font-bold font-mono text-slate-800 mt-1 block truncate">{selectedCustomer.lastOrderDate || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* 1. ALL ORDERS TABLE LIST (FIRST) */}
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

              {/* 2. SMS & WHATSAPP OUTREACH HISTORY SECTION (AT THE BOTTOM) */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-600" />
                    <h4 className="text-sm font-extrabold text-slate-900">
                      SMS &amp; WhatsApp Outreach History ({customerOutreachLogs.length})
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDirectWhatsAppChat(selectedCustomer)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Open WhatsApp</span>
                    </button>
                    {onOpenSmsTab && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerUser(null);
                          onOpenSmsTab();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Send className="w-3.5 h-3.5 text-blue-600" />
                        <span>SMS Campaign Hub</span>
                      </button>
                    )}
                  </div>
                </div>

                {customerOutreachLogs.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-semibold text-slate-600">
                      No SMS or WhatsApp messages have been sent to this customer yet.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      You can launch a direct WhatsApp chat above or broadcast promotions from the SMS Marketing Hub.
                    </p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl bg-white shadow-2xs relative">
                    <div className="overflow-visible">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                            <th className="py-2 px-2.5 w-[115px]">Date / Time</th>
                            <th className="py-2 px-2 text-center w-[40px]">Ch</th>
                            <th className="py-2 px-2.5 w-[90px]">Sender</th>
                            <th className="py-2 px-2.5">Message Content</th>
                            <th className="py-2 px-2.5 text-center w-[75px]">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {customerOutreachLogs.map((log, idx) => {
                            const isWa = log.channel === 'WHATSAPP' || log.senderId === 'WHATSAPP_WEB';
                            const statusColor =
                              log.status === 'DELIVERED' || log.status === 'WHATSAPP_LAUNCHED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : log.status === 'FAILED'
                                ? 'bg-rose-50 text-rose-800 border-rose-300'
                                : 'bg-blue-50 text-blue-800 border-blue-300';

                            const statusLabel =
                              log.status === 'WHATSAPP_LAUNCHED'
                                ? 'Opened'
                                : log.status === 'DELIVERED'
                                ? 'Delivered'
                                : log.status === 'FAILED'
                                ? 'Failed'
                                : (log.status || 'Sent');

                            const compactDate = (log.sentTime || '')
                              .replace('T', ' ')
                              .replace(/\.\d+Z?$/, '')
                              .replace(/Z$/, '')
                              .substring(0, 16) || 'N/A';

                            return (
                              <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                {/* Compact Date / Time with full tooltip */}
                                <td className="py-2 px-2.5 whitespace-nowrap relative group/time">
                                  <span className="font-mono text-[11px] text-slate-600 cursor-default block truncate">
                                    {compactDate}
                                  </span>
                                  <div className="absolute left-0 bottom-full mb-1 z-50 hidden group-hover/time:block p-2 bg-white text-slate-900 text-[10px] rounded-lg shadow-lg border border-slate-200 pointer-events-none whitespace-nowrap ring-1 ring-slate-900/5">
                                    <span className="font-bold text-slate-500 uppercase">Exact Timestamp: </span>
                                    <span className="font-mono font-semibold text-slate-800">{log.sentTime}</span>
                                  </div>
                                </td>

                                {/* Channel: Green 'W' for WhatsApp, Blue 'S' for SMS */}
                                <td className="py-2 px-2 text-center whitespace-nowrap">
                                  {isWa ? (
                                    <span
                                      className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default shadow-2xs"
                                      title="WhatsApp"
                                    >
                                      W
                                    </span>
                                  ) : (
                                    <span
                                      className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-300 cursor-default shadow-2xs"
                                      title="SMS Movider"
                                    >
                                      S
                                    </span>
                                  )}
                                </td>

                                {/* Sender ID */}
                                <td className="py-2 px-2.5 font-bold text-slate-700 text-[11px] whitespace-nowrap truncate max-w-[90px]">
                                  {isWa ? 'WhatsApp' : (log.senderId || 'WCGMall')}
                                </td>

                                {/* Message Content with hover tooltip */}
                                <td className="py-2 px-2.5 relative group/msg max-w-[160px] sm:max-w-[200px]">
                                  <div className="truncate text-slate-800 font-medium text-[11px] cursor-pointer hover:text-purple-700 transition-colors">
                                    {log.messageText}
                                  </div>
                                  {/* Hover Preview Tooltip */}
                                  <div className="absolute left-0 bottom-full mb-1.5 z-50 hidden group-hover/msg:block w-72 sm:w-80 p-3 bg-white text-slate-900 text-xs rounded-xl shadow-2xl border border-slate-200/90 pointer-events-none leading-snug whitespace-normal ring-1 ring-slate-900/5">
                                    <div className="text-[10px] text-purple-600 font-extrabold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                      <MessageSquare className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                      <span>FULL MESSAGE CONTENT</span>
                                    </div>
                                    <div className="font-semibold text-slate-800 break-words leading-relaxed">{log.messageText}</div>
                                  </div>
                                </td>

                                {/* Status */}
                                <td className="py-2 px-2.5 text-center whitespace-nowrap">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border uppercase ${statusColor}`}>
                                    {statusLabel}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
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

