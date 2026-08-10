import { ColumnDefinition } from '../types';

export const SAMPLE_SHOPEE_CSV = `Order SN,Buyer Username,Buyer Name,Buyer Phone,Shipping Address,Product Name,Total Amount,Order Status,Order Date,Ship Time,Delivery Time,Payment Method,Quantity,SKU Ref,Channel
260728UE5M6J04,aisyhafiy852,Aisy Hafiy,+60 12-345 6789,"Block A, Bangsar, 59000 Kuala Lumpur",Steam Wallet Code MYR 10 Instant Code,RM 6.15,Completed,2026-07-28 21:02:14,2026-07-28 21:03:38,2026-07-28 21:04:18,ShopeePay Balance,1,STEAM-MYR10,Shopee
260728T7AFJXPW,vrqvdil,Irnatila D. Li,+60 17-889 0012,"No 12, Taman University, 43600 Bangi, Selangor",Steam Wallet Code MYR 20 Instant Code,RM 19.25,Completed,2026-07-28 09:27:01,2026-07-28 09:28:49,2026-07-28 09:58:00,Online Banking,1,STEAM-MYR20,Shopee
2607219X8NTFCX,amirulashrafyusma,Amirul Ashraf Yusma,+60 19-855 1401,"Sublot 156, Taman Bilangan Phase 2, 97000 Bintulu, Sarawak",Steam Wallet Code MYR 20 Instant Code,RM 18.70,Completed,2026-07-21 22:10:00,2026-07-28 16:40:12,2026-07-28 21:04:45,Online Banking,1,STEAM-MYR20,Shopee
2607219K3JW1YB,anwaraqil381,Anwar Aqil,+60 14-998 1234,"Lot 88, Jalan SS2/10, 47300 Petaling Jaya, Selangor",Steam Wallet Code MYR 20 Instant Code,RM 15.82,Completed,2026-07-21 18:20:00,2026-07-28 18:10:05,2026-07-28 21:04:12,DuitNow QR,1,STEAM-MYR20,Shopee
260725M520MPGM,ihsanzulhusmi,Ihsan Zulhusmi,+60 11-2345 6789,"Block B-08-11, Bangsar South, 59200 Kuala Lumpur",Steam Wallet Code MYR 20 Instant Code,RM 14.18,Completed,2026-07-25 19:45:00,2026-07-28 19:20:18,2026-07-28 21:04:50,ShopeePay Balance,1,STEAM-MYR20,Shopee
260728U4WR1WC4,en_zul,Muhammad Zulfadli,+60 16-882 1042,"No. 45, Taman Mount Austin, 81100 Johor Bahru, Johor",Steam Wallet Code MYR 30 Instant Code,RM 24.76,Completed,2026-07-28 18:16:47,2026-07-28 18:20:30,2026-07-28 18:32:15,Online Banking,1,STEAM-MYR30,Shopee
260729VN5Q22FS,sahril2608,Mohammad Sahri Bin Dorahman,+60 19-855 1401,"Sublot 156, Taman Bilangan Phase 2, 97000 Bintulu, Sarawak",Steam Wallet Code MYR 100 Instant Code,RM 100.00,Completed,2026-07-29 08:40:14,2026-07-29 08:43:14,2026-07-29 08:44:00,ShopeePay,1,STEAM-MYR100,Shopee
LZD9847120341,lazada_gamer_01,Chong Wei Lun,+60 17-332 9911,"Block B, Mont Kiara, 50480 Kuala Lumpur",PlayStation Network MYR 100 Wallet Top Up,RM 100.00,Completed,2026-07-28 14:10:00,2026-07-28 14:12:30,2026-07-28 14:15:00,Lazada Wallet,1,PSN-MYR100,Lazada
LZD9847120342,shanti_k,Shanti Devi A/P Gopal,+60 14-998 1234,"No 12, Taman Universiti, 43600 Bangi, Selangor",Nintendo eShop $20 Digital Card,RM 88.00,Completed,2026-07-28 11:20:00,2026-07-28 11:22:00,2026-07-28 11:25:00,Online Banking,1,NES-USD20,Lazada
WCG2U-20260729-001,wcg_vip_direct,Lee Meng Teck,+60 12-888 7766,"No 88, Jalan SS2/10, 47300 Petaling Jaya, Selangor",Steam Wallet Code MYR 200 Instant Digital Code,RM 198.00,Completed,2026-07-29 10:15:00,2026-07-29 10:17:00,2026-07-29 10:18:30,Direct FPX / WCG2U Pay,1,STEAM-MYR200,WCG2U
WCG2U-20260729-002,pro_player_wcg,Amirul Hafiz Bin Hassan,+60 11-2345 6789,"Jalan Sultan Ismail, 50250 Kuala Lumpur",Valorant 4000 VP Points Instant Topup,RM 165.00,Completed,2026-07-28 16:30:00,2026-07-28 16:32:00,2026-07-28 16:33:30,Touch n Go eWallet,1,VAL-4000VP,WCG2U
`;

export const INITIAL_COLUMNS: ColumnDefinition[] = [
  { key: 'orderSn', label: 'Order SN', visible: true },
  { key: 'buyerUsername', label: 'Buyer', visible: true },
  { key: 'productName', label: 'Product Name', visible: true },
  { key: 'channel', label: 'Channel', visible: true },
  { key: 'orderDate', label: 'Order Date', visible: true },
  { key: 'totalAmount', label: 'Total Amount (GMV)', visible: true, isNumeric: true },
  { key: 'sellerVoucherDiscount', label: 'Vouchers', visible: false, isNumeric: true },
  { key: 'commissionFee', label: 'Commission', visible: false, isNumeric: true },
  { key: 'transactionFee', label: 'Transaction Fee', visible: false, isNumeric: true },
  { key: 'adsEscrowFee', label: 'Ads Escrow Fee', visible: false, isNumeric: true },
  { key: 'escrowAmount', label: 'Net Income', visible: true, isNumeric: true },
  { key: 'quantity', label: 'Quantity', visible: true, isNumeric: true },
  { key: 'shipTime', label: 'Ship Time', visible: false },
  { key: 'deliveryTime', label: 'Delivery Time', visible: false },
  { key: 'buyerRace', label: 'Buyer Ethnicity', visible: false },
  { key: 'paymentMethod', label: 'Payment Method', visible: false },
  { key: 'shippingAddress', label: 'Shipping Address', visible: false },
  { key: 'skuRef', label: 'SKU Ref', visible: false },
  { key: 'orderStatus', label: 'Order Status', visible: true },
];
