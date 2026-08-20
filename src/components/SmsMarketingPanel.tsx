import React, { useState, useMemo, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Key,
  ShieldCheck,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PhoneCall,
  Sparkles,
  FileText,
  Clock,
  Search,
  Filter,
  Sliders,
  DollarSign,
  ChevronRight,
  MessageCircle,
  ExternalLink,
  Smartphone,
  CheckCheck,
  Zap,
  Copy,
  Share2,
  Plus,
  Trash2,
  FlaskConical,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShoppingBag,
  RotateCcw,
  User,
  ArrowLeft,
  Info,
} from 'lucide-react';
import { ShopeeOrder, UserRole } from '../types';
import { isValidSmsPhone } from '../utils/csvHelper';
import { CustomDropdown, OptionItem } from './CustomDropdown';
import { PaginationControls } from './PaginationControls';
import { CustomerProfileModal } from './CustomerProfileModal';

interface SmsMarketingPanelProps {
  orders: ShopeeOrder[];
  userRole?: UserRole;
}

interface CustomTestRecipient {
  id: string;
  name: string;
  phone: string;
  username: string;
  country: string;
  product: string;
  isValidPhone: boolean;
  isTest: boolean;
  orderCount: number;
  lastOrderDate?: string;
  lastOrderTimestamp?: number;
}

interface SmsLog {
  id: string;
  recipientName: string;
  recipientPhone: string;
  messageText: string;
  senderId: string;
  sentTime: string;
  status: 'DELIVERED' | 'SENT_SIMULATED' | 'FAILED' | 'WHATSAPP_LAUNCHED';
  errorMessage?: string;
  channel?: 'SMS' | 'WHATSAPP' | 'OMNICHANNEL';
  moviderResult?: any;
}

// Utility function to format phone number for WhatsApp wa.me links
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

const VALID_DEFAULT_KEY = 'iPnNDUbKo2OyVvr5osnidwt8uL1-GW';
const VALID_DEFAULT_SECRET = 'Jl0WWdL6vGjbq5ZVT2qxLFJqUYadPE';

export const SmsMarketingPanel: React.FC<SmsMarketingPanelProps> = ({ orders, userRole }) => {
  // Movider API Credentials State - ensure stale keys are auto-corrected
  const [apiKey, setApiKey] = useState(() => {
    const saved = localStorage.getItem('wm_movider_api_key');
    if (!saved || saved.startsWith('3GnQOV')) {
      localStorage.setItem('wm_movider_api_key', VALID_DEFAULT_KEY);
      return VALID_DEFAULT_KEY;
    }
    return saved;
  });
  const [apiSecret, setApiSecret] = useState(() => {
    const saved = localStorage.getItem('wm_movider_api_secret');
    if (!saved || saved.startsWith('RENJe') || saved.startsWith('vHVpO3g')) {
      localStorage.setItem('wm_movider_api_secret', VALID_DEFAULT_SECRET);
      return VALID_DEFAULT_SECRET;
    }
    return saved;
  });
  const senderId = 'WCGMall';

  // Marketing Channel Selection - default to 'sms' so SMS blast sends real SMS
  const [dispatchChannel, setDispatchChannel] = useState<'sms' | 'whatsapp' | 'both'>('sms');

  // Audience & Composition State (All Reachable vs Select Customers Directory)
  const [audienceMode, setAudienceMode] = useState<'all' | 'custom'>('all');
  const [selectedCustomerUsernames, setSelectedCustomerUsernames] = useState<Set<string>>(new Set());
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');

  // Page View State: 'composer' (Hub + Composer + WA Queue) vs 'history' (Dedicated Campaign Logs & Audit History)
  const [activeView, setActiveView] = useState<'composer' | 'history'>('composer');

  // 1-Click WhatsApp Queue Pagination & Customer Profile Modal State
  const [waQueuePage, setWaQueuePage] = useState<number>(1);
  const [waQueuePageSize, setWaQueuePageSize] = useState<number>(25);
  const [selectedProfileCustomer, setSelectedProfileCustomer] = useState<{
    username?: string;
    name?: string;
    phone?: string;
    country?: string;
    product?: string;
  } | null>(null);

  // Added Custom Mobile Numbers State
  const [customTestRecipients, setCustomTestRecipients] = useState<CustomTestRecipient[]>(() => {
    try {
      const saved = localStorage.getItem('wm_custom_test_recipients');
      if (saved) {
        const parsed: CustomTestRecipient[] = JSON.parse(saved);
        return parsed.map((item) => {
          let clean = (item.phone || '').replace(/\D/g, '');
          if (clean.startsWith('0')) clean = '60' + clean.substring(1);
          return {
            ...item,
            phone: clean,
          };
        });
      }
    } catch (e) {
      console.error('Failed to load custom recipients', e);
    }
    return [];
  });
  const [newTestName, setNewTestName] = useState<string>('');
  const [newTestPhone, setNewTestPhone] = useState<string>('');
  const [isAddingTestNumber, setIsAddingTestNumber] = useState<boolean>(false);
  const [includeTestNumbersInBulk, setIncludeTestNumbersInBulk] = useState<boolean>(true);

  useEffect(() => {
    try {
      localStorage.setItem('wm_custom_test_recipients', JSON.stringify(customTestRecipients));
    } catch (e) {
      console.error('Failed to save custom recipients', e);
    }
  }, [customTestRecipients]);

  const DEFAULT_CAMPAIGN_MESSAGE =
    'Thank you for shopping with us! Sign up on WCGMall(.)com to discover more benefits. Happy shopping!';

  const [messageText, setMessageText] = useState<string>(DEFAULT_CAMPAIGN_MESSAGE);

  const [isSending, setIsSending] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [searchLogQuery, setSearchLogQuery] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'SMS' | 'WHATSAPP'>('ALL');
  const [logsPage, setLogsPage] = useState<number>(1);
  const [logsPageSize, setLogsPageSize] = useState<number>(10);

  // State for WhatsApp Outreach Confirmation Modal
  const [pendingWaConfirmation, setPendingWaConfirmation] = useState<{
    recipient: { name: string; phone: string; username?: string; country?: string; product?: string };
    waPhone: string;
    initialMessage: string;
    customMessage: string;
  } | null>(null);

  // Extract unique customers from orders with phone number detection, purchase count, and last order date tracking
  const customerList = useMemo(() => {
    const map = new Map<
      string,
      {
        username: string;
        name: string;
        phone: string;
        country: string;
        product: string;
        isValidPhone: boolean;
        orderCount: number;
        lastOrderDate: string;
        lastOrderTimestamp: number;
      }
    >();

    orders.forEach((o) => {
      const username = o.buyerUsername || 'buyer';
      const rawPhone = o.buyerPhone || o.recipientPhone || '';
      const isPhoneValid = isValidSmsPhone(rawPhone);
      const countryVal = o.country || 'Malaysia';
      const productVal = o.productName || o.productCategory || 'Digital Product';
      const orderDateVal = o.orderDate || o.orderCreationDate || o.shipTime || '';
      const orderTs = orderDateVal ? new Date(orderDateVal).getTime() || 0 : 0;

      if (!map.has(username)) {
        map.set(username, {
          username,
          name: o.buyerName || o.recipientName || username,
          phone: rawPhone || 'Hidden by Shopee',
          country: countryVal,
          product: productVal,
          isValidPhone: isPhoneValid,
          orderCount: 1,
          lastOrderDate: orderDateVal,
          lastOrderTimestamp: orderTs,
        });
      } else {
        const existing = map.get(username)!;
        existing.orderCount += 1;
        if (!existing.isValidPhone && isPhoneValid) {
          existing.phone = rawPhone;
          existing.isValidPhone = true;
        }
        if (orderTs > existing.lastOrderTimestamp || !existing.lastOrderDate) {
          existing.lastOrderDate = orderDateVal;
          existing.lastOrderTimestamp = orderTs;
          if (productVal) {
            existing.product = productVal;
          }
        }
      }
    });

    // Default sort by most recent order time descending so customer service sees latest buyers first
    return Array.from(map.values()).sort((a, b) => b.lastOrderTimestamp - a.lastOrderTimestamp);
  }, [orders]);

  const reachableCustomers = useMemo(() => customerList.filter((c) => c.isValidPhone), [customerList]);
  const hiddenCustomersCount = customerList.length - reachableCustomers.length;

  // Fast map to look up total SMS/WhatsApp outreach messages sent to each customer
  const outreachCountMap = useMemo(() => {
    const map = new Map<string, number>();
    smsLogs.forEach((log) => {
      const cleanPhone = (log.recipientPhone || '').replace(/[^\d]/g, '');
      const recipientName = (log.recipientName || '').toLowerCase().trim();

      if (cleanPhone) {
        map.set(`phone:${cleanPhone}`, (map.get(`phone:${cleanPhone}`) || 0) + 1);
        if (cleanPhone.startsWith('60')) {
          const local0 = '0' + cleanPhone.substring(2);
          map.set(`phone:${local0}`, (map.get(`phone:${local0}`) || 0) + 1);
        } else if (cleanPhone.startsWith('0')) {
          const intl60 = '60' + cleanPhone.substring(1);
          map.set(`phone:${intl60}`, (map.get(`phone:${intl60}`) || 0) + 1);
        }
      }
      if (recipientName) {
        map.set(`name:${recipientName}`, (map.get(`name:${recipientName}`) || 0) + 1);
      }
    });
    return map;
  }, [smsLogs]);

  const getCustomerOutreachCount = (phone?: string, name?: string, username?: string): number => {
    const cleanPhone = (phone || '').replace(/[^\d]/g, '');
    if (cleanPhone && outreachCountMap.has(`phone:${cleanPhone}`)) {
      return outreachCountMap.get(`phone:${cleanPhone}`) || 0;
    }
    if (name && outreachCountMap.has(`name:${name.toLowerCase().trim()}`)) {
      return outreachCountMap.get(`name:${name.toLowerCase().trim()}`) || 0;
    }
    if (username && outreachCountMap.has(`name:${username.toLowerCase().trim()}`)) {
      return outreachCountMap.get(`name:${username.toLowerCase().trim()}`) || 0;
    }
    return 0;
  };

  // Extract unique countries & available products
  const countriesList = useMemo(() => {
    const set = new Set(orders.map((o) => o.country || 'Malaysia').filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [orders]);

  const productsList = useMemo(() => {
    const set = new Set(orders.map((o) => o.productName).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [orders]);

  // Directory Table Filters & Sorting state
  const [dirCountryFilter, setDirCountryFilter] = useState<string>('All');
  const [dirProductFilter, setDirProductFilter] = useState<string>('All');
  const [dirSortField, setDirSortField] = useState<'name' | 'orderCount' | 'phone' | 'country' | 'product'>('orderCount');
  const [dirSortDirection, setDirSortDirection] = useState<'asc' | 'desc'>('desc');

  // Handle adding custom mobile numbers
  const handleAddTestRecipient = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedPhone = newTestPhone.trim();
    const trimmedName = newTestName.trim() || 'Added Contact';

    if (!trimmedPhone) {
      setToastMessage('⚠️ Please enter a mobile phone number.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    if (!isValidSmsPhone(trimmedPhone)) {
      setToastMessage('⚠️ Invalid mobile number format. Please use e.g. 0123456789 or +60123456789');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    let cleanPhone = trimmedPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '60' + cleanPhone.substring(1);
    }

    const testId = `custom_${Date.now()}`;
    const testUsername = `custom_${cleanPhone}`;
    const newTest: CustomTestRecipient = {
      id: testId,
      name: trimmedName,
      phone: cleanPhone,
      username: testUsername,
      country: 'Malaysia',
      product: 'Added Mobile Number',
      isValidPhone: true,
      isTest: true,
      orderCount: 0,
      lastOrderDate: 'Custom Contact',
      lastOrderTimestamp: Date.now(),
    };

    setCustomTestRecipients((prev) => [newTest, ...prev.filter((t) => t.phone !== cleanPhone)]);
    setSelectedCustomerUsernames((prev) => new Set(prev).add(testUsername));
    setNewTestName('');
    setNewTestPhone('');
    setIsAddingTestNumber(false);
    setToastMessage(`✅ Added mobile number: ${trimmedName} (${cleanPhone})`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDeleteTestRecipient = (id: string, username: string) => {
    setCustomTestRecipients((prev) => prev.filter((p) => p.id !== id));
    setSelectedCustomerUsernames((prev) => {
      const next = new Set(prev);
      next.delete(username);
      return next;
    });
  };

  // Merged selectable recipients for custom picker with purchase count and last order time
  const allSelectableRecipients = useMemo(() => {
    return [
      ...customTestRecipients.map((t) => ({
        ...t,
        orderCount: t.orderCount ?? 0,
        lastOrderDate: t.lastOrderDate || 'Custom Contact',
        lastOrderTimestamp: t.lastOrderTimestamp || 0,
      })),
      ...reachableCustomers,
    ];
  }, [customTestRecipients, reachableCustomers]);

  // Filtered and Sorted customer picker list for custom selection table
  const filteredCustomerPickerList = useMemo(() => {
    let list = allSelectableRecipients;

    // Filter by search keyword
    if (customerSearchQuery.trim()) {
      const q = customerSearchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.username.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.country.toLowerCase().includes(q) ||
          c.product.toLowerCase().includes(q) ||
          ('isTest' in c && (c as any).isTest && 'added mobile number'.includes(q))
      );
    }

    // Filter by Country dropdown
    if (dirCountryFilter !== 'All') {
      list = list.filter((c) => c.country === dirCountryFilter);
    }

    // Filter by Product dropdown
    if (dirProductFilter !== 'All') {
      list = list.filter((c) => c.product === dirProductFilter);
    }

    // Sort list
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (dirSortField === 'orderCount') {
        cmp = (a.orderCount || 0) - (b.orderCount || 0);
      } else if (dirSortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (dirSortField === 'phone') {
        cmp = a.phone.localeCompare(b.phone);
      } else if (dirSortField === 'country') {
        cmp = (a.country || '').localeCompare(b.country || '');
      } else if (dirSortField === 'product') {
        cmp = (a.product || '').localeCompare(b.product || '');
      }
      return dirSortDirection === 'asc' ? cmp : -cmp;
    });
  }, [
    allSelectableRecipients,
    customerSearchQuery,
    dirCountryFilter,
    dirProductFilter,
    dirSortField,
    dirSortDirection,
  ]);

  const handleSortToggle = (field: 'name' | 'orderCount' | 'phone' | 'country' | 'product') => {
    if (dirSortField === field) {
      setDirSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setDirSortField(field);
      setDirSortDirection(field === 'orderCount' ? 'desc' : 'asc');
    }
  };

  const handleToggleCustomer = (username: string) => {
    setSelectedCustomerUsernames((prev) => {
      const next = new Set(prev);
      if (next.has(username)) {
        next.delete(username);
      } else {
        next.add(username);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedCustomerUsernames((prev) => {
      const next = new Set(prev);
      filteredCustomerPickerList.forEach((c) => next.add(c.username));
      return next;
    });
  };

  const handleClearAllSelected = () => {
    setSelectedCustomerUsernames(new Set());
  };

  // Filtered recipients calculation
  const targetRecipients = useMemo(() => {
    let baseList: {
      name: string;
      phone: string;
      username: string;
      country: string;
      product: string;
      lastOrderDate?: string;
      lastOrderTimestamp?: number;
      orderCount?: number;
    }[] = [];

    if (audienceMode === 'custom') {
      return allSelectableRecipients.filter((c) => selectedCustomerUsernames.has(c.username));
    }

    // audienceMode === 'all'
    baseList = reachableCustomers;

    // In bulk 'all' mode, if added mobile numbers are enabled, include them automatically
    if (includeTestNumbersInBulk && customTestRecipients.length > 0) {
      const existingPhones = new Set(baseList.map((b) => b.phone.replace(/[^\d]/g, '')));
      const testToAdd = customTestRecipients.filter(
        (t) => !existingPhones.has(t.phone.replace(/[^\d]/g, ''))
      );
      return [...testToAdd, ...baseList];
    }

    return baseList;
  }, [
    audienceMode,
    reachableCustomers,
    allSelectableRecipients,
    selectedCustomerUsernames,
    includeTestNumbersInBulk,
    customTestRecipients,
  ]);

  const targetCount = targetRecipients.length;

  // Sorting state for 1-Click WhatsApp Customer Outreach Queue
  const [waSortField, setWaSortField] = useState<'name' | 'phone' | 'lastOrder' | 'country' | 'product' | 'messagesSent'>('lastOrder');
  const [waSortDirection, setWaSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleWaSortToggle = (field: 'name' | 'phone' | 'lastOrder' | 'country' | 'product' | 'messagesSent') => {
    if (waSortField === field) {
      setWaSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setWaSortField(field);
      setWaSortDirection(field === 'lastOrder' || field === 'messagesSent' ? 'desc' : 'asc');
    }
  };

  // Sort target recipients based on selected column
  const sortedTargetRecipients = useMemo(() => {
    return [...targetRecipients].sort((a, b) => {
      let cmp = 0;
      if (waSortField === 'name') {
        cmp = (a.name || a.username || '').localeCompare(b.name || b.username || '');
      } else if (waSortField === 'phone') {
        cmp = (a.phone || '').localeCompare(b.phone || '');
      } else if (waSortField === 'lastOrder') {
        cmp = (a.lastOrderTimestamp || 0) - (b.lastOrderTimestamp || 0);
      } else if (waSortField === 'country') {
        cmp = (a.country || '').localeCompare(b.country || '');
      } else if (waSortField === 'product') {
        cmp = (a.product || '').localeCompare(b.product || '');
      } else if (waSortField === 'messagesSent') {
        const countA = getCustomerOutreachCount(a.phone, a.name, a.username);
        const countB = getCustomerOutreachCount(b.phone, b.name, b.username);
        cmp = countA - countB;
      }
      return waSortDirection === 'asc' ? cmp : -cmp;
    });
  }, [targetRecipients, waSortField, waSortDirection, outreachCountMap]);

  // WhatsApp Queue Pagination Calculations
  const totalWaRecords = sortedTargetRecipients.length;
  const totalWaPages = Math.max(1, Math.ceil(totalWaRecords / waQueuePageSize));
  const waStartIndex = (waQueuePage - 1) * waQueuePageSize;
  const waEndIndex = Math.min(waStartIndex + waQueuePageSize, totalWaRecords);
  const paginatedWaRecipients = useMemo(() => {
    return sortedTargetRecipients.slice(waStartIndex, waEndIndex);
  }, [sortedTargetRecipients, waStartIndex, waEndIndex]);

  // Reset WhatsApp Queue Page whenever audience filters or total recipients count change
  useEffect(() => {
    setWaQueuePage(1);
  }, [targetRecipients.length, audienceMode, selectedCustomerUsernames.size]);

  // Detect Unicode / non-GSM characters
  const hasUnicode = useMemo(() => {
    const gsmRegex = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !"#¤%&'()*+,\-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà]*$/;
    return !gsmRegex.test(messageText);
  }, [messageText]);

  // Character counter & segment estimator
  const charLength = messageText.length;
  const maxCharsPerSegment = hasUnicode ? 70 : 160;
  const multiSegmentLimit = hasUnicode ? 67 : 153;
  const smsSegments = charLength === 0 
    ? 1 
    : charLength <= maxCharsPerSegment 
    ? 1 
    : Math.ceil(charLength / multiSegmentLimit);

  // Helper to remove emojis / unicode for plain GSM SMS
  const handleCleanEmojis = () => {
    const cleaned = messageText
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    setMessageText(cleaned);
  };

  // Two-Way Sync of SMS & WhatsApp Logs Across All CS Staff & Server KV
  const fetchSmsLogsAndSettings = async (silent = false) => {
    if (!silent) setIsLoadingLogs(true);
    try {
      // Gather local SMS logs and WhatsApp logs stored in this browser
      let localSmsLogs: SmsLog[] = [];
      let localWaLogs: SmsLog[] = [];
      try {
        localSmsLogs = JSON.parse(localStorage.getItem('wm_movider_sms_logs') || '[]');
        localWaLogs = JSON.parse(localStorage.getItem('wm_whatsapp_logs') || '[]');
      } catch (e) {}
      const localCombined = [...localWaLogs, ...localSmsLogs];

      let serverLogs: SmsLog[] = [];

      // Step 1: Push client logs to server to merge into global backend store and KV
      try {
        const syncRes = await fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync_logs',
            logs: localCombined,
          }),
        });
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          if (Array.isArray(syncData.logs)) {
            serverLogs = syncData.logs;
          }
        }
      } catch (syncErr) {
        console.warn('Sync logs POST notice:', syncErr);
      }

      // Step 2: Fallback GET if needed and load Movider credentials
      if (!serverLogs || serverLogs.length === 0) {
        const res = await fetch('/api/send-sms');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.logs)) serverLogs = data.logs;
          if (data.settings) {
            if (data.settings.apiKey && (!apiKey || apiKey.startsWith('3GnQOV'))) {
              setApiKey(data.settings.apiKey);
              localStorage.setItem('wm_movider_api_key', data.settings.apiKey);
            }
            if (data.settings.apiSecret && (!apiSecret || apiSecret.startsWith('RENJe') || apiSecret.startsWith('vHVpO3g'))) {
              setApiSecret(data.settings.apiSecret);
              localStorage.setItem('wm_movider_api_secret', data.settings.apiSecret);
            }
            localStorage.setItem('wm_movider_sender_id', 'WCGMall');
          }
        }
      }

      // Merge all logs by ID or (phone + sentTime)
      const logMap = new Map<string, SmsLog>();
      [...localCombined, ...serverLogs].forEach((l) => {
        if (l && l.id) {
          logMap.set(l.id, l);
        } else if (l && l.recipientPhone && l.sentTime) {
          logMap.set(`${l.recipientPhone}_${l.sentTime}`, l);
        }
      });

      const combined = Array.from(logMap.values()).sort(
        (a, b) => new Date(b.sentTime || 0).getTime() - new Date(a.sentTime || 0).getTime()
      );

      setSmsLogs(combined);

      // Persist full synchronized logs into browser storage
      const waOnlyLogs = combined.filter((x) => x.channel === 'WHATSAPP' || x.senderId === 'WHATSAPP_WEB');
      const smsOnlyLogs = combined.filter((x) => x.channel !== 'WHATSAPP' && x.senderId !== 'WHATSAPP_WEB');
      localStorage.setItem('wm_whatsapp_logs', JSON.stringify(waOnlyLogs));
      localStorage.setItem('wm_movider_sms_logs', JSON.stringify(smsOnlyLogs));

      if (!silent) {
        setToastMessage(`✅ Synchronized ${combined.length} SMS & WhatsApp logs across all CS staff!`);
        setTimeout(() => setToastMessage(null), 3500);
      }
    } catch (err) {
      console.warn('Failed to sync SMS logs:', err);
    } finally {
      if (!silent) setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchSmsLogsAndSettings(true);

    // Auto-sync every 25 seconds so all CS team members working simultaneously receive live updates
    const interval = setInterval(() => {
      fetchSmsLogsAndSettings(true);
    }, 25000);

    return () => clearInterval(interval);
  }, []);

  // Dynamic Template Variation Engine (Short, Plain Text, No Emojis for 1 SMS Segment)
  const CAMPAIGN_TEMPLATES: Record<string, string[]> = {
    voucher: [
      'Hi {buyerName}! Thank you for ordering from WCGMall on Shopee. Your voucher code is ready in your chat!',
      'Hello {buyerName}! Your digital code order is completed on Shopee. Check your chat now! - WCGMall',
    ],
    promo: [
      'Hi {buyerName}! Special offer: Get 10% OFF your next order on WCGMall! Code: WCG10OFF',
      'Exclusive reward for {buyerName}! Claim 10% rebate on your next reload with code: WCG2026.',
    ],
    restock: [
      'Hi {buyerName}! Fresh restock alert! MLBB, PUBG & Steam Wallet codes are live at WCGMall!',
      'Great news {buyerName}! Fresh supply of game codes just arrived at WCGMall Store!',
    ],
    loyalty: [
      'Hi {buyerName}, as a VIP buyer at WCGMall, here is an exclusive bonus cashback code: VIPWCG2026!',
      'Thank you for your loyal support {buyerName}! Enjoy 5% extra cashback on WCGMall today.',
    ],
    festive: [
      'Hi {buyerName}! Flash Sale is LIVE! Enjoy massive discounts on all game codes at WCGMall.',
      'Special Deals for {buyerName}! Instant delivery + bonus game credits today at WCGMall!',
    ],
    review: [
      'Hi {buyerName}! Rate your order 5 stars on Shopee & reply to get a bonus voucher for your next top-up!',
      'Hello {buyerName}! Leave a 5-star review on Shopee & claim your bonus code!',
    ],
  };

  const [templateIndices, setTemplateIndices] = useState<Record<string, number>>({});

  const handleGenerateTemplate = (type: string) => {
    const list = CAMPAIGN_TEMPLATES[type];
    if (!list || list.length === 0) return;

    const currentIndex = templateIndices[type] ?? 0;
    const selectedLine = list[currentIndex % list.length];

    setMessageText(selectedLine);
    setTemplateIndices((prev) => ({
      ...prev,
      [type]: (currentIndex + 1) % list.length,
    }));
  };

  // Helper formatting injectors
  const injectFormatting = (symbol: string) => {
    setMessageText((prev) => `${prev} ${symbol}`);
  };

  // Launch WhatsApp Web Direct Chat for a single recipient (shows confirmation modal)
  const handleLaunchWhatsAppChat = (
    recipient: { name: string; phone: string; username?: string; country?: string; product?: string },
    customMsg?: string
  ) => {
    const waPhone = formatWhatsAppPhone(recipient.phone);
    if (!waPhone) {
      setToastMessage('❌ Invalid or missing phone number for WhatsApp.');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    const finalMsg =
      customMsg ||
      messageText.replace(/\{buyerName\}/g, recipient.name || recipient.username || 'Customer');

    const encodedText = encodeURIComponent(finalMsg);
    const waUrl = `https://wa.me/${waPhone}?text=${encodedText}`;

    // Open WhatsApp in new tab
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    // Open the Confirmation Modal immediately without recording false history
    setPendingWaConfirmation({
      recipient,
      waPhone,
      initialMessage: finalMsg,
      customMessage: finalMsg,
    });
  };

  // Confirm that message was actually sent in WhatsApp (with any edited note/text)
  const handleConfirmWaSent = async () => {
    if (!pendingWaConfirmation) return;
    const { recipient, waPhone, customMessage } = pendingWaConfirmation;
    const cleanPhone = (recipient.phone || '').replace(/^\+/, '').replace(/\s+/g, '');

    const newLog: SmsLog = {
      id: `wa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipientName: recipient.name || recipient.username || 'Customer',
      recipientPhone: cleanPhone,
      messageText: customMessage || pendingWaConfirmation.initialMessage,
      senderId: 'WHATSAPP_WEB',
      sentTime: new Date().toISOString(),
      status: 'DELIVERED',
      channel: 'WHATSAPP',
    };

    // Save to local WhatsApp logs
    const existingWaLogs: SmsLog[] = JSON.parse(localStorage.getItem('wm_whatsapp_logs') || '[]');
    const updatedWaLogs = [newLog, ...existingWaLogs.filter((x) => x.id !== newLog.id)];
    localStorage.setItem('wm_whatsapp_logs', JSON.stringify(updatedWaLogs));

    setSmsLogs((prev) => [newLog, ...prev]);

    // Broadcast outreach immediately to backend API so all CS staff receive it in real-time
    try {
      await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log_outreach',
          log: newLog,
        }),
      });
    } catch (e) {
      console.warn('Failed to broadcast WhatsApp outreach to server:', e);
    }

    setToastMessage(`✅ WhatsApp message recorded for ${recipient.name} (+${waPhone})!`);
    setTimeout(() => setToastMessage(null), 3500);
    setPendingWaConfirmation(null);
  };

  const handleCancelWaConfirmation = () => {
    setPendingWaConfirmation(null);
  };

  // Main Campaign Dispatcher (SMS, WhatsApp, or Omnichannel)
  const handleDispatchCampaign = async () => {
    if (!messageText.trim()) {
      alert('Please enter message text before dispatching.');
      return;
    }

    if (targetCount === 0) {
      alert('No valid target recipients selected.');
      return;
    }

    setIsSending(true);

    try {
      const batchList = targetRecipients;
      let lastSmsError: string | null = null;
      let successCount = 0;

      if (dispatchChannel === 'sms' || dispatchChannel === 'both') {
        setToastMessage(`⏳ Dispatching SMS to ${batchList.length} recipient(s)...`);

        for (let i = 0; i < batchList.length; i++) {
          const recipient = batchList[i];
          setToastMessage(`⏳ Sending SMS ${i + 1} of ${batchList.length} to ${recipient.name}...`);

          const personalizedMsg = messageText.replace(/\{buyerName\}/g, recipient.name || recipient.username || 'Customer');

          const response = await fetch('/api/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send_sms',
              apiKey: apiKey || 'iPnNDUbKo2OyVvr5osnidwt8uL1-GW',
              apiSecret: apiSecret || 'Jl0WWdL6vGjbq5ZVT2qxLFJqUYadPE',
              senderId: 'WCGMall',
              recipientPhone: recipient.phone,
              recipientName: recipient.name || recipient.username,
              messageText: personalizedMsg,
              channel: dispatchChannel === 'both' ? 'SMS' : dispatchChannel.toUpperCase(),
            }),
          });

          const data = await response.json();
          if (data.log?.errorMessage) {
            lastSmsError = data.log.errorMessage;
          } else if (data.success) {
            successCount += 1;
          }

          // 200ms pacing between consecutive messages to prevent telco spam-rate throttling
          if (i < batchList.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      }

      if (dispatchChannel === 'whatsapp' || dispatchChannel === 'both') {
        // Automatically open the WhatsApp chat for the first recipient in batch
        const firstRecipient = batchList[0];
        if (firstRecipient) {
          handleLaunchWhatsAppChat(firstRecipient);
        }
      }

      if (lastSmsError && successCount === 0) {
        setToastMessage(`❌ SMS Failed: ${lastSmsError}`);
      } else {
        setToastMessage(`✅ Successfully dispatched campaign to ${batchList.length} recipient(s)!`);
      }
      fetchSmsLogsAndSettings();
    } catch (err) {
      setToastMessage('❌ Dispatch failed. Please check your connection and credentials.');
    } finally {
      setIsSending(false);
      setTimeout(() => setToastMessage(null), 6000);
    }
  };

  // Filtered Logs by Search & Channel
  const filteredLogs = useMemo(() => {
    return smsLogs.filter((l) => {
      const matchesChannel =
        channelFilter === 'ALL' ||
        (channelFilter === 'SMS' && (l.channel === 'SMS' || !l.channel || l.senderId !== 'WHATSAPP_WEB')) ||
        (channelFilter === 'WHATSAPP' && (l.channel === 'WHATSAPP' || l.senderId === 'WHATSAPP_WEB'));

      if (!matchesChannel) return false;

      if (!searchLogQuery) return true;
      const q = searchLogQuery.toLowerCase();
      return (
        l.recipientName?.toLowerCase().includes(q) ||
        l.recipientPhone?.includes(q) ||
        l.messageText?.toLowerCase().includes(q) ||
        l.status?.toLowerCase().includes(q)
      );
    });
  }, [smsLogs, searchLogQuery, channelFilter]);

  // Reset logs pagination to page 1 whenever filters change
  useEffect(() => {
    setLogsPage(1);
  }, [searchLogQuery, channelFilter]);

  const totalLogsRecords = filteredLogs.length;
  const totalLogsPages = Math.max(1, Math.ceil(totalLogsRecords / logsPageSize));
  const logsStartIndex = (logsPage - 1) * logsPageSize;
  const logsEndIndex = Math.min(logsStartIndex + logsPageSize, totalLogsRecords);
  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice(logsStartIndex, logsEndIndex);
  }, [filteredLogs, logsStartIndex, logsEndIndex]);

  // First recipient for live preview
  const previewRecipient = targetRecipients[0] || { name: 'Ahmad Rizal', phone: '+60123456789' };
  const rawPersonalized = messageText.replace(/\{buyerName\}/g, previewRecipient.name);
  const previewMessage = rawPersonalized.trim().startsWith('RM0 WCGMall') || rawPersonalized.trim().startsWith('RM0.00 WCGMall')
    ? rawPersonalized
    : `RM0 WCGMall: ${rawPersonalized}`;

  return (
    <div className="space-y-6 w-full animate-fade-in">
      {/* Top Banner & Omnichannel Status Header */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-green-500 text-white flex items-center justify-center font-bold shadow-md shrink-0">
            {activeView === 'history' ? <Clock className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                {activeView === 'history' ? 'Outbound Campaign Logs & Audit History' : 'SMS & WhatsApp Marketing Hub'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                Movider SMS Gateway Active
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {activeView === 'history'
                ? 'Review audit logs, delivery statuses, error reports, and recipient responses across SMS & WhatsApp channels.'
                : 'Engage Shopee buyers with automated order notifications, voucher delivery, and instant messaging.'}
            </p>
          </div>
        </div>

        {/* Right side of SMS & WhatsApp Marketing Hub box: History / Back Button */}
        <div className="flex items-center gap-2">
          {activeView === 'composer' ? (
            <button
              type="button"
              onClick={() => setActiveView('history')}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-sm transition-all active:scale-95 group"
              title="View Sent Campaign Logs & History"
            >
              <Clock className="w-4 h-4 text-emerald-400 group-hover:rotate-12 transition-transform" />
              <span>History</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-emerald-300 text-[10px] font-mono border border-slate-700 font-bold">
                {smsLogs.length}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveView('composer')}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-sm transition-all active:scale-95"
              title="Return to Campaign Composer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Campaign Hub</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center justify-between shadow-lg animate-bounce">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* VIEW 1: CAMPAIGN COMPOSER & 1-CLICK WHATSAPP OUTREACH QUEUE */}
      {activeView === 'composer' && (
        <>
          {/* Main Grid: Responsive 12-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Campaign Composer */}
            <div className={`${audienceMode === 'custom' ? 'lg:col-span-5' : 'lg:col-span-7 xl:col-span-8'} bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-4`}>
          {/* Header & Channel Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Send className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Compose Marketing Campaign
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-extrabold flex items-center gap-1 shadow-2xs">
                <Smartphone className="w-3 h-3 text-blue-600" />
                <span>Sender: WCGMall</span>
              </span>
            </div>

            {/* Dispatch Channel Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setDispatchChannel('whatsapp')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  dispatchChannel === 'whatsapp'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => setDispatchChannel('sms')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  dispatchChannel === 'sms'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>SMS</span>
              </button>
              <button
                type="button"
                onClick={() => setDispatchChannel('both')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  dispatchChannel === 'both'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>SMS + WA</span>
              </button>
            </div>
          </div>

          {/* Target Audience Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <label className="block text-[11px] font-bold text-slate-700 uppercase">
                1. Target Audience ({targetCount} Buyers Selected)
              </label>
              {hiddenCustomersCount > 0 && (
                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-semibold">
                  ⚠️ {hiddenCustomersCount} buyer(s) have hidden phone numbers
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: 'all', label: `All Reachable (${reachableCustomers.length})` },
                { id: 'custom', label: `Select Customers${selectedCustomerUsernames.size > 0 ? ` (${selectedCustomerUsernames.size})` : ''}` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAudienceMode(tab.id as any)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center ${
                    audienceMode === tab.id
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Quick Added Number inclusion checkbox for bulk blasts */}
            {audienceMode === 'all' && customTestRecipients.length > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-emerald-900">
                  <input
                    type="checkbox"
                    checked={includeTestNumbersInBulk}
                    onChange={(e) => setIncludeTestNumbersInBulk(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-emerald-300 cursor-pointer"
                  />
                  <span>
                    Include {customTestRecipients.length} added mobile number{customTestRecipients.length > 1 ? 's' : ''} in this blast
                  </span>
                </label>
                <span className="text-[11px] text-emerald-700 font-mono font-medium truncate max-w-[200px]">
                  ({customTestRecipients.map((t) => t.name).join(', ')})
                </span>
              </div>
            )}
          </div>

          {/* Quick Campaign Templates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700 uppercase text-[11px] flex items-center gap-1.5">
                <span>2. Message Templates</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </label>
              <span className="text-[11px] text-slate-400 font-medium">Variable: <code>{'{buyerName}'}</code></span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMessageText(DEFAULT_CAMPAIGN_MESSAGE)}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>WCGMall Benefits (Default)</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenerateTemplate('voucher')}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>Voucher Ready</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenerateTemplate('promo')}
                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>10% OFF Promo</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenerateTemplate('restock')}
                className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold border border-purple-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5 text-purple-600" />
                <span>Restock Alert</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenerateTemplate('loyalty')}
                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>VIP Loyalty</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenerateTemplate('festive')}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
              >
                <DollarSign className="w-3.5 h-3.5 text-rose-600" />
                <span>Festive Top-Up</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenerateTemplate('review')}
                className="px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-xs font-bold border border-cyan-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
              >
                <Users className="w-3.5 h-3.5 text-cyan-600" />
                <span>5-Star Review Bonus</span>
              </button>
            </div>
          </div>

          {/* Message Textarea */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 uppercase text-[11px]">
              3. Campaign Message Content
            </label>
            <textarea
              rows={4}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your campaign message content..."
              className="w-full p-3 rounded-xl border border-slate-300 bg-slate-50 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all resize-y"
            />
            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500 font-medium">
              <div className="flex items-center gap-2">
                <span>Length: <strong>{charLength}</strong> chars</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${hasUnicode ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                  {hasUnicode ? 'Unicode (UCS-2)' : 'Standard (GSM 7-bit)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span>
                  Segments: <strong className={smsSegments > 1 ? 'text-amber-700 font-bold' : 'text-blue-700'}>{smsSegments} SMS</strong>
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                  ~${(smsSegments * 0.025).toFixed(4)} / recipient
                </span>
              </div>
            </div>
          </div>

          {/* Dispatch Action Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleDispatchCampaign}
              disabled={isSending || targetCount === 0}
              className={`w-full py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isSending
                  ? 'bg-slate-400 text-white cursor-not-allowed'
                  : dispatchChannel === 'whatsapp'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98'
                  : dispatchChannel === 'sms'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-98'
                  : 'bg-slate-900 hover:bg-slate-800 text-white active:scale-98'
              }`}
            >
              {dispatchChannel === 'whatsapp' ? (
                <MessageCircle className="w-4 h-4 text-white" />
              ) : dispatchChannel === 'sms' ? (
                <Send className="w-4 h-4 text-white" />
              ) : (
                <Zap className="w-4 h-4 text-amber-400" />
              )}
              <span>
                {isSending
                  ? 'Dispatching Campaign...'
                  : dispatchChannel === 'whatsapp'
                  ? `Open WhatsApp Chat for ${targetCount} Recipient(s)`
                  : dispatchChannel === 'sms'
                  ? `Send Movider SMS Blast to ${targetCount} Recipient(s)`
                  : `Launch Omnichannel (SMS + WhatsApp) for ${targetCount} Recipient(s)`}
              </span>
            </button>
          </div>
        </div>

        {/* Right Column: Custom Customer Directory Table (if Select Customers active) OR Live Mobile Preview (if other modes) */}
        {audienceMode === 'custom' ? (
          <div className="lg:col-span-7 bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-3.5 flex flex-col justify-between">
            <div className="space-y-3">
              {/* Header & Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Select Recipients Directory
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Showing {filteredCustomerPickerList.length} of {allSelectableRecipients.length}
                  </span>
                  <span className="font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 text-xs">
                    {selectedCustomerUsernames.size} Selected
                  </span>
                </div>
              </div>

              {/* Filter By Segment (Country & Product) Toolbar */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    <Filter className="w-3.5 h-3.5 text-blue-600" />
                    <span>Filter By Segment (Country &amp; Product)</span>
                  </div>
                  {(dirCountryFilter !== 'All' || dirProductFilter !== 'All' || customerSearchQuery.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDirCountryFilter('All');
                        setDirProductFilter('All');
                        setCustomerSearchQuery('');
                      }}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Both Filters</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Dropdown 1: Country */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-slate-500">
                      1. Select Country
                    </label>
                    <CustomDropdown
                      options={countriesList.map((c) => ({
                        value: c,
                        label: c === 'All' ? 'All Countries (Any)' : c,
                      }))}
                      value={dirCountryFilter}
                      onChange={setDirCountryFilter}
                      className="w-full"
                    />
                  </div>

                  {/* Dropdown 2: Product */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold uppercase text-slate-500">
                      2. Select Product
                    </label>
                    <CustomDropdown
                      options={productsList.map((p) => ({
                        value: p,
                        label: p === 'All' ? 'All Products (Any)' : p,
                      }))}
                      value={dirProductFilter}
                      onChange={setDirProductFilter}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Search & Actions Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      placeholder="Search by name, phone, country, or username..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingTestNumber(!isAddingTestNumber)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold border cursor-pointer transition-all active:scale-95 flex items-center gap-1 ${
                        isAddingTestNumber
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Number</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200 cursor-pointer transition-all active:scale-95"
                    >
                      Select All ({filteredCustomerPickerList.length})
                    </button>

                    <button
                      type="button"
                      onClick={handleClearAllSelected}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer transition-all active:scale-95"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Inline Form to Add Mobile Number */}
              {isAddingTestNumber && (
                <div className="p-3 bg-emerald-50/90 rounded-xl border border-emerald-300 space-y-2.5 shadow-xs animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <Plus className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Add Mobile Number</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddingTestNumber(false)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-emerald-800 mb-0.5">
                        Name / Label
                      </label>
                      <input
                        type="text"
                        value={newTestName}
                        onChange={(e) => setNewTestName(e.target.value)}
                        placeholder="e.g. My Phone / Colleague"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-emerald-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-emerald-800 mb-0.5">
                        Mobile Number
                      </label>
                      <input
                        type="text"
                        value={newTestPhone}
                        onChange={(e) => setNewTestPhone(e.target.value)}
                        placeholder="e.g. 0123456789 or +60123456789"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-emerald-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingTestNumber(false)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddTestRecipient()}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold shadow-2xs cursor-pointer transition-all active:scale-95"
                    >
                      Save Number
                    </button>
                  </div>
                </div>
              )}

              {/* Recipients Directory Table */}
              <div className="h-[460px] max-h-[500px] overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200 z-10 select-none">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredCustomerPickerList.length > 0 &&
                            filteredCustomerPickerList.every((c) => selectedCustomerUsernames.has(c.username))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleSelectAllFiltered();
                            } else {
                              handleClearAllSelected();
                            }
                          }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                      </th>
                      <th
                        onClick={() => handleSortToggle('name')}
                        className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <span>Buyer / Contact</span>
                          {dirSortField === 'name' ? (
                            dirSortDirection === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-blue-600" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-blue-600" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSortToggle('orderCount')}
                        className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <span>Purchases</span>
                          {dirSortField === 'orderCount' ? (
                            dirSortDirection === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-blue-600" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-blue-600" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSortToggle('country')}
                        className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <span>Country</span>
                          {dirSortField === 'country' ? (
                            dirSortDirection === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-blue-600" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-blue-600" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredCustomerPickerList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-16 text-center text-xs text-slate-400 italic">
                          No matching recipients found. Try clearing your filters or search term.
                        </td>
                      </tr>
                    ) : (
                      filteredCustomerPickerList.map((cust) => {
                        const isChecked = selectedCustomerUsernames.has(cust.username);
                        const isTest = 'isTest' in cust && (cust as any).isTest;

                        return (
                          <tr
                            key={cust.username}
                            onClick={() => handleToggleCustomer(cust.username)}
                            className={`cursor-pointer transition-colors ${
                              isChecked
                                ? isTest
                                  ? 'bg-emerald-50/80 hover:bg-emerald-100/70 text-slate-900'
                                  : 'bg-blue-50/80 hover:bg-blue-100/70 text-slate-900'
                                : 'hover:bg-slate-50/90 text-slate-700'
                            }`}
                          >
                            {/* Checkbox Column */}
                            <td className="py-2.5 px-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleCustomer(cust.username)}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                              />
                            </td>

                            {/* Buyer Name, Username & Phone Number (styled like before / image.png) */}
                            <td className="py-2.5 px-3">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-xs text-slate-900">{cust.name}</span>
                                  {isTest ? (
                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                      Added Mobile Number
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                                      @{cust.username}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs font-mono font-medium text-emerald-700 block">
                                  {cust.phone}
                                </span>
                              </div>
                            </td>

                            {/* Purchases: Clean number 1/2/3 (no box, no icon, no order text) */}
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-xs text-slate-800">
                                {isTest ? '—' : cust.orderCount || 1}
                              </span>
                            </td>

                            {/* Country: Just country */}
                            <td className="py-2.5 px-3">
                              <span className="text-xs font-medium text-slate-700">
                                {cust.country || 'Malaysia'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Live Preview Box inside Select Directory tab */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 truncate">
                <Smartphone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="text-[11px] text-slate-600 truncate">
                  <strong>Preview ({previewRecipient.name}):</strong> <span className="font-mono text-slate-800">{previewMessage.substring(0, 50)}...</span>
                </span>
              </div>
              <span className="text-[11px] font-extrabold text-blue-700 shrink-0 ml-2">
                ~${(targetCount * smsSegments * 0.025).toFixed(2)} est.
              </span>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Live Message Preview
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold">
                  Real-Time
                </span>
              </div>

              {/* Smartphone Chat Preview Frame */}
              <div className="rounded-xl border border-emerald-300 bg-[#e5ddd5] p-3 shadow-inner flex flex-col justify-between overflow-hidden relative min-h-[220px]">
                {/* WhatsApp Header */}
                <div className="bg-[#075e54] text-white p-2.5 rounded-t-lg -mx-3 -mt-3 flex items-center justify-between shadow-xs mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-400 text-emerald-950 font-black text-[10px] flex items-center justify-center">
                      WCG
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight">WCGMall Official Store</div>
                      <div className="text-[9px] text-emerald-200">Online • Verified</div>
                    </div>
                  </div>
                  <MessageCircle className="w-4 h-4 text-emerald-300" />
                </div>

                {/* Chat Bubble with RM0 WCGMall prefix */}
                <div className="bg-[#dcf8c6] text-slate-900 p-2.5 rounded-lg rounded-tl-none shadow-xs text-xs space-y-1 self-start max-w-[96%] my-auto relative">
                  <p className="whitespace-pre-wrap text-[11px] font-sans leading-relaxed text-slate-800">
                    {previewMessage}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[9px] text-slate-500 font-mono">
                    <span>12:45 PM</span>
                    <CheckCheck className="w-3 h-3 text-blue-500" />
                  </div>
                </div>

                {/* Recipient Indicator */}
                <div className="text-[10px] text-emerald-900 font-bold bg-emerald-100/90 px-2 py-0.5 rounded text-center mt-3 border border-emerald-200">
                  Preview for {previewRecipient.name}
                </div>
              </div>
            </div>

            {/* Campaign Analytics & Cost Summary Box */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2.5 text-xs">
              <div className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                <span>Campaign Summary</span>
                <span className="text-emerald-600 font-extrabold text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {dispatchChannel === 'sms' ? 'SMS Movider' : dispatchChannel === 'whatsapp' ? 'WhatsApp API' : 'Omnichannel'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Recipients</span>
                  <span className="font-extrabold text-slate-900 text-sm">{targetCount} buyers</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Est. Cost</span>
                  <span className="font-extrabold text-blue-700 text-sm">
                    ~${(targetCount * smsSegments * 0.025).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 font-medium">
                <span>Sender ID: <strong className="text-slate-800 font-bold">WCGMall</strong></span>
                <span>Rate: <strong className="text-slate-800 font-bold">$0.025 / SMS</strong></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Interactive 1-Click WhatsApp Direct Chat Queue */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              1-Click WhatsApp Customer Outreach Queue
            </h3>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
            {targetRecipients.length} Reachable Buyers
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 sticky top-0 select-none">
                <th className="py-2.5 px-3">
                  <button
                    type="button"
                    onClick={() => handleWaSortToggle('name')}
                    className="flex items-center gap-1.5 hover:text-emerald-700 transition-colors uppercase font-bold cursor-pointer"
                    title="Click to sort by Buyer Customer Name"
                  >
                    <span>Buyer Customer</span>
                    {waSortField === 'name' ? (
                      waSortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-emerald-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-emerald-600 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-3">
                  <button
                    type="button"
                    onClick={() => handleWaSortToggle('phone')}
                    className="flex items-center gap-1.5 hover:text-emerald-700 transition-colors uppercase font-bold cursor-pointer"
                    title="Click to sort by Phone Number"
                  >
                    <span>Phone Number</span>
                    {waSortField === 'phone' ? (
                      waSortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-emerald-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-emerald-600 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-3">
                  <button
                    type="button"
                    onClick={() => handleWaSortToggle('lastOrder')}
                    className="flex items-center gap-1.5 hover:text-emerald-700 transition-colors uppercase font-bold cursor-pointer"
                    title="Click to sort by Last Order Time"
                  >
                    <span>Last Order Time</span>
                    {waSortField === 'lastOrder' ? (
                      waSortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-emerald-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-emerald-600 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-3">
                  <button
                    type="button"
                    onClick={() => handleWaSortToggle('country')}
                    className="flex items-center gap-1.5 hover:text-emerald-700 transition-colors uppercase font-bold cursor-pointer"
                    title="Click to sort by Country"
                  >
                    <span>Country</span>
                    {waSortField === 'country' ? (
                      waSortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-emerald-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-emerald-600 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-3">
                  <button
                    type="button"
                    onClick={() => handleWaSortToggle('product')}
                    className="flex items-center gap-1.5 hover:text-emerald-700 transition-colors uppercase font-bold cursor-pointer"
                    title="Click to sort by Product Name"
                  >
                    <span>Product Name</span>
                    {waSortField === 'product' ? (
                      waSortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-emerald-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-emerald-600 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleWaSortToggle('messagesSent')}
                    className="flex items-center justify-center gap-1.5 w-full hover:text-emerald-700 transition-colors uppercase font-bold cursor-pointer"
                    title="Click to sort by Messages Sent Count"
                  >
                    <span>Messages Sent</span>
                    {waSortField === 'messagesSent' ? (
                      waSortDirection === 'asc' ? (
                        <ArrowUp className="w-3 h-3 text-emerald-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-emerald-600 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {paginatedWaRecipients.map((r, idx) => {
                const cleanDisplayPhone = (r.phone || '').replace(/^\+/, '').replace(/\s+/g, '');
                const sentCount = getCustomerOutreachCount(r.phone, r.name, r.username);

                return (
                  <tr key={idx} className="hover:bg-emerald-50/50 transition-colors group">
                    {/* Buyer Customer */}
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => setSelectedProfileCustomer(r)}
                        className="text-left group/cust cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-2"
                        title="Click to view full Customer Profile & Order History"
                      >
                        <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover/cust:bg-blue-100 transition-colors">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="font-bold text-xs text-slate-900 group-hover/cust:text-blue-700 group-hover/cust:underline block">
                            {r.name}
                          </span>
                          {r.username && r.username !== r.name && (
                            <span className="text-[10px] font-mono text-slate-400 block">
                              @{r.username}
                            </span>
                          )}
                        </div>
                      </button>
                    </td>

                    {/* Phone Number - Clean without bracket */}
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-700 whitespace-nowrap">
                      {cleanDisplayPhone || r.phone}
                    </td>

                    {/* Last Order Time */}
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {r.lastOrderDate && r.lastOrderDate !== 'Custom Contact' ? (
                        <div className="flex items-center gap-1.5" title={`Order timestamp: ${r.lastOrderDate}`}>
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-700">{r.lastOrderDate}</span>
                        </div>
                      ) : r.lastOrderDate === 'Custom Contact' ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Custom Contact
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">-</span>
                      )}
                    </td>

                    {/* Country */}
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{r.country || 'Malaysia'}</td>

                    {/* Shorter Product Column with Hover Tooltip */}
                    <td className="py-2.5 px-3 max-w-[130px] sm:max-w-[150px] relative group/prod">
                      <div className="font-medium text-slate-800 truncate cursor-pointer hover:text-emerald-700 transition-colors">
                        {r.product || 'Digital Product'}
                      </div>
                      {/* Special Hover Preview Tooltip - render downwards for top rows to prevent clipping by table headers */}
                      <div
                        className={`absolute left-0 ${
                          idx < 3 ? 'top-full mt-2' : 'bottom-full mb-2'
                        } z-[60] hidden group-hover/prod:block w-72 sm:w-80 p-3 bg-white text-slate-900 text-xs rounded-xl shadow-2xl border border-slate-200 pointer-events-none leading-snug whitespace-normal ring-1 ring-slate-900/10`}
                      >
                        <div className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <ShoppingBag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>FULL PRODUCT NAME</span>
                        </div>
                        <div className="font-bold text-slate-900 break-words leading-relaxed">
                          {r.product || 'Digital Product'}
                        </div>
                      </div>
                    </td>

                    {/* Messages Sent Count */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {sentCount > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200"
                          title={`${sentCount} outreach message(s) dispatched to ${r.name}`}
                        >
                          <MessageSquare className="w-3 h-3 text-purple-600" />
                          <span>{sentCount} Sent</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-400 border border-slate-200">
                          0 Sent
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleLaunchWhatsAppChat(r)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1.5 ml-auto cursor-pointer shadow-2xs transition-all active:scale-95"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Open WhatsApp</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {targetRecipients.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-400 italic">
                    No buyers matched the selected audience criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rows per page & Pagination Controls for WhatsApp Outreach Queue */}
        {totalWaRecords > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <PaginationControls
              currentPage={waQueuePage}
              totalPages={totalWaPages}
              pageSize={waQueuePageSize}
              onPageChange={setWaQueuePage}
              onPageSizeChange={(size) => {
                setWaQueuePageSize(size);
                setWaQueuePage(1);
              }}
              totalRecords={totalWaRecords}
              startIndex={waStartIndex}
              endIndex={waEndIndex}
            />
          </div>
        )}
      </div>
      </>
      )}

      {/* VIEW 2: DEDICATED OUTBOUND CAMPAIGN LOGS & AUDIT HISTORY PAGE */}
      {activeView === 'history' && (
        <div className="space-y-6 animate-fade-in">
          {/* Quick Metrics Bar for Outbound History */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Total Outreaches Logged
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900 font-mono">{smsLogs.length}</span>
                <span className="text-[11px] font-medium text-slate-500">records</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 block flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp Messages
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  {smsLogs.filter((l) => l.channel === 'WHATSAPP' || l.senderId === 'WHATSAPP_WEB').length}
                </span>
                <span className="text-[11px] font-medium text-slate-500">sent</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 block flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5" />
                Movider SMS Gateway
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-blue-700 font-mono">
                  {smsLogs.filter((l) => l.channel === 'SMS' || (!l.channel && l.senderId !== 'WHATSAPP_WEB')).length}
                </span>
                <span className="text-[11px] font-medium text-slate-500">dispatches</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 block flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Successful / Opened
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-purple-700 font-mono">
                  {smsLogs.filter((l) => l.status === 'DELIVERED' || l.status === 'WHATSAPP_LAUNCHED').length}
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  {smsLogs.length > 0
                    ? `(${Math.round((smsLogs.filter((l) => l.status === 'DELIVERED' || l.status === 'WHATSAPP_LAUNCHED').length / smsLogs.length) * 100)}%)`
                    : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* Main History Table Container */}
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Outbound Campaign Logs &amp; Audit Trail
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Filter by Channel */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                  <button
                    onClick={() => setChannelFilter('ALL')}
                    className={`px-3 py-1.5 rounded-md font-bold cursor-pointer transition-all ${
                      channelFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    All ({smsLogs.length})
                  </button>
                  <button
                    onClick={() => setChannelFilter('WHATSAPP')}
                    className={`px-3 py-1.5 rounded-md font-bold cursor-pointer transition-all ${
                      channelFilter === 'WHATSAPP' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    WhatsApp ({smsLogs.filter((l) => l.channel === 'WHATSAPP' || l.senderId === 'WHATSAPP_WEB').length})
                  </button>
                  <button
                    onClick={() => setChannelFilter('SMS')}
                    className={`px-3 py-1.5 rounded-md font-bold cursor-pointer transition-all ${
                      channelFilter === 'SMS' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    SMS ({smsLogs.filter((l) => l.channel === 'SMS' || (!l.channel && l.senderId !== 'WHATSAPP_WEB')).length})
                  </button>
                </div>

                <div className="relative w-48 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search name, phone, message..."
                    value={searchLogQuery}
                    onChange={(e) => setSearchLogQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium focus:outline-none focus:border-emerald-600"
                  />
                  {searchLogQuery && (
                    <button
                      onClick={() => setSearchLogQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={fetchSmsLogsAndSettings}
                  disabled={isLoadingLogs}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Refresh Audit Logs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin text-emerald-600' : ''}`} />
                  <span>Refresh Logs</span>
                </button>
              </div>
            </div>

            {/* Logs Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3">Date &amp; Time</th>
                    <th className="py-2.5 px-3">Recipient Customer</th>
                    <th className="py-2.5 px-3">Phone Number</th>
                    <th className="py-2.5 px-3">Message Preview</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paginatedLogs.map((log) => {
                    const isWa = log.channel === 'WHATSAPP' || log.senderId === 'WHATSAPP_WEB';
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase flex items-center gap-1 w-max ${
                              isWa
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-blue-100 text-blue-800 border border-blue-300'
                            }`}
                          >
                            {isWa ? <MessageCircle className="w-3 h-3 text-emerald-600" /> : <Smartphone className="w-3 h-3 text-blue-600" />}
                            <span>{isWa ? 'WhatsApp' : 'SMS'}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap relative group/time">
                          <span className="cursor-default">
                            {new Date(log.sentTime).toLocaleString('en-GB')}
                          </span>
                          <div className="absolute left-0 bottom-full mb-1 z-50 hidden group-hover/time:block p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg border border-slate-800 pointer-events-none whitespace-nowrap">
                            <span className="font-bold text-slate-400">Timestamp: </span>
                            <span className="font-mono font-bold text-emerald-300">{log.sentTime}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedProfileCustomer({
                                name: log.recipientName,
                                phone: log.recipientPhone,
                                username: log.recipientName,
                              })
                            }
                            className="text-left group/cust cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-2"
                            title="Click to view Customer Profile & Order History"
                          >
                            <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover/cust:bg-blue-100 transition-colors">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-bold text-xs text-slate-900 group-hover/cust:text-blue-700 group-hover/cust:underline">
                              {log.recipientName}
                            </span>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {(log.recipientPhone || '').replace(/^\+/, '').replace(/\s+/g, '')}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs relative group/msg">
                          <div className="truncate cursor-pointer hover:text-slate-900 font-medium">
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
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center gap-0.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                log.status === 'DELIVERED' || log.status === 'WHATSAPP_LAUNCHED'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : log.status === 'FAILED'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : 'bg-blue-100 text-blue-800 border border-blue-300'
                              }`}
                            >
                              {log.status === 'WHATSAPP_LAUNCHED'
                                ? 'DELIVERED'
                                : log.status === 'SENT_SIMULATED'
                                ? 'SENT'
                                : log.status}
                            </span>
                            {log.errorMessage && (
                              <span className="text-[9px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 max-w-[140px] truncate text-center leading-tight" title={log.errorMessage}>
                                {log.errorMessage}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-slate-400 space-y-2">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                          <Clock className="w-5 h-5" />
                        </div>
                        <p className="font-semibold text-slate-600">No outbound campaign messages match the selected filter.</p>
                        <p className="text-[11px] text-slate-400">
                          Dispatched SMS or WhatsApp marketing campaigns will appear here for auditing.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Rows per page & Pagination Controls */}
            {filteredLogs.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <PaginationControls
                  currentPage={logsPage}
                  totalPages={totalLogsPages}
                  pageSize={logsPageSize}
                  onPageChange={setLogsPage}
                  onPageSizeChange={(size) => {
                    setLogsPageSize(size);
                    setLogsPage(1);
                  }}
                  totalRecords={totalLogsRecords}
                  startIndex={logsStartIndex}
                  endIndex={logsEndIndex}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: WhatsApp Outreach Confirmation & Message Note Editor */}
      {pendingWaConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header - Clean consistent app style */}
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 aspect-square shrink-0 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-bold">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                      Confirm WhatsApp Outreach
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider font-mono">
                      Outreach Verification
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Did you send the message to this buyer in WhatsApp?
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancelWaConfirmation}
                className="p-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm text-slate-700">
              {/* Recipient Customer Details Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-600" />
                    Recipient Customer
                  </span>
                  <span className="font-mono text-emerald-700 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    +{pendingWaConfirmation.waPhone}
                  </span>
                </div>

                <div className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                  {pendingWaConfirmation.recipient.name}
                  {pendingWaConfirmation.recipient.username && pendingWaConfirmation.recipient.username !== pendingWaConfirmation.recipient.name && (
                    <span className="text-xs font-mono text-slate-400 font-normal ml-2">
                      (@{pendingWaConfirmation.recipient.username})
                    </span>
                  )}
                </div>

                {pendingWaConfirmation.recipient.product && (
                  <div className="text-xs text-slate-600 flex items-center gap-1.5 pt-1 border-t border-slate-200/70">
                    <ShoppingBag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium truncate">{pendingWaConfirmation.recipient.product}</span>
                  </div>
                )}
              </div>

              {/* Message Content / Custom Note Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>Actual Message Sent / Custom Note</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">Edit if modified in WhatsApp</span>
                </div>
                <textarea
                  rows={4}
                  value={pendingWaConfirmation.customMessage}
                  onChange={(e) =>
                    setPendingWaConfirmation((prev) => (prev ? { ...prev, customMessage: e.target.value } : null))
                  }
                  placeholder="Enter the actual message sent or leave default..."
                  className="w-full p-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 bg-white shadow-2xs leading-relaxed"
                />
              </div>

              {/* Guidance Notice */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Clicking <strong>&ldquo;Yes, Message Sent&rdquo;</strong> will record this outreach in your team history and update the customer&apos;s sent counter. If you closed WhatsApp without sending, click <strong>&ldquo;Not Sent / Cancel&rdquo;</strong>.
                </span>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelWaConfirmation}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Not Sent / Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWaSent}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Yes, Message Sent</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Profile Modal for WhatsApp Queue / Marketing audience */}
      {selectedProfileCustomer && (
        <CustomerProfileModal
          customer={selectedProfileCustomer}
          orders={orders}
          userRole={userRole}
          onClose={() => setSelectedProfileCustomer(null)}
        />
      )}
    </div>
  );
};
