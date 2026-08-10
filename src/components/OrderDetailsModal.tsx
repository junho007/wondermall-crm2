import React, { useState } from 'react';
import { X, Copy, Check, Gamepad2, CreditCard, User, ShoppingBag, Clock, Send, CheckCircle2, Phone, MapPin, Receipt, Globe, Sparkles } from 'lucide-react';
import { ShopeeOrder } from '../types';
import { calculateNetIncome, getTimelineTimestamps, formatMalaysiaTime, getMerchandiseGmv, adjustHoursToDateString } from '../utils/csvHelper';

interface OrderDetailsModalProps {
  order: ShopeeOrder | null;
  onClose: () => void;
  onUpdateOrder?: (updatedOrder: ShopeeOrder) => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ order, onClose, onUpdateOrder }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  if (!order) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleShiftTimezone = (hours: number) => {
    const currentOrderDate = order.orderDate || '';
    if (!currentOrderDate) return;

    const newOrderDate = adjustHoursToDateString(currentOrderDate, hours);
    const newShipTime = order.shipTime ? adjustHoursToDateString(order.shipTime, hours) : undefined;
    const newDeliveryTime = order.deliveryTime ? adjustHoursToDateString(order.deliveryTime, hours) : undefined;

    const updated: ShopeeOrder = {
      ...order,
      orderDate: newOrderDate,
      shipTime: newShipTime,
      deliveryTime: newDeliveryTime,
      timeZoneApplied: hours > 0 ? 'MYT' : 'UTC',
    };

    if (onUpdateOrder) {
      onUpdateOrder(updated);
    }
    setSyncStatusMsg(`Applied +${hours} hours timezone offset! Converted to Malaysia Time (MYT).`);
    setTimeout(() => setSyncStatusMsg(null), 3500);
  };

  const orderStatus = order.orderStatus || 'Completed';

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
      case 'Unpaid':
        return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
      case 'Cancelled':
        return 'bg-rose-50 text-rose-800 border-rose-300 font-bold';
      case 'In Transit':
        return 'bg-sky-50 text-sky-800 border-sky-300 font-bold';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const platformName = order.platform || order.channel || 'Platform';
  const displayBuyerName = order.buyerName || order.recipientName || order.buyerUsername || `${platformName} Customer`;
  const displayPhone = order.buyerPhone || order.recipientPhone || 'Not provided';
  const displayAddress = order.shippingAddress || 'Address not available';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 text-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 aspect-square shrink-0 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                  Order Details Inspector
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider shrink-0 ${getStatusBadgeStyle(orderStatus)}`}>
                  {orderStatus}
                </span>
              </div>
              <p className="text-xs font-mono font-bold text-slate-500">
                SN: {order.orderSn}
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
        <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm text-slate-700">
          {/* Product Banner & Items Breakdown */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-blue-600" />
                Purchased Digital Asset ({order.items && order.items.length > 1 ? `${order.items.length} Product Variants` : '1 Item'})
              </span>
              <span className="text-lg sm:text-xl font-black font-mono text-slate-900">
                RM {getMerchandiseGmv(order).toFixed(2)}
              </span>
            </div>
            <p className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed">{order.productName}</p>

            {/* Individual Item Variants List */}
            {order.items && order.items.length > 0 && (
              <div className="pt-2 border-t border-blue-200/80 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900 block">
                  Order Line Items & Variant Breakdown:
                </span>
                <div className="space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-white border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs sm:text-sm">{item.name}</span>
                          {item.variation && (
                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-extrabold border border-blue-300">
                              Variation: {item.variation}
                            </span>
                          )}
                        </div>
                        {item.sku && (
                          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                            <span>SKU / Line ID:</span>
                            <span className="font-bold text-slate-700">{item.sku}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center text-xs">
                        {item.discount && item.discount > 0 ? (
                          <span className="text-slate-500 line-through text-[11px]">RM {item.retailPrice?.toFixed(2)}</span>
                        ) : null}
                        <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                          RM {item.paidAmount?.toFixed(2) || '0.00'}
                        </span>
                        <span className="text-slate-500 font-bold">x{item.quantity || 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Key Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Order SN */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold uppercase text-slate-500">Order Serial Number</span>
              <div className="flex items-center justify-between font-mono font-bold text-sm text-blue-700">
                <span className="truncate">{order.orderSn}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(order.orderSn, 'modal_sn')}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Copy SN"
                >
                  {copiedKey === 'modal_sn' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Buyer Username */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-blue-600" /> Buyer Username
              </span>
              <div className="flex items-center justify-between font-bold text-sm text-slate-900">
                <span className="truncate">@{order.buyerUsername}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(order.buyerUsername, 'modal_user')}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Copy Username"
                >
                  {copiedKey === 'modal_user' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Payment Method */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Payment Method
              </span>
              <p className="text-xs sm:text-sm font-bold text-slate-800">{order.paymentMethod || (platformName === 'Lazada' ? 'Lazada Payment' : 'ShopeePay')}</p>
            </div>

            {/* Quantity */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold uppercase text-slate-500">Quantity Units</span>
              <p className="text-xs sm:text-sm font-bold text-slate-800">{order.quantity || 1} Unit(s)</p>
            </div>
          </div>

          {/* 3-Stage Order Lifecycle Timestamps Card */}
          {(() => {
            const timeline = getTimelineTimestamps(order);

            return (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-600" /> Fulfillment Timeline (3 Stage Timestamps)
                    </span>
                    {order.isApiSynced && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold flex items-center gap-1 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Live {platformName} API Synced
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                      Auto Local Time (MYT / GMT+8)
                    </span>
                  </div>
                </div>

                {syncStatusMsg && (
                  <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                    <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{syncStatusMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Stage 1: Payment Date */}
                  <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-700 font-bold text-[11px] uppercase">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>1. Buyer Payment Time</span>
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-900">{formatMalaysiaTime(timeline.orderDate)}</p>
                  </div>

                  {/* Stage 2: CS Shipped / Code Sent Time */}
                  <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                    <div className="flex items-center gap-1.5 text-sky-700 font-bold text-[11px] uppercase">
                      <Send className="w-3.5 h-3.5 text-sky-500" />
                      <span>2. CS Shipped (Code Sent)</span>
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-900">{formatMalaysiaTime(timeline.shipTime)}</p>
                  </div>

                  {/* Stage 3: Buyer Delivered / Order Completed Time */}
                  <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px] uppercase">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>3. Buyer Delivered &amp; Completed</span>
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-900">{formatMalaysiaTime(timeline.deliveryTime)}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Customer Contact & Address Info */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-blue-600" /> Customer Contact &amp; Delivery Address
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">Recipient Name</span>
                <p className="font-bold text-slate-900">{displayBuyerName}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-500">Phone Number</span>
                <p className="font-mono font-bold text-slate-900 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" /> {displayPhone}
                </p>
              </div>
            </div>

            <div className="pt-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">Full Shipping Address</span>
              <p className="font-semibold text-slate-800 flex items-start gap-1.5 mt-0.5">
                <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span>{displayAddress}</span>
              </p>
            </div>
          </div>

          {/* Financial Escrow Breakdown */}
          {(() => {
            const merchandiseSubtotal = (order.costOfGoodsSold && order.costOfGoodsSold > 0)
              ? order.costOfGoodsSold
              : (order.totalAmount || 0);
            const commissionFee = order.commissionFee || 0;
            const transactionFee = order.transactionFee || 0;
            const adsEscrowFee = order.adsEscrowFee || 0;
            const serviceFee = order.serviceFee || 0;
            const sellerVoucher = order.sellerVoucherDiscount || 0;
            const netEscrow = calculateNetIncome(order);

            return (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-blue-600" /> Financial Escrow Settlement
                </span>

                <div className="divide-y divide-slate-200 text-xs">
                  <div className="py-2 flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Merchandise Subtotal (GMV)</span>
                    <span className="font-mono font-bold text-slate-900">RM {merchandiseSubtotal.toFixed(2)}</span>
                  </div>

                  <div className="py-2 flex items-center justify-between text-blue-600">
                    <span className="font-medium">Voucher Used / Seller Discount</span>
                    <span className="font-mono font-bold">- RM {sellerVoucher.toFixed(2)}</span>
                  </div>

                  <div className="py-2 flex items-center justify-between text-rose-600">
                    <span className="font-medium">Commission Fee</span>
                    <span className="font-mono font-bold">- RM {commissionFee.toFixed(2)}</span>
                  </div>

                  <div className="py-2 flex items-center justify-between text-amber-600">
                    <span className="font-medium">{platformName === 'Lazada' ? 'Payment / Transaction Fee' : 'Transaction Fee'}</span>
                    <span className="font-mono font-bold">- RM {transactionFee.toFixed(2)}</span>
                  </div>

                  <div className="py-2 flex items-center justify-between text-rose-700">
                    <span className="font-medium">Service Fee</span>
                    <span className="font-mono font-bold">- RM {serviceFee.toFixed(2)}</span>
                  </div>

                  <div className="py-2 flex items-center justify-between text-purple-600">
                    <span className="font-medium">{platformName === 'Lazada' ? 'Marketing / Promotional Fee' : 'Ads / Technical Fee'}</span>
                    <span className="font-mono font-bold">- RM {adsEscrowFee.toFixed(2)}</span>
                  </div>

                  <div className="py-2 flex items-center justify-between text-emerald-700 font-extrabold text-sm pt-2">
                    <span>Net Escrow Deposited to Wallet</span>
                    <span className="font-mono">RM {netEscrow.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
