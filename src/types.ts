export interface OrderItem {
  name: string;
  variation?: string;
  retailPrice?: number;
  paidAmount?: number;
  quantity?: number;
  sku?: string;
  itemId?: string;
  discount?: number;
  phone?: string;
}

export interface ShopeeOrder {
  id: string; // Internal unique ID or row index
  orderSn: string; // Order SN
  buyerUsername: string; // Buyer Username
  productName: string; // Product Name
  items?: OrderItem[]; // Multi-item breakdown / product variations
  totalAmount: number; // Total Amount (numeric)
  rawTotalAmount?: string; // Original formatted string (e.g. "RM 45.90" or "45.90")
  costOfGoodsSold?: number; // Merchandise Subtotal (cost_of_goods_sold)
  sellerVoucherDiscount?: number; // Shop Vouchers & Rebates (voucher_from_seller)
  sellerRebate?: number; // Seller Rebate
  commissionFee?: number; // Shopee Commission Fee (commission_fee)
  transactionFee?: number; // Shopee Transaction Fee (seller_transaction_fee)
  adsEscrowFee?: number; // Shopee Ads Escrow / Tech Support Fee (ads_escrow_top_up_fee_or_technical_support_fee)
  serviceFee?: number; // Shopee Service Fee (service_fee)
  escrowAmount?: number; // Net Estimated Order Income / Escrow Amount (escrow_amount)
  orderStatus: string; // Order Status (e.g. Completed, Unpaid, Cancelled, In Transit)
  orderDate?: string; // Order Creation Date & Paid Time (e.g. 2026-07-20 14:22)
  shipTime?: string; // Fulfillment / Ship Time when customer service sent code (e.g. 2026-07-20 14:30)
  deliveryTime?: string; // Delivery / Order Received Time when buyer accepted / escrow released (e.g. 2026-07-20 15:00)
  paymentMethod?: string; // e.g. ShopeePay, Online Banking, Credit Card
  quantity?: number; // e.g. 1
  voucherCode?: string; // e.g. WCG2U_NEON10
  skuRef?: string; // Digital SKU reference
  buyerPhone?: string; // Customer contact phone (e.g. +60 12-345 6789)
  shippingAddress?: string; // Full delivery / shipping address
  recipientName?: string; // Recipient / Full name
  buyerName?: string; // Buyer Real Name (e.g. Ahmad Rizal)
  channel?: 'Shopee' | 'Lazada' | 'WCG2U'; // E-commerce channel (Shopee, Lazada, WCG2U)
  platform?: string; // Platform identifier
  isSample?: boolean; // True if this order originated from default demo dataset
  [key: string]: any; // Support for extra dynamically parsed columns from any custom CSV
}

export type SortOrder = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  order: SortOrder;
}

export type DatePreset = 'all' | 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'custom';

export interface FilterState {
  status: string; // 'All' or specific status
  searchQuery: string;
  minAmount: number | null;
  maxAmount: number | null;
  productCategory: string; // 'All' or category filter pill
  datePreset: DatePreset;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
}

export interface ColumnDefinition {
  key: string;
  label: string;
  visible: boolean;
  isNumeric?: boolean;
}

export type UserRole = 'admin' | 'accountant' | 'cs' | 'marketing';

export interface UserRoleInfo {
  role: UserRole;
  label: string;
  hiddenTabs: string[];
  hiddenSettingsSections: number[]; // e.g. [1, 3] for accountant
}

