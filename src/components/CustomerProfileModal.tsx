import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  UserCheck,
  X,
  ShoppingBag,
  Eye,
  MessageSquare,
  MessageCircle,
  Send,
} from 'lucide-react';
import { ShopeeOrder, UserRole } from '../types';
import { inferBuyerRace } from '../utils/raceHelper';
import { isCancelledOrder } from '../utils/csvHelper';
import { OrderDetailsModal } from './OrderDetailsModal';
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

export interface CustomerProfileModalProps {
  customer: {
    username?: string;
    name?: string;
    phone?: string;
    race?: string;
    country?: string;
    address?: string;
    orderCount?: number;
    successfulOrderCount?: number;
    totalSpent?: number;
    lastOrderDate?: string;
  };
  orders: ShopeeOrder[];
  userRole?: UserRole;
  onClose: () => void;
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

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
  customer,
  orders,
  userRole,
  onClose,
  onOpenSmsTab,
}) => {
  const [inspectOrder, setInspectOrder] = useState<ShopeeOrder | null>(null);
  const [allSmsLogs, setAllSmsLogs] = useState<CustomerSmsLog[]>([]);

  // Fetch SMS and WhatsApp logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        let backendLogs: CustomerSmsLog[] = [];
        const res = await fetch('/api/send-sms');
        if (res.ok) {
          const data = await res.json();
          if (data.logs) backendLogs = data.logs;
        }
        const localSmsLogs: CustomerSmsLog[] = JSON.parse(
          localStorage.getItem('wm_movider_sms_logs') || '[]'
        );
        const localWaLogs: CustomerSmsLog[] = JSON.parse(
          localStorage.getItem('wm_whatsapp_logs') || '[]'
        );
        const mergedMap = new Map<string, CustomerSmsLog>();
        [...localWaLogs, ...localSmsLogs, ...backendLogs].forEach((l) => {
          if (l && l.id) mergedMap.set(l.id, l);
        });
        setAllSmsLogs(Array.from(mergedMap.values()));
      } catch (err) {
        console.warn('Failed to load outreach logs in modal:', err);
      }
    };
    fetchLogs();
  }, []);

  // Compute matching orders for this customer
  const custOrders = useMemo(() => {
    const targetUser = (customer.username || '').toLowerCase().trim().replace(/^@+/, '');
    const cleanPhone = (customer.phone || '').replace(/\D/g, '');
    const targetName = (customer.name || '').toLowerCase().trim();

    return orders
      .filter((o) => {
        const orderUser = (o.buyerUsername || '').toLowerCase().trim().replace(/^@+/, '');
        if (targetUser && orderUser && orderUser === targetUser) return true;

        const orderPhone = (o.buyerPhone || o.recipientPhone || '').replace(/\D/g, '');
        if (cleanPhone && orderPhone) {
          if (orderPhone.endsWith(cleanPhone.slice(-8)) || cleanPhone.endsWith(orderPhone.slice(-8))) {
            return true;
          }
        }

        const orderName = (o.buyerName || o.recipientName || '').toLowerCase().trim();
        if (targetName && orderName && orderName === targetName) return true;

        return false;
      })
      .sort((a, b) => {
        const timeA = a.orderDate ? new Date(a.orderDate.replace(' ', 'T')).getTime() || 0 : 0;
        const timeB = b.orderDate ? new Date(b.orderDate.replace(' ', 'T')).getTime() || 0 : 0;
        return timeB - timeA;
      });
  }, [orders, customer]);

  // Aggregate comprehensive profile info
  const resolvedProfile = useMemo(() => {
    let orderCount = custOrders.length;
    let successfulCount = 0;
    let totalSpent = 0;
    let latestOrderDate = '';
    let address = customer.address || '';
    let country = customer.country || 'Malaysia';
    let race = customer.race || '';
    let resolvedName = customer.name || '';
    let resolvedUser = customer.username || '';
    let resolvedPhone = customer.phone || '';

    custOrders.forEach((o) => {
      const isSuccess = !isCancelledOrder(o.orderStatus);
      if (isSuccess) {
        successfulCount += 1;
        totalSpent += Number(o.totalAmount || 0);
      }
      if (!latestOrderDate && o.orderDate) {
        latestOrderDate = o.orderDate;
      }
      if (!address && (o.shippingAddress || o.buyerAddress)) {
        address = (o.shippingAddress || o.buyerAddress) as string;
      }
      if (!race && o.buyerRace) {
        race = o.buyerRace;
      }
      if (!resolvedName && (o.buyerName || o.recipientName)) {
        resolvedName = o.buyerName || o.recipientName || '';
      }
      if (!resolvedUser && o.buyerUsername) {
        resolvedUser = o.buyerUsername;
      }
      if (!resolvedPhone && (o.buyerPhone || o.recipientPhone)) {
        resolvedPhone = o.buyerPhone || o.recipientPhone || '';
      }
    });

    if (!race) {
      race = inferBuyerRace({
        recipientName: resolvedName,
        buyerName: resolvedName,
        buyerUsername: resolvedUser,
        shippingAddress: address,
      } as unknown as ShopeeOrder);
    }

    return {
      name: resolvedName || customer.name || 'Shopee Customer',
      username: resolvedUser || customer.username || resolvedName || 'shopee_user',
      phone: resolvedPhone || customer.phone || 'N/A',
      race: race || 'Malay',
      country: country,
      address: address || 'No address record on file',
      orderCount: customer.orderCount !== undefined ? customer.orderCount : orderCount,
      successfulOrderCount: customer.successfulOrderCount !== undefined ? customer.successfulOrderCount : successfulCount,
      totalSpent: customer.totalSpent !== undefined ? customer.totalSpent : totalSpent,
      lastOrderDate: customer.lastOrderDate || latestOrderDate || 'N/A',
    };
  }, [customer, custOrders]);

  // Filter SMS and WhatsApp outreach logs specifically for this customer
  const customerOutreachLogs = useMemo(() => {
    const custCleanPhone = (resolvedProfile.phone || '').replace(/\D/g, '');
    const custNormUser = (resolvedProfile.username || '').toLowerCase().trim().replace(/^@+/, '');
    const custNormName = (resolvedProfile.name || '').toLowerCase().trim();

    return allSmsLogs
      .filter((l) => {
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
      })
      .sort((a, b) => {
        const timeA = new Date(a.sentTime).getTime() || 0;
        const timeB = new Date(b.sentTime).getTime() || 0;
        return timeB - timeA;
      });
  }, [resolvedProfile, allSmsLogs]);

  // Direct WhatsApp Launcher from Profile
  const handleDirectWhatsAppChat = () => {
    const waPhone = formatWhatsAppPhone(resolvedProfile.phone);
    if (!waPhone || waPhone.length < 8) {
      alert('Invalid or missing phone number for WhatsApp.');
      return;
    }
    const defaultText = `Hi ${resolvedProfile.name || resolvedProfile.username}, thank you for your order with WCGMall! How may we assist you today?`;
    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(defaultText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    // Record locally into whatsapp logs
    const newLog: CustomerSmsLog = {
      id: `wa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipientPhone: resolvedProfile.phone,
      recipientName: resolvedProfile.name,
      buyerUsername: resolvedProfile.username,
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

  return (
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
                  Customer Profile: {maskCustomerName(resolvedProfile.name, userRole)}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300 font-mono">
                  @{maskUsername(resolvedProfile.username, userRole)}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Shopee Buyer Record &bull;{' '}
                <strong className="text-emerald-700 font-bold">
                  {resolvedProfile.successfulOrderCount} Successful
                </strong>{' '}
                ({resolvedProfile.orderCount} Total Placed)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
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
                <span className="font-bold text-slate-900 text-sm">
                  {maskCustomerName(resolvedProfile.name, userRole)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact Phone</span>
                <span className="font-bold font-mono text-slate-900 text-sm">
                  {maskPhone(resolvedProfile.phone, userRole)}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Ethnicity</span>
                <span className="font-bold text-slate-900">{resolvedProfile.race}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Country</span>
                <span className="font-bold text-slate-900">{resolvedProfile.country}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-slate-200 sm:col-span-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Shipping Address</span>
                <span className="font-medium text-slate-800 line-clamp-2">
                  {maskAddress(resolvedProfile.address, userRole)}
                </span>
              </div>
            </div>

            {/* 5 Metrics Summary Grid: Successful, Total, SMS/WA, Lifetime Spent (LTV), Last Order */}
            <div className="flex flex-wrap sm:flex-nowrap items-stretch gap-2 pt-2 border-t border-slate-200 text-center">
              <div className="w-[calc(50%-4px)] sm:w-20 lg:w-24 shrink-0 py-2 px-1.5 rounded-lg bg-emerald-50 border border-emerald-200 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-extrabold text-emerald-700 block truncate">Successful</span>
                <span className="text-base sm:text-lg font-black text-emerald-950">
                  {resolvedProfile.successfulOrderCount}
                </span>
              </div>

              <div className="w-[calc(50%-4px)] sm:w-20 lg:w-24 shrink-0 py-2 px-1.5 rounded-lg bg-blue-50 border border-blue-200 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-extrabold text-blue-700 block truncate">Total</span>
                <span className="text-base sm:text-lg font-black text-blue-950">
                  {resolvedProfile.orderCount}
                </span>
              </div>

              <div className="w-[calc(50%-4px)] sm:w-20 lg:w-24 shrink-0 py-2 px-1.5 rounded-lg bg-purple-50 border border-purple-200 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-extrabold text-purple-700 block truncate">SMS/WA</span>
                <span className="text-base sm:text-lg font-black text-purple-950">
                  {customerOutreachLogs.length}
                </span>
              </div>

              <div className="flex-1 min-w-[130px] py-2 px-2.5 rounded-lg bg-slate-100 border border-slate-200 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-extrabold text-slate-700 block truncate">Lifetime Spent</span>
                <span className="text-base sm:text-lg font-black font-mono text-emerald-900">
                  {maskPrice(resolvedProfile.totalSpent, userRole, (val) => `RM ${val.toFixed(2)}`)}
                </span>
              </div>

              <div className="flex-1 min-w-[130px] py-2 px-2.5 rounded-lg bg-slate-100 border border-slate-200 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-extrabold text-slate-600 block truncate">Last Order</span>
                <span className="text-xs font-bold font-mono text-slate-800 mt-0.5 block truncate">
                  {resolvedProfile.lastOrderDate || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* 1. ALL ORDERS TABLE LIST (FIRST) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-blue-600" />
                <span>All Orders for this Customer ({custOrders.length})</span>
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
                    {custOrders.map((ord, idx) => {
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
                            {/* Hover Preview Tooltip */}
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
                  onClick={handleDirectWhatsAppChat}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Open WhatsApp</span>
                </button>
                {onOpenSmsTab && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
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
                                <div className="font-semibold text-slate-800 break-words leading-relaxed">
                                  {log.messageText}
                                </div>
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

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            Customer ID / User: @{resolvedProfile.username}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            Close Profile
          </button>
        </div>
      </div>

      {/* Child Order Details Modal */}
      {inspectOrder && (
        <OrderDetailsModal
          order={inspectOrder}
          onClose={() => setInspectOrder(null)}
          userRole={userRole}
          backLabel="Back to Customer Profile"
        />
      )}
    </div>
  );
};
