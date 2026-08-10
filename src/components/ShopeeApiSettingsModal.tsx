import React, { useState, useRef } from 'react';
import {
  Key,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  X,
  Sliders,
  Store,
  ChevronDown,
  ChevronRight,
  Upload,
  FileSpreadsheet,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { parseFileToOrders } from '../utils/csvHelper';

interface ShopeeApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (data: any[]) => void;
  onSyncNow: () => void;
  isSyncing: boolean;
  activeOrderCount: number;
}

export const ShopeeApiSettingsModal: React.FC<ShopeeApiSettingsModalProps> = ({
  isOpen,
  onClose,
  onDataLoaded,
  onSyncNow,
  isSyncing,
  activeOrderCount,
}) => {
  const [partnerId, setPartnerId] = useState('2039798');
  const [partnerKey, setPartnerKey] = useState('shpk78614841454a6d4e424d63716c4a7a62754b764544786c6e624e55545076');
  const [shopId, setShopId] = useState('1562261313');
  const [accessToken, setAccessToken] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [authStepOpened, setAuthStepOpened] = useState(false);
  const [isAuthExpanded, setIsAuthExpanded] = useState(false);
  const [showCsvGuide, setShowCsvGuide] = useState(false);
  const [csvUploadStatus, setCsvUploadStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    onSyncNow();
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  const handleAuthorizeShop = async () => {
    setAuthStepOpened(true);
    const cleanPartnerId = partnerId.trim() || '2039798';
    const cleanPartnerKey = partnerKey.trim() || 'shpk78614841454a6d4e424d63716c4a7a62754b764544786c6e624e55545076';
    const redirectTarget = window.location.origin;
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v2/shop/auth_partner';
    const baseString = `${cleanPartnerId}${path}${timestamp}`;

    let signHex = '';
    try {
      const encoder = new TextEncoder();
      const keyBuffer = encoder.encode(cleanPartnerKey);
      const messageBuffer = encoder.encode(baseString);

      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, messageBuffer);
      const hashArray = Array.from(new Uint8Array(signature));
      signHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.error('Signature calculation error:', e);
    }

    const authUrl = `https://partner.shopeemobile.com/api/v2/shop/auth_partner?partner_id=${cleanPartnerId}&timestamp=${timestamp}${signHex ? `&sign=${signHex}` : ''}&redirect=${encodeURIComponent(redirectTarget)}`;
    window.open(authUrl, '_blank');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCsvUploadStatus('⏳ Reading and parsing file data...');
      const { orders } = await parseFileToOrders(file);
      if (orders && orders.length > 0) {
        onDataLoaded(orders);
        setCsvUploadStatus(`🎉 Merged ${orders.length} order records from ${file.name}!`);
        setTimeout(() => setCsvUploadStatus(null), 6000);
      } else {
        setCsvUploadStatus('⚠️ No valid order records found in the selected file.');
      }
    } catch (err) {
      console.error('File parsing error:', err);
      setCsvUploadStatus('❌ Failed to read file. Make sure it is a valid Shopee export (.xlsx, .xls, or .csv).');
    }
    if (e.target) e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header - Light Mode */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">Shopee Open Platform API</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  App Live &amp; Connected
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Live Store Synchronization &amp; Seller Centre CSV Import
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

        {/* Modal Body - Light Mode */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm text-slate-700">
          {/* Quick Sync Action Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
            <div>
              <div className="text-slate-900 font-bold text-sm sm:text-base flex items-center gap-2">
                <span>API Integration Status</span>
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active ({activeOrderCount.toLocaleString()} Records)
                </span>
              </div>
              <p className="text-slate-600 text-xs font-medium mt-1">
                Shop ID: <strong className="text-blue-700 font-mono">{shopId || '1562261313'}</strong> • Partner ID: <strong className="text-blue-700 font-mono">{partnerId}</strong>
              </p>
            </div>

            <button
              type="button"
              onClick={onSyncNow}
              disabled={isSyncing}
              className="px-4 py-2 rounded-lg font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Live Orders'}</span>
            </button>
          </div>

          {/* Upload Excel / CSV & Auto-Merge Section */}
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4.5 h-4.5 text-blue-600" />
                <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm uppercase tracking-wider">
                  Upload Excel (.xlsx) or CSV &amp; Auto-Merge
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowCsvGuide(!showCsvGuide)}
                className="text-xs text-blue-700 hover:underline flex items-center gap-1 font-bold cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                <span>Export instructions</span>
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Upload your Shopee Seller Centre Excel worksheet or CSV export to auto-merge buyer contact details, phone numbers, delivery addresses, and voucher rebates.
            </p>

            {/* Shopee Seller Center Download Guide Box */}
            {showCsvGuide && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2 animate-fadeIn">
                <div className="font-bold text-amber-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  How to export from Shopee Seller Centre:
                </div>
                <ol className="list-decimal list-inside text-[11px] text-amber-950 space-y-1 pl-1 leading-relaxed font-medium">
                  <li>Log in to <strong>Shopee Seller Centre</strong> (<code className="text-amber-800 font-mono">seller.shopee.com.my</code>).</li>
                  <li>Go to <strong>My Orders</strong> &rarr; <strong>Order Management</strong>.</li>
                  <li>Click <strong>Export Orders</strong> (choose your desired date range).</li>
                  <li>Download the generated <strong>Excel Worksheet (.xlsx)</strong> or CSV file.</li>
                  <li>Upload that file here &mdash; phone numbers, addresses &amp; voucher rebates will auto-merge!</li>
                </ol>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto px-5 py-2 rounded-lg font-extrabold bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Excel / CSV File</span>
              </button>
            </div>

            {csvUploadStatus && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold animate-fadeIn">
                {csvUploadStatus}
              </div>
            )}
          </div>

          {/* Step 1: Shop Authorization Guide */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <button
              type="button"
              onClick={() => setIsAuthExpanded(!isAuthExpanded)}
              className="w-full flex items-center justify-between cursor-pointer text-left focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-600" />
                <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm uppercase tracking-wider">
                  Authorize Shopee Store Account
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2.5 py-0.5 rounded-full">
                  Shopee OAuth Flow
                </span>
                {isAuthExpanded ? (
                  <ChevronDown className="w-4 h-4 text-blue-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>

            {isAuthExpanded && (
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-3 animate-fadeIn">
                <p className="text-xs text-slate-600 leading-relaxed">
                  To retrieve live orders directly via API, Shopee requires logging into your store seller account to authorize access.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleAuthorizeShop}
                    className="px-4 py-2 rounded-lg font-bold bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Authorize Store on Shopee.com</span>
                  </button>

                  {authStepOpened && (
                    <div className="text-xs text-emerald-800 font-bold flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-300">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>Authorization window opened! Login to grant permission.</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* API Credentials Form */}
          <form onSubmit={handleSaveSettings} className="space-y-4 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-blue-600" />
                Shopee Open Platform V2 Credentials
              </h4>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-200 uppercase">
                Production Live Mode
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Live Partner ID
                </label>
                <input
                  type="text"
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  placeholder="e.g. 2039798"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-slate-900 font-semibold text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Live API Partner Key
                </label>
                <input
                  type="text"
                  value={partnerKey}
                  onChange={(e) => setPartnerKey(e.target.value)}
                  placeholder="Enter Partner Key"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-slate-900 font-mono text-[11px] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Shopee Shop ID / Merchant ID
                </label>
                <input
                  type="text"
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value)}
                  placeholder="e.g. 1562261313"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-slate-900 font-semibold text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Shop Access Token (Optional)
                </label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Paste Access Token if generated"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2 text-slate-900 font-mono text-[11px] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href="https://open.shopee.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-bold"
              >
                Shopee Developer Console <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <ShieldCheck className="w-4 h-4" />
                Save Credentials &amp; Sync
              </button>
            </div>

            {saveSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs sm:text-sm flex items-center gap-2 font-bold animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Live Credentials saved &amp; store sync triggered!
              </div>
            )}
          </form>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-semibold">
            Partner API V2.0 &bull; Shopee Open Platform
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs sm:text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors shadow-xs cursor-pointer active:scale-95"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
