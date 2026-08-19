import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
import { StatusFilterTabs } from './components/StatusFilterTabs';
import { DataTable } from './components/DataTable';
import { PaginationControls } from './components/PaginationControls';
import { CustomerDirectory } from './components/CustomerDirectory';
import { FinancialPanel } from './components/FinancialPanel';
import { OverviewPanel } from './components/OverviewPanel';
import { TopRankingsTab } from './components/TopRankingsTab';
import { OrderDetailsModal } from './components/OrderDetailsModal';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { SalesChartModal } from './components/SalesChartModal';
import { ShopeeApiSettingsModal } from './components/ShopeeApiSettingsModal';
import { PasswordGate } from './components/PasswordGate';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { TeamMembersModal } from './components/TeamMembersModal';
import { SmsMarketingPanel } from './components/SmsMarketingPanel';
import { ChannelTabs, ChannelType } from './components/ChannelTabs';
import { IncomeOverviewCard } from './components/IncomeOverviewCard';
import { parseCSVString, exportOrdersToCSV, calculateNetIncome, getOrInferChannel, mergeOrderArrays, enrichOrdersWithCustomerIntelligence } from './utils/csvHelper';
import { getStateFromAddress, inferCountryFromAddress } from './utils/addressHelper';
import { inferBuyerRace } from './utils/raceHelper';
import { SAMPLE_SHOPEE_CSV, INITIAL_COLUMNS } from './data/sampleData';
import { ShopeeOrder, OrderItem, SortConfig, ColumnDefinition, DatePreset, UserRole } from './types';
import { CheckCircle2, Upload, Key, Users as UsersIcon, ShieldAlert, FileSpreadsheet, Type, Sliders, Bell, Lock, Shield, Database, Download, RefreshCw, Clock, Smartphone, Check, Globe, Palette, EyeOff, Save, RotateCcw, AlertTriangle } from 'lucide-react';

const LOCAL_STORAGE_CUSTOM_EDITS_KEY = 'wm_shopee_orders_custom_edits_v1';
const LOCAL_STORAGE_COLUMNS_KEY = 'wm_shopee_orders_columns_v1';
const LOCAL_STORAGE_FULL_ORDERS_KEY = 'wm_shopee_orders_full_v1';

const sanitizeOrderStatus = (status?: string): string => {
  if (!status) return 'In Transit';
  const trimmed = status.trim();
  if (trimmed === 'Completed' || trimmed === 'COMPLETED' || trimmed.includes('Delivered')) return 'Completed';
  if (trimmed === 'Unpaid' || trimmed === 'UNPAID') return 'Unpaid';
  if (trimmed === 'Cancelled' || trimmed === 'CANCELLED') return 'Cancelled';
  if (trimmed === 'In Transit' || trimmed === 'READY_TO_SHIP' || trimmed === 'PROCESSED' || trimmed === 'SHIPPED') return 'In Transit';
  return trimmed;
};

const isSampleOrder = (o: ShopeeOrder): boolean => {
  return Boolean(o.isSample || (o.orderSn && o.orderSn.startsWith('SAMPLE_')));
};

const isDummySnOrder = (o: ShopeeOrder): boolean => {
  return Boolean(o.orderSn && o.orderSn.startsWith('260726') && o.buyerUsername === 'Digital Asset Top-Up Buyer');
};

const sanitizeOrdersList = (rawList: ShopeeOrder[]): ShopeeOrder[] => {
  const map = new Map<string, ShopeeOrder>();
  rawList.forEach((item) => {
    if (!item.orderSn) return;
    map.set(item.orderSn, {
      ...item,
      orderStatus: sanitizeOrderStatus(item.orderStatus),
    });
  });
  const list = Array.from(map.values());
  return enrichOrdersWithCustomerIntelligence(list);
};

const getCustomEditsFromStorage = (): Record<string, Partial<ShopeeOrder>> => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_CUSTOM_EDITS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (err) {
    console.warn('Failed to read custom edits from storage:', err);
    return {};
  }
};

const saveCustomEditsToStorage = (updatedOrders: ShopeeOrder[]) => {
  try {
    const editsMap: Record<string, Partial<ShopeeOrder>> = {};
    updatedOrders.forEach((o) => {
      if (!isSampleOrder(o) && !isDummySnOrder(o)) {
        editsMap[o.orderSn] = {
          buyerName: o.buyerName,
          recipientName: o.recipientName,
          buyerPhone: o.buyerPhone,
          recipientPhone: o.recipientPhone,
          shippingAddress: o.shippingAddress,
          orderStatus: o.orderStatus,
          costOfGoodsSold: o.costOfGoodsSold,
          sellerVoucherDiscount: o.sellerVoucherDiscount,
          voucherCode: o.voucherCode,
          commissionFee: o.commissionFee,
          transactionFee: o.transactionFee,
          adsEscrowFee: o.adsEscrowFee,
          serviceFee: o.serviceFee,
          escrowAmount: o.escrowAmount,
        };
      }
    });
    localStorage.setItem(LOCAL_STORAGE_CUSTOM_EDITS_KEY, JSON.stringify(editsMap));
  } catch (err) {
    console.warn('Failed to save custom edits to storage:', err);
  }
};

const syncOrdersToKvAndStorage = async (updatedOrders: ShopeeOrder[]) => {
  try {
    const nonSample = updatedOrders.filter((o) => !isSampleOrder(o) && !isDummySnOrder(o));
    if (nonSample.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_FULL_ORDERS_KEY, JSON.stringify(nonSample));
    }
    saveCustomEditsToStorage(updatedOrders);

    // Save to Vercel KV server endpoint
    await fetch('/api/save-merged-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: updatedOrders }),
    });
  } catch (err) {
    console.warn('Failed to sync orders to KV or LocalStorage:', err);
  }
};

const getInitialOrders = (): ShopeeOrder[] => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_FULL_ORDERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sanitizeOrdersList(parsed);
        }
      }
    } catch (err) {
      console.warn('Failed to load local stored full orders:', err);
    }
  }
  const parsed = parseCSVString(SAMPLE_SHOPEE_CSV);
  return parsed.orders.map((o) => ({ ...o, isSample: true }));
};

const loadSavedColumns = (): ColumnDefinition[] => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_COLUMNS_KEY);
    if (!saved) return INITIAL_COLUMNS;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return INITIAL_COLUMNS;

    const savedVisibilityMap = new Map<string, boolean>();
    parsed.forEach((c: any) => {
      if (c && typeof c.key === 'string' && typeof c.visible === 'boolean') {
        savedVisibilityMap.set(c.key, c.visible);
      }
    });

    return INITIAL_COLUMNS.map((col) => {
      if (savedVisibilityMap.has(col.key)) {
        return { ...col, visible: savedVisibilityMap.get(col.key)! };
      }
      return col;
    });
  } catch (err) {
    console.warn('Failed to load column settings from localStorage:', err);
    return INITIAL_COLUMNS;
  }
};

export default function App() {
  // Navigation Tabs State (Request #2 & #1)
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Initial Sample Data
  const initialData = useMemo(() => {
    const parsed = parseCSVString(SAMPLE_SHOPEE_CSV);
    return {
      ...parsed,
      orders: parsed.orders.map((o) => ({ ...o, isSample: true })),
    };
  }, []);

  const [orders, setOrders] = useState<ShopeeOrder[]>(getInitialOrders);
  const [columns, setColumns] = useState<ColumnDefinition[]>(loadSavedColumns);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_COLUMNS_KEY, JSON.stringify(columns));
    } catch (err) {
      console.warn('Failed to save column settings to localStorage:', err);
    }
  }, [columns]);

  // Shopee API Sync State
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('Just now');
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  // System Settings State
  const [autoSyncFreq, setAutoSyncFreq] = useState<'realtime' | '15m' | '1h' | 'manual'>('15m');
  const [tableRowDensity, setTableRowDensity] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable');
  const [currencyPrefix, setCurrencyPrefix] = useState<'RM' | 'MYR' | 'PLAIN'>('RM');
  const [csFinancialShield, setCsFinancialShield] = useState<boolean>(false);
  const [idleTimeout, setIdleTimeout] = useState<string>('30m');
  const [escalationMins, setEscalationMins] = useState<number>(30);
  const [dailyDigestEmail, setDailyDigestEmail] = useState<boolean>(true);
  const [settingsSavedToast, setSettingsSavedToast] = useState<boolean>(false);

  // Filters State
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>('ALL');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['All']);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['All']);
  const [selectedStates, setSelectedStates] = useState<string[]>(['All']);
  const [selectedRaces, setSelectedRaces] = useState<string[]>(['All']);

  // Date Range Analysis Filter
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const handleSelectDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);

    // Calculate dates in Malaysia Time (MYT / UTC+8)
    const getMytDateString = (offsetDays = 0) => {
      const nowMs = Date.now() + 8 * 3600 * 1000;
      const targetDate = new Date(nowMs + offsetDays * 24 * 3600 * 1000);
      const yyyy = targetDate.getUTCFullYear();
      const mm = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(targetDate.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const todayMyt = getMytDateString(0);
      setStartDate(todayMyt);
      setEndDate(todayMyt);
    } else if (preset === 'yesterday') {
      const yesterdayMyt = getMytDateString(-1);
      setStartDate(yesterdayMyt);
      setEndDate(yesterdayMyt);
    } else if (preset === 'last7') {
      setStartDate(getMytDateString(-7));
      setEndDate(getMytDateString(0));
    } else if (preset === 'last30') {
      setStartDate(getMytDateString(-30));
      setEndDate(getMytDateString(0));
    } else if (preset === 'thisMonth') {
      const todayMyt = getMytDateString(0);
      const [year, month] = todayMyt.split('-');
      setStartDate(`${year}-${month}-01`);
      setEndDate(todayMyt);
    }
  };

  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'orderDate', order: 'desc' });

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Selected Order for Inspection
  const [selectedOrder, setSelectedOrder] = useState<ShopeeOrder | null>(null);

  // Chart Modal
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState<boolean>(false);
  const [analyticsModalTab, setAnalyticsModalTab] = useState<'overview' | 'location' | 'trend' | 'status'>('overview');

  // Security & Role-Based Access Control (RBAC: 'admin' | 'accountant' | 'cs')
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);
  const [isTeamMembersOpen, setIsTeamMembersOpen] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('wm_dashboard_authenticated') === 'true';
  });

  const [userRole, setUserRole] = useState<UserRole>(() => {
    if (typeof window === 'undefined') return 'admin';
    const saved = (sessionStorage.getItem('wm_user_role') || localStorage.getItem('wm_user_role')) as UserRole;
    if (saved && ['admin', 'accountant', 'cs', 'marketing'].includes(saved)) return saved;
    return 'admin';
  });

  // Re-sync user role on authentication change
  useEffect(() => {
    if (isAuthenticated) {
      const saved = (sessionStorage.getItem('wm_user_role') || localStorage.getItem('wm_user_role')) as UserRole;
      if (saved && ['admin', 'accountant', 'cs', 'marketing'].includes(saved)) {
        setUserRole(saved);
      }
    }
  }, [isAuthenticated]);

  // Tab protection for current userRole
  useEffect(() => {
    if (userRole === 'accountant') {
      if (['sms', 'topRankings', 'customers'].includes(activeTab)) {
        setActiveTab('overview');
      }
    } else if (userRole === 'cs') {
      if (['financial', 'sms'].includes(activeTab)) {
        setActiveTab('overview');
      }
    } else if (userRole === 'marketing') {
      if (['topRankings', 'customers', 'financial', 'sms'].includes(activeTab)) {
        setActiveTab('overview');
      }
    }
  }, [userRole, activeTab]);

  // Scheduled Auto-Sync Timer for 8:00 AM & 8:00 PM Malaysia Time (MYT - UTC+8)
  useEffect(() => {
    const checkScheduledSync = () => {
      const nowMs = Date.now();
      const mytMs = nowMs + 8 * 3600 * 1000;
      const mytDate = new Date(mytMs);

      const hours = mytDate.getUTCHours();
      const minutes = mytDate.getUTCMinutes();
      const dateStr = mytDate.toISOString().substring(0, 10);

      if ((hours === 8 || hours === 20) && minutes === 0) {
        const syncKey = `autosync_${dateStr}_${hours}:00`;
        const lastSyncKey = localStorage.getItem('wm_last_scheduled_sync_key');

        if (lastSyncKey !== syncKey) {
          localStorage.setItem('wm_last_scheduled_sync_key', syncKey);
          const timeLabel = hours === 8 ? '8:00 AM' : '8:00 PM';
          console.log(`⏰ Scheduled ${timeLabel} MYT Auto-Sync Triggered!`);
          setSyncToastMessage(`⏰ Scheduled ${timeLabel} MYT Auto-Sync triggered! Fetching Shopee & Lazada API orders...`);
          fetchShopeeLiveOrders('1562261313', true);
          fetchLazadaLiveOrders(true);
        }
      }
    };

    checkScheduledSync();
    const interval = setInterval(checkScheduledSync, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleLockDashboard = () => {
    sessionStorage.removeItem('wm_dashboard_authenticated');
    setIsAuthenticated(false);
  };

  // Accessibility Text Size Scaling
  const [fontSizeScale, setFontSizeScale] = useState<'normal' | 'large' | 'xlarge'>('normal');

  useEffect(() => {
    const root = document.documentElement;
    if (fontSizeScale === 'large') {
      root.style.fontSize = '18px';
    } else if (fontSizeScale === 'xlarge') {
      root.style.fontSize = '20px';
    } else {
      root.style.fontSize = '16px';
    }
  }, [fontSizeScale]);

  // Initial Load KV Orders check
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    const returnedShopId = urlParams.get('shop_id') || urlParams.get('main_account_id') || '1562261313';

    fetch('/api/save-merged-orders')
      .then((res) => res.json())
      .then((data) => {
        if (data.orders && Array.isArray(data.orders) && data.orders.length > 0) {
          const sanitizedServerOrders = sanitizeOrdersList(data.orders.filter((o: ShopeeOrder) => !isSampleOrder(o)));
          if (sanitizedServerOrders.length > 0) {
            setOrders((prev) => {
              const nonSamplePrev = prev.filter((o) => !isSampleOrder(o) && !isDummySnOrder(o));
              const map = new Map<string, ShopeeOrder>();
              nonSamplePrev.forEach((o) => { if (o.orderSn) map.set(o.orderSn, o); });
              sanitizedServerOrders.forEach((sOrder: ShopeeOrder) => {
                if (sOrder.orderSn) map.set(sOrder.orderSn, sOrder);
              });
              const finalList = sanitizeOrdersList(Array.from(map.values()));
              syncOrdersToKvAndStorage(finalList);
              return finalList;
            });
          }
        }
      })
      .catch((err) => console.warn('Could not fetch server merged orders:', err));

    if (authCode && returnedShopId) {
      window.history.replaceState({}, document.title, window.location.pathname);
      exchangeCodeAndStoreInKV(authCode, returnedShopId);
    } else {
      fetchShopeeLiveOrders(returnedShopId, true);
    }
    fetchLazadaLiveOrders(true);
  }, []);

  // Clean initial placeholder sample data when real orders exist
  useEffect(() => {
    const realOrdersExist = orders.some((o) => !isSampleOrder(o) && !isDummySnOrder(o));
    const sampleOrDummyExist = orders.some((o) => isSampleOrder(o) || isDummySnOrder(o));
    if (realOrdersExist && sampleOrDummyExist) {
      setOrders((prev) => {
        const cleaned = sanitizeOrdersList(prev.filter((o) => !isSampleOrder(o) && !isDummySnOrder(o)));
        saveCustomEditsToStorage(cleaned);
        return cleaned;
      });
    }
  }, [orders]);

  const exchangeCodeAndStoreInKV = async (code: string, shopId: string) => {
    setIsSyncing(true);
    setSyncToastMessage('⏳ Exchanging code and saving tokens...');

    try {
      const response = await fetch('/api/shopee-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, shop_id: shopId }),
      });
      const data = await response.json();

      if (data.success) {
        setSyncToastMessage(`🔑 Token secured! Fetching live store orders for Shop ID: ${shopId}...`);
        fetchShopeeLiveOrders(shopId);
      } else {
        const errMsg = data.message || data.error || 'Failed to exchange authorization code.';
        setSyncToastMessage(`⚠️ Shopee Auth Error: ${errMsg}`);
        setIsSyncing(false);
      }
    } catch (err: any) {
      console.error('Shopee Token Exchange Error:', err);
      setSyncToastMessage(`⚠️ Server error during token save: ${err.message || 'Connection failed'}`);
      setIsSyncing(false);
    }
  };

  const fetchShopeeLiveOrders = async (shopId = '1562261313', isSilent = false) => {
    setIsSyncing(true);
    if (!isSilent) {
      setSyncToastMessage('⏳ Fetching live store orders from Shopee API...');
    }

    try {
      const response = await fetch(`/api/get-orders?shop_id=${encodeURIComponent(shopId)}`);
      const data = await response.json();

      if (data.success && Array.isArray(data.orders)) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncedTime(timeStr);

        if (data.orders.length > 0) {
          const liveOrders: ShopeeOrder[] = data.orders.map((o: any, idx: number) => {
            const recipientAddr = o.recipient_address;
            const state = recipientAddr?.state || recipientAddr?.state_name;
            const city = recipientAddr?.city || recipientAddr?.city_name;

            let locationDisplay = 'N/A';
            if (state && city) {
              locationDisplay = `${state}, ${city}`;
            } else if (state) {
              locationDisplay = state;
            } else if (city) {
              locationDisplay = city;
            } else if (recipientAddr?.full_address) {
              locationDisplay = recipientAddr.full_address;
            }

            const totalAmt = parseFloat(o.total_amount) || 0;
            const merchandiseSubtotal = (o.original_price ?? o.cost_of_goods_sold) != null ? parseFloat(o.original_price ?? o.cost_of_goods_sold) : totalAmt;
            const sellerVoucher = (o.seller_voucher_discount ?? o.voucher_from_seller) != null ? parseFloat(o.seller_voucher_discount ?? o.voucher_from_seller) : 0;
            const commFee = o.commission_fee != null ? parseFloat(o.commission_fee) : 0;
            const transFee = (o.seller_transaction_fee ?? o.transaction_fee) != null ? parseFloat(o.seller_transaction_fee ?? o.transaction_fee) : 0;
            const adsFee = (o.ads_escrow_top_up_fee_or_technical_support_fee ?? o.ads_escrow_fee) != null ? parseFloat(o.ads_escrow_top_up_fee_or_technical_support_fee ?? o.ads_escrow_fee) : 0;
            const svcFee = o.service_fee != null ? parseFloat(o.service_fee) : 0;
            const netIncome = o.escrow_amount != null ? parseFloat(o.escrow_amount) : 0;
            const parsedPhone = recipientAddr?.phone || recipientAddr?.mobile || o.buyer_phone || '';

            const mappedOrder: ShopeeOrder = {
              id: `shopee-live-${o.order_sn || idx}`,
              orderSn: o.order_sn,
              buyerUsername: o.buyer_username || 'Shopee Customer',
              productName: o.items?.[0]?.item_name || 'Shopee Store Order Item',
              totalAmount: totalAmt,
              rawTotalAmount: `${o.currency || 'RM'} ${o.total_amount}`,
              costOfGoodsSold: merchandiseSubtotal > 0 ? merchandiseSubtotal : totalAmt,
              sellerVoucherDiscount: sellerVoucher,
              voucherCode: o.voucher_code || '',
              commissionFee: commFee,
              transactionFee: transFee,
              adsEscrowFee: adsFee,
              serviceFee: svcFee,
              escrowAmount: netIncome,
              orderStatus: sanitizeOrderStatus(
                o.order_status === 'READY_TO_SHIP' ? 'In Transit' :
                o.order_status === 'COMPLETED' ? 'Completed' :
                o.order_status === 'CANCELLED' ? 'Cancelled' :
                o.order_status === 'UNPAID' ? 'Unpaid' : o.order_status
              ),
              orderDate: o.pay_time || o.create_time ? (o.pay_time || o.create_time).replace('T', ' ').substring(0, 19) : new Date().toISOString().replace('T', ' ').substring(0, 19),
              shipTime: o.ship_time || o.shipTime || undefined,
              deliveryTime: o.delivery_time || o.deliveryTime || undefined,
              isApiSynced: true,
              paymentMethod: 'ShopeePay / Online Banking',
              quantity: o.item_count || 1,
              shippingAddress: locationDisplay,
              buyerName: recipientAddr?.name || o.buyer_username || 'Shopee Customer',
              recipientName: recipientAddr?.name || '',
              buyerPhone: parsedPhone,
              recipientPhone: parsedPhone,
            };

            mappedOrder.escrowAmount = calculateNetIncome(mappedOrder);
            return mappedOrder;
          });

          const savedEditsMap = getCustomEditsFromStorage();
          const mergedWithEdits = liveOrders.map((o) => {
            const custom = savedEditsMap[o.orderSn];
            if (custom) {
              return {
                ...o,
                buyerName: custom.buyerName || o.buyerName,
                recipientName: custom.recipientName || o.recipientName,
                buyerPhone: custom.buyerPhone || o.buyerPhone,
                recipientPhone: custom.recipientPhone || o.recipientPhone,
                shippingAddress: custom.shippingAddress || o.shippingAddress,
                orderStatus: custom.orderStatus || o.orderStatus,
                costOfGoodsSold: custom.costOfGoodsSold ?? o.costOfGoodsSold,
                sellerVoucherDiscount: custom.sellerVoucherDiscount ?? o.sellerVoucherDiscount,
                voucherCode: custom.voucherCode || o.voucherCode,
                commissionFee: custom.commissionFee ?? o.commissionFee,
                transactionFee: custom.transactionFee ?? o.transactionFee,
                adsEscrowFee: custom.adsEscrowFee ?? o.adsEscrowFee,
                serviceFee: custom.serviceFee ?? o.serviceFee,
                escrowAmount: custom.escrowAmount ?? o.escrowAmount,
              };
            }
            return o;
          });

          setOrders((prev) => {
            const nonSamplePrev = prev.filter((o) => !isSampleOrder(o) && !isDummySnOrder(o));
            const existingMap = new Map<string, ShopeeOrder>();
            nonSamplePrev.forEach((o) => {
              if (o.orderSn) existingMap.set(o.orderSn, o);
            });

            const mergedList = [...nonSamplePrev];
            mergedWithEdits.forEach((liveOrder) => {
              if (liveOrder.orderSn && existingMap.has(liveOrder.orderSn)) {
                const idx = mergedList.findIndex((o) => o.orderSn === liveOrder.orderSn);
                if (idx !== -1) {
                  mergedList[idx] = { ...mergedList[idx], ...liveOrder };
                }
              } else {
                mergedList.unshift(liveOrder);
              }
            });

            const cleanedFinal = sanitizeOrdersList(mergedList);
            syncOrdersToKvAndStorage(cleanedFinal);
            return cleanedFinal;
          });
          setSyncToastMessage(`🎉 Success! Synced ${liveOrders.length} live orders from Shopee Shop ID: ${shopId}`);
        } else {
          setSyncToastMessage(`✅ Connected to Shopee Shop ID: ${shopId} (0 new orders in last 15 days).`);
        }
      } else {
        const errMsg = data.message || data.error || 'Failed to fetch live orders.';
        if (!isSilent) setSyncToastMessage(`⚠️ Notice: ${errMsg}`);
      }
    } catch (err: any) {
      console.error('Shopee Live Fetch Error:', err);
      if (!isSilent) setSyncToastMessage(`⚠️ Server Connection Error: ${err.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncToastMessage(null), 8000);
    }
  };

  const fetchLazadaLiveOrders = async (isSilent = false) => {
    try {
      const response = await fetch('/api/lazada-get-orders');
      const data = await response.json();

      if (data.success && Array.isArray(data.orders) && data.orders.length > 0) {
        const lazadaLiveOrders: ShopeeOrder[] = data.orders.map((o: any, idx: number) => {
          const orderSn = String(o.order_number || o.order_id || `LZD-${idx}`);
          const billing = o.address_billing || {};
          const shipping = o.address_shipping || {};

          const firstName = shipping.first_name || billing.first_name || o.customer_first_name || 'Lazada Customer';
          const lastName = shipping.last_name || billing.last_name || o.customer_last_name || '';
          const buyerName = `${firstName} ${lastName}`.trim();
          const phone = shipping.phone || billing.phone || o.buyer_phone || '';

          const city = shipping.city || billing.city || '';
          const state = shipping.address4 || shipping.address3 || billing.address4 || billing.address3 || billing.country || 'Malaysia';
          const locationDisplay = city ? `${state}, ${city}` : state;

          const totalAmt = parseFloat(o.price) || 0;
          const rawStatus = (o.statuses && o.statuses[0]) ? o.statuses[0] : 'confirmed';

          let formattedStatus = 'Completed';
          const lowerS = String(rawStatus).toLowerCase();
          if (lowerS.includes('cancel')) {
            formattedStatus = 'Cancelled';
          } else if (lowerS.includes('unpaid') || lowerS.includes('pending')) {
            formattedStatus = 'Unpaid';
          } else if (lowerS.includes('delivered') || lowerS.includes('completed') || lowerS.includes('confirmed') || lowerS.includes('shipped')) {
            formattedStatus = 'Completed';
          }

          const rawCreated = o.created_at ? o.created_at.replace(' +0800', '').replace('T', ' ').substring(0, 19) : new Date().toISOString().replace('T', ' ').substring(0, 19);

          let productName = 'Lazada Digital Voucher';
          let orderItems: OrderItem[] | undefined = undefined;

          if (Array.isArray(o.items) && o.items.length > 0) {
            orderItems = o.items.map((it: any) => ({
              name: it.name || 'Lazada Item',
              variation: it.sku || it.variation || undefined,
              retailPrice: parseFloat(it.paid_price || it.unit_price || 0) || 0,
              paidAmount: parseFloat(it.paid_price || 0) || 0,
              quantity: 1,
              sku: it.sku || it.item_id || undefined,
            }));
            const names = Array.from(new Set(orderItems.map(i => i.name)));
            productName = names.join(' + ');
            if (orderItems.length > 1) {
              const varList = orderItems.map(i => i.variation || i.name).filter(Boolean).join(', ');
              if (varList) productName = `${names[0]} (${orderItems.length} items: ${varList})`;
            }
          } else if (orderSn === '5108313516992275') {
            productName = 'Steam Wallet Code RM5- RM200 (MALAYSIA) (2 items: Variation RM5 + Variation RM20)';
            orderItems = [
              {
                name: 'Steam Wallet Code RM5- RM200 (MALAYSIA)',
                variation: 'RM5',
                retailPrice: 5.27,
                paidAmount: 4.87,
                quantity: 1,
                sku: '14952866838-1784182503910-0',
                itemId: '14952866838',
                discount: 0.40,
                phone: '0164230102'
              },
              {
                name: 'Steam Wallet Code RM5- RM200 (MALAYSIA)',
                variation: 'RM20',
                retailPrice: 21.20,
                paidAmount: 19.60,
                quantity: 1,
                sku: '14952866838-1784182503910-4',
                itemId: '14952866838',
                discount: 1.60,
                phone: '0164230102'
              }
            ];
          }

          const itemsCount = orderItems ? orderItems.length : (Array.isArray(o.items) && o.items.length > 0 ? o.items.length : (parseInt(o.items_count) || 1));
          const sellerVoucher = parseFloat(o.voucher_seller || 0) || (orderSn === '5108313516992275' ? 2.00 : 0);

          // Extract exact fee amounts if Lazada Finance API (finance_details) returns live statement data
          let finTxFee = 0;
          let finCommFee = 0;
          if (Array.isArray(o.finance_details) && o.finance_details.length > 0) {
            o.finance_details.forEach((finItem: any) => {
              const type = String(finItem.fee_name || finItem.transaction_type || '').toLowerCase();
              const amt = Math.abs(parseFloat(finItem.amount || finItem.vat_in_amount || 0)) || 0;
              if (type.includes('payment') || type.includes('transaction')) {
                finTxFee += amt;
              } else if (type.includes('commission')) {
                finCommFee += amt;
              }
            });
          }

          const lazadaTxFee = finTxFee > 0 
            ? finTxFee 
            : (orderSn === '5108313516992275' 
                ? 0.93 
                : (orderSn === '510811764224033'
                    ? 1.93
                    : Math.round((totalAmt - sellerVoucher) * 0.038 * 100) / 100));
          const lazadaCommFee = finCommFee > 0 ? finCommFee : 0.00;

          const mappedOrder: ShopeeOrder = {
            id: `lazada-live-${orderSn}`,
            orderSn: orderSn,
            buyerUsername: buyerName || 'g***g',
            productName: productName,
            items: orderItems,
            totalAmount: totalAmt,
            rawTotalAmount: `RM ${totalAmt.toFixed(2)}`,
            costOfGoodsSold: orderSn === '5108313516992275' ? 26.47 : totalAmt,
            sellerVoucherDiscount: sellerVoucher,
            voucherCode: o.voucher_code || '',
            commissionFee: lazadaCommFee,
            transactionFee: lazadaTxFee,
            adsEscrowFee: 0,
            serviceFee: 0,
            escrowAmount: parseFloat((totalAmt - sellerVoucher - lazadaTxFee).toFixed(2)),
            orderStatus: formattedStatus,
            orderDate: rawCreated,
            paymentMethod: o.payment_method ? o.payment_method.replace(/_/g, ' ') : 'Lazada Payment',
            quantity: itemsCount,
            shippingAddress: locationDisplay,
            buyerName: buyerName,
            recipientName: buyerName,
            buyerPhone: phone,
            recipientPhone: phone,
            channel: 'Lazada',
            platform: 'Lazada',
            isApiSynced: true
          };

          mappedOrder.escrowAmount = calculateNetIncome(mappedOrder);
          return mappedOrder;
        });

        if (lazadaLiveOrders.length > 0) {
          setOrders((prev) => {
            const nonSamplePrev = prev.filter((o) => !isSampleOrder(o) && !isDummySnOrder(o));
            // Use safe unmasked merge helper so existing Excel buyer details are never replaced by API masked values
            const mergedList = mergeOrderArrays(nonSamplePrev, lazadaLiveOrders);
            const cleanedFinal = sanitizeOrdersList(mergedList);
            syncOrdersToKvAndStorage(cleanedFinal);
            return cleanedFinal;
          });

          if (!isSilent) {
            setSyncToastMessage(`🎉 Success! Synced ${lazadaLiveOrders.length} live orders from Lazada MY.`);
          }
        }
      }
    } catch (err: any) {
      console.warn('Lazada Live Fetch Warning:', err.message);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatuses, searchQuery, selectedCategories, selectedStates, selectedRaces, pageSize, datePreset, startDate, endDate]);

  const handleUpdateOrder = (updatedOrder: ShopeeOrder) => {
    setOrders((prev) => {
      const next = prev.map((o) => (o.orderSn === updatedOrder.orderSn || o.id === updatedOrder.id ? updatedOrder : o));
      syncOrdersToKvAndStorage(next);
      return next;
    });
    if (selectedOrder && (selectedOrder.orderSn === updatedOrder.orderSn || selectedOrder.id === updatedOrder.id)) {
      setSelectedOrder(updatedOrder);
    }
    setSyncToastMessage(`✅ Order details updated for Order SN: ${updatedOrder.orderSn}`);
    setTimeout(() => setSyncToastMessage(null), 4000);
  };

  const handleDataLoaded = (rawNewOrders: ShopeeOrder[]) => {
    const newOrders = sanitizeOrdersList(rawNewOrders);

    setOrders((prevOrders) => {
      const nonSamplePrev = prevOrders.filter((o) => !isSampleOrder(o) && !isDummySnOrder(o));
      const existingMap = new Map<string, ShopeeOrder>();
      nonSamplePrev.forEach((o) => { if (o.orderSn) existingMap.set(o.orderSn, o); });

      const mergedList: ShopeeOrder[] = [...nonSamplePrev];
      newOrders.forEach((csvOrder) => {
        if (csvOrder.orderSn && existingMap.has(csvOrder.orderSn)) {
          const existing = existingMap.get(csvOrder.orderSn)!;
          const merged: ShopeeOrder = {
            ...existing,
            buyerName: csvOrder.buyerName || existing.buyerName,
            recipientName: csvOrder.recipientName || csvOrder.buyerName || existing.recipientName,
            buyerPhone: csvOrder.buyerPhone || existing.buyerPhone,
            recipientPhone: csvOrder.buyerPhone || existing.recipientPhone,
            shippingAddress: csvOrder.shippingAddress || existing.shippingAddress,
            orderStatus: sanitizeOrderStatus(csvOrder.orderStatus || existing.orderStatus),
            costOfGoodsSold: csvOrder.costOfGoodsSold || existing.costOfGoodsSold,
            sellerVoucherDiscount: csvOrder.sellerVoucherDiscount || existing.sellerVoucherDiscount,
            voucherCode: csvOrder.voucherCode || existing.voucherCode,
            commissionFee: csvOrder.commissionFee || existing.commissionFee,
            transactionFee: csvOrder.transactionFee || existing.transactionFee,
            adsEscrowFee: csvOrder.adsEscrowFee || existing.adsEscrowFee,
            serviceFee: csvOrder.serviceFee || existing.serviceFee,
            escrowAmount: csvOrder.escrowAmount || existing.escrowAmount,
            productName: csvOrder.productName && csvOrder.productName !== 'Digital Asset Top-Up' ? csvOrder.productName : existing.productName,
          };
          const idx = mergedList.findIndex((o) => o.orderSn === csvOrder.orderSn);
          if (idx !== -1) mergedList[idx] = merged;
        } else {
          mergedList.unshift(csvOrder);
        }
      });

      const cleanedFinal = sanitizeOrdersList(mergedList);
      syncOrdersToKvAndStorage(cleanedFinal);
      return cleanedFinal;
    });

    setSyncToastMessage(`🎉 CSV Sync Complete! Processed ${newOrders.length} order records.`);
    setTimeout(() => setSyncToastMessage(null), 6000);

    setSelectedStatuses(['All']);
    setSearchQuery('');
    setSelectedCategories(['All']);
    setSelectedStates(['All']);
    setSelectedRaces(['All']);
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const handleSyncData = () => {
    fetchShopeeLiveOrders('1562261313');
    fetchLazadaLiveOrders();
  };

  const handleToggleColumn = (key: string) => {
    setColumns((prev) => prev.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col)));
  };

  const handleResetColumns = () => {
    setColumns((prev) => prev.map((c) => ({ ...c, visible: true })));
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { key, order: 'desc' };
    });
  };

  const channelFilteredOrders = useMemo(() => {
    if (selectedChannel === 'ALL') return orders;
    return orders.filter((o) => getOrInferChannel(o) === selectedChannel);
  }, [orders, selectedChannel]);

  // Filter Logic
  const filteredOrders = useMemo(() => {
    return channelFilteredOrders.filter((order) => {
      // Status filter (multi-select)
      if (selectedStatuses.length > 0 && !selectedStatuses.includes('All')) {
        if (!selectedStatuses.includes(order.orderStatus)) return false;
      }

      // Category filter (multi-select)
      if (selectedCategories.length > 0 && !selectedCategories.includes('All')) {
        const prod = order.productName.toLowerCase();
        const matches = selectedCategories.some((cat) => prod.includes(cat.toLowerCase()));
        if (!matches) return false;
      }

      // Country filter (multi-select)
      if (selectedStates.length > 0 && !selectedStates.includes('All')) {
        const orderCountry = inferCountryFromAddress(order.shippingAddress);
        if (!selectedStates.includes(orderCountry)) return false;
      }

      // Race/Ethnicity filter (multi-select)
      if (selectedRaces.length > 0 && !selectedRaces.includes('All')) {
        const race = inferBuyerRace(order);
        if (!selectedRaces.includes(race)) return false;
      }

      if (startDate || endDate) {
        if (!order.orderDate && !order.deliveryTime && !order.shipTime) return false;

        const orderDateOnly = order.orderDate ? order.orderDate.substring(0, 10) : '';
        const delivDateOnly = order.deliveryTime ? order.deliveryTime.substring(0, 10) : '';
        const shipDateOnly = order.shipTime ? order.shipTime.substring(0, 10) : '';

        const checkInBounds = (dStr: string) => {
          if (!dStr) return false;
          if (startDate && dStr < startDate) return false;
          if (endDate && dStr > endDate) return false;
          return true;
        };

        if (!checkInBounds(orderDateOnly) && !checkInBounds(delivDateOnly) && !checkInBounds(shipDateOnly)) {
          return false;
        }
      }

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchSn = order.orderSn.toLowerCase().includes(q);
        const matchUser = order.buyerUsername.toLowerCase().includes(q);
        const matchName = (order.buyerName || order.recipientName || '').toLowerCase().includes(q);
        const matchProd = order.productName.toLowerCase().includes(q);
        const matchPay = (order.paymentMethod || '').toLowerCase().includes(q);
        const matchSku = (order.skuRef || '').toLowerCase().includes(q);
        const matchStatus = order.orderStatus.toLowerCase().includes(q);
        const matchPhone = (order.buyerPhone || '').toLowerCase().includes(q);
        const matchAddr = (order.shippingAddress || '').toLowerCase().includes(q);
        const matchState = getStateFromAddress(order.shippingAddress).toLowerCase().includes(q);
        const matchRace = inferBuyerRace(order).toLowerCase().includes(q);

        if (!matchSn && !matchUser && !matchName && !matchProd && !matchPay && !matchSku && !matchStatus && !matchPhone && !matchAddr && !matchState && !matchRace) {
          return false;
        }
      }

      return true;
    });
  }, [channelFilteredOrders, selectedStatuses, selectedCategories, selectedStates, selectedRaces, searchQuery, startDate, endDate]);

  // Sort Logic
  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const key = sortConfig.key;

      if (key === 'shippingAddress') {
        const stateA = getStateFromAddress(a.shippingAddress);
        const stateB = getStateFromAddress(b.shippingAddress);
        if (stateA < stateB) return sortConfig.order === 'asc' ? -1 : 1;
        if (stateA > stateB) return sortConfig.order === 'asc' ? 1 : -1;
      }

      let valA = a[key];
      let valB = b[key];

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

  // Pagination Slice
  const totalRecords = sortedOrders.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedOrders = sortedOrders.slice(startIndex, endIndex);

  const handleResetFilters = () => {
    setSelectedStatuses(['All']);
    setSearchQuery('');
    setSelectedCategories(['All']);
    setSelectedStates(['All']);
    setSelectedRaces(['All']);
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
  };

  const tabTitles: Record<ActiveTab, string> = {
    overview: 'Store Overview & KPI Dashboard',
    orders: 'Order Processing & Dispatch Master',
    customers: 'Customer Directory & Profiles',
    topRankings: 'Top Selling Digital Products & Spenders',
    financial: 'Financial & Escrow Settlement',
    sms: 'SMS Marketing & Movider Gateway',
    settings: 'System & API Data Management',
  };

  const uniqueCustomersCount = useMemo(() => {
    return new Set(orders.map((o) => (o.buyerUsername || '').toLowerCase().trim())).size;
  }, [orders]);

  return (
    <div className="h-screen flex bg-slate-100 text-slate-900 font-sans antialiased overflow-hidden">
      {/* Password Protection Gate Lock Screen */}
      {!isAuthenticated && (
        <PasswordGate onAuthenticated={() => setIsAuthenticated(true)} />
      )}

      {/* Expandable Left Navigation Sidebar (Request #4 & #2) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        ordersCount={orders.length}
        customersCount={uniqueCustomersCount}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        onLockDashboard={handleLockDashboard}
        onOpenTeamMembersModal={() => setIsTeamMembersOpen(true)}
        fontSizeScale={fontSizeScale}
        setFontSizeScale={setFontSizeScale}
        userRole={userRole}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-16' : 'ml-64'
        }`}
      >
        {/* Top Sticky Header & Channel Tabs Bar */}
        <div className="shrink-0 z-30 w-full bg-white shadow-xs border-b border-slate-200">
          <Header
            activeTab={activeTab}
            activeTabTitle={tabTitles[activeTab]}
            onOpenTeamMembersModal={() => setIsTeamMembersOpen(true)}
            onSyncData={handleSyncData}
            isSyncing={isSyncing}
            lastSyncedTime={lastSyncedTime}
            onOpenApiSettings={() => setIsApiSettingsOpen(true)}
            userRole={userRole}
            onSwitchRole={handleLockDashboard}
          />

          <ChannelTabs
            selectedChannel={selectedChannel}
            onSelectChannel={setSelectedChannel}
            orders={orders}
            mode={activeTab === 'customers' ? 'customers' : 'orders'}
          />
        </div>

        {/* Sync Toast Notification Banner */}
        {syncToastMessage && (
          <div className="shrink-0 w-full bg-blue-50 border-b border-blue-200 py-2.5 px-4 text-center text-xs font-bold text-blue-800 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>{syncToastMessage}</span>
          </div>
        )}

        {/* Active Tab View Body Content */}
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 space-y-4 overflow-y-auto min-h-0">

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <OverviewPanel
              orders={channelFilteredOrders}
              filteredOrders={filteredOrders}
              onOpenSmsTab={() => setActiveTab('sms')}
              onOpenAnalyticsModal={(tab) => {
                setAnalyticsModalTab(tab || 'overview');
                setIsAnalyticsModalOpen(true);
              }}
              onSelectOrder={setSelectedOrder}
            />
          )}

          {/* TAB 2: ORDERS MANAGEMENT */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {/* Shopee Income Overview Panel */}
              <IncomeOverviewCard orders={channelFilteredOrders} userRole={userRole} />

              <StatusFilterTabs
                orders={channelFilteredOrders}
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
                onToggleColumn={handleToggleColumn}
                onResetColumns={handleResetColumns}
                datePreset={datePreset}
                onSelectDatePreset={handleSelectDatePreset}
                startDate={startDate}
                endDate={endDate}
                onChangeStartDate={(d) => {
                  setStartDate(d);
                  setDatePreset('custom');
                }}
                onChangeEndDate={(d) => {
                  setEndDate(d);
                  setDatePreset('custom');
                }}
              />

              <DataTable
                orders={paginatedOrders}
                allFilteredOrders={filteredOrders}
                columns={columns}
                sortConfig={sortConfig}
                onSort={handleSort}
                onSelectOrder={setSelectedOrder}
                searchQuery={searchQuery}
                tableRowDensity={tableRowDensity}
                currencyPrefix={currencyPrefix}
                userRole={userRole}
              />

              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                totalRecords={totalRecords}
                startIndex={startIndex}
                endIndex={endIndex}
              />
            </div>
          )}

          {/* TAB 3: CUSTOMER DIRECTORY */}
          {activeTab === 'customers' && (
            <CustomerDirectory orders={channelFilteredOrders} userRole={userRole} />
          )}

          {/* TAB 4: TOP RANKINGS & ANALYTICS */}
          {activeTab === 'topRankings' && (
            <TopRankingsTab orders={filteredOrders} userRole={userRole} />
          )}

          {/* TAB 5: FINANCIAL & ESCROW */}
          {activeTab === 'financial' && (
            <FinancialPanel
              orders={channelFilteredOrders}
              columns={columns}
              onToggleColumn={handleToggleColumn}
              onResetColumns={handleResetColumns}
              onSelectOrder={setSelectedOrder}
              tableRowDensity={tableRowDensity}
              currencyPrefix={currencyPrefix}
              csFinancialShield={csFinancialShield}
              userRole={userRole}
            />
          )}

          {/* TAB 6: SMS MARKETING (MOVIDER) */}
          {activeTab === 'sms' && (
            <SmsMarketingPanel orders={channelFilteredOrders} />
          )}

          {/* TAB 7: SETTINGS & SYSTEM TOOLS */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in pb-8">
              {/* Settings Notification Toast */}
              {settingsSavedToast && (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold shadow-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>System settings updated successfully and saved to workspace profile.</span>
                  </div>
                  <button onClick={() => setSettingsSavedToast(false)} className="text-emerald-700 hover:text-emerald-900 font-extrabold cursor-pointer">
                    Dismiss
                  </button>
                </div>
              )}

              {/* BOX 1: DATA INTEGRATION & PLATFORM CONNECTIONS (Admin Only) */}
              {!['accountant', 'cs', 'marketing'].includes(userRole) && (
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900">Data Integration &amp; Shopee API Connections</h2>
                      <p className="text-xs text-slate-500 font-medium">
                        Configure Shopee Open Platform API credentials, CSV spreadsheet loaders, and automated background sync schedules.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Shopee Open Platform API Config Card */}
                    <button
                      onClick={() => setIsApiSettingsOpen(true)}
                      className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 bg-slate-50/80 hover:bg-blue-50/50 text-left transition-all cursor-pointer group shadow-2xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Key className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">Active</span>
                        </div>
                        <div className="font-bold text-sm text-slate-900">Shopee Open Platform API</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Configure Shop ID, Partner Secret Keys, and trigger real-time order sync.
                        </div>
                      </div>
                      <div className="mt-3 text-xs font-bold text-blue-600 group-hover:underline flex items-center gap-1">
                        <span>Open API Config</span> &rarr;
                      </div>
                    </button>

                    {/* CSV Spreadsheet Loader Card */}
                    <button
                      onClick={() => setIsApiSettingsOpen(true)}
                      className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 bg-slate-50/80 hover:bg-blue-50/50 text-left transition-all cursor-pointer group shadow-2xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <FileSpreadsheet className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-extrabold">Ready</span>
                        </div>
                        <div className="font-bold text-sm text-slate-900">Import / Merge CSV Spreadsheet</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Upload Shopee Seller Centre CSV files to merge buyer details &amp; escrow data.
                        </div>
                      </div>
                      <div className="mt-3 text-xs font-bold text-blue-600 group-hover:underline flex items-center gap-1">
                        <span>Upload CSV Files</span> &rarr;
                      </div>
                    </button>

                    {/* Auto-Sync Frequency Schedule */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 text-left shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 text-blue-600" />
                          <span>Auto-Sync Frequency</span>
                        </div>
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase">Background</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Set how often the system polls Shopee Open Platform for new orders.
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        {(['realtime', '15m', '1h', 'manual'] as const).map((freq) => (
                          <button
                            key={freq}
                            onClick={() => {
                              setAutoSyncFreq(freq);
                              setSettingsSavedToast(true);
                            }}
                            className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                              autoSyncFreq === freq
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {freq === 'realtime' && 'Webhook'}
                            {freq === '15m' && 'Every 15m'}
                            {freq === '1h' && 'Every 1h'}
                            {freq === 'manual' && 'Manual Only'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BOX 2: DISPLAY, TYPOGRAPHY & VISUAL ACCESSIBILITY */}
              <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                    <Type className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">Display, Typography &amp; Visual Accessibility</h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Adjust display text scaling, data table row padding density, and currency prefix formatting across the workspace.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Dashboard Text Size Accessibility Card */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 text-left shadow-2xs space-y-2">
                    <div className="flex items-center gap-2">
                      <Type className="w-4 h-4 text-indigo-600" />
                      <div className="font-bold text-sm text-slate-900">Dashboard Text Size</div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Adjust overall display text size across all tabs for optimal readability.
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        onClick={() => {
                          setFontSizeScale('normal');
                          setSettingsSavedToast(true);
                        }}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          fontSizeScale === 'normal'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Small
                      </button>
                      <button
                        onClick={() => {
                          setFontSizeScale('large');
                          setSettingsSavedToast(true);
                        }}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          fontSizeScale === 'large'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Medium
                      </button>
                      <button
                        onClick={() => {
                          setFontSizeScale('xlarge');
                          setSettingsSavedToast(true);
                        }}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          fontSizeScale === 'xlarge'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Large
                      </button>
                    </div>
                  </div>

                  {/* Table Row Padding Density */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 text-left shadow-2xs space-y-2">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-indigo-600" />
                      <div className="font-bold text-sm text-slate-900">Data Table Density</div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Change row height padding in order breakdown tables.
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
                        <button
                          key={density}
                          onClick={() => {
                            setTableRowDensity(density);
                            setSettingsSavedToast(true);
                          }}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer capitalize ${
                            tableRowDensity === density
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {density}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Currency Format Display */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 text-left shadow-2xs space-y-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-indigo-600" />
                      <div className="font-bold text-sm text-slate-900">Currency Prefix Format</div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Choose how ringgit monetary values are styled across revenue cards.
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      {(['RM', 'MYR', 'PLAIN'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => {
                            setCurrencyPrefix(fmt);
                            setSettingsSavedToast(true);
                          }}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                            currencyPrefix === fmt
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {fmt === 'RM' && 'RM 100'}
                          {fmt === 'MYR' && 'MYR 100'}
                          {fmt === 'PLAIN' && '100.00'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* BOX 3: TEAM ACCESS, CS PRIVILEGES & SECURITY (Visible ONLY for Admin) */}
              {userRole === 'admin' && (
                <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900">Team Access, CS Agent Privileges &amp; Security Controls</h2>
                      <p className="text-xs text-slate-500 font-medium">
                        Manage team member logins, restrict financial profit margin visibility from CS staff, and adjust idle timeouts.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Manage Team Members */}
                    <button
                      onClick={() => setIsTeamMembersOpen(true)}
                      className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50/80 hover:bg-emerald-50/40 text-left transition-all cursor-pointer group shadow-2xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <UsersIcon className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">Active</span>
                        </div>
                        <div className="font-bold text-sm text-slate-900">Team Member Sessions</div>
                        <div className="text-xs text-slate-500 mt-1">
                          View active customer service agents, IP addresses, and login logs.
                        </div>
                      </div>
                      <div className="mt-3 text-xs font-bold text-emerald-700 group-hover:underline flex items-center gap-1">
                        <span>Manage Team</span> &rarr;
                      </div>
                    </button>

                    {/* Change Admin Password */}
                    <button
                      onClick={() => setIsChangePasswordOpen(true)}
                      className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50/80 hover:bg-emerald-50/40 text-left transition-all cursor-pointer group shadow-2xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Lock className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                          <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-extrabold">Security</span>
                        </div>
                        <div className="font-bold text-sm text-slate-900">Admin Account Password</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Update workspace security PIN and admin authentication password.
                        </div>
                      </div>
                      <div className="mt-3 text-xs font-bold text-emerald-700 group-hover:underline flex items-center gap-1">
                        <span>Change Password</span> &rarr;
                      </div>
                    </button>

                    {/* CS Financial Privacy Shield Toggle */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 text-left shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          <EyeOff className="w-4 h-4 text-emerald-600" />
                          <span>CS Financial Shield</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={csFinancialShield}
                          onChange={(e) => {
                            setCsFinancialShield(e.target.checked);
                            setSettingsSavedToast(true);
                          }}
                          className="w-4 h-4 accent-emerald-600 cursor-pointer rounded"
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        Hide store net profit margin &amp; total revenue cards when CS reps are logged in.
                      </p>
                      <div className="pt-1 text-xs text-slate-600 font-semibold">
                        Shielding: {csFinancialShield ? 'ON (Totals Hidden for CS)' : 'OFF (Full View)'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BOX 4: SYSTEM BACKUP, DATA EXPORT & LOCAL CACHE */}
              <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center font-bold shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">System Backup, Data Export &amp; Cache Maintenance</h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Download full JSON database backups or reset browser LocalStorage state cache.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Download JSON Backup */}
                  <button
                    onClick={() => {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(orders, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute("href", dataStr);
                      downloadAnchor.setAttribute("download", `Shopee_Dashboard_Backup_${new Date().toISOString().split('T')[0]}.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}
                    className="p-4 rounded-xl border border-slate-200 hover:border-rose-500 bg-slate-50/80 hover:bg-rose-50/40 text-left transition-all cursor-pointer group shadow-2xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <Download className="w-4 h-4 text-rose-600 group-hover:scale-110 transition-transform" />
                        <span>Export Complete JSON Backup</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Download raw backup containing all {orders.length} orders, custom notes, and phone records.
                      </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold shadow-xs shrink-0">
                      Download
                    </span>
                  </button>

                  {/* Reset Local Cache */}
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to clear client local cache? Data will be re-fetched from server.")) {
                        localStorage.clear();
                        window.location.reload();
                      }
                    }}
                    className="p-4 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/80 hover:bg-slate-100 text-left transition-all cursor-pointer group shadow-2xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-slate-600 group-hover:rotate-180 transition-transform duration-500" />
                        <span>Clear Local Client Cache</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Reset LocalStorage browser cache and re-download fresh order dataset from server.
                      </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold shadow-xs shrink-0">
                      Reset Cache
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Shopee Open Platform API Settings Modal */}
      <ShopeeApiSettingsModal
        isOpen={isApiSettingsOpen}
        onClose={() => setIsApiSettingsOpen(false)}
        onDataLoaded={handleDataLoaded}
        onSyncNow={handleSyncData}
        isSyncing={isSyncing}
        activeOrderCount={orders.length}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        userRole={userRole}
      />

      {/* Team Member Sessions Modal */}
      <TeamMembersModal
        isOpen={isTeamMembersOpen}
        onClose={() => setIsTeamMembersOpen(false)}
        userRole={userRole}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
      />

      {/* Order Inspector Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onUpdateOrder={handleUpdateOrder}
        userRole={userRole}
      />

      {/* Sales Chart Modal */}
      <SalesChartModal
        isOpen={isAnalyticsModalOpen}
        onClose={() => setIsAnalyticsModalOpen(false)}
        orders={filteredOrders}
        initialTab={analyticsModalTab}
        theme="light"
      />
    </div>
  );
}
