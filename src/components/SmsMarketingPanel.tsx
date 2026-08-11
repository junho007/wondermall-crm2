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
} from 'lucide-react';
import { ShopeeOrder } from '../types';
import { isValidSmsPhone } from '../utils/csvHelper';
import { CustomDropdown, OptionItem } from './CustomDropdown';

interface SmsMarketingPanelProps {
  orders: ShopeeOrder[];
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

export const SmsMarketingPanel: React.FC<SmsMarketingPanelProps> = ({ orders }) => {
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
  const [senderId, setSenderId] = useState(() => {
    const saved = localStorage.getItem('wm_movider_sender_id');
    if (!saved || saved === 'WONDERMALL') {
      localStorage.setItem('wm_movider_sender_id', 'WonderMall');
      return 'WonderMall';
    }
    return saved;
  });
  const [isSaved, setIsSaved] = useState(false);

  // Marketing Channel Selection - default to 'sms' so SMS blast sends real SMS
  const [dispatchChannel, setDispatchChannel] = useState<'sms' | 'whatsapp' | 'both'>('sms');

  // Audience & Composition State
  const [audienceMode, setAudienceMode] = useState<'all' | 'state' | 'category' | 'single'>('all');
  const [selectedState, setSelectedState] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [singlePhone, setSinglePhone] = useState<string>('');
  const [singleRecipientName, setSingleRecipientName] = useState<string>('');

  const [messageText, setMessageText] = useState<string>(
    'Hi {buyerName}! Thank you for ordering from WCGMall on Shopee. Your voucher code is ready in your chat!'
  );

  const [isSending, setIsSending] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [searchLogQuery, setSearchLogQuery] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'SMS' | 'WHATSAPP'>('ALL');

  // Extract unique customers from orders with phone number detection
  const customerList = useMemo(() => {
    const map = new Map<string, { username: string; name: string; phone: string; country: string; product: string; isValidPhone: boolean }>();

    orders.forEach((o) => {
      const username = o.buyerUsername || 'buyer';
      const rawPhone = o.buyerPhone || o.recipientPhone || '';
      const isPhoneValid = isValidSmsPhone(rawPhone);
      const countryVal = o.country || 'Malaysia';
      const productVal = o.productName || o.productCategory || 'Digital Product';

      if (!map.has(username)) {
        map.set(username, {
          username,
          name: o.buyerName || o.recipientName || username,
          phone: rawPhone || 'Hidden by Shopee',
          country: countryVal,
          product: productVal,
          isValidPhone: isPhoneValid,
        });
      } else {
        const existing = map.get(username)!;
        if (!existing.isValidPhone && isPhoneValid) {
          existing.phone = rawPhone;
          existing.isValidPhone = true;
        }
      }
    });

    return Array.from(map.values());
  }, [orders]);

  const reachableCustomers = useMemo(() => customerList.filter((c) => c.isValidPhone), [customerList]);
  const hiddenCustomersCount = customerList.length - reachableCustomers.length;

  // Extract unique countries & available products
  const countriesList = useMemo(() => {
    const set = new Set(orders.map((o) => o.country || 'Malaysia').filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [orders]);

  const productsList = useMemo(() => {
    const set = new Set(orders.map((o) => o.productName).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [orders]);

  // Filtered recipients count
  const targetRecipients = useMemo(() => {
    if (audienceMode === 'single') {
      return isValidSmsPhone(singlePhone)
        ? [{ name: singleRecipientName || 'Customer', phone: singlePhone, username: 'custom', country: 'Malaysia', product: 'General' }]
        : [];
    }
    if (audienceMode === 'state' && selectedState !== 'All') {
      return reachableCustomers.filter((c) => c.country === selectedState);
    }
    if (audienceMode === 'category' && selectedCategory !== 'All') {
      return reachableCustomers.filter((c) => c.product === selectedCategory);
    }
    return reachableCustomers;
  }, [audienceMode, selectedState, selectedCategory, singlePhone, singleRecipientName, reachableCustomers]);

  const targetCount = targetRecipients.length;

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

  // Fetch SMS & WhatsApp Logs & Saved API Settings
  const fetchSmsLogsAndSettings = async () => {
    setIsLoadingLogs(true);
    try {
      let backendLogs: SmsLog[] = [];
      const res = await fetch('/api/send-sms');
      if (res.ok) {
        const data = await res.json();
        if (data.logs) backendLogs = data.logs;
        if (data.settings) {
          if (data.settings.apiKey && (!apiKey || apiKey.startsWith('3GnQOV'))) {
            setApiKey(data.settings.apiKey);
            localStorage.setItem('wm_movider_api_key', data.settings.apiKey);
          }
          if (data.settings.apiSecret && (!apiSecret || apiSecret.startsWith('RENJe') || apiSecret.startsWith('vHVpO3g'))) {
            setApiSecret(data.settings.apiSecret);
            localStorage.setItem('wm_movider_api_secret', data.settings.apiSecret);
          }
          if (data.settings.senderId) {
            setSenderId(data.settings.senderId);
            localStorage.setItem('wm_movider_sender_id', data.settings.senderId);
          }
        }
      }

      // Merge local SMS logs and WhatsApp logs with backend logs to prevent history loss
      const localSmsLogs: SmsLog[] = JSON.parse(localStorage.getItem('wm_movider_sms_logs') || '[]');
      const localWaLogs: SmsLog[] = JSON.parse(localStorage.getItem('wm_whatsapp_logs') || '[]');

      const logMap = new Map<string, SmsLog>();
      [...localWaLogs, ...localSmsLogs, ...backendLogs].forEach((l) => {
        if (l && l.id) logMap.set(l.id, l);
      });

      const combined = Array.from(logMap.values()).sort(
        (a, b) => new Date(b.sentTime).getTime() - new Date(a.sentTime).getTime()
      );

      setSmsLogs(combined);

      // Persist combined SMS history back into browser localStorage
      const smsOnlyLogs = combined.filter((x) => x.channel !== 'WHATSAPP' && x.senderId !== 'WHATSAPP_WEB');
      localStorage.setItem('wm_movider_sms_logs', JSON.stringify(smsOnlyLogs));
    } catch (err) {
      console.warn('Failed to fetch SMS logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Sync Movider Gateway History
  const handleSyncMoviderHistory = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_history',
          apiKey: apiKey || 'iPnNDUbKo2OyVvr5osnidwt8uL1-GW',
          apiSecret: apiSecret || 'Jl0WWdL6vGjbq5ZVT2qxLFJqUYadPE',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.logs) {
          const localSmsLogs: SmsLog[] = JSON.parse(localStorage.getItem('wm_movider_sms_logs') || '[]');
          const localWaLogs: SmsLog[] = JSON.parse(localStorage.getItem('wm_whatsapp_logs') || '[]');

          const logMap = new Map<string, SmsLog>();
          [...localWaLogs, ...localSmsLogs, ...data.logs].forEach((l) => {
            if (l && l.id) logMap.set(l.id, l);
          });

          const combined = Array.from(logMap.values()).sort(
            (a, b) => new Date(b.sentTime).getTime() - new Date(a.sentTime).getTime()
          );

          setSmsLogs(combined);
          const smsOnlyLogs = combined.filter((x) => x.channel !== 'WHATSAPP' && x.senderId !== 'WHATSAPP_WEB');
          localStorage.setItem('wm_movider_sms_logs', JSON.stringify(smsOnlyLogs));

          setToastMessage('✅ Movider gateway SMS campaign logs synced successfully!');
          setTimeout(() => setToastMessage(null), 3500);
        }
      }
    } catch (err) {
      console.warn('Sync history error:', err);
      setToastMessage('❌ Unable to sync gateway logs. Please check API credentials.');
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchSmsLogsAndSettings();
  }, []);

  // Save Movider Credentials
  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('wm_movider_api_key', apiKey);
    localStorage.setItem('wm_movider_api_secret', apiSecret);
    localStorage.setItem('wm_movider_sender_id', senderId);

    try {
      await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_settings',
          apiKey,
          apiSecret,
          senderId,
        }),
      });
    } catch (err) {
      console.warn('KV save settings error:', err);
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

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

  // Launch WhatsApp Web Direct Chat for a single recipient
  const handleLaunchWhatsAppChat = (recipient: { name: string; phone: string; username?: string }) => {
    const waPhone = formatWhatsAppPhone(recipient.phone);
    if (!waPhone) {
      alert('Invalid or missing phone number for WhatsApp.');
      return;
    }

    const personalizedMsg = messageText.replace(/\{buyerName\}/g, recipient.name || recipient.username || 'Customer');
    const encodedText = encodeURIComponent(personalizedMsg);
    const waUrl = `https://wa.me/${waPhone}?text=${encodedText}`;

    // Open WhatsApp in new tab
    window.open(waUrl, '_blank');

    // Record WhatsApp Log locally
    const newLog: SmsLog = {
      id: `wa_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipientName: recipient.name || recipient.username || 'Customer',
      recipientPhone: recipient.phone,
      messageText: personalizedMsg,
      senderId: 'WHATSAPP_WEB',
      sentTime: new Date().toISOString(),
      status: 'WHATSAPP_LAUNCHED',
      channel: 'WHATSAPP',
    };

    const currentWaLogs = JSON.parse(localStorage.getItem('wm_whatsapp_logs') || '[]');
    const updatedWaLogs = [newLog, ...currentWaLogs];
    localStorage.setItem('wm_whatsapp_logs', JSON.stringify(updatedWaLogs));

    setSmsLogs((prev) => [newLog, ...prev]);
    setToastMessage(`💬 WhatsApp chat opened for ${recipient.name} (+${waPhone})!`);
    setTimeout(() => setToastMessage(null), 3500);
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
      const batchList = targetRecipients.slice(0, 5);
      let lastSmsError: string | null = null;

      if (dispatchChannel === 'sms' || dispatchChannel === 'both') {
        setToastMessage('⏳ Dispatching SMS via Movider Gateway...');

        for (const recipient of batchList) {
          const personalizedMsg = messageText.replace(/\{buyerName\}/g, recipient.name || recipient.username || 'Customer');

          const response = await fetch('/api/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send_sms',
              apiKey: apiKey || 'iPnNDUbKo2OyVvr5osnidwt8uL1-GW',
              apiSecret: apiSecret || 'Jl0WWdL6vGjbq5ZVT2qxLFJqUYadPE',
              senderId: senderId || 'WONDERMALL',
              recipientPhone: recipient.phone,
              recipientName: recipient.name || recipient.username,
              messageText: personalizedMsg,
              channel: dispatchChannel === 'both' ? 'SMS' : dispatchChannel.toUpperCase(),
            }),
          });

          const data = await response.json();
          if (data.log?.errorMessage) {
            lastSmsError = data.log.errorMessage;
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

      if (lastSmsError) {
        setToastMessage(`❌ SMS Failed: ${lastSmsError}`);
      } else {
        setToastMessage(`✅ Campaign dispatched successfully via ${dispatchChannel.toUpperCase()}!`);
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

  // First recipient for live preview
  const previewRecipient = targetRecipients[0] || { name: 'Ahmad Rizal', phone: '+60123456789' };
  const previewMessage = messageText.replace(/\{buyerName\}/g, previewRecipient.name);

  return (
    <div className="space-y-6 w-full animate-fade-in">
      {/* Top Banner & Omnichannel Status Header */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-green-500 text-white flex items-center justify-center font-bold shadow-md shrink-0">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                SMS &amp; WhatsApp Marketing Hub
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                Movider SMS Gateway Active
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Engage Shopee buyers with automated order notifications, voucher delivery, and instant messaging.
            </p>
          </div>
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

      {/* Main Grid: Settings, Campaign Composer, & WhatsApp Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Sender Settings */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Key className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Sender Settings
            </h3>
          </div>

          <form onSubmit={handleSaveCredentials} className="space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Sender Name
                </label>
              </div>
              <input
                type="text"
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                placeholder="e.g. WonderMall or <WCGMall>"
                maxLength={11}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 focus:bg-white"
              />
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] text-slate-500 font-medium">Approved Names:</span>
                {['WonderMall', 'WCGMall', '<WCGMall>', '[WCGMall]'].map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSenderId(name)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      senderId === name
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {isSaved && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Sender settings saved successfully!</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs"
            >
              Save Settings
            </button>
          </form>
        </div>

        {/* Right 2 Columns: Omnichannel Campaign Composer & Live WhatsApp Preview */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-4">
          {/* Header & Channel Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Compose Marketing Campaign
              </h3>
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
          <div className="space-y-3">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'all', label: `Reachable (${reachableCustomers.length})` },
                { id: 'state', label: 'Country' },
                { id: 'category', label: 'By Product' },
                { id: 'single', label: 'Single Recipient' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAudienceMode(tab.id as any)}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center ${
                    audienceMode === tab.id
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Audience Filters */}
            {audienceMode === 'state' && (
              <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-600 shrink-0">Select Country:</span>
                <div className="w-64">
                  <CustomDropdown
                    options={countriesList.map((c) => ({
                      value: c,
                      label: c === 'All' ? 'All Countries' : c,
                    }))}
                    value={selectedState}
                    onChange={setSelectedState}
                  />
                </div>
              </div>
            )}

            {audienceMode === 'category' && (
              <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-600 shrink-0">Select Product:</span>
                <div className="w-64">
                  <CustomDropdown
                    options={productsList.map((p) => ({
                      value: p,
                      label: p === 'All' ? 'All Products' : p,
                    }))}
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                  />
                </div>
              </div>
            )}

            {audienceMode === 'single' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Phone Number (+60)
                  </label>
                  <input
                    type="text"
                    value={singlePhone}
                    onChange={(e) => setSinglePhone(e.target.value)}
                    placeholder="e.g. +60123456789"
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Recipient Name
                  </label>
                  <input
                    type="text"
                    value={singleRecipientName}
                    onChange={(e) => setSingleRecipientName(e.target.value)}
                    placeholder="e.g. Ahmad Rizal"
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800"
                  />
                </div>
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

          {/* Composer Box & Live Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Textarea */}
            <div>
              <textarea
                rows={5}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your campaign message content..."
                className="w-full p-3 rounded-xl border border-slate-300 bg-slate-50 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all resize-y"
              />
              <div className="flex flex-wrap items-center justify-between gap-1 mt-1 text-[11px] text-slate-500 font-medium">
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

            {/* Live Chat Preview */}
            <div className="rounded-xl border border-emerald-300 bg-[#e5ddd5] p-3 shadow-inner flex flex-col justify-between overflow-hidden relative min-h-[160px]">
              {/* WhatsApp Header */}
              <div className="bg-[#075e54] text-white p-2 rounded-t-lg -mx-3 -mt-3 flex items-center justify-between shadow-xs mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-400 text-emerald-950 font-black text-[10px] flex items-center justify-center">
                    WM
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">WONDERMALL Official Store</div>
                    <div className="text-[9px] text-emerald-200">Online • Verified</div>
                  </div>
                </div>
                <MessageCircle className="w-4 h-4 text-emerald-300" />
              </div>

              {/* Chat Bubble */}
              <div className="bg-[#dcf8c6] text-slate-900 p-2.5 rounded-lg rounded-tl-none shadow-xs text-xs space-y-1 self-start max-w-[95%] my-auto relative">
                <p className="whitespace-pre-wrap text-[11px] font-sans leading-relaxed text-slate-800">
                  {previewMessage}
                </p>
                <div className="flex items-center justify-end gap-1 text-[9px] text-slate-500 font-mono">
                  <span>12:45 PM</span>
                  <CheckCheck className="w-3 h-3 text-blue-500" />
                </div>
              </div>

              {/* Footer Indicator */}
              <div className="text-[10px] text-emerald-900 font-bold bg-emerald-100/80 px-2 py-0.5 rounded text-center mt-2 border border-emerald-200">
                Preview for {previewRecipient.name}
              </div>
            </div>
          </div>

          {/* Dispatch Action Button */}
          <div className="pt-2">
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

        <div className="overflow-x-auto max-h-60 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200 sticky top-0 bg-slate-50">
                <th className="py-2.5 px-3">Buyer Name</th>
                <th className="py-2.5 px-3">Phone Number</th>
                <th className="py-2.5 px-3">Country</th>
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {targetRecipients.slice(0, 15).map((r, idx) => {
                const waFormatted = formatWhatsAppPhone(r.phone);
                return (
                  <tr key={idx} className="hover:bg-emerald-50/50 transition-colors">
                    <td className="py-2 px-3 font-bold text-slate-900">{r.name}</td>
                    <td className="py-2 px-3 font-mono font-bold text-emerald-700">
                      {r.phone} <span className="text-[10px] text-slate-400 font-normal">(+{waFormatted})</span>
                    </td>
                    <td className="py-2 px-3 text-slate-600">{r.country || 'Malaysia'}</td>
                    <td className="py-2 px-3 text-slate-600">{r.product || 'Digital Product'}</td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleLaunchWhatsAppChat(r)}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1.5 ml-auto cursor-pointer shadow-2xs transition-all active:scale-95"
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
                  <td colSpan={5} className="py-6 text-center text-xs text-slate-400 italic">
                    No buyers matched the selected audience criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Sent Campaign Logs & Audit History */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Outbound Campaign Logs &amp; Audit History
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by Channel */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
              <button
                onClick={() => setChannelFilter('ALL')}
                className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                  channelFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                }`}
              >
                All ({smsLogs.length})
              </button>
              <button
                onClick={() => setChannelFilter('WHATSAPP')}
                className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                  channelFilter === 'WHATSAPP' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500'
                }`}
              >
                WhatsApp
              </button>
              <button
                onClick={() => setChannelFilter('SMS')}
                className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                  channelFilter === 'SMS' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-500'
                }`}
              >
                SMS
              </button>
            </div>

            <div className="relative w-44 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search recipient phone..."
                value={searchLogQuery}
                onChange={(e) => setSearchLogQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium focus:outline-none focus:border-emerald-600"
              />
            </div>

            <button
              onClick={handleSyncMoviderHistory}
              disabled={isLoadingLogs}
              className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              title="Sync Movider Gateway History"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin text-emerald-600' : 'text-emerald-700'}`} />
              <span>Sync Gateway History</span>
            </button>

            <button
              onClick={fetchSmsLogsAndSettings}
              disabled={isLoadingLogs}
              className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin text-emerald-600' : ''}`} />
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
                <th className="py-2.5 px-3">Recipient Name</th>
                <th className="py-2.5 px-3">Phone Number</th>
                <th className="py-2.5 px-3">Message Preview</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredLogs.map((log) => {
                const isWa = log.channel === 'WHATSAPP' || log.senderId === 'WHATSAPP_WEB';
                return (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3">
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
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {new Date(log.sentTime).toLocaleString('en-GB')}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{log.recipientName}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{log.recipientPhone}</td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={log.messageText}>
                      {log.messageText}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex flex-col items-end gap-1">
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
                            ? 'WA LAUNCHED'
                            : log.status === 'SENT_SIMULATED'
                            ? 'SENT'
                            : log.status}
                        </span>
                        {log.errorMessage && (
                          <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 max-w-xs text-right leading-tight">
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
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400 italic">
                    No marketing messages logged for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
